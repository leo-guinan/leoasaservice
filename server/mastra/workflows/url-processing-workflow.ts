import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { leafUrlProcessingTool } from '../tools/leaf-url-processing-tool';
import { rootUrlProcessingTool } from '../tools/root-url-processing-tool';
import { githubRepoAnalysisTool } from '../tools/github-repo-analysis-tool';
import { urlTypeDetectionTool } from '../tools/url-type-detection-tool';

// Step 1: Determine URL type
const determineUrlType = createStep({
  id: 'determine-url-type',
  description: 'Analyze the URL to determine the appropriate processing method',
  inputSchema: z.object({
    urlId: z.number().describe('Database ID of the URL to process'),
    userId: z.number().describe('User ID who owns the URL'),
    url: z.string().describe('The URL to process'),
    urlType: z.enum(['leaf', 'root', 'github-repo', 'auto']).describe('Type of URL processing to perform. "auto" will determine automatically'),
  }),
  outputSchema: z.object({
    urlId: z.number(),
    userId: z.number(),
    url: z.string(),
    urlType: z.enum(['leaf', 'root', 'github-repo']),
    reasoning: z.string(),
  }),
  execute: async ({ inputData }) => {
    if (!inputData) {
      throw new Error('Input data not found');
    }

    const { url, urlType } = inputData;
    
    // If type is explicitly specified, use it
    if (urlType !== 'auto') {
      return {
        ...inputData,
        urlType,
        reasoning: `URL type explicitly set to ${urlType}`
      };
    }

    // Check for GitHub repository
    if (url.includes('github.com')) {
      const githubMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (githubMatch) {
        return {
          ...inputData,
          urlType: 'github-repo' as const,
          reasoning: `Detected GitHub repository: ${githubMatch[1]}/${githubMatch[2]}`
        };
      }
    }
    
    // Auto-determine URL type based on URL characteristics
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    
    // Root URLs typically have minimal paths or are domain-only
    const isRootUrl = path === '/' || path === '' || path.split('/').length <= 2;
    
    // Check for common patterns that indicate root sites
    const rootPatterns = [
      /^https?:\/\/[^\/]+\/?$/, // Just domain
      /\/$/, // Ends with slash
      /\/about$/, // About page
      /\/contact$/, // Contact page
      /\/blog$/, // Blog listing
      /\/news$/, // News listing
    ];
    
    const isRootPattern = rootPatterns.some(pattern => pattern.test(url));
    
    // Leaf URLs typically have longer paths with specific content
    const leafPatterns = [
      /\/\d{4}\/\d{2}\/\d{2}\//, // Date-based paths
      /\/article\//, // Article paths
      /\/post\//, // Post paths
      /\/[^\/]+\/[^\/]+\/[^\/]+/, // Deep paths
    ];
    
    const isLeafPattern = leafPatterns.some(pattern => pattern.test(url));
    
    let determinedType: 'leaf' | 'root';
    let reasoning: string;
    
    if (isRootPattern || (isRootUrl && !isLeafPattern)) {
      determinedType = 'root';
      reasoning = `URL appears to be a root site (${urlObj.hostname}) with minimal path structure`;
    } else {
      determinedType = 'leaf';
      reasoning = `URL appears to be a specific content page with detailed path structure`;
    }
    
    return {
      ...inputData,
      urlType: determinedType,
      reasoning
    };
  },
});

// Step 2: Process URL based on type
const processUrl = createStep({
  id: 'process-url',
  description: 'Process the URL using the appropriate tool based on its type',
  inputSchema: z.object({
    urlId: z.number(),
    userId: z.number(),
    url: z.string(),
    urlType: z.enum(['leaf', 'root', 'github-repo']),
    reasoning: z.string(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    urlType: z.string(),
    contentLength: z.number(),
    analysis: z.object({
      summary: z.string(),
      timestamp: z.string(),
      model: z.string(),
    }),
    rssFeeds: z.array(z.string()).optional(),
    discoveredPages: z.array(z.string()).optional(),
    message: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    if (!inputData) {
      throw new Error('Input data not found');
    }

    const { urlId, userId, url, urlType } = inputData;
    
    console.log(`Processing ${urlType} URL: ${url} (ID: ${urlId}, User: ${userId})`);
    
    try {
      if (urlType === 'leaf') {
        // Use leaf URL processing tool
        const result = await leafUrlProcessingTool.execute({
          context: { urlId, userId, url }
        } as any);
        
        return {
          success: result.success,
          urlType: 'leaf',
          contentLength: result.contentLength,
          analysis: result.analysis,
          message: result.message
        };
      } else if (urlType === 'github-repo') {
        // Use GitHub repository analysis tool
        const result = await githubRepoAnalysisTool.execute({
          context: { url, userId, profileId: 0 }
        } as any);
        
        return {
          success: result.success,
          urlType: 'github-repo',
          contentLength: 0, // GitHub analysis doesn't return content length
          analysis: {
            summary: result.message,
            timestamp: new Date().toISOString(),
            model: 'github-analyzer'
          },
          message: result.message
        };
      } else {
        // Use root URL processing tool
        const result = await rootUrlProcessingTool.execute({
          context: { urlId, userId, url }
        } as any);
        
        return {
          success: result.success,
          urlType: 'root',
          contentLength: result.contentLength,
          analysis: result.analysis,
          rssFeeds: result.rssFeeds,
          discoveredPages: result.discoveredPages,
          message: result.message
        };
      }
    } catch (error) {
      console.error(`Error processing ${urlType} URL:`, error);
      return {
        success: false,
        urlType,
        contentLength: 0,
        analysis: {
          summary: `Error processing URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date().toISOString(),
          model: "error"
        },
        message: `Failed to process ${urlType} URL: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  },
});

// Create the workflow
const urlProcessingWorkflow = createWorkflow({
  id: 'url-processing-workflow',
  inputSchema: z.object({
    urlId: z.number().describe('Database ID of the URL to process'),
    userId: z.number().describe('User ID who owns the URL'),
    url: z.string().describe('The URL to process'),
    urlType: z.enum(['leaf', 'root', 'github-repo', 'auto']).describe('Type of URL processing to perform. "auto" will determine automatically'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    urlType: z.string(),
    contentLength: z.number(),
    analysis: z.object({
      summary: z.string(),
      timestamp: z.string(),
      model: z.string(),
    }),
    rssFeeds: z.array(z.string()).optional(),
    discoveredPages: z.array(z.string()).optional(),
    message: z.string(),
  }),
})
  .then(determineUrlType)
  .then(processUrl);

urlProcessingWorkflow.commit();

export { urlProcessingWorkflow }; 