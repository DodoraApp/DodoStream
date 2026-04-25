CREATE TABLE `sync_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`profile_id` text NOT NULL,
	`provider` text NOT NULL,
	`action` text NOT NULL,
	`meta_id` text NOT NULL,
	`video_id` text,
	`type` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `profile_provider_idx` ON `sync_queue` (`profile_id`,`provider`);--> statement-breakpoint
DROP INDEX `meta_id_idx`;--> statement-breakpoint
DROP INDEX `profile_added_idx`;--> statement-breakpoint
CREATE INDEX `profile_added_idx` ON `my_list` (`profile_id`,`added_at`);--> statement-breakpoint
ALTER TABLE `my_list` DROP COLUMN `removed_at`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_watch_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`profile_id` text NOT NULL,
	`meta_id` text NOT NULL,
	`video_id` text DEFAULT '' NOT NULL,
	`type` text NOT NULL,
	`progress_seconds` real DEFAULT 0 NOT NULL,
	`duration_seconds` real DEFAULT 0 NOT NULL,
	`last_stream_target_type` text,
	`last_stream_target_value` text,
	`status` text DEFAULT 'watching' NOT NULL,
	`source` text DEFAULT 'internal' NOT NULL,
	`last_watched_at` integer NOT NULL,
	`dismissed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_watch_history`("id", "profile_id", "meta_id", "video_id", "type", "progress_seconds", "duration_seconds", "last_stream_target_type", "last_stream_target_value", "status", "source", "last_watched_at", "dismissed_at", "created_at", "updated_at") SELECT "id", "profile_id", "meta_id", "video_id", "type", "progress_seconds", "duration_seconds", "last_stream_target_type", "last_stream_target_value", "status", "source", "last_watched_at", "dismissed_at", "created_at", "updated_at" FROM `watch_history`;--> statement-breakpoint
DROP TABLE `watch_history`;--> statement-breakpoint
ALTER TABLE `__new_watch_history` RENAME TO `watch_history`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `profile_status_last_watched_idx` ON `watch_history` (`profile_id`,`status`,`last_watched_at`);--> statement-breakpoint
CREATE INDEX `profile_meta_idx` ON `watch_history` (`profile_id`,`meta_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `watch_history_profile_id_meta_id_video_id_unique` ON `watch_history` (`profile_id`,`meta_id`,`video_id`);