#!/usr/bin/env tsx

import { rssService } from '../server/rss-service';
import { storage } from '../server/storage';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Daily RSS Feed Processor
 * 
 * This script processes all active RSS feeds for all users.
 * It can be run as a cron job to automatically fetch and analyze new content.
 * 
 * Usage:
 * - Run manually: npm run rss:process
 * - Run for specific user: npm run rss:process -- --userId=1
 * - Run for specific feed: npm run rss:process -- --feedId=1
 */

async function processAllRssFeeds() {
  console.log('🚀 Starting RSS feed processing...');
  
  try {
    // Get all users with RSS feeds
    const allUsers = await storage.getAllUsersWithStats();
    const usersWithFeeds = allUsers.filter(user => user.urlCount > 0); // Simple heuristic
    
    console.log(`Found ${usersWithFeeds.length} users to process`);
    
    let totalSuccess = 0;
    let totalFailed = 0;
    let totalItems = 0;
    
    for (const userStats of usersWithFeeds) {
      try {
        console.log(`\n📰 Processing RSS feeds for user: ${userStats.user.username} (ID: ${userStats.user.id})`);
        
        const result = await rssService.processAllUserFeeds(userStats.user.id);
        
        totalSuccess += result.success;
        totalFailed += result.failed;
        totalItems += result.totalItems;
        
        console.log(`✅ User ${userStats.user.username}: ${result.success} feeds processed, ${result.totalItems} items added`);
        
        if (result.failed > 0) {
          console.log(`❌ User ${userStats.user.username}: ${result.failed} feeds failed`);
        }
        
      } catch (error) {
        console.error(`❌ Failed to process feeds for user ${userStats.user.username}:`, error);
        totalFailed++;
      }
    }
    
    console.log(`\n🎉 RSS processing completed!`);
    console.log(`📊 Summary:`);
    console.log(`   - Total feeds processed: ${totalSuccess}`);
    console.log(`   - Total feeds failed: ${totalFailed}`);
    console.log(`   - Total items added: ${totalItems}`);
    
  } catch (error) {
    console.error('❌ RSS processing failed:', error);
    process.exit(1);
  }
}

async function processUserRssFeeds(userId: number) {
  console.log(`🚀 Processing RSS feeds for user ID: ${userId}`);
  
  try {
    const result = await rssService.processAllUserFeeds(userId);
    
    console.log(`✅ Processing completed for user ${userId}:`);
    console.log(`   - Feeds processed: ${result.success}`);
    console.log(`   - Feeds failed: ${result.failed}`);
    console.log(`   - Items added: ${result.totalItems}`);
    
  } catch (error) {
    console.error(`❌ Failed to process feeds for user ${userId}:`, error);
    process.exit(1);
  }
}

async function processSpecificFeed(feedId: number) {
  console.log(`🚀 Processing specific RSS feed ID: ${feedId}`);
  
  try {
    // Get the feed
    const allUsers = await storage.getAllUsersWithStats();
    
    for (const userStats of allUsers) {
      const feeds = await storage.getRssFeeds(userStats.user.id);
      const feed = feeds.find(f => f.id === feedId);
      
      if (feed) {
        console.log(`Found feed: ${feed.title} (${feed.feedUrl})`);
        
        // Fetch and process the feed
        const feedData = await rssService.fetchRssFeed(feed.feedUrl);
        const processedItems = await rssService.processRssItems(feedData.items, feed.userId, feed.profileId);
        
        // Save items to database
        for (const item of processedItems) {
          await storage.createRssFeedItem({
            feedId: feed.id,
            userId: feed.userId,
            profileId: feed.profileId,
            title: item.title,
            description: item.description,
            content: item.content,
            link: item.link,
            author: item.author,
            publishedAt: item.publishedAt,
            guid: item.guid,
            isProcessed: !!item.analysis
          });
        }
        
        // Update feed metadata
        const latestItemDate = processedItems.length > 0 
          ? new Date(Math.max(...processedItems.map(item => item.publishedAt?.getTime() || 0)))
          : undefined;
          
        await storage.updateRssFeedMetadata(feed.id, {
          lastFetched: new Date(),
          lastItemDate: latestItemDate
        });
        
        console.log(`✅ Feed processed: ${processedItems.length} items added`);
        return;
      }
    }
    
    console.log(`❌ Feed with ID ${feedId} not found`);
    process.exit(1);
    
  } catch (error) {
    console.error(`❌ Failed to process feed ${feedId}:`, error);
    process.exit(1);
  }
}

async function listRssFeeds() {
  console.log('📋 Listing all RSS feeds:');
  
  try {
    const allUsers = await storage.getAllUsersWithStats();
    
    for (const userStats of allUsers) {
      const feeds = await storage.getRssFeeds(userStats.user.id);
      
      if (feeds.length > 0) {
        console.log(`\n👤 User: ${userStats.user.username} (ID: ${userStats.user.id})`);
        
        for (const feed of feeds) {
          const status = feed.isActive ? '✅ Active' : '❌ Inactive';
          const lastFetch = feed.lastFetched ? new Date(feed.lastFetched).toLocaleString() : 'Never';
          
          console.log(`   ${feed.id}. ${feed.title || feed.feedUrl}`);
          console.log(`      URL: ${feed.feedUrl}`);
          console.log(`      Status: ${status}`);
          console.log(`      Last fetch: ${lastFetch}`);
          console.log(`      Interval: ${feed.fetchInterval} minutes`);
          console.log(`      Max items: ${feed.maxItemsPerFetch}`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Failed to list RSS feeds:', error);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  const userIdArg = args.find(arg => arg.startsWith('--userId='));
  const feedIdArg = args.find(arg => arg.startsWith('--feedId='));
  const listArg = args.find(arg => arg === '--list');
  
  if (listArg) {
    await listRssFeeds();
  } else if (userIdArg) {
    const userId = parseInt(userIdArg.split('=')[1]);
    if (isNaN(userId)) {
      console.error('❌ Invalid user ID');
      process.exit(1);
    }
    await processUserRssFeeds(userId);
  } else if (feedIdArg) {
    const feedId = parseInt(feedIdArg.split('=')[1]);
    if (isNaN(feedId)) {
      console.error('❌ Invalid feed ID');
      process.exit(1);
    }
    await processSpecificFeed(feedId);
  } else {
    // Process all feeds for all users
    await processAllRssFeeds();
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 RSS processing interrupted');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 RSS processing terminated');
  process.exit(0);
});

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
} 