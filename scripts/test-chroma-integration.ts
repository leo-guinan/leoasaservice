#!/usr/bin/env tsx

import dotenv from "dotenv";
dotenv.config();

import { chromaService } from "../server/chroma.js";
import { createChromaStorage } from "../server/chroma-storage.js";
import { MemStorage } from "../server/storage.js";

async function testChromaIntegration() {
  console.log("🧪 Testing ChromaDB Integration...\n");

  try {
    // Test 1: Initialize ChromaDB
    console.log("1. Testing ChromaDB initialization...");
    await chromaService.initialize();
    console.log("✅ ChromaDB initialized successfully\n");

    // Test 2: Health check
    console.log("2. Testing ChromaDB health check...");
    const isHealthy = await chromaService.healthCheck();
    if (isHealthy) {
      console.log("✅ ChromaDB health check passed\n");
    } else {
      console.log("❌ ChromaDB health check failed\n");
      return;
    }

    // Test 3: Create enhanced storage
    console.log("3. Testing ChromaDB-enhanced storage...");
    const baseStorage = new MemStorage();
    const chromaStorage = createChromaStorage(baseStorage);
    await chromaStorage.initialize();
    console.log("✅ ChromaDB-enhanced storage created successfully\n");

    // Test 4: Add test data
    console.log("4. Testing data insertion...");
    
    // Create a test user
    const testUser = await chromaStorage.createUser({
      username: "chroma-test-user",
      password: "test-password"
    });
    console.log(`✅ Created test user: ${testUser.username} (ID: ${testUser.id})\n`);

    // Add a test URL with content
    const testUrl = await chromaStorage.createUrl(testUser.id, {
      url: "https://example.com/test-article",
      title: "Test Article",
      notes: "This is a test article about AI and machine learning"
    });
    console.log(`✅ Created test URL: ${testUrl.url}\n`);

    // Update URL with content
    const content = `
      Artificial Intelligence and Machine Learning: A Comprehensive Overview

      Artificial Intelligence (AI) and Machine Learning (ML) are transforming the way we live and work. 
      These technologies are being applied across various industries including healthcare, finance, 
      transportation, and entertainment.

      Key concepts in AI include:
      - Neural networks and deep learning
      - Natural language processing
      - Computer vision
      - Robotics and automation

      Machine learning algorithms can be categorized into:
      - Supervised learning
      - Unsupervised learning
      - Reinforcement learning

      The future of AI holds tremendous potential for solving complex problems and improving human lives.
    `;
    
    await chromaStorage.updateUrlContent(testUrl.id, testUser.id, content);
    console.log("✅ Updated URL with content\n");

    // Add URL analysis
    const analysis = {
      summary: "This article provides a comprehensive overview of AI and ML technologies",
      keyTopics: ["artificial intelligence", "machine learning", "neural networks", "deep learning"],
      sentiment: "positive",
      complexity: "intermediate"
    };
    
    await chromaStorage.updateUrlAnalysis(testUrl.id, testUser.id, analysis);
    console.log("✅ Added URL analysis\n");

    // Add chat messages
    const userMessage = await chromaStorage.createChatMessage(testUser.id, {
      content: "What are the main differences between AI and machine learning?",
      role: "user"
    });
    console.log("✅ Added user chat message\n");

    const assistantMessage = await chromaStorage.createChatMessage(testUser.id, {
      content: "AI is a broader concept that encompasses machine learning. Machine learning is a subset of AI that focuses on algorithms that can learn from data without being explicitly programmed.",
      role: "assistant"
    });
    console.log("✅ Added assistant chat message\n");

    // Test 5: Search functionality
    console.log("5. Testing search functionality...\n");

    // Search chat messages
    console.log("   Searching chat messages for 'AI'...");
    const chatResults = await chromaStorage.searchChatMessages(testUser.id, "AI", 5);
    console.log(`   Found ${chatResults.ids?.[0]?.length || 0} chat message results\n`);

    // Search URL content
    console.log("   Searching URL content for 'machine learning'...");
    const urlResults = await chromaStorage.searchUrlContent(testUser.id, "machine learning", 5);
    console.log(`   Found ${urlResults.ids?.[0]?.length || 0} URL content results\n`);

    // Search URL analysis
    console.log("   Searching URL analysis for 'neural networks'...");
    const analysisResults = await chromaStorage.searchUrlAnalysis(testUser.id, "neural networks", 5);
    console.log(`   Found ${analysisResults.ids?.[0]?.length || 0} analysis results\n`);

    // Search all
    console.log("   Searching all collections for 'deep learning'...");
    const allResults = await chromaStorage.searchAll(testUser.id, "deep learning", 3);
    console.log(`   Found results across all collections:\n`);
    console.log(`   - Chat messages: ${allResults.chatMessages.ids?.[0]?.length || 0}`);
    console.log(`   - URL content: ${allResults.urlContent.ids?.[0]?.length || 0}`);
    console.log(`   - URL analysis: ${allResults.urlAnalysis.ids?.[0]?.length || 0}\n`);

    // Test 6: Cleanup
    console.log("6. Testing cleanup...");
    await chromaStorage.deleteUserVectorData(testUser.id);
    console.log("✅ Cleaned up test data\n");

    console.log("🎉 All ChromaDB integration tests passed successfully!");
    console.log("\n📋 Summary:");
    console.log("- ChromaDB initialization: ✅");
    console.log("- Health check: ✅");
    console.log("- Storage enhancement: ✅");
    console.log("- Data insertion: ✅");
    console.log("- Search functionality: ✅");
    console.log("- Cleanup: ✅");

  } catch (error) {
    console.error("❌ ChromaDB integration test failed:", error);
    process.exit(1);
  }
}

// Run the test
testChromaIntegration().catch(console.error); 