/**
 * Integration tests for syncLog database queries.
 *
 * These tests use expo-sqlite-mock to test against a real SQLite database.
 * Critical business logic tested:
 * - logSyncedItems: inserts entries, falls back to metaId as title
 * - logSyncedItemsForMetaIds: resolves titles from meta cache, dedupes by id
 * - listSyncLogForProfile: newest first, profile-scoped
 * - Pruning: keeps only the newest SYNC_LOG_LIMIT rows per profile
 */

import { eq } from 'drizzle-orm';

import { db, initializeDatabase } from '../client';
import { upsertMinimalMetaCache } from '../queries/metaCache';
import {
  listSyncLogForProfile,
  logSyncedItems,
  logSyncedItemsForMetaIds,
  SYNC_LOG_LIMIT,
} from '../queries/syncLog';
import { metaCache, syncLog } from '../schema';

describe('syncLog queries (integration)', () => {
  const testProfileId = 'synclog-test-profile';
  const otherProfileId = 'synclog-other-profile';

  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    await db.delete(syncLog);
    await db.delete(metaCache);
  });

  describe('logSyncedItems', () => {
    it('inserts entries with title fallback to metaId', async () => {
      await logSyncedItems(testProfileId, 'simkl', 'import', [
        { metaId: 'tt-inception', type: 'movie', title: 'Inception' },
        { metaId: 'tt-unknown', type: 'series' },
      ]);

      const rows = await db
        .select()
        .from(syncLog)
        .where(eq(syncLog.profileId, testProfileId))
        .orderBy(syncLog.id);

      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({
        profileId: testProfileId,
        provider: 'simkl',
        direction: 'import',
        metaId: 'tt-inception',
        type: 'movie',
        title: 'Inception',
      });
      expect(rows[1].title).toBe('tt-unknown');
      expect(rows[1].createdAt).toBeGreaterThan(0);
    });

    it('is a no-op for empty input', async () => {
      await logSyncedItems(testProfileId, 'simkl', 'import', []);

      const rows = await db.select().from(syncLog).where(eq(syncLog.profileId, testProfileId));
      expect(rows).toHaveLength(0);
    });
  });

  describe('logSyncedItemsForMetaIds', () => {
    it('resolves titles from meta cache and dedupes by id', async () => {
      await upsertMinimalMetaCache({
        metaId: 'tt-inception',
        type: 'movie',
        name: 'Inception',
      });

      await logSyncedItemsForMetaIds(testProfileId, 'trakt', 'export', [
        { id: 'tt-inception', type: 'movie' },
        { id: 'tt-inception', type: 'movie' },
        { id: 'tt-missing', type: 'series' },
      ]);

      const rows = await db.select().from(syncLog).where(eq(syncLog.profileId, testProfileId));

      expect(rows).toHaveLength(2);
      const byMetaId = new Map(rows.map((r) => [r.metaId, r]));
      expect(byMetaId.get('tt-inception')).toMatchObject({
        provider: 'trakt',
        direction: 'export',
        title: 'Inception',
      });
      expect(byMetaId.get('tt-missing')?.title).toBe('tt-missing');
    });
  });

  describe('listSyncLogForProfile', () => {
    it('returns entries newest first', async () => {
      await logSyncedItems(testProfileId, 'simkl', 'import', [
        { metaId: 'tt-1', type: 'movie', title: 'First' },
      ]);
      await logSyncedItems(testProfileId, 'trakt', 'export', [
        { metaId: 'tt-2', type: 'movie', title: 'Second' },
      ]);
      await logSyncedItems(testProfileId, 'simkl', 'import', [
        { metaId: 'tt-3', type: 'series', title: 'Third' },
      ]);

      const rows = await listSyncLogForProfile(testProfileId);

      expect(rows.map((r) => r.metaId)).toEqual(['tt-3', 'tt-2', 'tt-1']);
    });

    it('is scoped per profile', async () => {
      await logSyncedItems(testProfileId, 'simkl', 'import', [
        { metaId: 'tt-a', type: 'movie', title: 'A' },
      ]);
      await logSyncedItems(otherProfileId, 'trakt', 'export', [
        { metaId: 'tt-b', type: 'movie', title: 'B' },
      ]);

      const rows = await listSyncLogForProfile(testProfileId);
      expect(rows.map((r) => r.metaId)).toEqual(['tt-a']);
    });
  });

  describe('pruning', () => {
    it('keeps only the newest SYNC_LOG_LIMIT rows per profile', async () => {
      const total = SYNC_LOG_LIMIT + 10;
      await logSyncedItems(
        testProfileId,
        'simkl',
        'import',
        Array.from({ length: total }, (_, i) => ({
          metaId: `tt-item-${i}`,
          type: 'movie' as const,
          title: `Item ${i}`,
        }))
      );

      const rows = await db
        .select()
        .from(syncLog)
        .where(eq(syncLog.profileId, testProfileId))
        .orderBy(syncLog.id);

      expect(rows).toHaveLength(SYNC_LOG_LIMIT);
      expect(rows[0]!.metaId).toBe('tt-item-10');
      expect(rows[rows.length - 1]!.metaId).toBe('tt-item-109');
    });

    it('does not prune other profiles', async () => {
      await logSyncedItems(otherProfileId, 'trakt', 'import', [
        { metaId: 'tt-keep', type: 'movie', title: 'Keep' },
      ]);

      const total = SYNC_LOG_LIMIT + 5;
      await logSyncedItems(
        testProfileId,
        'simkl',
        'import',
        Array.from({ length: total }, (_, i) => ({
          metaId: `tt-item-${i}`,
          type: 'movie' as const,
        }))
      );

      const otherRows = await listSyncLogForProfile(otherProfileId);
      expect(otherRows.map((r) => r.metaId)).toEqual(['tt-keep']);
    });
  });
});
