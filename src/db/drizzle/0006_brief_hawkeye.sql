CREATE TABLE `sync_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`profile_id` text NOT NULL,
	`provider` text NOT NULL,
	`direction` text NOT NULL,
	`meta_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sync_log_profile_idx` ON `sync_log` (`profile_id`,`id`);