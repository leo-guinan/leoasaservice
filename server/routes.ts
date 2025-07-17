import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUrlSchema, insertChatMessageSchema, insertLeoQuestionSchema } from "@shared/schema";
import OpenAI from "openai";
import { authenticateToken, registerUser, loginUser, type AuthRequest } from "./auth";
import { getDb } from "./db";
import { sql } from "drizzle-orm";
import Redis from "ioredis";
import Queue from 'bull';

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || "your-api-key-here" 
});

// Create queue directly in routes to ensure consistent Redis configuration
let urlProcessingQueue: Queue.Queue | null = null;

if (process.env.REDIS_URL) {
  console.log("Creating URL processing queue in routes with Redis URL:", process.env.REDIS_URL);
  urlProcessingQueue = new Queue('url-processing', process.env.REDIS_URL, {
    defaultJobOptions: {
      removeOnComplete: 10,
      removeOnFail: 5,
    }
  });
  
  urlProcessingQueue.on('error', (error) => {
    console.error('URL processing queue error in routes:', error);
  });
  
  urlProcessingQueue.on('waiting', (jobId) => {
    console.log('Job waiting in URL queue (routes):', jobId);
  });
  
  urlProcessingQueue.on('active', (job) => {
    console.log('Job active in URL queue (routes):', job.id);
  });
  
  urlProcessingQueue.on('completed', (job, result) => {
    console.log('Job completed in URL queue (routes):', job.id);
  });
  
  urlProcessingQueue.on('failed', (job, err) => {
    console.error('Job failed in URL queue (routes):', job.id, err);
  });
} else {
  console.log("Redis not configured, URL processing queue not created");
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check route - must be before any catch-all routes
  app.get("/api/health", async (req, res) => {
    try {
      // Check database connection
      const db = getDb();
      await db.execute(sql`SELECT 1`);
      
      // Check Redis connection (if available)
      let redisStatus = "not_configured";
      if (process.env.REDIS_URL) {
        try {
          const redis = new Redis(process.env.REDIS_URL);
          await redis.ping();
          await redis.quit();
          redisStatus = "connected";
        } catch (error) {
          redisStatus = "error";
        }
      }
      
      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        services: {
          database: "connected",
          redis: redisStatus,
        },
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      });
    } catch (error) {
      res.status(503).json({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
        services: {
          database: "error",
          redis: process.env.REDIS_URL ? "unknown" : "not_configured",
        },
      });
    }
  });

  // Auth routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const result = await registerUser(username, password);
      res.json(result);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Registration failed" });
      }
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      const result = await loginUser(username, password);
      res.json(result);
    } catch (error) {
      if (error instanceof Error) {
        res.status(401).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Login failed" });
      }
    }
  });

  app.get("/api/auth/me", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ id: user.id, username: user.username });
    } catch (error) {
      res.status(500).json({ message: "Failed to get user info" });
    }
  });

  // URL routes
  app.get("/api/urls", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const urls = await storage.getUrls(req.user!.id);
      res.json(urls);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch URLs" });
    }
  });

  app.post("/api/urls", authenticateToken, async (req: AuthRequest, res) => {
    try {
      console.log("Received URL data:", req.body);
      
      // Clean up the data - convert empty strings to null for optional fields
      const cleanedData = {
        url: req.body.url,
        title: req.body.title || null,
        notes: req.body.notes || null,
      };
      
      console.log("Cleaned URL data:", cleanedData);
      
      const urlData = insertUrlSchema.parse(cleanedData);
      const url = await storage.createUrl(req.user!.id, urlData);
      
      console.log("URL created successfully:", url);
      
      // Queue background processing (if Redis is available)
      if (urlProcessingQueue) {
        console.log("Adding URL to processing queue...");
        console.log("Queue object:", urlProcessingQueue ? "exists" : "null");
        console.log("Redis URL:", process.env.REDIS_URL ? "configured" : "not configured");
        
        // Test Redis connection in main server
        if (process.env.REDIS_URL) {
          try {
            console.log("Testing Redis connection in main server...");
            const testRedis = new Redis(process.env.REDIS_URL);
            await testRedis.ping();
            await testRedis.quit();
            console.log("Redis connection test successful in main server");
          } catch (redisError) {
            console.error("Redis connection test failed in main server:", redisError);
          }
        }
        
        try {
          console.log("About to call queue.add()...");
          const job = await Promise.race([
            urlProcessingQueue.add({
              userId: req.user!.id,
              urlId: url.id,
              url: url.url
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Queue add timeout after 10 seconds')), 10000)
            )
          ]) as any;
          console.log("URL added to queue successfully, job ID:", job.id);
        } catch (queueError) {
          console.error("Failed to add URL to queue:", queueError);
          console.error("Queue error details:", {
            message: queueError instanceof Error ? queueError.message : String(queueError),
            stack: queueError instanceof Error ? queueError.stack : undefined,
            name: queueError instanceof Error ? queueError.name : 'Unknown'
          });
          // Don't fail the request, just log the error
        }
      } else {
        console.log("URL processing queue not available (Redis not configured)");
        console.log("urlProcessingQueue is:", urlProcessingQueue);
        console.log("REDIS_URL is:", process.env.REDIS_URL ? "set" : "not set");
      }
      
      res.json(url);
    } catch (error) {
      console.error("URL validation error:", error);
      res.status(400).json({ message: "Invalid URL data" });
    }
  });

  app.delete("/api/urls/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteUrl(id, req.user!.id);
      if (success) {
        res.json({ message: "URL deleted successfully" });
      } else {
        res.status(404).json({ message: "URL not found" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to delete URL" });
    }
  });

  // Chat message routes
  app.get("/api/chat/messages", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const messages = await storage.getChatMessages(req.user!.id);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch chat messages" });
    }
  });

  app.post("/api/chat/messages", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const messageData = insertChatMessageSchema.parse(req.body);
      
      // Save user message
      const userMessage = await storage.createChatMessage(req.user!.id, messageData);
      
      // Get AI response
      try {
        const chatHistory = await storage.getChatMessages(req.user!.id);
        const messages = chatHistory.map(msg => ({
          role: msg.role as "user" | "assistant",
          content: msg.content
        }));

        const response = await openai.chat.completions.create({
          model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
          messages: [
            {
              role: "system",
              content: "You are a helpful AI research assistant. Help users analyze their research materials, answer questions about their saved URLs, and assist with writing and research tasks. Be concise but thorough in your responses."
            },
            ...messages
          ],
        });

        const aiContent = response.choices[0].message.content || "I'm sorry, I couldn't generate a response.";
        
        // Save AI response
        const aiMessage = await storage.createChatMessage(req.user!.id, {
          content: aiContent,
          role: "assistant"
        });

        res.json({ userMessage, aiMessage });
      } catch (aiError) {
        console.error("OpenAI API error:", aiError);
        res.status(500).json({ message: "Failed to get AI response" });
      }
    } catch (error) {
      res.status(400).json({ message: "Invalid message data" });
    }
  });

  app.delete("/api/chat/messages", authenticateToken, async (req: AuthRequest, res) => {
    try {
      await storage.clearChatHistory(req.user!.id);
      res.json({ message: "Chat history cleared" });
    } catch (error) {
      res.status(500).json({ message: "Failed to clear chat history" });
    }
  });

  // Leo question routes
  app.get("/api/leo/questions", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const questions = await storage.getLeoQuestions(req.user!.id);
      res.json(questions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch Leo questions" });
    }
  });

  app.post("/api/leo/questions", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const questionData = insertLeoQuestionSchema.parse(req.body);
      const question = await storage.createLeoQuestion(req.user!.id, questionData);
      res.json(question);
    } catch (error) {
      res.status(400).json({ message: "Invalid question data" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
