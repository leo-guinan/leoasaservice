#!/usr/bin/env tsx

import 'dotenv/config';
import { getDb } from '../server/db';
import { userContexts } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function checkContexts() {
  console.log('🔍 Checking Context Dates');
  console.log('='.repeat(50));

  try {
    const db = getDb();
    const userId = 1;
    
    const contexts = await db
      .select()
      .from(userContexts)
      .where(eq(userContexts.userId, userId))
      .orderBy(userContexts.lastUpdated);
    
    console.log(`Found ${contexts.length} contexts for user ${userId}:`);
    console.log('');
    
    contexts.forEach((context, index) => {
      const date = context.lastUpdated.toISOString().split('T')[0];
      const time = context.lastUpdated.toISOString().split('T')[1].split('.')[0];
      console.log(`${index + 1}. Version ${context.version}: ${date} at ${time}`);
      console.log(`   Research Interests: ${context.context.researchInterests?.length || 0} items`);
      console.log(`   Current Projects: ${context.context.currentProjects?.length || 0} items`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error checking contexts:', error);
  }
}

checkContexts().catch(console.error); 