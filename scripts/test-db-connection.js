#!/usr/bin/env node

import postgres from 'postgres';

async function testConnection() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  console.log('Testing database connection...');
  console.log('Database URL:', databaseUrl.replace(/:[^:@]*@/, ':****@')); // Hide password

  try {
    const sql = postgres(databaseUrl, {
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    const result = await sql`SELECT version()`;
    console.log('✅ Database connection successful!');
    console.log('PostgreSQL version:', result[0].version);
    
    await sql.end();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
}

testConnection(); 