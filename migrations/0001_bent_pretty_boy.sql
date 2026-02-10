CREATE TABLE "country_status" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text DEFAULT 'afribapay' NOT NULL,
	"country" text NOT NULL,
	"payin_enabled" boolean DEFAULT false NOT NULL,
	"payout_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crypto_currencies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	"payin_enabled" boolean DEFAULT true NOT NULL,
	"payout_enabled" boolean DEFAULT true NOT NULL,
	"min_amount" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "crypto_currencies_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "fee_configs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text DEFAULT 'default' NOT NULL,
	"country" text NOT NULL,
	"operator" text NOT NULL,
	"incoming_fee_percentage" integer DEFAULT 60 NOT NULL,
	"outgoing_fee_percentage" integer DEFAULT 60 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_configs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"api_key" text,
	"secret_key" text,
	"public_key" text,
	"master_key" text,
	"token" text,
	"ipn_secret" text,
	"enable_kyc_submitted" text,
	"enable_kyc_verified" text,
	"enable_kyc_rejected" text,
	"crypto_markup_percent" integer DEFAULT 100,
	"crypto_fee_percent" integer DEFAULT 150,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "provider_configs_provider_unique" UNIQUE("provider")
);
--> statement-breakpoint
CREATE TABLE "scheduled_operations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text NOT NULL,
	"amount" integer NOT NULL,
	"country" text NOT NULL,
	"operator" text NOT NULL,
	"phone" text NOT NULL,
	"security_code_hash" text,
	"scheduled_at" timestamp NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"result_message" text,
	"transaction_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"executed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" json NOT NULL,
	"expire" timestamp (6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"support_email" text DEFAULT 'support@bkapay.com' NOT NULL,
	"support_phone" text DEFAULT '+229 01 46 44 73 19' NOT NULL,
	"whatsapp_link" text DEFAULT 'https://chat.whatsapp.com/DRe55FMRXCt87VxNvjF1EF' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_codes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"code" text NOT NULL,
	"type" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "country_operator_config" ALTER COLUMN "incoming_enabled" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "country_operator_config" ALTER COLUMN "outgoing_enabled" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "site_name" text DEFAULT 'Mon Site' NOT NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "callback_url" text;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "callback_secret" text;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "allowed_countries" text[] DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "customer_pays_fee" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "customer_pays_crypto_fee" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "country_operator_config" ADD COLUMN "provider" text DEFAULT 'afribapay' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_links" ADD COLUMN "image_urls" text[] DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "payment_links" ADD COLUMN "video_url" text;--> statement-breakpoint
ALTER TABLE "payment_links" ADD COLUMN "allowed_countries" text[] DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "payment_links" ADD COLUMN "customer_pays_fee" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_links" ADD COLUMN "customer_pays_crypto_fee" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "kyc_signature" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "kyc_activity_description" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "kyc_latitude" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "kyc_longitude" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "kyc_address" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "kyc_accepted_terms" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "kyc_rejection_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "withdrawal_phones" text[] DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "security_code" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_primary_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "scheduled_operations" ADD CONSTRAINT "scheduled_operations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;