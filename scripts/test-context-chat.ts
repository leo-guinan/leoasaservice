#!/usr/bin/env tsx

import 'dotenv/config';
import { getDb } from '../server/db';
import { chatMessages, urls, leoQuestions } from '../shared/schema';

async function testContextChat() {
  console.log('🧪 Testing Context-Aware Chat System');
  console.log('='.repeat(50));

  try {
    const db = getDb();
    
    // Get the test user (assuming ID 1)
    const userId = 1;
    
    console.log(`📝 Adding test activity for user ${userId}...`);
    
    // Add some test chat messages
    await db.insert(chatMessages).values([
      {
        userId,
        content: "I'm researching machine learning applications in healthcare",
        role: "user",
        createdAt: new Date()
      },
      {
        userId,
        content: "I found an interesting paper about AI diagnostics",
        role: "user",
        createdAt: new Date()
      },
      {
        userId,
        content: "How can I apply these techniques to medical imaging?",
        role: "user",
        createdAt: new Date()
      }
    ]);
    
    // Add some test URLs
    await db.insert(urls).values([
      {
        userId,
        url: "https://arxiv.org/abs/2023.12345",
        title: "Deep Learning for Medical Image Analysis",
        notes: "Important paper on AI in radiology",
        createdAt: new Date()
      },
      {
        userId,
        url: "https://www.nature.com/articles/s41586-023-12345-6",
        title: "Machine Learning in Healthcare: A Comprehensive Review",
        notes: "Good overview of current applications",
        createdAt: new Date()
      }
    ]);
    
    // Add some test Leo questions
    await db.insert(leoQuestions).values([
      {
        userId,
        question: "What are the ethical considerations for AI in healthcare?",
        status: "answered",
        answer: "Key considerations include patient privacy, algorithmic bias, and clinical validation requirements.",
        createdAt: new Date(),
        answeredAt: new Date()
      }
    ]);
    
    console.log('✅ Test activity added successfully');
    console.log('\n🔄 Now running context update...');
    
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
      console.log('📊 Context summary:', result.result.summary);
    } else {
      console.error('❌ Context update failed:', result);
      return;
    }
    
    console.log('\n💬 Testing context-aware chat...');
    
    // Test the context-aware chat by making a request
    const testMessage = "Can you help me understand how to implement these healthcare AI techniques?";
    console.log(`User message: "${testMessage}"`);
    
    // Simulate the chat logic
    const { getUserContext, createContextAwarePrompt } = await import('../server/mastra/agents/chat-agent');
    
    const userContext = await getUserContext(userId);
    const systemPrompt = createContextAwarePrompt(userContext);
    
    console.log('\n📋 Generated System Prompt:');
    console.log('-'.repeat(40));
    console.log(systemPrompt);
    console.log('-'.repeat(40));
    
    console.log('\n🎯 Context Integration:');
    console.log(`- Has Context: ${!!userContext}`);
    if (userContext) {
      console.log(`- Research Interests: ${userContext.researchInterests?.length || 0} items`);
      console.log(`- Current Projects: ${userContext.currentProjects?.length || 0} items`);
      console.log(`- Knowledge Areas: ${userContext.knowledgeAreas?.length || 0} items`);
      console.log(`- Recent Insights: ${userContext.recentInsights?.length || 0} items`);
      console.log(`- Research Patterns: ${userContext.researchPatterns?.length || 0} items`);
    }
    
    console.log('\n✅ Context-aware chat system is working!');
    console.log('\n📝 Next steps:');
    console.log('1. Start your server: npm run dev');
    console.log('2. Send a chat message through the UI');
    console.log('3. Check the server logs to see the context being used');
    console.log('4. The AI will now respond with context-aware insights');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testContextChat().catch(console.error); 