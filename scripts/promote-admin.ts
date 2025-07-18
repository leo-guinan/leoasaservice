#!/usr/bin/env node

/**
 * Production script to promote a user to admin role
 * Usage: tsx scripts/promote-admin.js <userId>
 * Example: tsx scripts/promote-admin.js 2
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { users } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

async function promoteToAdmin(userId) {
  // Get database URL from environment
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  if (!userId || isNaN(userId)) {
    console.error('❌ Valid user ID is required');
    console.log('Usage: node scripts/promote-admin.js <userId>');
    console.log('Example: node scripts/promote-admin.js 2');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  const db = drizzle(pool);

  try {
    console.log(`🔍 Looking for user with ID: ${userId}`);
    
    // First, check if user exists
    const existingUser = await db.select().from(users).where(eq(users.id, parseInt(userId))).limit(1);
    
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

    // Update user role to admin
    const updatedUser = await db.update(users)
      .set({ role: 'admin' })
      .where(eq(users.id, parseInt(userId)))
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

  } catch (error) {
    console.error('❌ Error promoting user to admin:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Get user ID from command line arguments
const userId = process.argv[2];

if (!userId) {
  console.error('❌ User ID is required');
  console.log('Usage: node scripts/promote-admin.js <userId>');
  console.log('Example: node scripts/promote-admin.js 2');
  process.exit(1);
}

promoteToAdmin(userId); 