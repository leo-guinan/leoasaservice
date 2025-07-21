import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { storage } from '../../storage';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || "your-api-key-here" 
});

export const rootUrlProcessingTool = createTool({
  id: 'process-root-url',
  description: 'Process a main site (root URL) by analyzing content, discovering RSS feeds, and setting up monitoring',
  inputSchema: z.object({
    urlId: z.number().describe('Database ID of the URL to process'),
    userId: z.number().describe('User ID who owns the URL'),
    url: z.string().describe('The root URL to process'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    contentLength: z.number(),
    analysis: z.object({
      summary: z.string(),
      timestamp: z.string(),
      model: z.string(),
    }),
    rssFeeds: z.array(z.string()),
    discoveredPages: z.array(z.string()),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    return await processRootUrl(context.urlId, context.userId, context.url);
  },
});

// Helper function to fetch URL content using Jina
async function fetchUrlContent(url: string): Promise<string> {
  try {
    // Ensure URL is properly encoded for Jina
    const encodedUrl = encodeURIComponent(url);
    const jinaUrl = `https://r.jina.ai/${encodedUrl}`;
    
    console.log(`Fetching content from Jina: ${jinaUrl}`);
    
    const response = await fetch(jinaUrl);
    
    if (!response.ok) {
      throw new Error(`Jina API returned ${response.status}: ${response.statusText}`);
    }
    
    const markdown = await response.text();
    
    if (!markdown || markdown.trim().length === 0) {
      throw new Error('Empty content received from Jina');
    }
    
    console.log(`Successfully fetched ${markdown.length} characters from ${url}`);
    
    // Return the markdown content directly
    return markdown.trim();
  } catch (error) {
    console.error(`Failed to fetch URL content: ${url}`, error);
    throw new Error(`Failed to fetch URL content: ${error}`);
  }
}

// Helper function to discover RSS feeds
async function discoverRssFeeds(url: string): Promise<string[]> {
  try {
    console.log(`Discovering RSS feeds for: ${url}`);
    
    // Try common RSS feed URLs
    const commonRssPaths = [
      '/rss',
      '/rss.xml',
      '/feed',
      '/feed.xml',
      '/atom.xml',
      '/rss/feed',
      '/blog/rss',
      '/blog/feed',
      '/news/rss',
      '/news/feed'
    ];
    
    const baseUrl = new URL(url);
    const discoveredFeeds: string[] = [];
    
    // Check for RSS feed links in the HTML content
    const content = await fetchUrlContent(url);
    
    // Look for RSS feed links in the content
    const rssLinkPatterns = [
      /<link[^>]*type="application\/rss\+xml"[^>]*href="([^"]*)"/gi,
      /<link[^>]*type="application\/atom\+xml"[^>]*href="([^"]*)"/gi,
      /<a[^>]*href="([^"]*\.xml)"[^>]*>.*?rss.*?<\/a>/gi,
      /<a[^>]*href="([^"]*\/feed)"[^>]*>/gi
    ];
    
    for (const pattern of rssLinkPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const feedUrl = match[1];
        if (feedUrl) {
          const absoluteUrl = new URL(feedUrl, baseUrl.origin).href;
          discoveredFeeds.push(absoluteUrl);
        }
      }
    }
    
    // Test common RSS paths
    for (const path of commonRssPaths) {
      try {
        const testUrl = new URL(path, baseUrl.origin).href;
        const response = await fetch(testUrl, { method: 'HEAD' });
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType && (contentType.includes('xml') || contentType.includes('rss') || contentType.includes('atom'))) {
            discoveredFeeds.push(testUrl);
          }
        }
      } catch (error) {
        // Ignore errors for individual RSS path tests
        continue;
      }
    }
    
    // Remove duplicates
    const uniqueFeeds = Array.from(new Set(discoveredFeeds));
    console.log(`Discovered ${uniqueFeeds.length} RSS feeds for ${url}`);
    
    return uniqueFeeds;
  } catch (error) {
    console.error(`Error discovering RSS feeds for ${url}:`, error);
    return [];
  }
}

// Helper function to discover additional pages
async function discoverPages(url: string): Promise<string[]> {
  try {
    console.log(`Discovering additional pages for: ${url}`);
    
    const content = await fetchUrlContent(url);
    const baseUrl = new URL(url);
    const discoveredPages: string[] = [];
    
    // Look for internal links
    const linkPattern = /<a[^>]*href="([^"]*)"[^>]*>/gi;
    let match;
    
    while ((match = linkPattern.exec(content)) !== null) {
      const href = match[1];
      if (href && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
        try {
          const absoluteUrl = new URL(href, baseUrl.origin).href;
          // Only include pages from the same domain
          if (new URL(absoluteUrl).origin === baseUrl.origin) {
            discoveredPages.push(absoluteUrl);
          }
        } catch (error) {
          // Ignore invalid URLs
          continue;
        }
      }
    }
    
    // Remove duplicates and limit to reasonable number
    const uniquePages = Array.from(new Set(discoveredPages)).slice(0, 20);
    console.log(`Discovered ${uniquePages.length} additional pages for ${url}`);
    
    return uniquePages;
  } catch (error) {
    console.error(`Error discovering pages for ${url}:`, error);
    return [];
  }
}

// Helper function to analyze content with AI (enhanced for root URLs)
async function analyzeRootContent(content: string, url: string): Promise<any> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Analyze the following website content and provide a comprehensive analysis including:
1. Site purpose and main topics
2. Content structure and organization
3. Target audience
4. Key themes and focus areas
5. Content quality and depth
6. Potential research value
7. Recommendations for monitoring and follow-up

Focus on understanding the site as a whole rather than individual articles.`
        },
        {
          role: "user",
          content: `Website: ${url}\n\nContent: ${content.substring(0, 4000)}`
        }
      ],
    });

    return {
      summary: response.choices[0].message.content,
      timestamp: new Date().toISOString(),
      model: "gpt-4o"
    };
  } catch (error) {
    console.error('AI analysis failed:', error);
    throw new Error(`AI analysis failed: ${error}`);
  }
}

// Main function to process a root URL
async function processRootUrl(urlId: number, userId: number, url: string) {
  try {
    console.log(`Processing root URL: ${url} for user ${userId}, urlId: ${urlId}`);
    
    // Fetch main page content
    console.log(`Fetching main page content for URL: ${url}`);
    const content = await fetchUrlContent(url);
    
    // Save content to database
    console.log(`Saving content to database for urlId: ${urlId}`);
    const updatedUrl = await storage.updateUrlContent(urlId, userId, content);
    
    if (!updatedUrl) {
      throw new Error(`Failed to update URL content - URL not found or access denied`);
    }
    
    console.log(`Content saved successfully. Content length: ${content.length} characters`);
    
    // Analyze content with AI (enhanced for root URLs)
    console.log(`Starting AI analysis for root URL: ${urlId}`);
    const analysis = await analyzeRootContent(content, url);
    
    // Store analysis results
    console.log(`Saving analysis to database for urlId: ${urlId}`);
    const urlWithAnalysis = await storage.updateUrlAnalysis(urlId, userId, analysis);
    
    if (!urlWithAnalysis) {
      throw new Error(`Failed to update URL analysis - URL not found or access denied`);
    }
    
    // Discover RSS feeds
    console.log(`Discovering RSS feeds for: ${url}`);
    const rssFeeds = await discoverRssFeeds(url);
    
    // Discover additional pages
    console.log(`Discovering additional pages for: ${url}`);
    const discoveredPages = await discoverPages(url);
    
    console.log(`Root URL processing completed successfully for ${url}`);
    
    return {
      success: true,
      contentLength: content.length,
      analysis,
      rssFeeds,
      discoveredPages,
      message: `Successfully processed root URL: ${url} (${content.length} characters, ${rssFeeds.length} RSS feeds, ${discoveredPages.length} pages discovered)`
    };
  } catch (error) {
    console.error(`Root URL processing failed for ${url} (urlId: ${urlId}):`, error);
    return {
      success: false,
      contentLength: 0,
      analysis: {
        summary: `Error processing root URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
        model: "error"
      },
      rssFeeds: [],
      discoveredPages: [],
      message: `Failed to process root URL: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
} 