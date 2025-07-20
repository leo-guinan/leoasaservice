import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getDb } from '../../db';
import { userContexts, type UserContext } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || "your-api-key-here" 
});

export const contextUpdateTool = createTool({
  id: 'update-user-context',
  description: 'Combine existing user context with new daily activity to create an updated context',
  inputSchema: z.object({
    userId: z.number().describe('User ID to update context for'),
    date: z.string().describe('Date of new activity in YYYY-MM-DD format'),
    newActivitySummary: z.object({
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
    }).describe('Summary of new activity for the day'),
  }),
  outputSchema: z.object({
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
  }),
  execute: async ({ context }) => {
    return await updateUserContext(context.userId, context.date, context.newActivitySummary);
  },
});

const updateUserContext = async (
  userId: number, 
  date: string, 
  newActivitySummary: any
) => {
  const db = getDb();
  
  // Get existing context
  const existingContext = await db
    .select()
    .from(userContexts)
    .where(eq(userContexts.userId, userId))
    .orderBy(desc(userContexts.version))
    .limit(1);
  
  const currentContext = existingContext[0]?.context || {
    researchInterests: [],
    currentProjects: [],
    knowledgeAreas: [],
    recentInsights: [],
    researchPatterns: [],
  };
  
  // Prepare context update prompt
  const contextUpdatePrompt = `
You are an AI assistant that analyzes user research activity and maintains a comprehensive context of their knowledge, interests, and research patterns.

EXISTING USER CONTEXT:
${JSON.stringify(currentContext, null, 2)}

NEW ACTIVITY FOR ${date}:
${JSON.stringify(newActivitySummary, null, 2)}

Your task is to update the user's context by:
1. Analyzing the new activity for insights, interests, and patterns
2. Integrating new information with existing context
3. Identifying emerging research themes and knowledge areas
4. Updating research interests and current projects
5. Adding recent insights from the new activity
6. Maintaining a coherent and organized context structure

Return ONLY a JSON object with the updated context structure:
{
  "researchInterests": ["interest1", "interest2", ...],
  "currentProjects": ["project1", "project2", ...],
  "knowledgeAreas": ["area1", "area2", ...],
  "recentInsights": ["insight1", "insight2", ...],
  "researchPatterns": ["pattern1", "pattern2", ...]
}

Guidelines:
- Keep arrays concise (max 5-8 items each)
- Focus on the most significant and recurring themes
- Remove outdated or less relevant information
- Ensure insights are specific and actionable
- Maintain consistency with existing context
- Identify new research directions or shifts in focus
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a research context analyzer. Return only valid JSON."
        },
        {
          role: "user",
          content: contextUpdatePrompt
        }
      ],
      temperature: 0.3,
    });

    const aiResponse = response.choices[0].message.content;
    if (!aiResponse) {
      throw new Error('No response from AI');
    }

    // Parse the AI response
    const updatedContextData = JSON.parse(aiResponse);
    
    // Check if context actually changed
    const contextChanged = JSON.stringify(currentContext) !== JSON.stringify(updatedContextData);
    
    if (contextChanged) {
      // Save updated context
      const newVersion = (existingContext[0]?.version || 0) + 1;
      await db.insert(userContexts).values({
        userId,
        context: updatedContextData,
        version: newVersion,
      });
      
      updatedContextData.lastUpdated = new Date().toISOString();
      updatedContextData.version = newVersion;
    } else {
      updatedContextData.lastUpdated = existingContext[0]?.lastUpdated.toISOString() || new Date().toISOString();
      updatedContextData.version = existingContext[0]?.version || 1;
    }

    // Generate summary of changes
    const summaryPrompt = `
Summarize the key changes made to the user's research context based on their activity on ${date}.

EXISTING CONTEXT:
${JSON.stringify(currentContext, null, 2)}

UPDATED CONTEXT:
${JSON.stringify(updatedContextData, null, 2)}

Provide a brief, natural language summary of what changed and what new insights were gained.
`;

    const summaryResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: summaryPrompt
        }
      ],
      temperature: 0.7,
    });

    const summary = summaryResponse.choices[0].message.content || 'Context updated with new activity insights.';

    return {
      userId,
      updatedContext: updatedContextData,
      contextChanged,
      summary,
    };
  } catch (error) {
    console.error('Context update failed:', error);
    throw new Error(`Failed to update user context: ${error}`);
  }
}; 