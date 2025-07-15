import { users, urls, chatMessages, leoQuestions, type User, type InsertUser, type Url, type InsertUrl, type ChatMessage, type InsertChatMessage, type LeoQuestion, type InsertLeoQuestion } from "@shared/schema";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // URL methods
  getUrls(userId: number): Promise<Url[]>;
  createUrl(userId: number, url: InsertUrl): Promise<Url>;
  deleteUrl(id: number, userId: number): Promise<boolean>;
  
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
    
    // Create a default user for demo purposes
    this.createUser({ username: "alex", password: "password" });
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

export const storage = new MemStorage();
