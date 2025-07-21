#!/usr/bin/env tsx

import 'dotenv/config';
import { getDb } from '../server/db';
import { urls } from '../shared/schema';
import { inArray } from 'drizzle-orm';

async function testUrlProcessing() {
  console.log('🎯 Testing URL Processing Agent and Tools');
  console.log('='.repeat(50));

  try {
    const db = getDb();
    const userId = 1;
    
    console.log('📝 Step 1: Adding test URLs...');
    
    // Add test URLs
    const testUrls = [
      {
        url: 'https://example.com/article/2024/01/15/sample-article',
        title: 'Sample Article',
        notes: 'Test leaf URL',
        userId
      },
      {
        url: 'https://blog.example.com',
        title: 'Example Blog',
        notes: 'Test root URL',
        userId
      }
    ];
    
    const insertedUrls = await db.insert(urls).values(testUrls).returning();
    console.log(`✅ Added ${insertedUrls.length} test URLs`);
    
    console.log('\n🔄 Step 2: Testing URL processing workflow...');
    
    // Test the URL processing workflow
    const { mastra } = await import('../server/mastra/index.js');
    const workflow = mastra.getWorkflow('urlProcessingWorkflow');
    
    for (const urlRecord of insertedUrls) {
      console.log(`\n📋 Processing URL: ${urlRecord.url}`);
      
      const run = await workflow.createRunAsync();
      const result = await run.start({
        inputData: {
          urlId: urlRecord.id,
          userId: urlRecord.userId,
          url: urlRecord.url,
          urlType: 'auto' // Let it auto-determine
        },
      });
      
      if (result.status === 'success') {
        console.log('✅ URL processed successfully');
        console.log(`   Type: ${result.result.urlType}`);
        console.log(`   Content Length: ${result.result.contentLength}`);
        console.log(`   Success: ${result.result.success}`);
        console.log(`   Message: ${result.result.message}`);
        
        if (result.result.rssFeeds && result.result.rssFeeds.length > 0) {
          console.log(`   RSS Feeds: ${result.result.rssFeeds.length} discovered`);
        }
        
        if (result.result.discoveredPages && result.result.discoveredPages.length > 0) {
          console.log(`   Discovered Pages: ${result.result.discoveredPages.length}`);
        }
      } else if (result.status === 'failed') {
        console.error('❌ URL processing failed:', result.error?.message);
      } else {
        console.error('❌ URL processing suspended or in unexpected state:', result.status);
      }
    }
    
    console.log('\n🧹 Step 3: Cleaning up test data...');
    
    // Clean up test URLs
    await db.delete(urls).where(inArray(urls.id, insertedUrls.map(u => u.id)));
    console.log('✅ Test data cleaned up');
    
    console.log('\n🎉 URL processing test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testUrlProcessing(); 