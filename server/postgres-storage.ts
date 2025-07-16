import { eq, desc } from "drizzle-orm";
import { getDb } from "./db";
import { users, urls, chatMessages, leoQuestions, type User, type InsertUser, type Url, type InsertUrl, type ChatMessage, type InsertChatMessage, type LeoQuestion, type InsertLeoQuestion } from "@shared/schema";
import type { IStorage } from "./storage";
import { hashPassword } from "./auth";

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
    const result = await getDb().insert(users).values(insertUser).returning();
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
    return await getDb().select().from(chatMessages).where(eq(chatMessages.userId, userId)).orderBy(desc(chatMessages.createdAt));
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
} 