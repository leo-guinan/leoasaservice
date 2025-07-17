import { storage } from './storage';
import OpenAI from 'openai';
import { createUrlProcessingQueue, createContentAnalysisQueue } from '@shared/queues';
import { ProcessUrlJob, AnalyzeContentJob, JOB_TYPES } from '@shared/jobs';

console.log('Worker module loaded. Initializing queues...');

// OpenAI client
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || "your-api-key-here" 
});

// Create queues using shared configuration
console.log("Creating queues with shared configuration...");
export const urlProcessingQueue = createUrlProcessingQueue();
export const contentAnalysisQueue = createContentAnalysisQueue();

console.log("Queues created - urlProcessingQueue:", urlProcessingQueue ? "created" : "null");
console.log("Queues created - contentAnalysisQueue:", contentAnalysisQueue ? "created" : "null");

if (urlProcessingQueue) {
  console.log('URL processing queue initialized.');
  console.log('Queue name:', urlProcessingQueue.name);
  console.log('Queue Redis client:', urlProcessingQueue.client ? 'connected' : 'not connected');
  
  // Test queue connection
  urlProcessingQueue.client.ping().then(() => {
    console.log('Queue Redis connection test successful');
  }).catch((error) => {
    console.error('Queue Redis connection test failed:', error);
  });
  
  urlProcessingQueue.on('waiting', (jobId) => {
    console.log('Job waiting in URL queue:', jobId);
  });
  urlProcessingQueue.on('active', (job, jobPromise) => {
    console.log('Job active in URL queue:', job.id);
  });
  urlProcessingQueue.on('completed', (job, result) => {
    console.log('Job completed in URL queue:', job.id);
  });
  urlProcessingQueue.on('failed', (job, err) => {
    console.error('Job failed in URL queue:', job.id, err);
  });
  urlProcessingQueue.on('ready', () => {
    console.log('URL processing queue is ready and listening for jobs');
  });
  urlProcessingQueue.on('stalled', (jobId) => {
    console.log('Job stalled in URL queue:', jobId);
  });
  
  // Check for existing jobs
  urlProcessingQueue.getWaiting().then((waitingJobs) => {
    return urlProcessingQueue!.getActive().then((activeJobs) => {
      console.log(`Found ${waitingJobs.length} waiting jobs and ${activeJobs.length} active jobs`);
      
      if (waitingJobs.length > 0) {
        console.log('Waiting jobs:', waitingJobs.map(job => ({ id: job.id, data: job.data })));
        
        // Note: Jobs are waiting but not being processed automatically
        console.log('Jobs are waiting but not being processed. This might indicate a queue configuration issue.');
      }
    });
  }).catch((error) => {
    console.error('Error checking existing jobs:', error);
  });
  
  // Set up processors for both job types (with and without explicit job type)
  urlProcessingQueue.process(JOB_TYPES.URL_PROCESSING, 1, async (job) => {
    console.log(`=== PROCESSING JOB STARTED (with type) ===`);
    console.log(`Job ID: ${job.id}`);
    console.log(`Job data:`, job.data);
    
    const { userId, urlId, url } = job.data;
    
    try {
      console.log(`Processing URL: ${url} for user ${userId}, urlId: ${urlId}`);
      
      // Fetch URL content using Jina for markdown conversion
      console.log(`Fetching content for URL: ${url}`);
      const content = await fetchUrlContent(url);
      
      // Save content to database
      console.log(`Saving content to database for urlId: ${urlId}`);
      const updatedUrl = await storage.updateUrlContent(urlId, userId, content);
      
      if (!updatedUrl) {
        throw new Error(`Failed to update URL content - URL not found or access denied`);
      }
      
      console.log(`Content saved successfully. Content length: ${content.length} characters`);
      
      // Analyze content with AI
      console.log(`Starting AI analysis for urlId: ${urlId}`);
      const analysis = await analyzeContent(content);
      
      // Store analysis results
      console.log(`Saving analysis to database for urlId: ${urlId}`);
      const urlWithAnalysis = await storage.updateUrlAnalysis(urlId, userId, analysis);
      
      if (!urlWithAnalysis) {
        throw new Error(`Failed to update URL analysis - URL not found or access denied`);
      }
      
      console.log(`URL processing completed successfully for ${url}`);
      console.log(`=== PROCESSING JOB COMPLETED ===`);
      return { success: true, content, analysis };
    } catch (error) {
      console.error(`URL processing failed for ${url} (urlId: ${urlId}):`, error);
      console.log(`=== PROCESSING JOB FAILED ===`);
      throw error;
    }
  });
  
  // Also set up a processor for jobs without explicit type (for backward compatibility)
  urlProcessingQueue.process(async (job) => {
    console.log(`=== PROCESSING JOB STARTED (without type) ===`);
    console.log(`Job ID: ${job.id}`);
    console.log(`Job data:`, job.data);
    
    const { userId, urlId, url } = job.data;
    
    try {
      console.log(`Processing URL: ${url} for user ${userId}, urlId: ${urlId}`);
      
      // Fetch URL content using Jina for markdown conversion
      console.log(`Fetching content for URL: ${url}`);
      const content = await fetchUrlContent(url);
      
      // Save content to database
      console.log(`Saving content to database for urlId: ${urlId}`);
      const updatedUrl = await storage.updateUrlContent(urlId, userId, content);
      
      if (!updatedUrl) {
        throw new Error(`Failed to update URL content - URL not found or access denied`);
      }
      
      console.log(`Content saved successfully. Content length: ${content.length} characters`);
      
      // Analyze content with AI
      console.log(`Starting AI analysis for urlId: ${urlId}`);
      const analysis = await analyzeContent(content);
      
      // Store analysis results
      console.log(`Saving analysis to database for urlId: ${urlId}`);
      const urlWithAnalysis = await storage.updateUrlAnalysis(urlId, userId, analysis);
      
      if (!urlWithAnalysis) {
        throw new Error(`Failed to update URL analysis - URL not found or access denied`);
      }
      
      console.log(`URL processing completed successfully for ${url}`);
      console.log(`=== PROCESSING JOB COMPLETED ===`);
      return { success: true, content, analysis };
    } catch (error) {
      console.error(`URL processing failed for ${url} (urlId: ${urlId}):`, error);
      console.log(`=== PROCESSING JOB FAILED ===`);
      throw error;
    }
  });
  
  console.log('URL processing worker registered successfully');
} else {
  console.log('URL processing queue not initialized (no Redis).');
}

if (contentAnalysisQueue) {
  console.log('Content analysis queue initialized.');
  contentAnalysisQueue.on('waiting', (jobId) => {
    console.log('Job waiting in content analysis queue:', jobId);
  });
  contentAnalysisQueue.on('active', (job, jobPromise) => {
    console.log('Job active in content analysis queue:', job.id);
  });
  contentAnalysisQueue.on('completed', (job, result) => {
    console.log('Job completed in content analysis queue:', job.id);
  });
  contentAnalysisQueue.on('failed', (job, err) => {
    console.error('Job failed in content analysis queue:', job.id, err);
  });
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
} else {
  console.log('Content analysis queue not initialized (no Redis).');
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
  process.exit(0);
}); 