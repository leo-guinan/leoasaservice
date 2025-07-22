import { storage } from './storage';
import OpenAI from 'openai';
import { Worker, Job } from 'bullmq';
import { createUrlProcessingQueue, createContentAnalysisQueue } from '@shared/queues';
import { ProcessUrlJob, AnalyzeContentJob, JOB_TYPES } from '@shared/jobs';
import { getBullRedisConfig } from '@shared/redis';
import { testDatabaseConnection } from '@shared/postgres';
import { mastra } from './mastra/index';

console.log('Worker module loaded. Initializing workers...');

// Test database connection
console.log('Testing database connection...');
testDatabaseConnection().then(success => {
  console.log('Database connection test result:', success);
}).catch(error => {
  console.error('Database connection test failed:', error);
});

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
        
        // Use Mastra URL processing workflow
        await job.updateProgress(20);
        console.log(`Starting Mastra URL processing workflow...`);
        const workflow = mastra.getWorkflow('urlProcessingWorkflow');
        
        await job.updateProgress(30);
        console.log(`Creating workflow run...`);
        const run = await workflow.createRunAsync();
        
        await job.updateProgress(40);
        console.log(`Starting URL processing with auto-detection...`);
        const result = await run.start({
          inputData: {
            urlId,
            userId,
            url,
            urlType: 'auto' // Let the workflow auto-determine if it's root or leaf
          },
        });
        
        await job.updateProgress(90);
        
        if (result.status === 'success') {
          console.log("✅ URL processing completed successfully");
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
          
          await job.updateProgress(100);
          console.log(`=== PROCESSING JOB COMPLETED ===`);
          
          return {
            success: true,
            urlType: result.result.urlType,
            contentLength: result.result.contentLength,
            analysis: result.result.analysis,
            rssFeeds: result.result.rssFeeds || [],
            discoveredPages: result.result.discoveredPages || [],
            message: result.result.message
          };
        } else if (result.status === 'failed') {
          console.error("❌ URL processing failed:", result.error?.message);
          throw new Error(`Workflow failed: ${result.error?.message || 'Unknown error'}`);
        } else {
          console.error("❌ URL processing suspended or in unexpected state:", result.status);
          throw new Error(`Workflow in unexpected state: ${result.status}`);
        }
      } catch (error) {
        console.error(`URL processing failed for ${url} (urlId: ${urlId}):`, error);
        console.log(`=== PROCESSING JOB FAILED ===`);
        throw error;
      }
    },
    {
      connection: getBullRedisConfig().redis,
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
  
  urlProcessingWorker.on('progress', (job: Job<ProcessUrlJob>, progress: any) => {
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
      connection: getBullRedisConfig().redis,
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
  
  contentAnalysisWorker.on('progress', (job: Job<AnalyzeContentJob>, progress: any) => {
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

// Helper function to analyze content with AI (used by content analysis worker)
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