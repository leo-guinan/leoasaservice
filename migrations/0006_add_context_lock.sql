-- Migration: Add isLocked column to user_context_profiles
-- This allows users to lock their context to prevent automatic updates

ALTER TABLE "user_context_profiles" 
ADD COLUMN "is_locked" boolean NOT NULL DEFAULT false;

-- Add comment to document the purpose
COMMENT ON COLUMN "user_context_profiles"."is_locked" IS 'Prevent context updates when locked'; 