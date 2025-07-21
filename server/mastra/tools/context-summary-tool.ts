import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getDb } from '../../db';
import { userContexts } from '@shared/schema';
import { eq, desc, and, gte, lt } from 'drizzle-orm';

export const contextSummaryTool = createTool({
  id: 'get-context-summary',
  description: 'Get a summary of user context changes for a specific date',
  inputSchema: z.object({
    userId: z.number().describe('User ID'),
    date: z.string().describe('Date in YYYY-MM-DD format'),
  }),
  outputSchema: z.object({
    userId: z.number(),
    date: z.string(),
    hasPreviousContext: z.boolean(),
    hasCurrentContext: z.boolean(),
    previousContext: z.any().optional(),
    currentContext: z.any().optional(),
    summary: z.string(),
    changes: z.array(z.string()),
  }),
  execute: async ({ context }) => {
    const { userId, date } = context;
    
    try {
      const db = getDb();
      
      // Get all contexts for this user, ordered by version
      const allContexts = await db
        .select()
        .from(userContexts)
        .where(eq(userContexts.userId, userId))
        .orderBy(desc(userContexts.version));

      // For now, we'll show the most recent context as "current" 
      // and the previous version as "previous" to demonstrate the feature
      const currentContext = allContexts.slice(0, 1); // Most recent
      const previousContext = allContexts.slice(1, 2); // Second most recent

      const hasPreviousContext = previousContext.length > 0;
      const hasCurrentContext = currentContext.length > 0;

      let summary = '';
      const changes: string[] = [];

      if (!hasPreviousContext && !hasCurrentContext) {
        summary = `No context data found. This might be the first day of activity or no context updates were made.`;
      } else if (!hasPreviousContext && hasCurrentContext) {
        summary = `**New Research Context Created**\n\nYour research context was initialized based on your recent activity.`;
        changes.push('Initial context creation');
      } else if (hasPreviousContext && !hasCurrentContext) {
        summary = `**No Context Updates**\n\nNo changes were made to your research context. Your previous context remains current.`;
      } else {
        // Both contexts exist - compare them
        const prev = previousContext[0].context as any;
        const curr = currentContext[0].context as any;
        
        summary = `**Research Context Update Summary**\n\nYour research context has been updated. Here are the changes from version ${previousContext[0].version} to version ${currentContext[0].version}:`;
        
        // Compare research interests
        const prevInterests = prev.researchInterests || [];
        const currInterests = curr.researchInterests || [];
        if (JSON.stringify(prevInterests) !== JSON.stringify(currInterests)) {
          changes.push(`**Research Interests**: ${prevInterests.length} → ${currInterests.length} items`);
        }
        
        // Compare current projects
        const prevProjects = prev.currentProjects || [];
        const currProjects = curr.currentProjects || [];
        if (JSON.stringify(prevProjects) !== JSON.stringify(currProjects)) {
          changes.push(`**Current Projects**: ${prevProjects.length} → ${currProjects.length} items`);
        }
        
        // Compare knowledge areas
        const prevKnowledge = prev.knowledgeAreas || [];
        const currKnowledge = curr.knowledgeAreas || [];
        if (JSON.stringify(prevKnowledge) !== JSON.stringify(currKnowledge)) {
          changes.push(`**Knowledge Areas**: ${prevKnowledge.length} → ${currKnowledge.length} items`);
        }
        
        // Compare recent insights
        const prevInsights = prev.recentInsights || [];
        const currInsights = curr.recentInsights || [];
        if (JSON.stringify(prevInsights) !== JSON.stringify(currInsights)) {
          changes.push(`**Recent Insights**: ${prevInsights.length} → ${currInsights.length} items`);
        }
        
        // Compare research patterns
        const prevPatterns = prev.researchPatterns || [];
        const currPatterns = curr.researchPatterns || [];
        if (JSON.stringify(prevPatterns) !== JSON.stringify(currPatterns)) {
          changes.push(`**Research Patterns**: ${prevPatterns.length} → ${currPatterns.length} items`);
        }
        
        if (changes.length === 0) {
          changes.push('Minor updates or refinements to existing context');
        }
      }

      return {
        userId,
        date,
        hasPreviousContext,
        hasCurrentContext,
        previousContext: hasPreviousContext ? previousContext[0].context : undefined,
        currentContext: hasCurrentContext ? currentContext[0].context : undefined,
        summary,
        changes,
      };
    } catch (error) {
      console.error('Error generating context summary:', error);
      throw new Error(`Failed to generate context summary: ${error}`);
    }
  },
}); 