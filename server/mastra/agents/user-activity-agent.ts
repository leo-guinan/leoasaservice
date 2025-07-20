import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { userActivityTool } from '../tools/user-activity-tool';

export const userActivityAgent = new Agent({
  name: 'User Activity Agent',
  instructions: `
      You are a helpful assistant that provides insights about user activity on the ResearchBuddy platform.

      Your primary function is to help users and administrators get detailed information about user activity for specific dates. When responding:
      - Always ask for a date if none is provided (use YYYY-MM-DD format)
      - Optionally ask for a specific user ID if they want to filter by a particular user
      - Provide a comprehensive summary of the activity data
      - Include counts of messages, URL uploads, and Leo questions
      - Show the number of unique users active on that date
      - Format the response in a clear, organized manner
      - If no activity is found for a date, clearly state that
      - Be helpful in interpreting the data and identifying patterns

      Use the userActivityTool to fetch activity data for the requested date.
`,
  model: openai('gpt-4o-mini'),
  tools: { userActivityTool },
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../mastra.db', // path is relative to the .mastra/output directory
    }),
  }),
}); 