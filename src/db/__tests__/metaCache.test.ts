/**
 * Integration tests for metaCache database queries
 *
 * These tests use expo-sqlite-mock to test against a real SQLite database.
 * Critical business logic tested:
 * - upsertMetaCache: caches meta details and videos with 7-day TTL
 * - isMetaCacheStale: checks if cache is expired or missing
 * - getStaleMetaIds: batch check for multiple metas
 */

import { initializeDatabase, db } from '../client';
import { upsertMetaCache, isMetaCacheStale, getStaleMetaIds } from '../queries/metaCache';
import { metaCache, videos } from '../schema';
import { eq } from 'drizzle-orm';
import type { MetaDetail } from '@/types/stremio';

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

describe('metaCache queries (integration)', () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    // Clean up test data
    await db.delete(metaCache);
    await db.delete(videos);
  });

  describe('upsertMetaCache', () => {
    const baseMeta: MetaDetail = {
      id: 'tt1234567',
      type: 'movie',
      name: 'Test Movie',
      description: 'A test movie description',
      poster: 'https://example.com/poster.jpg',
      background: 'https://example.com/background.jpg',
      logo: 'https://example.com/logo.png',
      imdbRating: '8.5',
      releaseInfo: '2023–2024',
    };

    it('caches meta with correct TTL (7 days)', async () => {
      const beforeCall = Date.now();

      await upsertMetaCache(baseMeta);

      const afterCall = Date.now();

      const [cached] = await db.select().from(metaCache).where(eq(metaCache.metaId, 'tt1234567'));

      // Verify fetchedAt is current time
      expect(cached.fetchedAt).toBeGreaterThanOrEqual(beforeCall);
      expect(cached.fetchedAt).toBeLessThanOrEqual(afterCall);

      // Verify expiresAt is 7 days from now
      const expectedExpiresMin = beforeCall + CACHE_TTL_MS;
      const expectedExpiresMax = afterCall + CACHE_TTL_MS;
      expect(cached.expiresAt).toBeGreaterThanOrEqual(expectedExpiresMin);
      expect(cached.expiresAt).toBeLessThanOrEqual(expectedExpiresMax);
    });

    it('extracts release year from releaseInfo', async () => {
      await upsertMetaCache({
        ...baseMeta,
        id: 'tt-release-year',
        releaseInfo: '2023–2024',
      });

      const [cached] = await db
        .select()
        .from(metaCache)
        .where(eq(metaCache.metaId, 'tt-release-year'));

      expect(cached.releaseYear).toBe('2023');
    });

    it('handles releaseInfo without dash', async () => {
      await upsertMetaCache({
        ...baseMeta,
        id: 'tt-single-year',
        releaseInfo: '2020',
      });

      const [cached] = await db
        .select()
        .from(metaCache)
        .where(eq(metaCache.metaId, 'tt-single-year'));

      expect(cached.releaseYear).toBe('2020');
    });

    it('stores all meta fields', async () => {
      await upsertMetaCache(baseMeta);

      const [cached] = await db.select().from(metaCache).where(eq(metaCache.metaId, 'tt1234567'));

      expect(cached.metaId).toBe('tt1234567');
      expect(cached.type).toBe('movie');
      expect(cached.name).toBe('Test Movie');
      expect(cached.description).toBe('A test movie description');
      expect(cached.poster).toBe('https://example.com/poster.jpg');
      expect(cached.background).toBe('https://example.com/background.jpg');
      expect(cached.logo).toBe('https://example.com/logo.png');
      expect(cached.imdbRating).toBe('8.5');
    });

    it('does not insert videos when meta has no videos', async () => {
      await upsertMetaCache(baseMeta);

      const videoResults = await db.select().from(videos).where(eq(videos.metaId, 'tt1234567'));

      expect(videoResults).toHaveLength(0);
    });

    it('does not insert videos when videos array is empty', async () => {
      await upsertMetaCache({
        ...baseMeta,
        id: 'tt-empty-videos',
        videos: [],
      });

      const videoResults = await db
        .select()
        .from(videos)
        .where(eq(videos.metaId, 'tt-empty-videos'));

      expect(videoResults).toHaveLength(0);
    });

    it('inserts all videos with season/episode info', async () => {
      const metaWithVideos: MetaDetail = {
        ...baseMeta,
        id: 'tt-with-videos',
        type: 'series',
        videos: [
          {
            id: 'ep-1',
            title: 'Episode 1',
            season: 1,
            episode: 1,
            thumbnail: 'https://example.com/ep1.jpg',
            overview: 'First episode',
            released: '2023-01-01',
          },
          {
            id: 'ep-2',
            title: 'Episode 2',
            season: 1,
            episode: 2,
            thumbnail: 'https://example.com/ep2.jpg',
            overview: 'Second episode',
            released: '2023-01-08',
          },
          {
            id: 'ep-3',
            title: 'Season 2 Premiere',
            season: 2,
            episode: 1,
            thumbnail: 'https://example.com/ep3.jpg',
            overview: 'Season 2 premiere',
            released: '2024-01-01',
          },
        ],
      };

      await upsertMetaCache(metaWithVideos);

      const videoResults = await db
        .select()
        .from(videos)
        .where(eq(videos.metaId, 'tt-with-videos'));

      expect(videoResults).toHaveLength(3);

      // Check first video
      const ep1 = videoResults.find((v: { videoId: string }) => v.videoId === 'ep-1');
      expect(ep1).toBeDefined();
      expect(ep1?.title).toBe('Episode 1');
      expect(ep1?.season).toBe(1);
      expect(ep1?.episode).toBe(1);

      // Check season 2 video
      const ep3 = videoResults.find((v: { videoId: string }) => v.videoId === 'ep-3');
      expect(ep3).toBeDefined();
      expect(ep3?.season).toBe(2);
      expect(ep3?.episode).toBe(1);
    });

    it('handles videos without season/episode (specials)', async () => {
      const metaWithSpecials: MetaDetail = {
        ...baseMeta,
        id: 'tt-specials',
        type: 'series',
        videos: [
          {
            id: 'special-1',
            title: 'Behind the Scenes',
            released: '2023-06-01',
            // No season/episode
          },
        ],
      };

      await upsertMetaCache(metaWithSpecials);

      const videoResults = await db.select().from(videos).where(eq(videos.metaId, 'tt-specials'));

      expect(videoResults).toHaveLength(1);
      expect(videoResults[0].videoId).toBe('special-1');
      expect(videoResults[0].season).toBeNull();
      expect(videoResults[0].episode).toBeNull();
    });

    it('uses upsert behavior for duplicate metaIds', async () => {
      // Insert initial cache
      await upsertMetaCache({
        ...baseMeta,
        id: 'tt-upsert-test',
        name: 'Original Name',
      });

      // Update with new data
      await upsertMetaCache({
        ...baseMeta,
        id: 'tt-upsert-test',
        name: 'Updated Name',
      });

      const results = await db
        .select()
        .from(metaCache)
        .where(eq(metaCache.metaId, 'tt-upsert-test'));

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Updated Name');
    });
  });

  describe('isMetaCacheStale', () => {
    it('returns true when cache does not exist', async () => {
      const result = await isMetaCacheStale('nonexistent-meta');

      expect(result).toBe(true);
    });

    it('returns true when cache is expired', async () => {
      // Manually insert expired cache entry
      await db.insert(metaCache).values({
        metaId: 'expired-meta',
        type: 'movie',
        name: 'Expired Movie',
        fetchedAt: Date.now() - CACHE_TTL_MS - 1000,
        expiresAt: Date.now() - 1000, // Expired 1 second ago
      });

      const result = await isMetaCacheStale('expired-meta');

      expect(result).toBe(true);
    });

    it('returns false when cache is still valid', async () => {
      // Insert valid cache entry
      await db.insert(metaCache).values({
        metaId: 'valid-meta',
        type: 'movie',
        name: 'Valid Movie',
        fetchedAt: Date.now(),
        expiresAt: Date.now() + CACHE_TTL_MS,
      });

      const result = await isMetaCacheStale('valid-meta');

      expect(result).toBe(false);
    });

    it('returns true when cache expires exactly now (edge case)', async () => {
      const now = Date.now();
      await db.insert(metaCache).values({
        metaId: 'edge-case-meta',
        type: 'movie',
        name: 'Edge Case Movie',
        fetchedAt: now - CACHE_TTL_MS,
        expiresAt: now - 1, // Just expired
      });

      const result = await isMetaCacheStale('edge-case-meta');

      expect(result).toBe(true);
    });
  });

  describe('getStaleMetaIds', () => {
    it('returns empty array when given empty input', async () => {
      const result = await getStaleMetaIds([]);

      expect(result).toEqual([]);
    });

    it('returns IDs that are missing from cache', async () => {
      const result = await getStaleMetaIds(['missing-1', 'missing-2']);

      expect(result).toContain('missing-1');
      expect(result).toContain('missing-2');
      expect(result).toHaveLength(2);
    });

    it('returns IDs that are expired', async () => {
      // Insert expired cache
      await db.insert(metaCache).values({
        metaId: 'expired-1',
        type: 'movie',
        name: 'Expired',
        fetchedAt: Date.now() - CACHE_TTL_MS - 1000,
        expiresAt: Date.now() - 1000,
      });

      const result = await getStaleMetaIds(['expired-1']);

      expect(result).toContain('expired-1');
    });

    it('does not return IDs that are still valid', async () => {
      // Insert valid cache
      await db.insert(metaCache).values({
        metaId: 'valid-1',
        type: 'movie',
        name: 'Valid',
        fetchedAt: Date.now(),
        expiresAt: Date.now() + CACHE_TTL_MS,
      });

      const result = await getStaleMetaIds(['valid-1']);

      expect(result).not.toContain('valid-1');
      expect(result).toHaveLength(0);
    });

    it('handles mix of stale, valid, and missing IDs', async () => {
      // Insert expired cache
      await db.insert(metaCache).values({
        metaId: 'expired-mix',
        type: 'movie',
        name: 'Expired',
        fetchedAt: Date.now() - CACHE_TTL_MS - 1000,
        expiresAt: Date.now() - 1000,
      });

      // Insert valid cache
      await db.insert(metaCache).values({
        metaId: 'valid-mix',
        type: 'movie',
        name: 'Valid',
        fetchedAt: Date.now(),
        expiresAt: Date.now() + CACHE_TTL_MS,
      });

      const result = await getStaleMetaIds(['expired-mix', 'valid-mix', 'missing-mix']);

      expect(result).toContain('expired-mix');
      expect(result).toContain('missing-mix');
      expect(result).not.toContain('valid-mix');
      expect(result).toHaveLength(2);
    });
  });
});

describe('Cache TTL', () => {
  it('is exactly 7 days in milliseconds', () => {
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(CACHE_TTL_MS).toBe(sevenDaysMs);
    expect(CACHE_TTL_MS).toBe(604800000);
  });
});
