import { createTool } from "@mastra/core";
import { z } from "zod";

// URL type detection tool
export const urlTypeDetectionTool = createTool({
  id: 'url-type-detection',
  description: 'Detect the type of URL and determine the appropriate analysis method',
  inputSchema: z.object({
    url: z.string().describe('URL to analyze'),
  }),
  outputSchema: z.object({
    urlType: z.enum(['github-repo', 'website', 'documentation', 'api', 'blog', 'unknown']),
    confidence: z.number().min(0).max(1),
    reasoning: z.string(),
    suggestedAnalysis: z.string(),
  }),
  execute: async ({ context }) => {
    if (!context) {
      throw new Error('Context not found');
    }

    const { url } = context;

    try {
      console.log(`🔍 Detecting URL type for: ${url}`);

      // GitHub repository detection
      if (url.includes('github.com')) {
        const githubMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
        if (githubMatch) {
          console.log(`✅ Detected GitHub repository: ${githubMatch[1]}/${githubMatch[2]}`);
          return {
            urlType: 'github-repo' as const,
            confidence: 0.95,
            reasoning: `URL matches GitHub repository pattern: ${githubMatch[1]}/${githubMatch[2]}`,
            suggestedAnalysis: 'Use GitHub repository analysis tool for comprehensive codebase understanding'
          };
        }
      }

      // Documentation detection
      if (url.includes('/docs/') || url.includes('/documentation/') || 
          url.includes('readme') || url.includes('guide') || url.includes('tutorial')) {
        console.log('📚 Detected documentation URL');
        return {
          urlType: 'documentation' as const,
          confidence: 0.8,
          reasoning: 'URL contains documentation-related keywords or paths',
          suggestedAnalysis: 'Use documentation analysis tool for structured content extraction'
        };
      }

      // API detection
      if (url.includes('/api/') || url.includes('swagger') || url.includes('openapi') ||
          url.includes('graphql') || url.includes('rest')) {
        console.log('🔌 Detected API URL');
        return {
          urlType: 'api' as const,
          confidence: 0.85,
          reasoning: 'URL contains API-related keywords or paths',
          suggestedAnalysis: 'Use API analysis tool for endpoint and schema discovery'
        };
      }

      // Blog detection
      if (url.includes('/blog/') || url.includes('/posts/') || url.includes('/articles/') ||
          url.includes('medium.com') || url.includes('substack.com') || url.includes('dev.to')) {
        console.log('📝 Detected blog/article URL');
        return {
          urlType: 'blog' as const,
          confidence: 0.75,
          reasoning: 'URL contains blog-related keywords or is from known blogging platforms',
          suggestedAnalysis: 'Use content analysis tool for article extraction and summarization'
        };
      }

      // General website detection
      if (url.startsWith('http')) {
        console.log('🌐 Detected general website URL');
        return {
          urlType: 'website' as const,
          confidence: 0.6,
          reasoning: 'URL appears to be a general website',
          suggestedAnalysis: 'Use general website analysis tool for content extraction and analysis'
        };
      }

      // Unknown type
      console.log('❓ Unknown URL type');
      return {
        urlType: 'unknown' as const,
        confidence: 0.1,
        reasoning: 'URL format not recognized',
        suggestedAnalysis: 'Use basic URL analysis tool for general content extraction'
      };

    } catch (error) {
      console.error('❌ URL type detection failed:', error);
      return {
        urlType: 'unknown' as const,
        confidence: 0.0,
        reasoning: `Error during detection: ${error instanceof Error ? error.message : 'Unknown error'}`,
        suggestedAnalysis: 'Use basic URL analysis tool for general content extraction'
      };
    }
  },
}); 