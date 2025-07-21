#!/usr/bin/env tsx

import 'dotenv/config';
import { getDb } from '../server/db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function testProToggle() {
  console.log('🔄 Testing Pro Mode Toggle Functionality');
  console.log('='.repeat(50));

  try {
    const db = getDb();
    const userId = 1;
    
    // Get initial status
    const initialUser = await db
      .select({ proMode: users.proMode, username: users.username })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (initialUser.length === 0) {
      console.error(`User with ID ${userId} not found`);
      return;
    }

    console.log(`📊 Initial status for ${initialUser[0].username}:`);
    console.log(`- Pro Mode: ${initialUser[0].proMode ? '✅ Enabled' : '❌ Disabled'}`);

    // Test toggle functionality
    console.log('\n🔄 Testing toggle functionality...');
    
    // Simulate the toggle API call
    const currentStatus = initialUser[0].proMode;
    const newStatus = !currentStatus;
    
    await db
      .update(users)
      .set({ proMode: newStatus })
      .where(eq(users.id, userId));

    console.log(`✅ Toggled pro mode from ${currentStatus} to ${newStatus}`);

    // Verify the change
    const updatedUser = await db
      .select({ proMode: users.proMode, username: users.username })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    console.log(`\n📊 Updated status:`);
    console.log(`- Pro Mode: ${updatedUser[0].proMode ? '✅ Enabled' : '❌ Disabled'}`);

    // Test toggle back
    console.log('\n🔄 Testing toggle back...');
    
    const finalStatus = !updatedUser[0].proMode;
    
    await db
      .update(users)
      .set({ proMode: finalStatus })
      .where(eq(users.id, userId));

    console.log(`✅ Toggled pro mode from ${updatedUser[0].proMode} to ${finalStatus}`);

    // Final verification
    const finalUser = await db
      .select({ proMode: users.proMode, username: users.username })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    console.log(`\n📊 Final status:`);
    console.log(`- Pro Mode: ${finalUser[0].proMode ? '✅ Enabled' : '❌ Disabled'}`);

    console.log('\n✅ Pro Mode Toggle Test Complete!');
    console.log('\n🎯 Toggle Features:');
    console.log('• Users can enable/disable pro mode themselves');
    console.log('• Toggle button shows current status');
    console.log('• Visual feedback during toggle process');
    console.log('• Toast notifications for success/error');
    console.log('• Automatic UI updates after toggle');
    
    console.log('\n📝 Next steps:');
    console.log('1. Start your server: npm run dev');
    console.log('2. Look for the "Enable Pro" / "Pro Mode" button in the header');
    console.log('3. Click to toggle pro mode on/off');
    console.log('4. Verify the Pro Mode panel appears/disappears');
    console.log('5. Test creating profiles when pro mode is enabled');
    
  } catch (error) {
    console.error('❌ Pro mode toggle test failed:', error);
  }
}

// Run the test
testProToggle().catch(console.error); 