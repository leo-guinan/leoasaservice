import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getDb } from '../../db';
import { ontologies, userContextProfiles, contextUrls, contextChatMessages, urls, chatMessages, users, userContexts, userContextProfileData } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { storage } from '../../storage';
import { chromaService } from '../../chroma';

export const ontologyTool = createTool({
  id: 'generate-ontology',
  description: 'Generate an ontology based on user context data and store it in database and ChromaDB',
  inputSchema: z.object({
    userId: z.number().describe('User ID'),
    profileId: z.number().optional().describe('Profile ID (0 for default context)'),
    name: z.string().describe('Ontology name'),
    description: z.string().optional().describe('Ontology description'),
    domain: z.string().optional().describe('Domain/topic area'),
    includeUrls: z.boolean().optional().default(true).describe('Include URL content in ontology generation'),
    includeChatHistory: z.boolean().optional().default(true).describe('Include chat history in ontology generation'),
    maxConcepts: z.number().optional().default(50).describe('Maximum number of concepts to generate'),
    confidenceThreshold: z.number().optional().default(0.7).describe('Minimum confidence threshold for concepts'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    ontology: z.object({
      id: z.number(),
      name: z.string(),
      description: z.string().nullable(),
      domain: z.string().nullable(),
      version: z.number(),
      concepts: z.array(z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        type: z.string(),
        confidence: z.number(),
        sources: z.array(z.string()),
        properties: z.record(z.any()),
      })),
      relationships: z.array(z.object({
        id: z.string(),
        source: z.string(),
        target: z.string(),
        type: z.string(),
        description: z.string(),
        confidence: z.number(),
      })),
      metadata: z.object({
        totalConcepts: z.number(),
        totalRelationships: z.number(),
        generationMethod: z.string(),
        dataSources: z.array(z.string()),
        processingTime: z.number(),
      }),
      generatedFrom: z.object({
        urls: z.number(),
        chatMessages: z.number(),
        profileId: z.number(),
        contextSummary: z.string(),
      }),
    }).optional(),
    stats: z.object({
      urlsProcessed: z.number(),
      messagesProcessed: z.number(),
      conceptsGenerated: z.number(),
      relationshipsGenerated: z.number(),
      processingTimeMs: z.number(),
    }).optional(),
  }),
  execute: async ({ context }) => {
    const { 
      userId, 
      profileId = 0, 
      name, 
      description, 
      domain,
      includeUrls = true,
      includeChatHistory = true,
      maxConcepts = 50,
      confidenceThreshold = 0.7
    } = context;
    
    const startTime = Date.now();
    
    try {
      const db = getDb();
      
      // Check if user exists and has pro mode enabled
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (user.length === 0) {
        throw new Error('User not found');
      }
      
      if (!user[0].proMode) {
        throw new Error('Pro mode is required for ontology generation');
      }

      // Get context data based on profile
      let urlsData: any[] = [];
      let chatData: any[] = [];
      let contextSummary = '';

      if (profileId === 0) {
        // Default context
        if (includeUrls) {
          urlsData = await db.select().from(urls).where(eq(urls.userId, userId));
        }
        if (includeChatHistory) {
          chatData = await db.select().from(chatMessages).where(eq(chatMessages.userId, userId));
        }
        
        // Get latest context summary
        const latestContext = await db.select()
          .from(userContexts)
          .where(eq(userContexts.userId, userId))
          .orderBy(desc(userContexts.version))
          .limit(1);
        
        if (latestContext.length > 0) {
          contextSummary = JSON.stringify(latestContext[0].context);
        }
      } else {
        // Profile-specific context
        if (includeUrls) {
          urlsData = await db.select().from(contextUrls).where(and(
            eq(contextUrls.userId, userId),
            eq(contextUrls.profileId, profileId)
          ));
        }
        if (includeChatHistory) {
          chatData = await db.select().from(contextChatMessages).where(and(
            eq(contextChatMessages.userId, userId),
            eq(contextChatMessages.profileId, profileId)
          ));
        }
        
        // Get profile context data
        const profileContext = await db.select()
          .from(userContextProfileData)
          .where(eq(userContextProfileData.profileId, profileId))
          .orderBy(desc(userContextProfileData.version))
          .limit(1);
        
        if (profileContext.length > 0) {
          contextSummary = JSON.stringify(profileContext[0].context);
        }
      }

      // Combine all text data for ontology generation
      const allTextData = [];
      
      // Add URL content and analysis
      for (const url of urlsData) {
        if (url.content) allTextData.push(url.content);
        if (url.title) allTextData.push(url.title);
        if (url.notes) allTextData.push(url.notes);
        if (url.analysis) allTextData.push(JSON.stringify(url.analysis));
      }
      
      // Add chat messages
      for (const message of chatData) {
        if (message.content) allTextData.push(message.content);
      }
      
      // Add context summary
      if (contextSummary) allTextData.push(contextSummary);

      if (allTextData.length === 0) {
        throw new Error('No data available for ontology generation');
      }

      // Generate ontology using AI
      const combinedText = allTextData.join('\n\n');
      
      // This is where you'd call your AI service to generate the ontology
      // For now, I'll create a mock ontology structure
      const generatedOntology = await generateOntologyFromText(
        combinedText, 
        domain || 'General', 
        maxConcepts, 
        confidenceThreshold
      );

      // Create ontology record in database
      const ontologyData = {
        name,
        description: description || null,
        domain: domain || null,
        concepts: generatedOntology.concepts,
        relationships: generatedOntology.relationships,
        metadata: {
          totalConcepts: generatedOntology.concepts.length,
          totalRelationships: generatedOntology.relationships.length,
          generationMethod: 'AI-powered extraction',
          dataSources: includeUrls ? ['urls', 'chat_history'] : ['chat_history'],
          processingTime: Date.now() - startTime,
        },
        generatedFrom: {
          urls: urlsData.length,
          chatMessages: chatData.length,
          profileId,
          contextSummary: contextSummary.substring(0, 500) + (contextSummary.length > 500 ? '...' : ''),
        },
      };

      const newOntology = await storage.createOntology(userId, profileId, ontologyData);

      // Store in ChromaDB
      const ontologyContent = JSON.stringify({
        concepts: generatedOntology.concepts,
        relationships: generatedOntology.relationships,
        metadata: ontologyData.metadata,
      });

      await chromaService.addOntology({
        id: `ontology_${newOntology.id}`,
        content: ontologyContent,
        metadata: {
          userId,
          profileId,
          ontologyId: newOntology.id,
          domain: domain || 'General',
          version: newOntology.version,
          timestamp: new Date().toISOString(),
        },
      });

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        message: `Successfully generated ontology "${name}" with ${generatedOntology.concepts.length} concepts and ${generatedOntology.relationships.length} relationships`,
        ontology: {
          id: newOntology.id,
          name: newOntology.name,
          description: newOntology.description,
          domain: newOntology.domain,
          version: newOntology.version,
          concepts: generatedOntology.concepts,
          relationships: generatedOntology.relationships,
          metadata: ontologyData.metadata,
          generatedFrom: ontologyData.generatedFrom,
        },
        stats: {
          urlsProcessed: urlsData.length,
          messagesProcessed: chatData.length,
          conceptsGenerated: generatedOntology.concepts.length,
          relationshipsGenerated: generatedOntology.relationships.length,
          processingTimeMs: processingTime,
        },
      };

    } catch (error) {
      console.error('Error generating ontology:', error);
      throw new Error(`Failed to generate ontology: ${error}`);
    }
  },
});

// Mock function to generate ontology from text
// In a real implementation, this would call an AI service
async function generateOntologyFromText(
  text: string, 
  domain: string, 
  maxConcepts: number, 
  confidenceThreshold: number
): Promise<{
  concepts: Array<{
    id: string;
    name: string;
    description: string;
    type: string;
    confidence: number;
    sources: string[];
    properties: Record<string, any>;
  }>;
  relationships: Array<{
    id: string;
    source: string;
    target: string;
    type: string;
    description: string;
    confidence: number;
  }>;
}> {
  // Extract key terms and concepts from text
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3);
  
  const wordFreq: Record<string, number> = {};
  words.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });
  
  // Sort by frequency and take top concepts
  const sortedWords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxConcepts);
  
  const concepts = sortedWords.map(([word, freq], index) => ({
    id: `concept_${index + 1}`,
    name: word.charAt(0).toUpperCase() + word.slice(1),
    description: `Key concept related to ${domain} with frequency ${freq}`,
    type: 'Entity',
    confidence: Math.min(0.9, 0.5 + (freq / Math.max(...Object.values(wordFreq))) * 0.4),
    sources: ['text_analysis'],
    properties: {
      frequency: freq,
      domain: domain,
      extractedFrom: 'text_analysis',
    },
  })).filter(concept => concept.confidence >= confidenceThreshold);
  
  // Generate relationships between concepts
  const relationships = [];
  for (let i = 0; i < Math.min(concepts.length, 10); i++) {
    for (let j = i + 1; j < Math.min(concepts.length, i + 3); j++) {
      const confidence = Math.random() * 0.3 + 0.6; // Random confidence between 0.6-0.9
      if (confidence >= confidenceThreshold) {
        relationships.push({
          id: `rel_${i}_${j}`,
          source: concepts[i].id,
          target: concepts[j].id,
          type: 'related_to',
          description: `${concepts[i].name} is related to ${concepts[j].name}`,
          confidence,
        });
      }
    }
  }
  
  return { concepts, relationships };
} 