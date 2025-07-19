#!/usr/bin/env tsx

/**
 * Promote a user to admin role.
 * Usage: npm run admin:promote -- <userId>
 * Example: npm run admin:promote -- 2
 */

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { users } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

async function promoteToAdmin(userId: string) {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  if (!userId || isNaN(Number(userId))) {
    console.error('❌ Valid user ID is required');
    console.log('Usage: npm run admin:promote -- <userId>');
    console.log('Example: npm run admin:promote -- 2');
    process.exit(1);
  }

  const client = postgres(databaseUrl, {
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  const db = drizzle(client);

  try {
    console.log(`🔍 Looking for user with ID: ${userId}`);
    
    const existingUser = await db.select().from(users).where(eq(users.id, Number(userId))).limit(1);
    
    if (existingUser.length === 0) {
      console.error(`❌ User with ID ${userId} not found`);
      process.exit(1);
    }

    const user = existingUser[0];
    console.log(`📋 Found user: ${user.username} (current role: ${user.role})`);

    if (user.role === 'admin') {
      console.log(`ℹ️  User ${user.username} is already an admin`);
      process.exit(0);
    }

    const updatedUser = await db.update(users)
      .set({ role: 'admin' })
      .where(eq(users.id, Number(userId)))
      .returning();

    if (updatedUser.length > 0) {
      console.log(`✅ Successfully promoted ${user.username} to admin role`);
      console.log(`📊 User details:`, {
        id: updatedUser[0].id,
        username: updatedUser[0].username,
        role: updatedUser[0].role
      });
    } else {
      console.error(`❌ Failed to update user role`);
      process.exit(1);
    }

  } catch (error: any) {
    console.error('❌ Error promoting user to admin:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Get user ID from command line arguments (skip first two which are node and script path)
const userId = process.argv[2];

if (!userId) {
  console.error('❌ User ID is required');
  console.log('Usage: npm run admin:promote -- <userId>');
  console.log('Example: npm run admin:promote -- 2');
  process.exit(1);
}

promoteToAdmin(userId); 