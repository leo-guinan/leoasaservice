import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { storage } from '../../storage';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || "your-api-key-here" 
});

export const leafUrlProcessingTool = createTool({
  id: 'process-leaf-url',
  description: 'Process a single content page (leaf URL) by extracting content, analyzing it, and storing results',
  inputSchema: z.object({
    urlId: z.number().describe('Database ID of the URL to process'),
    userId: z.number().describe('User ID who owns the URL'),
    url: z.string().describe('The URL to process'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    contentLength: z.number(),
    analysis: z.object({
      summary: z.string(),
      timestamp: z.string(),
      model: z.string(),
    }),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    return await processLeafUrl(context.urlId, context.userId, context.url);
  },
});

// Helper function to fetch URL content using Jina
async function fetchUrlContent(url: string): Promise<string> {
  try {
    // Ensure URL is properly encoded for Jina
    const encodedUrl = encodeURIComponent(url);
    const jinaUrl = `https://r.jina.ai/${encodedUrl}`;
    
    console.log(`Fetching content from Jina: ${jinaUrl}`);
    
    const response = await fetch(jinaUrl);
    
    if (!response.ok) {
      throw new Error(`Jina API returned ${response.status}: ${response.statusText}`);
    }
    
    const markdown = await response.text();
    
    if (!markdown || markdown.trim().length === 0) {
      throw new Error('Empty content received from Jina');
    }
    
    console.log(`Successfully fetched ${markdown.length} characters from ${url}`);
    
    // Return the markdown content directly
    return markdown.trim();
  } catch (error) {
    console.error(`Failed to fetch URL content: ${url}`, error);
    throw new Error(`Failed to fetch URL content: ${error}`);
  }
}

// Helper function to analyze content with AI
async function analyzeContent(content: string): Promise<any> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Analyze the following content and provide a structured summary including key topics, main points, and relevance for research purposes."
        },
        {
          role: "user",
          content: content.substring(0, 4000) // Limit content length
        }
      ],
    });

    return {
      summary: response.choices[0].message.content,
      timestamp: new Date().toISOString(),
      model: "gpt-4o"
    };
  } catch (error) {
    console.error('AI analysis failed:', error);
    throw new Error(`AI analysis failed: ${error}`);
  }
}

// Main function to process a leaf URL
async function processLeafUrl(urlId: number, userId: number, url: string) {
  try {
    console.log(`Processing leaf URL: ${url} for user ${userId}, urlId: ${urlId}`);
    
    // Fetch URL content using Jina for markdown conversion
    console.log(`Fetching content for URL: ${url}`);
    const content = await fetchUrlContent(url);
    
    // Save content to database
    console.log(`Saving content to database for urlId: ${urlId}`);
    const updatedUrl = await storage.updateUrlContent(urlId, userId, content);
    
    if (!updatedUrl) {
      throw new Error(`Failed to update URL content - URL not found or access denied`);
    }
    
    console.log(`Content saved successfully. Content length: ${content.length} characters`);
    
    // Analyze content with AI
    console.log(`Starting AI analysis for urlId: ${urlId}`);
    const analysis = await analyzeContent(content);
    
    // Store analysis results
    console.log(`Saving analysis to database for urlId: ${urlId}`);
    const urlWithAnalysis = await storage.updateUrlAnalysis(urlId, userId, analysis);
    
    if (!urlWithAnalysis) {
      throw new Error(`Failed to update URL analysis - URL not found or access denied`);
    }
    
    console.log(`Leaf URL processing completed successfully for ${url}`);
    
    return {
      success: true,
      contentLength: content.length,
      analysis,
      message: `Successfully processed leaf URL: ${url} (${content.length} characters extracted and analyzed)`
    };
  } catch (error) {
    console.error(`Leaf URL processing failed for ${url} (urlId: ${urlId}):`, error);
    return {
      success: false,
      contentLength: 0,
      analysis: {
        summary: `Error processing URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
        model: "error"
      },
      message: `Failed to process leaf URL: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
} 