import Redis from 'ioredis';

// Parse Redis URL to get connection details
function parseRedisUrl(): {
  host: string;
  port: number;
  password: string;
  tls: any;
} {
  if (!process.env.REDIS_URL) {
    throw new Error('REDIS_URL environment variable is required');
  }

  const redisUrl = new URL(process.env.REDIS_URL);
  
  return {
    host: redisUrl.hostname,
    port: parseInt(redisUrl.port),
    password: redisUrl.password,
    tls: redisUrl.protocol === 'rediss:' ? {} : undefined,
  };
}

// Create Redis connection with consistent configuration
export function createRedisConnection(): Redis {
  const config = parseRedisUrl();
  
  return new Redis({
    ...config,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });
}

// Redis configuration for BullMQ queues
export function getBullRedisConfig() {
  const config = parseRedisUrl();
  
  return {
    redis: {
      ...config,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    },
    defaultJobOptions: {
      removeOnComplete: 10,
      removeOnFail: 5,
      attempts: 3,
      backoff: {
        type: 'exponential' as const,
        delay: 2000,
      },
    },
  };
}

// Test Redis connection
export async function testRedisConnection(): Promise<boolean> {
  try {
    const redis = createRedisConnection();
    await redis.ping();
    await redis.quit();
    return true;
  } catch (error) {
    console.error('Redis connection test failed:', error);
    return false;
  }
} 