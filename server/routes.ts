import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUrlSchema, insertChatMessageSchema, insertLeoQuestionSchema } from "@shared/schema";
import OpenAI from "openai";
import { authenticateToken, registerUser, loginUser, type AuthRequest } from "./auth";
import { getDb } from "./db";
import { sql } from "drizzle-orm";
import { createUrlProcessingQueue, addUrlProcessingJob } from "@shared/queues";
import { testRedisConnection } from "@shared/redis";
import { upload, uploadFileToS3, isS3Configured } from "./s3";
import puppeteer, { Browser } from "puppeteer";
// Optional sharp import for image optimization
let sharp: any = null;
try {
  sharp = require("sharp");
} catch (error) {
  console.warn("Sharp not available for image optimization:", error instanceof Error ? error.message : 'Unknown error');
}
import { getUserContext, createContextAwarePrompt } from "./mastra/agents/chat-agent";

// Convert PDF pages to images and extract text using GPT-4o vision
async function extractPdfText(buffer: Buffer): Promise<string> {
  let browser: Browser | null = null;
  
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const os = await import("os");
    
    const tempDir = os.tmpdir();
    const tempPdfPath = path.join(tempDir, `temp-${Date.now()}.pdf`);
    const tempImageDir = path.join(tempDir, `images-${Date.now()}`);
    
    // Create temp directories
    await fs.mkdir(tempImageDir, { recursive: true });
    
    // Write PDF buffer to temp file
    await fs.writeFile(tempPdfPath, buffer);
    
    console.log(`Converting PDF to images: ${tempPdfPath}`);
    
    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set viewport for consistent image size
    await page.setViewport({ width: 1200, height: 1600 });
    
    // Load PDF and get page count
    await page.goto(`file://${tempPdfPath}`);
    
    // Get total pages
    const pageCount = await page.evaluate(() => {
      const pdfViewer = document.querySelector('embed[type="application/pdf"]');
      if (pdfViewer) {
        return (pdfViewer as any).contentWindow?.PDFViewerApplication?.pagesCount || 1;
      }
      return 1;
    });
    
    console.log(`PDF has ${pageCount} pages`);
    
    // Convert each page to image
    const extractedTexts: string[] = [];
    
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      console.log(`Processing page ${pageNum}/${pageCount}`);
      
      try {
        // Navigate to specific page
        await page.goto(`file://${tempPdfPath}#page=${pageNum}`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for page to load
        
        // Take screenshot
        const screenshot = await page.screenshot({
          type: 'png',
          fullPage: true
        });
        
        // Optimize image if sharp is available, otherwise use original
        let optimizedBuffer: Buffer;
        if (sharp) {
          optimizedBuffer = await sharp(screenshot)
            .resize(1200, 1600, { fit: 'inside', withoutEnlargement: true })
            .png({ quality: 90 })
            .toBuffer();
        } else {
          optimizedBuffer = Buffer.from(screenshot);
        }
        
        // Convert to base64 for OpenAI API
        const base64Image = optimizedBuffer.toString('base64');
        
        // Use GPT-4o vision to extract text
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are an OCR assistant. Extract all text from the provided image. Return only the extracted text, maintaining the original formatting and structure. Do not add any commentary or explanations."
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extract all text from this image:"
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/png;base64,${base64Image}`
                  }
                }
              ]
            }
          ],
          max_tokens: 4000,
        });
        
        const pageText = response.choices[0].message.content || "";
        extractedTexts.push(`--- Page ${pageNum} ---\n${pageText}\n`);
        
        console.log(`Extracted ${pageText.length} characters from page ${pageNum}`);
        
      } catch (pageError) {
        console.error(`Error processing page ${pageNum}:`, pageError);
        extractedTexts.push(`--- Page ${pageNum} ---\n[Error extracting text from this page]\n`);
      }
    }
    
    // Clean up temp files
    try {
      await fs.unlink(tempPdfPath);
      await fs.rmdir(tempImageDir, { recursive: true });
    } catch (cleanupError) {
      console.warn("Error cleaning up temp files:", cleanupError);
    }
    
    const fullText = extractedTexts.join('\n');
    console.log(`Total extracted text length: ${fullText.length} characters`);
    
    return fullText;
    
  } catch (error) {
    console.error("PDF to image conversion failed:", error);
    throw new Error(`Failed to extract text from PDF: ${error}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || "your-api-key-here" 
});

// Create queue using shared configuration
const urlProcessingQueue = createUrlProcessingQueue();

// Helper function to process URLs synchronously (temporary fallback)
async function processUrlSynchronously(urlId: number, userId: number, url: string) {
  try {
    console.log(`Processing URL synchronously: ${url} for user ${userId}, urlId: ${urlId}`);
    
    // Fetch URL content using Jina for markdown conversion
    console.log(`Fetching content for URL: ${url}`);
    const content = await fetchUrlContent(url);
    
    // Save content to database
    console.log(`Saving content to database for urlId: ${urlId}`);
    const updatedUrl = await storage.updateUrlContent(urlId, userId, content);
    
    if (!updatedUrl) {
      throw new Error(`Failed to update URL content - URL not found or access denied`);
    }
    
    console.log(`Content saved successfully. Content length: ${content.length} characters`);
    
    // Analyze content with AI
    console.log(`Starting AI analysis for urlId: ${urlId}`);
    const analysis = await analyzeContent(content);
    
    // Store analysis results
    console.log(`Saving analysis to database for urlId: ${urlId}`);
    const urlWithAnalysis = await storage.updateUrlAnalysis(urlId, userId, analysis);
    
    if (!urlWithAnalysis) {
      throw new Error(`Failed to update URL analysis - URL not found or access denied`);
    }
    
    console.log(`URL processing completed successfully for ${url}`);
    return { success: true, content, analysis };
  } catch (error) {
    console.error(`URL processing failed for ${url} (urlId: ${urlId}):`, error);
    throw error;
  }
}

// Helper function to fetch URL content
async function fetchUrlContent(url: string): Promise<string> {
  try {
    // Ensure URL is properly encoded for Jina
    const encodedUrl = encodeURIComponent(url);
    const jinaUrl = `https://r.jina.ai/${encodedUrl}`;
    
    console.log(`Fetching content from Jina: ${jinaUrl}`);
    
    const response = await fetch(jinaUrl);
    
    if (!response.ok) {
      throw new Error(`Jina API returned ${response.status}: ${response.statusText}`);
    }
    
    const markdown = await response.text();
    
    if (!markdown || markdown.trim().length === 0) {
      throw new Error('Empty content received from Jina');
    }
    
    console.log(`Successfully fetched ${markdown.length} characters from ${url}`);
    
    // Return the markdown content directly
    return markdown.trim();
  } catch (error) {
    console.error(`Failed to fetch URL content: ${url}`, error);
    throw new Error(`Failed to fetch URL content: ${error}`);
  }
}

// Helper function to analyze content with AI
async function analyzeContent(content: string): Promise<any> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Analyze the following content and provide a structured summary including key topics, main points, and relevance for research purposes."
        },
        {
          role: "user",
          content: content.substring(0, 4000) // Limit content length
        }
      ],
    });

    return {
      summary: response.choices[0].message.content,
      timestamp: new Date().toISOString(),
      model: "gpt-4o"
    };
  } catch (error) {
    console.error('AI analysis failed:', error);
    throw new Error(`AI analysis failed: ${error}`);
  }
}

// Helper function to determine if a message contains a request
async function detectRequest(message: string): Promise<{ isRequest: boolean; confidence: number; reasoning: string }> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Analyze the following message and determine if it contains a request, question, or action that requires a response.

A REQUEST includes:
- Direct questions (What is...? How do I...? Can you...?)
- Commands or instructions (Please help me..., Show me..., Find...)
- Requests for action (I need help with..., Could you...)
- Requests for information, analysis, or assistance

An OBSERVATION includes:
- Statements of fact (I found this interesting..., This article says...)
- Personal notes or thoughts (I think..., This reminds me of...)
- Declarative statements without asking for anything
- Sharing information without expecting a response

Respond with a JSON object containing:
- "isRequest": boolean (true if it's a request, false if it's an observation)
- "confidence": number (0-1, how confident you are in the classification)
- "reasoning": string (brief explanation of your classification)`
        },
        {
          role: "user",
          content: message
        }
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return {
      isRequest: result.isRequest || false,
      confidence: result.confidence || 0,
      reasoning: result.reasoning || "Unable to determine"
    };
  } catch (error) {
    console.error('Request detection failed:', error);
    // Fallback: assume it's a request if it contains question marks or request words
    const hasQuestionMark = message.includes('?');
    const hasRequestWords = /\b(can you|could you|please|help|what|how|why|when|where|show|find|get|tell|explain)\b/i.test(message);
    
    return {
      isRequest: hasQuestionMark || hasRequestWords,
      confidence: 0.5,
      reasoning: "Fallback detection used due to AI analysis failure"
    };
  }
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
          const isConnected = await testRedisConnection();
          redisStatus = isConnected ? "connected" : "error";
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
      res.json({ id: user.id, username: user.username, role: user.role });
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
            const isConnected = await testRedisConnection();
            if (isConnected) {
              console.log("Redis connection test successful in main server");
            } else {
              console.log("Redis connection test failed in main server");
            }
          } catch (redisError) {
            console.error("Redis connection test failed in main server:", redisError);
          }
        }
        
        try {
          console.log("About to call queue.add()...");
          const job = await Promise.race([
            addUrlProcessingJob(urlProcessingQueue!, {
              userId: req.user!.id,
              urlId: url.id,
              url: url.url
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Queue add timeout after 10 seconds')), 10000)
            )
          ]) as any;
          console.log("URL added to queue successfully, job ID:", job.id);
          
          // Check queue status after adding job
          try {
            const waitingJobs = await urlProcessingQueue.getWaiting();
            const activeJobs = await urlProcessingQueue.getActive();
            console.log(`Queue status after adding job: ${waitingJobs.length} waiting, ${activeJobs.length} active`);
          } catch (statusError) {
            console.error("Error checking queue status:", statusError);
          }
        } catch (queueError) {
          console.error("Failed to add URL to queue:", queueError);
          console.error("Queue error details:", {
            message: queueError instanceof Error ? queueError.message : String(queueError),
            stack: queueError instanceof Error ? queueError.stack : undefined,
            name: queueError instanceof Error ? queueError.name : 'Unknown'
          });
          
          // TEMPORARY: Process URL synchronously if queue fails
          console.log("Processing URL synchronously as fallback...");
          try {
            await processUrlSynchronously(url.id, req.user!.id, url.url);
            console.log("URL processed synchronously successfully");
          } catch (syncError) {
            console.error("Synchronous processing also failed:", syncError);
          }
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
      
      // Detect if the message contains a request
      const requestAnalysis = await detectRequest(messageData.content);
      console.log(`Message analysis: isRequest=${requestAnalysis.isRequest}, confidence=${requestAnalysis.confidence}, reasoning="${requestAnalysis.reasoning}"`);
      
      let aiMessage = null;
      
      if (requestAnalysis.isRequest) {
        // Generate AI response for requests
        try {
          const chatHistory = await storage.getChatMessages(req.user!.id);
          const messages = chatHistory.map(msg => ({
            role: msg.role as "user" | "assistant",
            content: msg.content
          }));

          // Get user's research context
          const userContext = await getUserContext(req.user!.id);
          const systemPrompt = createContextAwarePrompt(userContext);
          
          console.log(`Using context-aware chat for user ${req.user!.id}:`, {
            hasContext: !!userContext,
            contextVersion: userContext?.version,
            contextLastUpdated: userContext?.lastUpdated,
            researchInterests: userContext?.researchInterests?.length || 0,
            currentProjects: userContext?.currentProjects?.length || 0
          });

          const response = await openai.chat.completions.create({
            model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
            messages: [
              {
                role: "system",
                content: systemPrompt
              },
              ...messages
            ],
          });

          const aiContent = response.choices[0].message.content || "I'm sorry, I couldn't generate a response.";
          
          // Save AI response
          aiMessage = await storage.createChatMessage(req.user!.id, {
            content: aiContent,
            role: "assistant"
          });
        } catch (aiError) {
          console.error("OpenAI API error:", aiError);
          res.status(500).json({ message: "Failed to get AI response" });
          return;
        }
      } else {
        // For observations, save an acknowledgment message
        aiMessage = await storage.createChatMessage(req.user!.id, {
          content: "",
          role: "assistant"
        });
      }

      res.json({ 
        userMessage, 
        aiMessage, 
        requestAnalysis: {
          isRequest: requestAnalysis.isRequest,
          confidence: requestAnalysis.confidence,
          reasoning: requestAnalysis.reasoning
        }
      });
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

  // PDF upload route
  app.post("/api/upload/pdf", authenticateToken, upload.single("pdf"), async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No PDF file uploaded" });
      }

      const file = req.file as Express.Multer.File;
      const fileName = file.originalname || "uploaded-document.pdf";
      
      console.log(`PDF uploaded: ${fileName} (${file.size} bytes)`);

      // Extract text from PDF
      let pdfText = "";
      let s3Url = "";
      
      try {
        console.log("File object:", {
          fieldname: file.fieldname,
          originalname: file.originalname,
          encoding: file.encoding,
          mimetype: file.mimetype,
          size: file.size,
          hasBuffer: !!file.buffer,
          bufferLength: file.buffer?.length
        });
        
        // File is in memory, use it directly
        const pdfBuffer = file.buffer;
        if (!pdfBuffer) {
          throw new Error("No file data available");
        }
        
        console.log(`Processing PDF buffer of size: ${pdfBuffer.length} bytes`);
        pdfText = await extractPdfText(pdfBuffer);
        console.log(`Extracted ${pdfText.length} characters from PDF`);
        
        // Upload file to S3 after processing
        if (isS3Configured()) {
          try {
            const { url } = await uploadFileToS3(pdfBuffer, fileName, req.user!.id);
            s3Url = url;
            console.log(`File uploaded to S3: ${s3Url}`);
          } catch (s3Error) {
            console.error("S3 upload failed:", s3Error);
            // Continue without S3 upload
          }
        }
      } catch (pdfError) {
        console.error("PDF parsing failed:", pdfError);
        return res.status(400).json({ message: "Failed to parse PDF content" });
      }

      // Create URL entry with S3 URL or placeholder
      const urlData = {
        url: s3Url || `pdf://${fileName}`, // S3 URL or placeholder
        title: fileName,
        notes: `PDF upload: ${fileName}`,
      };

      const url = await storage.createUrl(req.user!.id, urlData);
      console.log("URL created for PDF:", url);

      // Save PDF content to database
      const updatedUrl = await storage.updateUrlContent(url.id, req.user!.id, pdfText);
      
      if (!updatedUrl) {
        throw new Error("Failed to save PDF content");
      }

      // Analyze PDF content with AI
      const analysis = await analyzeContent(pdfText);
      
      // Store analysis results
      const urlWithAnalysis = await storage.updateUrlAnalysis(url.id, req.user!.id, analysis);
      
      if (!urlWithAnalysis) {
        throw new Error("Failed to save PDF analysis");
      }

      // PDF processing is already complete, no additional queue processing needed
      console.log("PDF processing completed successfully");

      res.json({
        success: true,
        url: urlWithAnalysis,
        message: "PDF uploaded and processed successfully",
        extractedTextLength: pdfText.length
      });
    } catch (error) {
      console.error("PDF upload error:", error);
      res.status(500).json({ message: "Failed to upload PDF" });
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

  // Admin routes
  app.get("/api/admin/users", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Check if user has admin role
      const user = await storage.getUser(req.user!.id);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const userStats = await storage.getAllUsersWithStats();
      res.json(userStats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user statistics" });
    }
  });

  app.put("/api/admin/users/:id/role", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Check if user has admin role
      const adminUser = await storage.getUser(req.user!.id);
      if (!adminUser || adminUser.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const userId = parseInt(req.params.id);
      const { role } = req.body;
      
      if (!role || !["user", "admin"].includes(role)) {
        return res.status(400).json({ message: "Invalid role. Must be 'user' or 'admin'" });
      }
      
      const updatedUser = await storage.updateUserRole(userId, role);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(updatedUser);
    } catch (error) {
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  // Get current user's context
  app.get("/api/user/context", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userContext = await getUserContext(req.user!.id);
      res.json({
        hasContext: !!userContext,
        context: userContext
      });
    } catch (error) {
      console.error('Error fetching user context:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user context',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get daily context summary
  app.get("/api/user/context-summary/:date", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { date } = req.params;
      const { contextSummaryTool } = await import('./mastra/tools/context-summary-tool.js');
      
      const result = await contextSummaryTool.execute({
        context: {
          userId: req.user!.id,
          date: date,
        },
      } as any);
      
      res.json({
        success: true,
        summary: result
      });
    } catch (error) {
      console.error('Error generating context summary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate context summary',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Pro Mode: Manage context profiles
  app.post("/api/pro/profiles", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { action, profileName, description, profileId } = req.body;
      const { contextProfileTool } = await import('./mastra/tools/context-profile-tool.js');
      
      const result = await contextProfileTool.execute({
        context: {
          action,
          userId: req.user!.id,
          profileName,
          description,
          profileId,
        },
      } as any);
      
      res.json(result);
    } catch (error) {
      console.error('Error managing context profiles:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to manage context profiles',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Pro Mode: Manual context update
  app.post("/api/pro/context-update", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { date, profileId, forceUpdate } = req.body;
      const { manualContextUpdateTool } = await import('./mastra/tools/manual-context-update-tool.js');
      
      const result = await manualContextUpdateTool.execute({
        context: {
          userId: req.user!.id,
          date,
          profileId,
          forceUpdate,
        },
      } as any);
      
      res.json(result);
    } catch (error) {
      console.error('Error in manual context update:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update context',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Pro Mode: Get user pro mode status
  app.get("/api/pro/status", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { getDb } = await import('./db.js');
      const { users } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      
      const db = getDb();
      const user = await db
        .select({ proMode: users.proMode })
        .from(users)
        .where(eq(users.id, req.user!.id))
        .limit(1);

      if (user.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        proMode: user[0].proMode
      });
    } catch (error) {
      console.error('Error getting pro mode status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get pro mode status',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Pro Mode: Toggle pro mode status
  app.post("/api/pro/toggle", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { getDb } = await import('./db.js');
      const { users } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      
      const db = getDb();
      
      // Get current pro mode status
      const currentUser = await db
        .select({ proMode: users.proMode })
        .from(users)
        .where(eq(users.id, req.user!.id))
        .limit(1);

      if (currentUser.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Toggle the pro mode status
      const newProModeStatus = !currentUser[0].proMode;
      
      await db
        .update(users)
        .set({ proMode: newProModeStatus })
        .where(eq(users.id, req.user!.id));

      res.json({
        success: true,
        proMode: newProModeStatus,
        message: `Pro mode ${newProModeStatus ? 'enabled' : 'disabled'} successfully`
      });
    } catch (error) {
      console.error('Error toggling pro mode:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to toggle pro mode',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Test route to manually trigger context generation
  app.post("/api/test/context", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { mastra } = await import('./mastra/index.js');
      const workflow = mastra.getWorkflow('userContextWorkflow');
      const run = await workflow.createRunAsync();
      const result = await run.start({
        inputData: {
          date: new Date().toISOString().split('T')[0], // Today's date
        },
      });
      
      if (result.status === 'success') {
        res.json({
          success: true,
          message: 'Context generation completed',
          result: result.result
        });
      } else if (result.status === 'failed') {
        res.status(500).json({
          success: false,
          message: 'Context generation failed',
          error: result.error?.message || 'Unknown error'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Context generation suspended or in unexpected state',
          status: result.status
        });
      }
    } catch (error) {
      console.error('Context generation test failed:', error);
      res.status(500).json({
        success: false,
        message: 'Context generation test failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ChromaDB Search Endpoints
  app.get("/api/search/chat", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { query, limit = 10 } = req.query;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ message: "Query parameter is required" });
      }

      // Check if storage has ChromaDB capabilities
      if ('searchChatMessages' in storage) {
        const results = await (storage as any).searchChatMessages(req.user!.id, query, parseInt(limit as string));
        res.json(results);
      } else {
        res.status(501).json({ message: "ChromaDB search not available" });
      }
    } catch (error) {
      console.error('ChromaDB chat search error:', error);
      res.status(500).json({ message: "Search failed" });
    }
  });

  app.get("/api/search/urls", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { query, limit = 10 } = req.query;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ message: "Query parameter is required" });
      }

      // Check if storage has ChromaDB capabilities
      if ('searchUrlContent' in storage) {
        const results = await (storage as any).searchUrlContent(req.user!.id, query, parseInt(limit as string));
        res.json(results);
      } else {
        res.status(501).json({ message: "ChromaDB search not available" });
      }
    } catch (error) {
      console.error('ChromaDB URL search error:', error);
      res.status(500).json({ message: "Search failed" });
    }
  });

  app.get("/api/search/analysis", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { query, limit = 10 } = req.query;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ message: "Query parameter is required" });
      }

      // Check if storage has ChromaDB capabilities
      if ('searchUrlAnalysis' in storage) {
        const results = await (storage as any).searchUrlAnalysis(req.user!.id, query, parseInt(limit as string));
        res.json(results);
      } else {
        res.status(501).json({ message: "ChromaDB search not available" });
      }
    } catch (error) {
      console.error('ChromaDB analysis search error:', error);
      res.status(500).json({ message: "Search failed" });
    }
  });

  app.get("/api/search/all", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { query, limit = 5 } = req.query;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ message: "Query parameter is required" });
      }

      // Check if storage has ChromaDB capabilities
      if ('searchAll' in storage) {
        const results = await (storage as any).searchAll(req.user!.id, query, parseInt(limit as string));
        res.json(results);
      } else {
        res.status(501).json({ message: "ChromaDB search not available" });
      }
    } catch (error) {
      console.error('ChromaDB all search error:', error);
      res.status(500).json({ message: "Search failed" });
    }
  });

  // RSS Feed endpoints
  app.get("/api/rss/feeds", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const feeds = await storage.getRssFeeds(req.user!.id);
      res.json(feeds);
    } catch (error) {
      console.error('Get RSS feeds error:', error);
      res.status(500).json({ message: 'Failed to get RSS feeds' });
    }
  });

  app.post("/api/rss/feeds", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { feedUrl, title, description, profileId = 0, fetchInterval = 1440, maxItemsPerFetch = 50 } = req.body;
      
      if (!feedUrl) {
        return res.status(400).json({ message: 'Feed URL is required' });
      }
      
      const feed = await storage.createRssFeed(req.user!.id, {
        feedUrl,
        title,
        description,
        profileId,
        fetchInterval,
        maxItemsPerFetch
      });
      
      res.json(feed);
    } catch (error) {
      console.error('Create RSS feed error:', error);
      res.status(500).json({ message: 'Failed to create RSS feed' });
    }
  });

  app.put("/api/rss/feeds/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const feedId = parseInt(req.params.id);
      const updates = req.body;
      
      const updatedFeed = await storage.updateRssFeed(feedId, req.user!.id, updates);
      if (!updatedFeed) {
        return res.status(404).json({ message: 'RSS feed not found' });
      }
      
      res.json(updatedFeed);
    } catch (error) {
      console.error('Update RSS feed error:', error);
      res.status(500).json({ message: 'Failed to update RSS feed' });
    }
  });

  app.delete("/api/rss/feeds/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const feedId = parseInt(req.params.id);
      
      const success = await storage.deleteRssFeed(feedId, req.user!.id);
      if (!success) {
        return res.status(404).json({ message: 'RSS feed not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Delete RSS feed error:', error);
      res.status(500).json({ message: 'Failed to delete RSS feed' });
    }
  });

  app.get("/api/rss/items", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { feedId } = req.query;
      
      const items = await storage.getRssFeedItems(req.user!.id, feedId ? parseInt(feedId as string) : undefined);
      res.json(items);
    } catch (error) {
      console.error('Get RSS items error:', error);
      res.status(500).json({ message: 'Failed to get RSS items' });
    }
  });

  app.post("/api/rss/process", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { feedId } = req.body;
      
      const { rssService } = await import('./rss-service.js');
      
      if (feedId) {
        // Process specific feed
        const result = await rssService.processSpecificFeed(feedId);
        res.json(result);
      } else {
        // Process all user feeds
        const result = await rssService.processAllUserFeeds(req.user!.id);
        res.json(result);
      }
    } catch (error) {
      console.error('Process RSS feeds error:', error);
      res.status(500).json({ message: 'Failed to process RSS feeds' });
    }
  });

  // Crawler endpoints
  app.get("/api/crawler/jobs", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const jobs = await storage.getCrawlerJobs(req.user!.id);
      res.json(jobs);
    } catch (error) {
      console.error('Get crawler jobs error:', error);
      res.status(500).json({ message: 'Failed to get crawler jobs' });
    }
  });

  app.post("/api/crawler/jobs", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { rootUrl, profileId = 0, maxPages = 100 } = req.body;
      
      if (!rootUrl) {
        return res.status(400).json({ message: 'Root URL is required' });
      }
      
      const job = await storage.createCrawlerJob(req.user!.id, {
        rootUrl,
        profileId,
        maxPages
      });
      
      // Start crawling in background
      setTimeout(async () => {
        try {
          const { crawlerService } = await import('./crawler-service.js');
          await crawlerService.crawlRootUrl(rootUrl, req.user!.id, profileId, { maxPages });
        } catch (error) {
          console.error('Background crawl failed:', error);
        }
      }, 1000);
      
      res.json(job);
    } catch (error) {
      console.error('Create crawler job error:', error);
      res.status(500).json({ message: 'Failed to create crawler job' });
    }
  });

  app.get("/api/crawler/jobs/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const jobId = parseInt(req.params.id);
      
      const jobs = await storage.getCrawlerJobs(req.user!.id);
      const targetJob = jobs.find(j => j.id === jobId);
      
      if (!targetJob) {
        return res.status(404).json({ message: 'Crawler job not found' });
      }
      
      res.json(targetJob);
    } catch (error) {
      console.error('Get crawler job error:', error);
      res.status(500).json({ message: 'Failed to get crawler job' });
    }
  });

  app.get("/api/crawler/jobs/:id/pages", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const jobId = parseInt(req.params.id);
      
      // Verify job belongs to user
      const jobs = await storage.getCrawlerJobs(req.user!.id);
      const job = jobs.find(j => j.id === jobId);
      
      if (!job) {
        return res.status(404).json({ message: 'Crawler job not found' });
      }
      
      const pages = await storage.getCrawlerPages(jobId);
      res.json(pages);
    } catch (error) {
      console.error('Get crawler pages error:', error);
      res.status(500).json({ message: 'Failed to get crawler pages' });
    }
  });

  // ChromaDB Health Check
  app.get("/api/chroma/health", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { chromaService } = await import('./chroma.js');
      const isHealthy = await chromaService.healthCheck();
      
      if (isHealthy) {
        res.json({ status: 'healthy', message: 'ChromaDB is operational' });
      } else {
        res.status(503).json({ status: 'unhealthy', message: 'ChromaDB is not responding' });
      }
    } catch (error) {
      console.error('ChromaDB health check error:', error);
      res.status(503).json({ status: 'error', message: 'ChromaDB health check failed' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
