CREATE TYPE "public"."alert_color" AS ENUM('red', 'gray');--> statement-breakpoint
CREATE TYPE "public"."channel" AS ENUM('email', 'social_post', 'web_page');--> statement-breakpoint
CREATE TYPE "public"."decision" AS ENUM('approved', 'changes_requested', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."product" AS ENUM('personal_loan', 'credit_card', 'mortgage');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('submitter', 'reviewer');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('blocker', 'warning');--> statement-breakpoint
CREATE TYPE "public"."source" AS ENUM('clearpath', 'affiliate');--> statement-breakpoint
CREATE TYPE "public"."version_created_via" AS ENUM('submitted', 'approved_from_alert');--> statement-breakpoint
CREATE TABLE "ad_versions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ad_versions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"ad_id" integer NOT NULL,
	"number" integer NOT NULL,
	"subject" text,
	"url" text,
	"visible_text" text NOT NULL,
	"hidden_text" text DEFAULT '' NOT NULL,
	"hash" text NOT NULL,
	"created_via" "version_created_via" NOT NULL,
	"created_by_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ad_versions_adId_number_unique" UNIQUE("ad_id","number")
);
--> statement-breakpoint
CREATE TABLE "ads" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ads_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"title" text NOT NULL,
	"product" "product" NOT NULL,
	"channel" "channel" NOT NULL,
	"source" "source" NOT NULL,
	"affiliate_id" integer,
	"owner_id" integer NOT NULL,
	"draft_subject" text,
	"draft_text" text,
	"draft_url" text,
	"live_version_id" integer,
	"last_scanned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliates" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "affiliates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"website" text NOT NULL,
	"contact_email" text NOT NULL,
	"owner_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "alerts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"ad_id" integer NOT NULL,
	"latest_scan_id" integer NOT NULL,
	"color" "alert_color" NOT NULL,
	"resolution" text,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "approved_texts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "checks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"ad_id" integer NOT NULL,
	"version_id" integer,
	"page_scan_id" integer,
	"content_hash" text NOT NULL,
	"rules_used" jsonb NOT NULL,
	"model" text,
	"flags" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decisions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "decisions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"version_id" integer NOT NULL,
	"decision" "decision" NOT NULL,
	"reviewer_id" integer NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demo_pages" (
	"slug" text PRIMARY KEY NOT NULL,
	"headline" text NOT NULL,
	"body" text NOT NULL,
	"show_disclosure" boolean NOT NULL,
	"hidden_text" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"ad_id" integer,
	"actor_id" integer,
	"action" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flag_notes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "flag_notes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"ad_id" integer NOT NULL,
	"rule_id" text NOT NULL,
	"quote" text,
	"note" text NOT NULL,
	"author_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flag_notes_adId_ruleId_quote_unique" UNIQUE NULLS NOT DISTINCT("ad_id","rule_id","quote")
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "outbox_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"ad_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_scans" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "page_scans_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"ad_id" integer NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"failure_reason" text,
	"visible_text" text,
	"hidden_text" text,
	"hash" text,
	"matched_version_id" integer
);
--> statement-breakpoint
CREATE TABLE "rules" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"required_approved_text_id" text,
	"banned_phrases" text[] DEFAULT '{}' NOT NULL,
	"ai_instruction" text,
	"products" "product"[] NOT NULL,
	"channels" "channel"[] NOT NULL,
	"sources" "source"[] NOT NULL,
	"severity" "severity" NOT NULL,
	"based_on" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" "role" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ad_versions" ADD CONSTRAINT "ad_versions_ad_id_ads_id_fk" FOREIGN KEY ("ad_id") REFERENCES "public"."ads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_versions" ADD CONSTRAINT "ad_versions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ads" ADD CONSTRAINT "ads_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ads" ADD CONSTRAINT "ads_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ads" ADD CONSTRAINT "ads_live_version_id_ad_versions_id_fk" FOREIGN KEY ("live_version_id") REFERENCES "public"."ad_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_ad_id_ads_id_fk" FOREIGN KEY ("ad_id") REFERENCES "public"."ads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_latest_scan_id_page_scans_id_fk" FOREIGN KEY ("latest_scan_id") REFERENCES "public"."page_scans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checks" ADD CONSTRAINT "checks_ad_id_ads_id_fk" FOREIGN KEY ("ad_id") REFERENCES "public"."ads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checks" ADD CONSTRAINT "checks_version_id_ad_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."ad_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checks" ADD CONSTRAINT "checks_page_scan_id_page_scans_id_fk" FOREIGN KEY ("page_scan_id") REFERENCES "public"."page_scans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_version_id_ad_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."ad_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_ad_id_ads_id_fk" FOREIGN KEY ("ad_id") REFERENCES "public"."ads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flag_notes" ADD CONSTRAINT "flag_notes_ad_id_ads_id_fk" FOREIGN KEY ("ad_id") REFERENCES "public"."ads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flag_notes" ADD CONSTRAINT "flag_notes_rule_id_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flag_notes" ADD CONSTRAINT "flag_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_ad_id_ads_id_fk" FOREIGN KEY ("ad_id") REFERENCES "public"."ads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_scans" ADD CONSTRAINT "page_scans_ad_id_ads_id_fk" FOREIGN KEY ("ad_id") REFERENCES "public"."ads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_scans" ADD CONSTRAINT "page_scans_matched_version_id_ad_versions_id_fk" FOREIGN KEY ("matched_version_id") REFERENCES "public"."ad_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rules" ADD CONSTRAINT "rules_required_approved_text_id_approved_texts_id_fk" FOREIGN KEY ("required_approved_text_id") REFERENCES "public"."approved_texts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_open_alert_per_ad" ON "alerts" USING btree ("ad_id") WHERE "alerts"."closed_at" is null;