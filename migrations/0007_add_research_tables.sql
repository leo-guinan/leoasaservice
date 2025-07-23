-- Migration: Add Research Requests and Reports tables
-- This allows users to create research requests and generate comprehensive reports

-- Research Requests table
CREATE TABLE "research_requests" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL,
  "profile_id" integer NOT NULL DEFAULT 0,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "research_areas" jsonb,
  "priority" text NOT NULL DEFAULT 'medium',
  "status" text NOT NULL DEFAULT 'pending',
  "assigned_to" text,
  "due_date" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Research Reports table
CREATE TABLE "research_reports" (
  "id" serial PRIMARY KEY,
  "request_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "profile_id" integer NOT NULL DEFAULT 0,
  "title" text NOT NULL,
  "executive_summary" text,
  "local_knowledge_section" text,
  "internet_research_section" text,
  "methodology" text,
  "sources" jsonb,
  "key_findings" jsonb,
  "recommendations" jsonb,
  "status" text NOT NULL DEFAULT 'draft',
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Add comments to document the purpose
COMMENT ON TABLE "research_requests" IS 'User-initiated research tasks that need to be completed';
COMMENT ON TABLE "research_reports" IS 'Completed research documents combining local knowledge and internet research';
COMMENT ON COLUMN "research_requests"."research_areas" IS 'Array of research areas/topics to investigate';
COMMENT ON COLUMN "research_requests"."priority" IS 'Priority level: low, medium, high, urgent';
COMMENT ON COLUMN "research_requests"."status" IS 'Current status: pending, in_progress, completed, cancelled';
COMMENT ON COLUMN "research_reports"."local_knowledge_section" IS 'Information from existing context and local data';
COMMENT ON COLUMN "research_reports"."internet_research_section" IS 'Information from internet research and external sources';
COMMENT ON COLUMN "research_reports"."sources" IS 'Array of sources used in the research';
COMMENT ON COLUMN "research_reports"."key_findings" IS 'Array of key findings from the research';
COMMENT ON COLUMN "research_reports"."recommendations" IS 'Array of recommendations based on findings'; 