CREATE TABLE "architecture_suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"github_url" text,
	"business_value" integer DEFAULT 0 NOT NULL,
	"hours_saved" integer DEFAULT 0 NOT NULL,
	"repo_id" integer,
	"department_id" integer,
	"status" text DEFAULT 'proposed' NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "departments_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "flame_axis" (
	"id" serial PRIMARY KEY NOT NULL,
	"scan_id" integer NOT NULL,
	"label" text NOT NULL,
	"offset_pct" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flame_blocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"row_id" integer NOT NULL,
	"label" text NOT NULL,
	"flex" real NOT NULL,
	"pct" integer,
	"heat" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flame_rows" (
	"id" serial PRIMARY KEY NOT NULL,
	"scan_id" integer NOT NULL,
	"depth" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gates" (
	"id" serial PRIMARY KEY NOT NULL,
	"scan_id" integer NOT NULL,
	"name" text NOT NULL,
	"value" text NOT NULL,
	"status" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" serial PRIMARY KEY NOT NULL,
	"scan_id" integer NOT NULL,
	"severity" text NOT NULL,
	"title" text NOT NULL,
	"file_path" text NOT NULL,
	"line_number" integer,
	"meta" text,
	"category" text,
	"impact_ms" integer NOT NULL,
	"problem" text,
	"code_before" text,
	"code_after" text,
	"code_lang" text,
	"code_diff_label" text,
	"suggestion_title" text,
	"suggestion_text" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pull_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"repo_id" integer NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"branch" text NOT NULL,
	"base_branch" text NOT NULL,
	"commits" integer NOT NULL,
	"files_changed" integer NOT NULL,
	"author" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"github_url" text NOT NULL,
	"improvement" text,
	"business_value" integer DEFAULT 0 NOT NULL,
	"hours_saved" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repos" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"department_id" integer
);
--> statement-breakpoint
CREATE TABLE "scans" (
	"id" serial PRIMARY KEY NOT NULL,
	"pr_id" integer NOT NULL,
	"verdict" text NOT NULL,
	"verdict_sub" text NOT NULL,
	"profiled_at" bigint NOT NULL,
	"p95_latency_ms" integer NOT NULL,
	"p95_baseline_ms" integer NOT NULL,
	"cpu_pct" integer NOT NULL,
	"cpu_baseline_pct" integer NOT NULL,
	"db_queries" integer NOT NULL,
	"db_n_plus_one" integer NOT NULL,
	"cache_hit_rate" integer NOT NULL,
	"cache_baseline" integer NOT NULL,
	"autofix_count" integer NOT NULL,
	"autofix_total" integer NOT NULL,
	"autofix_savings_ms" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_distribution" (
	"id" serial PRIMARY KEY NOT NULL,
	"scan_id" integer NOT NULL,
	"name" text NOT NULL,
	"pct" integer NOT NULL,
	"level" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trace_spans" (
	"id" serial PRIMARY KEY NOT NULL,
	"scan_id" integer NOT NULL,
	"label" text NOT NULL,
	"kind" text NOT NULL,
	"offset_pct" integer NOT NULL,
	"width_pct" integer NOT NULL,
	"time_ms" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"github_username" text NOT NULL,
	"initials" text NOT NULL,
	"department_id" integer,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "architecture_suggestions" ADD CONSTRAINT "architecture_suggestions_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "architecture_suggestions" ADD CONSTRAINT "architecture_suggestions_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flame_axis" ADD CONSTRAINT "flame_axis_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flame_blocks" ADD CONSTRAINT "flame_blocks_row_id_flame_rows_id_fk" FOREIGN KEY ("row_id") REFERENCES "public"."flame_rows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flame_rows" ADD CONSTRAINT "flame_rows_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gates" ADD CONSTRAINT "gates_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repos" ADD CONSTRAINT "repos_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_pr_id_pull_requests_id_fk" FOREIGN KEY ("pr_id") REFERENCES "public"."pull_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_distribution" ADD CONSTRAINT "time_distribution_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trace_spans" ADD CONSTRAINT "trace_spans_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "prs_repo_number_uq" ON "pull_requests" USING btree ("repo_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "repos_owner_name_uq" ON "repos" USING btree ("owner","name");