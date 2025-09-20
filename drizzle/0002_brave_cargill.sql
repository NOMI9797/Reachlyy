CREATE TABLE "linkedin_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"session_id" text NOT NULL,
	"email" text NOT NULL,
	"user_name" text,
	"profile_image_url" text,
	"cookies" json NOT NULL,
	"local_storage" json,
	"session_storage" json,
	"is_active" boolean DEFAULT false NOT NULL,
	"connection_invites" integer DEFAULT 0,
	"follow_up_messages" integer DEFAULT 0,
	"tags" json DEFAULT '[]'::json,
	"sales_nav_active" boolean DEFAULT true,
	"last_used" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "linkedin_accounts_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
ALTER TABLE "linkedin_accounts" ADD CONSTRAINT "linkedin_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;