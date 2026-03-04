/**
 * Integration tests for getContinueWatchingWithUpNext query
 *
 * These tests use expo-sqlite-mock to test against a real SQLite database.
 * Critical business logic tested:
 * - Filters: status != 'dismissed', progressSeconds > 0
 * - Deduplicates to show only latest item per metaId
 * - For finished series episodes, finds next unwatched episode
 * - Returns isUpNext=true when showing next episode
 */

import { PLAYBACK_FINISHED_RATIO } from '@/constants/playback';
import { initializeDatabase, db } from '../client';
import {
  getContinueWatchingWithUpNext,
  upsertWatchProgress,
  dismissFromContinueWatching,
} from '../queries/watchHistory';
import { watchHistory, metaCache, videos } from '../schema';
import { eq } from 'drizzle-orm';

describe('getContinueWatchingWithUpNext (integration)', () => {
  const testProfileId = 'cw-test-profile';

  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    // Clean up test data
    await db.delete(watchHistory).where(eq(watchHistory.profileId, testProfileId));
    await db.delete(watchHistory).where(eq(watchHistory.profileId, 'cw-profile-2'));
    // Clean up meta cache and videos used in tests
    await db.delete(metaCache);
    await db.delete(videos);
  });

  describe('basic filtering', () => {
    it('returns empty array when no watch history exists', async () => {
      const result = await getContinueWatchingWithUpNext(testProfileId);

      expect(result).toEqual([]);
    });

    it('excludes dismissed items', async () => {
      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'movie-dismissed',
        type: 'movie',
        progressSeconds: 500,
        durationSeconds: 1000,
      });

      await dismissFromContinueWatching(testProfileId, 'movie-dismissed');

      const result = await getContinueWatchingWithUpNext(testProfileId);

      expect(result).toEqual([]);
    });

    it('excludes items with zero progress', async () => {
      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'movie-zero',
        type: 'movie',
        progressSeconds: 0,
        durationSeconds: 1000,
      });

      const result = await getContinueWatchingWithUpNext(testProfileId);

      expect(result).toEqual([]);
    });

    it('includes items with progress > 0 and not dismissed', async () => {
      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'movie-active',
        type: 'movie',
        progressSeconds: 500,
        durationSeconds: 1000,
      });

      const result = await getContinueWatchingWithUpNext(testProfileId);

      expect(result).toHaveLength(1);
      expect(result[0].metaId).toBe('movie-active');
    });
  });

  describe('deduplication', () => {
    it('returns only the latest item per metaId', async () => {
      // Add first episode (older)
      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'series-1',
        videoId: 'ep-1',
        type: 'series',
        progressSeconds: 500,
        durationSeconds: 1000,
        lastWatchedAt: 1000,
      });

      // Add second episode (newer)
      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'series-1',
        videoId: 'ep-2',
        type: 'series',
        progressSeconds: 300,
        durationSeconds: 1000,
        lastWatchedAt: 2000,
      });

      const result = await getContinueWatchingWithUpNext(testProfileId);

      // Should only return one item per meta
      expect(result).toHaveLength(1);
      // Should be the latest one (ep-2 with lastWatchedAt: 2000)
      expect(result[0].videoId).toBe('ep-2');
      expect(result[0].lastWatchedAt).toBe(2000);
    });

    it('handles multiple different metas correctly', async () => {
      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'movie-1',
        type: 'movie',
        progressSeconds: 500,
        durationSeconds: 1000,
        lastWatchedAt: 3000,
      });

      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'series-1',
        videoId: 'ep-1',
        type: 'series',
        progressSeconds: 500,
        durationSeconds: 1000,
        lastWatchedAt: 2000,
      });

      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'movie-2',
        type: 'movie',
        progressSeconds: 200,
        durationSeconds: 1000,
        lastWatchedAt: 1000,
      });

      const result = await getContinueWatchingWithUpNext(testProfileId);

      expect(result).toHaveLength(3);
      // Should be sorted by lastWatchedAt desc
      expect(result[0].metaId).toBe('movie-1');
      expect(result[1].metaId).toBe('series-1');
      expect(result[2].metaId).toBe('movie-2');
    });
  });

  describe('progress ratio calculation', () => {
    it('calculates progressRatio correctly', async () => {
      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'movie-ratio',
        type: 'movie',
        progressSeconds: 450,
        durationSeconds: 1000,
      });

      const result = await getContinueWatchingWithUpNext(testProfileId);

      expect(result[0].progressRatio).toBe(0.45);
    });

    it('handles zero duration (no division by zero)', async () => {
      // Manually insert with zero duration since upsertWatchProgress validates
      const now = Date.now();
      await db.insert(watchHistory).values({
        profileId: testProfileId,
        metaId: 'movie-zero-duration',
        videoId: '',
        type: 'movie',
        progressSeconds: 100,
        durationSeconds: 0,
        status: 'watching',
        lastWatchedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      const result = await getContinueWatchingWithUpNext(testProfileId);

      expect(result[0].progressRatio).toBe(0);
    });
  });

  describe('up-next logic for series', () => {
    it('returns isUpNext=false for in-progress episodes', async () => {
      // Add video info for the episode
      await db.insert(videos).values({
        metaId: 'series-inprogress',
        videoId: 'ep-1',
        season: 1,
        episode: 1,
        fetchedAt: Date.now(),
      });

      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'series-inprogress',
        videoId: 'ep-1',
        type: 'series',
        progressSeconds: 500, // 50% - not finished
        durationSeconds: 1000,
      });

      const result = await getContinueWatchingWithUpNext(testProfileId);

      expect(result[0].isUpNext).toBe(false);
      expect(result[0].videoId).toBe('ep-1');
    });

    it('filters out finished movies (nothing to continue)', async () => {
      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'movie-finished',
        type: 'movie',
        progressSeconds: 950, // 95% - finished
        durationSeconds: 1000,
      });

      const result = await getContinueWatchingWithUpNext(testProfileId);

      // Completed movies have nothing to continue — they should not appear
      expect(result.find((r) => r.metaId === 'movie-finished')).toBeUndefined();
    });

    it('finds next episode for finished series episodes', async () => {
      // Add video info for episodes
      await db.insert(videos).values([
        {
          metaId: 'series-upnext',
          videoId: 'ep-1',
          season: 1,
          episode: 1,
          fetchedAt: Date.now(),
        },
        {
          metaId: 'series-upnext',
          videoId: 'ep-2',
          season: 1,
          episode: 2,
          fetchedAt: Date.now(),
        },
      ]);

      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'series-upnext',
        videoId: 'ep-1',
        type: 'series',
        progressSeconds: 950, // 95% - finished (>= 0.9)
        durationSeconds: 1000,
      });

      const result = await getContinueWatchingWithUpNext(testProfileId);

      expect(result[0].isUpNext).toBe(true);
      expect(result[0].videoId).toBe('ep-2');
      expect(result[0].progressSeconds).toBe(0);
      expect(result[0].progressRatio).toBe(0);
    });

    it('filters out finished series episode when no next episode exists', async () => {
      // Add video info for the last episode only
      await db.insert(videos).values({
        metaId: 'series-last',
        videoId: 'ep-10',
        season: 1,
        episode: 10,
        fetchedAt: Date.now(),
      });

      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'series-last',
        videoId: 'ep-10',
        type: 'series',
        progressSeconds: 950,
        durationSeconds: 1000,
      });

      const result = await getContinueWatchingWithUpNext(testProfileId);

      // Finished with no next episode — nothing to continue
      expect(result.find((r) => r.metaId === 'series-last')).toBeUndefined();
    });

    it('filters out finished series episode when video has no season info', async () => {
      // Add video without season info (special/extra)
      await db.insert(videos).values({
        metaId: 'series-special',
        videoId: 'special-1',
        season: null,
        episode: null,
        fetchedAt: Date.now(),
      });

      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'series-special',
        videoId: 'special-1',
        type: 'series',
        progressSeconds: 950,
        durationSeconds: 1000,
      });

      const result = await getContinueWatchingWithUpNext(testProfileId);

      // No season info means we can't find next episode — nothing to continue
      expect(result.find((r) => r.metaId === 'series-special')).toBeUndefined();
    });

    it('skips already watched episodes when finding next', async () => {
      // Add video info for episodes 1, 2, 3
      await db.insert(videos).values([
        {
          metaId: 'series-skip',
          videoId: 'ep-1',
          season: 1,
          episode: 1,
          fetchedAt: Date.now(),
        },
        {
          metaId: 'series-skip',
          videoId: 'ep-2',
          season: 1,
          episode: 2,
          fetchedAt: Date.now(),
        },
        {
          metaId: 'series-skip',
          videoId: 'ep-3',
          season: 1,
          episode: 3,
          fetchedAt: Date.now(),
        },
      ]);

      // Watch ep-1 (finished)
      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'series-skip',
        videoId: 'ep-1',
        type: 'series',
        progressSeconds: 950,
        durationSeconds: 1000,
        lastWatchedAt: 1000,
      });

      // Watch ep-2 (finished too)
      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'series-skip',
        videoId: 'ep-2',
        type: 'series',
        progressSeconds: 950,
        durationSeconds: 1000,
        lastWatchedAt: 2000,
      });

      const result = await getContinueWatchingWithUpNext(testProfileId);

      // Should show ep-3 as up-next since ep-1 and ep-2 are finished
      expect(result[0].isUpNext).toBe(true);
      expect(result[0].videoId).toBe('ep-3');
    });

    it('finds next episode across seasons', async () => {
      // Add video info for last episode of season 1 and first of season 2
      await db.insert(videos).values([
        {
          metaId: 'series-cross-season',
          videoId: 's1-ep-10',
          season: 1,
          episode: 10,
          fetchedAt: Date.now(),
        },
        {
          metaId: 'series-cross-season',
          videoId: 's2-ep-1',
          season: 2,
          episode: 1,
          fetchedAt: Date.now(),
        },
      ]);

      // Watch last episode of season 1 (finished)
      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'series-cross-season',
        videoId: 's1-ep-10',
        type: 'series',
        progressSeconds: 950,
        durationSeconds: 1000,
      });

      const result = await getContinueWatchingWithUpNext(testProfileId);

      // Should show first episode of season 2 as up-next
      expect(result[0].isUpNext).toBe(true);
      expect(result[0].videoId).toBe('s2-ep-1');
    });
  });

  describe('metadata fields', () => {
    it('includes metaName from cache', async () => {
      // Add meta cache entry
      await db.insert(metaCache).values({
        metaId: 'movie-cached',
        type: 'movie',
        name: 'Awesome Movie',
        fetchedAt: Date.now(),
        expiresAt: Date.now() + 86400000,
      });

      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'movie-cached',
        type: 'movie',
        progressSeconds: 500,
        durationSeconds: 1000,
      });

      const result = await getContinueWatchingWithUpNext(testProfileId);

      expect(result[0].metaName).toBe('Awesome Movie');
    });

    it('prefers background over poster for imageUrl', async () => {
      await db.insert(metaCache).values({
        metaId: 'movie-images',
        type: 'movie',
        name: 'Test Movie',
        poster: 'https://example.com/poster.jpg',
        background: 'https://example.com/background.jpg',
        fetchedAt: Date.now(),
        expiresAt: Date.now() + 86400000,
      });

      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'movie-images',
        type: 'movie',
        progressSeconds: 500,
        durationSeconds: 1000,
      });

      const result = await getContinueWatchingWithUpNext(testProfileId);

      expect(result[0].imageUrl).toBe('https://example.com/background.jpg');
    });

    it('falls back to poster when no background', async () => {
      await db.insert(metaCache).values({
        metaId: 'movie-poster-only',
        type: 'movie',
        name: 'Test Movie',
        poster: 'https://example.com/poster.jpg',
        background: null,
        fetchedAt: Date.now(),
        expiresAt: Date.now() + 86400000,
      });

      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'movie-poster-only',
        type: 'movie',
        progressSeconds: 500,
        durationSeconds: 1000,
      });

      const result = await getContinueWatchingWithUpNext(testProfileId);

      expect(result[0].imageUrl).toBe('https://example.com/poster.jpg');
    });
  });

  describe('limit parameter', () => {
    it('respects the limit parameter', async () => {
      // Add 15 movies
      for (let i = 0; i < 15; i++) {
        await upsertWatchProgress({
          profileId: testProfileId,
          metaId: `movie-limit-${i}`,
          type: 'movie',
          progressSeconds: 500,
          durationSeconds: 1000,
          lastWatchedAt: 1000 + i,
        });
      }

      const result = await getContinueWatchingWithUpNext(testProfileId, 10);

      expect(result).toHaveLength(10);
    });

    it('returns all items when fewer than limit exist', async () => {
      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'movie-only',
        type: 'movie',
        progressSeconds: 500,
        durationSeconds: 1000,
      });

      const result = await getContinueWatchingWithUpNext(testProfileId, 50);

      expect(result).toHaveLength(1);
    });
  });

  describe('profile isolation', () => {
    it('only returns items for the specified profile', async () => {
      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'movie-profile1',
        type: 'movie',
        progressSeconds: 500,
        durationSeconds: 1000,
      });

      await upsertWatchProgress({
        profileId: 'cw-profile-2',
        metaId: 'movie-profile2',
        type: 'movie',
        progressSeconds: 500,
        durationSeconds: 1000,
      });

      const result = await getContinueWatchingWithUpNext(testProfileId);

      expect(result).toHaveLength(1);
      expect(result[0].metaId).toBe('movie-profile1');
    });
  });
});

describe('PLAYBACK_FINISHED_RATIO threshold', () => {
  it('is 0.9 (90%)', () => {
    expect(PLAYBACK_FINISHED_RATIO).toBe(0.9);
  });

  describe('edge cases around threshold', () => {
    const testCases = [
      { progress: 899, duration: 1000, expected: 'watching' }, // 0.899 < 0.9
      { progress: 900, duration: 1000, expected: 'completed' }, // 0.9 >= 0.9
      { progress: 901, duration: 1000, expected: 'completed' }, // 0.901 >= 0.9
      { progress: 1000, duration: 1000, expected: 'completed' }, // 1.0 >= 0.9
    ];

    testCases.forEach(({ progress, duration, expected }) => {
      it(`${progress}/${duration} = ${(progress / duration).toFixed(3)} -> ${expected}`, () => {
        const ratio = progress / duration;
        const status = ratio >= PLAYBACK_FINISHED_RATIO ? 'completed' : 'watching';
        expect(status).toBe(expected);
      });
    });
  });
});
