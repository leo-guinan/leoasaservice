import { IStorage } from "./storage";
import { chromaService, type ChatMessageDocument, type UrlContentDocument, type UrlAnalysisDocument } from "./chroma";
import { nanoid } from "nanoid";

export interface IChromaStorage extends IStorage {
  // ChromaDB-specific methods
  searchChatMessages(userId: number, query: string, limit?: number): Promise<any>;
  searchUrlContent(userId: number, query: string, limit?: number): Promise<any>;
  searchUrlAnalysis(userId: number, query: string, limit?: number): Promise<any>;
  searchAll(userId: number, query: string, limit?: number): Promise<any>;
  deleteUserVectorData(userId: number): Promise<void>;
}

export class ChromaEnhancedStorage implements IChromaStorage {
  private baseStorage: IStorage;

  constructor(baseStorage: IStorage) {
    this.baseStorage = baseStorage;
  }

  // Initialize both base storage and ChromaDB
  async initialize(): Promise<void> {
    await this.baseStorage.initialize();
    await chromaService.initialize();
  }

  // Delegate all base storage methods
  async getUser(id: number) {
    return this.baseStorage.getUser(id);
  }

  async getUserByUsername(username: string) {
    return this.baseStorage.getUserByUsername(username);
  }

  async createUser(user: any) {
    return this.baseStorage.createUser(user);
  }

  async getUrls(userId: number) {
    return this.baseStorage.getUrls(userId);
  }

  async createUrl(userId: number, url: any) {
    const createdUrl = await this.baseStorage.createUrl(userId, url);
    
    // Add to ChromaDB if content is available
    if (createdUrl.content) {
      try {
        const document: UrlContentDocument = {
          id: nanoid(),
          content: createdUrl.content,
          metadata: {
            userId: createdUrl.userId,
            url: createdUrl.url,
            title: createdUrl.title || undefined,
            urlId: createdUrl.id,
            timestamp: createdUrl.createdAt.toISOString()
          }
        };
        await chromaService.addUrlContent(document);
      } catch (error) {
        console.error('Failed to add URL content to ChromaDB:', error);
      }
    }
    
    return createdUrl;
  }

  async deleteUrl(id: number, userId: number) {
    return this.baseStorage.deleteUrl(id, userId);
  }

  async updateUrlAnalysis(id: number, userId: number, analysis: any) {
    const updatedUrl = await this.baseStorage.updateUrlAnalysis(id, userId, analysis);
    
    // Add analysis to ChromaDB
    if (updatedUrl && analysis) {
      try {
        const document: UrlAnalysisDocument = {
          id: nanoid(),
          content: JSON.stringify(analysis),
          metadata: {
            userId: updatedUrl.userId,
            url: updatedUrl.url,
            urlId: updatedUrl.id,
            analysisType: 'ai_analysis',
            timestamp: new Date().toISOString()
          }
        };
        await chromaService.addUrlAnalysis(document);
      } catch (error) {
        console.error('Failed to add URL analysis to ChromaDB:', error);
      }
    }
    
    return updatedUrl;
  }

  async updateUrlContent(id: number, userId: number, content: string) {
    const updatedUrl = await this.baseStorage.updateUrlContent(id, userId, content);
    
    // Add content to ChromaDB
    if (updatedUrl && content) {
      try {
        const document: UrlContentDocument = {
          id: nanoid(),
          content: content,
          metadata: {
            userId: updatedUrl.userId,
            url: updatedUrl.url,
            title: updatedUrl.title || undefined,
            urlId: updatedUrl.id,
            timestamp: new Date().toISOString()
          }
        };
        await chromaService.addUrlContent(document);
      } catch (error) {
        console.error('Failed to add URL content to ChromaDB:', error);
      }
    }
    
    return updatedUrl;
  }

  async getChatMessages(userId: number) {
    return this.baseStorage.getChatMessages(userId);
  }

  async createChatMessage(userId: number, message: any) {
    const createdMessage = await this.baseStorage.createChatMessage(userId, message);
    
    // Add to ChromaDB
    try {
      const document: ChatMessageDocument = {
        id: nanoid(),
        content: createdMessage.content,
        metadata: {
          userId: createdMessage.userId,
          role: createdMessage.role as 'user' | 'assistant',
          timestamp: createdMessage.createdAt.toISOString(),
          messageId: createdMessage.id
        }
      };
      await chromaService.addChatMessage(document);
    } catch (error) {
      console.error('Failed to add chat message to ChromaDB:', error);
    }
    
    return createdMessage;
  }

  async clearChatHistory(userId: number) {
    await this.baseStorage.clearChatHistory(userId);
    // Note: ChromaDB deletion would need to be implemented separately
    // as we don't have a direct mapping of message IDs
  }

  async getLeoQuestions(userId: number) {
    return this.baseStorage.getLeoQuestions(userId);
  }

  async createLeoQuestion(userId: number, question: any) {
    return this.baseStorage.createLeoQuestion(userId, question);
  }

  async updateLeoQuestion(id: number, userId: number, answer: string) {
    return this.baseStorage.updateLeoQuestion(id, userId, answer);
  }

  async getAllUsersWithStats() {
    return this.baseStorage.getAllUsersWithStats();
  }

  async updateUserRole(userId: number, role: "user" | "admin") {
    return this.baseStorage.updateUserRole(userId, role);
  }

  async getUserContext(userId: number) {
    return this.baseStorage.getUserContext(userId);
  }

  async updateUserContext(userId: number, context: any) {
    return this.baseStorage.updateUserContext(userId, context);
  }

  async getContextUrls(userId: number, profileId: number) {
    return this.baseStorage.getContextUrls(userId, profileId);
  }

  async createContextUrl(userId: number, profileId: number, url: any) {
    const createdUrl = await this.baseStorage.createContextUrl(userId, profileId, url);
    
    // Add to ChromaDB if content is available
    if (createdUrl.content) {
      try {
        const document: UrlContentDocument = {
          id: nanoid(),
          content: createdUrl.content,
          metadata: {
            userId: createdUrl.userId,
            url: createdUrl.url,
            title: createdUrl.title || undefined,
            urlId: createdUrl.id,
            timestamp: createdUrl.createdAt.toISOString()
          }
        };
        await chromaService.addUrlContent(document);
      } catch (error) {
        console.error('Failed to add context URL content to ChromaDB:', error);
      }
    }
    
    return createdUrl;
  }

  async getContextChatMessages(userId: number, profileId: number) {
    return this.baseStorage.getContextChatMessages(userId, profileId);
  }

  async createContextChatMessage(userId: number, profileId: number, message: any) {
    const createdMessage = await this.baseStorage.createContextChatMessage(userId, profileId, message);
    
    // Add to ChromaDB
    try {
      const document: ChatMessageDocument = {
        id: nanoid(),
        content: createdMessage.content,
        metadata: {
          userId: createdMessage.userId,
          role: createdMessage.role as 'user' | 'assistant',
          timestamp: createdMessage.createdAt.toISOString(),
          messageId: createdMessage.id
        }
      };
      await chromaService.addChatMessage(document);
    } catch (error) {
      console.error('Failed to add context chat message to ChromaDB:', error);
    }
    
    return createdMessage;
  }

  async migrateDataToContext(userId: number, profileId: number) {
    return this.baseStorage.migrateDataToContext(userId, profileId);
  }

  async loadContextData(userId: number, profileId: number) {
    return this.baseStorage.loadContextData(userId, profileId);
  }

  // ChromaDB-specific methods
  async searchChatMessages(userId: number, query: string, limit: number = 10) {
    return chromaService.searchChatMessages(userId, query, limit);
  }

  async searchUrlContent(userId: number, query: string, limit: number = 10) {
    return chromaService.searchUrlContent(userId, query, limit);
  }

  async searchUrlAnalysis(userId: number, query: string, limit: number = 10) {
    return chromaService.searchUrlAnalysis(userId, query, limit);
  }

  async searchAll(userId: number, query: string, limit: number = 5) {
    return chromaService.searchAll(userId, query, limit);
  }

  async deleteUserVectorData(userId: number) {
    await chromaService.deleteUserData(userId);
  }

  // RSS Feed methods - delegate to base storage
  async getRssFeeds(userId: number) {
    return this.baseStorage.getRssFeeds(userId);
  }

  async createRssFeed(userId: number, feed: any) {
    return this.baseStorage.createRssFeed(userId, feed);
  }

  async updateRssFeed(id: number, userId: number, updates: any) {
    return this.baseStorage.updateRssFeed(id, userId, updates);
  }

  async updateRssFeedLastFetched(id: number) {
    return this.baseStorage.updateRssFeedLastFetched(id);
  }

  async updateRssFeedMetadata(id: number, updates: any) {
    return this.baseStorage.updateRssFeedMetadata(id, updates);
  }

  async deleteRssFeed(id: number, userId: number) {
    return this.baseStorage.deleteRssFeed(id, userId);
  }

  async getRssFeedItems(userId: number, feedId?: number) {
    return this.baseStorage.getRssFeedItems(userId, feedId);
  }

  async createRssFeedItem(item: any) {
    return this.baseStorage.createRssFeedItem(item);
  }

  async updateRssFeedItem(id: number, updates: any) {
    return this.baseStorage.updateRssFeedItem(id, updates);
  }

  async deleteRssFeedItem(id: number, userId: number) {
    return this.baseStorage.deleteRssFeedItem(id, userId);
  }

  async getCrawlerJobs(userId: number) {
    return this.baseStorage.getCrawlerJobs(userId);
  }

  async createCrawlerJob(userId: number, job: any) {
    return this.baseStorage.createCrawlerJob(userId, job);
  }

  async updateCrawlerJob(id: number, userId: number, updates: any) {
    return this.baseStorage.updateCrawlerJob(id, userId, updates);
  }

  async deleteCrawlerJob(id: number, userId: number) {
    return this.baseStorage.deleteCrawlerJob(id, userId);
  }

  async getCrawlerPages(jobId: number) {
    return this.baseStorage.getCrawlerPages(jobId);
  }

  async createCrawlerPage(page: any) {
    return this.baseStorage.createCrawlerPage(page);
  }

  async updateCrawlerPage(id: number, updates: any) {
    return this.baseStorage.updateCrawlerPage(id, updates);
  }

  async deleteCrawlerPage(id: number, jobId: number) {
    return this.baseStorage.deleteCrawlerPage(id, jobId);
  }
}

// Factory function to create ChromaDB-enhanced storage
export function createChromaStorage(baseStorage: IStorage): IChromaStorage {
  return new ChromaEnhancedStorage(baseStorage);
} 