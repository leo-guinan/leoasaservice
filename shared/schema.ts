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
  isLocked: boolean("is_locked").notNull().default(false), // Prevent context updates when locked
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

// Context-specific URLs for pro mode users
export const contextUrls = pgTable("context_urls", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull(), // References userContextProfiles.id (0 for default context)
  userId: integer("user_id").notNull(),
  url: text("url").notNull(),
  title: text("title"),
  notes: text("notes"),
  content: text("content"), // Store the text content of the page
  analysis: jsonb("analysis"), // Store AI analysis results
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Context-specific chat messages for pro mode users
export const contextChatMessages = pgTable("context_chat_messages", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull(), // References userContextProfiles.id (0 for default context)
  userId: integer("user_id").notNull(),
  content: text("content").notNull(),
  role: text("role").notNull(), // 'user' or 'assistant'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// RSS Feeds for automatic content discovery
export const rssFeeds = pgTable("rss_feeds", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  profileId: integer("profile_id").notNull().default(0), // 0 for default context, or specific profile ID
  feedUrl: text("feed_url").notNull(),
  title: text("title"),
  description: text("description"),
  lastFetched: timestamp("last_fetched"),
  lastItemDate: timestamp("last_item_date"), // Track the most recent item date
  isActive: boolean("is_active").notNull().default(true),
  fetchInterval: integer("fetch_interval").notNull().default(1440), // Minutes between fetches (default: 24 hours)
  maxItemsPerFetch: integer("max_items_per_fetch").notNull().default(50),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// RSS Feed Items - individual articles from feeds
export const rssFeedItems = pgTable("rss_feed_items", {
  id: serial("id").primaryKey(),
  feedId: integer("feed_id").notNull(), // References rssFeeds.id
  userId: integer("user_id").notNull(),
  profileId: integer("profile_id").notNull().default(0),
  title: text("title").notNull(),
  description: text("description"),
  content: text("content"), // Full article content if available
  link: text("link").notNull(),
  author: text("author"),
  publishedAt: timestamp("published_at"),
  guid: text("guid").notNull(), // Unique identifier from RSS feed
  isProcessed: boolean("is_processed").notNull().default(false), // Whether content has been analyzed
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Crawler Jobs for root URL processing
export const crawlerJobs = pgTable("crawler_jobs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  profileId: integer("profile_id").notNull().default(0),
  rootUrl: text("root_url").notNull(),
  status: text("status").notNull().default("pending"), // 'pending', 'processing', 'completed', 'failed'
  maxPages: integer("max_pages").notNull().default(100),
  pagesDiscovered: integer("pages_discovered").notNull().default(0),
  pagesProcessed: integer("pages_processed").notNull().default(0),
  pagesAnalyzed: integer("pages_analyzed").notNull().default(0),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Crawler Discovered Pages
export const crawlerPages = pgTable("crawler_pages", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull(), // References crawlerJobs.id
  userId: integer("user_id").notNull(),
  profileId: integer("profile_id").notNull().default(0),
  url: text("url").notNull(),
  title: text("title"),
  description: text("description"),
  content: text("content"),
  analysis: jsonb("analysis"), // AI analysis of the page
  status: text("status").notNull().default("discovered"), // 'discovered', 'processing', 'analyzed', 'failed'
  priority: integer("priority").notNull().default(0), // Priority score for processing order
  depth: integer("depth").notNull().default(1), // How deep in the site structure
  createdAt: timestamp("created_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
});

// Research Requests - user-initiated research tasks
export const researchRequests = pgTable("research_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  profileId: integer("profile_id").notNull().default(0), // 0 for default context, or specific profile ID
  title: text("title").notNull(),
  description: text("description").notNull(),
  researchAreas: jsonb("research_areas"), // Array of research areas/topics
  priority: text("priority").notNull().default("medium"), // 'low', 'medium', 'high', 'urgent'
  status: text("status").notNull().default("pending"), // 'pending', 'in_progress', 'completed', 'cancelled'
  assignedTo: text("assigned_to"), // Agent or system assigned to handle this
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Research Reports - completed research documents
export const researchReports = pgTable("research_reports", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull(), // References researchRequests.id
  userId: integer("user_id").notNull(),
  profileId: integer("profile_id").notNull().default(0),
  title: text("title").notNull(),
  executiveSummary: text("executive_summary"),
  localKnowledgeSection: text("local_knowledge_section"), // Information from existing context
  internetResearchSection: text("internet_research_section"), // Information from internet research
  methodology: text("methodology"), // How the research was conducted
  sources: jsonb("sources"), // Array of sources used
  keyFindings: jsonb("key_findings"), // Array of key findings
  recommendations: jsonb("recommendations"), // Array of recommendations
  status: text("status").notNull().default("draft"), // 'draft', 'review', 'final', 'archived'
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Ontologies - knowledge graphs generated from context
export const ontologies = pgTable("ontologies", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  profileId: integer("profile_id").notNull().default(0), // 0 for default context, or specific profile ID
  name: text("name").notNull(), // Ontology name
  description: text("description"), // Optional description
  domain: text("domain"), // Domain/topic area (e.g., "AI", "Blockchain", "Biology")
  version: integer("version").notNull().default(1), // Version tracking
  concepts: jsonb("concepts").notNull(), // Array of concept objects with properties, relationships, etc.
  relationships: jsonb("relationships").notNull(), // Array of relationship objects
  metadata: jsonb("metadata"), // Additional metadata (confidence scores, sources, etc.)
  isActive: boolean("is_active").notNull().default(true), // Whether this ontology is currently active
  generatedFrom: jsonb("generated_from"), // Information about what data was used to generate this ontology
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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

export const insertRssFeedSchema = createInsertSchema(rssFeeds).pick({
  feedUrl: true,
  title: true,
  description: true,
  profileId: true,
  fetchInterval: true,
  maxItemsPerFetch: true,
});

export const insertCrawlerJobSchema = createInsertSchema(crawlerJobs).pick({
  rootUrl: true,
  profileId: true,
  maxPages: true,
});

export const insertResearchRequestSchema = createInsertSchema(researchRequests).pick({
  title: true,
  description: true,
  researchAreas: true,
  priority: true,
  profileId: true,
  dueDate: true,
});

export const insertResearchReportSchema = createInsertSchema(researchReports).pick({
  title: true,
  executiveSummary: true,
  localKnowledgeSection: true,
  internetResearchSection: true,
  methodology: true,
  sources: true,
  keyFindings: true,
  recommendations: true,
});

export const insertOntologySchema = createInsertSchema(ontologies).pick({
  name: true,
  description: true,
  domain: true,
  concepts: true,
  relationships: true,
  metadata: true,
  generatedFrom: true,
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
export type ContextUrl = typeof contextUrls.$inferSelect;
export type ContextChatMessage = typeof contextChatMessages.$inferSelect;
export type RssFeed = typeof rssFeeds.$inferSelect;
export type InsertRssFeed = z.infer<typeof insertRssFeedSchema>;
export type RssFeedItem = typeof rssFeedItems.$inferSelect;
export type CrawlerJob = typeof crawlerJobs.$inferSelect;
export type InsertCrawlerJob = z.infer<typeof insertCrawlerJobSchema>;
export type CrawlerPage = typeof crawlerPages.$inferSelect;
export type ResearchRequest = typeof researchRequests.$inferSelect;
export type InsertResearchRequest = z.infer<typeof insertResearchRequestSchema>;
export type ResearchReport = typeof researchReports.$inferSelect;
export type InsertResearchReport = z.infer<typeof insertResearchReportSchema>;
export type Ontology = typeof ontologies.$inferSelect;
export type InsertOntology = z.infer<typeof insertOntologySchema>;
