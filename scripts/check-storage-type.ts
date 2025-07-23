#!/usr/bin/env tsx

import { storage } from '../server/storage';
import dotenv from 'dotenv';

dotenv.config();

async function checkStorageType() {
  console.log('🔍 Storage Type Check');
  console.log('====================\n');

  try {
    await storage.initialize();
    
    console.log('📊 Environment Variables:');
    console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? 'Set' : 'Not set'}`);
    console.log(`   CHROMA_API_KEY: ${process.env.CHROMA_API_KEY ? 'Set' : 'Not set'}`);
    
    console.log('\n🏗️ Storage Implementation:');
    console.log(`   Type: ${storage.constructor.name}`);
    
    // Test if it's PostgreSQL storage
    if (typeof storage.getUserContextProfiles === 'function') {
      console.log('   ✅ getUserContextProfiles method available');
      
      try {
        const testProfiles = await storage.getUserContextProfiles(1);
        console.log(`   ✅ Context profiles test: ${testProfiles.length} profiles found`);
      } catch (error) {
        console.log(`   ❌ Context profiles test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      console.log('   ❌ getUserContextProfiles method NOT available');
    }
    
    // Test if it's ChromaDB enhanced
    if (typeof storage.searchChatMessages === 'function') {
      console.log('   ✅ ChromaDB search methods available');
    } else {
      console.log('   ❌ ChromaDB search methods NOT available');
    }
    
    console.log('\n📋 Summary:');
    if (process.env.DATABASE_URL) {
      console.log('   - Using PostgreSQL storage');
    } else {
      console.log('   - Using Memory storage');
    }
    
    if (process.env.CHROMA_API_KEY) {
      console.log('   - ChromaDB integration enabled');
    } else {
      console.log('   - ChromaDB integration disabled');
    }

  } catch (error) {
    console.error('❌ Storage check failed:', error);
    process.exit(1);
  }
}

// Run the check
checkStorageType().catch(console.error); 