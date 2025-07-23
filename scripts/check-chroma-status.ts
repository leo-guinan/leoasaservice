#!/usr/bin/env tsx

import { chromaService } from '../server/chroma';
import { storage } from '../server/storage';
import dotenv from 'dotenv';

dotenv.config();

interface ChromaStatus {
  collections: {
    chatMessages: { count: number; users: Set<number> };
    urlContent: { count: number; users: Set<number> };
    urlAnalysis: { count: number; users: Set<number> };
  };
  database: {
    users: number;
    chatMessages: number;
    urls: number;
    contextUrls: number;
    contextChatMessages: number;
  };
}

async function checkChromaStatus() {
  console.log('🔍 ChromaDB Status Check');
  console.log('========================\n');

  try {
    // Initialize services
    await storage.initialize();
    await chromaService.initialize();

    const status: ChromaStatus = {
      collections: {
        chatMessages: { count: 0, users: new Set() },
        urlContent: { count: 0, users: new Set() },
        urlAnalysis: { count: 0, users: new Set() }
      },
      database: {
        users: 0,
        chatMessages: 0,
        urls: 0,
        contextUrls: 0,
        contextChatMessages: 0
      }
    };

    // Check ChromaDB collections
    console.log('📊 Checking ChromaDB Collections...');
    
    try {
      const chatMessagesResult = await chromaService.getChatMessagesByUser(0, 100);
      const chatMessages = chatMessagesResult.ids?.map((id: string, index: number) => ({
        id,
        content: chatMessagesResult.documents?.[index] || '',
        metadata: chatMessagesResult.metadatas?.[index] || {}
      })) || [];
      status.collections.chatMessages.count = chatMessages.length;
      chatMessages.forEach(msg => {
        if (msg.metadata?.userId) {
          status.collections.chatMessages.users.add(msg.metadata.userId);
        }
      });
      console.log(`   💬 Chat Messages: ${chatMessages.length} documents from ${status.collections.chatMessages.users.size} users (limited to 100 due to quota)`);
    } catch (error) {
      console.log(`   💬 Chat Messages: Error - ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    try {
      const urlContentResult = await chromaService.getUrlContentByUser(0, 100);
      const urlContent = urlContentResult.ids?.map((id: string, index: number) => ({
        id,
        content: urlContentResult.documents?.[index] || '',
        metadata: urlContentResult.metadatas?.[index] || {}
      })) || [];
      status.collections.urlContent.count = urlContent.length;
      urlContent.forEach(url => {
        if (url.metadata?.userId) {
          status.collections.urlContent.users.add(url.metadata.userId);
        }
      });
      console.log(`   🔗 URL Content: ${urlContent.length} documents from ${status.collections.urlContent.users.size} users (limited to 100 due to quota)`);
    } catch (error) {
      console.log(`   🔗 URL Content: Error - ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    try {
      const urlAnalysisResult = await chromaService.getUrlAnalysisByUser(0, 100);
      const urlAnalysis = urlAnalysisResult.ids?.map((id: string, index: number) => ({
        id,
        content: urlAnalysisResult.documents?.[index] || '',
        metadata: urlAnalysisResult.metadatas?.[index] || {}
      })) || [];
      status.collections.urlAnalysis.count = urlAnalysis.length;
      urlAnalysis.forEach(analysis => {
        if (analysis.metadata?.userId) {
          status.collections.urlAnalysis.users.add(analysis.metadata.userId);
        }
      });
      console.log(`   📊 URL Analysis: ${urlAnalysis.length} documents from ${status.collections.urlAnalysis.users.size} users (limited to 100 due to quota)`);
    } catch (error) {
      console.log(`   📊 URL Analysis: Error - ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Check database data
    console.log('\n🗄️ Checking Database Data...');
    
    try {
      const usersWithStats = await storage.getAllUsersWithStats();
      status.database.users = usersWithStats.length;
      
      let totalChatMessages = 0;
      let totalUrls = 0;
      let totalContextUrls = 0;
      let totalContextChatMessages = 0;

      for (const { user } of usersWithStats) {
        // Count main data
        const chatMessages = await storage.getChatMessages(user.id);
        const urls = await storage.getUrls(user.id);
        totalChatMessages += chatMessages.length;
        totalUrls += urls.length;

        // Count context data
        const profiles = await storage.getUserContextProfiles(user.id);
        for (const profile of profiles) {
          const contextUrls = await storage.getContextUrls(user.id, profile.id);
          const contextMessages = await storage.getContextChatMessages(user.id, profile.id);
          totalContextUrls += contextUrls.length;
          totalContextChatMessages += contextMessages.length;
        }
      }

      status.database.chatMessages = totalChatMessages;
      status.database.urls = totalUrls;
      status.database.contextUrls = totalContextUrls;
      status.database.contextChatMessages = totalContextChatMessages;

      console.log(`   👥 Users: ${status.database.users}`);
      console.log(`   💬 Chat Messages: ${status.database.chatMessages}`);
      console.log(`   🔗 URLs: ${status.database.urls}`);
      console.log(`   📁 Context URLs: ${status.database.contextUrls}`);
      console.log(`   💬 Context Chat Messages: ${status.database.contextChatMessages}`);

    } catch (error) {
      console.log(`   ❌ Database check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Calculate migration needs
    console.log('\n📈 Migration Analysis:');
    console.log('=====================');
    
    const chatMessagesToMigrate = status.database.chatMessages - status.collections.chatMessages.count;
    const urlContentToMigrate = status.database.urls - status.collections.urlContent.count;
    const urlAnalysisToMigrate = status.database.urls - status.collections.urlAnalysis.count; // Assuming all URLs have analysis
    const contextUrlsToMigrate = status.database.contextUrls - 0; // Context URLs are stored in URL content collection
    const contextMessagesToMigrate = status.database.contextChatMessages - 0; // Context messages are stored in chat messages collection

    console.log(`💬 Chat Messages to migrate: ${Math.max(0, chatMessagesToMigrate)}`);
    console.log(`🔗 URL Content to migrate: ${Math.max(0, urlContentToMigrate)}`);
    console.log(`📊 URL Analysis to migrate: ${Math.max(0, urlAnalysisToMigrate)}`);
    console.log(`📁 Context URLs to migrate: ${contextUrlsToMigrate}`);
    console.log(`💬 Context Chat Messages to migrate: ${contextMessagesToMigrate}`);

    const totalToMigrate = Math.max(0, chatMessagesToMigrate) + 
                          Math.max(0, urlContentToMigrate) + 
                          Math.max(0, urlAnalysisToMigrate) + 
                          contextUrlsToMigrate + 
                          contextMessagesToMigrate;

    if (totalToMigrate > 0) {
      console.log(`\n🚀 Total items to migrate: ${totalToMigrate}`);
      console.log('💡 Run "npm run chroma:migrate" to migrate all data');
    } else {
      console.log('\n✅ All data appears to be migrated to ChromaDB!');
    }

    // Health check
    console.log('\n🏥 ChromaDB Health Check:');
    try {
      const health = await chromaService.healthCheck();
      console.log('   ✅ ChromaDB is healthy and accessible');
    } catch (error) {
      console.log(`   ❌ ChromaDB health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

  } catch (error) {
    console.error('❌ Status check failed:', error);
    process.exit(1);
  }
}

// Run the status check
checkChromaStatus().catch(console.error); 