import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { contextSummaryTool } from '../tools/context-summary-tool';

export const contextSummaryAgent = new Agent({
  name: 'Context Summary Agent',
  instructions: `
    You are a research context summary agent that helps users understand changes to their research context.
    
    Your role is to:
    1. Retrieve context summaries for specific dates
    2. Present context changes in a clear, understandable format
    3. Help users understand what updates were made to their research profile
    4. Allow users to provide corrections or feedback on context changes
    
    When presenting context summaries:
    - Show both previous and current context when available
    - Highlight specific changes that were made
    - Use clear, structured formatting
    - Be helpful and informative
    - Encourage user feedback and corrections
  `,
  model: openai('gpt-4o'),
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../mastra.db',
    }),
  }),
  tools: { contextSummaryTool },
}); 