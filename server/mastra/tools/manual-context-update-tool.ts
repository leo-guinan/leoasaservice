import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getDb } from '../../db';
import { users, userContextProfiles, userContextProfileData } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { userActivityTool } from './user-activity-tool';
import { contextUpdateTool } from './context-update-tool';

export const manualContextUpdateTool = createTool({
  id: 'manual-context-update',
  description: 'Manually trigger context update for pro mode users',
  inputSchema: z.object({
    userId: z.number().describe('User ID'),
    date: z.string().optional().describe('Date to process (YYYY-MM-DD), defaults to today'),
    profileId: z.number().optional().describe('Profile ID to update, uses active profile if not specified'),
    forceUpdate: z.boolean().optional().describe('Force update even if no new activity'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    profileName: z.string().optional(),
    activityFound: z.boolean(),
    contextUpdated: z.boolean(),
    summary: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const { userId, date = new Date().toISOString().split('T')[0], profileId, forceUpdate = false } = context;
    
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

      // Get the target profile (active profile if not specified)
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
            eq(userContextProfiles.isActive, true)
          ))
          .limit(1);
      }

      if (targetProfile.length === 0) {
        throw new Error('No active profile found. Please create or switch to a profile first.');
      }

      const profile = targetProfile[0];
      console.log(`🔄 Manual context update for user ${userId}, profile: ${profile.name}, date: ${date}`);

      // Get user activity for the date
      const activityResult = await userActivityTool.execute({
        context: {
          date,
          userId,
        },
      } as any);

      const hasActivity = activityResult.summary.totalMessages > 0 || 
                         activityResult.summary.totalUploads > 0 || 
                         activityResult.summary.totalQuestions > 0;

      if (!hasActivity && !forceUpdate) {
        return {
          success: true,
          message: `No activity found for ${date}. Use forceUpdate=true to update anyway.`,
          profileName: profile.name,
          activityFound: false,
          contextUpdated: false,
        };
      }

      // Get the latest context for this profile
      const latestContext = await db
        .select()
        .from(userContextProfileData)
        .where(eq(userContextProfileData.profileId, profile.id))
        .orderBy(desc(userContextProfileData.version))
        .limit(1);

      const currentVersion = latestContext.length > 0 ? latestContext[0].version : 0;
      const newVersion = currentVersion + 1;

      // Update context using the context update tool
      const contextResult = await contextUpdateTool.execute({
        context: {
          userId,
          date,
          newActivitySummary: {
            chatMessages: activityResult.chatMessages.map((m: any) => ({
              content: m.content,
              role: m.role,
            })),
            urlUploads: activityResult.urlUploads.map((u: any) => ({
              url: u.url,
              title: u.title,
              notes: u.notes,
            })),
            leoQuestions: activityResult.leoQuestions.map((q: any) => ({
              question: q.question,
              answer: q.answer,
            })),
            summary: activityResult.summary,
          },
        },
      } as any);

      // Store the updated context in the profile data
      await db
        .insert(userContextProfileData)
        .values({
          profileId: profile.id,
          context: contextResult.updatedContext,
          version: newVersion,
        });

      console.log(`✅ Manual context update completed for profile "${profile.name}" (v${newVersion})`);

      return {
        success: true,
        message: `Context updated successfully for profile "${profile.name}"`,
        profileName: profile.name,
        activityFound: hasActivity,
        contextUpdated: contextResult.contextChanged,
        summary: contextResult.summary,
      };

    } catch (error) {
      console.error('Error in manual context update:', error);
      throw new Error(`Failed to update context: ${error}`);
    }
  },
}); 