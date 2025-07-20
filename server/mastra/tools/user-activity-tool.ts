import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getDb } from '../../db';
import { chatMessages, urls, leoQuestions, type ChatMessage, type Url, type LeoQuestion } from '@shared/schema';
import { eq, and, gte, lt } from 'drizzle-orm';

export const userActivityTool = createTool({
  id: 'get-user-activity',
  description: 'Get all user messages, URL uploads, and Leo questions for a given day',
  inputSchema: z.object({
    date: z.string().describe('Date in YYYY-MM-DD format'),
    userId: z.number().optional().describe('Optional user ID to filter by specific user'),
  }),
  outputSchema: z.object({
    date: z.string(),
    chatMessages: z.array(z.object({
      id: z.number(),
      content: z.string(),
      role: z.string(),
      createdAt: z.string(),
    })),
    urlUploads: z.array(z.object({
      id: z.number(),
      url: z.string(),
      title: z.string().nullable(),
      notes: z.string().nullable(),
      createdAt: z.string(),
    })),
    leoQuestions: z.array(z.object({
      id: z.number(),
      question: z.string(),
      status: z.string(),
      answer: z.string().nullable(),
      createdAt: z.string(),
      answeredAt: z.string().nullable(),
    })),
    summary: z.object({
      totalMessages: z.number(),
      totalUploads: z.number(),
      totalQuestions: z.number(),
      uniqueUsers: z.number(),
    }),
  }),
  execute: async ({ context }) => {
    return await getUserActivity(context.date, context.userId);
  },
});

const getUserActivity = async (date: string, userId?: number) => {
  const db = getDb();
  
  // Parse the date and create date range for the entire day
  const startDate = new Date(date + 'T00:00:00.000Z');
  const endDate = new Date(date + 'T23:59:59.999Z');
  
  // Build the date filter
  const dateFilter = and(
    gte(chatMessages.createdAt, startDate),
    lt(chatMessages.createdAt, endDate)
  );
  
  const urlDateFilter = and(
    gte(urls.createdAt, startDate),
    lt(urls.createdAt, endDate)
  );
  
  const leoDateFilter = and(
    gte(leoQuestions.createdAt, startDate),
    lt(leoQuestions.createdAt, endDate)
  );
  
  // Add user filter if provided
  const userFilter = userId ? eq(chatMessages.userId, userId) : undefined;
  const urlUserFilter = userId ? eq(urls.userId, userId) : undefined;
  const leoUserFilter = userId ? eq(leoQuestions.userId, userId) : undefined;
  
  // Combine filters
  const finalChatFilter = userFilter ? and(dateFilter, userFilter) : dateFilter;
  const finalUrlFilter = urlUserFilter ? and(urlDateFilter, urlUserFilter) : urlDateFilter;
  const finalLeoFilter = leoUserFilter ? and(leoDateFilter, leoUserFilter) : leoDateFilter;
  
  // Fetch data
  const [messages, uploads, questions] = await Promise.all([
    db.select().from(chatMessages).where(finalChatFilter),
    db.select().from(urls).where(finalUrlFilter),
    db.select().from(leoQuestions).where(finalLeoFilter),
  ]);
  
  // Get unique users count
  const uniqueUsers = new Set([
    ...messages.map((m: ChatMessage) => m.userId),
    ...uploads.map((u: Url) => u.userId),
    ...questions.map((q: LeoQuestion) => q.userId)
  ]).size;
  
  return {
    date,
    chatMessages: messages.map((m: ChatMessage) => ({
      id: m.id,
      content: m.content,
      role: m.role,
      createdAt: m.createdAt.toISOString(),
    })),
    urlUploads: uploads.map((u: Url) => ({
      id: u.id,
      url: u.url,
      title: u.title,
      notes: u.notes,
      createdAt: u.createdAt.toISOString(),
    })),
    leoQuestions: questions.map((q: LeoQuestion) => ({
      id: q.id,
      question: q.question,
      status: q.status,
      answer: q.answer,
      createdAt: q.createdAt.toISOString(),
      answeredAt: q.answeredAt?.toISOString() || null,
    })),
    summary: {
      totalMessages: messages.length,
      totalUploads: uploads.length,
      totalQuestions: questions.length,
      uniqueUsers,
    },
  };
}; 