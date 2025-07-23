import { CloudClient } from "chromadb";
import { DefaultEmbeddingFunction } from "@chroma-core/default-embed";
import dotenv from "dotenv";

dotenv.config();

// Initialize ChromaDB client
const client = new CloudClient({
  apiKey: process.env.CHROMA_API_KEY || 'ck-BuiDsD8vkx79FXUcArJPPAcsPGi19ChPQh63Sk18mn59',
  tenant: process.env.CHROMA_TENANT || '44bcbb14-87f0-4601-9e2f-3bf64104d7c4',
  database: process.env.CHROMA_DATABASE || 'leo-as-a-service'
});

// Collection names
const COLLECTIONS = {
  CHAT_MESSAGES: 'chat_messages',
  URL_CONTENT: 'url_content',
  URL_ANALYSIS: 'url_analysis'
} as const;

export interface ChromaDocument {
  id: string;
  content: string;
  metadata: Record<string, any>;
}

export interface ChatMessageDocument extends ChromaDocument {
  metadata: {
    userId: number;
    role: 'user' | 'assistant';
    timestamp: string;
    messageId: number;
  };
}

export interface UrlContentDocument extends ChromaDocument {
  metadata: {
    userId: number;
    url: string;
    title?: string;
    urlId: number;
    timestamp: string;
  };
}

export interface UrlAnalysisDocument extends ChromaDocument {
  metadata: {
    userId: number;
    url: string;
    urlId: number;
    analysisType: string;
    timestamp: string;
  };
}

class ChromaService {
  private collections: {
    chatMessages?: any;
    urlContent?: any;
    urlAnalysis?: any;
  } = {};

  async initialize() {
    try {
      console.log('Initializing ChromaDB collections...');
      
      // Get or create collections
      this.collections.chatMessages = await this.getOrCreateCollection(COLLECTIONS.CHAT_MESSAGES);
      this.collections.urlContent = await this.getOrCreateCollection(COLLECTIONS.URL_CONTENT);
      this.collections.urlAnalysis = await this.getOrCreateCollection(COLLECTIONS.URL_ANALYSIS);
      
      console.log('ChromaDB collections initialized successfully');
    } catch (error) {
      console.error('Failed to initialize ChromaDB:', error);
      throw error;
    }
  }

  private async getOrCreateCollection(name: string) {
    try {
      // Try to get existing collection
      return await client.getCollection({ 
        name,
        embeddingFunction: new DefaultEmbeddingFunction()
      });
    } catch (error) {
      // Collection doesn't exist, create it
      console.log(`Creating collection: ${name}`);
      return await client.createCollection({ 
        name,
        embeddingFunction: new DefaultEmbeddingFunction()
      });
    }
  }

  // Chat Messages
  async addChatMessage(message: ChatMessageDocument) {
    if (!this.collections.chatMessages) {
      throw new Error('ChromaDB not initialized');
    }

    await this.collections.chatMessages.add({
      ids: [message.id],
      documents: [message.content],
      metadatas: [message.metadata]
    });
  }

  async searchChatMessages(userId: number, query: string, limit: number = 10) {
    if (!this.collections.chatMessages) {
      throw new Error('ChromaDB not initialized');
    }

    const results = await this.collections.chatMessages.query({
      queryTexts: [query],
      nResults: limit,
      where: { userId: { $eq: userId } }
    });

    return results;
  }

  async getChatMessagesByUser(userId: number, limit: number = 100) {
    if (!this.collections.chatMessages) {
      throw new Error('ChromaDB not initialized');
    }

    const results = await this.collections.chatMessages.get({
      where: { userId: { $eq: userId } },
      limit
    });

    return results;
  }

  // URL Content
  async addUrlContent(document: UrlContentDocument) {
    if (!this.collections.urlContent) {
      throw new Error('ChromaDB not initialized');
    }

    await this.collections.urlContent.add({
      ids: [document.id],
      documents: [document.content],
      metadatas: [document.metadata]
    });
  }

  async searchUrlContent(userId: number, query: string, limit: number = 10) {
    if (!this.collections.urlContent) {
      throw new Error('ChromaDB not initialized');
    }

    const results = await this.collections.urlContent.query({
      queryTexts: [query],
      nResults: limit,
      where: { userId: { $eq: userId } }
    });

    return results;
  }

  async getUrlContentByUser(userId: number, limit: number = 100) {
    if (!this.collections.urlContent) {
      throw new Error('ChromaDB not initialized');
    }

    const results = await this.collections.urlContent.get({
      where: { userId: { $eq: userId } },
      limit
    });

    return results;
  }

  // URL Analysis
  async addUrlAnalysis(document: UrlAnalysisDocument) {
    if (!this.collections.urlAnalysis) {
      throw new Error('ChromaDB not initialized');
    }

    await this.collections.urlAnalysis.add({
      ids: [document.id],
      documents: [document.content],
      metadatas: [document.metadata]
    });
  }

  async searchUrlAnalysis(userId: number, query: string, limit: number = 10) {
    if (!this.collections.urlAnalysis) {
      throw new Error('ChromaDB not initialized');
    }

    const results = await this.collections.urlAnalysis.query({
      queryTexts: [query],
      nResults: limit,
      where: { userId: { $eq: userId } }
    });

    return results;
  }

  async getUrlAnalysisByUser(userId: number, limit: number = 100) {
    if (!this.collections.urlAnalysis) {
      throw new Error('ChromaDB not initialized');
    }

    const results = await this.collections.urlAnalysis.get({
      where: { userId: { $eq: userId } },
      limit
    });

    return results;
  }

  // Utility methods
  async deleteUserData(userId: number) {
    const collections = [this.collections.chatMessages, this.collections.urlContent, this.collections.urlAnalysis];
    
    for (const collection of collections) {
      if (collection) {
        try {
          await collection.delete({
            where: { userId: { $eq: userId } }
          });
        } catch (error) {
          console.error(`Failed to delete user data from collection:`, error);
        }
      }
    }
  }

  async searchAll(userId: number, query: string, limit: number = 5) {
    const [chatResults, urlContentResults, urlAnalysisResults] = await Promise.all([
      this.searchChatMessages(userId, query, limit),
      this.searchUrlContent(userId, query, limit),
      this.searchUrlAnalysis(userId, query, limit)
    ]);

    return {
      chatMessages: chatResults,
      urlContent: urlContentResults,
      urlAnalysis: urlAnalysisResults
    };
  }

  // Helper method to reconstruct split documents
  async reconstructSplitDocuments(collection: string, baseId: string, userId: number): Promise<string> {
    try {
      let collectionInstance;
      switch (collection) {
        case 'chat_messages':
          collectionInstance = this.collections.chatMessages;
          break;
        case 'url_content':
          collectionInstance = this.collections.urlContent;
          break;
        case 'url_analysis':
          collectionInstance = this.collections.urlAnalysis;
          break;
        default:
          throw new Error(`Unknown collection: ${collection}`);
      }

      if (!collectionInstance) {
        throw new Error('ChromaDB not initialized');
      }

      // Get all parts for this document
      const result = await collectionInstance.get({
        where: {
          $and: [
            { userId: { $eq: userId } },
            { messageId: { $eq: parseInt(baseId) } }
          ]
        }
      });

      if (!result.ids || result.ids.length === 0) {
        return '';
      }

      // Sort by partIndex and reconstruct
      const documents = result.ids.map((id: string, index: number) => ({
        id,
        content: result.documents?.[index] || '',
        metadata: result.metadatas?.[index] || {},
        partIndex: result.metadatas?.[index]?.partIndex || 0
      })).sort((a: any, b: any) => a.partIndex - b.partIndex);

      return documents.map((doc: any) => doc.content).join(' ');
    } catch (error) {
      console.error('Failed to reconstruct split document:', error);
      return '';
    }
  }

  // Health check
  async healthCheck() {
    try {
      await client.heartbeat();
      return true;
    } catch (error) {
      console.error('ChromaDB health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const chromaService = new ChromaService(); 