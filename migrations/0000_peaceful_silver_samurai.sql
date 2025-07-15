CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"content" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leo_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"question" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"answer" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"answered_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "urls" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
