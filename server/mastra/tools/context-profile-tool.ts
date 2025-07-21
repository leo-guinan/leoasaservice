import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getDb } from '../../db';
import { userContextProfiles, userContextProfileData, users, userContexts, urls, chatMessages, contextUrls, contextChatMessages } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';

export const contextProfileTool = createTool({
  id: 'manage-context-profiles',
  description: 'Manage context profiles for pro mode users',
  inputSchema: z.object({
    action: z.enum(['list', 'create', 'switch', 'delete', 'update']).describe('Action to perform'),
    userId: z.number().describe('User ID'),
    profileName: z.string().optional().describe('Profile name for create/switch/delete actions'),
    description: z.string().optional().describe('Profile description for create action'),
    profileId: z.number().optional().describe('Profile ID for switch/delete/update actions'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    profiles: z.array(z.object({
      id: z.number(),
      name: z.string(),
      description: z.string().nullable(),
      isActive: z.boolean(),
      lastUpdated: z.string().nullable(),
      version: z.number().nullable(),
    })).optional(),
    activeProfile: z.object({
      id: z.number(),
      name: z.string(),
      description: z.string().nullable(),
    }).optional(),
    loadedData: z.object({
      urls: z.number(),
      chatHistory: z.number(),
    }).optional(),
  }),
  execute: async ({ context }) => {
    const { action, userId, profileName, description, profileId } = context;
    
    try {
      const db = getDb();
      
      // Check if user has pro mode enabled
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (user.length === 0) {
        throw new Error('User not found');
      }
      
      if (!user[0].proMode) {
        throw new Error('Pro mode is not enabled for this user');
      }

      switch (action) {
        case 'list': {
          // Get all profiles for the user with their latest context data
          const profiles = await db
            .select({
              id: userContextProfiles.id,
              name: userContextProfiles.name,
              description: userContextProfiles.description,
              isActive: userContextProfiles.isActive,
              lastUpdated: userContextProfileData.lastUpdated,
              version: userContextProfileData.version,
            })
            .from(userContextProfiles)
            .leftJoin(
              userContextProfileData,
              and(
                eq(userContextProfiles.id, userContextProfileData.profileId),
                eq(userContextProfileData.version, 
                  db.select({ maxVersion: userContextProfileData.version })
                    .from(userContextProfileData)
                    .where(eq(userContextProfileData.profileId, userContextProfiles.id))
                    .orderBy(desc(userContextProfileData.version))
                    .limit(1)
                )
              )
            )
            .where(eq(userContextProfiles.userId, userId))
            .orderBy(userContextProfiles.name);

          // Get the default context (from userContexts table)
          const defaultContext = await db
            .select({
              lastUpdated: userContexts.lastUpdated,
              version: userContexts.version,
            })
            .from(userContexts)
            .where(eq(userContexts.userId, userId))
            .orderBy(desc(userContexts.version))
            .limit(1);

          // Check if any profile is currently active
          const hasActiveProfile = profiles.some(p => p.isActive);

          // Create default context profile entry
          const defaultProfile = {
            id: 0, // Special ID for default context
            name: 'Default Context',
            description: 'Your main research context',
            isActive: !hasActiveProfile, // Active if no other profile is active
            lastUpdated: defaultContext.length > 0 ? defaultContext[0].lastUpdated.toISOString() : null,
            version: defaultContext.length > 0 ? defaultContext[0].version : null,
          };

          // Combine default profile with custom profiles
          const allProfiles = [defaultProfile, ...profiles.map(profile => ({
            ...profile,
            lastUpdated: profile.lastUpdated ? profile.lastUpdated.toISOString() : null,
          }))];

          return {
            success: true,
            message: `Found ${allProfiles.length} context profiles`,
            profiles: allProfiles,
          };
        }

        case 'create': {
          if (!profileName) {
            throw new Error('Profile name is required for create action');
          }

          // Check if profile name already exists for this user
          const existingProfile = await db
            .select()
            .from(userContextProfiles)
            .where(and(
              eq(userContextProfiles.userId, userId),
              eq(userContextProfiles.name, profileName)
            ))
            .limit(1);

          if (existingProfile.length > 0) {
            throw new Error(`Profile "${profileName}" already exists`);
          }

          // Create new profile
          const [newProfile] = await db
            .insert(userContextProfiles)
            .values({
              userId,
              name: profileName,
              description: description || null,
              isActive: false, // New profiles start as inactive
            })
            .returning();

          return {
            success: true,
            message: `Created new context profile: ${profileName}`,
            activeProfile: {
              id: newProfile.id,
              name: newProfile.name,
              description: newProfile.description,
            },
          };
        }

        case 'switch': {
          if ((profileId === undefined || profileId === null) && !profileName) {
            throw new Error('Profile ID or name is required for switch action');
          }

          let targetProfile: any[] = [];
          let isDefaultContext = false;

          if (profileId === 0) {
            // Switching to default context
            isDefaultContext = true;
            targetProfile = [{
              id: 0,
              name: 'Default Context',
              description: 'Your main research context',
              userId: userId,
              isActive: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            }];
          } else if (profileId && profileId > 0) {
            targetProfile = await db
              .select()
              .from(userContextProfiles)
              .where(and(
                eq(userContextProfiles.userId, userId),
                eq(userContextProfiles.id, profileId)
              ))
              .limit(1);
          } else if (profileName) {
            targetProfile = await db
              .select()
              .from(userContextProfiles)
              .where(and(
                eq(userContextProfiles.userId, userId),
                eq(userContextProfiles.name, profileName)
              ))
              .limit(1);
          }

          if (targetProfile.length === 0) {
            throw new Error('Profile not found');
          }

          // Deactivate all profiles for this user
          await db
            .update(userContextProfiles)
            .set({ isActive: false })
            .where(eq(userContextProfiles.userId, userId));

          // Activate the target profile (if not default context)
          if (!isDefaultContext) {
            await db
              .update(userContextProfiles)
              .set({ isActive: true })
              .where(eq(userContextProfiles.id, targetProfile[0].id));
          }

          // Get the current active profile to migrate data
          const currentActiveProfile = await db
            .select()
            .from(userContextProfiles)
            .where(and(
              eq(userContextProfiles.userId, userId),
              eq(userContextProfiles.isActive, true)
            ))
            .limit(1);

          // Use storage methods for data migration and loading
          const { storage } = await import('../../storage');
          
          // Migrate current data to context-specific tables if switching from an active profile
          let migratedData = { urls: 0, messages: 0 };
          if (currentActiveProfile.length > 0) {
            const currentProfileId = currentActiveProfile[0].id;
            migratedData = await storage.migrateDataToContext(userId, currentProfileId);
          }

          // Load context-specific data for the target profile
          const targetProfileId = targetProfile[0].id;
          const loadedData = await storage.loadContextData(userId, targetProfileId);

          return {
            success: true,
            message: `Switched to context profile: ${targetProfile[0].name}. Loaded ${loadedData.urls} URLs and ${loadedData.messages} messages.`,
            activeProfile: {
              id: targetProfile[0].id,
              name: targetProfile[0].name,
              description: targetProfile[0].description,
            },
            loadedData: {
              urls: loadedData.urls,
              chatHistory: loadedData.messages,
            },
          };
        }

        case 'delete': {
          if (!profileId && !profileName) {
            throw new Error('Profile ID or name is required for delete action');
          }

          let targetProfile;
          if (profileId) {
            targetProfile = await db
              .select()
              .from(userContextProfiles)
              .where(and(
                eq(userContextProfiles.userId, userId),
                eq(userContextProfiles.id, profileId)
              ))
              .limit(1);
          } else {
            targetProfile = await db
              .select()
              .from(userContextProfiles)
              .where(and(
                eq(userContextProfiles.userId, userId),
                eq(userContextProfiles.name, profileName!)
              ))
              .limit(1);
          }

          if (targetProfile.length === 0) {
            throw new Error('Profile not found');
          }

          if (targetProfile[0].isActive) {
            throw new Error('Cannot delete the active profile. Switch to another profile first.');
          }

          // Delete profile data first
          await db
            .delete(userContextProfileData)
            .where(eq(userContextProfileData.profileId, targetProfile[0].id));

          // Delete the profile
          await db
            .delete(userContextProfiles)
            .where(eq(userContextProfiles.id, targetProfile[0].id));

          return {
            success: true,
            message: `Deleted context profile: ${targetProfile[0].name}`,
          };
        }

        case 'update': {
          if (!profileId) {
            throw new Error('Profile ID is required for update action');
          }

          const targetProfile = await db
            .select()
            .from(userContextProfiles)
            .where(and(
              eq(userContextProfiles.userId, userId),
              eq(userContextProfiles.id, profileId)
            ))
            .limit(1);

          if (targetProfile.length === 0) {
            throw new Error('Profile not found');
          }

          // Update profile
          const updateData: any = {};
          if (profileName) updateData.name = profileName;
          if (description !== undefined) updateData.description = description;
          updateData.updatedAt = new Date();

          await db
            .update(userContextProfiles)
            .set(updateData)
            .where(eq(userContextProfiles.id, profileId));

          return {
            success: true,
            message: `Updated context profile: ${targetProfile[0].name}`,
          };
        }

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      console.error('Error managing context profiles:', error);
      throw new Error(`Failed to manage context profiles: ${error}`);
    }
  },
}); 