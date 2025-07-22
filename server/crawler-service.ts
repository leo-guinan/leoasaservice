import puppeteer, { Browser, Page } from 'puppeteer';
import { storage } from './storage';
import { chromaService } from './chroma';
import { nanoid } from 'nanoid';
import OpenAI from 'openai';
import { URL } from 'url';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || "your-api-key-here" 
});

export interface CrawlResult {
  url: string;
  title?: string;
  description?: string;
  content?: string;
  analysis?: any;
  priority: number;
  depth: number;
}

export interface CrawlOptions {
  maxPages: number;
  maxDepth: number;
  delay: number; // Delay between requests in ms
  userAgent: string;
  timeout: number;
}

class CrawlerService {
  private browser: Browser | null = null;

  /**
   * Initialize browser for crawling
   */
  async initialize(): Promise<void> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });
    }
  }

  /**
   * Close browser
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Crawl a root URL and discover leaf nodes
   */
  async crawlRootUrl(
    rootUrl: string, 
    userId: number, 
    profileId: number = 0,
    options: Partial<CrawlOptions> = {}
  ): Promise<{ discovered: number; processed: number; analyzed: number }> {
    const defaultOptions: CrawlOptions = {
      maxPages: 100,
      maxDepth: 3,
      delay: 1000,
      userAgent: 'Mozilla/5.0 (compatible; ResearchBuddy/1.0)',
      timeout: 30000
    };

    const crawlOptions = { ...defaultOptions, ...options };

    try {
      await this.initialize();
      
      console.log(`Starting crawl of root URL: ${rootUrl}`);
      
      // Create crawler job
      const job = await storage.createCrawlerJob(userId, {
        rootUrl,
        profileId,
        maxPages: crawlOptions.maxPages
      });

      // Update job status
      await storage.updateCrawlerJob(job.id, userId, {
        status: 'processing',
        startedAt: new Date()
      });

      const discoveredUrls = new Set<string>();
      const processedUrls = new Set<string>();
      const analyzedUrls = new Set<string>();

      // Start crawling from root
      await this.crawlPage(
        rootUrl,
        rootUrl,
        1,
        discoveredUrls,
        processedUrls,
        analyzedUrls,
        job.id,
        userId,
        profileId,
        crawlOptions
      );

      // Update job completion
      await storage.updateCrawlerJob(job.id, userId, {
        status: 'completed',
        completedAt: new Date(),
        pagesDiscovered: discoveredUrls.size,
        pagesProcessed: processedUrls.size,
        pagesAnalyzed: analyzedUrls.size
      });

      console.log(`Crawl completed: ${discoveredUrls.size} discovered, ${processedUrls.size} processed, ${analyzedUrls.size} analyzed`);

      return {
        discovered: discoveredUrls.size,
        processed: processedUrls.size,
        analyzed: analyzedUrls.size
      };

    } catch (error) {
      console.error('Crawl failed:', error);
      
      // Update job with error
      if (job) {
        await storage.updateCrawlerJob(job.id, userId, {
          status: 'failed',
          completedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      
      throw error;
    }
  }

  /**
   * Crawl a single page and discover links
   */
  private async crawlPage(
    pageUrl: string,
    rootUrl: string,
    depth: number,
    discoveredUrls: Set<string>,
    processedUrls: Set<string>,
    analyzedUrls: Set<string>,
    jobId: number,
    userId: number,
    profileId: number,
    options: CrawlOptions
  ): Promise<void> {
    if (depth > options.maxDepth || discoveredUrls.size >= options.maxPages) {
      return;
    }

    try {
      console.log(`Crawling page: ${pageUrl} (depth: ${depth})`);

      const page = await this.browser!.newPage();
      
      // Set user agent and timeout
      await page.setUserAgent(options.userAgent);
      await page.setDefaultTimeout(options.timeout);

      // Navigate to page
      await page.goto(pageUrl, { waitUntil: 'networkidle2' });

      // Extract page content
      const pageData = await this.extractPageData(page);
      
      // Calculate priority score
      const priority = this.calculatePriority(pageData, depth);

      // Store discovered page
      const crawlerPage = await storage.createCrawlerPage({
        jobId,
        userId,
        profileId,
        url: pageUrl,
        title: pageData.title,
        description: pageData.description,
        content: pageData.content,
        status: 'discovered',
        priority,
        depth
      });

      discoveredUrls.add(pageUrl);

      // Update job progress
      await storage.updateCrawlerJob(jobId, userId, {
        pagesDiscovered: discoveredUrls.size
      });

      // Process and analyze content if priority is high enough
      if (priority > 5 && analyzedUrls.size < options.maxPages) {
        await this.processAndAnalyzePage(crawlerPage, userId, profileId);
        analyzedUrls.add(pageUrl);
        
        await storage.updateCrawlerJob(jobId, userId, {
          pagesAnalyzed: analyzedUrls.size
        });
      }

      processedUrls.add(pageUrl);
      
      await storage.updateCrawlerJob(jobId, userId, {
        pagesProcessed: processedUrls.size
      });

      // Discover new links if we haven't reached the limit
      if (discoveredUrls.size < options.maxPages) {
        const links = await this.discoverLinks(page, rootUrl);
        
        // Process links with delay
        for (const link of links) {
          if (discoveredUrls.size >= options.maxPages) break;
          
          if (!discoveredUrls.has(link)) {
            await new Promise(resolve => setTimeout(resolve, options.delay));
            await this.crawlPage(
              link,
              rootUrl,
              depth + 1,
              discoveredUrls,
              processedUrls,
              analyzedUrls,
              jobId,
              userId,
              profileId,
              options
            );
          }
        }
      }

      await page.close();

    } catch (error) {
      console.error(`Failed to crawl page ${pageUrl}:`, error);
      
      // Store failed page
      await storage.createCrawlerPage({
        jobId,
        userId,
        profileId,
        url: pageUrl,
        status: 'failed',
        priority: 0,
        depth
      });
    }
  }

  /**
   * Extract data from a page
   */
  private async extractPageData(page: Page): Promise<{
    title: string;
    description: string;
    content: string;
    links: string[];
  }> {
    const data = await page.evaluate(() => {
      // Extract title
      const title = document.title || '';
      
      // Extract description
      const metaDescription = document.querySelector('meta[name="description"]');
      const description = metaDescription ? metaDescription.getAttribute('content') || '' : '';
      
      // Extract content (simplified)
      const content = document.body ? document.body.innerText || '' : '';
      
      // Extract links
      const links = Array.from(document.querySelectorAll('a[href]'))
        .map(a => a.getAttribute('href'))
        .filter(href => href && href.startsWith('http'))
        .slice(0, 50); // Limit to 50 links
      
      return { title, description, content, links };
    });

    return data;
  }

  /**
   * Discover links on a page
   */
  private async discoverLinks(page: Page, rootUrl: string): Promise<string[]> {
    const links = await page.evaluate((rootUrl) => {
      const url = new URL(rootUrl);
      const domain = url.hostname;
      
      return Array.from(document.querySelectorAll('a[href]'))
        .map(a => a.getAttribute('href'))
        .filter(href => {
          if (!href) return false;
          
          try {
            const linkUrl = new URL(href, rootUrl);
            return linkUrl.hostname === domain && 
                   !href.includes('#') && 
                   !href.includes('mailto:') &&
                   !href.includes('tel:');
          } catch {
            return false;
          }
        })
        .map(href => new URL(href, rootUrl).href)
        .filter((href, index, arr) => arr.indexOf(href) === index) // Remove duplicates
        .slice(0, 20); // Limit to 20 links per page
    }, rootUrl);

    return links;
  }

  /**
   * Calculate priority score for a page
   */
  private calculatePriority(pageData: any, depth: number): number {
    let priority = 10 - depth; // Higher priority for shallower pages
    
    // Boost priority for pages with good content
    if (pageData.content && pageData.content.length > 500) {
      priority += 2;
    }
    
    if (pageData.title && pageData.title.length > 10) {
      priority += 1;
    }
    
    if (pageData.description && pageData.description.length > 50) {
      priority += 1;
    }
    
    // Boost priority for pages that look like articles
    const articleKeywords = ['article', 'post', 'blog', 'news', 'story', 'tutorial'];
    const hasArticleKeywords = articleKeywords.some(keyword => 
      pageData.title?.toLowerCase().includes(keyword) ||
      pageData.description?.toLowerCase().includes(keyword)
    );
    
    if (hasArticleKeywords) {
      priority += 3;
    }
    
    return Math.max(1, Math.min(10, priority));
  }

  /**
   * Process and analyze a page with AI
   */
  private async processAndAnalyzePage(crawlerPage: any, userId: number, profileId: number): Promise<void> {
    try {
      console.log(`Analyzing page: ${crawlerPage.url}`);
      
      const content = [
        crawlerPage.title,
        crawlerPage.description,
        crawlerPage.content
      ].filter(Boolean).join('\n\n');

      if (content.length < 100) {
        console.log(`Skipping analysis for ${crawlerPage.url} - insufficient content`);
        return;
      }

      // Analyze content with AI
      const analysis = await this.analyzeContent(content);
      
      // Update page with analysis
      await storage.updateCrawlerPage(crawlerPage.id, {
        analysis,
        status: 'analyzed',
        processedAt: new Date()
      });

      // Index in ChromaDB
      await this.indexCrawlerPage(crawlerPage, analysis, userId, profileId);

      console.log(`Analysis completed for: ${crawlerPage.url}`);

    } catch (error) {
      console.error(`Failed to analyze page ${crawlerPage.url}:`, error);
      
      await storage.updateCrawlerPage(crawlerPage.id, {
        status: 'failed'
      });
    }
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
            content: `Analyze the following web page content and provide:
1. A concise summary (2-3 sentences)
2. Key topics/themes (array of strings)
3. Content type (article, news, blog, documentation, etc.)
4. Relevance score (1-10)
5. Main insights or takeaways

Return as JSON with these fields: summary, keyTopics, contentType, relevanceScore, insights`
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
          contentType: 'unknown',
          relevanceScore: 5,
          insights: []
        };
      }
    } catch (error) {
      console.error('AI analysis failed:', error);
      return {
        summary: 'Analysis failed',
        keyTopics: [],
        contentType: 'unknown',
        relevanceScore: 5,
        insights: []
      };
    }
  }

  /**
   * Index crawler page in ChromaDB
   */
  private async indexCrawlerPage(crawlerPage: any, analysis: any, userId: number, profileId: number): Promise<void> {
    try {
      const content = [
        crawlerPage.title,
        crawlerPage.description,
        crawlerPage.content,
        analysis.summary,
        analysis.keyTopics?.join(', ')
      ].filter(Boolean).join('\n\n');

      const document = {
        id: nanoid(),
        content: content,
        metadata: {
          userId: userId,
          profileId: profileId,
          type: 'crawler_page',
          title: crawlerPage.title,
          url: crawlerPage.url,
          contentType: analysis.contentType || 'unknown',
          relevanceScore: analysis.relevanceScore || 5,
          depth: crawlerPage.depth,
          timestamp: new Date().toISOString()
        }
      };

      await chromaService.addUrlContent(document);
    } catch (error) {
      console.error('Failed to index crawler page in ChromaDB:', error);
    }
  }

  /**
   * Get crawler job status
   */
  async getCrawlerJobStatus(jobId: number, userId: number): Promise<any> {
    const job = await storage.getCrawlerJobs(userId);
    return job.find(j => j.id === jobId);
  }

  /**
   * Get crawler pages for a job
   */
  async getCrawlerPages(jobId: number): Promise<any[]> {
    return await storage.getCrawlerPages(jobId);
  }
}

export const crawlerService = new CrawlerService(); 