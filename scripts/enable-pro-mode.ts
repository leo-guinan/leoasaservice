#!/usr/bin/env tsx

import 'dotenv/config';
import { getDb } from '../server/db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function enableProMode() {
  console.log('⚡ Enabling Pro Mode');
  console.log('='.repeat(50));

  try {
    const db = getDb();
    
    // Get all users
    const allUsers = await db.select().from(users);
    
    console.log(`Found ${allUsers.length} users:`);
    allUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.username} (ID: ${user.id}) - Pro Mode: ${user.proMode ? '✅ Enabled' : '❌ Disabled'}`);
    });
    
    // Enable pro mode for the first user (assuming test user)
    const userId = 1;
    const user = allUsers.find(u => u.id === userId);
    
    if (!user) {
      console.error(`User with ID ${userId} not found`);
      return;
    }
    
    if (user.proMode) {
      console.log(`✅ User ${user.username} already has pro mode enabled`);
    } else {
      await db
        .update(users)
        .set({ proMode: true })
        .where(eq(users.id, userId));
      
      console.log(`✅ Enabled pro mode for user: ${user.username}`);
    }
    
    // Verify the update
    const updatedUser = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (updatedUser.length > 0) {
      console.log(`\n📊 Updated user status:`);
      console.log(`- Username: ${updatedUser[0].username}`);
      console.log(`- Pro Mode: ${updatedUser[0].proMode ? '✅ Enabled' : '❌ Disabled'}`);
      console.log(`- Role: ${updatedUser[0].role}`);
    }
    
    console.log('\n🎯 Pro Mode Features Now Available:');
    console.log('• Create multiple context profiles');
    console.log('• Switch between different research contexts');
    console.log('• Manual context updates');
    console.log('• Profile management (create, switch, delete)');
    
    console.log('\n📝 Next steps:');
    console.log('1. Start your server: npm run dev');
    console.log('2. Look for the "Pro Mode" button in the header');
    console.log('3. Click it to open the pro mode panel');
    console.log('4. Create your first context profile');
    console.log('5. Switch between profiles and update contexts manually');
    
  } catch (error) {
    console.error('❌ Error enabling pro mode:', error);
  }
}

// Run the script
enableProMode().catch(console.error); 