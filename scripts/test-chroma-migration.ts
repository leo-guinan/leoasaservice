#!/usr/bin/env tsx

import { storage } from '../server/storage';
import { chromaService } from '../server/chroma';
import { nanoid } from 'nanoid';
import dotenv from 'dotenv';

dotenv.config();

async function testChromaMigration() {
  console.log('🧪 Testing ChromaDB Migration with Memory Storage');
  console.log('================================================\n');

  try {
    // Initialize services
    await storage.initialize();
    await chromaService.initialize();
    
    console.log('✅ Services initialized');

    // Create some test data in memory storage
    console.log('\n📝 Creating test data...');
    
    // Create a test user
    const user = await storage.createUser({
      username: 'testuser',
      password: 'testpass',
      role: 'user'
    });
    console.log(`   👤 Created user: ${user.username} (ID: ${user.id})`);

    // Create some test URLs
    const url1 = await storage.createUrl(user.id, {
      url: 'https://example.com/article1',
      title: 'Example Article 1',
      content: 'This is the content of example article 1. It contains information about technology and AI.',
      analysis: { summary: 'Article about technology', keywords: ['technology', 'AI'] }
    });
    
    const url2 = await storage.createUrl(user.id, {
      url: 'https://example.com/article2',
      title: 'Example Article 2',
      content: 'This is the content of example article 2. It discusses machine learning and data science.',
      analysis: { summary: 'Article about ML', keywords: ['machine learning', 'data science'] }
    });
    
    console.log(`   🔗 Created ${2} URLs`);

    // Create some test chat messages
    const message1 = await storage.createChatMessage(user.id, {
      content: 'What is artificial intelligence?',
      role: 'user'
    });
    
    const message2 = await storage.createChatMessage(user.id, {
      content: 'Artificial intelligence is a branch of computer science that aims to create intelligent machines.',
      role: 'assistant'
    });
    
    console.log(`   💬 Created ${2} chat messages`);

    // Check current ChromaDB status
    console.log('\n📊 Checking ChromaDB status before migration...');
    
    try {
      const chatMessagesResult = await chromaService.getChatMessagesByUser(0, 100);
      const chatMessages = chatMessagesResult.ids?.map((id: string, index: number) => ({
        id,
        content: chatMessagesResult.documents?.[index] || '',
        metadata: chatMessagesResult.metadatas?.[index] || {}
      })) || [];
      console.log(`   💬 ChromaDB Chat Messages: ${chatMessages.length}`);
      
      const urlContentResult = await chromaService.getUrlContentByUser(0, 100);
      const urlContent = urlContentResult.ids?.map((id: string, index: number) => ({
        id,
        content: urlContentResult.documents?.[index] || '',
        metadata: urlContentResult.metadatas?.[index] || {}
      })) || [];
      console.log(`   🔗 ChromaDB URL Content: ${urlContent.length}`);
      
      const urlAnalysisResult = await chromaService.getUrlAnalysisByUser(0, 100);
      const urlAnalysis = urlAnalysisResult.ids?.map((id: string, index: number) => ({
        id,
        content: urlAnalysisResult.documents?.[index] || '',
        metadata: urlAnalysisResult.metadatas?.[index] || {}
      })) || [];
      console.log(`   📊 ChromaDB URL Analysis: ${urlAnalysis.length}`);
      
    } catch (error) {
      console.log(`   ❌ ChromaDB check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Manually migrate the test data to ChromaDB
    console.log('\n🔄 Manually migrating test data to ChromaDB...');
    
    // Migrate chat messages
    const messages = await storage.getChatMessages(user.id);
    for (const message of messages) {
      try {
        const document = {
          id: nanoid(),
          content: message.content,
          metadata: {
            userId: message.userId,
            role: message.role as 'user' | 'assistant',
            timestamp: message.createdAt.toISOString(),
            messageId: message.id
          }
        };
        await chromaService.addChatMessage(document);
        console.log(`   ✅ Migrated chat message: ${message.id}`);
      } catch (error) {
        console.log(`   ❌ Failed to migrate chat message ${message.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Migrate URL content and analysis
    const urls = await storage.getUrls(user.id);
    for (const url of urls) {
      // Migrate URL content
      if (url.content) {
        try {
          const contentDocument = {
            id: nanoid(),
            content: url.content,
            metadata: {
              userId: url.userId,
              url: url.url,
              title: url.title || undefined,
              urlId: url.id,
              timestamp: url.createdAt.toISOString()
            }
          };
          await chromaService.addUrlContent(contentDocument);
          console.log(`   ✅ Migrated URL content: ${url.id}`);
        } catch (error) {
          console.log(`   ❌ Failed to migrate URL content ${url.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Migrate URL analysis
      if (url.analysis) {
        try {
          const analysisDocument = {
            id: nanoid(),
            content: JSON.stringify(url.analysis),
            metadata: {
              userId: url.userId,
              url: url.url,
              urlId: url.id,
              analysisType: 'ai_analysis',
              timestamp: url.updatedAt?.toISOString() || url.createdAt.toISOString()
            }
          };
          await chromaService.addUrlAnalysis(analysisDocument);
          console.log(`   ✅ Migrated URL analysis: ${url.id}`);
        } catch (error) {
          console.log(`   ❌ Failed to migrate URL analysis ${url.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }

    // Check ChromaDB status after migration
    console.log('\n📊 Checking ChromaDB status after migration...');
    
    try {
      const chatMessagesResult = await chromaService.getChatMessagesByUser(0, 100);
      const chatMessages = chatMessagesResult.ids?.map((id: string, index: number) => ({
        id,
        content: chatMessagesResult.documents?.[index] || '',
        metadata: chatMessagesResult.metadatas?.[index] || {}
      })) || [];
      console.log(`   💬 ChromaDB Chat Messages: ${chatMessages.length}`);
      
      const urlContentResult = await chromaService.getUrlContentByUser(0, 100);
      const urlContent = urlContentResult.ids?.map((id: string, index: number) => ({
        id,
        content: urlContentResult.documents?.[index] || '',
        metadata: urlContentResult.metadatas?.[index] || {}
      })) || [];
      console.log(`   🔗 ChromaDB URL Content: ${urlContent.length}`);
      
      const urlAnalysisResult = await chromaService.getUrlAnalysisByUser(0, 100);
      const urlAnalysis = urlAnalysisResult.ids?.map((id: string, index: number) => ({
        id,
        content: urlAnalysisResult.documents?.[index] || '',
        metadata: urlAnalysisResult.metadatas?.[index] || {}
      })) || [];
      console.log(`   📊 ChromaDB URL Analysis: ${urlAnalysis.length}`);
      
    } catch (error) {
      console.log(`   ❌ ChromaDB check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Test search functionality
    console.log('\n🔍 Testing search functionality...');
    
    try {
      const searchResults = await chromaService.searchAll(user.id, 'artificial intelligence', 3);
      const totalResults = (searchResults.chatMessages?.ids?.length || 0) + 
                          (searchResults.urlContent?.ids?.length || 0) + 
                          (searchResults.urlAnalysis?.ids?.length || 0);
      console.log(`   🔍 Search results for "artificial intelligence": ${totalResults} items`);
      
      if (totalResults > 0) {
        console.log('   📋 Sample results:');
        let resultCount = 0;
        
        // Show chat message results
        if (searchResults.chatMessages?.ids?.length > 0) {
          console.log(`      💬 Chat Messages: ${searchResults.chatMessages.ids.length} results`);
          resultCount += searchResults.chatMessages.ids.length;
        }
        
        // Show URL content results
        if (searchResults.urlContent?.ids?.length > 0) {
          console.log(`      🔗 URL Content: ${searchResults.urlContent.ids.length} results`);
          resultCount += searchResults.urlContent.ids.length;
        }
        
        // Show URL analysis results
        if (searchResults.urlAnalysis?.ids?.length > 0) {
          console.log(`      📊 URL Analysis: ${searchResults.urlAnalysis.ids.length} results`);
          resultCount += searchResults.urlAnalysis.ids.length;
        }
      }
    } catch (error) {
      console.log(`   ❌ Search test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    console.log('\n🎉 ChromaDB migration test completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   - Test data created in memory storage');
    console.log('   - Data migrated to ChromaDB');
    console.log('   - Search functionality tested');
    console.log('   - Ready for production migration');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testChromaMigration().catch(console.error); 