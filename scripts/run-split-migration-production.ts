#!/usr/bin/env tsx

import { storage } from '../server/storage';
import { chromaService } from '../server/chroma';
import { nanoid } from 'nanoid';
import dotenv from 'dotenv';

dotenv.config();

interface MigrationStats {
  users: number;
  chatMessages: { total: number; migrated: number; skipped: number; failed: number; parts: number };
  urls: { total: number; migrated: number; skipped: number; failed: number; parts: number };
  urlAnalysis: { total: number; migrated: number; skipped: number; failed: number; parts: number };
  contextUrls: { total: number; migrated: number; skipped: number; failed: number; parts: number };
  contextChatMessages: { total: number; migrated: number; skipped: number; failed: number; parts: number };
  errors: string[];
}

class ProductionSplitChromaMigrationService {
  private stats: MigrationStats = {
    users: 0,
    chatMessages: { total: 0, migrated: 0, skipped: 0, failed: 0, parts: 0 },
    urls: { total: 0, migrated: 0, skipped: 0, failed: 0, parts: 0 },
    urlAnalysis: { total: 0, migrated: 0, skipped: 0, failed: 0, parts: 0 },
    contextUrls: { total: 0, migrated: 0, skipped: 0, failed: 0, parts: 0 },
    contextChatMessages: { total: 0, migrated: 0, skipped: 0, failed: 0, parts: 0 },
    errors: []
  };

  private existingIds = {
    chatMessages: new Set<string>(),
    urlContent: new Set<string>(),
    urlAnalysis: new Set<string>()
  };

  // ChromaDB limits
  private readonly CHROMA_LIMITS = {
    DOCUMENT_SIZE_BYTES: 16384, // 16KB
    METADATA_VALUE_SIZE_BYTES: 256, // 256 bytes
    METADATA_TOTAL_SIZE_BYTES: 4096 // 4KB
  };

  // Chunk size for splitting (leave some buffer for metadata)
  private readonly CHUNK_SIZE_BYTES = 14000; // ~14KB to leave room for metadata

  async initialize() {
    console.log('🚀 Initializing Production Split ChromaDB Migration Service...');
    
    try {
      await storage.initialize();
      await chromaService.initialize();
      
      console.log('✅ Storage and ChromaDB initialized');
    } catch (error) {
      console.error('❌ Failed to initialize:', error);
      throw error;
    }
  }

  async loadExistingChromaData() {
    console.log('📊 Loading existing ChromaDB data to avoid duplicates...');
    
    try {
      // Load existing chat messages (limited by quota)
      const existingChatMessagesResult = await chromaService.getChatMessagesByUser(0, 100);
      const existingChatMessages = existingChatMessagesResult.ids?.map((id: string, index: number) => ({
        id,
        content: existingChatMessagesResult.documents?.[index] || '',
        metadata: existingChatMessagesResult.metadatas?.[index] || {}
      })) || [];
      existingChatMessages.forEach(msg => {
        if (msg.metadata?.messageId) {
          this.existingIds.chatMessages.add(`msg_${msg.metadata.messageId}`);
        }
      });
      console.log(`   Found ${existingChatMessages.length} existing chat messages (limited to 100 due to quota)`);

      // Load existing URL content (limited by quota)
      const existingUrlContentResult = await chromaService.getUrlContentByUser(0, 100);
      const existingUrlContent = existingUrlContentResult.ids?.map((id: string, index: number) => ({
        id,
        content: existingUrlContentResult.documents?.[index] || '',
        metadata: existingUrlContentResult.metadatas?.[index] || {}
      })) || [];
      existingUrlContent.forEach(url => {
        if (url.metadata?.urlId) {
          this.existingIds.urlContent.add(`url_${url.metadata.urlId}`);
        }
      });
      console.log(`   Found ${existingUrlContent.length} existing URL content entries (limited to 100 due to quota)`);

      // Load existing URL analysis (limited by quota)
      const existingUrlAnalysisResult = await chromaService.getUrlAnalysisByUser(0, 100);
      const existingUrlAnalysis = existingUrlAnalysisResult.ids?.map((id: string, index: number) => ({
        id,
        content: existingUrlAnalysisResult.documents?.[index] || '',
        metadata: existingUrlAnalysisResult.metadatas?.[index] || {}
      })) || [];
      existingUrlAnalysis.forEach(analysis => {
        if (analysis.metadata?.urlId) {
          this.existingIds.urlAnalysis.add(`analysis_${analysis.metadata.urlId}`);
        }
      });
      console.log(`   Found ${existingUrlAnalysis.length} existing URL analysis entries (limited to 100 due to quota)`);

    } catch (error) {
      console.warn('⚠️ Could not load existing ChromaDB data:', error);
    }
  }

  async migrateAllData() {
    console.log('\n🔄 Starting production split data migration to ChromaDB...\n');

    try {
      const usersWithStats = await storage.getAllUsersWithStats();
      this.stats.users = usersWithStats.length;
      console.log(`👥 Found ${usersWithStats.length} users to process`);

      for (const { user } of usersWithStats) {
        console.log(`\n📋 Processing user: ${user.username} (ID: ${user.id})`);
        
        await this.migrateUserData(user.id);
      }

      console.log('\n🎉 Migration completed!');
      this.printStats();

    } catch (error) {
      console.error('❌ Migration failed:', error);
      this.stats.errors.push(error instanceof Error ? error.message : 'Unknown error');
      this.printStats();
      throw error;
    }
  }

  private async migrateUserData(userId: number) {
    try {
      await this.migrateChatMessages(userId);
      await this.migrateUrls(userId);
      await this.migrateContextData(userId);
    } catch (error) {
      const errorMsg = `Failed to migrate user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`❌ ${errorMsg}`);
      this.stats.errors.push(errorMsg);
    }
  }

  private async migrateChatMessages(userId: number) {
    try {
      const messages = await storage.getChatMessages(userId);
      this.stats.chatMessages.total += messages.length;
      
      console.log(`   💬 Processing ${messages.length} chat messages...`);
      
      for (const message of messages) {
        const messageId = `msg_${message.id}`;
        
        if (this.existingIds.chatMessages.has(messageId)) {
          this.stats.chatMessages.skipped++;
          continue;
        }

        try {
          const chunks = this.splitContentIntoChunks(message.content);
          const baseMetadata = {
            userId: message.userId,
            role: message.role as 'user' | 'assistant',
            timestamp: message.createdAt.toISOString(),
            messageId: message.id,
            totalParts: chunks.length
          };

          for (let i = 0; i < chunks.length; i++) {
            const document = {
              id: nanoid(),
              content: chunks[i],
              metadata: {
                ...baseMetadata,
                partIndex: i,
                isPart: chunks.length > 1
              }
            };

            await chromaService.addChatMessage(document);
            this.stats.chatMessages.parts++;
          }

          this.existingIds.chatMessages.add(messageId);
          this.stats.chatMessages.migrated++;
          
          if (chunks.length > 1) {
            console.log(`   📄 Split message ${message.id} into ${chunks.length} parts`);
          }
          
        } catch (error) {
          const errorMsg = `Failed to migrate chat message ${message.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.warn(`   ⚠️ ${errorMsg}`);
          this.stats.errors.push(errorMsg);
          this.stats.chatMessages.failed++;
        }
      }
      
      console.log(`   ✅ Migrated ${this.stats.chatMessages.migrated} chat messages (${this.stats.chatMessages.parts} parts), skipped ${this.stats.chatMessages.skipped}, failed ${this.stats.chatMessages.failed}`);
      
    } catch (error) {
      throw new Error(`Failed to migrate chat messages for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async migrateUrls(userId: number) {
    try {
      const urls = await storage.getUrls(userId);
      this.stats.urls.total += urls.length;
      
      console.log(`   🔗 Processing ${urls.length} URLs...`);
      
      for (const url of urls) {
        // Migrate URL content if available
        if (url.content) {
          const contentId = `url_${url.id}`;
          
          if (!this.existingIds.urlContent.has(contentId)) {
            try {
              const chunks = this.splitContentIntoChunks(url.content);
              const baseMetadata = this.processMetadataForChroma({
                userId: url.userId,
                url: url.url,
                title: url.title || undefined,
                urlId: url.id,
                timestamp: url.createdAt.toISOString(),
                totalParts: chunks.length
              });

              for (let i = 0; i < chunks.length; i++) {
                const document = {
                  id: nanoid(),
                  content: chunks[i],
                  metadata: {
                    ...baseMetadata,
                    partIndex: i,
                    isPart: chunks.length > 1
                  }
                };

                await chromaService.addUrlContent(document as any);
                this.stats.urls.parts++;
              }

              this.existingIds.urlContent.add(contentId);
              this.stats.urls.migrated++;
              
              if (chunks.length > 1) {
                console.log(`   📄 Split URL content ${url.id} into ${chunks.length} parts`);
              }
              
            } catch (error) {
              const errorMsg = `Failed to migrate URL content ${url.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
              console.warn(`   ⚠️ ${errorMsg}`);
              this.stats.errors.push(errorMsg);
              this.stats.urls.failed++;
            }
          }
        }

        // Migrate URL analysis if available
        if (url.analysis) {
          const analysisId = `analysis_${url.id}`;
          
          if (!this.existingIds.urlAnalysis.has(analysisId)) {
            try {
              const analysisString = typeof url.analysis === 'string' ? url.analysis : JSON.stringify(url.analysis);
              const chunks = this.splitContentIntoChunks(analysisString);
              const baseMetadata = this.processMetadataForChroma({
                userId: url.userId,
                url: url.url,
                urlId: url.id,
                analysisType: 'ai_analysis',
                timestamp: url.updatedAt?.toISOString() || url.createdAt.toISOString(),
                totalParts: chunks.length
              });

              for (let i = 0; i < chunks.length; i++) {
                const document = {
                  id: nanoid(),
                  content: chunks[i],
                  metadata: {
                    ...baseMetadata,
                    partIndex: i,
                    isPart: chunks.length > 1
                  }
                };

                await chromaService.addUrlAnalysis(document as any);
                this.stats.urlAnalysis.parts++;
              }

              this.existingIds.urlAnalysis.add(analysisId);
              this.stats.urlAnalysis.migrated++;
              
              if (chunks.length > 1) {
                console.log(`   📄 Split URL analysis ${url.id} into ${chunks.length} parts`);
              }
              
            } catch (error) {
              const errorMsg = `Failed to migrate URL analysis ${url.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
              console.warn(`   ⚠️ ${errorMsg}`);
              this.stats.errors.push(errorMsg);
              this.stats.urlAnalysis.failed++;
            }
          }
        }
      }
      
      console.log(`   ✅ Migrated ${this.stats.urls.migrated} URL content/analysis entries (${this.stats.urls.parts} parts), failed ${this.stats.urls.failed}`);
      
    } catch (error) {
      throw new Error(`Failed to migrate URLs for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async migrateContextData(userId: number) {
    try {
      // Check if getUserContextProfiles method exists
      if (typeof storage.getUserContextProfiles !== 'function') {
        console.log(`   ⚠️ getUserContextProfiles not available for user ${userId}, skipping context data`);
        return;
      }

      try {
        const profiles = await storage.getUserContextProfiles(userId);
        
        for (const profile of profiles) {
          console.log(`   📁 Processing context profile: ${profile.name} (ID: ${profile.id})`);
          
          // Migrate context URLs
          const contextUrls = await storage.getContextUrls(userId, profile.id);
          this.stats.contextUrls.total += contextUrls.length;
          
          for (const url of contextUrls) {
            if (url.content) {
              const contentId = `ctx_url_${url.id}`;
              
              if (!this.existingIds.urlContent.has(contentId)) {
                try {
                  const chunks = this.splitContentIntoChunks(url.content);
                  const baseMetadata = this.processMetadataForChroma({
                    userId: url.userId,
                    url: url.url,
                    title: url.title || undefined,
                    urlId: url.id,
                    profileId: profile.id,
                    profileName: profile.name,
                    timestamp: url.createdAt.toISOString(),
                    context: true,
                    totalParts: chunks.length
                  });

                  for (let i = 0; i < chunks.length; i++) {
                    const document = {
                      id: nanoid(),
                      content: chunks[i],
                      metadata: {
                        ...baseMetadata,
                        partIndex: i,
                        isPart: chunks.length > 1
                      }
                    };

                    await chromaService.addUrlContent(document as any);
                    this.stats.contextUrls.parts++;
                  }

                  this.existingIds.urlContent.add(contentId);
                  this.stats.contextUrls.migrated++;
                  
                  if (chunks.length > 1) {
                    console.log(`   📄 Split context URL ${url.id} into ${chunks.length} parts`);
                  }
                  
                } catch (error) {
                  const errorMsg = `Failed to migrate context URL ${url.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                  console.warn(`   ⚠️ ${errorMsg}`);
                  this.stats.errors.push(errorMsg);
                  this.stats.contextUrls.failed++;
                }
              }
            }
          }

          // Migrate context chat messages
          const contextMessages = await storage.getContextChatMessages(userId, profile.id);
          this.stats.contextChatMessages.total += contextMessages.length;
          
          for (const message of contextMessages) {
            const messageId = `ctx_msg_${message.id}`;
            
            if (!this.existingIds.chatMessages.has(messageId)) {
              try {
                const chunks = this.splitContentIntoChunks(message.content);
                const baseMetadata = {
                  userId: message.userId,
                  role: message.role as 'user' | 'assistant',
                  timestamp: message.createdAt.toISOString(),
                  messageId: message.id,
                  profileId: profile.id,
                  profileName: profile.name,
                  context: true,
                  totalParts: chunks.length
                };

                for (let i = 0; i < chunks.length; i++) {
                  const document = {
                    id: nanoid(),
                    content: chunks[i],
                    metadata: {
                      ...baseMetadata,
                      partIndex: i,
                      isPart: chunks.length > 1
                    }
                  };

                  await chromaService.addChatMessage(document);
                  this.stats.contextChatMessages.parts++;
                }

                this.existingIds.chatMessages.add(messageId);
                this.stats.contextChatMessages.migrated++;
                
                if (chunks.length > 1) {
                  console.log(`   📄 Split context message ${message.id} into ${chunks.length} parts`);
                }
                
              } catch (error) {
                const errorMsg = `Failed to migrate context chat message ${message.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                console.warn(`   ⚠️ ${errorMsg}`);
                this.stats.errors.push(errorMsg);
                this.stats.contextChatMessages.failed++;
              }
            }
          }
        }
        
        console.log(`   ✅ Migrated ${this.stats.contextUrls.migrated} context URLs (${this.stats.contextUrls.parts} parts), ${this.stats.contextChatMessages.migrated} context messages (${this.stats.contextChatMessages.parts} parts)`);
        
      } catch (error) {
        // If context migration fails due to schema issues, log and continue
        const errorMsg = `Context migration failed for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.log(`   ⚠️ ${errorMsg} - This is likely due to missing database schema. Continuing with other data...`);
        this.stats.errors.push(errorMsg);
      }
      
    } catch (error) {
      throw new Error(`Failed to migrate context data for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private splitContentIntoChunks(content: string): string[] {
    const contentBytes = Buffer.byteLength(content, 'utf8');
    
    if (contentBytes <= this.CHUNK_SIZE_BYTES) {
      return [content];
    }

    const chunks: string[] = [];
    let currentChunk = '';
    let currentChunkBytes = 0;
    
    // Split by words to preserve word boundaries
    const words = content.split(/\s+/);
    
    for (const word of words) {
      const wordBytes = Buffer.byteLength(word + ' ', 'utf8');
      
      if (currentChunkBytes + wordBytes <= this.CHUNK_SIZE_BYTES) {
        currentChunk += (currentChunk ? ' ' : '') + word;
        currentChunkBytes += wordBytes;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        currentChunk = word;
        currentChunkBytes = wordBytes;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }

  private processMetadataForChroma(metadata: Record<string, any>): Record<string, any> {
    const processed: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(metadata)) {
      if (value === null || value === undefined) {
        continue;
      }
      
      const stringValue = String(value);
      const valueBytes = Buffer.byteLength(stringValue, 'utf8');
      
      if (valueBytes <= this.CHROMA_LIMITS.METADATA_VALUE_SIZE_BYTES) {
        processed[key] = value;
      } else {
        // Truncate metadata value if it's too large
        const truncated = stringValue.substring(0, Math.floor(this.CHROMA_LIMITS.METADATA_VALUE_SIZE_BYTES * 0.9));
        processed[key] = truncated + ' [TRUNCATED]';
      }
    }
    
    return processed;
  }

  private printStats() {
    console.log('\n📊 Migration Statistics:');
    console.log('========================');
    console.log(`👥 Users processed: ${this.stats.users}`);
    console.log(`💬 Chat Messages:`);
    console.log(`   Total: ${this.stats.chatMessages.total}`);
    console.log(`   Migrated: ${this.stats.chatMessages.migrated}`);
    console.log(`   Parts: ${this.stats.chatMessages.parts}`);
    console.log(`   Skipped: ${this.stats.chatMessages.skipped}`);
    console.log(`   Failed: ${this.stats.chatMessages.failed}`);
    console.log(`🔗 URLs:`);
    console.log(`   Total: ${this.stats.urls.total}`);
    console.log(`   Migrated: ${this.stats.urls.migrated}`);
    console.log(`   Parts: ${this.stats.urls.parts}`);
    console.log(`   Skipped: ${this.stats.urls.skipped}`);
    console.log(`   Failed: ${this.stats.urls.failed}`);
    console.log(`📊 URL Analysis:`);
    console.log(`   Total: ${this.stats.urlAnalysis.total}`);
    console.log(`   Migrated: ${this.stats.urlAnalysis.migrated}`);
    console.log(`   Parts: ${this.stats.urlAnalysis.parts}`);
    console.log(`   Skipped: ${this.stats.urlAnalysis.skipped}`);
    console.log(`   Failed: ${this.stats.urlAnalysis.failed}`);
    console.log(`📁 Context URLs:`);
    console.log(`   Total: ${this.stats.contextUrls.total}`);
    console.log(`   Migrated: ${this.stats.contextUrls.migrated}`);
    console.log(`   Parts: ${this.stats.contextUrls.parts}`);
    console.log(`   Skipped: ${this.stats.contextUrls.skipped}`);
    console.log(`   Failed: ${this.stats.contextUrls.failed}`);
    console.log(`💬 Context Chat Messages:`);
    console.log(`   Total: ${this.stats.contextChatMessages.total}`);
    console.log(`   Migrated: ${this.stats.contextChatMessages.migrated}`);
    console.log(`   Parts: ${this.stats.contextChatMessages.parts}`);
    console.log(`   Skipped: ${this.stats.contextChatMessages.skipped}`);
    console.log(`   Failed: ${this.stats.contextChatMessages.failed}`);
    
    if (this.stats.errors.length > 0) {
      console.log(`\n❌ Errors (${this.stats.errors.length}):`);
      this.stats.errors.slice(0, 10).forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
      if (this.stats.errors.length > 10) {
        console.log(`   ... and ${this.stats.errors.length - 10} more errors`);
      }
    }
  }
}

async function main() {
  console.log('🚀 Production Split ChromaDB Migration Script');
  console.log('============================================\n');

  const migrationService = new ProductionSplitChromaMigrationService();

  try {
    await migrationService.initialize();
    await migrationService.loadExistingChromaData();
    await migrationService.migrateAllData();
    
    console.log('\n✅ Production split migration completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
main().catch(console.error); 