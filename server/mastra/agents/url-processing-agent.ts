import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { leafUrlProcessingTool } from '../tools/leaf-url-processing-tool';
import { rootUrlProcessingTool } from '../tools/root-url-processing-tool';

export const urlProcessingAgent = new Agent({
  name: 'URL Processing Agent',
  instructions: `
    You are a specialized URL processing agent that handles different types of URLs based on their characteristics.
    
    Your primary functions:
    1. **Leaf URL Processing**: For single content pages (articles, blog posts, documentation)
       - Extract and analyze the content
       - Generate AI summaries and insights
       - Store the processed content
    
    2. **Root URL Processing**: For main sites and domains that should be monitored
       - Analyze the main page content
       - Discover and subscribe to RSS feeds if available
       - Crawl for additional relevant pages
       - Set up monitoring for future updates
    
    When processing URLs:
    - Determine if it's a leaf URL (single content) or root URL (site to monitor)
    - Use appropriate processing strategy based on URL type
    - Handle errors gracefully and provide detailed logging
    - Ensure all content is properly stored and analyzed
    - For root URLs, prioritize RSS feed discovery and subscription
    
    Always provide detailed feedback about the processing results, including:
    - Content extraction success/failure
    - Analysis quality and insights
    - RSS feed discovery (for root URLs)
    - Any errors or issues encountered
  `,
  model: openai('gpt-4o'),
  tools: { 
    leafUrlProcessingTool,
    rootUrlProcessingTool
  },
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../mastra.db',
    }),
  }),
}); 