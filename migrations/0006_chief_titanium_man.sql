CREATE TABLE "crawler_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"profile_id" integer DEFAULT 0 NOT NULL,
	"root_url" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"max_pages" integer DEFAULT 100 NOT NULL,
	"pages_discovered" integer DEFAULT 0 NOT NULL,
	"pages_processed" integer DEFAULT 0 NOT NULL,
	"pages_analyzed" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crawler_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"profile_id" integer DEFAULT 0 NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"description" text,
	"content" text,
	"analysis" jsonb,
	"status" text DEFAULT 'discovered' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"depth" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "research_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"profile_id" integer DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"executive_summary" text,
	"local_knowledge_section" text,
	"internet_research_section" text,
	"methodology" text,
	"sources" jsonb,
	"key_findings" jsonb,
	"recommendations" jsonb,
	"status" text DEFAULT 'draft' NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"profile_id" integer DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"research_areas" jsonb,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"assigned_to" text,
	"due_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rss_feed_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"feed_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"profile_id" integer DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"content" text,
	"link" text NOT NULL,
	"author" text,
	"published_at" timestamp,
	"guid" text NOT NULL,
	"is_processed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rss_feeds" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"profile_id" integer DEFAULT 0 NOT NULL,
	"feed_url" text NOT NULL,
	"title" text,
	"description" text,
	"last_fetched" timestamp,
	"last_item_date" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"fetch_interval" integer DEFAULT 1440 NOT NULL,
	"max_items_per_fetch" integer DEFAULT 50 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_context_profiles" ADD COLUMN "is_locked" boolean DEFAULT false NOT NULL;