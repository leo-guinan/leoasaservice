#!/usr/bin/env tsx

import 'dotenv/config';
import { storage } from '../server/storage';

async function testRssFeedSave() {
  console.log('🧪 Testing RSS Feed Save Functionality');
  console.log('=====================================\n');

  try {
    await storage.initialize();
    console.log('✅ Storage initialized');

    // Test user ID (you can change this to test with a different user)
    const testUserId = 2;

    // Get existing RSS feeds
    console.log(`📊 Getting existing RSS feeds for user ${testUserId}...`);
    const existingFeeds = await storage.getRssFeeds(testUserId);
    console.log(`   Found ${existingFeeds.length} existing RSS feeds`);

    if (existingFeeds.length > 0) {
      console.log('   Existing feeds:');
      existingFeeds.forEach(feed => {
        console.log(`     - ${feed.title || 'Untitled'} (${feed.feedUrl})`);
      });
    }

    // Test creating a new RSS feed
    console.log('\n📝 Testing RSS feed creation...');
    const testFeed = {
      feedUrl: 'https://engineeringgenerosity.substack.com/feed',
      title: 'Test RSS Feed',
      description: 'Test RSS feed for verification',
      profileId: 0,
      fetchInterval: 1440,
      maxItemsPerFetch: 20
    };

    const createdFeed = await storage.createRssFeed(testUserId, testFeed);
    console.log(`✅ Created RSS feed: ${createdFeed.title} (ID: ${createdFeed.id})`);

    // Verify the feed was saved
    console.log('\n🔍 Verifying feed was saved...');
    const updatedFeeds = await storage.getRssFeeds(testUserId);
    console.log(`   Now have ${updatedFeeds.length} RSS feeds`);

    const savedFeed = updatedFeeds.find(feed => feed.id === createdFeed.id);
    if (savedFeed) {
      console.log(`✅ Feed successfully saved to database:`);
      console.log(`   ID: ${savedFeed.id}`);
      console.log(`   Title: ${savedFeed.title}`);
      console.log(`   URL: ${savedFeed.feedUrl}`);
      console.log(`   Active: ${savedFeed.isActive}`);
      console.log(`   Created: ${savedFeed.createdAt}`);
    } else {
      console.log('❌ Feed not found in database after creation');
    }

    // Test RSS feed item creation
    console.log('\n📝 Testing RSS feed item creation...');
    const testItem = {
      feedId: createdFeed.id,
      userId: testUserId,
      profileId: 0,
      title: 'Test RSS Item',
      description: 'This is a test RSS item',
      content: 'Full content of the test RSS item',
      link: 'https://example.com/test-article',
      author: 'Test Author',
      publishedAt: new Date(),
      guid: 'test-guid-123',
      isProcessed: false
    };

    const createdItem = await storage.createRssFeedItem(testItem);
    console.log(`✅ Created RSS feed item: ${createdItem.title} (ID: ${createdItem.id})`);

    // Verify the item was saved
    console.log('\n🔍 Verifying item was saved...');
    const items = await storage.getRssFeedItems(testUserId, createdFeed.id);
    console.log(`   Found ${items.length} items for feed ${createdFeed.id}`);

    const savedItem = items.find(item => item.id === createdItem.id);
    if (savedItem) {
      console.log(`✅ Item successfully saved to database:`);
      console.log(`   ID: ${savedItem.id}`);
      console.log(`   Title: ${savedItem.title}`);
      console.log(`   Link: ${savedItem.link}`);
      console.log(`   Processed: ${savedItem.isProcessed}`);
      console.log(`   Created: ${savedItem.createdAt}`);
    } else {
      console.log('❌ Item not found in database after creation');
    }

    console.log('\n✅ RSS feed save test completed successfully!');

  } catch (error) {
    console.error('❌ RSS feed save test failed:', error);
    process.exit(1);
  }
}

// Run the test
testRssFeedSave().catch(console.error); 