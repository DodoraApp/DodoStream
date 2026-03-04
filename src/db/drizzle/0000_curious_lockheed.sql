CREATE TABLE `meta_cache` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`meta_id` text NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`poster` text,
	`background` text,
	`logo` text,
	`imdb_rating` text,
	`release_year` text,
	`fetched_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `meta_cache_meta_id_unique` ON `meta_cache` (`meta_id`);--> statement-breakpoint
CREATE INDEX `meta_id_idx` ON `meta_cache` (`meta_id`);--> statement-breakpoint
CREATE INDEX `expires_at_idx` ON `meta_cache` (`expires_at`);--> statement-breakpoint
CREATE TABLE `my_list` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`profile_id` text NOT NULL,
	`meta_id` text NOT NULL,
	`type` text NOT NULL,
	`added_at` integer NOT NULL,
	`removed_at` integer
);
--> statement-breakpoint
CREATE INDEX `profile_added_idx` ON `my_list` (`profile_id`,`removed_at`,`added_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `my_list_profile_id_meta_id_unique` ON `my_list` (`profile_id`,`meta_id`);--> statement-breakpoint
CREATE TABLE `videos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`meta_id` text NOT NULL,
	`video_id` text NOT NULL,
	`title` text,
	`season` integer,
	`episode` integer,
	`thumbnail` text,
	`overview` text,
	`released` text,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `video_meta_id_idx` ON `videos` (`meta_id`);--> statement-breakpoint
CREATE INDEX `meta_season_episode_idx` ON `videos` (`meta_id`,`season`,`episode`);--> statement-breakpoint
CREATE UNIQUE INDEX `videos_meta_id_video_id_unique` ON `videos` (`meta_id`,`video_id`);--> statement-breakpoint
CREATE TABLE `watch_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`profile_id` text NOT NULL,
	`meta_id` text NOT NULL,
	`video_id` text NOT NULL DEFAULT '',
	`type` text NOT NULL,
	`progress_seconds` real DEFAULT 0 NOT NULL,
	`duration_seconds` real DEFAULT 0 NOT NULL,
	`last_stream_target_type` text,
	`last_stream_target_value` text,
	`status` text DEFAULT 'watching' NOT NULL,
	`last_watched_at` integer NOT NULL,
	`dismissed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `profile_status_last_watched_idx` ON `watch_history` (`profile_id`,`status`,`last_watched_at`);--> statement-breakpoint
CREATE INDEX `profile_meta_idx` ON `watch_history` (`profile_id`,`meta_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `watch_history_profile_id_meta_id_video_id_unique` ON `watch_history` (`profile_id`,`meta_id`,`video_id`);