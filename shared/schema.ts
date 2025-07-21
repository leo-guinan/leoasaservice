import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"), // 'user' or 'admin'
  proMode: boolean("pro_mode").notNull().default(false), // Enable pro mode features
});

export const urls = pgTable("urls", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  url: text("url").notNull(),
  title: text("title"),
  notes: text("notes"),
  content: text("content"), // Store the text content of the page
  analysis: jsonb("analysis"), // Store AI analysis results
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  content: text("content").notNull(),
  role: text("role").notNull(), // 'user' or 'assistant'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const leoQuestions = pgTable("leo_questions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  question: text("question").notNull(),
  status: text("status").notNull().default("pending"), // 'pending' or 'answered'
  answer: text("answer"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  answeredAt: timestamp("answered_at"),
});

export const userContexts = pgTable("user_contexts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  context: jsonb("context").notNull(), // Store the AI-generated context summary
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  version: integer("version").notNull().default(1), // Track context versions
});

export const userContextProfiles = pgTable("user_context_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(), // Profile name (e.g., "AI Research", "Blockchain Project")
  description: text("description"), // Optional description
  isActive: boolean("is_active").notNull().default(false), // Only one profile can be active per user
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userContextProfileData = pgTable("user_context_profile_data", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull(), // References userContextProfiles.id
  context: jsonb("context").notNull(), // Store the AI-generated context summary for this profile
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  version: integer("version").notNull().default(1), // Track context versions per profile
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertUrlSchema = createInsertSchema(urls).pick({
  url: true,
  title: true,
  notes: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).pick({
  content: true,
  role: true,
});

export const insertLeoQuestionSchema = createInsertSchema(leoQuestions).pick({
  question: true,
});

export const insertContextProfileSchema = createInsertSchema(userContextProfiles).pick({
  name: true,
  description: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertUrl = z.infer<typeof insertUrlSchema>;
export type Url = typeof urls.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertLeoQuestion = z.infer<typeof insertLeoQuestionSchema>;
export type LeoQuestion = typeof leoQuestions.$inferSelect;
export type UserContext = typeof userContexts.$inferSelect;
export type InsertContextProfile = z.infer<typeof insertContextProfileSchema>;
export type UserContextProfile = typeof userContextProfiles.$inferSelect;
export type UserContextProfileData = typeof userContextProfileData.$inferSelect;
