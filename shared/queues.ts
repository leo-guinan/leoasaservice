import { Queue } from 'bullmq';
import { getBullRedisConfig } from './redis';
import { ProcessUrlJob, AnalyzeContentJob, JOB_TYPES, QUEUE_NAMES } from './jobs';

// Create URL processing queue
export function createUrlProcessingQueue(): Queue<ProcessUrlJob> | null {
  if (!process.env.REDIS_URL) {
    console.log('Redis not configured, URL processing queue not created');
    return null;
  }

  console.log('Creating URL processing queue with shared configuration');
  
  const config = getBullRedisConfig();
  const queue = new Queue<ProcessUrlJob>(QUEUE_NAMES.URL_PROCESSING, {
    connection: config.redis,
    defaultJobOptions: config.defaultJobOptions,
  });
  
  return queue;
}

// Create content analysis queue
export function createContentAnalysisQueue(): Queue<AnalyzeContentJob> | null {
  if (!process.env.REDIS_URL) {
    console.log('Redis not configured, content analysis queue not created');
    return null;
  }

  console.log('Creating content analysis queue with shared configuration');
  
  const config = getBullRedisConfig();
  const queue = new Queue<AnalyzeContentJob>(QUEUE_NAMES.CONTENT_ANALYSIS, {
    connection: config.redis,
    defaultJobOptions: config.defaultJobOptions,
  });
  
  return queue;
}

// Helper function to add URL processing job
export async function addUrlProcessingJob(
  queue: Queue<ProcessUrlJob>,
  data: ProcessUrlJob
): Promise<any> {
  return queue.add(JOB_TYPES.URL_PROCESSING, data);
}

// Helper function to add content analysis job
export async function addContentAnalysisJob(
  queue: Queue<AnalyzeContentJob>,
  data: AnalyzeContentJob
): Promise<any> {
  return queue.add(JOB_TYPES.CONTENT_ANALYSIS, data);
} 