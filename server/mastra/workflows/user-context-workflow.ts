import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { getDb } from '../../db';
import { users } from '@shared/schema';
import { userActivityTool } from '../tools/user-activity-tool';
import { contextUpdateTool } from '../tools/context-update-tool';

const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  role: z.string(),
});

const userActivitySchema = z.object({
  userId: z.number(),
  date: z.string(),
  chatMessages: z.array(z.object({
    content: z.string(),
    role: z.string(),
  })),
  urlUploads: z.array(z.object({
    url: z.string(),
    title: z.string().nullable(),
    notes: z.string().nullable(),
  })),
  leoQuestions: z.array(z.object({
    question: z.string(),
    answer: z.string().nullable(),
  })),
  summary: z.object({
    totalMessages: z.number(),
    totalUploads: z.number(),
    totalQuestions: z.number(),
  }),
});

const contextUpdateSchema = z.object({
  userId: z.number(),
  updatedContext: z.object({
    researchInterests: z.array(z.string()),
    currentProjects: z.array(z.string()),
    knowledgeAreas: z.array(z.string()),
    recentInsights: z.array(z.string()),
    researchPatterns: z.array(z.string()),
    lastUpdated: z.string(),
    version: z.number(),
  }),
  contextChanged: z.boolean(),
  summary: z.string(),
});

const workflowResultSchema = z.object({
  processedUsers: z.number(),
  updatedContexts: z.number(),
  errors: z.array(z.object({
    userId: z.number(),
    username: z.string(),
    error: z.string(),
  })),
  summary: z.string(),
});

// Step 1: Get all users from database
const fetchAllUsers = createStep({
  id: 'fetch-all-users',
  description: 'Fetches all users from the database',
  inputSchema: z.object({
    date: z.string().describe('Date to process activity for (YYYY-MM-DD)'),
  }),
  outputSchema: z.object({
    users: z.array(userSchema),
    date: z.string(),
  }),
  execute: async ({ inputData }) => {
    if (!inputData) {
      throw new Error('Input data not found');
    }

    const db = getDb();
    const allUsers = await db.select().from(users);
    
    console.log(`Found ${allUsers.length} users to process for date: ${inputData.date}`);
    
    return {
      users: allUsers,
      date: inputData.date,
    };
  },
});

// Step 2: Process each user's activity and update context
const processUserContext = createStep({
  id: 'process-user-context',
  description: 'Processes each user and updates their context',
  inputSchema: z.object({
    users: z.array(userSchema),
    date: z.string(),
  }),
  outputSchema: workflowResultSchema,
  execute: async ({ inputData, mastra }) => {
    if (!inputData) {
      throw new Error('Input data not found');
    }

    const { users: allUsers, date } = inputData;
    const results = {
      processedUsers: 0,
      updatedContexts: 0,
      errors: [] as Array<{ userId: number; username: string; error: string }>,
      summary: '',
    };

    console.log(`\n🚀 Starting context update for ${allUsers.length} users on ${date}`);
    console.log('=' .repeat(60));

    for (const user of allUsers) {
      try {
        console.log(`\n📊 Processing user: ${user.username} (ID: ${user.id})`);
        
        // Get user activity for the date
        const activityResult = await userActivityTool.execute({
          context: {
            date,
            userId: user.id,
          },
        } as any);

        // Check if user has any activity for this date
        if (activityResult.summary.totalMessages === 0 && 
            activityResult.summary.totalUploads === 0 && 
            activityResult.summary.totalQuestions === 0) {
          console.log(`  ⏭️  No activity found for ${date}, skipping...`);
          results.processedUsers++;
          continue;
        }

        console.log(`  📈 Activity found: ${activityResult.summary.totalMessages} messages, ${activityResult.summary.totalUploads} uploads, ${activityResult.summary.totalQuestions} questions`);

        // Update user context
        const contextResult = await contextUpdateTool.execute({
          context: {
            userId: user.id,
            date,
            newActivitySummary: {
              chatMessages: activityResult.chatMessages.map((m: any) => ({
                content: m.content,
                role: m.role,
              })),
              urlUploads: activityResult.urlUploads.map((u: any) => ({
                url: u.url,
                title: u.title,
                notes: u.notes,
              })),
              leoQuestions: activityResult.leoQuestions.map((q: any) => ({
                question: q.question,
                answer: q.answer,
              })),
              summary: activityResult.summary,
            },
          },
        } as any);

        if (contextResult.contextChanged) {
          console.log(`  ✅ Context updated (v${contextResult.updatedContext.version}): ${contextResult.summary}`);
          results.updatedContexts++;
        } else {
          console.log(`  ℹ️  Context unchanged: ${contextResult.summary}`);
        }

        results.processedUsers++;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`  ❌ Error processing user ${user.username}: ${errorMessage}`);
        results.errors.push({
          userId: user.id,
          username: user.username,
          error: errorMessage,
        });
        results.processedUsers++;
      }
    }

    // Generate summary
    const successRate = ((results.processedUsers - results.errors.length) / results.processedUsers * 100).toFixed(1);
    results.summary = `Processed ${results.processedUsers} users, updated ${results.updatedContexts} contexts, ${results.errors.length} errors (${successRate}% success rate)`;

    console.log('\n' + '=' .repeat(60));
    console.log(`🎯 Workflow completed: ${results.summary}`);
    if (results.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      results.errors.forEach(error => {
        console.log(`  - ${error.username} (ID: ${error.userId}): ${error.error}`);
      });
    }

    return results;
  },
});

// Create the workflow
const userContextWorkflow = createWorkflow({
  id: 'user-context-workflow',
  inputSchema: z.object({
    date: z.string().describe('Date to process activity for (YYYY-MM-DD format)'),
  }),
  outputSchema: workflowResultSchema,
})
  .then(fetchAllUsers)
  .then(processUserContext);

userContextWorkflow.commit();

export { userContextWorkflow }; 