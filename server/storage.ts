import { users, urls, chatMessages, leoQuestions, type User, type InsertUser, type Url, type InsertUrl, type ChatMessage, type InsertChatMessage, type LeoQuestion, type InsertLeoQuestion } from "@shared/schema";
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
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private urls: Map<number, Url>;
  private chatMessages: Map<number, ChatMessage>;
  private leoQuestions: Map<number, LeoQuestion>;
  private currentUserId: number;
  private currentUrlId: number;
  private currentChatMessageId: number;
  private currentLeoQuestionId: number;

  constructor() {
    this.users = new Map();
    this.urls = new Map();
    this.chatMessages = new Map();
    this.leoQuestions = new Map();
    this.currentUserId = 1;
    this.currentUrlId = 1;
    this.currentChatMessageId = 1;
    this.currentLeoQuestionId = 1;
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
    const user: User = { ...insertUser, id };
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
}

import { PostgresStorage } from "./postgres-storage";

// Factory function to create the appropriate storage instance
export function createStorage(): IStorage {
  // Use PostgreSQL if DATABASE_URL is available, otherwise use memory storage
  if (process.env.DATABASE_URL) {
    return new PostgresStorage();
  }
  return new MemStorage();
}

export const storage = createStorage();
