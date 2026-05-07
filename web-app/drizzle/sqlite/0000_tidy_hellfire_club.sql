CREATE TABLE `architecture_suggestions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`github_url` text,
	`business_value` integer DEFAULT 0 NOT NULL,
	`hours_saved` integer DEFAULT 0 NOT NULL,
	`repo_id` integer,
	`department_id` integer,
	`status` text DEFAULT 'proposed' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`repo_id`) REFERENCES `repos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `departments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `departments_name_unique` ON `departments` (`name`);--> statement-breakpoint
CREATE TABLE `flame_axis` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scan_id` integer NOT NULL,
	`label` text NOT NULL,
	`offset_pct` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`scan_id`) REFERENCES `scans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `flame_blocks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`row_id` integer NOT NULL,
	`label` text NOT NULL,
	`flex` real NOT NULL,
	`pct` integer,
	`heat` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`row_id`) REFERENCES `flame_rows`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `flame_rows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scan_id` integer NOT NULL,
	`depth` integer NOT NULL,
	FOREIGN KEY (`scan_id`) REFERENCES `scans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `gates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scan_id` integer NOT NULL,
	`name` text NOT NULL,
	`value` text NOT NULL,
	`status` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`scan_id`) REFERENCES `scans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `issues` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scan_id` integer NOT NULL,
	`severity` text NOT NULL,
	`title` text NOT NULL,
	`file_path` text NOT NULL,
	`line_number` integer,
	`meta` text,
	`category` text,
	`impact_ms` integer NOT NULL,
	`problem` text,
	`code_before` text,
	`code_after` text,
	`code_lang` text,
	`code_diff_label` text,
	`suggestion_title` text,
	`suggestion_text` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`scan_id`) REFERENCES `scans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pull_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`repo_id` integer NOT NULL,
	`number` integer NOT NULL,
	`title` text NOT NULL,
	`branch` text NOT NULL,
	`base_branch` text NOT NULL,
	`commits` integer NOT NULL,
	`files_changed` integer NOT NULL,
	`author` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`github_url` text NOT NULL,
	`improvement` text,
	`business_value` integer DEFAULT 0 NOT NULL,
	`hours_saved` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`repo_id`) REFERENCES `repos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prs_repo_number_uq` ON `pull_requests` (`repo_id`,`number`);--> statement-breakpoint
CREATE TABLE `repos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`department_id` integer,
	FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `repos_owner_name_uq` ON `repos` (`owner`,`name`);--> statement-breakpoint
CREATE TABLE `scans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pr_id` integer NOT NULL,
	`verdict` text NOT NULL,
	`verdict_sub` text NOT NULL,
	`profiled_at` integer NOT NULL,
	`p95_latency_ms` integer NOT NULL,
	`p95_baseline_ms` integer NOT NULL,
	`cpu_pct` integer NOT NULL,
	`cpu_baseline_pct` integer NOT NULL,
	`db_queries` integer NOT NULL,
	`db_n_plus_one` integer NOT NULL,
	`cache_hit_rate` integer NOT NULL,
	`cache_baseline` integer NOT NULL,
	`autofix_count` integer NOT NULL,
	`autofix_total` integer NOT NULL,
	`autofix_savings_ms` integer NOT NULL,
	FOREIGN KEY (`pr_id`) REFERENCES `pull_requests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `time_distribution` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scan_id` integer NOT NULL,
	`name` text NOT NULL,
	`pct` integer NOT NULL,
	`level` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`scan_id`) REFERENCES `scans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `trace_spans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scan_id` integer NOT NULL,
	`label` text NOT NULL,
	`kind` text NOT NULL,
	`offset_pct` integer NOT NULL,
	`width_pct` integer NOT NULL,
	`time_ms` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`scan_id`) REFERENCES `scans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`github_username` text NOT NULL,
	`initials` text NOT NULL,
	`department_id` integer,
	`password_hash` text,
	FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);