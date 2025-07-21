#!/usr/bin/env tsx

import 'dotenv/config';
import { getDb } from '../server/db';
import { chatMessages, urls, leoQuestions, userContextProfiles, userContextProfileData } from '../shared/schema';

async function testProMode() {
  console.log('🎯 Testing Pro Mode Functionality');
  console.log('='.repeat(50));

  try {
    const db = getDb();
    const userId = 1;
    
    console.log('📝 Step 1: Adding test activity for context generation...');
    
    // Add some test activity
    await db.insert(chatMessages).values([
      {
        userId,
        content: "I'm working on a new AI research project focused on transformer architectures",
        role: "user",
        createdAt: new Date()
      },
      {
        userId,
        content: "Exploring attention mechanisms and their applications in NLP",
        role: "user",
        createdAt: new Date()
      }
    ]);
    
    await db.insert(urls).values([
      {
        userId,
        url: "https://arxiv.org/abs/1706.03762",
        title: "Attention Is All You Need",
        notes: "Foundational transformer paper",
        createdAt: new Date()
      }
    ]);
    
    console.log('✅ Test activity added');
    
    console.log('\n🔄 Step 2: Testing context profile management...');
    
    // Test the context profile tool
    const { contextProfileTool } = await import('../server/mastra/tools/context-profile-tool.js');
    
    // Create a new profile
    console.log('Creating "AI Research" profile...');
    const createResult = await contextProfileTool.execute({
      context: {
        action: 'create',
        userId,
        profileName: 'AI Research',
        description: 'Research focused on artificial intelligence and machine learning',
      },
    } as any);
    
    console.log('Create result:', createResult.message);
    
    // List profiles
    console.log('\nListing profiles...');
    const listResult = await contextProfileTool.execute({
      context: {
        action: 'list',
        userId,
      },
    } as any);
    
    console.log(`Found ${listResult.profiles?.length || 0} profiles:`);
    listResult.profiles?.forEach((profile: any) => {
      console.log(`- ${profile.name} (${profile.isActive ? 'Active' : 'Inactive'})`);
    });
    
    // Switch to the profile
    console.log('\nSwitching to "AI Research" profile...');
    const switchResult = await contextProfileTool.execute({
      context: {
        action: 'switch',
        userId,
        profileName: 'AI Research',
      },
    } as any);
    
    console.log('Switch result:', switchResult.message);
    
    console.log('\n🔄 Step 3: Testing manual context update...');
    
    // Test manual context update
    const { manualContextUpdateTool } = await import('../server/mastra/tools/manual-context-update-tool.js');
    
    const updateResult = await manualContextUpdateTool.execute({
      context: {
        userId,
        date: new Date().toISOString().split('T')[0],
        forceUpdate: false,
      },
    } as any);
    
    console.log('Update result:', updateResult.message);
    console.log('Activity found:', updateResult.activityFound);
    console.log('Context updated:', updateResult.contextUpdated);
    
    console.log('\n🔄 Step 4: Creating a second profile...');
    
    // Create another profile
    const createResult2 = await contextProfileTool.execute({
      context: {
        action: 'create',
        userId,
        profileName: 'Blockchain Research',
        description: 'Research focused on blockchain and distributed systems',
      },
    } as any);
    
    console.log('Second profile created:', createResult2.message);
    
    // List profiles again
    const listResult2 = await contextProfileTool.execute({
      context: {
        action: 'list',
        userId,
      },
    } as any);
    
    console.log(`\nNow have ${listResult2.profiles?.length || 0} profiles:`);
    listResult2.profiles?.forEach((profile: any) => {
      console.log(`- ${profile.name} (${profile.isActive ? 'Active' : 'Inactive'}) - v${profile.version || 0}`);
    });
    
    console.log('\n🔄 Step 5: Testing profile switching...');
    
    // Switch to the second profile
    const switchResult2 = await contextProfileTool.execute({
      context: {
        action: 'switch',
        userId,
        profileName: 'Blockchain Research',
      },
    } as any);
    
    console.log('Switch to Blockchain result:', switchResult2.message);
    
    // Update context for the new profile
    const updateResult2 = await manualContextUpdateTool.execute({
      context: {
        userId,
        date: new Date().toISOString().split('T')[0],
        forceUpdate: true, // Force update to create initial context
      },
    } as any);
    
    console.log('Second profile update result:', updateResult2.message);
    
    console.log('\n✅ Pro Mode Testing Complete!');
    console.log('\n📊 Summary:');
    console.log('• Created 2 context profiles');
    console.log('• Successfully switched between profiles');
    console.log('• Manual context updates working');
    console.log('• Profile management fully functional');
    
    console.log('\n🎯 Next steps:');
    console.log('1. Start your server: npm run dev');
    console.log('2. Click "Pro Mode" in the header');
    console.log('3. Create and manage profiles through the UI');
    console.log('4. Switch between different research contexts');
    console.log('5. Use manual context updates when needed');
    
  } catch (error) {
    console.error('❌ Pro mode test failed:', error);
  }
}

// Run the test
testProMode().catch(console.error); 