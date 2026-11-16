CREATE TABLE `downloads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`profile_id` text NOT NULL,
	`meta_id` text NOT NULL,
	`video_id` text DEFAULT '' NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`stream_id` text,
	`stream_title` text,
	`source_url` text NOT NULL,
	`request_headers` text,
	`file_name` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`bytes_downloaded` integer DEFAULT 0 NOT NULL,
	`bytes_total` integer,
	`error_message` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE INDEX `downloads_profile_created_idx` ON `downloads` (`profile_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `downloads_profile_id_meta_id_video_id_unique` ON `downloads` (`profile_id`,`meta_id`,`video_id`);