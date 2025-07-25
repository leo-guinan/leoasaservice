CREATE TABLE "ontologies" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"profile_id" integer DEFAULT 0 NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"domain" text,
	"version" integer DEFAULT 1 NOT NULL,
	"concepts" jsonb NOT NULL,
	"relationships" jsonb NOT NULL,
	"metadata" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"generated_from" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
