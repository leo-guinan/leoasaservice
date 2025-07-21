import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { getDb } from '../../db';
import { userContexts, users, userContextProfiles, userContextProfileData } from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';

export const chatAgent = new Agent({
  name: 'Research Chat Agent',
  instructions: `
    You are a helpful AI research assistant that helps users analyze their research materials, answer questions about their saved URLs, and assist with writing and research tasks.
    
    You have access to the user's research context, which includes their research interests, current projects, knowledge areas, recent insights, and research patterns. Use this context to provide more personalized and relevant responses.
    
    When responding:
    - Reference the user's research context when relevant
    - Connect new information to their existing research interests
    - Suggest follow-up research directions based on their patterns
    - Be concise but thorough in your responses
    - Help users make connections between different pieces of their research
    - Provide actionable insights and recommendations
  `,
  model: openai('gpt-4o'),
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../mastra.db',
    }),
  }),
});

// Function to get user's most recent context
export async function getUserContext(userId: number): Promise<any> {
  try {
    const db = getDb();
    
    // Check if user has pro mode enabled
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (user.length === 0) {
      return null;
    }

    if (user[0].proMode) {
      // For pro mode users, get context from active profile
      const activeProfile = await db
        .select()
        .from(userContextProfiles)
        .where(and(
          eq(userContextProfiles.userId, userId),
          eq(userContextProfiles.isActive, true)
        ))
        .limit(1);

      if (activeProfile.length === 0) {
        return null;
      }

      const latestProfileContext = await db
        .select()
        .from(userContextProfileData)
        .where(eq(userContextProfileData.profileId, activeProfile[0].id))
        .orderBy(desc(userContextProfileData.version))
        .limit(1);

      if (latestProfileContext.length === 0) {
        return null;
      }

      return latestProfileContext[0].context;
    } else {
      // For regular users, get context from the main userContexts table
      const latestContext = await db
        .select()
        .from(userContexts)
        .where(eq(userContexts.userId, userId))
        .orderBy(desc(userContexts.version))
        .limit(1);

      if (latestContext.length === 0) {
        return null;
      }

      return latestContext[0].context;
    }
  } catch (error) {
    console.error('Error fetching user context:', error);
    return null;
  }
}

// Function to create a context-aware system prompt
export function createContextAwarePrompt(userContext: any): string {
  if (!userContext) {
    return `You are a helpful AI research assistant. Help users analyze their research materials, answer questions about their saved URLs, and assist with writing and research tasks. Be concise but thorough in your responses.

**Format your responses using markdown** to improve readability:
- Use **bold** for emphasis and key points
- Use bullet points (•) for lists
- Use headings (##) for sections
- Use \`code\` for technical terms
- Use blockquotes (>) for important notes
- Structure complex responses with clear sections`;
  }

  const {
    researchInterests = [],
    currentProjects = [],
    knowledgeAreas = [],
    recentInsights = [],
    researchPatterns = [],
    lastUpdated = null
  } = userContext;

  return `You are a helpful AI research assistant that helps users analyze their research materials, answer questions about their saved URLs, and assist with writing and research tasks.

USER'S RESEARCH CONTEXT:
- **Research Interests**: ${researchInterests.length > 0 ? researchInterests.join(', ') : 'Not specified'}
- **Current Projects**: ${currentProjects.length > 0 ? currentProjects.join(', ') : 'Not specified'}
- **Knowledge Areas**: ${knowledgeAreas.length > 0 ? knowledgeAreas.join(', ') : 'Not specified'}
- **Recent Insights**: ${recentInsights.length > 0 ? recentInsights.join(', ') : 'Not specified'}
- **Research Patterns**: ${researchPatterns.length > 0 ? researchPatterns.join(', ') : 'Not specified'}
- **Context Last Updated**: ${lastUpdated || 'Unknown'}

When responding:
- Reference the user's research context when relevant to their questions
- Connect new information to their existing research interests and projects
- Suggest follow-up research directions based on their patterns and interests
- Help them make connections between different pieces of their research
- Provide actionable insights and recommendations tailored to their research focus
- Be concise but thorough in your responses
- If they ask about topics outside their current research scope, help them explore how it might relate to their existing interests

**Format your responses using markdown** to improve readability:
- Use **bold** for emphasis and key points
- Use bullet points (•) for lists
- Use headings (##) for sections
- Use \`code\` for technical terms
- Use blockquotes (>) for important notes
- Structure complex responses with clear sections

Use this context to provide more personalized and relevant responses that build upon their existing research trajectory.`;
} 