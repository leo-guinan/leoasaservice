#!/usr/bin/env tsx

import 'dotenv/config';
import { getDb } from '../server/db';

async function setupContextTables() {
  console.log('🔧 Setting up Context-Specific Tables');
  console.log('='.repeat(50));

  try {
    const db = getDb();
    
    // Check if tables exist by trying to query them
    console.log('📊 Checking existing tables...');
    
    try {
      await db.execute(`
        SELECT COUNT(*) FROM context_urls LIMIT 1
      `);
      console.log('✅ context_urls table exists');
    } catch (error) {
      console.log('❌ context_urls table does not exist, creating...');
      await db.execute(`
        CREATE TABLE "context_urls" (
          "id" serial PRIMARY KEY NOT NULL,
          "profile_id" integer NOT NULL,
          "user_id" integer NOT NULL,
          "url" text NOT NULL,
          "title" text,
          "notes" text,
          "content" text,
          "analysis" jsonb,
          "created_at" timestamp DEFAULT now() NOT NULL
        )
      `);
      console.log('✅ context_urls table created');
    }
    
    try {
      await db.execute(`
        SELECT COUNT(*) FROM context_chat_messages LIMIT 1
      `);
      console.log('✅ context_chat_messages table exists');
    } catch (error) {
      console.log('❌ context_chat_messages table does not exist, creating...');
      await db.execute(`
        CREATE TABLE "context_chat_messages" (
          "id" serial PRIMARY KEY NOT NULL,
          "profile_id" integer NOT NULL,
          "user_id" integer NOT NULL,
          "content" text NOT NULL,
          "role" text NOT NULL,
          "created_at" timestamp DEFAULT now() NOT NULL
        )
      `);
      console.log('✅ context_chat_messages table created');
    }
    
    console.log('\n✅ Context tables setup complete!');
    console.log('\n📝 Next steps:');
    console.log('1. Update context switching logic to use context-specific tables');
    console.log('2. Migrate existing data to context-specific tables');
    console.log('3. Update API endpoints to handle context-specific data');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

// Run the setup
setupContextTables().catch(console.error); 