#!/usr/bin/env tsx

import 'dotenv/config';
import { getDb } from '../server/db';
import { urls, contextUrls, users, userContextProfiles } from '../shared/schema';
import { eq, and, isNull } from 'drizzle-orm';

async function migrateExistingUrls() {
  console.log('🔄 Migrating Existing URLs to Default Context');
  console.log('='.repeat(50));

  try {
    const db = getDb();
    
    console.log('📊 Step 1: Analyzing existing data...');
    
    // Get all users
    const allUsers = await db.select().from(users);
    console.log(`Found ${allUsers.length} users`);
    
    // Get all existing URLs
    const existingUrls = await db.select().from(urls);
    console.log(`Found ${existingUrls.length} existing URLs`);
    
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
    
    console.log(`\n📝 Step 2: Processing users and their URLs...`);
    
    let totalMigrated = 0;
    let totalUsersProcessed = 0;
    
    for (const user of allUsers) {
      console.log(`\n👤 Processing user: ${user.username} (ID: ${user.id})`);
      
      const userUrls = urlsByUser.get(user.id) || [];
      console.log(`  - Has ${userUrls.length} URLs to migrate`);
      
      if (userUrls.length === 0) {
        console.log(`  - No URLs to migrate for this user`);
        continue;
      }
      
      // Check if user has pro mode enabled
      if (user.proMode) {
        console.log(`  - User has pro mode enabled`);
        
        // Get user's default context (profile ID 0)
        // For pro mode users, we need to check if they have any active profiles
        const activeProfiles = await db
          .select()
          .from(userContextProfiles)
          .where(and(
            eq(userContextProfiles.userId, user.id),
            eq(userContextProfiles.isActive, true)
          ));
        
        if (activeProfiles.length > 0) {
          console.log(`  - User has active profile: ${activeProfiles[0].name} (ID: ${activeProfiles[0].id})`);
          console.log(`  - URLs will be migrated to the active profile context`);
          
          // Migrate URLs to the active profile
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
          
          console.log(`  - ✅ Migrated ${migratedUrls.length} URLs to profile context`);
          totalMigrated += migratedUrls.length;
        } else {
          console.log(`  - User has no active profile, URLs will remain in main table for default context`);
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
    console.log(`- URLs migrated to context tables: ${existingContextUrls.length + totalMigrated - existingUrls.length}`);
    console.log(`- URLs remaining in main table: ${existingUrls.length - (existingContextUrls.length + totalMigrated - existingUrls.length)}`);
    
    // Verify the migration
    console.log(`\n🔍 Step 4: Verification...`);
    
    const finalContextUrls = await db.select().from(contextUrls);
    const finalMainUrls = await db.select().from(urls);
    
    console.log(`- Final context URLs: ${finalContextUrls.length}`);
    console.log(`- Final main URLs: ${finalMainUrls.length}`);
    
    // Check for any orphaned URLs (URLs that should be in context but aren't)
    const orphanedUrls = finalMainUrls.filter(url => {
      const user = allUsers.find(u => u.id === url.userId);
      if (!user) return false;
      
      if (user.proMode) {
        // For pro mode users, check if they have active profiles
        // We'll check this by looking for context URLs for this user
        const userContextUrls = finalContextUrls.filter(cu => cu.userId === url.userId);
        return userContextUrls.length === 0; // If no context URLs, this URL might be orphaned
      }
      return false;
    });
    
    if (orphanedUrls.length > 0) {
      console.log(`⚠️  Warning: Found ${orphanedUrls.length} URLs that may need manual migration`);
      console.log(`   These URLs belong to pro mode users but are still in the main table`);
    } else {
      console.log(`✅ All URLs properly assigned to appropriate contexts`);
    }
    
    console.log(`\n✅ Migration Complete!`);
    console.log(`\n📝 Next steps:`);
    console.log(`1. Start your server: npm run dev`);
    console.log(`2. Enable pro mode for users who want it`);
    console.log(`3. Verify that existing URLs appear in the default context`);
    console.log(`4. Test context switching to ensure data is preserved`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration
migrateExistingUrls().catch(console.error); 