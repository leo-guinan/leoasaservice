#!/usr/bin/env tsx

import dotenv from "dotenv";
dotenv.config();

import { CloudClient } from "chromadb";

async function deleteChromaCollections() {
  console.log("🗑️  Deleting ChromaDB collections...\n");

  try {
    // Initialize ChromaDB client
    const client = new CloudClient({
      apiKey: process.env.CHROMA_API_KEY || 'ck-BuiDsD8vkx79FXUcArJPPAcsPGi19ChPQh63Sk18mn59',
      tenant: process.env.CHROMA_TENANT || '44bcbb14-87f0-4601-9e2f-3bf64104d7c4',
      database: process.env.CHROMA_DATABASE || 'leo-as-a-service'
    });

    const collections = ['chat_messages', 'url_content', 'url_analysis'];

    for (const collectionName of collections) {
      try {
        console.log(`Deleting collection: ${collectionName}...`);
        await client.deleteCollection({ name: collectionName });
        console.log(`✅ Deleted collection: ${collectionName}`);
      } catch (error) {
        console.log(`⚠️  Collection ${collectionName} not found or already deleted`);
      }
    }

    console.log("\n🎉 All ChromaDB collections deleted successfully!");

  } catch (error) {
    console.error("❌ Failed to delete ChromaDB collections:", error);
    process.exit(1);
  }
}

// Run the cleanup
deleteChromaCollections().catch(console.error); 