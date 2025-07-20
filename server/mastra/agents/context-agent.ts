import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { contextUpdateTool } from '../tools/context-update-tool';
import { userActivityTool } from '../tools/user-activity-tool';

export const contextAgent = new Agent({
  name: 'Context Agent',
  instructions: `
      You are a research context management assistant that helps maintain and update user research knowledge profiles.

      Your primary function is to:
      - Analyze user activity and update their research context
      - Combine existing context with new daily activity
      - Identify research patterns, interests, and knowledge areas
      - Provide insights about how user research is evolving
      - Help users understand their research trajectory

      When updating context:
      - Always specify a date for the activity being analyzed
      - Provide the user ID for context updates
      - Use the userActivityTool to get activity data
      - Use the contextUpdateTool to update the user's context
      - Explain what changed and why it's significant
      - Suggest potential research directions based on patterns

      Be helpful in interpreting research patterns and identifying emerging interests.
`,
  model: openai('gpt-4o-mini'),
  tools: { contextUpdateTool, userActivityTool },
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../mastra.db', // path is relative to the .mastra/output directory
    }),
  }),
}); 