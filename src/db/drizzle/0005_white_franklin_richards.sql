CREATE TABLE `meta_ids` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`meta_id` text NOT NULL,
	`imdb_id` text,
	`tmdb_id` text,
	`trakt_id` text,
	`simkl_id` text,
	`tvdb_id` text,
	`kitsu_id` text,
	`anilist_id` text,
	`mal_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `meta_ids_meta_id_unique` ON `meta_ids` (`meta_id`);--> statement-breakpoint
CREATE INDEX `meta_ids_imdb_idx` ON `meta_ids` (`imdb_id`);--> statement-breakpoint
CREATE INDEX `meta_ids_tmdb_idx` ON `meta_ids` (`tmdb_id`);--> statement-breakpoint
CREATE INDEX `meta_ids_trakt_idx` ON `meta_ids` (`trakt_id`);--> statement-breakpoint
CREATE INDEX `meta_ids_simkl_idx` ON `meta_ids` (`simkl_id`);