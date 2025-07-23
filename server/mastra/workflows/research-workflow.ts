import { createWorkflow } from '@mastra/core';
import { z } from 'zod';
import { storage } from '../../storage';
import OpenAI from 'openai';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || "your-api-key-here" 
});

export const researchWorkflow = createWorkflow({
  id: 'research-workflow',
  name: 'Research Workflow',
  description: 'A workflow that creates research requests and generates comprehensive reports combining local knowledge with internet research',
  
  inputSchema: z.object({
    action: z.enum(['create_request', 'generate_report']).describe('The action to perform'),
    userId: z.number().describe('User ID'),
    profileId: z.number().default(0).describe('Context profile ID'),
    title: z.string().optional().describe('Research title (for create_request)'),
    description: z.string().optional().describe('Research description (for create_request)'),
    researchAreas: z.array(z.string()).optional().describe('Specific research areas'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().describe('Priority level'),
    requestId: z.number().optional().describe('Request ID (for generate_report)'),
  }),

  steps: [
    {
      id: 'create-research-request',
      name: 'Create Research Request',
      description: 'Create a new research request in the database',
      inputSchema: z.object({
        userId: z.number(),
        profileId: z.number(),
        title: z.string(),
        description: z.string(),
        researchAreas: z.array(z.string()).optional(),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
      }),
      execute: async ({ userId, profileId, title, description, researchAreas, priority }) => {
        const request = await storage.createResearchRequest(userId, {
          profileId,
          title,
          description,
          researchAreas: researchAreas || [],
          priority: priority || 'medium',
        });

        return {
          requestId: request.id,
          status: request.status,
          message: `Research request "${title}" created successfully.`,
        };
      },
    },
    {
      id: 'generate-research-report',
      name: 'Generate Research Report',
      description: 'Generate a comprehensive research report combining local knowledge with internet research',
      inputSchema: z.object({
        userId: z.number(),
        profileId: z.number(),
        requestId: z.number(),
      }),
      execute: async ({ userId, profileId, requestId }) => {
        // Get user context and local knowledge
        const userContext = await storage.getUserContext(userId);
        const contextUrls = await storage.getContextUrls(userId, profileId);
        const contextMessages = await storage.getContextChatMessages(userId, profileId);
        
        // Search ChromaDB for relevant local knowledge if available
        let localKnowledgeResults = [];
        try {
          if (storage.searchUrlContent && storage.searchUrlAnalysis && storage.searchChatMessages) {
            // Search for relevant content in user's existing data
            const searchTerms = ['research', 'analysis', 'study', 'investigation'];
            
            for (const term of searchTerms) {
              try {
                const urlResults = await storage.searchUrlContent(userId, term, 3);
                const analysisResults = await storage.searchUrlAnalysis(userId, term, 3);
                const chatResults = await storage.searchChatMessages(userId, term, 3);
                
                localKnowledgeResults.push(...urlResults, ...analysisResults, ...chatResults);
              } catch (searchError) {
                console.warn(`Search failed for term ${term}:`, searchError);
              }
            }
          }
        } catch (error) {
          console.warn('ChromaDB search failed, continuing without local knowledge search:', error);
        }

        // Prepare local knowledge summary
        const localKnowledgeData = {
          userContext: userContext?.context || {},
          contextUrls: contextUrls.map(url => ({ 
            title: url.title, 
            url: url.url, 
            content: url.content?.substring(0, 500) 
          })),
          contextMessages: contextMessages.map(msg => ({ 
            role: msg.role, 
            content: msg.content 
          })),
          chromaResults: localKnowledgeResults,
        };

        // Generate research report using AI
        const reportPrompt = `
You are a research analyst tasked with creating a comprehensive research report.

LOCAL KNOWLEDGE AVAILABLE:
${JSON.stringify(localKnowledgeData, null, 2)}

Your task is to create a comprehensive research report that:

1. **Executive Summary**: Provide a concise overview of the research findings
2. **Local Knowledge Section**: Analyze and present relevant information from the user's existing context, URLs, and conversations
3. **Internet Research Section**: Identify gaps and areas that need external research
4. **Methodology**: Explain how the research was conducted
5. **Key Findings**: List the most important discoveries
6. **Recommendations**: Provide actionable recommendations based on findings

IMPORTANT: 
- Clearly separate local knowledge from internet research
- Mark local knowledge with [LOCAL] and internet research with [INTERNET]
- Be specific about what information comes from where
- Identify gaps where internet research is needed

Return a JSON object with the following structure:
{
  "title": "Research Report: [Title]",
  "executiveSummary": "...",
  "localKnowledgeSection": "...",
  "internetResearchSection": "...",
  "methodology": "...",
  "sources": ["source1", "source2"],
  "keyFindings": ["finding1", "finding2"],
  "recommendations": ["recommendation1", "recommendation2"]
}
`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are a professional research analyst. Return ONLY valid JSON without any markdown formatting or additional text."
            },
            {
              role: "user",
              content: reportPrompt
            }
          ],
          temperature: 0.3,
        });

        const aiResponse = response.choices[0].message.content;
        if (!aiResponse) {
          throw new Error('No response from AI');
        }

        // Parse the AI response
        let reportData;
        try {
          let jsonString = aiResponse.trim();
          if (jsonString.startsWith('```json')) {
            jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          } else if (jsonString.startsWith('```')) {
            jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
          }
          reportData = JSON.parse(jsonString);
        } catch (parseError) {
          console.error('Failed to parse AI response:', aiResponse);
          throw new Error('Failed to parse research report from AI');
        }

        // Create the research report
        const report = await storage.createResearchReport({
          requestId,
          userId,
          profileId,
          title: reportData.title,
          executiveSummary: reportData.executiveSummary,
          localKnowledgeSection: reportData.localKnowledgeSection,
          internetResearchSection: reportData.internetResearchSection,
          methodology: reportData.methodology,
          sources: reportData.sources || [],
          keyFindings: reportData.keyFindings || [],
          recommendations: reportData.recommendations || [],
          status: 'final',
          completedAt: new Date(),
        });

        return {
          reportId: report.id,
          title: report.title,
          status: report.status,
          message: `Research report "${report.title}" generated successfully.`,
          report: {
            title: report.title,
            executiveSummary: report.executiveSummary,
            localKnowledgeSection: report.localKnowledgeSection,
            internetResearchSection: report.internetResearchSection,
            keyFindings: report.keyFindings,
            recommendations: report.recommendations,
          },
        };
      },
    },
  ],

  execute: async ({ action, userId, profileId, title, description, researchAreas, priority, requestId }) => {
    try {
      if (action === 'create_request') {
        if (!title || !description) {
          throw new Error('Title and description are required for creating a research request');
        }
        
        return await researchWorkflow.steps[0].execute({
          userId,
          profileId,
          title,
          description,
          researchAreas,
          priority,
        });
      } else if (action === 'generate_report') {
        if (!requestId) {
          throw new Error('Request ID is required for generating a research report');
        }
        
        return await researchWorkflow.steps[1].execute({
          userId,
          profileId,
          requestId,
        });
      } else {
        throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      console.error('Research workflow error:', error);
      throw error;
    }
  },
}); 