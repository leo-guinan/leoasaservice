import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

// Parse database URL to get connection details
function parseDatabaseUrl(): {
  url: string;
  ssl: boolean | { rejectUnauthorized: boolean };
} {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    url: process.env.DATABASE_URL,
    ssl: isProduction ? { rejectUnauthorized: false } : false,
  };
}

// Create PostgreSQL client with consistent configuration
export function createPostgresClient(): postgres.Sql {
  const config = parseDatabaseUrl();
  
  return postgres(config.url, {
    ssl: config.ssl,
    max: 10, // Connection pool size
    idle_timeout: 20, // Close idle connections after 20 seconds
    connect_timeout: 10, // Connection timeout
  });
}

// Create Drizzle database instance
export function createDatabase() {
  const client = createPostgresClient();
  return drizzle(client, { schema });
}

// Get database configuration for Drizzle Kit
export function getDrizzleConfig() {
  const config = parseDatabaseUrl();
  
  return {
    url: config.url,
    ssl: config.ssl,
  };
}

// Test database connection
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const client = createPostgresClient();
    await client`SELECT 1`;
    await client.end();
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

// Global database instance
let db: ReturnType<typeof drizzle> | null = null;
let client: postgres.Sql | null = null;

export function getDb() {
  if (!db) {
    client = createPostgresClient();
    db = drizzle(client, { schema });
  }
  return db;
}

export function getClient() {
  if (!client) {
    getDb(); // This will initialize the client
  }
  return client;
} 