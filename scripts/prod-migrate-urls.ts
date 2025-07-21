#!/usr/bin/env tsx

import 'dotenv/config';
import { getDb } from '../server/db';
import { urls, contextUrls, users, userContextProfiles } from '../shared/schema';
import { eq, and } from 'drizzle-orm';

async function prodMigrateUrls() {
  console.log('🔄 Production URL Migration - Safe Mode');
  console.log('='.repeat(50));
  console.log('⚠️  This script will NOT delete any data from the main tables');
  console.log('⚠️  It will only copy URLs to context tables for pro mode users');
  console.log('='.repeat(50));

  try {
    const db = getDb();
    
    console.log('📊 Step 1: Analyzing existing data...');
    
    // Get all users
    const allUsers = await db.select().from(users);
    console.log(`Found ${allUsers.length} users`);
    
    // Get all existing URLs
    const existingUrls = await db.select().from(urls);
    console.log(`Found ${existingUrls.length} existing URLs in main table`);
    
    // Get all context URLs to see what's already migrated
    const existingContextUrls = await db.select().from(contextUrls);
    console.log(`Found ${existingContextUrls.length} existing context URLs`);
    
    // Group URLs by user
    const urlsByUser = new Map<number, any[]>();
    for (const url of existingUrls) {
      if (!urlsByUser.has(url.userId)) {
        urlsByUser.set(url.userId, []);
      }
      urlsByUser.get(url.userId)!.push(url);
    }
    
    console.log(`\n📝 Step 2: Processing pro mode users...`);
    
    let totalMigrated = 0;
    let totalUsersProcessed = 0;
    
    for (const user of allUsers) {
      console.log(`\n👤 Processing user: ${user.username} (ID: ${user.id})`);
      
      const userUrls = urlsByUser.get(user.id) || [];
      console.log(`  - Has ${userUrls.length} URLs in main table`);
      
      if (userUrls.length === 0) {
        console.log(`  - No URLs to migrate for this user`);
        continue;
      }
      
      // Check if user has pro mode enabled
      if (user.proMode) {
        console.log(`  - User has pro mode enabled`);
        
        // Check if user has any active profiles
        const activeProfiles = await db
          .select()
          .from(userContextProfiles)
          .where(and(
            eq(userContextProfiles.userId, user.id),
            eq(userContextProfiles.isActive, true)
          ));
        
        if (activeProfiles.length > 0) {
          console.log(`  - User has active profile: ${activeProfiles[0].name} (ID: ${activeProfiles[0].id})`);
          
          // Check if URLs are already migrated to this profile
          const existingProfileUrls = await db
            .select()
            .from(contextUrls)
            .where(eq(contextUrls.profileId, activeProfiles[0].id));
          
          if (existingProfileUrls.length > 0) {
            console.log(`  - ⚠️  Profile already has ${existingProfileUrls.length} URLs`);
            console.log(`  - Skipping migration to avoid duplicates`);
            totalMigrated += userUrls.length; // Count as handled
          } else {
            console.log(`  - Migrating URLs to active profile context`);
            
            // Migrate URLs to the active profile (COPY only, don't delete)
            const migratedUrls = await db.insert(contextUrls).values(
              userUrls.map(url => ({
                profileId: activeProfiles[0].id,
                userId: url.userId,
                url: url.url,
                title: url.title,
                notes: url.notes,
                content: url.content,
                analysis: url.analysis,
                createdAt: url.createdAt,
              }))
            ).returning();
            
            console.log(`  - ✅ Copied ${migratedUrls.length} URLs to profile context`);
            totalMigrated += migratedUrls.length;
          }
        } else {
          console.log(`  - User has no active profile`);
          console.log(`  - URLs will remain in main table for default context`);
          console.log(`  - ✅ ${userUrls.length} URLs already in default context`);
          totalMigrated += userUrls.length;
        }
      } else {
        console.log(`  - User does not have pro mode enabled`);
        console.log(`  - URLs will remain in main table for regular users`);
        console.log(`  - ✅ ${userUrls.length} URLs already in main context`);
        totalMigrated += userUrls.length;
      }
      
      totalUsersProcessed++;
    }
    
    console.log(`\n📊 Step 3: Migration Summary`);
    console.log(`- Total users processed: ${totalUsersProcessed}`);
    console.log(`- Total URLs handled: ${totalMigrated}`);
    
    // Verify the migration
    console.log(`\n🔍 Step 4: Verification...`);
    
    const finalContextUrls = await db.select().from(contextUrls);
    const finalMainUrls = await db.select().from(urls);
    
    console.log(`- Final context URLs: ${finalContextUrls.length}`);
    console.log(`- Final main URLs: ${finalMainUrls.length}`);
    console.log(`- URLs copied: ${finalContextUrls.length - existingContextUrls.length}`);
    
    // Show breakdown by user
    console.log(`\n📊 Step 5: Breakdown by user...`);
    
    for (const user of allUsers) {
      const userContextUrls = finalContextUrls.filter(cu => cu.userId === user.id);
      const userMainUrls = finalMainUrls.filter(u => u.userId === user.id);
      
      console.log(`\n👤 ${user.username} (Pro Mode: ${user.proMode ? 'Yes' : 'No'}):`);
      console.log(`  - Context URLs: ${userContextUrls.length}`);
      console.log(`  - Main URLs: ${userMainUrls.length}`);
      
      if (user.proMode && userMainUrls.length > 0) {
        console.log(`  - ℹ️  Pro mode user has URLs in main table (these are in default context)`);
      }
    }
    
    console.log(`\n✅ Production Migration Complete!`);
    console.log(`\n📝 What happened:`);
    console.log(`• Pro mode users with active profiles: URLs copied to profile context`);
    console.log(`• Pro mode users without active profiles: URLs stay in main table (default context)`);
    console.log(`• Regular users: URLs stay in main table`);
    console.log(`• No data was deleted from main tables`);
    console.log(`\n📝 Next steps:`);
    console.log(`1. Start your server: npm run dev`);
    console.log(`2. Pro mode users will see their URLs in the appropriate context`);
    console.log(`3. Users without active profiles will see URLs in default context`);
    console.log(`4. Test context switching to ensure data is preserved`);
    console.log(`5. If everything works correctly, you can optionally clean up main table URLs later`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration
prodMigrateUrls().catch(console.error); 