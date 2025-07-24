#!/usr/bin/env tsx

import { storage } from '../server/storage';
import { chromaService } from '../server/chroma';
import dotenv from 'dotenv';

dotenv.config();

async function testProductionMigration() {
  console.log('🧪 Testing Production Migration Script');
  console.log('=====================================\n');

  try {
    await storage.initialize();
    await chromaService.initialize();
    
    console.log('✅ Storage and ChromaDB initialized');

    // Test the split logic directly
    const largeContent = 'This is a very large content that will be split into multiple parts. '.repeat(1000);
    console.log(`📄 Large content size: ${Buffer.byteLength(largeContent, 'utf8')} bytes`);

    // Test the split function
    const { ProductionSplitChromaMigrationService } = await import('./run-split-migration-production');
    const migrationService = new ProductionSplitChromaMigrationService();
    
    // Test the private method by accessing it directly
    const chunks = (migrationService as any).splitContentIntoChunks(largeContent);
    console.log(`📄 Content split into ${chunks.length} chunks`);
    
    for (let i = 0; i < chunks.length; i++) {
      const chunkSize = Buffer.byteLength(chunks[i], 'utf8');
      console.log(`   Chunk ${i + 1}: ${chunkSize} bytes`);
    }

    console.log('\n✅ Production migration script test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testProductionMigration().catch(console.error); 