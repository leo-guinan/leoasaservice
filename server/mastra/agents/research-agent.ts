import { createAgent } from '@mastra/core';
import { z } from 'zod';
import { storage } from '../../storage';
import OpenAI from 'openai';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || "your-api-key-here" 
});

export const researchAgent = createAgent({
  id: 'research-agent',
  name: 'Research Agent',
  description: 'An agent that creates research requests and generates comprehensive reports combining local knowledge with internet research',
  
  systemPrompt: `You are a professional research analyst. Your role is to:

1. **Create Research Requests**: When a user wants to research something, help them create a detailed research request with:
   - Clear title and description
   - Specific research areas/topics
   - Appropriate priority level
   - Realistic due date if needed

2. **Generate Research Reports**: After daily context updates, generate comprehensive reports that:
   - Analyze existing local knowledge from the user's context
   - Identify gaps that need internet research
   - Clearly separate local vs internet information
   - Provide actionable insights and recommendations

3. **Research Process**:
   - Always check the user's existing context first
   - Search through their URLs, chat messages, and analysis
   - Identify what they already know vs what needs external research
   - Create structured, professional reports

4. **Report Structure**:
   - Executive Summary
   - Local Knowledge Section (clearly marked)
   - Internet Research Section (clearly marked)
   - Methodology
   - Key Findings
   - Recommendations

Be thorough, analytical, and always maintain professional research standards.`,

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

  execute: async ({ action, userId, profileId, title, description, researchAreas, priority, requestId }) => {
    try {
      if (action === 'create_request') {
        return await createResearchRequest(userId, profileId, title!, description!, researchAreas, priority);
      } else if (action === 'generate_report') {
        return await generateResearchReport(userId, profileId, requestId!);
      } else {
        throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      console.error('Research agent error:', error);
      throw error;
    }
  },
});

async function createResearchRequest(
  userId: number, 
  profileId: number, 
  title: string, 
  description: string, 
  researchAreas?: string[], 
  priority?: string
) {
  // Create research request using storage
  const request = await storage.createResearchRequest(userId, {
    profileId,
    title,
    description,
    researchAreas: researchAreas || [],
    priority: priority || 'medium',
  });

  return {
    success: true,
    message: `Research request "${title}" created successfully and queued for processing.`,
    requestId: request.id,
    status: request.status,
  };
}

async function generateResearchReport(userId: number, profileId: number, requestId: number) {
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
    success: true,
    message: `Research report "${report.title}" generated successfully.`,
    reportId: report.id,
    status: report.status,
    report: {
      title: report.title,
      executiveSummary: report.executiveSummary,
      localKnowledgeSection: report.localKnowledgeSection,
      internetResearchSection: report.internetResearchSection,
      keyFindings: report.keyFindings,
      recommendations: report.recommendations,
    },
  };
} 