import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@shared/schema";

let db: ReturnType<typeof drizzle> | null = null;
let client: postgres.Sql | null = null;

export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required");
  }
  
  if (!db) {
    client = postgres(process.env.DATABASE_URL);
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