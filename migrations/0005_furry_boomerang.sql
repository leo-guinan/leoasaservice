CREATE TABLE "context_chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"content" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "context_urls" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"notes" text,
	"content" text,
	"analysis" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
