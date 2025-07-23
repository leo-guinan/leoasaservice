#!/usr/bin/env tsx

import { storage } from '../server/storage';
import { chromaService } from '../server/chroma';
import { nanoid } from 'nanoid';
import dotenv from 'dotenv';

dotenv.config();

async function testSplitMigration() {
  console.log('🧪 Testing Split Migration Functionality');
  console.log('=======================================\n');

  try {
    await storage.initialize();
    await chromaService.initialize();
    
    console.log('✅ Storage and ChromaDB initialized');

    // Create a test user
    const testUser = await storage.createUser({
      username: 'test-split-user',
      email: 'test-split@example.com',
      password: 'test123'
    });

    console.log(`👤 Created test user: ${testUser.username} (ID: ${testUser.id})`);

    // Create a test URL with large content
    const largeContent = 'This is a very large content that will be split into multiple parts. '.repeat(1000);
    console.log(`📄 Large content size: ${Buffer.byteLength(largeContent, 'utf8')} bytes`);

    const testUrl = await storage.createUrl(testUser.id, {
      url: 'https://example.com/large-content',
      title: 'Large Content Test',
      content: largeContent
    });

    console.log(`🔗 Created test URL: ${testUrl.url} (ID: ${testUrl.id})`);

    // Create a test chat message with large content
    const largeMessage = 'This is a very large chat message that will be split into multiple parts. '.repeat(800);
    console.log(`💬 Large message size: ${Buffer.byteLength(largeMessage, 'utf8')} bytes`);

    const testMessage = await storage.createChatMessage(testUser.id, {
      content: largeMessage,
      role: 'user'
    });

    console.log(`💬 Created test message (ID: ${testMessage.id})`);

    // Now run the split migration
    console.log('\n🔄 Running split migration...');
    
    const { SplitChromaMigrationService } = await import('./migrate-to-chroma-split');
    const migrationService = new SplitChromaMigrationService();
    
    await migrationService.initialize();
    await migrationService.loadExistingChromaData();
    
    // Migrate just this user's data
    await migrationService['migrateUserData'](testUser.id);

    console.log('\n✅ Split migration test completed!');

    // Test reconstruction
    console.log('\n🔍 Testing document reconstruction...');
    
    try {
      const reconstructedMessage = await chromaService.reconstructSplitDocuments(
        'chat_messages', 
        testMessage.id.toString(), 
        testUser.id
      );
      
      console.log(`📄 Reconstructed message length: ${reconstructedMessage.length} characters`);
      console.log(`📄 Original message length: ${largeMessage.length} characters`);
      console.log(`📄 Reconstruction successful: ${reconstructedMessage.length > 0 ? 'Yes' : 'No'}`);
      
      if (reconstructedMessage.length > 0) {
        console.log(`📄 First 100 chars: ${reconstructedMessage.substring(0, 100)}...`);
      }
    } catch (error) {
      console.error('❌ Failed to reconstruct message:', error);
    }

    // Clean up
    console.log('\n🧹 Cleaning up test data...');
    await storage.deleteUrl(testUrl.id, testUser.id);
    await storage.clearChatHistory(testUser.id);
    
    console.log('✅ Test cleanup completed');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testSplitMigration().catch(console.error); 