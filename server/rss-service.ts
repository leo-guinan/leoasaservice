import Parser from 'rss-parser';
import { storage } from './storage';
import { chromaService } from './chroma';
import { nanoid } from 'nanoid';
import OpenAI from 'openai';

const parser = new Parser();
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || "your-api-key-here" 
});

export interface RssFeedData {
  feedUrl: string;
  title?: string;
  description?: string;
  items: RssItem[];
}

export interface RssItem {
  title: string;
  description?: string;
  content?: string;
  link: string;
  author?: string;
  publishedAt?: Date;
  guid: string;
}

export interface ProcessedRssItem extends RssItem {
  analysis?: any;
  summary?: string;
  keyTopics?: string[];
  sentiment?: string;
}

class RssService {
  /**
   * Fetch RSS feed and return parsed data
   */
  async fetchRssFeed(feedUrl: string): Promise<RssFeedData> {
    try {
      console.log(`Fetching RSS feed: ${feedUrl}`);
      
      const feed = await parser.parseURL(feedUrl);
      
      const items: RssItem[] = feed.items.map((item: any) => ({
        title: item.title || 'Untitled',
        description: item.contentSnippet || item.description,
        content: item.content,
        link: item.link || '',
        author: item.creator || item.author,
        publishedAt: item.pubDate ? new Date(item.pubDate) : undefined,
        guid: item.guid || item.link || nanoid(),
      }));

      return {
        feedUrl,
        title: feed.title,
        description: feed.description,
        items,
      };
    } catch (error) {
      console.error(`Failed to fetch RSS feed ${feedUrl}:`, error);
      throw new Error(`Failed to fetch RSS feed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process RSS items with AI analysis
   */
  async processRssItems(items: RssItem[], userId: number, profileId: number = 0): Promise<ProcessedRssItem[]> {
    const processedItems: ProcessedRssItem[] = [];

    for (const item of items) {
      try {
        console.log(`Processing RSS item: ${item.title}`);
        
        // Combine title, description, and content for analysis
        const contentForAnalysis = [
          item.title,
          item.description,
          item.content
        ].filter(Boolean).join('\n\n');

        if (contentForAnalysis.length < 50) {
          // Skip items with insufficient content
          processedItems.push(item);
          continue;
        }

        // Analyze content with AI
        const analysis = await this.analyzeContent(contentForAnalysis);
        
        const processedItem: ProcessedRssItem = {
          ...item,
          analysis,
          summary: analysis.summary,
          keyTopics: analysis.keyTopics,
          sentiment: analysis.sentiment,
        };

        processedItems.push(processedItem);
        
        // Add to ChromaDB for vector search
        await this.indexRssItem(processedItem, userId, profileId);
        
      } catch (error) {
        console.error(`Failed to process RSS item ${item.title}:`, error);
        // Continue with other items even if one fails
        processedItems.push(item);
      }
    }

    return processedItems;
  }

  /**
   * Analyze content using OpenAI
   */
  private async analyzeContent(content: string): Promise<any> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Analyze the following content and provide:
1. A concise summary (2-3 sentences)
2. Key topics/themes (array of strings)
3. Sentiment (positive, negative, neutral)
4. Content type (article, news, blog, etc.)
5. Relevance score (1-10)

Return as JSON with these fields: summary, keyTopics, sentiment, contentType, relevanceScore`
          },
          {
            role: "user",
            content: content.substring(0, 4000) // Limit content length
          }
        ],
        temperature: 0.3,
      });

      const analysisText = response.choices[0].message.content;
      if (!analysisText) {
        throw new Error('No analysis received from OpenAI');
      }

      // Try to parse JSON response
      try {
        return JSON.parse(analysisText);
      } catch {
        // Fallback if JSON parsing fails
        return {
          summary: analysisText,
          keyTopics: [],
          sentiment: 'neutral',
          contentType: 'unknown',
          relevanceScore: 5
        };
      }
    } catch (error) {
      console.error('AI analysis failed:', error);
      return {
        summary: 'Analysis failed',
        keyTopics: [],
        sentiment: 'neutral',
        contentType: 'unknown',
        relevanceScore: 5
      };
    }
  }

  /**
   * Index RSS item in ChromaDB
   */
  private async indexRssItem(item: ProcessedRssItem, userId: number, profileId: number): Promise<void> {
    try {
      const content = [
        item.title,
        item.description,
        item.summary,
        item.keyTopics?.join(', ')
      ].filter(Boolean).join('\n\n');

      const document = {
        id: nanoid(),
        content: content,
        metadata: {
          userId: userId,
          profileId: profileId,
          type: 'rss_item',
          title: item.title,
          url: item.link,
          publishedAt: item.publishedAt?.toISOString(),
          sentiment: item.sentiment,
          contentType: item.analysis?.contentType || 'unknown',
          relevanceScore: item.analysis?.relevanceScore || 5,
          timestamp: new Date().toISOString()
        }
      };

      await chromaService.addUrlContent(document);
    } catch (error) {
      console.error('Failed to index RSS item in ChromaDB:', error);
    }
  }

  /**
   * Fetch and process all active RSS feeds for a user
   */
  async processAllUserFeeds(userId: number): Promise<{ success: number; failed: number; totalItems: number }> {
    try {
      // Get all active RSS feeds for the user
      const feeds = await storage.getRssFeeds(userId);
      const activeFeeds = feeds.filter(feed => feed.isActive);

      console.log(`Processing ${activeFeeds.length} active RSS feeds for user ${userId}`);

      let successCount = 0;
      let failedCount = 0;
      let totalItems = 0;

      for (const feed of activeFeeds) {
        try {
          // Check if it's time to fetch this feed
          const shouldFetch = this.shouldFetchFeed(feed);
          if (!shouldFetch) {
            console.log(`Skipping feed ${feed.feedUrl} - not due for fetch yet`);
            continue;
          }

          // Fetch RSS feed
          const feedData = await this.fetchRssFeed(feed.feedUrl);
          
          // Filter for new items since last fetch
          const newItems = this.filterNewItems(feedData.items, feed.lastItemDate);
          
          if (newItems.length === 0) {
            console.log(`No new items for feed ${feed.feedUrl}`);
            await storage.updateRssFeedLastFetched(feed.id);
            continue;
          }

          // Limit items per fetch
          const itemsToProcess = newItems.slice(0, feed.maxItemsPerFetch);
          
          // Process items
          const processedItems = await this.processRssItems(itemsToProcess, userId, feed.profileId);
          
          // Save items to database
          for (const item of processedItems) {
            await storage.createRssFeedItem({
              feedId: feed.id,
              userId: userId,
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
          const latestItemDate = this.getLatestItemDate(processedItems);
          await storage.updateRssFeedMetadata(feed.id, {
            lastFetched: new Date(),
            lastItemDate: latestItemDate
          });

          successCount++;
          totalItems += processedItems.length;
          
          console.log(`Successfully processed ${processedItems.length} items from feed ${feed.feedUrl}`);

        } catch (error) {
          console.error(`Failed to process feed ${feed.feedUrl}:`, error);
          failedCount++;
        }
      }

      return { success: successCount, failed: failedCount, totalItems };
    } catch (error) {
      console.error('Failed to process user RSS feeds:', error);
      throw error;
    }
  }

  /**
   * Check if a feed should be fetched based on its interval
   */
  private shouldFetchFeed(feed: any): boolean {
    if (!feed.lastFetched) {
      return true; // Never fetched before
    }

    const lastFetched = new Date(feed.lastFetched);
    const now = new Date();
    const minutesSinceLastFetch = (now.getTime() - lastFetched.getTime()) / (1000 * 60);
    
    return minutesSinceLastFetch >= feed.fetchInterval;
  }

  /**
   * Filter items that are newer than the last fetched item
   */
  private filterNewItems(items: RssItem[], lastItemDate?: Date): RssItem[] {
    if (!lastItemDate) {
      return items; // No previous fetch, return all items
    }

    return items.filter(item => {
      if (!item.publishedAt) {
        return true; // Include items without publish date
      }
      return item.publishedAt > lastItemDate;
    });
  }

  /**
   * Get the latest item date from processed items
   */
  private getLatestItemDate(items: ProcessedRssItem[]): Date | undefined {
    const itemsWithDates = items.filter(item => item.publishedAt);
    if (itemsWithDates.length === 0) {
      return undefined;
    }

    return new Date(Math.max(...itemsWithDates.map(item => item.publishedAt!.getTime())));
  }

  /**
   * Search RSS items using ChromaDB
   */
  async searchRssItems(userId: number, query: string, limit: number = 10): Promise<any> {
    try {
      return await chromaService.searchUrlContent(userId, query, limit);
    } catch (error) {
      console.error('Failed to search RSS items:', error);
      throw error;
    }
  }

  /**
   * Process a specific RSS feed
   */
  async processSpecificFeed(feedId: number): Promise<{ success: boolean; itemsProcessed: number; message: string }> {
    try {
      // Get all users to find the feed
      const allUsers = await storage.getAllUsersWithStats();
      
      for (const userStats of allUsers) {
        const feeds = await storage.getRssFeeds(userStats.user.id);
        const feed = feeds.find(f => f.id === feedId);
        
        if (feed) {
          console.log(`Processing specific feed: ${feed.title} (${feed.feedUrl})`);
          
          // Fetch and process the feed
          const feedData = await this.fetchRssFeed(feed.feedUrl);
          const processedItems = await this.processRssItems(feedData.items, feed.userId, feed.profileId);
          
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
          
          return {
            success: true,
            itemsProcessed: processedItems.length,
            message: `Successfully processed ${processedItems.length} items from feed ${feed.title}`
          };
        }
      }
      
      return {
        success: false,
        itemsProcessed: 0,
        message: `Feed with ID ${feedId} not found`
      };
      
    } catch (error) {
      console.error(`Failed to process specific feed ${feedId}:`, error);
      return {
        success: false,
        itemsProcessed: 0,
        message: `Failed to process feed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

export const rssService = new RssService(); 