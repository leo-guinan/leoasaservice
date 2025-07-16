#!/usr/bin/env node

import postgres from 'postgres';

async function checkDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  console.log('Checking database state...');
  console.log('Database URL:', databaseUrl.replace(/:[^:@]*@/, ':****@')); // Hide password

  try {
    const sql = postgres(databaseUrl, {
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    // Check if tables exist
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'urls', 'chat_messages', 'leo_questions')
      ORDER BY table_name
    `;
    
    console.log('Existing tables:', tables.map(t => t.table_name));
    
    if (tables.length === 0) {
      console.log('❌ No tables found! Running migrations...');
      
      // Run the migration manually
      const migrationSQL = `
        CREATE TABLE "chat_messages" (
          "id" serial PRIMARY KEY NOT NULL,
          "user_id" integer NOT NULL,
          "content" text NOT NULL,
          "role" text NOT NULL,
          "created_at" timestamp DEFAULT now() NOT NULL
        );
        
        CREATE TABLE "leo_questions" (
          "id" serial PRIMARY KEY NOT NULL,
          "user_id" integer NOT NULL,
          "question" text NOT NULL,
          "status" text DEFAULT 'pending' NOT NULL,
          "answer" text,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "answered_at" timestamp
        );
        
        CREATE TABLE "urls" (
          "id" serial PRIMARY KEY NOT NULL,
          "user_id" integer NOT NULL,
          "url" text NOT NULL,
          "title" text,
          "notes" text,
          "analysis" jsonb,
          "created_at" timestamp DEFAULT now() NOT NULL
        );
        
        CREATE TABLE "users" (
          "id" serial PRIMARY KEY NOT NULL,
          "username" text NOT NULL,
          "password" text NOT NULL,
          CONSTRAINT "users_username_unique" UNIQUE("username")
        );
      `;
      
      await sql.unsafe(migrationSQL);
      console.log('✅ Tables created successfully!');
    } else if (tables.length < 4) {
      console.log('⚠️  Some tables are missing. You may need to run migrations.');
    } else {
      console.log('✅ All tables exist!');
    }
    
    await sql.end();
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
    process.exit(1);
  }
}

checkDatabase(); 