#!/usr/bin/env tsx

import 'dotenv/config';
import { getDb } from '../server/db';
import { chatMessages, urls, leoQuestions } from '../shared/schema';

async function demoImprovedSummary() {
  console.log('🎯 Demo: Improved Daily Context Summary');
  console.log('='.repeat(50));

  try {
    const db = getDb();
    const userId = 1;
    
    console.log('📝 Adding diverse test activity...');
    
    // Add some varied activity to create meaningful changes
    await db.insert(chatMessages).values([
      {
        userId,
        content: "I'm now focusing on quantum computing applications in cryptography",
        role: "user",
        createdAt: new Date()
      },
      {
        userId,
        content: "Completed my research on blockchain privacy - moving to quantum-resistant algorithms",
        role: "user",
        createdAt: new Date()
      },
      {
        userId,
        content: "Found that post-quantum cryptography is essential for future healthcare data security",
        role: "user",
        createdAt: new Date()
      }
    ]);
    
    await db.insert(urls).values([
      {
        userId,
        url: "https://arxiv.org/abs/2023.12348",
        title: "Post-Quantum Cryptography for Healthcare",
        notes: "Essential reading for future-proof security",
        createdAt: new Date()
      },
      {
        userId,
        url: "https://www.nature.com/articles/s41586-023-12349-8",
        title: "Quantum Computing Impact on Medical Data Privacy",
        notes: "Game-changing research on quantum threats",
        createdAt: new Date()
      }
    ]);
    
    await db.insert(leoQuestions).values([
      {
        userId,
        question: "How will quantum computing affect current healthcare encryption standards?",
        status: "answered",
        answer: "Quantum computers will break current RSA and ECC encryption, requiring post-quantum cryptographic algorithms for healthcare data protection.",
        createdAt: new Date(),
        answeredAt: new Date()
      }
    ]);
    
    console.log('✅ Test activity added successfully');
    console.log('\n🔄 Running context update...');
    
    // Run the context update workflow
    const { mastra } = await import('../server/mastra/index.js');
    const workflow = mastra.getWorkflow('userContextWorkflow');
    const run = await workflow.createRunAsync();
    const result = await run.start({
      inputData: {
        date: new Date().toISOString().split('T')[0],
      },
    });
    
    if (result.status === 'success') {
      console.log('✅ Context updated successfully');
    } else {
      console.error('❌ Context update failed:', result);
      return;
    }
    
    console.log('\n📊 Testing improved context summary...');
    
    // Test the context summary tool
    const { contextSummaryTool } = await import('../server/mastra/tools/context-summary-tool.js');
    
    const summary = await contextSummaryTool.execute({
      context: { userId, date: new Date().toISOString().split('T')[0] },
    } as any);
    
    console.log('\n🎯 IMPROVED DAILY CONTEXT SUMMARY:');
    console.log('─'.repeat(50));
    console.log(summary.summary);
    console.log('');
    
    if (summary.changes.length > 0) {
      console.log('📈 Specific Changes:');
      summary.changes.forEach((change, index) => {
        console.log(`  ${index + 1}. ${change}`);
      });
    }
    
    console.log('\n✨ Key Improvements:');
    console.log('• Shows specific additions/removals instead of just counts');
    console.log('• Uses clear, actionable language');
    console.log('• Focuses on meaningful changes only');
    console.log('• No redundant comparison tables');
    console.log('• No unnecessary feedback buttons');
    console.log('• User feedback comes through natural chat');
    
    console.log('\n✅ Improved summary is much more useful and concise!');
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

// Run the demo
demoImprovedSummary().catch(console.error); 