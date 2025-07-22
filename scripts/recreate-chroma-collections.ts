#!/usr/bin/env tsx

import { CloudClient } from "chromadb";
import { DefaultEmbeddingFunction } from "@chroma-core/default-embed";
import dotenv from "dotenv";

dotenv.config();

const client = new CloudClient({
  apiKey: process.env.CHROMA_API_KEY || 'ck-BuiDsD8vkx79FXUcArJPPAcsPGi19ChPQh63Sk18mn59',
  tenant: process.env.CHROMA_TENANT || '44bcbb14-87f0-4601-9e2f-3bf64104d7c4',
  database: process.env.CHROMA_DATABASE || 'leo-as-a-service'
});

const COLLECTIONS = ['chat_messages', 'url_content', 'url_analysis'];

async function recreateCollections() {
  console.log('Starting ChromaDB collection recreation...');
  
  for (const collectionName of COLLECTIONS) {
    try {
      console.log(`\nProcessing collection: ${collectionName}`);
      
      // Try to delete existing collection
      try {
        await client.deleteCollection({ name: collectionName });
        console.log(`  ✓ Deleted existing collection: ${collectionName}`);
      } catch (error) {
        console.log(`  - Collection ${collectionName} doesn't exist or already deleted`);
      }
      
      // Create new collection with embedding function
      const collection = await client.createCollection({
        name: collectionName,
        embeddingFunction: new DefaultEmbeddingFunction()
      });
      
      console.log(`  ✓ Created collection: ${collectionName} with embedding function`);
      
    } catch (error) {
      console.error(`  ✗ Error processing collection ${collectionName}:`, error);
    }
  }
  
  console.log('\nChromaDB collection recreation completed!');
}

// Run the script
recreateCollections().catch(console.error); 