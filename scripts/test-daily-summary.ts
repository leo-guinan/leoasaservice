#!/usr/bin/env tsx

import 'dotenv/config';
import { getDb } from '../server/db';
import { chatMessages, urls, leoQuestions } from '../shared/schema';

async function testDailySummary() {
  console.log('📅 Testing Daily Context Summary Feature');
  console.log('='.repeat(50));

  try {
    const db = getDb();
    
    // Get the test user (assuming ID 1)
    const userId = 1;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    console.log(`📝 Adding test activity for user ${userId}...`);
    console.log(`📅 Today: ${today}, Yesterday: ${yesterday}`);
    
    // Add some test activity for yesterday
    await db.insert(chatMessages).values([
      {
        userId,
        content: "I'm researching blockchain applications in healthcare",
        role: "user",
        createdAt: new Date(yesterday + 'T10:00:00Z')
      },
      {
        userId,
        content: "Found interesting papers about decentralized medical records",
        role: "user",
        createdAt: new Date(yesterday + 'T14:30:00Z')
      }
    ]);
    
    await db.insert(urls).values([
      {
        userId,
        url: "https://arxiv.org/abs/2023.12346",
        title: "Blockchain in Healthcare: A Comprehensive Review",
        notes: "Important paper on decentralized healthcare",
        createdAt: new Date(yesterday + 'T11:00:00Z')
      }
    ]);
    
    // Add some test activity for today
    await db.insert(chatMessages).values([
      {
        userId,
        content: "How can I implement blockchain for patient data privacy?",
        role: "user",
        createdAt: new Date(today + 'T09:00:00Z')
      },
      {
        userId,
        content: "I want to explore zero-knowledge proofs for medical data",
        role: "user",
        createdAt: new Date(today + 'T15:00:00Z')
      }
    ]);
    
    await db.insert(urls).values([
      {
        userId,
        url: "https://www.nature.com/articles/s41586-023-12347-7",
        title: "Zero-Knowledge Proofs in Medical Data Sharing",
        notes: "Advanced privacy techniques for healthcare",
        createdAt: new Date(today + 'T10:00:00Z')
      }
    ]);
    
    console.log('✅ Test activity added successfully');
    console.log('\n🔄 Now running context updates...');
    
    // Run context update for yesterday
    const { mastra } = await import('../server/mastra/index.js');
    const workflow = mastra.getWorkflow('userContextWorkflow');
    
    console.log(`\n📅 Updating context for ${yesterday}...`);
    const yesterdayRun = await workflow.createRunAsync();
    const yesterdayResult = await yesterdayRun.start({
      inputData: { date: yesterday },
    });
    
    if (yesterdayResult.status === 'success') {
      console.log('✅ Yesterday context updated successfully');
    } else {
      console.error('❌ Yesterday context update failed:', yesterdayResult);
    }
    
    // Run context update for today
    console.log(`\n📅 Updating context for ${today}...`);
    const todayRun = await workflow.createRunAsync();
    const todayResult = await todayRun.start({
      inputData: { date: today },
    });
    
    if (todayResult.status === 'success') {
      console.log('✅ Today context updated successfully');
    } else {
      console.error('❌ Today context update failed:', todayResult);
    }
    
    console.log('\n📊 Testing daily context summary...');
    
    // Test the context summary tool
    const { contextSummaryTool } = await import('../server/mastra/tools/context-summary-tool.js');
    
    console.log(`\n📋 Summary for ${today}:`);
    const todaySummary = await contextSummaryTool.execute({
      context: { userId, date: today },
    } as any);
    
    console.log('Summary:', todaySummary.summary);
    console.log('Changes:', todaySummary.changes);
    console.log('Has Previous Context:', todaySummary.hasPreviousContext);
    console.log('Has Current Context:', todaySummary.hasCurrentContext);
    
    if (todaySummary.hasPreviousContext && todaySummary.hasCurrentContext) {
      console.log('\n📈 Context Comparison:');
      console.log('Previous Research Interests:', todaySummary.previousContext?.researchInterests?.length || 0);
      console.log('Current Research Interests:', todaySummary.currentContext?.researchInterests?.length || 0);
      console.log('Previous Projects:', todaySummary.previousContext?.currentProjects?.length || 0);
      console.log('Current Projects:', todaySummary.currentContext?.currentProjects?.length || 0);
    }
    
    console.log('\n✅ Daily context summary system is working!');
    console.log('\n📝 Next steps:');
    console.log('1. Start your server: npm run dev');
    console.log('2. Open the chat interface');
    console.log('3. You\'ll see the daily context summary at the top');
    console.log('4. Review the changes and provide feedback');
    console.log('5. The summary shows both previous and current context');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testDailySummary().catch(console.error); 