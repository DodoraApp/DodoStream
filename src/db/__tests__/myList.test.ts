/**
 * Integration tests for myList database queries
 *
 * These tests use expo-sqlite-mock to test against a real SQLite database.
 * Critical business logic tested:
 * - addToMyList: upserts with soft delete restoration
 * - removeFromMyList: delete
 * - listMyListForProfile: only returns non-removed items
 * - removeProfileMyList: hard delete for profile cleanup
 */

import { initializeDatabase, db } from '../client';
import {
  addToMyList,
  removeFromMyList,
  listMyListForProfile,
  removeProfileMyList,
  type DbMyListItem,
} from '../queries/myList';
import { upsertMetaCache } from '../queries/metaCache';
import { myList, metaCache } from '../schema';
import { and, eq } from 'drizzle-orm';
import type { MetaDetail } from '@/types/stremio';

describe('myList queries (integration)', () => {
  const testProfileId = 'mylist-test-profile';

  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    // Clean up test data
    await db.delete(myList).where(eq(myList.profileId, testProfileId));
    await db.delete(myList).where(eq(myList.profileId, 'mylist-profile-2'));
    await db.delete(metaCache);
  });

  describe('addToMyList', () => {
    it('adds a new item to my list', async () => {
      await addToMyList(testProfileId, 'tt-add-1', 'movie');

      const results = await db
        .select()
        .from(myList)
        .where(and(eq(myList.profileId, testProfileId), eq(myList.metaId, 'tt-add-1')));

      expect(results).toHaveLength(1);
    });

    it('sets addedAt timestamp', async () => {
      const beforeAdd = Date.now();

      await addToMyList(testProfileId, 'tt-timestamp', 'movie');

      const afterAdd = Date.now();

      const [result] = await db
        .select()
        .from(myList)
        .where(and(eq(myList.profileId, testProfileId), eq(myList.metaId, 'tt-timestamp')));

      expect(result.addedAt).toBeGreaterThanOrEqual(beforeAdd);
      expect(result.addedAt).toBeLessThanOrEqual(afterAdd);
    });

    it('re-adds previously removed item', async () => {
      // Add item
      await addToMyList(testProfileId, 'tt-readd', 'movie');

      // Remove it
      await removeFromMyList(testProfileId, 'tt-readd');

      // Verify it's deleted
      const removed = await db
        .select()
        .from(myList)
        .where(and(eq(myList.profileId, testProfileId), eq(myList.metaId, 'tt-readd')));
      expect(removed).toHaveLength(0);

      // Re-add it
      await addToMyList(testProfileId, 'tt-readd', 'movie');

      // Verify it exists again
      const readded = await db
        .select()
        .from(myList)
        .where(and(eq(myList.profileId, testProfileId), eq(myList.metaId, 'tt-readd')));
      expect(readded).toHaveLength(1);
    });

    it('does not create duplicates on re-add', async () => {
      await addToMyList(testProfileId, 'tt-nodupe', 'movie');

      await removeFromMyList(testProfileId, 'tt-nodupe');

      await addToMyList(testProfileId, 'tt-nodupe', 'movie');

      const results = await db
        .select()
        .from(myList)
        .where(and(eq(myList.profileId, testProfileId), eq(myList.metaId, 'tt-nodupe')));

      expect(results).toHaveLength(1);
    });

    it('updates addedAt on re-add', async () => {
      await addToMyList(testProfileId, 'tt-update-time', 'movie');

      const [firstAdd] = await db
        .select()
        .from(myList)
        .where(and(eq(myList.profileId, testProfileId), eq(myList.metaId, 'tt-update-time')));
      const firstAddedAt = firstAdd.addedAt;

      await new Promise((r) => setTimeout(r, 10)); // Ensure different timestamp

      await addToMyList(testProfileId, 'tt-update-time', 'movie');

      const [secondAdd] = await db
        .select()
        .from(myList)
        .where(and(eq(myList.profileId, testProfileId), eq(myList.metaId, 'tt-update-time')));

      expect(secondAdd.addedAt).toBeGreaterThan(firstAddedAt);
    });
  });

  describe('removeFromMyList', () => {
    it('hard deletes the row', async () => {
      await addToMyList(testProfileId, 'tt-softdelete', 'movie');

      await removeFromMyList(testProfileId, 'tt-softdelete');

      const results = await db
        .select()
        .from(myList)
        .where(and(eq(myList.profileId, testProfileId), eq(myList.metaId, 'tt-softdelete')));

      expect(results).toHaveLength(0);
    });

    it('does not affect other items', async () => {
      await addToMyList(testProfileId, 'tt-notdeleted', 'movie');
      await addToMyList(testProfileId, 'tt-other', 'movie');

      await removeFromMyList(testProfileId, 'tt-notdeleted');

      const results = await db
        .select()
        .from(myList)
        .where(and(eq(myList.profileId, testProfileId), eq(myList.metaId, 'tt-other')));

      expect(results).toHaveLength(1);
    });
  });

  describe('listMyListForProfile', () => {
    it('returns only non-removed items', async () => {
      await addToMyList(testProfileId, 'tt-visible-1', 'movie');

      await addToMyList(testProfileId, 'tt-removed-1', 'movie');
      await removeFromMyList(testProfileId, 'tt-removed-1');

      const results = await listMyListForProfile(testProfileId);

      // DbMyListItem has 'id' not 'metaId'
      expect(results.some((r: DbMyListItem) => r.id === 'tt-visible-1')).toBe(true);
      expect(results.some((r: DbMyListItem) => r.id === 'tt-removed-1')).toBe(false);
    });

    it('returns items ordered by addedAt descending (most recent first)', async () => {
      await addToMyList(testProfileId, 'tt-first', 'movie');

      await new Promise((r) => setTimeout(r, 10)); // Ensure different timestamps

      await addToMyList(testProfileId, 'tt-second', 'movie');

      const results = await listMyListForProfile(testProfileId);

      expect(results[0].id).toBe('tt-second'); // Most recent first
      expect(results[1].id).toBe('tt-first');
    });

    it('only returns items for the specified profile', async () => {
      await addToMyList(testProfileId, 'tt-profile1-item', 'movie');

      await addToMyList('mylist-profile-2', 'tt-profile2-item', 'movie');

      const results = await listMyListForProfile(testProfileId);

      expect(results.some((r: DbMyListItem) => r.id === 'tt-profile1-item')).toBe(true);
      expect(results.some((r: DbMyListItem) => r.id === 'tt-profile2-item')).toBe(false);
    });

    it('returns empty array when profile has no items', async () => {
      const results = await listMyListForProfile('nonexistent-profile');

      expect(results).toEqual([]);
    });

    it('includes type in returned items', async () => {
      await addToMyList(testProfileId, 'tt-movie', 'movie');
      await addToMyList(testProfileId, 'tt-series', 'series');

      const results = await listMyListForProfile(testProfileId);

      const movie = results.find((r: DbMyListItem) => r.id === 'tt-movie');
      const series = results.find((r: DbMyListItem) => r.id === 'tt-series');

      expect(movie?.type).toBe('movie');
      expect(series?.type).toBe('series');
    });

    it('returns metaName and imageUrl from meta_cache when available', async () => {
      const meta: MetaDetail = {
        id: 'tt-with-cache',
        type: 'movie',
        name: 'Cached Movie Title',
        poster: 'https://example.com/poster.jpg',
        background: 'https://example.com/background.jpg',
      };
      await upsertMetaCache(meta);
      await addToMyList(testProfileId, 'tt-with-cache', 'movie');

      const results = await listMyListForProfile(testProfileId);
      const item = results.find((r: DbMyListItem) => r.id === 'tt-with-cache');

      expect(item?.metaName).toBe('Cached Movie Title');
      expect(item?.imageUrl).toBe('https://example.com/poster.jpg');
    });

    it('prefers poster over background for imageUrl', async () => {
      const meta: MetaDetail = {
        id: 'tt-bg-pref',
        type: 'movie',
        name: 'Test',
        poster: 'https://example.com/poster.jpg',
        background: 'https://example.com/background.jpg',
      };
      await upsertMetaCache(meta);
      await addToMyList(testProfileId, 'tt-bg-pref', 'movie');

      const results = await listMyListForProfile(testProfileId);
      const item = results.find((r: DbMyListItem) => r.id === 'tt-bg-pref');

      expect(item?.imageUrl).toBe('https://example.com/poster.jpg');
    });

    it('falls back to poster when no background in cache', async () => {
      const meta: MetaDetail = {
        id: 'tt-poster-only',
        type: 'movie',
        name: 'Test',
        poster: 'https://example.com/poster.jpg',
      };
      await upsertMetaCache(meta);
      await addToMyList(testProfileId, 'tt-poster-only', 'movie');

      const results = await listMyListForProfile(testProfileId);
      const item = results.find((r: DbMyListItem) => r.id === 'tt-poster-only');

      expect(item?.imageUrl).toBe('https://example.com/poster.jpg');
    });

    it('returns undefined metaName and imageUrl when meta_cache is empty', async () => {
      await addToMyList(testProfileId, 'tt-no-cache', 'movie');

      const results = await listMyListForProfile(testProfileId);
      const item = results.find((r: DbMyListItem) => r.id === 'tt-no-cache');

      expect(item?.metaName).toBeUndefined();
      expect(item?.imageUrl).toBeUndefined();
    });
  });

  describe('removeProfileMyList', () => {
    it('hard deletes all items for a profile', async () => {
      await addToMyList(testProfileId, 'tt-harddelete-1', 'movie');

      await addToMyList(testProfileId, 'tt-harddelete-2', 'series');

      await removeProfileMyList(testProfileId);

      const results = await db.select().from(myList).where(eq(myList.profileId, testProfileId));

      expect(results).toHaveLength(0);
    });

    it('does not affect other profiles', async () => {
      await addToMyList(testProfileId, 'tt-profile1-keep', 'movie');

      await addToMyList('mylist-profile-2', 'tt-profile2-keep', 'movie');

      await removeProfileMyList(testProfileId);

      const results = await db
        .select()
        .from(myList)
        .where(eq(myList.profileId, 'mylist-profile-2'));

      expect(results).toHaveLength(1);
      expect(results[0].metaId).toBe('tt-profile2-keep');
    });
  });
});
