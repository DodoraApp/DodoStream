import { index, integer, real, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

export type StreamTargetType = 'url' | 'external' | 'yt';

const contentTypeColumn = (name: string) =>
  text(name, { enum: ['movie', 'series', 'channel', 'tv'] as const });

const streamTargetTypeColumn = (name: string) =>
  text(name, { enum: ['url', 'external', 'yt'] as const });

const watchStatusColumn = (name: string) =>
  text(name, { enum: ['watching', 'dismissed', 'completed'] as const });

export const watchHistory = sqliteTable(
  'watch_history',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    profileId: text('profile_id').notNull(),
    metaId: text('meta_id').notNull(),
    videoId: text('video_id').notNull().default(''),
    type: contentTypeColumn('type').notNull(),
    progressSeconds: real('progress_seconds').notNull().default(0),
    durationSeconds: real('duration_seconds').notNull().default(0),
    lastStreamTargetType: streamTargetTypeColumn('last_stream_target_type'),
    lastStreamTargetValue: text('last_stream_target_value'),
    status: watchStatusColumn('status').notNull().default('watching'),
    lastWatchedAt: integer('last_watched_at').notNull(),
    dismissedAt: integer('dismissed_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    unique().on(table.profileId, table.metaId, table.videoId),
    index('profile_status_last_watched_idx').on(
      table.profileId,
      table.status,
      table.lastWatchedAt
    ),
    index('profile_meta_idx').on(table.profileId, table.metaId),
  ]
);

export const myList = sqliteTable(
  'my_list',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    profileId: text('profile_id').notNull(),
    metaId: text('meta_id').notNull(),
    type: contentTypeColumn('type').notNull(),
    addedAt: integer('added_at').notNull(),
  },
  (table) => [
    unique().on(table.profileId, table.metaId),
    index('profile_added_idx').on(table.profileId, table.addedAt),
  ]
);

export const metaCache = sqliteTable(
  'meta_cache',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    metaId: text('meta_id').notNull().unique(),
    type: contentTypeColumn('type').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    poster: text('poster'),
    background: text('background'),
    logo: text('logo'),
    imdbRating: text('imdb_rating'),
    releaseYear: text('release_year'),
    fetchedAt: integer('fetched_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
  },
  (table) => [
    index('meta_id_idx').on(table.metaId),
    index('expires_at_idx').on(table.expiresAt),
  ]
);

export const videos = sqliteTable(
  'videos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    metaId: text('meta_id').notNull(),
    videoId: text('video_id').notNull(),
    title: text('title'),
    season: integer('season'),
    episode: integer('episode'),
    thumbnail: text('thumbnail'),
    overview: text('overview'),
    released: text('released'),
    fetchedAt: integer('fetched_at').notNull(),
  },
  (table) => [
    unique().on(table.metaId, table.videoId),
    index('video_meta_id_idx').on(table.metaId),
    index('meta_season_episode_idx').on(
      table.metaId,
      table.season,
      table.episode
    ),
  ]
);

export type WatchHistoryStatus = 'watching' | 'dismissed' | 'completed';
