#!/usr/bin/env tsx

import 'dotenv/config';
import { getDb } from '../server/db';
import { userContextProfiles, userContextProfileData, users } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function cleanupProProfiles() {
  console.log('🧹 Cleaning up Pro Mode Profiles');
  console.log('='.repeat(50));

  try {
    const db = getDb();
    const userId = 1;
    
    // Get existing profiles
    const existingProfiles = await db
      .select()
      .from(userContextProfiles)
      .where(eq(userContextProfiles.userId, userId));
    
    console.log(`Found ${existingProfiles.length} existing profiles:`);
    existingProfiles.forEach((profile, index) => {
      console.log(`${index + 1}. ${profile.name} (ID: ${profile.id})`);
    });
    
    if (existingProfiles.length === 0) {
      console.log('✅ No profiles to clean up');
      return;
    }
    
    // Delete profile data first
    for (const profile of existingProfiles) {
      await db
        .delete(userContextProfileData)
        .where(eq(userContextProfileData.profileId, profile.id));
      console.log(`🗑️ Deleted data for profile: ${profile.name}`);
    }
    
    // Delete profiles
    await db
      .delete(userContextProfiles)
      .where(eq(userContextProfiles.userId, userId));
    
    console.log(`✅ Deleted ${existingProfiles.length} profiles`);
    
    // Verify cleanup
    const remainingProfiles = await db
      .select()
      .from(userContextProfiles)
      .where(eq(userContextProfiles.userId, userId));
    
    console.log(`📊 Remaining profiles: ${remainingProfiles.length}`);
    
    console.log('\n✅ Cleanup complete! Ready for fresh testing.');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}

// Run the cleanup
cleanupProProfiles().catch(console.error); 