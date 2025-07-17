import Queue from 'bull';
import { getBullRedisConfig } from './redis';
import { ProcessUrlJob, AnalyzeContentJob, JOB_TYPES, QUEUE_NAMES } from './jobs';

// Create URL processing queue
export function createUrlProcessingQueue(): Queue.Queue<ProcessUrlJob> | null {
  if (!process.env.REDIS_URL) {
    console.log('Redis not configured, URL processing queue not created');
    return null;
  }

  console.log('Creating URL processing queue with shared configuration');
  
  const queue = new Queue<ProcessUrlJob>(QUEUE_NAMES.URL_PROCESSING, getBullRedisConfig());
  
  // Set up queue event listeners
  queue.on('error', (error) => {
    console.error('URL processing queue error:', error);
  });
  
  queue.on('waiting', (jobId) => {
    console.log('Job waiting in URL queue:', jobId);
  });
  
  queue.on('active', (job) => {
    console.log('Job active in URL queue:', job.id);
  });
  
  queue.on('completed', (job, result) => {
    console.log('Job completed in URL queue:', job.id);
  });
  
  queue.on('failed', (job, err) => {
    console.error('Job failed in URL queue:', job.id, err);
  });
  
  queue.on('ready', () => {
    console.log('URL processing queue is ready');
  });
  
  queue.on('stalled', (jobId) => {
    console.log('Job stalled in URL queue:', jobId);
  });
  
  return queue;
}

// Create content analysis queue
export function createContentAnalysisQueue(): Queue.Queue<AnalyzeContentJob> | null {
  if (!process.env.REDIS_URL) {
    console.log('Redis not configured, content analysis queue not created');
    return null;
  }

  console.log('Creating content analysis queue with shared configuration');
  
  const queue = new Queue<AnalyzeContentJob>(QUEUE_NAMES.CONTENT_ANALYSIS, getBullRedisConfig());
  
  // Set up queue event listeners
  queue.on('error', (error) => {
    console.error('Content analysis queue error:', error);
  });
  
  queue.on('waiting', (jobId) => {
    console.log('Job waiting in content analysis queue:', jobId);
  });
  
  queue.on('active', (job) => {
    console.log('Job active in content analysis queue:', job.id);
  });
  
  queue.on('completed', (job, result) => {
    console.log('Job completed in content analysis queue:', job.id);
  });
  
  queue.on('failed', (job, err) => {
    console.error('Job failed in content analysis queue:', job.id, err);
  });
  
  queue.on('ready', () => {
    console.log('Content analysis queue is ready');
  });
  
  queue.on('stalled', (jobId) => {
    console.log('Job stalled in content analysis queue:', jobId);
  });
  
  return queue;
}

// Helper function to add URL processing job
export async function addUrlProcessingJob(
  queue: Queue.Queue<ProcessUrlJob>,
  data: ProcessUrlJob
): Promise<Queue.Job<ProcessUrlJob>> {
  return queue.add(JOB_TYPES.URL_PROCESSING, data);
}

// Helper function to add content analysis job
export async function addContentAnalysisJob(
  queue: Queue.Queue<AnalyzeContentJob>,
  data: AnalyzeContentJob
): Promise<Queue.Job<AnalyzeContentJob>> {
  return queue.add(JOB_TYPES.CONTENT_ANALYSIS, data);
} 