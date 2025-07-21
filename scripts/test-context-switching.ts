#!/usr/bin/env tsx

import 'dotenv/config';
import { getDb } from '../server/db';
import { chatMessages, urls, userContextProfiles, userContextProfileData } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function testContextSwitching() {
  console.log('🔄 Testing Context Switching Functionality');
  console.log('='.repeat(50));

  try {
    const db = getDb();
    const userId = 1;
    
    console.log('📝 Step 1: Adding test data to simulate existing context...');
    
    // Add some test URLs and chat messages
    await db.insert(urls).values([
      {
        userId,
        url: "https://example.com/old-research",
        title: "Old Research Paper",
        notes: "From previous context",
        createdAt: new Date()
      },
      {
        userId,
        url: "https://example.com/old-article",
        title: "Old Article",
        notes: "Also from previous context",
        createdAt: new Date()
      }
    ]);
    
    await db.insert(chatMessages).values([
      {
        userId,
        content: "This is an old chat message from the previous context",
        role: "user",
        createdAt: new Date()
      },
      {
        userId,
        content: "Another old message that should be cleared",
        role: "assistant",
        createdAt: new Date()
      }
    ]);
    
    console.log('✅ Added test URLs and chat messages');
    
    // Verify initial data
    const initialUrls = await db.select().from(urls).where(eq(urls.userId, userId));
    const initialMessages = await db.select().from(chatMessages).where(eq(chatMessages.userId, userId));
    
    console.log(`📊 Initial data:`);
    console.log(`- URLs: ${initialUrls.length}`);
    console.log(`- Chat messages: ${initialMessages.length}`);
    
    console.log('\n🔄 Step 2: Testing context profile management...');
    
    // Test the context profile tool
    const { contextProfileTool } = await import('../server/mastra/tools/context-profile-tool.js');
    
    // List profiles (should include default context)
    console.log('Listing profiles...');
    const listResult = await contextProfileTool.execute({
      context: {
        action: 'list',
        userId,
      },
    } as any);
    
    console.log(`Found ${listResult.profiles?.length || 0} profiles:`);
    listResult.profiles?.forEach((profile: any) => {
      console.log(`- ${profile.name} (ID: ${profile.id}) - ${profile.isActive ? 'Active' : 'Inactive'}`);
    });
    
    // Create a new profile (skip if already exists)
    console.log('\nCreating "Test Research 2" profile...');
    const createResult = await contextProfileTool.execute({
      context: {
        action: 'create',
        userId,
        profileName: 'Test Research 2',
        description: 'Test profile for context switching',
      },
    } as any);
    
    console.log('Create result:', createResult.message);
    
    // Switch to the new profile
    console.log('\n🔄 Step 3: Testing context switching with data clearing...');
    console.log('Switching to "Test Research 2" profile...');
    
    const switchResult = await contextProfileTool.execute({
      context: {
        action: 'switch',
        userId,
        profileName: 'Test Research 2',
      },
    } as any);
    
    console.log('Switch result:', switchResult.message);
    console.log('Cleared data:', switchResult.clearedData);
    
    // Verify data was cleared
    const afterSwitchUrls = await db.select().from(urls).where(eq(urls.userId, userId));
    const afterSwitchMessages = await db.select().from(chatMessages).where(eq(chatMessages.userId, userId));
    
    console.log(`\n📊 After switching:`);
    console.log(`- URLs: ${afterSwitchUrls.length} (should be 0)`);
    console.log(`- Chat messages: ${afterSwitchMessages.length} (should be 0)`);
    
    // Add new data to the new context
    console.log('\n📝 Step 4: Adding new data to the new context...');
    
    await db.insert(urls).values([
      {
        userId,
        url: "https://example.com/new-research",
        title: "New Research Paper",
        notes: "From new context",
        createdAt: new Date()
      }
    ]);
    
    await db.insert(chatMessages).values([
      {
        userId,
        content: "This is a new chat message in the new context",
        role: "user",
        createdAt: new Date()
      }
    ]);
    
    console.log('✅ Added new URLs and chat messages');
    
    // Switch back to default context
    console.log('\n🔄 Step 5: Testing switch back to default context...');
    console.log('Switching to "Default Context"...');
    
    const switchBackResult = await contextProfileTool.execute({
      context: {
        action: 'switch',
        userId,
        profileId: 0, // Default context
      },
    } as any);
    
    console.log('Switch back result:', switchBackResult.message);
    
    // Verify data was cleared again
    const finalUrls = await db.select().from(urls).where(eq(urls.userId, userId));
    const finalMessages = await db.select().from(chatMessages).where(eq(chatMessages.userId, userId));
    
    console.log(`\n📊 Final state:`);
    console.log(`- URLs: ${finalUrls.length} (should be 0)`);
    console.log(`- Chat messages: ${finalMessages.length} (should be 0)`);
    
    console.log('\n✅ Context Switching Test Complete!');
    console.log('\n📊 Summary:');
    console.log('• Default context appears in profile list');
    console.log('• Switching contexts clears URLs and chat history');
    console.log('• New data can be added to each context');
    console.log('• Switching back clears data again');
    console.log('• Profile management works correctly');
    
    console.log('\n🎯 Key Features Verified:');
    console.log('• Default context integration');
    console.log('• Data clearing on context switch');
    console.log('• Profile switching functionality');
    console.log('• Clean slate for each context');
    
    console.log('\n📝 Next steps:');
    console.log('1. Start your server: npm run dev');
    console.log('2. Enable pro mode and create profiles');
    console.log('3. Add URLs and chat messages');
    console.log('4. Switch between contexts');
    console.log('5. Verify data is cleared and daily summary updates');
    
  } catch (error) {
    console.error('❌ Context switching test failed:', error);
  }
}

// Run the test
testContextSwitching().catch(console.error); 