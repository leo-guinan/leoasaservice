import dotenv from "dotenv";
dotenv.config();

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";


const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Security middleware to block directory traversal attacks
app.use((req, res, next) => {
  const path = req.path;
  
  // Block suspicious paths that are commonly used in attacks
  const suspiciousPatterns = [
    /\/api\/backup\//,
    /\/api\/config\//,
    /\/api\/data\//,
    /\/api\/admin\//,
    /\/api\/logs\//,
    /\/api\/debug\//,
    /\/api\/test\//,
    /\/api\/wp-/,
    /\/api\/\.env/,
    /\/api\/\.git/,
    /\/api\/\.ssh/,
    /\/api\/\.htaccess/,
    /\/api\/\.htpasswd/,
    /\/api\/web\.config/,
    /\/api\/php\.ini/,
    /\/api\/config\.php/,
    /\/api\/database\./,
    /\/api\/db\./,
    /\/api\/users\./,
    /\/api\/site\./,
    /\/api\/debug\./,
    /\/api\/log\./,
    /\/api\/secret\./,
    /\/api\/settings\./,
    /\/api\/env\./,
    /\/api\/default\./,
    /\/api\/info\./,
    /\/api\/login\./,
    /\/api\/main\./,
    /\/api\/readme\./,
    /\/api\/sample\./,
    /\/api\/test\./,
    /\/api\/wp-config\./,
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(path)) {
      console.log(`🚨 Blocked suspicious request: ${req.method} ${path} from ${req.ip}`);
      return res.status(404).json({ error: "Not found" });
    }
  }
  
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize storage with default user
  await storage.initialize();
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`serving on port ${port}`);
  });
})();
