# ADR 0001: Migrate from Zustand + AsyncStorage to expo-sqlite + Drizzle ORM

## Status

Proposed

## Context

DodoStream currently uses Zustand with AsyncStorage persistence for all data storage. The current architecture has severe performance bottlenecks, cannot scale as users accumulate watch history, and requires redundant API calls to display metadata.

### Current Store Architecture

**Stores to KEEP with Zustand (Configuration/Settings - Small Data):**

- ✅ `ui.store.ts` - Theme preferences, scaling factors (~100 bytes)
- ✅ `app-settings.store.ts` - App-level settings (~100 bytes)
- ✅ `developer.store.ts` - Sentry DSN configuration (~100 bytes)
- ✅ `addon.store.ts` - Installed addons manifest (~5-50 KB)
- ✅ `setup-wizard.store.ts` - Transient wizard state (runtime only)
- ✅ `toast.store.ts` - Transient UI notifications (runtime only)
- ✅ `profile.store.ts` - Profile registry metadata
- ✅ `profile-settings.store.ts` - Per-profile playback settings
- ✅ `playback.store.ts` - Subtitle preferences
- ✅ `home.store.ts` - Per-profile home configuration

**Stores to MIGRATE to SQLite (User Data - Potentially Massive):**

- 🔴 `watch-history.store.ts` - Watch progress for episodes/movies
- 🔴 `continue-watching.store.ts` - Dismissed state (merge into watch history)
- 🔴 `my-list.store.ts` - User's saved media list

### Performance Bottleneck Analysis

**Current implementation has O(n²) complexity:**

```typescript
getContinueWatching: () => {
  const profileData = get().byProfile[profileId] ?? {};

  // O(n²) nested iteration through ALL items
  const allItems: WatchHistoryItem[] = [];
  for (const metaItems of Object.values(profileData)) {
    for (const item of Object.values(metaItems)) {
      if (isContinueWatching(...)) {
        allItems.push(item);
      }
    }
  }
  return allItems.sort(...);
}
```

**Problems:**

1. Loads entire profile's watch history into memory (50-500 KB)
2. No indexing on `lastWatchedAt` for sorting
3. Each continue watching item fetches metadata separately (N+1 queries)
4. AsyncStorage is slow for large JSON blobs

### Up Next Logic Requirements

The app shows the **next unwatched episode** instead of the current one when:

1. User finishes an episode (progress >= 90%)
2. There is a next episode available in the series
3. The next episode hasn't been watched yet

**Current implementation:**

```typescript
// Find next unwatched video after the current one
const findNextUnwatchedVideo = (
  videos: MetaVideo[],
  currentIndex: number,
  getProgressRatioForVideo: (videoId: string) => number
): MetaVideo | undefined => {
  for (let i = currentIndex + 1; i < videos.length; i++) {
    const video = videos[i];
    const ratio = getProgressRatioForVideo(video.id);
    if (ratio < PLAYBACK_FINISHED_RATIO) {
      return video;
    }
  }
  return undefined;
};
```

**Challenge:** When watch history comes from external sources (future sync), we may not have local `MetaVideo` data. We need to compute "up next" at the database level using season/episode numbers.

## Decision

We will migrate to **expo-sqlite** with **Drizzle ORM**, with a fully normalized relational schema. The architecture will:

1. **Store watch history in SQLite** with proper indexing
2. **Cache metadata in normalized tables** (not JSON columns)
3. **Compute "up next" via SQL queries** using season/episode ordering
4. **Consolidate dismissed state** into the watch history model
5. **Prepare for future sync** with reserved columns (but no sync implementation yet)

### Database Schema Design

```typescript
// db/schema.ts
import { sqliteTable, text, integer, real, index, unique } from 'drizzle-orm/sqlite-core';

// ============================================================================
// Watch History
// ============================================================================

export const watchHistory = sqliteTable(
  'watch_history',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    profileId: text('profile_id').notNull(),
    metaId: text('meta_id').notNull(),
    videoId: text('video_id'), // NULL for movies
    type: text('type').notNull(), // 'movie' | 'series'

    // Watch progress
    progressSeconds: real('progress_seconds').notNull().default(0),
    durationSeconds: real('duration_seconds').notNull().default(0),

    // Stream resume info
    lastStreamTargetType: text('last_stream_target_type'), // 'url' | 'external' | 'yt'
    lastStreamTargetValue: text('last_stream_target_value'),

    // User actions
    // 'watching' = default for in-progress items
    // 'dismissed' = user hid from continue watching
    // 'completed' = finished (progress >= threshold)
    status: text('status').notNull().default('watching'),

    // Timestamps
    lastWatchedAt: integer('last_watched_at').notNull(),
    dismissedAt: integer('dismissed_at'), // When dismissed
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => ({
    // Unique constraint: one record per profile+meta+video
    uniqueEntry: unique().on(table.profileId, table.metaId, table.videoId),

    // CRITICAL INDEX: Continue watching query
    profileStatusLastWatchedIdx: index('profile_status_last_watched_idx').on(
      table.profileId,
      table.status,
      table.lastWatchedAt.desc()
    ),

    // Meta-level queries (all episodes for a show)
    profileMetaIdx: index('profile_meta_idx').on(table.profileId, table.metaId),
  })
);

// ============================================================================
// My List
// ============================================================================

export const myList = sqliteTable(
  'my_list',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    profileId: text('profile_id').notNull(),
    metaId: text('meta_id').notNull(),
    type: text('type').notNull(), // 'movie' | 'series'

    // Timestamps
    addedAt: integer('added_at').notNull(),
    removedAt: integer('removed_at'), // Soft delete
  },
  (table) => ({
    // Ensure unique entries per profile
    uniqueEntry: unique().on(table.profileId, table.metaId),

    // Query by profile (sorted by addedAt)
    profileAddedIdx: index('profile_added_idx').on(
      table.profileId,
      table.removedAt,
      table.addedAt.desc()
    ),
  })
);

// ============================================================================
// Meta Cache (Normalized - No JSON columns)
// ============================================================================

export const metaCache = sqliteTable(
  'meta_cache',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    metaId: text('meta_id').notNull().unique(),
    type: text('type').notNull(), // 'movie' | 'series'

    // Basic metadata
    name: text('name').notNull(),
    description: text('description'),
    poster: text('poster'),
    background: text('background'),
    logo: text('logo'),

    // Additional info
    imdbRating: text('imdb_rating'),
    releaseYear: text('release_year'),

    // Cache control
    fetchedAt: integer('fetched_at').notNull(),
    expiresAt: integer('expires_at').notNull(), // Refetch after 7 days
  },
  (table) => ({
    metaIdIdx: index('meta_id_idx').on(table.metaId),
    expiresAtIdx: index('expires_at_idx').on(table.expiresAt),
  })
);

// ============================================================================
// Videos (Episodes) - Separate table with proper relations
// ============================================================================

export const videos = sqliteTable(
  'videos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    metaId: text('meta_id').notNull(), // FK to meta_cache
    videoId: text('video_id').notNull(), // Stremio video ID

    // Episode info
    title: text('title'),
    season: integer('season'), // NULL for movies
    episode: integer('episode'), // NULL for movies

    // Metadata
    thumbnail: text('thumbnail'),
    overview: text('overview'),
    released: text('released'), // ISO date string

    fetchedAt: integer('fetched_at').notNull(),
  },
  (table) => ({
    // Unique video per meta
    uniqueVideo: unique().on(table.metaId, table.videoId),

    // Primary lookup: get episodes for a meta
    metaIdIdx: index('meta_id_idx').on(table.metaId),

    // Up Next queries: find next episode by season/episode
    metaSeasonEpisodeIdx: index('meta_season_episode_idx').on(
      table.metaId,
      table.season,
      table.episode
    ),
  })
);
```

### Relational Design Benefits

```sql
-- ✅ Good: Query next episode directly
SELECT v.*
FROM videos v
LEFT JOIN watch_history wh
  ON v.meta_id = wh.meta_id
  AND v.video_id = wh.video_id
  AND wh.profile_id = ?
WHERE v.meta_id = ?
  AND (
    -- Same season, next episode (skip season 0 unless watching season 0)
    (v.season = ? AND v.episode > ? AND v.season != 0)
    -- OR next season's first episode (skip season 0 specials)
    OR (v.season > ? AND v.season != 0)
  )
  AND (wh.id IS NULL OR (wh.progress_seconds / wh.duration_seconds) < 0.9)
ORDER BY
  -- Sort season 0 (specials) to the end
  CASE WHEN v.season = 0 THEN 999999 ELSE v.season END ASC,
  v.episode ASC
LIMIT 1;
-- = O(log n) indexed lookup
```

### Up Next Logic with Drizzle ORM

We implement "up next" logic using Drizzle ORM's query builder in two queries. This provides type safety and better maintainability compared to raw SQL.

**Strategy:**

1. Get all watch history items with metadata (single query)
2. For finished episodes, find next unwatched episode in parallel (batch query)
3. Merge results with proper fallback
4. Handle season 0 (specials) by ordering it last

```typescript
// db/queries/continueWatching.ts
import { db } from '../client';
import { watchHistory, metaCache, videos } from '../schema';
import { eq, and, or, gt, ne, lt, isNull, desc, asc, sql } from 'drizzle-orm';
import { PLAYBACK_FINISHED_RATIO } from '@/constants/playback';

/**
 * Get continue watching items with "up next" resolution
 * Uses Drizzle ORM query builder for type safety
 */
export async function getContinueWatchingWithUpNext(profileId: string, limit = 50) {
  // Query 1: Get all watch history with metadata and current video info
  const watchProgressItems = await db
    .select({
      watchHistoryId: watchHistory.id,
      metaId: watchHistory.metaId,
      currentVideoId: watchHistory.videoId,
      type: watchHistory.type,
      progressSeconds: watchHistory.progressSeconds,
      durationSeconds: watchHistory.durationSeconds,
      lastWatchedAt: watchHistory.lastWatchedAt,
      status: watchHistory.status,
      // Computed progress ratio
      progressRatio: sql<number>`${watchHistory.progressSeconds} * 1.0 / ${watchHistory.durationSeconds}`,
      // Cached meta
      metaName: metaCache.name,
      metaPoster: metaCache.poster,
      metaBackground: metaCache.background,
      metaLogo: metaCache.logo,
      // Current video
      currentVideoTitle: videos.title,
      currentVideoSeason: videos.season,
      currentVideoEpisode: videos.episode,
    })
    .from(watchHistory)
    .leftJoin(metaCache, eq(watchHistory.metaId, metaCache.metaId))
    .leftJoin(
      videos,
      and(eq(watchHistory.metaId, videos.metaId), eq(watchHistory.videoId, videos.videoId))
    )
    .where(
      and(
        eq(watchHistory.profileId, profileId),
        ne(watchHistory.status, 'dismissed'),
        gt(watchHistory.progressSeconds, 0)
      )
    )
    .orderBy(desc(watchHistory.lastWatchedAt))
    .limit(limit);

  // Query 2: For each finished episode, find next unwatched episode
  const results = await Promise.all(
    watchProgressItems.map(async (item) => {
      const isFinished = Number(item.progressRatio) >= PLAYBACK_FINISHED_RATIO;
      const isSeries = item.type === 'series';
      const hasCachedVideo = item.currentVideoSeason !== null && item.currentVideoEpisode !== null;

      // Try to find "up next" if this is a finished series episode
      if (isFinished && isSeries && hasCachedVideo) {
        const nextVideo = await findNextUnwatchedEpisode(
          profileId,
          item.metaId,
          item.currentVideoSeason!,
          item.currentVideoEpisode!
        );

        if (nextVideo) {
          // Return "up next" entry
          return {
            ...item,
            videoId: nextVideo.videoId,
            videoTitle: nextVideo.title,
            videoSeason: nextVideo.season,
            videoEpisode: nextVideo.episode,
            isUpNext: true,
          };
        }
      }

      // Default: return current item
      return {
        ...item,
        videoId: item.currentVideoId,
        videoTitle: item.currentVideoTitle,
        videoSeason: item.currentVideoSeason,
        videoEpisode: item.currentVideoEpisode,
        isUpNext: false,
      };
    })
  );

  return results;
}

/**
 * Find the next unwatched episode after the given season/episode
 * Handles: same season next episode, next season first episode, season 0 edge cases
 */
async function findNextUnwatchedEpisode(
  profileId: string,
  metaId: string,
  currentSeason: number,
  currentEpisode: number
) {
  // Build WHERE conditions for "next episode"
  const nextEpisodeConditions = or(
    // Same season, next episode (skip season 0 unless currently in season 0)
    and(
      eq(videos.season, currentSeason),
      gt(videos.episode, currentEpisode),
      currentSeason === 0 ? sql`1=1` : ne(videos.season, 0)
    ),
    // Next season, any episode (skip season 0 specials)
    and(gt(videos.season, currentSeason), ne(videos.season, 0), ne(sql`${currentSeason}`, 0)),
    // Special case: finished season 0, go to season 1
    currentSeason === 0 ? eq(videos.season, 1) : sql`1=0`
  );

  const nextEpisode = await db
    .select({
      videoId: videos.videoId,
      title: videos.title,
      season: videos.season,
      episode: videos.episode,
      // For ordering: push season 0 to end
      seasonOrder: sql<number>`CASE WHEN ${videos.season} = 0 THEN 999999 ELSE ${videos.season} END`,
    })
    .from(videos)
    .leftJoin(
      watchHistory,
      and(
        eq(watchHistory.profileId, profileId),
        eq(watchHistory.metaId, videos.metaId),
        eq(watchHistory.videoId, videos.videoId)
      )
    )
    .where(
      and(
        eq(videos.metaId, metaId),
        nextEpisodeConditions,
        // Episode must be unwatched or not finished
        or(
          isNull(watchHistory.id),
          lt(
            sql`${watchHistory.progressSeconds} * 1.0 / ${watchHistory.durationSeconds}`,
            PLAYBACK_FINISHED_RATIO
          )
        )
      )
    )
    .orderBy(
      asc(sql`CASE WHEN ${videos.season} = 0 THEN 999999 ELSE ${videos.season} END`),
      asc(videos.episode)
    )
    .limit(1);

  return nextEpisode[0];
}
```

**Key Features:**

1. **Type Safety**: Full TypeScript inference with Drizzle ORM
2. **Season 0 Handling**: Uses `CASE WHEN season = 0 THEN 999999` to sort specials last
3. **Next Season Support**: Explicitly handles same season next episode OR next season first episode
4. **Parallel Queries**: `Promise.all` for finding next episodes (efficient for small result sets)
5. **Proper Ordering**: Season 0 always sorted to end, regular seasons in numerical order

**Performance:**

- First query: O(log n) with index on `profile_id + status + last_watched_at`
- Second query per item: O(log n) with index on `meta_id + season + episode`
- Total: O(k \* log n) where k = number of continue watching items (typically < 20)

### Caching Videos (Episodes)

When fetching metadata from API, we cache episodes in the `videos` table:

```typescript
// db/mutations/metaCache.ts

export async function upsertMetaCache(meta: MetaDetail) {
  const now = Date.now();
  const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days

  // 1. Upsert main metadata
  await db
    .insert(metaCache)
    .values({
      metaId: meta.id,
      type: meta.type,
      name: meta.name,
      description: meta.description,
      poster: meta.poster,
      background: meta.background,
      logo: meta.logo,
      imdbRating: meta.imdbRating,
      releaseYear: meta.releaseInfo?.split('–')[0],
      fetchedAt: now,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: metaCache.metaId,
      set: {
        name: meta.name,
        description: meta.description,
        poster: meta.poster,
        background: meta.background,
        logo: meta.logo,
        imdbRating: meta.imdbRating,
        releaseYear: meta.releaseInfo?.split('–')[0],
        fetchedAt: now,
        expiresAt,
      },
    });

  // 2. Cache videos (episodes)
  if (meta.videos && meta.videos.length > 0) {
    for (const video of meta.videos) {
      await db
        .insert(videos)
        .values({
          metaId: meta.id,
          videoId: video.id,
          title: video.title ?? video.name,
          season: video.season ?? null,
          episode: video.episode ?? null,
          thumbnail: video.thumbnail,
          overview: video.overview,
          released: video.released,
          fetchedAt: now,
        })
        .onConflictDoUpdate({
          target: [videos.metaId, videos.videoId],
          set: {
            title: video.title ?? video.name,
            season: video.season ?? null,
            episode: video.episode ?? null,
            thumbnail: video.thumbnail,
            overview: video.overview,
            released: video.released,
            fetchedAt: now,
          },
        });
    }
  }
}
```

### Cache Invalidation: New Seasons & Episodes

**Problem:** What happens when a new season is released?

**Solution:** Cache expiration + force refresh mechanism.

```typescript
// db/queries/metaCache.ts

/**
 * Check if cached metadata is stale and needs refresh
 */
export async function isCacheStale(metaId: string): Promise<boolean> {
  const cached = await db
    .select({ expiresAt: metaCache.expiresAt })
    .from(metaCache)
    .where(eq(metaCache.metaId, metaId))
    .limit(1);

  if (!cached.length) return true; // No cache = stale
  return Date.now() > cached[0].expiresAt;
}

/**
 * Get metadata with automatic cache refresh if stale
 */
export async function getMetaWithCache(metaId: string, addonIds: string[]) {
  const isStale = await isCacheStale(metaId);

  if (isStale) {
    // Fetch fresh data from API
    const freshMeta = await fetchMetaFromAddons(metaId, addonIds);
    await upsertMetaCache(freshMeta);
    return freshMeta;
  }

  // Return cached data
  return await getCachedMeta(metaId);
}

/**
 * Force refresh cache (e.g., user pull-to-refresh)
 */
export async function forceRefreshMeta(metaId: string, addonIds: string[]) {
  const freshMeta = await fetchMetaFromAddons(metaId, addonIds);
  await upsertMetaCache(freshMeta);
  return freshMeta;
}
```

**Automatic Detection:**

```typescript
// In useContinueWatching hook
export function useContinueWatching() {
  const profileId = useProfileStore((state) => state.activeProfileId);

  return useLiveQuery(async () => {
    if (!profileId) return [];

    const items = await getContinueWatchingWithUpNext(profileId);

    // Check for stale caches in background
    const staleMetas = await Promise.all(
      items.map(async (item) => ({
        metaId: item.metaId,
        isStale: await isCacheStale(item.metaId),
      }))
    );

    // Refresh stale caches (don't block UI)
    const staleMetaIds = staleMetas.filter((m) => m.isStale).map((m) => m.metaId);
    if (staleMetaIds.length > 0) {
      void refreshMultipleMetas(staleMetaIds); // Background refresh
    }

    return items;
  }, [profileId]);
}
```

**Result:** When a new season is released:

1. Cache expires after 7 days
2. Next query triggers API fetch
3. `upsertMetaCache` adds new episodes to `videos` table
4. "Up next" logic automatically picks up new episodes
5. User sees new season without manual intervention

### Graceful Degradation (No Cached Videos)

If videos aren't cached yet (cache miss), the query will simply return the current video without "up next" resolution. The UI can detect this and trigger background fetching:

```typescript
export function useContinueWatching() {
  const profileId = useProfileStore((state) => state.activeProfileId);

  return useLiveQuery(async () => {
    if (!profileId) return [];

    const items = await getContinueWatchingWithUpNext(profileId);

    // Items with NULL season/episode need video metadata fetched
    const itemsNeedingFetch = items.filter(
      (item) => item.type === 'series' && !item.video_season && !item.video_episode
    );

    if (itemsNeedingFetch.length > 0) {
      // Background fetch populates videos table, which enables "up next" on next query
      void fetchAndCacheVideos(itemsNeedingFetch.map((i) => i.meta_id));
    }

    return items;
  }, [profileId]);
}
```

**Behavior:**

- **First load (no cache):** Shows current video with progress
- **Background fetch:** Populates `videos` table
- **Next query:** Automatically shows "up next" if episode is finished

### Mutation API

```typescript
// db/mutations/watchHistory.ts

export async function upsertWatchProgress(params: {
  profileId: string;
  metaId: string;
  videoId?: string;
  type: ContentType;
  progressSeconds: number;
  durationSeconds: number;
  lastStreamTargetType?: 'url' | 'external' | 'yt';
  lastStreamTargetValue?: string;
}) {
  const now = Date.now();
  const progressRatio = params.progressSeconds / params.durationSeconds;
  const status = progressRatio >= PLAYBACK_FINISHED_RATIO ? 'completed' : 'watching';

  await db
    .insert(watchHistory)
    .values({
      ...params,
      status,
      lastWatchedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [watchHistory.profileId, watchHistory.metaId, watchHistory.videoId],
      set: {
        progressSeconds: params.progressSeconds,
        durationSeconds: params.durationSeconds,
        lastStreamTargetType: params.lastStreamTargetType,
        lastStreamTargetValue: params.lastStreamTargetValue,
        status,
        lastWatchedAt: now,
        updatedAt: now,
      },
    });
}

export async function dismissFromContinueWatching(profileId: string, metaId: string) {
  await db
    .update(watchHistory)
    .set({
      status: 'dismissed',
      dismissedAt: Date.now(),
      updatedAt: Date.now(),
    })
    .where(and(eq(watchHistory.profileId, profileId), eq(watchHistory.metaId, metaId)));
}
```

## Consequences

### Positive

1. **Massive Performance Improvement**: O(n²) → O(log n) queries
2. **Instant Home Screen**: No API calls, metadata cached locally
3. **Scalability**: 10,000+ records without degradation
4. **Up Next Works Offline**: Computed from cached episode data
5. **Future-Proof**: Schema ready for external sync (columns reserved)
6. **Relational Integrity**: Proper foreign keys and constraints
7. **Query Flexibility**: Complex filters at database level
8. **Type Safety**: Drizzle ORM provides full TypeScript inference
9. **Specials Handling**: Season 0 automatically sorted to end
10. **Cache Invalidation**: Automatic detection and refresh of stale metadata
11. **New Season Support**: Seamlessly picks up new episodes when cache refreshes

### Negative

1. **Migration Complexity**: One-time AsyncStorage → SQLite migration
2. **Bundle Size**: +~200 KB for expo-sqlite + Drizzle
3. **Storage Overhead**: Videos table adds ~5-10 KB per series
4. **Schema Versioning**: Need migration strategy for schema changes
5. **Testing Complexity**: Need to mock SQLite

### Neutral

1. **Hybrid Architecture**: Zustand for config, SQLite for data
2. **Cache Staleness**: 7-day TTL requires graceful expiry handling
3. **Partial Cache**: Can show continue watching even without all video data

## Implementation Plan

### Phase 1: Schema Setup

1. Install `expo-sqlite`, `drizzle-orm`, `drizzle-kit`
2. Define schema (watch_history, my_list, meta_cache, videos)
3. Create database client and connection
4. Write migration utilities

### Phase 2: Meta Cache & Cache Invalidation

1. Implement `upsertMetaCache` with videos table population
2. Add `isCacheStale` and `getMetaWithCache` query functions
3. Implement force refresh mechanism
4. Update `useMeta` hook to use cached data with auto-refresh
5. Add background refresh for stale caches
6. Test cache expiry and new episode detection

### Phase 3: Watch History Migration

1. Create watch history query/mutation functions with Drizzle ORM
2. Implement "up next" logic with season/episode-based queries
3. Build migration script from AsyncStorage
4. Update VideoPlayer to write to SQLite
5. Update `useContinueWatching` with new Drizzle queries
6. Test performance improvements and season 0 handling
7. Test performance improvements

### Phase 4: My List Migration

1. Create my list queries with soft deletes
2. Migrate data from AsyncStorage
3. Update UI components

### Phase 5: Cleanup

1. Remove old Zustand stores
2. Database maintenance (VACUUM, expired cache cleanup)
3. Performance monitoring

## Migration Strategy

```typescript
export async function migrateFromAsyncStorage() {
  console.log('Migrating to SQLite...');

  // 1. Watch History
  const whJson = await AsyncStorage.getItem('watch-history-storage');
  if (whJson) {
    const {
      state: { byProfile },
    } = JSON.parse(whJson);
    for (const [profileId, metaData] of Object.entries(byProfile)) {
      for (const [metaId, items] of Object.entries(metaData)) {
        for (const [videoKey, item] of Object.entries(items)) {
          await db.insert(watchHistory).values({
            profileId,
            metaId: item.id,
            videoId: videoKey === '_' ? null : item.videoId,
            type: item.type,
            progressSeconds: item.progressSeconds,
            durationSeconds: item.durationSeconds,
            status: 'watching',
            lastWatchedAt: item.lastWatchedAt,
            createdAt: item.lastWatchedAt,
            updatedAt: item.lastWatchedAt,
          });
        }
      }
    }
  }

  // 2. Dismissed items
  const cwJson = await AsyncStorage.getItem('continue-watching-storage');
  if (cwJson) {
    const {
      state: { byProfile },
    } = JSON.parse(cwJson);
    for (const [profileId, { hidden }] of Object.entries(byProfile)) {
      for (const metaId of Object.keys(hidden)) {
        await db
          .update(watchHistory)
          .set({ status: 'dismissed', dismissedAt: Date.now() })
          .where(and(eq(watchHistory.profileId, profileId), eq(watchHistory.metaId, metaId)));
      }
    }
  }

  // 3. My List
  // ... similar migration

  console.log('Migration complete!');
}
```

## References

- [Drizzle ORM - Expo SQLite](https://orm.drizzle.team/docs/get-started-sqlite#expo-sqlite)
- [expo-sqlite Documentation](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- Current: `src/store/watch-history.store.ts`, `src/hooks/useContinueWatching.ts`

## Notes

**Why season/episode instead of sequenceIndex?**

- Season/episode numbers are standardized and universal
- Works reliably for external sync scenarios
- More intuitive for users ("watch season 2, episode 3")
- Stremio videos always include season/episode for series content
- Easier to debug and verify correctness

**Season 0 (Specials) Handling:**

- Season 0 contains special episodes (OVAs, extras, etc.)
- Should be played AFTER regular seasons, not before
- Implementation: `CASE WHEN season = 0 THEN 999999 ELSE season END` in ORDER BY
- When transitioning from season 0, goes to season 1 first episode
- Specials are still accessible but don't interrupt main series flow

**Up Next Logic:**

- Implemented with Drizzle ORM for type safety and maintainability
- Two-query approach: (1) Get watch history, (2) Find next episodes in parallel
- Handles: same season next episode, next season first episode, season 0 edge cases
- Falls back gracefully when video metadata not cached
- Performance: O(k \* log n) where k = continue watching items (typically < 20)

**Cache Invalidation Strategy:**

- Metadata expires after 7 days (`expiresAt` field)
- Automatic stale detection on query
- Background refresh doesn't block UI
- Force refresh available for user pull-to-refresh
- New seasons/episodes: Automatically detected and cached on next refresh
- `onConflictDoUpdate` ensures videos table stays current without duplicates

**Why Drizzle ORM instead of raw SQL?**

- Full TypeScript type safety and autocomplete
- Easier to test and maintain
- Better error messages at compile time
- Can still drop down to raw SQL via `sql` template tag when needed
- Smaller two-query approach is actually more readable than large CTE

**Cache Expiry Strategy:**

- Metadata rarely changes → 7-day cache is safe
- On cache miss, fetch from API and populate
- Background job cleans expired entries
- User can force-refresh if needed

**Graceful Degradation:**

- Continue watching works even without cached videos
- "Up Next" falls back to current episode if no cache
- Background fetch populates missing data
- User experience: skeleton → cached data → fresh data
