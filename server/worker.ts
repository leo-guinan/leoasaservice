import { storage } from './storage';
import OpenAI from 'openai';
import { Worker, Job } from 'bullmq';
import { createUrlProcessingQueue, createContentAnalysisQueue } from '@shared/queues';
import { ProcessUrlJob, AnalyzeContentJob, JOB_TYPES } from '@shared/jobs';

console.log('Worker module loaded. Initializing workers...');

// OpenAI client
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || "your-api-key-here" 
});

// Create queues using shared configuration
console.log("Creating queues with shared configuration...");
const urlProcessingQueue = createUrlProcessingQueue();
const contentAnalysisQueue = createContentAnalysisQueue();

console.log("Queues created - urlProcessingQueue:", urlProcessingQueue ? "created" : "null");
console.log("Queues created - contentAnalysisQueue:", contentAnalysisQueue ? "created" : "null");

// Create URL processing worker
let urlProcessingWorker: Worker<ProcessUrlJob> | null = null;

if (urlProcessingQueue) {
  console.log('Creating URL processing worker...');
  
  urlProcessingWorker = new Worker<ProcessUrlJob>(
    'url-processing',
    async (job: Job<ProcessUrlJob>) => {
      console.log(`=== PROCESSING JOB STARTED ===`);
      console.log(`Job ID: ${job.id}`);
      console.log(`Job data:`, job.data);
      
      const { userId, urlId, url } = job.data;
      
      try {
        // Update progress
        await job.updateProgress(10);
        console.log(`Processing URL: ${url} for user ${userId}, urlId: ${urlId}`);
        
        // Fetch URL content using Jina for markdown conversion
        await job.updateProgress(20);
        console.log(`Fetching content for URL: ${url}`);
        const content = await fetchUrlContent(url);
        
        // Save content to database
        await job.updateProgress(50);
        console.log(`Saving content to database for urlId: ${urlId}`);
        const updatedUrl = await storage.updateUrlContent(urlId, userId, content);
        
        if (!updatedUrl) {
          throw new Error(`Failed to update URL content - URL not found or access denied`);
        }
        
        console.log(`Content saved successfully. Content length: ${content.length} characters`);
        
        // Analyze content with AI
        await job.updateProgress(75);
        console.log(`Starting AI analysis for urlId: ${urlId}`);
        const analysis = await analyzeContent(content);
        
        // Store analysis results
        await job.updateProgress(90);
        console.log(`Saving analysis to database for urlId: ${urlId}`);
        const urlWithAnalysis = await storage.updateUrlAnalysis(urlId, userId, analysis);
        
        if (!urlWithAnalysis) {
          throw new Error(`Failed to update URL analysis - URL not found or access denied`);
        }
        
        await job.updateProgress(100);
        console.log(`URL processing completed successfully for ${url}`);
        console.log(`=== PROCESSING JOB COMPLETED ===`);
        
        return { success: true, content, analysis };
      } catch (error) {
        console.error(`URL processing failed for ${url} (urlId: ${urlId}):`, error);
        console.log(`=== PROCESSING JOB FAILED ===`);
        throw error;
      }
    },
    {
      autorun: true,
      concurrency: 1,
    }
  );
  
  // Set up worker event listeners
  urlProcessingWorker.on('completed', (job: Job<ProcessUrlJob>, result: any) => {
    console.log(`Job ${job.id} completed successfully:`, result);
  });
  
  urlProcessingWorker.on('failed', (job: Job<ProcessUrlJob> | undefined, error: Error) => {
    console.error(`Job ${job?.id || 'unknown'} failed:`, error);
  });
  
  urlProcessingWorker.on('progress', (job: Job<ProcessUrlJob>, progress: number | object) => {
    console.log(`Job ${job.id} progress:`, progress);
  });
  
  urlProcessingWorker.on('error', (error: Error) => {
    console.error('URL processing worker error:', error);
  });
  
  urlProcessingWorker.on('ready', () => {
    console.log('URL processing worker is ready and listening for jobs');
  });
  
  console.log('URL processing worker created successfully');
} else {
  console.log('URL processing worker not created (no queue available)');
}

// Create content analysis worker
let contentAnalysisWorker: Worker<AnalyzeContentJob> | null = null;

if (contentAnalysisQueue) {
  console.log('Creating content analysis worker...');
  
  contentAnalysisWorker = new Worker<AnalyzeContentJob>(
    'content-analysis',
    async (job: Job<AnalyzeContentJob>) => {
      console.log(`=== CONTENT ANALYSIS JOB STARTED ===`);
      console.log(`Job ID: ${job.id}`);
      console.log(`Job data:`, job.data);
      
      const { userId, content, type } = job.data;
      
      try {
        await job.updateProgress(25);
        console.log(`Analyzing content for user ${userId}, type: ${type}`);
        
        const analysis = await analyzeContent(content);
        
        await job.updateProgress(75);
        
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
        
        await job.updateProgress(100);
        console.log(`Content analysis completed for user ${userId}`);
        console.log(`=== CONTENT ANALYSIS JOB COMPLETED ===`);
        
        return { success: true, analysis };
      } catch (error) {
        console.error(`Content analysis failed for user ${userId}:`, error);
        console.log(`=== CONTENT ANALYSIS JOB FAILED ===`);
        throw error;
      }
    },
    {
      autorun: true,
      concurrency: 1,
    }
  );
  
  // Set up worker event listeners
  contentAnalysisWorker.on('completed', (job: Job<AnalyzeContentJob>, result: any) => {
    console.log(`Content analysis job ${job.id} completed successfully:`, result);
  });
  
  contentAnalysisWorker.on('failed', (job: Job<AnalyzeContentJob> | undefined, error: Error) => {
    console.error(`Content analysis job ${job?.id || 'unknown'} failed:`, error);
  });
  
  contentAnalysisWorker.on('progress', (job: Job<AnalyzeContentJob>, progress: number | object) => {
    console.log(`Content analysis job ${job.id} progress:`, progress);
  });
  
  contentAnalysisWorker.on('error', (error: Error) => {
    console.error('Content analysis worker error:', error);
  });
  
  contentAnalysisWorker.on('ready', () => {
    console.log('Content analysis worker is ready and listening for jobs');
  });
  
  console.log('Content analysis worker created successfully');
} else {
  console.log('Content analysis worker not created (no queue available)');
}

// Helper function to fetch URL content
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

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down workers...');
  if (urlProcessingWorker) await urlProcessingWorker.close();
  if (contentAnalysisWorker) await contentAnalysisWorker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Shutting down workers...');
  if (urlProcessingWorker) await urlProcessingWorker.close();
  if (contentAnalysisWorker) await contentAnalysisWorker.close();
  process.exit(0);
});

export { urlProcessingWorker, contentAnalysisWorker }; 