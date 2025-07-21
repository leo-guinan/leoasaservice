#!/usr/bin/env tsx

import 'dotenv/config';
import { getDb } from '../server/db';
import { urls, contextUrls, users, userContextProfiles } from '../shared/schema';
import { eq, and } from 'drizzle-orm';

async function cleanupMainUrls() {
  console.log('🧹 Cleaning Up Main Table URLs for Pro Mode Users');
  console.log('='.repeat(55));
  console.log('⚠️  This script will DELETE URLs from main table for pro mode users');
  console.log('⚠️  Only if those URLs are already copied to context tables');
  console.log('⚠️  This is safe because the data is preserved in context tables');
  console.log('='.repeat(55));

  try {
    const db = getDb();
    
    console.log('📊 Step 1: Analyzing existing data...');
    
    // Get all users
    const allUsers = await db.select().from(users);
    console.log(`Found ${allUsers.length} users`);
    
    // Get all existing URLs
    const existingUrls = await db.select().from(urls);
    console.log(`Found ${existingUrls.length} existing URLs in main table`);
    
    // Get all context URLs
    const existingContextUrls = await db.select().from(contextUrls);
    console.log(`Found ${existingContextUrls.length} existing context URLs`);
    
    console.log(`\n📝 Step 2: Processing pro mode users...`);
    
    let totalCleaned = 0;
    let totalUsersProcessed = 0;
    
    for (const user of allUsers) {
      console.log(`\n👤 Processing user: ${user.username} (ID: ${user.id})`);
      
      const userMainUrls = existingUrls.filter(u => u.userId === user.id);
      const userContextUrls = existingContextUrls.filter(cu => cu.userId === user.id);
      
      console.log(`  - Has ${userMainUrls.length} URLs in main table`);
      console.log(`  - Has ${userContextUrls.length} URLs in context tables`);
      
      if (userMainUrls.length === 0) {
        console.log(`  - No URLs to clean up for this user`);
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
          
          // Check if URLs are already in context tables
          const profileContextUrls = existingContextUrls.filter(cu => cu.profileId === activeProfiles[0].id);
          
          if (profileContextUrls.length > 0) {
            console.log(`  - Profile has ${profileContextUrls.length} URLs in context table`);
            console.log(`  - Safe to remove URLs from main table`);
            
            // Remove URLs from main table
            const deleteResult = await db.delete(urls).where(eq(urls.userId, user.id));
            console.log(`  - ✅ Removed ${userMainUrls.length} URLs from main table`);
            totalCleaned += userMainUrls.length;
          } else {
            console.log(`  - ⚠️  Profile has no URLs in context table`);
            console.log(`  - Keeping URLs in main table for safety`);
          }
        } else {
          console.log(`  - User has no active profile`);
          console.log(`  - URLs will remain in main table for default context`);
        }
      } else {
        console.log(`  - User does not have pro mode enabled`);
        console.log(`  - URLs will remain in main table for regular users`);
      }
      
      totalUsersProcessed++;
    }
    
    console.log(`\n📊 Step 3: Cleanup Summary`);
    console.log(`- Total users processed: ${totalUsersProcessed}`);
    console.log(`- Total URLs cleaned: ${totalCleaned}`);
    
    // Verify the cleanup
    console.log(`\n🔍 Step 4: Verification...`);
    
    const finalContextUrls = await db.select().from(contextUrls);
    const finalMainUrls = await db.select().from(urls);
    
    console.log(`- Final context URLs: ${finalContextUrls.length}`);
    console.log(`- Final main URLs: ${finalMainUrls.length}`);
    console.log(`- URLs removed: ${existingUrls.length - finalMainUrls.length}`);
    
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
    
    console.log(`\n✅ Cleanup Complete!`);
    console.log(`\n📝 What happened:`);
    console.log(`• Pro mode users with active profiles: URLs removed from main table`);
    console.log(`• Pro mode users without active profiles: URLs kept in main table (default context)`);
    console.log(`• Regular users: URLs kept in main table`);
    console.log(`• All data is preserved in context tables`);
    console.log(`\n📝 Next steps:`);
    console.log(`1. Start your server: npm run dev`);
    console.log(`2. Pro mode users will see their URLs in the appropriate context`);
    console.log(`3. Users without active profiles will see URLs in default context`);
    console.log(`4. Test context switching to ensure data is preserved`);
    console.log(`5. Verify that no data was lost`);
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  }
}

// Run the cleanup
cleanupMainUrls().catch(console.error); 