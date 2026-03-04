/**
 * Integration tests for watchHistory database queries
 *
 * These tests use expo-sqlite-mock to test against a real SQLite database.
 * Critical business logic tested:
 * - upsertWatchProgress: status calculation (completed at 90%, watching below)
 * - dismissFromContinueWatching: sets status='dismissed' and dismissedAt
 * - getContinueWatchingWithUpNext: deduplication, up-next logic for finished episodes
 * - findNextUnwatchedEpisode: season transitions, excludes season 0
 */

import { PLAYBACK_FINISHED_RATIO } from '@/constants/playback';
import {
  upsertWatchProgress,
  dismissFromContinueWatching,
  undismissFromContinueWatching,
  listWatchHistoryForProfile,
  listWatchedMetaSummaries,
  getContinueWatchingWithUpNext,
  removeProfileWatchHistory,
  type DbWatchHistoryItem,
} from '../queries/watchHistory';
import { upsertMetaCache } from '../queries/metaCache';
import { initializeDatabase, db } from '../client';
import { watchHistory, metaCache, videos } from '../schema';
import { eq, and } from 'drizzle-orm';
import type { MetaDetail } from '@/types/stremio';

describe('watchHistory queries (integration)', () => {
  const testProfileId = 'test-profile-1';

  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    // Clean up test data
    await db.delete(watchHistory).where(eq(watchHistory.profileId, testProfileId));
    await db.delete(watchHistory).where(eq(watchHistory.profileId, 'test-profile-2'));
  });

  describe('upsertWatchProgress', () => {
    describe('status calculation', () => {
      it('sets status to "watching" when progress < 90%', async () => {
        await upsertWatchProgress({
          profileId: testProfileId,
          metaId: 'tt1234567',
          videoId: undefined,
          type: 'movie',
          progressSeconds: 450, // 45%
          durationSeconds: 1000,
        });

        const [result] = await db
          .select()
          .from(watchHistory)
          .where(
            and(eq(watchHistory.profileId, testProfileId), eq(watchHistory.metaId, 'tt1234567'))
          );

        expect(result.status).toBe('watching');
      });

      it('sets status to "completed" when progress >= 90%', async () => {
        await upsertWatchProgress({
          profileId: testProfileId,
          metaId: 'tt1234568',
          videoId: undefined,
          type: 'movie',
          progressSeconds: 900, // 90%
          durationSeconds: 1000,
        });

        const [result] = await db
          .select()
          .from(watchHistory)
          .where(
            and(eq(watchHistory.profileId, testProfileId), eq(watchHistory.metaId, 'tt1234568'))
          );

        expect(result.status).toBe('completed');
      });

      it('sets status to "completed" when progress > 90%', async () => {
        await upsertWatchProgress({
          profileId: testProfileId,
          metaId: 'tt1234569',
          videoId: undefined,
          type: 'movie',
          progressSeconds: 950, // 95%
          durationSeconds: 1000,
        });

        const [result] = await db
          .select()
          .from(watchHistory)
          .where(
            and(eq(watchHistory.profileId, testProfileId), eq(watchHistory.metaId, 'tt1234569'))
          );

        expect(result.status).toBe('completed');
      });

      it('handles edge case at exactly 90% threshold', async () => {
        // 899/1000 = 0.899 < 0.9 -> watching
        await upsertWatchProgress({
          profileId: testProfileId,
          metaId: 'tt-edge-1',
          videoId: undefined,
          type: 'movie',
          progressSeconds: 899,
          durationSeconds: 1000,
        });

        const [belowThreshold] = await db
          .select()
          .from(watchHistory)
          .where(
            and(eq(watchHistory.profileId, testProfileId), eq(watchHistory.metaId, 'tt-edge-1'))
          );
        expect(belowThreshold.status).toBe('watching');

        // 900/1000 = 0.9 >= 0.9 -> completed
        await upsertWatchProgress({
          profileId: testProfileId,
          metaId: 'tt-edge-2',
          videoId: undefined,
          type: 'movie',
          progressSeconds: 900,
          durationSeconds: 1000,
        });

        const [atThreshold] = await db
          .select()
          .from(watchHistory)
          .where(
            and(eq(watchHistory.profileId, testProfileId), eq(watchHistory.metaId, 'tt-edge-2'))
          );
        expect(atThreshold.status).toBe('completed');
      });

      it('handles zero duration without crashing', async () => {
        await upsertWatchProgress({
          profileId: testProfileId,
          metaId: 'tt-zero-dur',
          videoId: undefined,
          type: 'movie',
          progressSeconds: 100,
          durationSeconds: 0,
        });

        const [result] = await db
          .select()
          .from(watchHistory)
          .where(
            and(eq(watchHistory.profileId, testProfileId), eq(watchHistory.metaId, 'tt-zero-dur'))
          );

        // Should default to watching when duration is 0
        expect(result.status).toBe('watching');
      });
    });

    describe('upsert behavior', () => {
      it('creates new entry when none exists', async () => {
        await upsertWatchProgress({
          profileId: testProfileId,
          metaId: 'tt-new',
          videoId: undefined,
          type: 'movie',
          progressSeconds: 500,
          durationSeconds: 1000,
        });

        const results = await db
          .select()
          .from(watchHistory)
          .where(and(eq(watchHistory.profileId, testProfileId), eq(watchHistory.metaId, 'tt-new')));

        expect(results).toHaveLength(1);
      });

      it('updates existing entry with same profileId/metaId/videoId', async () => {
        // Initial progress
        await upsertWatchProgress({
          profileId: testProfileId,
          metaId: 'tt-update',
          videoId: 'main-video', // Use actual videoId for upsert to work
          type: 'movie',
          progressSeconds: 300,
          durationSeconds: 1000,
        });

        // Update progress
        await upsertWatchProgress({
          profileId: testProfileId,
          metaId: 'tt-update',
          videoId: 'main-video', // Same videoId
          type: 'movie',
          progressSeconds: 700,
          durationSeconds: 1000,
        });

        const results = await db
          .select()
          .from(watchHistory)
          .where(
            and(eq(watchHistory.profileId, testProfileId), eq(watchHistory.metaId, 'tt-update'))
          );

        expect(results).toHaveLength(1);
        expect(results[0].progressSeconds).toBe(700);
      });

      it('updates existing entry when videoId is undefined (movies)', async () => {
        // video_id is stored as '' for movies; the unique constraint fires correctly
        await upsertWatchProgress({
          profileId: testProfileId,
          metaId: 'tt-null-vid',
          videoId: undefined,
          type: 'movie',
          progressSeconds: 300,
          durationSeconds: 1000,
        });

        await upsertWatchProgress({
          profileId: testProfileId,
          metaId: 'tt-null-vid',
          videoId: undefined,
          type: 'movie',
          progressSeconds: 700,
          durationSeconds: 1000,
        });

        const results = await db
          .select()
          .from(watchHistory)
          .where(
            and(eq(watchHistory.profileId, testProfileId), eq(watchHistory.metaId, 'tt-null-vid'))
          );

        // Should upsert to a single row, not create duplicates
        expect(results).toHaveLength(1);
        expect(results[0].progressSeconds).toBe(700);
      });

      it('clears dismissedAt when updating progress', async () => {
        // Use a specific videoId for upsert to work correctly
        await upsertWatchProgress({
          profileId: testProfileId,
          metaId: 'tt-dismissed',
          videoId: 'video-1',
          type: 'movie',
          progressSeconds: 500,
          durationSeconds: 1000,
        });
        await dismissFromContinueWatching(testProfileId, 'tt-dismissed');

        // Check it's dismissed
        const [dismissed] = await db
          .select()
          .from(watchHistory)
          .where(
            and(eq(watchHistory.profileId, testProfileId), eq(watchHistory.metaId, 'tt-dismissed'))
          );
        expect(dismissed.status).toBe('dismissed');
        expect(dismissed.dismissedAt).not.toBeNull();

        // Now update progress - should clear dismissedAt via upsert
        await upsertWatchProgress({
          profileId: testProfileId,
          metaId: 'tt-dismissed',
          videoId: 'video-1',
          type: 'movie',
          progressSeconds: 600,
          durationSeconds: 1000,
        });

        const [updated] = await db
          .select()
          .from(watchHistory)
          .where(
            and(eq(watchHistory.profileId, testProfileId), eq(watchHistory.metaId, 'tt-dismissed'))
          );
        expect(updated.status).toBe('watching');
        expect(updated.dismissedAt).toBeNull();
      });

      it('stores lastStreamTargetType and lastStreamTargetValue', async () => {
        await upsertWatchProgress({
          profileId: testProfileId,
          metaId: 'tt-stream',
          videoId: undefined,
          type: 'movie',
          progressSeconds: 500,
          durationSeconds: 1000,
          lastStreamTargetType: 'url',
          lastStreamTargetValue: 'com.example.addon',
        });

        const [result] = await db
          .select()
          .from(watchHistory)
          .where(
            and(eq(watchHistory.profileId, testProfileId), eq(watchHistory.metaId, 'tt-stream'))
          );

        expect(result.lastStreamTargetType).toBe('url');
        expect(result.lastStreamTargetValue).toBe('com.example.addon');
      });
    });

    describe('series episodes', () => {
      it('creates separate entries for different episodes', async () => {
        await upsertWatchProgress({
          profileId: testProfileId,
          metaId: 'tt-series',
          videoId: 'ep-1',
          type: 'series',
          progressSeconds: 1000,
          durationSeconds: 1000,
        });

        await upsertWatchProgress({
          profileId: testProfileId,
          metaId: 'tt-series',
          videoId: 'ep-2',
          type: 'series',
          progressSeconds: 500,
          durationSeconds: 1000,
        });

        const results = await db
          .select()
          .from(watchHistory)
          .where(
            and(eq(watchHistory.profileId, testProfileId), eq(watchHistory.metaId, 'tt-series'))
          );

        expect(results).toHaveLength(2);
      });
    });
  });

  describe('dismissFromContinueWatching', () => {
    it('sets status to dismissed and dismissedAt timestamp', async () => {
      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'tt-to-dismiss',
        videoId: undefined,
        type: 'movie',
        progressSeconds: 500,
        durationSeconds: 1000,
      });

      const beforeDismiss = Date.now();
      await dismissFromContinueWatching(testProfileId, 'tt-to-dismiss');
      const afterDismiss = Date.now();

      const [result] = await db
        .select()
        .from(watchHistory)
        .where(
          and(eq(watchHistory.profileId, testProfileId), eq(watchHistory.metaId, 'tt-to-dismiss'))
        );

      expect(result.status).toBe('dismissed');
      expect(result.dismissedAt).toBeGreaterThanOrEqual(beforeDismiss);
      expect(result.dismissedAt).toBeLessThanOrEqual(afterDismiss);
    });

    it('dismisses all episodes of a series', async () => {
      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'tt-series-dismiss',
        videoId: 'ep-1',
        type: 'series',
        progressSeconds: 1000,
        durationSeconds: 1000,
      });

      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'tt-series-dismiss',
        videoId: 'ep-2',
        type: 'series',
        progressSeconds: 500,
        durationSeconds: 1000,
      });

      await dismissFromContinueWatching(testProfileId, 'tt-series-dismiss');

      const results = await db
        .select()
        .from(watchHistory)
        .where(
          and(
            eq(watchHistory.profileId, testProfileId),
            eq(watchHistory.metaId, 'tt-series-dismiss')
          )
        );

      expect(results).toHaveLength(2);
      expect(results.every((r: { status: string }) => r.status === 'dismissed')).toBe(true);
      expect(results.every((r: { dismissedAt: number | null }) => r.dismissedAt !== null)).toBe(
        true
      );
    });
  });

  describe('undismissFromContinueWatching', () => {
    it('restores status to watching and clears dismissedAt', async () => {
      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'tt-undismiss',
        videoId: undefined,
        type: 'movie',
        progressSeconds: 500,
        durationSeconds: 1000,
      });

      await dismissFromContinueWatching(testProfileId, 'tt-undismiss');
      await undismissFromContinueWatching(testProfileId, 'tt-undismiss');

      const [result] = await db
        .select()
        .from(watchHistory)
        .where(
          and(eq(watchHistory.profileId, testProfileId), eq(watchHistory.metaId, 'tt-undismiss'))
        );

      expect(result.status).toBe('watching');
      expect(result.dismissedAt).toBeNull();
    });
  });

  describe('listWatchHistoryForProfile', () => {
    it('includes dismissed items', async () => {
      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'tt-visible',
        videoId: undefined,
        type: 'movie',
        progressSeconds: 500,
        durationSeconds: 1000,
      });

      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'tt-hidden',
        videoId: undefined,
        type: 'movie',
        progressSeconds: 500,
        durationSeconds: 1000,
      });
      await dismissFromContinueWatching(testProfileId, 'tt-hidden');

      const results = await listWatchHistoryForProfile(testProfileId);

      expect(results.some((r: DbWatchHistoryItem) => r.id === 'tt-visible')).toBe(true);
      expect(results.some((r: DbWatchHistoryItem) => r.id === 'tt-hidden')).toBe(true);
    });

    it('only returns items for the specified profile', async () => {
      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'tt-profile1',
        videoId: undefined,
        type: 'movie',
        progressSeconds: 500,
        durationSeconds: 1000,
      });

      await upsertWatchProgress({
        profileId: 'test-profile-2',
        metaId: 'tt-profile2',
        videoId: undefined,
        type: 'movie',
        progressSeconds: 500,
        durationSeconds: 1000,
      });

      const results = await listWatchHistoryForProfile(testProfileId);

      expect(results.some((r: DbWatchHistoryItem) => r.id === 'tt-profile1')).toBe(true);
      expect(results.some((r: DbWatchHistoryItem) => r.id === 'tt-profile2')).toBe(false);
    });
  });

  describe('removeProfileWatchHistory', () => {
    it('deletes all watch history for a profile', async () => {
      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'tt-delete-1',
        videoId: undefined,
        type: 'movie',
        progressSeconds: 500,
        durationSeconds: 1000,
      });

      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'tt-delete-2',
        videoId: undefined,
        type: 'movie',
        progressSeconds: 500,
        durationSeconds: 1000,
      });

      await removeProfileWatchHistory(testProfileId);

      const results = await db
        .select()
        .from(watchHistory)
        .where(eq(watchHistory.profileId, testProfileId));

      expect(results).toHaveLength(0);
    });
  });
});

describe('getContinueWatchingWithUpNext (integration)', () => {
  const testProfileId = 'continue-watching-profile';

  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    // Clean up all test data
    await db.delete(watchHistory).where(eq(watchHistory.profileId, testProfileId));
    await db.delete(metaCache);
    await db.delete(videos);
  });

  async function seedSeriesMeta(
    metaId: string,
    episodeList: Array<{ videoId: string; season: number; episode: number }>
  ) {
    const meta: MetaDetail = {
      id: metaId,
      type: 'series',
      name: 'Test Series',
      videos: episodeList.map((ep) => ({
        id: ep.videoId,
        title: `S${ep.season}E${ep.episode}`,
        season: ep.season,
        episode: ep.episode,
        released: '2023-01-01',
      })),
    };
    await upsertMetaCache(meta);
  }

  describe('deduplication', () => {
    it('returns only the latest item per metaId', async () => {
      const metaId = 'tt-dedup-series';
      await seedSeriesMeta(metaId, [
        { videoId: 'ep-1', season: 1, episode: 1 },
        { videoId: 'ep-2', season: 1, episode: 2 },
      ]);

      // Watch ep-1 first
      await upsertWatchProgress({
        profileId: testProfileId,
        metaId,
        videoId: 'ep-1',
        type: 'series',
        progressSeconds: 500,
        durationSeconds: 1000,
      });

      // Then watch ep-2 (more recent)
      await new Promise((r) => setTimeout(r, 10)); // Ensure different timestamp
      await upsertWatchProgress({
        profileId: testProfileId,
        metaId,
        videoId: 'ep-2',
        type: 'series',
        progressSeconds: 300,
        durationSeconds: 1000,
      });

      const results = await getContinueWatchingWithUpNext(testProfileId);

      // Should only show one entry for this series
      const seriesEntries = results.filter((r) => r.metaId === metaId);
      expect(seriesEntries).toHaveLength(1);
      // Should be the latest one (ep-2)
      expect(seriesEntries[0].videoId).toBe('ep-2');
    });

    it('handles multiple different metas', async () => {
      // Seed two different series
      await seedSeriesMeta('tt-series-1', [{ videoId: 'ep-1', season: 1, episode: 1 }]);
      await seedSeriesMeta('tt-series-2', [{ videoId: 'ep-1', season: 1, episode: 1 }]);

      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'tt-series-1',
        videoId: 'ep-1',
        type: 'series',
        progressSeconds: 500,
        durationSeconds: 1000,
      });

      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'tt-series-2',
        videoId: 'ep-1',
        type: 'series',
        progressSeconds: 300,
        durationSeconds: 1000,
      });

      const results = await getContinueWatchingWithUpNext(testProfileId);

      expect(results).toHaveLength(2);
    });
  });

  describe('up-next logic', () => {
    it('returns isUpNext=false for in-progress episodes', async () => {
      const metaId = 'tt-in-progress';
      await seedSeriesMeta(metaId, [
        { videoId: 'ep-1', season: 1, episode: 1 },
        { videoId: 'ep-2', season: 1, episode: 2 },
      ]);

      await upsertWatchProgress({
        profileId: testProfileId,
        metaId,
        videoId: 'ep-1',
        type: 'series',
        progressSeconds: 500, // 50% - not finished
        durationSeconds: 1000,
      });

      const results = await getContinueWatchingWithUpNext(testProfileId);
      const entry = results.find((r) => r.metaId === metaId);

      expect(entry?.isUpNext).toBe(false);
      expect(entry?.videoId).toBe('ep-1');
    });

    it('returns isUpNext=true and next episode when current is finished', async () => {
      const metaId = 'tt-finished-ep';
      await seedSeriesMeta(metaId, [
        { videoId: 'ep-1', season: 1, episode: 1 },
        { videoId: 'ep-2', season: 1, episode: 2 },
      ]);

      await upsertWatchProgress({
        profileId: testProfileId,
        metaId,
        videoId: 'ep-1',
        type: 'series',
        progressSeconds: 950, // 95% - finished
        durationSeconds: 1000,
      });

      const results = await getContinueWatchingWithUpNext(testProfileId);
      const entry = results.find((r) => r.metaId === metaId);

      expect(entry?.isUpNext).toBe(true);
      expect(entry?.videoId).toBe('ep-2');
      expect(entry?.progressSeconds).toBe(0);
      expect(entry?.progressRatio).toBe(0);
    });

    it('filters out finished series when no next episode exists (series finale)', async () => {
      const metaId = 'tt-finale';
      await seedSeriesMeta(metaId, [{ videoId: 'ep-1', season: 1, episode: 1 }]); // Only one episode

      await upsertWatchProgress({
        profileId: testProfileId,
        metaId,
        videoId: 'ep-1',
        type: 'series',
        progressSeconds: 950,
        durationSeconds: 1000,
      });

      const results = await getContinueWatchingWithUpNext(testProfileId);
      const entry = results.find((r) => r.metaId === metaId);

      // Finished with no next episode — nothing to continue
      expect(entry).toBeUndefined();
    });

    it('finds next episode in next season', async () => {
      const metaId = 'tt-next-season';
      await seedSeriesMeta(metaId, [
        { videoId: 's1e1', season: 1, episode: 1 },
        { videoId: 's2e1', season: 2, episode: 1 },
      ]);

      await upsertWatchProgress({
        profileId: testProfileId,
        metaId,
        videoId: 's1e1',
        type: 'series',
        progressSeconds: 950,
        durationSeconds: 1000,
      });

      const results = await getContinueWatchingWithUpNext(testProfileId);
      const entry = results.find((r) => r.metaId === metaId);

      expect(entry?.isUpNext).toBe(true);
      expect(entry?.videoId).toBe('s2e1');
    });

    it('skips already-watched episodes when finding up-next', async () => {
      const metaId = 'tt-skip-watched';
      await seedSeriesMeta(metaId, [
        { videoId: 'ep-1', season: 1, episode: 1 },
        { videoId: 'ep-2', season: 1, episode: 2 },
        { videoId: 'ep-3', season: 1, episode: 3 },
      ]);

      // Finish ep-1
      await upsertWatchProgress({
        profileId: testProfileId,
        metaId,
        videoId: 'ep-1',
        type: 'series',
        progressSeconds: 950,
        durationSeconds: 1000,
      });

      // Also finish ep-2
      await upsertWatchProgress({
        profileId: testProfileId,
        metaId,
        videoId: 'ep-2',
        type: 'series',
        progressSeconds: 950,
        durationSeconds: 1000,
      });

      const results = await getContinueWatchingWithUpNext(testProfileId);
      const entry = results.find((r) => r.metaId === metaId);

      // Should show ep-3 as up-next (skipping ep-2 which is also finished)
      expect(entry?.isUpNext).toBe(true);
      expect(entry?.videoId).toBe('ep-3');
    });
  });

  describe('filtering', () => {
    it('excludes dismissed items', async () => {
      const metaId = 'tt-dismissed-filter';
      await seedSeriesMeta(metaId, [{ videoId: 'ep-1', season: 1, episode: 1 }]);

      await upsertWatchProgress({
        profileId: testProfileId,
        metaId,
        videoId: 'ep-1',
        type: 'series',
        progressSeconds: 500,
        durationSeconds: 1000,
      });

      await dismissFromContinueWatching(testProfileId, metaId);

      const results = await getContinueWatchingWithUpNext(testProfileId);

      expect(results.some((r) => r.metaId === metaId)).toBe(false);
    });

    it('excludes items with zero progress', async () => {
      const metaId = 'tt-zero-progress';
      await seedSeriesMeta(metaId, [{ videoId: 'ep-1', season: 1, episode: 1 }]);

      await upsertWatchProgress({
        profileId: testProfileId,
        metaId,
        videoId: 'ep-1',
        type: 'series',
        progressSeconds: 0, // No progress
        durationSeconds: 1000,
      });

      const results = await getContinueWatchingWithUpNext(testProfileId);

      expect(results.some((r) => r.metaId === metaId)).toBe(false);
    });
  });

  describe('metadata', () => {
    it('includes metaName from cache', async () => {
      const metaId = 'tt-meta-name';
      const meta: MetaDetail = {
        id: metaId,
        type: 'movie',
        name: 'Awesome Movie Title',
      };
      await upsertMetaCache(meta);

      await upsertWatchProgress({
        profileId: testProfileId,
        metaId,
        videoId: undefined,
        type: 'movie',
        progressSeconds: 500,
        durationSeconds: 1000,
      });

      const results = await getContinueWatchingWithUpNext(testProfileId);
      const entry = results.find((r) => r.metaId === metaId);

      expect(entry?.metaName).toBe('Awesome Movie Title');
    });

    it('prefers background over poster for imageUrl', async () => {
      const metaId = 'tt-image-pref';
      const meta: MetaDetail = {
        id: metaId,
        type: 'movie',
        name: 'Test Movie',
        poster: 'https://example.com/poster.jpg',
        background: 'https://example.com/background.jpg',
      };
      await upsertMetaCache(meta);

      await upsertWatchProgress({
        profileId: testProfileId,
        metaId,
        videoId: undefined,
        type: 'movie',
        progressSeconds: 500,
        durationSeconds: 1000,
      });

      const results = await getContinueWatchingWithUpNext(testProfileId);
      const entry = results.find((r) => r.metaId === metaId);

      expect(entry?.imageUrl).toBe('https://example.com/background.jpg');
    });

    it('falls back to poster when no background', async () => {
      const metaId = 'tt-poster-fallback';
      const meta: MetaDetail = {
        id: metaId,
        type: 'movie',
        name: 'Test Movie',
        poster: 'https://example.com/poster.jpg',
        // No background
      };
      await upsertMetaCache(meta);

      await upsertWatchProgress({
        profileId: testProfileId,
        metaId,
        videoId: undefined,
        type: 'movie',
        progressSeconds: 500,
        durationSeconds: 1000,
      });

      const results = await getContinueWatchingWithUpNext(testProfileId);
      const entry = results.find((r) => r.metaId === metaId);

      expect(entry?.imageUrl).toBe('https://example.com/poster.jpg');
    });
  });

  describe('progress calculation', () => {
    it('calculates progressRatio correctly', async () => {
      const metaId = 'tt-ratio-calc';
      const meta: MetaDetail = { id: metaId, type: 'movie', name: 'Test' };
      await upsertMetaCache(meta);

      await upsertWatchProgress({
        profileId: testProfileId,
        metaId,
        videoId: undefined,
        type: 'movie',
        progressSeconds: 450,
        durationSeconds: 1000,
      });

      const results = await getContinueWatchingWithUpNext(testProfileId);
      const entry = results.find((r) => r.metaId === metaId);

      expect(entry?.progressRatio).toBeCloseTo(0.45, 2);
    });
  });
});

describe('listWatchedMetaSummaries (integration)', () => {
  const testProfileId = 'summaries-profile';

  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    await db.delete(watchHistory).where(eq(watchHistory.profileId, testProfileId));
    await db.delete(watchHistory).where(eq(watchHistory.profileId, 'summaries-profile-2'));
    await db.delete(metaCache);
    await db.delete(videos);
  });

  it('returns one summary per metaId', async () => {
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-a',
      videoId: 'ep-1',
      type: 'series',
      progressSeconds: 500,
      durationSeconds: 1000,
    });
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-a',
      videoId: 'ep-2',
      type: 'series',
      progressSeconds: 300,
      durationSeconds: 1000,
    });
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-b',
      videoId: undefined,
      type: 'movie',
      progressSeconds: 200,
      durationSeconds: 1000,
    });

    const results = await listWatchedMetaSummaries(testProfileId);

    expect(results.filter((r) => r.id === 'tt-a')).toHaveLength(1);
    expect(results.filter((r) => r.id === 'tt-b')).toHaveLength(1);
    expect(results).toHaveLength(2);
  });

  it('picks the latest item per metaId', async () => {
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-latest',
      videoId: 'ep-1',
      type: 'series',
      progressSeconds: 100,
      durationSeconds: 1000,
      lastWatchedAt: 1000,
    });
    await new Promise((r) => setTimeout(r, 10));
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-latest',
      videoId: 'ep-2',
      type: 'series',
      progressSeconds: 800,
      durationSeconds: 1000,
      lastWatchedAt: 2000,
    });

    const results = await listWatchedMetaSummaries(testProfileId);
    const entry = results.find((r) => r.id === 'tt-latest');

    expect(entry).toBeDefined();
    expect(entry?.latestItem?.videoId).toBe('ep-2');
    expect(entry?.progressRatio).toBeCloseTo(0.8, 2);
  });

  it('returns results sorted by lastWatchedAt descending', async () => {
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-old',
      videoId: undefined,
      type: 'movie',
      progressSeconds: 500,
      durationSeconds: 1000,
      lastWatchedAt: 1000,
    });
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-new',
      videoId: undefined,
      type: 'movie',
      progressSeconds: 500,
      durationSeconds: 1000,
      lastWatchedAt: 5000,
    });

    const results = await listWatchedMetaSummaries(testProfileId);

    expect(results[0].id).toBe('tt-new');
    expect(results[1].id).toBe('tt-old');
  });

  it('sets isInProgress=true for partially watched items', async () => {
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-in-progress',
      videoId: undefined,
      type: 'movie',
      progressSeconds: 500, // 50%
      durationSeconds: 1000,
    });

    const results = await listWatchedMetaSummaries(testProfileId);
    const entry = results.find((r) => r.id === 'tt-in-progress');

    expect(entry?.isInProgress).toBe(true);
  });

  it('sets isInProgress=false for completed items', async () => {
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-completed',
      videoId: undefined,
      type: 'movie',
      progressSeconds: 950, // 95%
      durationSeconds: 1000,
    });

    const results = await listWatchedMetaSummaries(testProfileId);
    const entry = results.find((r) => r.id === 'tt-completed');

    expect(entry?.isInProgress).toBe(false);
  });

  it('includes dismissed items', async () => {
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-dismissed-summary',
      videoId: undefined,
      type: 'movie',
      progressSeconds: 500,
      durationSeconds: 1000,
    });
    await dismissFromContinueWatching(testProfileId, 'tt-dismissed-summary');

    const results = await listWatchedMetaSummaries(testProfileId);

    expect(results.some((r) => r.id === 'tt-dismissed-summary')).toBe(true);
  });

  describe('metaName and imageUrl from meta_cache', () => {
    it('returns metaName and imageUrl when cached', async () => {
      const meta: MetaDetail = {
        id: 'tt-cached',
        type: 'movie',
        name: 'Cached Movie',
        background: 'https://example.com/bg.jpg',
        poster: 'https://example.com/poster.jpg',
      };
      await upsertMetaCache(meta);

      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'tt-cached',
        videoId: undefined,
        type: 'movie',
        progressSeconds: 500,
        durationSeconds: 1000,
      });

      const results = await listWatchedMetaSummaries(testProfileId);
      const entry = results.find((r) => r.id === 'tt-cached');

      expect(entry?.metaName).toBe('Cached Movie');
      expect(entry?.imageUrl).toBe('https://example.com/poster.jpg');
    });

    it('prefers poster over background for imageUrl', async () => {
      const meta: MetaDetail = {
        id: 'tt-bg-pref',
        type: 'movie',
        name: 'Test',
        background: 'https://example.com/bg.jpg',
        poster: 'https://example.com/poster.jpg',
      };
      await upsertMetaCache(meta);

      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'tt-bg-pref',
        videoId: undefined,
        type: 'movie',
        progressSeconds: 500,
        durationSeconds: 1000,
      });

      const results = await listWatchedMetaSummaries(testProfileId);
      const entry = results.find((r) => r.id === 'tt-bg-pref');

      expect(entry?.imageUrl).toBe('https://example.com/poster.jpg');
    });

    it('falls back to poster when no background in cache', async () => {
      const meta: MetaDetail = {
        id: 'tt-poster-only',
        type: 'movie',
        name: 'Test',
        poster: 'https://example.com/poster.jpg',
      };
      await upsertMetaCache(meta);

      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'tt-poster-only',
        videoId: undefined,
        type: 'movie',
        progressSeconds: 500,
        durationSeconds: 1000,
      });

      const results = await listWatchedMetaSummaries(testProfileId);
      const entry = results.find((r) => r.id === 'tt-poster-only');

      expect(entry?.imageUrl).toBe('https://example.com/poster.jpg');
    });

    it('returns undefined metaName and imageUrl when cache is empty', async () => {
      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'tt-no-cache',
        videoId: undefined,
        type: 'movie',
        progressSeconds: 500,
        durationSeconds: 1000,
      });

      const results = await listWatchedMetaSummaries(testProfileId);
      const entry = results.find((r) => r.id === 'tt-no-cache');

      expect(entry?.metaName).toBeUndefined();
      expect(entry?.imageUrl).toBeUndefined();
    });
  });

  describe('latestVideo (season/episode) from videos table', () => {
    it('resolves season and episode for a series entry', async () => {
      const meta: MetaDetail = {
        id: 'tt-series-ep',
        type: 'series',
        name: 'Test Series',
        videos: [{ id: 's1e3', title: 'S1E3', season: 1, episode: 3, released: '2023-01-01' }],
      };
      await upsertMetaCache(meta);

      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'tt-series-ep',
        videoId: 's1e3',
        type: 'series',
        progressSeconds: 400,
        durationSeconds: 1000,
      });

      const results = await listWatchedMetaSummaries(testProfileId);
      const entry = results.find((r) => r.id === 'tt-series-ep');

      expect(entry?.latestVideo).toEqual({ season: 1, episode: 3 });
    });

    it('returns undefined latestVideo for movies (no videoId)', async () => {
      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'tt-movie-no-vid',
        videoId: undefined,
        type: 'movie',
        progressSeconds: 500,
        durationSeconds: 1000,
      });

      const results = await listWatchedMetaSummaries(testProfileId);
      const entry = results.find((r) => r.id === 'tt-movie-no-vid');

      expect(entry?.latestVideo).toBeUndefined();
    });

    it('returns undefined latestVideo when video not found in cache', async () => {
      // Watch a video that has no metadata in videos table
      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'tt-no-video-meta',
        videoId: 'some-ep',
        type: 'series',
        progressSeconds: 400,
        durationSeconds: 1000,
      });

      const results = await listWatchedMetaSummaries(testProfileId);
      const entry = results.find((r) => r.id === 'tt-no-video-meta');

      expect(entry?.latestVideo).toBeUndefined();
    });
  });
});

describe('PLAYBACK_FINISHED_RATIO', () => {
  it('is 0.9 (90%)', () => {
    expect(PLAYBACK_FINISHED_RATIO).toBe(0.9);
  });
});
