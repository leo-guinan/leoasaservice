import Queue from 'bull';
import Redis from 'ioredis';
import { storage } from './storage';
import OpenAI from 'openai';

// Redis connection - only connect if REDIS_URL is provided
let redis: Redis | null = null;

// Initialize Redis connection
function initializeRedis() {
  if (process.env.REDIS_URL) {
    try {
      redis = new Redis(process.env.REDIS_URL);
      console.log('Redis connected successfully');
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      redis = null;
    }
  } else {
    console.log('Redis not configured, background processing disabled');
  }
}

// Initialize Redis when this module is loaded
initializeRedis();

// OpenAI client
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || "your-api-key-here" 
});

// Define job types
export interface ProcessUrlJob {
  userId: number;
  urlId: number;
  url: string;
}

export interface AnalyzeContentJob {
  userId: number;
  content: string;
  type: 'url' | 'chat' | 'question';
}

// Create queues - only if Redis is available
export const urlProcessingQueue = redis ? new Queue<ProcessUrlJob>('url-processing', {
  redis: process.env.REDIS_URL || {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  }
}) : null;

export const contentAnalysisQueue = redis ? new Queue<AnalyzeContentJob>('content-analysis', {
  redis: process.env.REDIS_URL || {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  }
}) : null;

// URL processing worker
if (urlProcessingQueue) {
  urlProcessingQueue.process(async (job) => {
    const { userId, urlId, url } = job.data;
    
    try {
      console.log(`Processing URL: ${url} for user ${userId}`);
      
      // Fetch URL content (you'd implement this based on your needs)
      const content = await fetchUrlContent(url);
      
      // Analyze content with AI
      const analysis = await analyzeContent(content);
      
      // Store results (you'd need to add this to your storage)
      await storage.updateUrlAnalysis(urlId, userId, analysis);
      
      console.log(`URL processing completed for ${url}`);
      return { success: true, analysis };
    } catch (error) {
      console.error(`URL processing failed for ${url}:`, error);
      throw error;
    }
  });
}

// Content analysis worker
if (contentAnalysisQueue) {
  contentAnalysisQueue.process(async (job) => {
    const { userId, content, type } = job.data;
    
    try {
      console.log(`Analyzing content for user ${userId}, type: ${type}`);
      
      const analysis = await analyzeContent(content);
      
      // Store analysis results based on type
      switch (type) {
        case 'url':
          // Handle URL analysis storage
          break;
        case 'chat':
          // Handle chat analysis storage
          break;
        case 'question':
          // Handle question analysis storage
          break;
      }
      
      console.log(`Content analysis completed for user ${userId}`);
      return { success: true, analysis };
    } catch (error) {
      console.error(`Content analysis failed for user ${userId}:`, error);
      throw error;
    }
  });
}

// Helper function to fetch URL content
async function fetchUrlContent(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const html = await response.text();
    
    // Basic HTML to text conversion (you might want a proper HTML parser)
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  } catch (error) {
    console.error(`Failed to fetch URL content: ${url}`, error);
    throw new Error(`Failed to fetch URL content: ${error}`);
  }
}

// Helper function to analyze content with AI
async function analyzeContent(content: string): Promise<any> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Analyze the following content and provide a structured summary including key topics, main points, and relevance for research purposes."
        },
        {
          role: "user",
          content: content.substring(0, 4000) // Limit content length
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

// Error handling
if (urlProcessingQueue) {
  urlProcessingQueue.on('error', (error) => {
    console.error('URL processing queue error:', error);
  });
}

if (contentAnalysisQueue) {
  contentAnalysisQueue.on('error', (error) => {
    console.error('Content analysis queue error:', error);
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  if (urlProcessingQueue) await urlProcessingQueue.close();
  if (contentAnalysisQueue) await contentAnalysisQueue.close();
  if (redis) await redis.quit();
  process.exit(0);
});

export { redis }; 