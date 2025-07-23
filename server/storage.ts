import { users, urls, chatMessages, leoQuestions, userContexts, contextUrls, contextChatMessages, rssFeeds, rssFeedItems, crawlerJobs, crawlerPages, type User, type InsertUser, type Url, type InsertUrl, type ChatMessage, type InsertChatMessage, type LeoQuestion, type InsertLeoQuestion, type UserContext, type ContextUrl, type ContextChatMessage, type RssFeed, type InsertRssFeed, type RssFeedItem, type CrawlerJob, type InsertCrawlerJob, type CrawlerPage } from "@shared/schema";
import { hashPassword } from "./auth";

export interface IStorage {
  // Initialization
  initialize(): Promise<void>;
  
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // URL methods
  getUrls(userId: number): Promise<Url[]>;
  createUrl(userId: number, url: InsertUrl): Promise<Url>;
  deleteUrl(id: number, userId: number): Promise<boolean>;
  updateUrlAnalysis(id: number, userId: number, analysis: any): Promise<Url | undefined>;
  updateUrlContent(id: number, userId: number, content: string): Promise<Url | undefined>;
  
  // Chat message methods
  getChatMessages(userId: number): Promise<ChatMessage[]>;
  createChatMessage(userId: number, message: InsertChatMessage): Promise<ChatMessage>;
  clearChatHistory(userId: number): Promise<void>;
  
  // Leo question methods
  getLeoQuestions(userId: number): Promise<LeoQuestion[]>;
  createLeoQuestion(userId: number, question: InsertLeoQuestion): Promise<LeoQuestion>;
  updateLeoQuestion(id: number, userId: number, answer: string): Promise<LeoQuestion | undefined>;
  
  // Admin methods
  getAllUsersWithStats(): Promise<Array<{
    user: User;
    urlCount: number;
    messageCount: number;
    questionCount: number;
  }>>;
  updateUserRole(userId: number, role: "user" | "admin"): Promise<User | undefined>;
  
  // Context methods
  getUserContext(userId: number): Promise<UserContext | undefined>;
  updateUserContext(userId: number, context: any): Promise<UserContext>;
  
  // Context Profile methods
  getUserContextProfiles(userId: number): Promise<any[]>;
  getActiveContextProfile(userId: number): Promise<any | undefined>;
  createContextProfile(userId: number, profile: any): Promise<any>;
  updateContextProfile(id: number, userId: number, updates: any): Promise<any | undefined>;
  toggleContextLock(id: number, userId: number): Promise<any | undefined>;
  isContextLocked(profileId: number): Promise<boolean>;
  
  // Context-specific data methods (for pro mode)
  getContextUrls(userId: number, profileId: number): Promise<ContextUrl[]>;
  createContextUrl(userId: number, profileId: number, url: InsertUrl): Promise<ContextUrl>;
  getContextChatMessages(userId: number, profileId: number): Promise<ContextChatMessage[]>;
  createContextChatMessage(userId: number, profileId: number, message: InsertChatMessage): Promise<ContextChatMessage>;
  migrateDataToContext(userId: number, profileId: number): Promise<{ urls: number; messages: number }>;
  loadContextData(userId: number, profileId: number): Promise<{ urls: number; messages: number }>;
  
  // RSS Feed methods
  getRssFeeds(userId: number): Promise<RssFeed[]>;
  createRssFeed(userId: number, feed: InsertRssFeed): Promise<RssFeed>;
  updateRssFeed(id: number, userId: number, updates: Partial<RssFeed>): Promise<RssFeed | undefined>;
  updateRssFeedLastFetched(id: number): Promise<void>;
  updateRssFeedMetadata(id: number, updates: { lastFetched?: Date; lastItemDate?: Date }): Promise<void>;
  deleteRssFeed(id: number, userId: number): Promise<boolean>;
  
  // RSS Feed Item methods
  getRssFeedItems(userId: number, feedId?: number): Promise<RssFeedItem[]>;
  createRssFeedItem(item: Omit<RssFeedItem, 'id' | 'createdAt'>): Promise<RssFeedItem>;
  updateRssFeedItem(id: number, updates: Partial<RssFeedItem>): Promise<RssFeedItem | undefined>;
  deleteRssFeedItem(id: number, userId: number): Promise<boolean>;
  
  // Crawler methods
  getCrawlerJobs(userId: number): Promise<CrawlerJob[]>;
  createCrawlerJob(userId: number, job: InsertCrawlerJob): Promise<CrawlerJob>;
  updateCrawlerJob(id: number, userId: number, updates: Partial<CrawlerJob>): Promise<CrawlerJob | undefined>;
  deleteCrawlerJob(id: number, userId: number): Promise<boolean>;
  
  // Crawler Page methods
  getCrawlerPages(jobId: number): Promise<CrawlerPage[]>;
  createCrawlerPage(page: Omit<CrawlerPage, 'id' | 'createdAt'>): Promise<CrawlerPage>;
  updateCrawlerPage(id: number, updates: Partial<CrawlerPage>): Promise<CrawlerPage | undefined>;
  deleteCrawlerPage(id: number, jobId: number): Promise<boolean>;
  
  // Research methods
  getResearchRequests(userId: number, profileId?: number, status?: string): Promise<any[]>;
  createResearchRequest(userId: number, request: any): Promise<any>;
  updateResearchRequest(id: number, userId: number, updates: any): Promise<any | undefined>;
  deleteResearchRequest(id: number, userId: number): Promise<boolean>;
  
  getResearchReports(userId: number, profileId?: number): Promise<any[]>;
  createResearchReport(report: any): Promise<any>;
  updateResearchReport(id: number, userId: number, updates: any): Promise<any | undefined>;
  deleteResearchReport(id: number, userId: number): Promise<boolean>;
  
  // ChromaDB search methods (if available)
  searchUrlContent?(userId: number, query: string, limit?: number): Promise<any>;
  searchUrlAnalysis?(userId: number, query: string, limit?: number): Promise<any>;
  searchChatMessages?(userId: number, query: string, limit?: number): Promise<any>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private urls: Map<number, Url>;
  private chatMessages: Map<number, ChatMessage>;
  private leoQuestions: Map<number, LeoQuestion>;
  private userContexts: Map<number, UserContext>;
  private currentUserId: number;
  private currentUrlId: number;
  private currentChatMessageId: number;
  private currentLeoQuestionId: number;
  private currentContextId: number;

  constructor() {
    this.users = new Map();
    this.urls = new Map();
    this.chatMessages = new Map();
    this.leoQuestions = new Map();
    this.userContexts = new Map();
    this.currentUserId = 1;
    this.currentUrlId = 1;
    this.currentChatMessageId = 1;
    this.currentLeoQuestionId = 1;
    this.currentContextId = 1;
  }

  async initialize() {
    // Create a default user for demo purposes
    await this.initializeDefaultUser();
  }

  private async initializeDefaultUser() {
    const hashedPassword = await hashPassword("password");
    this.createUser({ username: "alex", password: hashedPassword });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id, role: "user", proMode: false };
    this.users.set(id, user);
    return user;
  }

  async getUrls(userId: number): Promise<Url[]> {
    return Array.from(this.urls.values())
      .filter(url => url.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createUrl(userId: number, insertUrl: InsertUrl): Promise<Url> {
    const id = this.currentUrlId++;
    const url: Url = {
      ...insertUrl,
      id,
      userId,
      title: insertUrl.title || null,
      notes: insertUrl.notes || null,
      content: null,
      analysis: null,
      createdAt: new Date(),
    };
    this.urls.set(id, url);
    return url;
  }

  async deleteUrl(id: number, userId: number): Promise<boolean> {
    const url = this.urls.get(id);
    if (url && url.userId === userId) {
      this.urls.delete(id);
      return true;
    }
    return false;
  }

  async updateUrlAnalysis(id: number, userId: number, analysis: any): Promise<Url | undefined> {
    const url = this.urls.get(id);
    if (url && url.userId === userId) {
      const updatedUrl: Url = {
        ...url,
        analysis,
      };
      this.urls.set(id, updatedUrl);
      return updatedUrl;
    }
    return undefined;
  }

  async updateUrlContent(id: number, userId: number, content: string): Promise<Url | undefined> {
    const url = this.urls.get(id);
    if (url && url.userId === userId) {
      const updatedUrl: Url = {
        ...url,
        content,
      };
      this.urls.set(id, updatedUrl);
      return updatedUrl;
    }
    return undefined;
  }

  async getChatMessages(userId: number): Promise<ChatMessage[]> {
    return Array.from(this.chatMessages.values())
      .filter(message => message.userId === userId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async createChatMessage(userId: number, insertMessage: InsertChatMessage): Promise<ChatMessage> {
    const id = this.currentChatMessageId++;
    const message: ChatMessage = {
      ...insertMessage,
      id,
      userId,
      createdAt: new Date(),
    };
    this.chatMessages.set(id, message);
    return message;
  }

  async clearChatHistory(userId: number): Promise<void> {
    const userMessages = Array.from(this.chatMessages.entries())
      .filter(([_, message]) => message.userId === userId);
    
    userMessages.forEach(([id, _]) => {
      this.chatMessages.delete(id);
    });
  }

  async getLeoQuestions(userId: number): Promise<LeoQuestion[]> {
    return Array.from(this.leoQuestions.values())
      .filter(question => question.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createLeoQuestion(userId: number, insertQuestion: InsertLeoQuestion): Promise<LeoQuestion> {
    const id = this.currentLeoQuestionId++;
    const question: LeoQuestion = {
      ...insertQuestion,
      id,
      userId,
      status: "pending",
      answer: null,
      createdAt: new Date(),
      answeredAt: null,
    };
    this.leoQuestions.set(id, question);
    return question;
  }

  async updateLeoQuestion(id: number, userId: number, answer: string): Promise<LeoQuestion | undefined> {
    const question = this.leoQuestions.get(id);
    if (question && question.userId === userId) {
      const updatedQuestion: LeoQuestion = {
        ...question,
        status: "answered",
        answer,
        answeredAt: new Date(),
      };
      this.leoQuestions.set(id, updatedQuestion);
      return updatedQuestion;
    }
    return undefined;
  }

  async getAllUsersWithStats(): Promise<Array<{
    user: User;
    urlCount: number;
    messageCount: number;
    questionCount: number;
  }>> {
    return Array.from(this.users.values()).map(user => ({
      user,
      urlCount: Array.from(this.urls.values()).filter(url => url.userId === user.id).length,
      messageCount: Array.from(this.chatMessages.values()).filter(msg => msg.userId === user.id).length,
      questionCount: Array.from(this.leoQuestions.values()).filter(q => q.userId === user.id).length,
    }));
  }

  async updateUserRole(userId: number, role: "user" | "admin"): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (user) {
      const updatedUser: User = { ...user, role };
      this.users.set(userId, updatedUser);
      return updatedUser;
    }
    return undefined;
  }

  async getUserContext(userId: number): Promise<UserContext | undefined> {
    return Array.from(this.userContexts.values())
      .filter(context => context.userId === userId)
      .sort((a, b) => b.version - a.version)[0];
  }

  async updateUserContext(userId: number, context: any): Promise<UserContext> {
    const existingContext = await this.getUserContext(userId);
    const newVersion = (existingContext?.version || 0) + 1;
    
    const userContext: UserContext = {
      id: this.currentContextId++,
      userId,
      context,
      lastUpdated: new Date(),
      version: newVersion,
    };
    
    this.userContexts.set(userContext.id, userContext);
    return userContext;
  }

  // Context-specific data methods (for pro mode)
  async getContextUrls(userId: number, profileId: number): Promise<ContextUrl[]> {
    // For memory storage, we'll use the main URLs table
    const urls = await this.getUrls(userId);
    return urls.map(url => ({
      ...url,
      profileId,
    })) as ContextUrl[];
  }

  async createContextUrl(userId: number, profileId: number, url: InsertUrl): Promise<ContextUrl> {
    // For memory storage, we'll use the main URLs table
    const createdUrl = await this.createUrl(userId, url);
    return {
      ...createdUrl,
      profileId,
    } as ContextUrl;
  }

  async getContextChatMessages(userId: number, profileId: number): Promise<ContextChatMessage[]> {
    // For memory storage, we'll use the main chat messages table
    const messages = await this.getChatMessages(userId);
    return messages.map(message => ({
      ...message,
      profileId,
    })) as ContextChatMessage[];
  }

  async createContextChatMessage(userId: number, profileId: number, message: InsertChatMessage): Promise<ContextChatMessage> {
    // For memory storage, we'll use the main chat messages table
    const createdMessage = await this.createChatMessage(userId, message);
    return {
      ...createdMessage,
      profileId,
    } as ContextChatMessage;
  }

  async migrateDataToContext(userId: number, profileId: number): Promise<{ urls: number; messages: number }> {
    // For memory storage, no migration needed
    return { urls: 0, messages: 0 };
  }

  async loadContextData(userId: number, profileId: number): Promise<{ urls: number; messages: number }> {
    // For memory storage, return current data
    const urls = await this.getUrls(userId);
    const messages = await this.getChatMessages(userId);
    return { urls: urls.length, messages: messages.length };
  }

  // Context Profile methods - Memory storage implementation
  private contextProfiles: Map<number, any> = new Map();
  private currentContextProfileId: number = 1;

  async getUserContextProfiles(userId: number): Promise<any[]> {
    return Array.from(this.contextProfiles.values()).filter(profile => profile.userId === userId);
  }

  async getActiveContextProfile(userId: number): Promise<any | undefined> {
    return Array.from(this.contextProfiles.values()).find(profile => profile.userId === userId && profile.isActive);
  }

  async createContextProfile(userId: number, profile: any): Promise<any> {
    const id = this.currentContextProfileId++;
    const contextProfile = {
      id,
      userId,
      name: profile.name,
      description: profile.description,
      isActive: profile.isActive || false,
      isLocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.contextProfiles.set(id, contextProfile);
    return contextProfile;
  }

  async updateContextProfile(id: number, userId: number, updates: any): Promise<any | undefined> {
    const profile = this.contextProfiles.get(id);
    if (profile && profile.userId === userId) {
      const updatedProfile = { ...profile, ...updates, updatedAt: new Date() };
      this.contextProfiles.set(id, updatedProfile);
      return updatedProfile;
    }
    return undefined;
  }

  async toggleContextLock(id: number, userId: number): Promise<any | undefined> {
    const profile = this.contextProfiles.get(id);
    if (profile && profile.userId === userId) {
      const updatedProfile = { 
        ...profile, 
        isLocked: !profile.isLocked, 
        updatedAt: new Date() 
      };
      this.contextProfiles.set(id, updatedProfile);
      return updatedProfile;
    }
    return undefined;
  }

  async isContextLocked(profileId: number): Promise<boolean> {
    const profile = this.contextProfiles.get(profileId);
    return profile ? profile.isLocked : false;
  }

  // RSS Feed methods - Memory storage implementation
  private rssFeeds: Map<number, RssFeed> = new Map();
  private rssFeedItems: Map<number, RssFeedItem> = new Map();
  private crawlerJobs: Map<number, CrawlerJob> = new Map();
  private crawlerPages: Map<number, CrawlerPage> = new Map();
  private currentRssFeedId: number = 1;
  private currentRssFeedItemId: number = 1;
  private currentCrawlerJobId: number = 1;
  private currentCrawlerPageId: number = 1;

  async getRssFeeds(userId: number): Promise<RssFeed[]> {
    return Array.from(this.rssFeeds.values()).filter(feed => feed.userId === userId);
  }

  async createRssFeed(userId: number, feed: InsertRssFeed): Promise<RssFeed> {
    const id = this.currentRssFeedId++;
    const rssFeed: RssFeed = {
      id,
      userId,
      profileId: feed.profileId || 0,
      feedUrl: feed.feedUrl,
      title: feed.title || null,
      description: feed.description || null,
      lastFetched: null,
      lastItemDate: null,
      isActive: true,
      fetchInterval: feed.fetchInterval || 1440,
      maxItemsPerFetch: feed.maxItemsPerFetch || 50,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.rssFeeds.set(id, rssFeed);
    return rssFeed;
  }

  async updateRssFeed(id: number, userId: number, updates: Partial<RssFeed>): Promise<RssFeed | undefined> {
    const feed = this.rssFeeds.get(id);
    if (feed && feed.userId === userId) {
      const updatedFeed = { ...feed, ...updates, updatedAt: new Date() };
      this.rssFeeds.set(id, updatedFeed);
      return updatedFeed;
    }
    return undefined;
  }

  async updateRssFeedLastFetched(id: number): Promise<void> {
    const feed = this.rssFeeds.get(id);
    if (feed) {
      feed.lastFetched = new Date();
      feed.updatedAt = new Date();
    }
  }

  async updateRssFeedMetadata(id: number, updates: { lastFetched?: Date; lastItemDate?: Date }): Promise<void> {
    const feed = this.rssFeeds.get(id);
    if (feed) {
      if (updates.lastFetched) feed.lastFetched = updates.lastFetched;
      if (updates.lastItemDate) feed.lastItemDate = updates.lastItemDate;
      feed.updatedAt = new Date();
    }
  }

  async deleteRssFeed(id: number, userId: number): Promise<boolean> {
    const feed = this.rssFeeds.get(id);
    if (feed && feed.userId === userId) {
      this.rssFeeds.delete(id);
      return true;
    }
    return false;
  }

  async getRssFeedItems(userId: number, feedId?: number): Promise<RssFeedItem[]> {
    let items = Array.from(this.rssFeedItems.values()).filter(item => item.userId === userId);
    if (feedId) {
      items = items.filter(item => item.feedId === feedId);
    }
    return items;
  }

  async createRssFeedItem(item: Omit<RssFeedItem, 'id' | 'createdAt'>): Promise<RssFeedItem> {
    const id = this.currentRssFeedItemId++;
    const rssFeedItem: RssFeedItem = {
      id,
      ...item,
      createdAt: new Date(),
    };
    this.rssFeedItems.set(id, rssFeedItem);
    return rssFeedItem;
  }

  async updateRssFeedItem(id: number, updates: Partial<RssFeedItem>): Promise<RssFeedItem | undefined> {
    const item = this.rssFeedItems.get(id);
    if (item) {
      const updatedItem = { ...item, ...updates };
      this.rssFeedItems.set(id, updatedItem);
      return updatedItem;
    }
    return undefined;
  }

  async deleteRssFeedItem(id: number, userId: number): Promise<boolean> {
    const item = this.rssFeedItems.get(id);
    if (item && item.userId === userId) {
      this.rssFeedItems.delete(id);
      return true;
    }
    return false;
  }

  async getCrawlerJobs(userId: number): Promise<CrawlerJob[]> {
    return Array.from(this.crawlerJobs.values()).filter(job => job.userId === userId);
  }

  async createCrawlerJob(userId: number, job: InsertCrawlerJob): Promise<CrawlerJob> {
    const id = this.currentCrawlerJobId++;
    const crawlerJob: CrawlerJob = {
      id,
      userId,
      profileId: job.profileId || 0,
      rootUrl: job.rootUrl,
      status: 'pending',
      maxPages: job.maxPages || 100,
      pagesDiscovered: 0,
      pagesProcessed: 0,
      pagesAnalyzed: 0,
      startedAt: null,
      completedAt: null,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.crawlerJobs.set(id, crawlerJob);
    return crawlerJob;
  }

  async updateCrawlerJob(id: number, userId: number, updates: Partial<CrawlerJob>): Promise<CrawlerJob | undefined> {
    const job = this.crawlerJobs.get(id);
    if (job && job.userId === userId) {
      const updatedJob = { ...job, ...updates, updatedAt: new Date() };
      this.crawlerJobs.set(id, updatedJob);
      return updatedJob;
    }
    return undefined;
  }

  async deleteCrawlerJob(id: number, userId: number): Promise<boolean> {
    const job = this.crawlerJobs.get(id);
    if (job && job.userId === userId) {
      this.crawlerJobs.delete(id);
      return true;
    }
    return false;
  }

  async getCrawlerPages(jobId: number): Promise<CrawlerPage[]> {
    return Array.from(this.crawlerPages.values()).filter(page => page.jobId === jobId);
  }

  async createCrawlerPage(page: Omit<CrawlerPage, 'id' | 'createdAt'>): Promise<CrawlerPage> {
    const id = this.currentCrawlerPageId++;
    const crawlerPage: CrawlerPage = {
      id,
      ...page,
      createdAt: new Date(),
    };
    this.crawlerPages.set(id, crawlerPage);
    return crawlerPage;
  }

  async updateCrawlerPage(id: number, updates: Partial<CrawlerPage>): Promise<CrawlerPage | undefined> {
    const page = this.crawlerPages.get(id);
    if (page) {
      const updatedPage = { ...page, ...updates };
      this.crawlerPages.set(id, updatedPage);
      return updatedPage;
    }
    return undefined;
  }

  async deleteCrawlerPage(id: number, jobId: number): Promise<boolean> {
    const page = this.crawlerPages.get(id);
    if (page && page.jobId === jobId) {
      this.crawlerPages.delete(id);
      return true;
    }
    return false;
  }

  // Research methods - Memory storage implementation
  private researchRequests: Map<number, any> = new Map();
  private researchReports: Map<number, any> = new Map();
  private currentResearchRequestId: number = 1;
  private currentResearchReportId: number = 1;

  async getResearchRequests(userId: number, profileId?: number, status?: string): Promise<any[]> {
    let requests = Array.from(this.researchRequests.values()).filter(req => req.userId === userId);
    
    if (profileId !== undefined) {
      requests = requests.filter(req => req.profileId === profileId);
    }
    
    if (status) {
      requests = requests.filter(req => req.status === status);
    }
    
    return requests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createResearchRequest(userId: number, request: any): Promise<any> {
    const id = this.currentResearchRequestId++;
    const researchRequest = {
      id,
      userId,
      profileId: request.profileId || 0,
      title: request.title,
      description: request.description,
      researchAreas: request.researchAreas || [],
      priority: request.priority || 'medium',
      status: 'pending',
      assignedTo: null,
      dueDate: request.dueDate ? new Date(request.dueDate) : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.researchRequests.set(id, researchRequest);
    return researchRequest;
  }

  async updateResearchRequest(id: number, userId: number, updates: any): Promise<any | undefined> {
    const request = this.researchRequests.get(id);
    if (request && request.userId === userId) {
      const updatedRequest = { ...request, ...updates, updatedAt: new Date() };
      this.researchRequests.set(id, updatedRequest);
      return updatedRequest;
    }
    return undefined;
  }

  async deleteResearchRequest(id: number, userId: number): Promise<boolean> {
    const request = this.researchRequests.get(id);
    if (request && request.userId === userId) {
      this.researchRequests.delete(id);
      return true;
    }
    return false;
  }

  async getResearchReports(userId: number, profileId?: number): Promise<any[]> {
    let reports = Array.from(this.researchReports.values()).filter(report => report.userId === userId);
    
    if (profileId !== undefined) {
      reports = reports.filter(report => report.profileId === profileId);
    }
    
    return reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createResearchReport(report: any): Promise<any> {
    const id = this.currentResearchReportId++;
    const researchReport = {
      id,
      ...report,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.researchReports.set(id, researchReport);
    return researchReport;
  }

  async updateResearchReport(id: number, userId: number, updates: any): Promise<any | undefined> {
    const report = this.researchReports.get(id);
    if (report && report.userId === userId) {
      const updatedReport = { ...report, ...updates, updatedAt: new Date() };
      this.researchReports.set(id, updatedReport);
      return updatedReport;
    }
    return undefined;
  }

  async deleteResearchReport(id: number, userId: number): Promise<boolean> {
    const report = this.researchReports.get(id);
    if (report && report.userId === userId) {
      this.researchReports.delete(id);
      return true;
    }
    return false;
  }
}

import { PostgresStorage } from "./postgres-storage";
import { createChromaStorage, type IChromaStorage } from "./chroma-storage";

// Factory function to create the appropriate storage instance
export function createStorage(): IStorage {
  // Use PostgreSQL if DATABASE_URL is available, otherwise use memory storage
  let baseStorage: IStorage;
  if (process.env.DATABASE_URL) {
    baseStorage = new PostgresStorage();
  } else {
    baseStorage = new MemStorage();
  }
  
  // Wrap with ChromaDB enhancement if ChromaDB is configured
  if (process.env.CHROMA_API_KEY) {
    const chromaStorage = createChromaStorage(baseStorage);
    // Initialize ChromaDB
    chromaStorage.initialize().catch(error => {
      console.error('Failed to initialize ChromaDB storage:', error);
    });
    return chromaStorage;
  }
  
  return baseStorage;
}

export const storage = createStorage();
