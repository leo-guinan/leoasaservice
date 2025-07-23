#!/usr/bin/env tsx

import { storage } from '../server/storage';
import { chromaService } from '../server/chroma';
import { nanoid } from 'nanoid';
import dotenv from 'dotenv';

dotenv.config();

interface MigrationStats {
  users: number;
  chatMessages: { total: number; migrated: number; skipped: number };
  urls: { total: number; migrated: number; skipped: number };
  urlAnalysis: { total: number; migrated: number; skipped: number };
  contextUrls: { total: number; migrated: number; skipped: number };
  contextChatMessages: { total: number; migrated: number; skipped: number };
  errors: string[];
}

class ChromaMigrationService {
  private stats: MigrationStats = {
    users: 0,
    chatMessages: { total: 0, migrated: 0, skipped: 0 },
    urls: { total: 0, migrated: 0, skipped: 0 },
    urlAnalysis: { total: 0, migrated: 0, skipped: 0 },
    contextUrls: { total: 0, migrated: 0, skipped: 0 },
    contextChatMessages: { total: 0, migrated: 0, skipped: 0 },
    errors: []
  };

  private existingIds = {
    chatMessages: new Set<string>(),
    urlContent: new Set<string>(),
    urlAnalysis: new Set<string>()
  };

  async initialize() {
    console.log('🚀 Initializing ChromaDB Migration Service...');
    
    try {
      // Initialize storage and ChromaDB
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
    console.log('\n🔄 Starting data migration to ChromaDB...\n');

    try {
      // Get all users
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
      // Migrate main chat messages
      await this.migrateChatMessages(userId);
      
      // Migrate main URLs and their content/analysis
      await this.migrateUrls(userId);
      
      // Migrate context-specific data
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
          const document = {
            id: nanoid(),
            content: message.content,
            metadata: {
              userId: message.userId,
              role: message.role as 'user' | 'assistant',
              timestamp: message.createdAt.toISOString(),
              messageId: message.id
            }
          };

          await chromaService.addChatMessage(document);
          this.existingIds.chatMessages.add(messageId);
          this.stats.chatMessages.migrated++;
          
        } catch (error) {
          const errorMsg = `Failed to migrate chat message ${message.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.warn(`   ⚠️ ${errorMsg}`);
          this.stats.errors.push(errorMsg);
        }
      }
      
      console.log(`   ✅ Migrated ${this.stats.chatMessages.migrated} chat messages, skipped ${this.stats.chatMessages.skipped}`);
      
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
              const document = {
                id: nanoid(),
                content: url.content,
                metadata: {
                  userId: url.userId,
                  url: url.url,
                  title: url.title || undefined,
                  urlId: url.id,
                  timestamp: url.createdAt.toISOString()
                }
              };

              await chromaService.addUrlContent(document);
              this.existingIds.urlContent.add(contentId);
              this.stats.urlAnalysis.migrated++;
              
            } catch (error) {
              const errorMsg = `Failed to migrate URL content ${url.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
              console.warn(`   ⚠️ ${errorMsg}`);
              this.stats.errors.push(errorMsg);
            }
          }
        }

        // Migrate URL analysis if available
        if (url.analysis) {
          const analysisId = `analysis_${url.id}`;
          
          if (!this.existingIds.urlAnalysis.has(analysisId)) {
            try {
              const document = {
                id: nanoid(),
                content: JSON.stringify(url.analysis),
                metadata: {
                  userId: url.userId,
                  url: url.url,
                  urlId: url.id,
                  analysisType: 'ai_analysis',
                  timestamp: url.updatedAt?.toISOString() || url.createdAt.toISOString()
                }
              };

              await chromaService.addUrlAnalysis(document);
              this.existingIds.urlAnalysis.add(analysisId);
              this.stats.urlAnalysis.migrated++;
              
            } catch (error) {
              const errorMsg = `Failed to migrate URL analysis ${url.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
              console.warn(`   ⚠️ ${errorMsg}`);
              this.stats.errors.push(errorMsg);
            }
          }
        }
      }
      
      console.log(`   ✅ Migrated ${this.stats.urlAnalysis.migrated} URL content/analysis entries`);
      
    } catch (error) {
      throw new Error(`Failed to migrate URLs for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async migrateContextData(userId: number) {
    try {
      // Get all context profiles for the user
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
                const document = {
                  id: nanoid(),
                  content: url.content,
                  metadata: {
                    userId: url.userId,
                    url: url.url,
                    title: url.title || undefined,
                    urlId: url.id,
                    profileId: profile.id,
                    profileName: profile.name,
                    timestamp: url.createdAt.toISOString(),
                    context: true
                  }
                };

                await chromaService.addUrlContent(document);
                this.existingIds.urlContent.add(contentId);
                this.stats.contextUrls.migrated++;
                
              } catch (error) {
                const errorMsg = `Failed to migrate context URL ${url.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                console.warn(`   ⚠️ ${errorMsg}`);
                this.stats.errors.push(errorMsg);
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
              const document = {
                id: nanoid(),
                content: message.content,
                metadata: {
                  userId: message.userId,
                  role: message.role as 'user' | 'assistant',
                  timestamp: message.createdAt.toISOString(),
                  messageId: message.id,
                  profileId: profile.id,
                  profileName: profile.name,
                  context: true
                }
              };

              await chromaService.addChatMessage(document);
              this.existingIds.chatMessages.add(messageId);
              this.stats.contextChatMessages.migrated++;
              
            } catch (error) {
              const errorMsg = `Failed to migrate context chat message ${message.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
              console.warn(`   ⚠️ ${errorMsg}`);
              this.stats.errors.push(errorMsg);
            }
          }
        }
      }
      
      console.log(`   ✅ Migrated ${this.stats.contextUrls.migrated} context URLs, ${this.stats.contextChatMessages.migrated} context messages`);
      
    } catch (error) {
      throw new Error(`Failed to migrate context data for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private printStats() {
    console.log('\n📊 Migration Statistics:');
    console.log('========================');
    console.log(`👥 Users processed: ${this.stats.users}`);
    console.log(`💬 Chat Messages:`);
    console.log(`   Total: ${this.stats.chatMessages.total}`);
    console.log(`   Migrated: ${this.stats.chatMessages.migrated}`);
    console.log(`   Skipped: ${this.stats.chatMessages.skipped}`);
    console.log(`🔗 URLs:`);
    console.log(`   Total: ${this.stats.urls.total}`);
    console.log(`   Migrated: ${this.stats.urls.migrated}`);
    console.log(`   Skipped: ${this.stats.urls.skipped}`);
    console.log(`📊 URL Analysis:`);
    console.log(`   Total: ${this.stats.urlAnalysis.total}`);
    console.log(`   Migrated: ${this.stats.urlAnalysis.migrated}`);
    console.log(`   Skipped: ${this.stats.urlAnalysis.skipped}`);
    console.log(`📁 Context URLs:`);
    console.log(`   Total: ${this.stats.contextUrls.total}`);
    console.log(`   Migrated: ${this.stats.contextUrls.migrated}`);
    console.log(`   Skipped: ${this.stats.contextUrls.skipped}`);
    console.log(`💬 Context Chat Messages:`);
    console.log(`   Total: ${this.stats.contextChatMessages.total}`);
    console.log(`   Migrated: ${this.stats.contextChatMessages.migrated}`);
    console.log(`   Skipped: ${this.stats.contextChatMessages.skipped}`);
    
    if (this.stats.errors.length > 0) {
      console.log(`\n❌ Errors (${this.stats.errors.length}):`);
      this.stats.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }
  }
}

async function main() {
  console.log('🚀 ChromaDB Migration Script');
  console.log('============================\n');

  const migrationService = new ChromaMigrationService();

  try {
    // Initialize services
    await migrationService.initialize();
    
    // Load existing ChromaDB data to avoid duplicates
    await migrationService.loadExistingChromaData();
    
    // Perform migration
    await migrationService.migrateAllData();
    
    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
main().catch(console.error); 