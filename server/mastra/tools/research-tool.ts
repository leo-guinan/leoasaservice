import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getDb } from '../../db';
import { researchRequests, researchReports, type InsertResearchRequest, type InsertResearchReport } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import OpenAI from 'openai';
import { storage } from '../../storage';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || "your-api-key-here" 
});

// Tool to create a research request
export const createResearchRequestTool = createTool({
  id: 'create-research-request',
  description: 'Create a new research request that will be processed after daily context updates',
  inputSchema: z.object({
    userId: z.number().describe('User ID requesting the research'),
    profileId: z.number().default(0).describe('Context profile ID (0 for default)'),
    title: z.string().describe('Title of the research request'),
    description: z.string().describe('Detailed description of what needs to be researched'),
    researchAreas: z.array(z.string()).optional().describe('Specific areas or topics to research'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium').describe('Priority level of the research'),
    dueDate: z.string().optional().describe('Due date in ISO format (YYYY-MM-DD)'),
  }),
  outputSchema: z.object({
    requestId: z.number(),
    title: z.string(),
    status: z.string(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const { userId, profileId, title, description, researchAreas, priority, dueDate } = context;
    const db = getDb();
    
    try {
      const result = await db.insert(researchRequests).values({
        userId,
        profileId,
        title,
        description,
        researchAreas: researchAreas || [],
        priority,
        status: 'pending',
        dueDate: dueDate ? new Date(dueDate) : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      const request = result[0];
      
      return {
        requestId: request.id,
        title: request.title,
        status: request.status,
        message: `Research request "${title}" created successfully and queued for processing.`,
      };
    } catch (error) {
      console.error('Failed to create research request:', error);
      throw new Error(`Failed to create research request: ${error}`);
    }
  },
});

// Tool to generate a research report
export const generateResearchReportTool = createTool({
  id: 'generate-research-report',
  description: 'Generate a comprehensive research report combining local knowledge with internet research',
  inputSchema: z.object({
    requestId: z.number().describe('ID of the research request to generate report for'),
    userId: z.number().describe('User ID requesting the report'),
  }),
  outputSchema: z.object({
    reportId: z.number(),
    title: z.string(),
    status: z.string(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const { requestId, userId } = context;
    const db = getDb();
    
    try {
      // Get the research request
      const requestResult = await db.select().from(researchRequests).where(eq(researchRequests.id, requestId)).limit(1);
      if (requestResult.length === 0) {
        throw new Error(`Research request ${requestId} not found`);
      }
      
      const request = requestResult[0];
      
      // Check if user owns this request
      if (request.userId !== userId) {
        throw new Error('Access denied: You can only generate reports for your own research requests');
      }

      // Get user context and local knowledge
      const userContext = await storage.getUserContext(userId);
      const contextUrls = await storage.getContextUrls(userId, request.profileId);
      const contextMessages = await storage.getContextChatMessages(userId, request.profileId);
      
      // Search ChromaDB for relevant local knowledge
      let localKnowledgeResults = [];
      try {
        if (storage.searchUrlContent && storage.searchUrlAnalysis && storage.searchChatMessages) {
          const searchTerms = (request.researchAreas as string[]) || [request.title, ...request.description.split(' ').slice(0, 5)];
          
          for (const term of searchTerms) {
            const urlResults = await storage.searchUrlContent(userId, term, 5);
            const analysisResults = await storage.searchUrlAnalysis(userId, term, 5);
            const chatResults = await storage.searchChatMessages(userId, term, 5);
            
            localKnowledgeResults.push(...urlResults, ...analysisResults, ...chatResults);
          }
        }
      } catch (error) {
        console.warn('ChromaDB search failed, continuing without local knowledge search:', error);
      }

      // Prepare local knowledge summary
      const localKnowledgeData = {
        userContext: userContext?.context || {},
        contextUrls: contextUrls.map(url => ({ title: url.title, url: url.url, content: url.content?.substring(0, 500) })),
        contextMessages: contextMessages.map(msg => ({ role: msg.role, content: msg.content })),
        chromaResults: localKnowledgeResults,
      };

      // Generate research report using AI
      const reportPrompt = `
You are a research analyst tasked with creating a comprehensive research report.

RESEARCH REQUEST:
Title: ${request.title}
Description: ${request.description}
Research Areas: ${(request.researchAreas as string[])?.join(', ') || 'Not specified'}
Priority: ${request.priority}

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
      const reportResult = await db.insert(researchReports).values({
        requestId: request.id,
        userId: request.userId,
        profileId: request.profileId,
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
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      const report = reportResult[0];

      // Update the research request status
      await db.update(researchRequests)
        .set({ status: 'completed', updatedAt: new Date() })
        .where(eq(researchRequests.id, requestId));

      return {
        reportId: report.id,
        title: report.title,
        status: report.status,
        message: `Research report "${report.title}" generated successfully.`,
      };
    } catch (error) {
      console.error('Failed to generate research report:', error);
      throw new Error(`Failed to generate research report: ${error}`);
    }
  },
});

// Tool to get research requests
export const getResearchRequestsTool = createTool({
  id: 'get-research-requests',
  description: 'Get all research requests for a user',
  inputSchema: z.object({
    userId: z.number().describe('User ID to get requests for'),
    profileId: z.number().optional().describe('Optional profile ID to filter by'),
    status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional().describe('Optional status filter'),
  }),
  outputSchema: z.object({
    requests: z.array(z.object({
      id: z.number(),
      title: z.string(),
      description: z.string(),
      status: z.string(),
      priority: z.string(),
      createdAt: z.string(),
    })),
  }),
  execute: async ({ context }) => {
    const { userId, profileId, status } = context;
    const db = getDb();
    
    try {
      let query = db.select().from(researchRequests).where(eq(researchRequests.userId, userId));
      
      if (profileId !== undefined) {
        query = query.where(eq(researchRequests.profileId, profileId));
      }
      
      if (status) {
        query = query.where(eq(researchRequests.status, status));
      }
      
      const requests = await query.orderBy(desc(researchRequests.createdAt));
      
      return {
        requests: requests.map(req => ({
          id: req.id,
          title: req.title,
          description: req.description,
          status: req.status,
          priority: req.priority,
          createdAt: req.createdAt.toISOString(),
        })),
      };
    } catch (error) {
      console.error('Failed to get research requests:', error);
      throw new Error(`Failed to get research requests: ${error}`);
    }
  },
});

// Tool to get research reports
export const getResearchReportsTool = createTool({
  id: 'get-research-reports',
  description: 'Get all research reports for a user',
  inputSchema: z.object({
    userId: z.number().describe('User ID to get reports for'),
    profileId: z.number().optional().describe('Optional profile ID to filter by'),
  }),
  outputSchema: z.object({
    reports: z.array(z.object({
      id: z.number(),
      title: z.string(),
      status: z.string(),
      completedAt: z.string().nullable(),
      createdAt: z.string(),
    })),
  }),
  execute: async ({ context }) => {
    const { userId, profileId } = context;
    const db = getDb();
    
    try {
      let query = db.select().from(researchReports).where(eq(researchReports.userId, userId));
      
      if (profileId !== undefined) {
        query = query.where(eq(researchReports.profileId, profileId));
      }
      
      const reports = await query.orderBy(desc(researchReports.createdAt));
      
      return {
        reports: reports.map(report => ({
          id: report.id,
          title: report.title,
          status: report.status,
          completedAt: report.completedAt?.toISOString() || null,
          createdAt: report.createdAt.toISOString(),
        })),
      };
    } catch (error) {
      console.error('Failed to get research reports:', error);
      throw new Error(`Failed to get research reports: ${error}`);
    }
  },
}); 