import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUrlSchema, insertChatMessageSchema, insertLeoQuestionSchema } from "@shared/schema";
import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || "your-api-key-here" 
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Default user ID for demo purposes (in a real app, this would come from authentication)
  const DEFAULT_USER_ID = 1;

  // URL routes
  app.get("/api/urls", async (req, res) => {
    try {
      const urls = await storage.getUrls(DEFAULT_USER_ID);
      res.json(urls);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch URLs" });
    }
  });

  app.post("/api/urls", async (req, res) => {
    try {
      const urlData = insertUrlSchema.parse(req.body);
      const url = await storage.createUrl(DEFAULT_USER_ID, urlData);
      res.json(url);
    } catch (error) {
      res.status(400).json({ message: "Invalid URL data" });
    }
  });

  app.delete("/api/urls/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteUrl(id, DEFAULT_USER_ID);
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
  app.get("/api/chat/messages", async (req, res) => {
    try {
      const messages = await storage.getChatMessages(DEFAULT_USER_ID);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch chat messages" });
    }
  });

  app.post("/api/chat/messages", async (req, res) => {
    try {
      const messageData = insertChatMessageSchema.parse(req.body);
      
      // Save user message
      const userMessage = await storage.createChatMessage(DEFAULT_USER_ID, messageData);
      
      // Get AI response
      try {
        const chatHistory = await storage.getChatMessages(DEFAULT_USER_ID);
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
        const aiMessage = await storage.createChatMessage(DEFAULT_USER_ID, {
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

  app.delete("/api/chat/messages", async (req, res) => {
    try {
      await storage.clearChatHistory(DEFAULT_USER_ID);
      res.json({ message: "Chat history cleared" });
    } catch (error) {
      res.status(500).json({ message: "Failed to clear chat history" });
    }
  });

  // Leo question routes
  app.get("/api/leo/questions", async (req, res) => {
    try {
      const questions = await storage.getLeoQuestions(DEFAULT_USER_ID);
      res.json(questions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch Leo questions" });
    }
  });

  app.post("/api/leo/questions", async (req, res) => {
    try {
      const questionData = insertLeoQuestionSchema.parse(req.body);
      const question = await storage.createLeoQuestion(DEFAULT_USER_ID, questionData);
      res.json(question);
    } catch (error) {
      res.status(400).json({ message: "Invalid question data" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
