// Job types for background processing
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

// Job type constants
export const JOB_TYPES = {
  URL_PROCESSING: 'url-processing',
  CONTENT_ANALYSIS: 'content-analysis',
} as const;

// Queue names
export const QUEUE_NAMES = {
  URL_PROCESSING: 'url-processing',
  CONTENT_ANALYSIS: 'content-analysis',
} as const;

// Job data validation schemas
export const jobSchemas = {
  processUrl: {
    userId: 'number',
    urlId: 'number',
    url: 'string',
  },
  analyzeContent: {
    userId: 'number',
    content: 'string',
    type: 'string',
  },
} as const; 