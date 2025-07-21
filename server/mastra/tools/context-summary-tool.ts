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
        
        summary = `**Research Context Updated**\n\nBased on your recent activity, I've updated your research profile:`;
        
        // Compare research interests
        const prevInterests = prev.researchInterests || [];
        const currInterests = curr.researchInterests || [];
        if (JSON.stringify(prevInterests) !== JSON.stringify(currInterests)) {
          const newInterests = currInterests.filter((interest: string) => !prevInterests.includes(interest));
          const removedInterests = prevInterests.filter((interest: string) => !currInterests.includes(interest));
          
          if (newInterests.length > 0) {
            changes.push(`**Added research interests**: ${newInterests.join(', ')}`);
          }
          if (removedInterests.length > 0) {
            changes.push(`**Removed research interests**: ${removedInterests.join(', ')}`);
          }
        }
        
        // Compare current projects
        const prevProjects = prev.currentProjects || [];
        const currProjects = curr.currentProjects || [];
        if (JSON.stringify(prevProjects) !== JSON.stringify(currProjects)) {
          const newProjects = currProjects.filter((project: string) => !prevProjects.includes(project));
          const removedProjects = prevProjects.filter((project: string) => !currProjects.includes(project));
          
          if (newProjects.length > 0) {
            changes.push(`**Started new projects**: ${newProjects.join(', ')}`);
          }
          if (removedProjects.length > 0) {
            changes.push(`**Completed projects**: ${removedProjects.join(', ')}`);
          }
        }
        
        // Compare knowledge areas
        const prevKnowledge = prev.knowledgeAreas || [];
        const currKnowledge = curr.knowledgeAreas || [];
        if (JSON.stringify(prevKnowledge) !== JSON.stringify(currKnowledge)) {
          const newKnowledge = currKnowledge.filter((area: string) => !prevKnowledge.includes(area));
          if (newKnowledge.length > 0) {
            changes.push(`**Expanded knowledge in**: ${newKnowledge.join(', ')}`);
          }
        }
        
        // Compare recent insights
        const prevInsights = prev.recentInsights || [];
        const currInsights = curr.recentInsights || [];
        if (JSON.stringify(prevInsights) !== JSON.stringify(currInsights)) {
          const newInsights = currInsights.filter((insight: string) => !prevInsights.includes(insight));
          if (newInsights.length > 0) {
            changes.push(`**New insights**: ${newInsights.slice(0, 2).join('; ')}${newInsights.length > 2 ? '...' : ''}`);
          }
        }
        
        // Compare research patterns
        const prevPatterns = prev.researchPatterns || [];
        const currPatterns = curr.researchPatterns || [];
        if (JSON.stringify(prevPatterns) !== JSON.stringify(currPatterns)) {
          const newPatterns = currPatterns.filter((pattern: string) => !prevPatterns.includes(pattern));
          if (newPatterns.length > 0) {
            changes.push(`**New research patterns**: ${newPatterns.join(', ')}`);
          }
        }
        
        if (changes.length === 0) {
          changes.push('Minor refinements to your research profile');
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