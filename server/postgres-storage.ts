import { eq, desc, asc } from "drizzle-orm";
import { getDb } from "./db";
import { users, urls, chatMessages, leoQuestions, userContexts, contextUrls, contextChatMessages, type User, type InsertUser, type Url, type InsertUrl, type ChatMessage, type InsertChatMessage, type LeoQuestion, type InsertLeoQuestion, type UserContext, type ContextUrl, type ContextChatMessage } from "@shared/schema";
import type { IStorage } from "./storage";
import { hashPassword } from "./auth";
import { sql } from "drizzle-orm";

export class PostgresStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const result = await getDb().select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await getDb().select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await getDb().insert(users).values({
      ...insertUser,
      role: "user"
    }).returning();
    return result[0];
  }

  async getUrls(userId: number): Promise<Url[]> {
    return await getDb().select().from(urls).where(eq(urls.userId, userId)).orderBy(desc(urls.createdAt));
  }

  async createUrl(userId: number, insertUrl: InsertUrl): Promise<Url> {
    const result = await getDb().insert(urls).values({
      ...insertUrl,
      userId,
      title: insertUrl.title || null,
      notes: insertUrl.notes || null,
    }).returning();
    return result[0];
  }

  async deleteUrl(id: number, userId: number): Promise<boolean> {
    const result = await getDb().delete(urls).where(eq(urls.id, id)).returning();
    return result.length > 0;
  }

  async updateUrlAnalysis(id: number, userId: number, analysis: any): Promise<Url | undefined> {
    const result = await getDb().update(urls)
      .set({ analysis })
      .where(eq(urls.id, id))
      .returning();
    
    return result[0];
  }

  async updateUrlContent(id: number, userId: number, content: string): Promise<Url | undefined> {
    const result = await getDb().update(urls)
      .set({ content })
      .where(eq(urls.id, id))
      .returning();
    
    return result[0];
  }

  async getChatMessages(userId: number): Promise<ChatMessage[]> {
    return await getDb().select().from(chatMessages).where(eq(chatMessages.userId, userId)).orderBy(asc(chatMessages.createdAt));
  }

  async createChatMessage(userId: number, insertMessage: InsertChatMessage): Promise<ChatMessage> {
    const result = await getDb().insert(chatMessages).values({
      ...insertMessage,
      userId,
    }).returning();
    return result[0];
  }

  async clearChatHistory(userId: number): Promise<void> {
    await getDb().delete(chatMessages).where(eq(chatMessages.userId, userId));
  }

  async getLeoQuestions(userId: number): Promise<LeoQuestion[]> {
    return await getDb().select().from(leoQuestions).where(eq(leoQuestions.userId, userId)).orderBy(desc(leoQuestions.createdAt));
  }

  async createLeoQuestion(userId: number, insertQuestion: InsertLeoQuestion): Promise<LeoQuestion> {
    const result = await getDb().insert(leoQuestions).values({
      ...insertQuestion,
      userId,
      status: "pending",
      answer: null,
      answeredAt: null,
    }).returning();
    return result[0];
  }

  async updateLeoQuestion(id: number, userId: number, answer: string): Promise<LeoQuestion | undefined> {
    const result = await getDb().update(leoQuestions)
      .set({
        status: "answered",
        answer,
        answeredAt: new Date(),
      })
      .where(eq(leoQuestions.id, id))
      .returning();
    
    return result[0];
  }

  async initialize(): Promise<void> {
    // Check if default user exists, if not create it
    const existingUser = await this.getUserByUsername("alex");
    if (!existingUser) {
      const hashedPassword = await hashPassword("password");
      await this.createUser({
        username: "alex",
        password: hashedPassword,
      });
    }
  }

  async getAllUsersWithStats(): Promise<Array<{
    user: User;
    urlCount: number;
    messageCount: number;
    questionCount: number;
  }>> {
    const allUsers = await getDb().select().from(users);
    
    const userStats = await Promise.all(
      allUsers.map(async (user) => {
        const [urlCount] = await getDb()
          .select({ count: sql<number>`count(*)` })
          .from(urls)
          .where(eq(urls.userId, user.id));
        
        const [messageCount] = await getDb()
          .select({ count: sql<number>`count(*)` })
          .from(chatMessages)
          .where(eq(chatMessages.userId, user.id));
        
        const [questionCount] = await getDb()
          .select({ count: sql<number>`count(*)` })
          .from(leoQuestions)
          .where(eq(leoQuestions.userId, user.id));
        
        const result = {
          user,
          urlCount: Number(urlCount?.count || 0),
          messageCount: Number(messageCount?.count || 0),
          questionCount: Number(questionCount?.count || 0),
        };
        
        console.log(`User ${user.username} stats:`, result);
        return result;
      })
    );
    
    return userStats;
  }

  async updateUserRole(userId: number, role: "user" | "admin"): Promise<User | undefined> {
    const result = await getDb().update(users)
      .set({ role })
      .where(eq(users.id, userId))
      .returning();
    
    return result[0];
  }

  async getUserContext(userId: number): Promise<UserContext | undefined> {
    const result = await getDb()
      .select()
      .from(userContexts)
      .where(eq(userContexts.userId, userId))
      .orderBy(desc(userContexts.version))
      .limit(1);
    
    return result[0];
  }

  async updateUserContext(userId: number, context: any): Promise<UserContext> {
    const existingContext = await this.getUserContext(userId);
    const newVersion = (existingContext?.version || 0) + 1;
    
    const result = await getDb().insert(userContexts).values({
      userId,
      context,
      version: newVersion,
    }).returning();
    
    return result[0];
  }

  // Context-specific data methods (for pro mode)
  async getContextUrls(userId: number, profileId: number): Promise<ContextUrl[]> {
    if (profileId === 0) {
      // For default context, use main URLs table
      const urls = await this.getUrls(userId);
      return urls.map(url => ({
        ...url,
        profileId: 0,
      })) as ContextUrl[];
    } else {
      // For custom profiles, use context-specific table
      return await getDb()
        .select()
        .from(contextUrls)
        .where(eq(contextUrls.profileId, profileId))
        .orderBy(desc(contextUrls.createdAt));
    }
  }

  async createContextUrl(userId: number, profileId: number, url: InsertUrl): Promise<ContextUrl> {
    if (profileId === 0) {
      // For default context, use main URLs table
      const createdUrl = await this.createUrl(userId, url);
      return {
        ...createdUrl,
        profileId: 0,
      } as ContextUrl;
    } else {
      // For custom profiles, use context-specific table
      const result = await getDb().insert(contextUrls).values({
        ...url,
        profileId,
        userId,
        title: url.title || null,
        notes: url.notes || null,
      }).returning();
      return result[0];
    }
  }

  async getContextChatMessages(userId: number, profileId: number): Promise<ContextChatMessage[]> {
    if (profileId === 0) {
      // For default context, use main chat messages table
      const messages = await this.getChatMessages(userId);
      return messages.map(message => ({
        ...message,
        profileId: 0,
      })) as ContextChatMessage[];
    } else {
      // For custom profiles, use context-specific table
      return await getDb()
        .select()
        .from(contextChatMessages)
        .where(eq(contextChatMessages.profileId, profileId))
        .orderBy(asc(contextChatMessages.createdAt));
    }
  }

  async createContextChatMessage(userId: number, profileId: number, message: InsertChatMessage): Promise<ContextChatMessage> {
    if (profileId === 0) {
      // For default context, use main chat messages table
      const createdMessage = await this.createChatMessage(userId, message);
      return {
        ...createdMessage,
        profileId: 0,
      } as ContextChatMessage;
    } else {
      // For custom profiles, use context-specific table
      const result = await getDb().insert(contextChatMessages).values({
        ...message,
        profileId,
        userId,
      }).returning();
      return result[0];
    }
  }

  async migrateDataToContext(userId: number, profileId: number): Promise<{ urls: number; messages: number }> {
    if (profileId === 0) {
      // No migration needed for default context
      return { urls: 0, messages: 0 };
    }

    // Migrate URLs from main table to context-specific table
    const existingUrls = await getDb().select().from(urls).where(eq(urls.userId, userId));
    let migratedUrls = 0;
    
    if (existingUrls.length > 0) {
      await getDb().insert(contextUrls).values(
        existingUrls.map(url => ({
          profileId,
          userId: url.userId,
          url: url.url,
          title: url.title,
          notes: url.notes,
          content: url.content,
          analysis: url.analysis,
          createdAt: url.createdAt,
        }))
      );
      migratedUrls = existingUrls.length;
      
      // Clear main URLs table
      await getDb().delete(urls).where(eq(urls.userId, userId));
    }

    // Migrate chat messages from main table to context-specific table
    const existingMessages = await getDb().select().from(chatMessages).where(eq(chatMessages.userId, userId));
    let migratedMessages = 0;
    
    if (existingMessages.length > 0) {
      await getDb().insert(contextChatMessages).values(
        existingMessages.map(message => ({
          profileId,
          userId: message.userId,
          content: message.content,
          role: message.role,
          createdAt: message.createdAt,
        }))
      );
      migratedMessages = existingMessages.length;
      
      // Clear main chat messages table
      await getDb().delete(chatMessages).where(eq(chatMessages.userId, userId));
    }

    return { urls: migratedUrls, messages: migratedMessages };
  }

  async loadContextData(userId: number, profileId: number): Promise<{ urls: number; messages: number }> {
    if (profileId === 0) {
      // For default context, return data from main tables
      const mainUrls = await this.getUrls(userId);
      const mainMessages = await this.getChatMessages(userId);
      return { urls: mainUrls.length, messages: mainMessages.length };
    } else {
      // For custom profiles, return data from context-specific tables
      const contextUrls = await this.getContextUrls(userId, profileId);
      const contextMessages = await this.getContextChatMessages(userId, profileId);
      
      // Copy context-specific data to main tables for UI compatibility
      if (contextUrls.length > 0) {
        await getDb().insert(urls).values(
          contextUrls.map(url => ({
            userId: url.userId,
            url: url.url,
            title: url.title,
            notes: url.notes,
            content: url.content,
            analysis: url.analysis,
            createdAt: url.createdAt,
          }))
        );
      }
      
      if (contextMessages.length > 0) {
        await getDb().insert(chatMessages).values(
          contextMessages.map(message => ({
            userId: message.userId,
            content: message.content,
            role: message.role,
            createdAt: message.createdAt,
          }))
        );
      }
      
      return { urls: contextUrls.length, messages: contextMessages.length };
    }
  }
} 