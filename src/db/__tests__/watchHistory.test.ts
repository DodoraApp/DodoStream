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
  listWatchHistoryForMeta,
  listWatchedMetaSummaries,
  removeProfileWatchHistory,
  removeWatchHistoryItem,
  removeWatchHistoryMeta,
  getWatchHistoryItem,
  setLastStreamTarget,
  getLastStreamTarget,
  type DbWatchHistoryItem,
} from '../queries/watchHistory';
import { upsertMetaCache } from '../queries/metaCache';
import { initializeDatabase, db } from '../client';
import { watchHistory, metaCache, videos, syncQueue } from '../schema';
import { eq, and } from 'drizzle-orm';
import type { MetaDetail } from '@/types/stremio';

jest.mock('@/store/integrations.store', () => ({
  useIntegrationsStore: {
    getState: () => ({
      settings: {
        'test-profile-1': {
          simkl: { connection: true },
        },
        'remove-item-profile': {
          simkl: { connection: true },
        },
        'remove-meta-profile': {
          simkl: { connection: true },
        },
      },
    }),
  },
}));

describe('watchHistory queries (integration)', () => {
  const testProfileId = 'test-profile-1';

  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    // Clean up test data
    await db.delete(watchHistory).where(eq(watchHistory.profileId, testProfileId));
    await db.delete(watchHistory).where(eq(watchHistory.profileId, 'test-profile-2'));
    await db.delete(syncQueue);
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

    it('cancels pending remove_history and remove_watchlist actions in syncQueue', async () => {
      // First manually insert a syncQueue item
      await db.insert(syncQueue).values([
        {
          profileId: testProfileId,
          provider: 'simkl',
          action: 'remove_history',
          metaId: 'tt-cancel-hist',
          type: 'movie',
          createdAt: Date.now(),
        },
        {
          profileId: testProfileId,
          provider: 'simkl',
          action: 'remove_watchlist',
          metaId: 'tt-cancel-hist',
          type: 'movie',
          createdAt: Date.now(),
        },
      ]);

      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'tt-cancel-hist',
        type: 'movie',
        progressSeconds: 100,
        durationSeconds: 1000,
      });

      const queue = await db
        .select()
        .from(syncQueue)
        .where(eq(syncQueue.metaId, 'tt-cancel-hist'));
      
      expect(queue).toHaveLength(0);
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

describe('getWatchHistoryItem (integration)', () => {
  const testProfileId = 'get-item-profile';

  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    await db.delete(watchHistory).where(eq(watchHistory.profileId, testProfileId));
  });

  it('returns an item by profileId, metaId, and videoId', async () => {
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-get-1',
      videoId: 'ep-1',
      type: 'series',
      progressSeconds: 500,
      durationSeconds: 1000,
      lastStreamTargetType: 'url',
      lastStreamTargetValue: 'https://stream.example.com',
    });

    const result = await getWatchHistoryItem(testProfileId, 'tt-get-1', 'ep-1');

    expect(result).toBeDefined();
    expect(result?.id).toBe('tt-get-1');
    expect(result?.type).toBe('series');
    expect(result?.videoId).toBe('ep-1');
    expect(result?.progressSeconds).toBe(500);
    expect(result?.durationSeconds).toBe(1000);
    expect(result?.lastStreamTargetType).toBe('url');
    expect(result?.lastStreamTargetValue).toBe('https://stream.example.com');
  });

  it('returns undefined for nonexistent item', async () => {
    const result = await getWatchHistoryItem(testProfileId, 'nonexistent', 'ep-1');

    expect(result).toBeUndefined();
  });

  it('resolves videoId=undefined to videoId="" lookup (movies)', async () => {
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-movie-get',
      videoId: undefined,
      type: 'movie',
      progressSeconds: 300,
      durationSeconds: 1000,
    });

    const result = await getWatchHistoryItem(testProfileId, 'tt-movie-get');

    expect(result).toBeDefined();
    expect(result?.id).toBe('tt-movie-get');
    expect(result?.videoId).toBeUndefined(); // '' is converted to undefined
  });

  it('distinguishes between different videoIds for same meta', async () => {
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-multi-ep',
      videoId: 'ep-1',
      type: 'series',
      progressSeconds: 100,
      durationSeconds: 1000,
    });
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-multi-ep',
      videoId: 'ep-2',
      type: 'series',
      progressSeconds: 700,
      durationSeconds: 1000,
    });

    const ep1 = await getWatchHistoryItem(testProfileId, 'tt-multi-ep', 'ep-1');
    const ep2 = await getWatchHistoryItem(testProfileId, 'tt-multi-ep', 'ep-2');

    expect(ep1?.progressSeconds).toBe(100);
    expect(ep2?.progressSeconds).toBe(700);
  });

  it('does not return items from other profiles', async () => {
    await upsertWatchProgress({
      profileId: 'other-profile',
      metaId: 'tt-other',
      videoId: undefined,
      type: 'movie',
      progressSeconds: 500,
      durationSeconds: 1000,
    });

    const result = await getWatchHistoryItem(testProfileId, 'tt-other');

    expect(result).toBeUndefined();

    // Cleanup
    await db.delete(watchHistory).where(eq(watchHistory.profileId, 'other-profile'));
  });
});

describe('listWatchHistoryForMeta (integration)', () => {
  const testProfileId = 'list-meta-profile';

  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    await db.delete(watchHistory).where(eq(watchHistory.profileId, testProfileId));
    await db.delete(watchHistory).where(eq(watchHistory.profileId, 'list-meta-profile-2'));
  });

  it('returns all episodes for a specific meta', async () => {
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-series-meta',
      videoId: 'ep-1',
      type: 'series',
      progressSeconds: 500,
      durationSeconds: 1000,
    });
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-series-meta',
      videoId: 'ep-2',
      type: 'series',
      progressSeconds: 300,
      durationSeconds: 1000,
    });
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-series-meta',
      videoId: 'ep-3',
      type: 'series',
      progressSeconds: 100,
      durationSeconds: 1000,
    });

    const results = await listWatchHistoryForMeta(testProfileId, 'tt-series-meta');

    expect(results).toHaveLength(3);
    expect(results.map((r) => r.videoId).sort()).toEqual(['ep-1', 'ep-2', 'ep-3']);
  });

  it('filters out dismissed items', async () => {
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-dismissed-meta',
      videoId: 'ep-1',
      type: 'series',
      progressSeconds: 500,
      durationSeconds: 1000,
    });
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-dismissed-meta',
      videoId: 'ep-2',
      type: 'series',
      progressSeconds: 300,
      durationSeconds: 1000,
    });

    await dismissFromContinueWatching(testProfileId, 'tt-dismissed-meta');

    const results = await listWatchHistoryForMeta(testProfileId, 'tt-dismissed-meta');

    expect(results).toHaveLength(0);
  });

  it('does not return items from other metas', async () => {
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-meta-a',
      videoId: 'ep-1',
      type: 'series',
      progressSeconds: 500,
      durationSeconds: 1000,
    });
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-meta-b',
      videoId: 'ep-1',
      type: 'series',
      progressSeconds: 300,
      durationSeconds: 1000,
    });

    const results = await listWatchHistoryForMeta(testProfileId, 'tt-meta-a');

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('tt-meta-a');
  });

  it('only returns items for the specified profile', async () => {
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-profile-iso',
      videoId: 'ep-1',
      type: 'series',
      progressSeconds: 500,
      durationSeconds: 1000,
    });
    await upsertWatchProgress({
      profileId: 'list-meta-profile-2',
      metaId: 'tt-profile-iso',
      videoId: 'ep-1',
      type: 'series',
      progressSeconds: 300,
      durationSeconds: 1000,
    });

    const results = await listWatchHistoryForMeta(testProfileId, 'tt-profile-iso');

    expect(results).toHaveLength(1);
  });

  it('returns empty array when no history exists for meta', async () => {
    const results = await listWatchHistoryForMeta(testProfileId, 'nonexistent-meta');

    expect(results).toEqual([]);
  });
});

describe('removeWatchHistoryItem (integration)', () => {
  const testProfileId = 'remove-item-profile';

  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    await db.delete(watchHistory).where(eq(watchHistory.profileId, testProfileId));
  });

  it('removes a single movie (videoId=undefined maps to "")', async () => {
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-remove-movie',
      videoId: undefined,
      type: 'movie',
      progressSeconds: 500,
      durationSeconds: 1000,
    });

    await removeWatchHistoryItem(testProfileId, 'tt-remove-movie');

    const results = await db
      .select()
      .from(watchHistory)
      .where(
        and(eq(watchHistory.profileId, testProfileId), eq(watchHistory.metaId, 'tt-remove-movie'))
      );

    expect(results).toHaveLength(0);
  });

  it('removes a single episode by videoId', async () => {
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-remove-ep',
      videoId: 'ep-1',
      type: 'series',
      progressSeconds: 500,
      durationSeconds: 1000,
    });
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-remove-ep',
      videoId: 'ep-2',
      type: 'series',
      progressSeconds: 300,
      durationSeconds: 1000,
    });

    await removeWatchHistoryItem(testProfileId, 'tt-remove-ep', 'ep-1');

    const results = await db
      .select()
      .from(watchHistory)
      .where(
        and(eq(watchHistory.profileId, testProfileId), eq(watchHistory.metaId, 'tt-remove-ep'))
      );

    expect(results).toHaveLength(1);
    expect(results[0].videoId).toBe('ep-2');
  });

  it('does not affect other metas', async () => {
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-remove-a',
      videoId: undefined,
      type: 'movie',
      progressSeconds: 500,
      durationSeconds: 1000,
    });
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-remove-b',
      videoId: undefined,
      type: 'movie',
      progressSeconds: 300,
      durationSeconds: 1000,
    });

    await removeWatchHistoryItem(testProfileId, 'tt-remove-a');

    const results = await db
      .select()
      .from(watchHistory)
      .where(
        and(eq(watchHistory.profileId, testProfileId), eq(watchHistory.metaId, 'tt-remove-b'))
      );

    expect(results).toHaveLength(1);
  });

  it('adds remove_history action to syncQueue for active providers', async () => {
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-remove-sync',
      videoId: 'ep-1',
      type: 'series',
      progressSeconds: 500,
      durationSeconds: 1000,
    });

    await removeWatchHistoryItem(testProfileId, 'tt-remove-sync', 'ep-1');

    const queue = await db
      .select()
      .from(syncQueue)
      .where(and(eq(syncQueue.metaId, 'tt-remove-sync'), eq(syncQueue.videoId, 'ep-1')));

    expect(queue).toHaveLength(1);
    expect(queue[0].action).toBe('remove_history');
    expect(queue[0].provider).toBe('simkl');
    expect(queue[0].type).toBe('series');
  });
});

describe('removeWatchHistoryMeta (integration)', () => {
  const testProfileId = 'remove-meta-profile';

  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    await db.delete(watchHistory).where(eq(watchHistory.profileId, testProfileId));
  });

  it('removes all episodes for a meta', async () => {
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-remove-all',
      videoId: 'ep-1',
      type: 'series',
      progressSeconds: 500,
      durationSeconds: 1000,
    });
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-remove-all',
      videoId: 'ep-2',
      type: 'series',
      progressSeconds: 300,
      durationSeconds: 1000,
    });

    await removeWatchHistoryMeta(testProfileId, 'tt-remove-all');

    const results = await db
      .select()
      .from(watchHistory)
      .where(
        and(eq(watchHistory.profileId, testProfileId), eq(watchHistory.metaId, 'tt-remove-all'))
      );

    expect(results).toHaveLength(0);
  });

  it('does not affect other metas for the same profile', async () => {
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-meta-remove-a',
      videoId: undefined,
      type: 'movie',
      progressSeconds: 500,
      durationSeconds: 1000,
    });
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-meta-remove-b',
      videoId: undefined,
      type: 'movie',
      progressSeconds: 300,
      durationSeconds: 1000,
    });

    await removeWatchHistoryMeta(testProfileId, 'tt-meta-remove-a');

    const remaining = await db
      .select()
      .from(watchHistory)
      .where(eq(watchHistory.profileId, testProfileId));

    expect(remaining).toHaveLength(1);
    expect(remaining[0].metaId).toBe('tt-meta-remove-b');
  });

  it('adds remove_history action to syncQueue for active providers', async () => {
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-remove-meta-sync',
      videoId: undefined,
      type: 'movie',
      progressSeconds: 500,
      durationSeconds: 1000,
    });

    await removeWatchHistoryMeta(testProfileId, 'tt-remove-meta-sync');

    const queue = await db
      .select()
      .from(syncQueue)
      .where(eq(syncQueue.metaId, 'tt-remove-meta-sync'));

    expect(queue).toHaveLength(1);
    expect(queue[0].action).toBe('remove_history');
    expect(queue[0].provider).toBe('simkl');
    expect(queue[0].type).toBe('movie');
  });
});

describe('setLastStreamTarget (integration)', () => {
  const testProfileId = 'stream-target-profile';

  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    await db.delete(watchHistory).where(eq(watchHistory.profileId, testProfileId));
  });

  it('creates a new entry if none exists', async () => {
    await setLastStreamTarget({
      profileId: testProfileId,
      metaId: 'tt-new-target',
      videoId: undefined,
      type: 'movie',
      target: { type: 'url', value: 'https://stream.example.com/movie' },
    });

    const [result] = await db
      .select()
      .from(watchHistory)
      .where(
        and(eq(watchHistory.profileId, testProfileId), eq(watchHistory.metaId, 'tt-new-target'))
      );

    expect(result).toBeDefined();
    expect(result.lastStreamTargetType).toBe('url');
    expect(result.lastStreamTargetValue).toBe('https://stream.example.com/movie');
  });

  it('updates existing entry stream target without changing progress', async () => {
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-existing-target',
      videoId: undefined,
      type: 'movie',
      progressSeconds: 500,
      durationSeconds: 1000,
    });

    await setLastStreamTarget({
      profileId: testProfileId,
      metaId: 'tt-existing-target',
      videoId: undefined,
      type: 'movie',
      target: { type: 'external', value: 'com.example.player' },
    });

    const [result] = await db
      .select()
      .from(watchHistory)
      .where(
        and(
          eq(watchHistory.profileId, testProfileId),
          eq(watchHistory.metaId, 'tt-existing-target')
        )
      );

    // Stream target updated
    expect(result.lastStreamTargetType).toBe('external');
    expect(result.lastStreamTargetValue).toBe('com.example.player');
    // Progress preserved
    expect(result.progressSeconds).toBe(500);
    expect(result.durationSeconds).toBe(1000);
  });

  it('stores all stream target types correctly', async () => {
    const targets: { type: 'url' | 'external' | 'yt'; value: string }[] = [
      { type: 'url', value: 'https://stream.example.com' },
      { type: 'external', value: 'com.example.player' },
      { type: 'yt', value: 'dQw4w9WgXcQ' },
    ];

    for (const [i, target] of targets.entries()) {
      await setLastStreamTarget({
        profileId: testProfileId,
        metaId: `tt-target-type-${i}`,
        videoId: undefined,
        type: 'movie',
        target,
      });

      const [result] = await db
        .select()
        .from(watchHistory)
        .where(
          and(
            eq(watchHistory.profileId, testProfileId),
            eq(watchHistory.metaId, `tt-target-type-${i}`)
          )
        );

      expect(result.lastStreamTargetType).toBe(target.type);
      expect(result.lastStreamTargetValue).toBe(target.value);
    }
  });

  it('creates separate entries for video-level and meta-level targets', async () => {
    await setLastStreamTarget({
      profileId: testProfileId,
      metaId: 'tt-multi-target',
      videoId: undefined,
      type: 'series',
      target: { type: 'url', value: 'https://meta-level.example.com' },
    });

    await setLastStreamTarget({
      profileId: testProfileId,
      metaId: 'tt-multi-target',
      videoId: 'ep-1',
      type: 'series',
      target: { type: 'external', value: 'com.example.player' },
    });

    const results = await db
      .select()
      .from(watchHistory)
      .where(
        and(eq(watchHistory.profileId, testProfileId), eq(watchHistory.metaId, 'tt-multi-target'))
      );

    expect(results).toHaveLength(2);
  });
});

describe('getLastStreamTarget (integration)', () => {
  const testProfileId = 'get-target-profile';

  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    await db.delete(watchHistory).where(eq(watchHistory.profileId, testProfileId));
  });

  it('returns video-level target when available', async () => {
    await setLastStreamTarget({
      profileId: testProfileId,
      metaId: 'tt-vid-target',
      videoId: 'ep-1',
      type: 'series',
      target: { type: 'url', value: 'https://video-level.example.com' },
    });

    const result = await getLastStreamTarget(testProfileId, 'tt-vid-target', 'ep-1');

    expect(result).toEqual({
      type: 'url',
      value: 'https://video-level.example.com',
    });
  });

  it('falls back to meta-level target when video-level has no target', async () => {
    // Meta-level entry with stream target
    await setLastStreamTarget({
      profileId: testProfileId,
      metaId: 'tt-fallback',
      videoId: undefined,
      type: 'series',
      target: { type: 'external', value: 'com.example.player' },
    });

    // Video-level entry without stream target (just progress)
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-fallback',
      videoId: 'ep-1',
      type: 'series',
      progressSeconds: 500,
      durationSeconds: 1000,
    });

    const result = await getLastStreamTarget(testProfileId, 'tt-fallback', 'ep-1');

    expect(result).toEqual({
      type: 'external',
      value: 'com.example.player',
    });
  });

  it('prefers video-level target over meta-level target', async () => {
    await setLastStreamTarget({
      profileId: testProfileId,
      metaId: 'tt-prefer-vid',
      videoId: undefined,
      type: 'series',
      target: { type: 'url', value: 'https://meta-level.example.com' },
    });

    await setLastStreamTarget({
      profileId: testProfileId,
      metaId: 'tt-prefer-vid',
      videoId: 'ep-1',
      type: 'series',
      target: { type: 'external', value: 'com.video.player' },
    });

    const result = await getLastStreamTarget(testProfileId, 'tt-prefer-vid', 'ep-1');

    expect(result).toEqual({
      type: 'external',
      value: 'com.video.player',
    });
  });

  it('returns undefined when no stream target exists', async () => {
    const result = await getLastStreamTarget(testProfileId, 'nonexistent');

    expect(result).toBeUndefined();
  });

  it('returns undefined when entries exist but have no stream target', async () => {
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-no-target',
      videoId: undefined,
      type: 'movie',
      progressSeconds: 500,
      durationSeconds: 1000,
    });

    const result = await getLastStreamTarget(testProfileId, 'tt-no-target');

    expect(result).toBeUndefined();
  });

  it('returns meta-level target for movie without videoId', async () => {
    await setLastStreamTarget({
      profileId: testProfileId,
      metaId: 'tt-movie-target',
      videoId: undefined,
      type: 'movie',
      target: { type: 'yt', value: 'dQw4w9WgXcQ' },
    });

    const result = await getLastStreamTarget(testProfileId, 'tt-movie-target');

    expect(result).toEqual({
      type: 'yt',
      value: 'dQw4w9WgXcQ',
    });
  });
});

describe('undismissFromContinueWatching status recalculation (integration)', () => {
  const testProfileId = 'undismiss-recalc-profile';

  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    await db.delete(watchHistory).where(eq(watchHistory.profileId, testProfileId));
  });

  it('restores status to "watching" for partially watched items', async () => {
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-undismiss-watching',
      videoId: undefined,
      type: 'movie',
      progressSeconds: 500, // 50%
      durationSeconds: 1000,
    });

    await dismissFromContinueWatching(testProfileId, 'tt-undismiss-watching');
    await undismissFromContinueWatching(testProfileId, 'tt-undismiss-watching');

    const [result] = await db
      .select()
      .from(watchHistory)
      .where(
        and(
          eq(watchHistory.profileId, testProfileId),
          eq(watchHistory.metaId, 'tt-undismiss-watching')
        )
      );

    expect(result.status).toBe('watching');
    expect(result.dismissedAt).toBeNull();
  });

  it('restores status to "completed" for items that were >= 90% progress', async () => {
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-undismiss-completed',
      videoId: undefined,
      type: 'movie',
      progressSeconds: 950, // 95% — completed
      durationSeconds: 1000,
    });

    // Verify it was completed before dismissal
    const [beforeDismiss] = await db
      .select()
      .from(watchHistory)
      .where(
        and(
          eq(watchHistory.profileId, testProfileId),
          eq(watchHistory.metaId, 'tt-undismiss-completed')
        )
      );
    expect(beforeDismiss.status).toBe('completed');

    await dismissFromContinueWatching(testProfileId, 'tt-undismiss-completed');
    await undismissFromContinueWatching(testProfileId, 'tt-undismiss-completed');

    const [result] = await db
      .select()
      .from(watchHistory)
      .where(
        and(
          eq(watchHistory.profileId, testProfileId),
          eq(watchHistory.metaId, 'tt-undismiss-completed')
        )
      );

    expect(result.status).toBe('completed');
    expect(result.dismissedAt).toBeNull();
  });

  it('handles zero duration gracefully (defaults to "watching")', async () => {
    const now = Date.now();
    await db.insert(watchHistory).values({
      profileId: testProfileId,
      metaId: 'tt-undismiss-zero-dur',
      videoId: '',
      type: 'movie',
      progressSeconds: 100,
      durationSeconds: 0,
      status: 'dismissed',
      dismissedAt: now,
      lastWatchedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await undismissFromContinueWatching(testProfileId, 'tt-undismiss-zero-dur');

    const [result] = await db
      .select()
      .from(watchHistory)
      .where(
        and(
          eq(watchHistory.profileId, testProfileId),
          eq(watchHistory.metaId, 'tt-undismiss-zero-dur')
        )
      );

    expect(result.status).toBe('watching');
  });

  it('recalculates status per-episode for dismissed series', async () => {
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-undismiss-series',
      videoId: 'ep-1',
      type: 'series',
      progressSeconds: 950, // 95% — completed
      durationSeconds: 1000,
    });
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-undismiss-series',
      videoId: 'ep-2',
      type: 'series',
      progressSeconds: 300, // 30% — watching
      durationSeconds: 1000,
    });

    await dismissFromContinueWatching(testProfileId, 'tt-undismiss-series');
    await undismissFromContinueWatching(testProfileId, 'tt-undismiss-series');

    const results = await db
      .select()
      .from(watchHistory)
      .where(
        and(
          eq(watchHistory.profileId, testProfileId),
          eq(watchHistory.metaId, 'tt-undismiss-series')
        )
      );

    const ep1 = results.find((r) => r.videoId === 'ep-1');
    const ep2 = results.find((r) => r.videoId === 'ep-2');

    expect(ep1?.status).toBe('completed');
    expect(ep2?.status).toBe('watching');
    expect(ep1?.dismissedAt).toBeNull();
    expect(ep2?.dismissedAt).toBeNull();
  });

  it('handles exactly at 90% boundary correctly', async () => {
    await upsertWatchProgress({
      profileId: testProfileId,
      metaId: 'tt-undismiss-boundary',
      videoId: undefined,
      type: 'movie',
      progressSeconds: 900, // exactly 90%
      durationSeconds: 1000,
    });

    await dismissFromContinueWatching(testProfileId, 'tt-undismiss-boundary');
    await undismissFromContinueWatching(testProfileId, 'tt-undismiss-boundary');

    const [result] = await db
      .select()
      .from(watchHistory)
      .where(
        and(
          eq(watchHistory.profileId, testProfileId),
          eq(watchHistory.metaId, 'tt-undismiss-boundary')
        )
      );

    expect(result.status).toBe('completed');
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

  describe('latestVideo (season/episode) from videos join', () => {
    it('returns season and episode when matching video metadata exists', async () => {
      await upsertMetaCache({
        id: 'tt-series-ep',
        type: 'series',
        name: 'Series',
        videos: [{ id: 's1e3', title: 'S1E3', season: 1, episode: 3, released: '2023-01-01' }],
      });

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

    it('keeps latestVideo undefined when matching video metadata is missing', async () => {
      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'tt-no-episode-fields',
        videoId: 'some-ep',
        type: 'series',
        progressSeconds: 400,
        durationSeconds: 1000,
      });

      const results = await listWatchedMetaSummaries(testProfileId);
      const entry = results.find((r) => r.id === 'tt-no-episode-fields');

      expect(entry?.latestVideo).toBeUndefined();
    });

    it('reflects episode changes when the latest watched video changes', async () => {
      await upsertMetaCache({
        id: 'tt-season-update',
        type: 'series',
        name: 'Series',
        videos: [
          { id: 'ep-2', title: 'Ep 2', season: 1, episode: 2, released: '2023-01-01' },
          { id: 'ep-3', title: 'Ep 3', season: 1, episode: 3, released: '2023-01-02' },
        ],
      });

      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'tt-season-update',
        videoId: 'ep-2',
        type: 'series',
        progressSeconds: 200,
        durationSeconds: 1000,
        lastWatchedAt: 1000,
      });

      await upsertWatchProgress({
        profileId: testProfileId,
        metaId: 'tt-season-update',
        videoId: 'ep-3',
        type: 'series',
        progressSeconds: 700,
        durationSeconds: 1000,
        lastWatchedAt: 2000,
      });

      const results = await listWatchedMetaSummaries(testProfileId);
      const entry = results.find((r) => r.id === 'tt-season-update');

      expect(entry?.latestItem?.videoId).toBe('ep-3');
      expect(entry?.latestVideo).toEqual({ season: 1, episode: 3 });
    });
  });
});

describe('PLAYBACK_FINISHED_RATIO', () => {
  it('is 0.9 (90%)', () => {
    expect(PLAYBACK_FINISHED_RATIO).toBe(0.9);
  });
});
