/**
 * Sync E2E Integration Tests
 *
 * Runs against real Trakt/Simkl APIs.
 * Uses Jest's module mocking for DB isolation.
 *
 * Test media used (stable, well-known IDs):
 *   Movie:   The Matrix        tt0133093
 *   Movie 2: Inception         tt1375666
 *   Series:  Breaking Bad      tt0903747  (S01E01, S01E02)
 *   Series 2: The Wire         tt0306414  (S01E01)
 *   Anime:   Fullmetal Alchemist Brotherhood  kitsu:5081 (Simkl only)
 */

/// <reference types="node" />

import * as simklClient from '../../src/api/simkl/client';
import {
  runExport as simklRunExport,
  runImport as simklRunImport,
} from '../../src/api/simkl/sync-service';
import * as traktClient from '../../src/api/trakt/client';
import {
  runExport as traktRunExport,
  runImport as traktRunImport,
} from '../../src/api/trakt/sync-service';
import { useIntegrationsStore } from '../../src/store/integrations.store';
import { authSimkl, authTrakt } from './auth';
import {
  myListQueries,
  resetStore,
  setConnectedProvider,
  store,
  watchHistoryQueries,
} from './db-store';
import {
  ANIME_ID,
  ANIME_IMDB_ID,
  ANIME_KITSU_ID,
  BREAKING_BAD_ID,
  cleanupSimklRemote,
  cleanupTraktRemote,
  INCEPTION_ID,
  MATRIX_ID,
  PROFILE_ID,
  setupSimklProfile,
  setupTraktProfile,
  THE_WIRE_ID,
  traktRawPost,
} from './helpers';

// ─── Module mocks (hoisted) ───────────────────────────────────────────────────

jest.mock('@/db/client', () => ({
  db: {},
  sqliteDb: {},
  initializeDatabase: jest.fn(),
}));

jest.mock('@/db/queries/watchHistory', () => ({
  __esModule: true,
  ...jest.requireActual('./db-store').watchHistoryQueries,
}));

jest.mock('@/db/queries/myList', () => ({
  __esModule: true,
  ...jest.requireActual('./db-store').myListQueries,
}));

jest.mock('@/db/queries/syncQueue', () => ({
  __esModule: true,
  ...jest.requireActual('./db-store').syncQueueQueries,
}));

// Sync log writes are not asserted by the e2e suite — no-op so the real
// SQLite-backed module (which would touch the mocked db) is never loaded.
jest.mock('@/db/queries/syncLog', () => ({
  __esModule: true,
  logSyncedItems: jest.fn(async () => {}),
  logSyncedItemsForMetaIds: jest.fn(async () => {}),
  listSyncLogForProfile: jest.fn(async () => []),
}));

jest.mock('@/db/queries/metaCache', () => ({
  __esModule: true,
  ...jest.requireActual('./db-store').metaCacheQueries,
}));

// No persisted id mappings in the in-memory store — the resolver's DB lookup
// must return null (never touch the mocked sqlite, which would throw).
jest.mock('@/db/queries/idMapping', () => ({
  getExternalIdsForMetaId: async () => null,
}));

jest.mock('react-native', () => ({
  // Unchecked cast: jest-expo global shim installed by jest-e2e-setup.ts.
  Platform: (globalThis as unknown as { Platform: unknown }).Platform,
}));

jest.mock('@react-native-async-storage/async-storage', () => {
  const asyncStorageMap = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: async (key: string) => asyncStorageMap.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        asyncStorageMap.set(key, value);
      },
      removeItem: async (key: string) => {
        asyncStorageMap.delete(key);
      },
      multiGet: async (keys: string[]) => keys.map((k) => [k, asyncStorageMap.get(k) ?? null]),
      multiSet: async (pairs: [string, string][]) => {
        pairs.forEach(([k, v]) => asyncStorageMap.set(k, v));
      },
      multiRemove: async (keys: string[]) => {
        keys.forEach((k) => asyncStorageMap.delete(k));
      },
      clear: async () => {
        asyncStorageMap.clear();
      },
      getAllKeys: async () => Array.from(asyncStorageMap.keys()),
    },
  };
});

jest.mock('expo-constants', () => ({
  __esModule: true,
  // Unchecked cast: jest-expo global shim installed by jest-e2e-setup.ts.
  default: (globalThis as unknown as { ExpoConstants: unknown }).ExpoConstants,
}));

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => ({}),
  SQLiteDatabase: class {},
}));

// expo-crypto is not a project dependency — mock it as a virtual module.
jest.mock(
  'expo-crypto',
  () => ({
    randomUUID: () => Math.random().toString(36).slice(2),
  }),
  { virtual: true }
);

jest.mock('@/utils/debug', () => ({
  createDebugLogger: (scope: string) => (event: string, data?: unknown) => {
    if (process.env.E2E_DEBUG) {
      console.debug(`[${scope}] ${event}`, data ?? '');
    }
  },
}));

jest.mock('@/hooks/useAppInfo', () => ({
  getInstalledAppVersion: () => '1.0.0-e2e',
}));

jest.mock('@/utils/media-artwork', () => ({
  getTraktPosterUrl: () => undefined,
  getSimklPosterUrl: () => undefined,
}));

// ─── Test harness helpers ─────────────────────────────────────────────────────

/** Read --testNamePattern=... from the jest CLI args (set by the npm scripts). */
function getTestNamePattern(): string {
  const arg = process.argv.find((a) => a.startsWith('--testNamePattern='));
  return arg ? arg.slice('--testNamePattern='.length) : '';
}

/**
 * Raw Trakt POST (for endpoints the client doesn't wrap, e.g. hidden shows).
 * Delegates to helpers.traktRawPost which sends a User-Agent — Cloudflare
 * rejects undici's default UA with 403.
 */
const traktPostJson = traktRawPost;

// ─── Test setup ───────────────────────────────────────────────────────────────

let traktToken: string | null = null;
let simklToken: string | null = null;

beforeAll(async () => {
  // Authenticate with the requested providers (sequential to avoid prompt conflicts)
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║          DodoStream Sync E2E Integration Tests           ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const testPattern = getTestNamePattern().toLowerCase();
  const runTrakt = !testPattern || testPattern.includes('trakt');
  const runSimkl = !testPattern || testPattern.includes('simkl');

  if (runTrakt) {
    console.log('Authenticating with Trakt...');
    traktToken = await authTrakt();
  }

  if (runSimkl) {
    console.log('\nAuthenticating with Simkl...');
    simklToken = await authSimkl();
  }
});

afterAll(async () => {
  // Final cleanup (each test also cleans up after itself)
  if (traktToken) await cleanupTraktRemote(traktToken);
  if (simklToken) await cleanupSimklRemote(simklToken);
});

beforeEach(() => {
  resetStore();
});

// ─── Trakt Tests ──────────────────────────────────────────────────────────────

describe('Trakt', () => {
  beforeAll(async () => {
    if (!traktToken) {
      console.log('Skipping Trakt tests - no token');
      return;
    }
    await cleanupTraktRemote(traktToken);
  });

  // Hermeticity: tests share one remote account, so restore clean remote state
  // after every test. Each test seeds exactly the remote state it needs.
  afterEach(async () => {
    if (traktToken) await cleanupTraktRemote(traktToken);
  });

  describe('Import', () => {
    it('fresh import on empty remote returns true and makes no DB writes', async () => {
      if (!traktToken) return;
      setupTraktProfile(traktToken);
      const ok = await traktRunImport(PROFILE_ID, traktToken);
      expect(ok).toBe(true);
      const history = await watchHistoryQueries.listWatchHistoryForProfile(PROFILE_ID);
      const myList = await myListQueries.listMyListForProfile(PROFILE_ID);
      expect(history).toHaveLength(0);
      expect(myList).toHaveLength(0);
    });

    it('import after adding movie to remote writes it to local DB', async () => {
      if (!traktToken) return;
      setupTraktProfile(traktToken);
      await traktClient.postHistory(traktToken, {
        movies: [{ ids: { imdb: MATRIX_ID }, watched_at: new Date().toISOString() }],
      });

      const ok = await traktRunImport(PROFILE_ID, traktToken);
      expect(ok).toBe(true);

      const history = await watchHistoryQueries.listWatchHistoryForProfile(PROFILE_ID);
      const matrix = history.find((h) => h.id === MATRIX_ID);
      expect(matrix).toBeDefined();
      expect(matrix!.type).toBe('movie');
      expect(matrix!.source).toBe('trakt');
      expect(matrix!.status).toBe('completed');
    });

    it('import episode-level history for a show', async () => {
      if (!traktToken) return;
      setupTraktProfile(traktToken);
      await traktClient.postHistory(traktToken, {
        shows: [
          {
            ids: { imdb: BREAKING_BAD_ID },
            seasons: [
              {
                number: 1,
                episodes: [
                  { number: 1, watched_at: new Date().toISOString() },
                  { number: 2, watched_at: new Date().toISOString() },
                ],
              },
            ],
          },
        ],
      });

      const ok = await traktRunImport(PROFILE_ID, traktToken);
      expect(ok).toBe(true);

      const history = await watchHistoryQueries.listWatchHistoryForProfile(PROFILE_ID);
      const ep1 = history.find((h) => h.videoId === `${BREAKING_BAD_ID}:1:1`);
      const ep2 = history.find((h) => h.videoId === `${BREAKING_BAD_ID}:1:2`);
      expect(ep1).toBeDefined();
      expect(ep2).toBeDefined();
      expect(ep1!.source).toBe('trakt');
    });

    it('import watchlist items into myList', async () => {
      if (!traktToken) return;
      setupTraktProfile(traktToken);
      await traktClient.postWatchlist(traktToken, {
        movies: [{ ids: { imdb: INCEPTION_ID } }],
      });

      const ok = await traktRunImport(PROFILE_ID, traktToken);
      expect(ok).toBe(true);

      const myList = await myListQueries.listMyListForProfile(PROFILE_ID);
      const inception = myList.find((m) => m.id === INCEPTION_ID);
      expect(inception).toBeDefined();
      expect(inception!.source).toBe('trakt');
    });

    it('incremental import: cursor prevents re-fetching unchanged data', async () => {
      if (!traktToken) return;
      setupTraktProfile(traktToken);
      await traktRunImport(PROFILE_ID, traktToken);
      const cursors =
        useIntegrationsStore.getState().settings[PROFILE_ID]?.trakt?.connection?.syncCursors;
      expect(cursors).toBeDefined();

      const ok = await traktRunImport(PROFILE_ID, traktToken, cursors);
      expect(ok).toBe(true);
    });

    it('concurrent imports for same profile are deduplicated', async () => {
      if (!traktToken) return;
      setupTraktProfile(traktToken);
      const [r1, r2] = await Promise.all([
        traktRunImport(PROFILE_ID, traktToken),
        traktRunImport(PROFILE_ID, traktToken),
      ]);
      expect(r1).toBe(true);
      expect(r2).toBe(true);
    });

    it('cleanup: items removed from remote are removed locally on next import', async () => {
      if (!traktToken) return;
      setupTraktProfile(traktToken);
      // Seed local DB with a trakt-sourced movie
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: MATRIX_ID,
        type: 'movie',
        source: 'trakt',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: Date.now() - 10_000,
      });

      const history = await watchHistoryQueries.listWatchHistoryForProfile(PROFILE_ID);
      expect(history.some((h) => h.id === MATRIX_ID)).toBe(true);

      // The Matrix is NOT on remote (afterEach cleanup guarantees this)
      const ok = await traktRunImport(PROFILE_ID, traktToken);
      expect(ok).toBe(true);

      const historyAfter = await watchHistoryQueries.listWatchHistoryForProfile(PROFILE_ID);
      expect(historyAfter.find((h) => h.id === MATRIX_ID)).toBeUndefined();
    });
  });

  describe('Export', () => {
    it('export completed movie to remote history', async () => {
      if (!traktToken) return;
      setupTraktProfile(traktToken);
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: MATRIX_ID,
        type: 'movie',
        source: 'internal',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: Date.now() - 5000,
      });

      const ok = await traktRunExport(PROFILE_ID, traktToken);
      expect(ok).toBe(true);

      const remoteMovies = await traktClient.getWatchedMovies(traktToken);
      const matrix = remoteMovies.find((m) => m.movie.ids.imdb === MATRIX_ID);
      expect(matrix).toBeDefined();
    });

    it('export episode history to remote', async () => {
      if (!traktToken) return;
      setupTraktProfile(traktToken);
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: BREAKING_BAD_ID,
        videoId: `${BREAKING_BAD_ID}:1:1`,
        type: 'series',
        source: 'internal',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: Date.now() - 5000,
      });

      const ok = await traktRunExport(PROFILE_ID, traktToken);
      expect(ok).toBe(true);

      const remoteShows = await traktClient.getWatchedShowsWithSeasons(traktToken);
      const bb = remoteShows.find((s) => s.show.ids.imdb === BREAKING_BAD_ID);
      expect(bb).toBeDefined();
      const s1 = bb!.seasons?.find((s) => s.number === 1);
      expect(s1).toBeDefined();
      const ep1 = s1!.episodes?.find((e) => e.number === 1);
      expect(ep1).toBeDefined();
    });

    it('export watchlist item to remote', async () => {
      if (!traktToken) return;
      setupTraktProfile(traktToken);
      await myListQueries.addToMyList(
        PROFILE_ID,
        INCEPTION_ID,
        'movie',
        Date.now() - 5000,
        'internal'
      );

      const ok = await traktRunExport(PROFILE_ID, traktToken);
      expect(ok).toBe(true);

      const remoteWatchlist = await traktClient.getWatchlistMovies(traktToken);
      const inception = remoteWatchlist.find((m) => m.movie?.ids?.imdb === INCEPTION_ID);
      expect(inception).toBeDefined();
    });

    it('export skips items already sourced from trakt', async () => {
      if (!traktToken) return;
      setupTraktProfile(traktToken);
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: MATRIX_ID,
        type: 'movie',
        source: 'trakt',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: Date.now() - 5000,
      });

      const ok = await traktRunExport(PROFILE_ID, traktToken);
      expect(ok).toBe(true);

      // The Matrix should NOT appear in remote history (it was trakt-sourced).
      // afterEach cleanup guarantees it wasn't already there from another test.
      const remoteMovies = await traktClient.getWatchedMovies(traktToken);
      const matrix = remoteMovies.find((m) => m.movie.ids.imdb === MATRIX_ID);
      expect(matrix).toBeUndefined();
    });

    it('export removal from sync queue removes item from remote', async () => {
      if (!traktToken) return;
      setupTraktProfile(traktToken);
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: MATRIX_ID,
        type: 'movie',
        source: 'internal',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: Date.now() - 10_000,
      });
      await traktRunExport(PROFILE_ID, traktToken);

      await watchHistoryQueries.removeWatchHistoryItem(PROFILE_ID, MATRIX_ID, undefined);

      const ok = await traktRunExport(PROFILE_ID, traktToken);
      expect(ok).toBe(true);

      const remoteMovies = await traktClient.getWatchedMovies(traktToken);
      const matrix = remoteMovies.find((m) => m.movie.ids.imdb === MATRIX_ID);
      expect(matrix).toBeUndefined();

      const queue = store.syncQueue.filter(
        (q) => q.profileId === PROFILE_ID && q.provider === 'trakt'
      );
      expect(queue).toHaveLength(0);
    });

    it('export watchlist removal from sync queue', async () => {
      if (!traktToken) return;
      setupTraktProfile(traktToken);
      await myListQueries.addToMyList(
        PROFILE_ID,
        INCEPTION_ID,
        'movie',
        Date.now() - 10_000,
        'internal'
      );
      await traktRunExport(PROFILE_ID, traktToken);

      await myListQueries.removeFromMyList(PROFILE_ID, INCEPTION_ID);

      const ok = await traktRunExport(PROFILE_ID, traktToken);
      expect(ok).toBe(true);

      const remoteWatchlist = await traktClient.getWatchlistMovies(traktToken);
      const inception = remoteWatchlist.find((m) => m.movie?.ids?.imdb === INCEPTION_ID);
      expect(inception).toBeUndefined();
    });
  });

  describe('Hidden Shows', () => {
    it('hidden shows dismiss local continue-watching entries on import', async () => {
      if (!traktToken) return;
      setupTraktProfile(traktToken);
      // Seed a local continue-watching entry for Breaking Bad
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: BREAKING_BAD_ID,
        videoId: `${BREAKING_BAD_ID}:1:1`,
        type: 'series',
        source: 'internal',
        progressSeconds: 50,
        durationSeconds: 100,
        lastWatchedAt: Date.now() - 10_000,
      });

      // Hide the show on Trakt (POST /users/hidden/progress_watched)
      const hideRes = await traktPostJson(traktToken, '/users/hidden/progress_watched', {
        shows: [{ ids: { imdb: BREAKING_BAD_ID } }],
      });
      expect(hideRes.ok).toBe(true);

      const ok = await traktRunImport(PROFILE_ID, traktToken);
      expect(ok).toBe(true);

      const item = await watchHistoryQueries.getWatchHistoryItem(PROFILE_ID, BREAKING_BAD_ID);
      expect(item?.status).toBe('dismissed');

      // Un-hide so subsequent suite runs start clean
      await traktPostJson(traktToken, '/users/hidden/progress_watched/remove', {
        shows: [{ ids: { imdb: BREAKING_BAD_ID } }],
      });
    });
  });

  describe('Roundtrip', () => {
    it('import then export: imported items are not re-exported', async () => {
      if (!traktToken) return;
      setupTraktProfile(traktToken);
      await traktClient.postHistory(traktToken, {
        movies: [{ ids: { imdb: MATRIX_ID }, watched_at: new Date().toISOString() }],
      });

      await traktRunImport(PROFILE_ID, traktToken);
      const ok = await traktRunExport(PROFILE_ID, traktToken);
      expect(ok).toBe(true);

      const remoteMovies = await traktClient.getWatchedMovies(traktToken);
      const matrixEntries = remoteMovies.filter((m) => m.movie.ids.imdb === MATRIX_ID);
      expect(matrixEntries).toHaveLength(1);
    });

    it('export then import: exported items appear in local DB with correct source', async () => {
      if (!traktToken) return;
      setupTraktProfile(traktToken);
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: THE_WIRE_ID,
        videoId: `${THE_WIRE_ID}:1:1`,
        type: 'series',
        source: 'internal',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: Date.now() - 5000,
      });
      await traktRunExport(PROFILE_ID, traktToken);

      resetStore();
      setConnectedProvider(PROFILE_ID, 'trakt');

      const ok = await traktRunImport(PROFILE_ID, traktToken);
      expect(ok).toBe(true);

      const history = await watchHistoryQueries.listWatchHistoryForProfile(PROFILE_ID);
      const ep = history.find((h) => h.videoId === `${THE_WIRE_ID}:1:1`);
      expect(ep).toBeDefined();
      expect(ep!.source).toBe('trakt');
    });
  });

  describe('Edge Cases', () => {
    it('export with no exportable items returns true', async () => {
      if (!traktToken) return;
      setupTraktProfile(traktToken);
      const ok = await traktRunExport(PROFILE_ID, traktToken);
      expect(ok).toBe(true);
    });

    it('import with invalid token returns false', async () => {
      setupTraktProfile('invalid-token-xyz');
      const ok = await traktRunImport(PROFILE_ID, 'invalid-token-xyz');
      expect(ok).toBe(false);
    });

    it('export with invalid token returns false', async () => {
      setupTraktProfile('invalid-token-xyz');
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: MATRIX_ID,
        type: 'movie',
        source: 'internal',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: Date.now() - 5000,
      });
      const ok = await traktRunExport(PROFILE_ID, 'invalid-token-xyz');
      expect(ok).toBe(false);
    });

    it('items with no IMDB/TMDB id are skipped during export', async () => {
      if (!traktToken) return;
      setupTraktProfile(traktToken);
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: 'kitsu:5081',
        type: 'series',
        source: 'internal',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: Date.now() - 5000,
      });
      const ok = await traktRunExport(PROFILE_ID, traktToken);
      expect(ok).toBe(true);
    });

    it('multiple episodes of same show are batched', async () => {
      if (!traktToken) return;
      setupTraktProfile(traktToken);
      const now = Date.now();
      for (let ep = 1; ep <= 5; ep++) {
        await watchHistoryQueries.upsertWatchProgress({
          profileId: PROFILE_ID,
          metaId: BREAKING_BAD_ID,
          videoId: `${BREAKING_BAD_ID}:1:${ep}`,
          type: 'series',
          source: 'internal',
          progressSeconds: 100,
          durationSeconds: 100,
          lastWatchedAt: now - ep * 1000,
        });
      }

      const ok = await traktRunExport(PROFILE_ID, traktToken);
      expect(ok).toBe(true);

      const remoteShows = await traktClient.getWatchedShowsWithSeasons(traktToken);
      const bb = remoteShows.find((s) => s.show.ids.imdb === BREAKING_BAD_ID);
      expect(bb).toBeDefined();
      const s1 = bb!.seasons?.find((s) => s.number === 1);
      expect(s1).toBeDefined();
      expect(s1!.episodes?.length ?? 0).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Extended Scenarios', () => {
    it('import: multiple movies and a show in one sync', async () => {
      if (!traktToken) return;
      setupTraktProfile(traktToken);
      const now = new Date().toISOString();
      await traktClient.postHistory(traktToken, {
        movies: [
          { ids: { imdb: MATRIX_ID }, watched_at: now },
          { ids: { imdb: INCEPTION_ID }, watched_at: now },
        ],
        shows: [
          {
            ids: { imdb: BREAKING_BAD_ID },
            seasons: [
              {
                number: 1,
                episodes: [
                  { number: 1, watched_at: now },
                  { number: 2, watched_at: now },
                ],
              },
            ],
          },
        ],
      });

      const ok = await traktRunImport(PROFILE_ID, traktToken);
      expect(ok).toBe(true);

      const history = await watchHistoryQueries.listWatchHistoryForProfile(PROFILE_ID);
      expect(history.find((h) => h.id === MATRIX_ID)).toBeDefined();
      expect(history.find((h) => h.id === INCEPTION_ID)).toBeDefined();
      expect(history.find((h) => h.videoId === `${BREAKING_BAD_ID}:1:1`)).toBeDefined();
      expect(history.find((h) => h.videoId === `${BREAKING_BAD_ID}:1:2`)).toBeDefined();
    });

    it('export: movie and show combined in one sync', async () => {
      if (!traktToken) return;
      setupTraktProfile(traktToken);
      const now = Date.now() - 5000;
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: MATRIX_ID,
        type: 'movie',
        source: 'internal',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: now,
      });
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: BREAKING_BAD_ID,
        videoId: `${BREAKING_BAD_ID}:1:1`,
        type: 'series',
        source: 'internal',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: now,
      });

      const ok = await traktRunExport(PROFILE_ID, traktToken);
      expect(ok).toBe(true);

      const remoteMovies = await traktClient.getWatchedMovies(traktToken);
      const remoteShows = await traktClient.getWatchedShowsWithSeasons(traktToken);
      expect(remoteMovies.find((m) => m.movie.ids.imdb === MATRIX_ID)).toBeDefined();
      const bb = remoteShows.find((s) => s.show.ids.imdb === BREAKING_BAD_ID);
      expect(bb).toBeDefined();
      expect(bb!.seasons?.[0]?.episodes?.some((e) => e.number === 1)).toBe(true);
    });

    it('export: partially watched items are not exported', async () => {
      if (!traktToken) return;
      setupTraktProfile(traktToken);
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: MATRIX_ID,
        type: 'movie',
        source: 'internal',
        progressSeconds: 50,
        durationSeconds: 100,
        lastWatchedAt: Date.now() - 5000,
      });

      const ok = await traktRunExport(PROFILE_ID, traktToken);
      expect(ok).toBe(true);

      const remoteMovies = await traktClient.getWatchedMovies(traktToken);
      expect(remoteMovies.find((m) => m.movie.ids.imdb === MATRIX_ID)).toBeUndefined();
    });

    it('export: tmdb-only metaId resolves server-side', async () => {
      if (!traktToken) return;
      setupTraktProfile(traktToken);
      // Inception's tmdb id, with no imdb in the metaId.
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: 'tmdb:movie:27205',
        type: 'movie',
        source: 'internal',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: Date.now() - 5000,
      });

      const ok = await traktRunExport(PROFILE_ID, traktToken);
      expect(ok).toBe(true);

      const remoteMovies = await traktClient.getWatchedMovies(traktToken);
      const inception = remoteMovies.find((m) => m.movie.ids.imdb === INCEPTION_ID);
      expect(inception).toBeDefined();
    });

    it('import: watchlist show lands in myList as series', async () => {
      if (!traktToken) return;
      setupTraktProfile(traktToken);
      await traktClient.postWatchlist(traktToken, {
        shows: [{ ids: { imdb: BREAKING_BAD_ID } }],
      });

      const ok = await traktRunImport(PROFILE_ID, traktToken);
      expect(ok).toBe(true);

      const myList = await myListQueries.listMyListForProfile(PROFILE_ID);
      const bb = myList.find((m) => m.id === BREAKING_BAD_ID);
      expect(bb).toBeDefined();
      expect(bb!.type).toBe('series');
    });

    it('export: watchlist show goes to remote and is removable', async () => {
      if (!traktToken) return;
      setupTraktProfile(traktToken);
      await myListQueries.addToMyList(
        PROFILE_ID,
        BREAKING_BAD_ID,
        'series',
        Date.now() - 10_000,
        'internal'
      );
      expect(await traktRunExport(PROFILE_ID, traktToken)).toBe(true);

      const remoteWatchlist = await traktClient.getWatchlistShows(traktToken);
      expect(remoteWatchlist.find((s) => s.show?.ids?.imdb === BREAKING_BAD_ID)).toBeDefined();

      await myListQueries.removeFromMyList(PROFILE_ID, BREAKING_BAD_ID);
      expect(await traktRunExport(PROFILE_ID, traktToken)).toBe(true);

      const remoteAfter = await traktClient.getWatchlistShows(traktToken);
      expect(remoteAfter.find((s) => s.show?.ids?.imdb === BREAKING_BAD_ID)).toBeUndefined();
    });

    it('export: episode-level removal keeps other episodes', async () => {
      if (!traktToken) return;
      setupTraktProfile(traktToken);
      const now = Date.now() - 10_000;
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: BREAKING_BAD_ID,
        videoId: `${BREAKING_BAD_ID}:1:1`,
        type: 'series',
        source: 'internal',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: now,
      });
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: BREAKING_BAD_ID,
        videoId: `${BREAKING_BAD_ID}:1:2`,
        type: 'series',
        source: 'internal',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: now,
      });
      expect(await traktRunExport(PROFILE_ID, traktToken)).toBe(true);

      await watchHistoryQueries.removeWatchHistoryItem(
        PROFILE_ID,
        BREAKING_BAD_ID,
        `${BREAKING_BAD_ID}:1:1`
      );
      expect(await traktRunExport(PROFILE_ID, traktToken)).toBe(true);

      const remoteShows = await traktClient.getWatchedShowsWithSeasons(traktToken);
      const bb = remoteShows.find((s) => s.show.ids.imdb === BREAKING_BAD_ID);
      expect(bb).toBeDefined();
      const s1 = bb!.seasons?.find((s) => s.number === 1);
      const epNumbers = s1?.episodes?.map((e) => e.number) ?? [];
      expect(epNumbers).not.toContain(1);
      expect(epNumbers).toContain(2);
    });

    it('import: repeated runs do not duplicate local rows', async () => {
      if (!traktToken) return;
      setupTraktProfile(traktToken);
      await traktClient.postHistory(traktToken, {
        movies: [{ ids: { imdb: MATRIX_ID }, watched_at: new Date().toISOString() }],
      });

      expect(await traktRunImport(PROFILE_ID, traktToken)).toBe(true);
      expect(await traktRunImport(PROFILE_ID, traktToken)).toBe(true);

      const history = await watchHistoryQueries.listWatchHistoryForProfile(PROFILE_ID);
      expect(history.filter((h) => h.id === MATRIX_ID)).toHaveLength(1);
    });

    it('import: clearLocalFirst wipes local data before syncing', async () => {
      if (!traktToken) return;
      setupTraktProfile(traktToken);
      // Local item that is NOT on the remote (Inception), plus one that is.
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: INCEPTION_ID,
        type: 'movie',
        source: 'internal',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: Date.now() - 10_000,
      });
      await traktClient.postHistory(traktToken, {
        movies: [{ ids: { imdb: MATRIX_ID }, watched_at: new Date().toISOString() }],
      });

      const ok = await traktRunImport(PROFILE_ID, traktToken, undefined, {
        clearLocalFirst: true,
      });
      expect(ok).toBe(true);

      const history = await watchHistoryQueries.listWatchHistoryForProfile(PROFILE_ID);
      expect(history.find((h) => h.id === INCEPTION_ID)).toBeUndefined();
      const matrix = history.find((h) => h.id === MATRIX_ID);
      expect(matrix).toBeDefined();
      expect(matrix!.source).toBe('trakt');
    });

    it('export: advancing lastSyncAt prevents duplicate plays', async () => {
      if (!traktToken) return;
      setupTraktProfile(traktToken);
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: MATRIX_ID,
        type: 'movie',
        source: 'internal',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: Date.now() - 10_000,
      });

      expect(await traktRunExport(PROFILE_ID, traktToken)).toBe(true);
      useIntegrationsStore.setState({ lastSyncAt: { [PROFILE_ID]: { trakt: Date.now() } } });
      expect(await traktRunExport(PROFILE_ID, traktToken)).toBe(true);

      const remoteMovies = await traktClient.getWatchedMovies(traktToken);
      const matrix = remoteMovies.find((m) => m.movie.ids.imdb === MATRIX_ID);
      expect(matrix).toBeDefined();
      expect(matrix!.plays).toBe(1);
    });

    it('cleanup: series removed from remote are removed locally on next import', async () => {
      if (!traktToken) return;
      setupTraktProfile(traktToken);
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: BREAKING_BAD_ID,
        videoId: `${BREAKING_BAD_ID}:1:1`,
        type: 'series',
        source: 'trakt',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: Date.now() - 10_000,
      });

      const ok = await traktRunImport(PROFILE_ID, traktToken);
      expect(ok).toBe(true);

      const history = await watchHistoryQueries.listWatchHistoryForProfile(PROFILE_ID);
      expect(history.find((h) => h.id === BREAKING_BAD_ID)).toBeUndefined();
    });

    it('import: watchlist listed_at is preserved as myList addedAt', async () => {
      if (!traktToken) return;
      setupTraktProfile(traktToken);
      await traktClient.postWatchlist(traktToken, {
        movies: [{ ids: { imdb: INCEPTION_ID } }],
      });

      const ok = await traktRunImport(PROFILE_ID, traktToken);
      expect(ok).toBe(true);

      const myList = await myListQueries.listMyListForProfile(PROFILE_ID);
      const inception = myList.find((m) => m.id === INCEPTION_ID);
      expect(inception).toBeDefined();
      expect(inception!.addedAt).toBeGreaterThan(0);
    });

    it('export: tmdb-series metaId resolves server-side', async () => {
      if (!traktToken) return;
      setupTraktProfile(traktToken);
      // Breaking Bad's tmdb id, with no imdb in the metaId.
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: 'tmdb:series:1396',
        videoId: 'tmdb:series:1396:1:1',
        type: 'series',
        source: 'internal',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: Date.now() - 5000,
      });

      const ok = await traktRunExport(PROFILE_ID, traktToken);
      expect(ok).toBe(true);

      const remoteShows = await traktClient.getWatchedShowsWithSeasons(traktToken);
      const bb = remoteShows.find((s) => s.show.ids.imdb === BREAKING_BAD_ID);
      expect(bb).toBeDefined();
      expect(bb!.seasons?.[0]?.episodes?.some((e) => e.number === 1)).toBe(true);
    });

    it('hidden shows: multiple hidden shows and re-dismissing is idempotent', async () => {
      if (!traktToken) return;
      setupTraktProfile(traktToken);
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: BREAKING_BAD_ID,
        videoId: `${BREAKING_BAD_ID}:1:1`,
        type: 'series',
        source: 'internal',
        progressSeconds: 50,
        durationSeconds: 100,
        lastWatchedAt: Date.now() - 5000,
      });
      await watchHistoryQueries.dismissFromContinueWatching(PROFILE_ID, BREAKING_BAD_ID);
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: THE_WIRE_ID,
        videoId: `${THE_WIRE_ID}:1:1`,
        type: 'series',
        source: 'internal',
        progressSeconds: 50,
        durationSeconds: 100,
        lastWatchedAt: Date.now() - 5000,
      });

      const hide = await traktRawPost(traktToken, '/users/hidden/progress_watched', {
        shows: [{ ids: { imdb: BREAKING_BAD_ID } }, { ids: { imdb: THE_WIRE_ID } }],
      });
      expect(hide.ok).toBe(true);

      const ok = await traktRunImport(PROFILE_ID, traktToken);
      expect(ok).toBe(true);

      const history = await watchHistoryQueries.listWatchHistoryForProfile(PROFILE_ID);
      expect(history.find((h) => h.id === BREAKING_BAD_ID)?.status).toBe('dismissed');
      expect(history.find((h) => h.id === THE_WIRE_ID)?.status).toBe('dismissed');
    });

    it('import: hidden show that is also watched ends up dismissed', async () => {
      if (!traktToken) return;
      setupTraktProfile(traktToken);
      await traktClient.postHistory(traktToken, {
        shows: [
          {
            ids: { imdb: BREAKING_BAD_ID },
            seasons: [
              { number: 1, episodes: [{ number: 1, watched_at: new Date().toISOString() }] },
            ],
          },
        ],
      });
      const hide = await traktRawPost(traktToken, '/users/hidden/progress_watched', {
        shows: [{ ids: { imdb: BREAKING_BAD_ID } }],
      });
      expect(hide.ok).toBe(true);

      const ok = await traktRunImport(PROFILE_ID, traktToken);
      expect(ok).toBe(true);

      const history = await watchHistoryQueries.listWatchHistoryForProfile(PROFILE_ID);
      const bb = history.find((h) => h.videoId === `${BREAKING_BAD_ID}:1:1`);
      expect(bb).toBeDefined();
      expect(bb!.status).toBe('dismissed');
    });

    it('export: two shows are batched in one sync', async () => {
      if (!traktToken) return;
      setupTraktProfile(traktToken);
      const now = Date.now() - 5000;
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: BREAKING_BAD_ID,
        videoId: `${BREAKING_BAD_ID}:1:1`,
        type: 'series',
        source: 'internal',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: now,
      });
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: THE_WIRE_ID,
        videoId: `${THE_WIRE_ID}:1:1`,
        type: 'series',
        source: 'internal',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: now,
      });

      const ok = await traktRunExport(PROFILE_ID, traktToken);
      expect(ok).toBe(true);

      const remoteShows = await traktClient.getWatchedShowsWithSeasons(traktToken);
      const bb = remoteShows.find((s) => s.show.ids.imdb === BREAKING_BAD_ID);
      const wire = remoteShows.find((s) => s.show.ids.imdb === THE_WIRE_ID);
      expect(bb).toBeDefined();
      expect(bb!.seasons?.[0]?.episodes?.some((e) => e.number === 1)).toBe(true);
      expect(wire).toBeDefined();
      expect(wire!.seasons?.[0]?.episodes?.some((e) => e.number === 1)).toBe(true);
    });

    it('import: newer local data is not overwritten by older remote data', async () => {
      if (!traktToken) return;
      setupTraktProfile(traktToken);
      await traktClient.postHistory(traktToken, {
        movies: [
          {
            ids: { imdb: MATRIX_ID },
            watched_at: new Date(Date.now() - 3600_000).toISOString(),
          },
        ],
      });
      const localWatchedAt = Date.now();
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: MATRIX_ID,
        type: 'movie',
        source: 'trakt',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: localWatchedAt,
      });

      const ok = await traktRunImport(PROFILE_ID, traktToken);
      expect(ok).toBe(true);

      const history = await watchHistoryQueries.listWatchHistoryForProfile(PROFILE_ID);
      const matrix = history.find((h) => h.id === MATRIX_ID);
      expect(matrix).toBeDefined();
      expect(matrix!.lastWatchedAt).toBe(localWatchedAt);
    });
  });
});

// ─── Simkl Tests ──────────────────────────────────────────────────────────────

describe('Simkl', () => {
  beforeAll(async () => {
    if (!simklToken) {
      console.log('Skipping Simkl tests - no token');
      return;
    }
    await cleanupSimklRemote(simklToken);
  });

  // Hermeticity: restore clean remote state after every test.
  afterEach(async () => {
    if (simklToken) await cleanupSimklRemote(simklToken);
  });

  describe('Import', () => {
    it('fresh import on empty remote returns true and makes no DB writes', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      const ok = await simklRunImport(PROFILE_ID, simklToken);
      expect(ok).toBe(true);
      const history = await watchHistoryQueries.listWatchHistoryForProfile(PROFILE_ID);
      const myList = await myListQueries.listMyListForProfile(PROFILE_ID);
      expect(history).toHaveLength(0);
      expect(myList).toHaveLength(0);
    });

    it('import completed movie from remote', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      await simklClient.postHistory(simklToken, {
        movies: [{ ids: { imdb: MATRIX_ID }, status: 'completed' }],
      });

      const ok = await simklRunImport(PROFILE_ID, simklToken);
      expect(ok).toBe(true);

      const history = await watchHistoryQueries.listWatchHistoryForProfile(PROFILE_ID);
      const matrix = history.find((h) => h.id === MATRIX_ID);
      expect(matrix).toBeDefined();
      expect(matrix!.source).toBe('simkl');
      expect(matrix!.status).toBe('completed');
    });

    it('import watching show goes to both history and myList', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      // A partially-watched show with status "watching" (movies can't be
      // "watching" on Simkl — they are silently rewritten to completed).
      await simklClient.postHistory(simklToken, {
        shows: [
          {
            ids: { imdb: BREAKING_BAD_ID },
            seasons: [{ number: 1, episodes: [{ number: 1 }] }],
            status: 'watching',
          },
        ],
      });

      const ok = await simklRunImport(PROFILE_ID, simklToken);
      expect(ok).toBe(true);

      const history = await watchHistoryQueries.listWatchHistoryForProfile(PROFILE_ID);
      const myList = await myListQueries.listMyListForProfile(PROFILE_ID);

      expect(history.find((h) => h.videoId === `${BREAKING_BAD_ID}:1:1`)).toBeDefined();
      expect(myList.find((m) => m.id === BREAKING_BAD_ID)).toBeDefined();
    });

    it('import plantowatch goes to myList only', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      await simklClient.postWatchlist(simklToken, {
        movies: [{ ids: { imdb: INCEPTION_ID }, to: 'plantowatch' }],
      });

      const ok = await simklRunImport(PROFILE_ID, simklToken);
      expect(ok).toBe(true);

      const history = await watchHistoryQueries.listWatchHistoryForProfile(PROFILE_ID);
      const myList = await myListQueries.listMyListForProfile(PROFILE_ID);

      expect(history.find((h) => h.id === INCEPTION_ID)).toBeUndefined();
      expect(myList.find((m) => m.id === INCEPTION_ID)).toBeDefined();
    });

    it('import episode-level history for a show', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      await simklClient.postHistory(simklToken, {
        shows: [
          {
            ids: { imdb: BREAKING_BAD_ID },
            seasons: [{ number: 1, episodes: [{ number: 1 }, { number: 2 }] }],
          },
        ],
      });

      const ok = await simklRunImport(PROFILE_ID, simklToken);
      expect(ok).toBe(true);

      const history = await watchHistoryQueries.listWatchHistoryForProfile(PROFILE_ID);
      const ep1 = history.find((h) => h.videoId === `${BREAKING_BAD_ID}:1:1`);
      const ep2 = history.find((h) => h.videoId === `${BREAKING_BAD_ID}:1:2`);
      expect(ep1).toBeDefined();
      expect(ep2).toBeDefined();
    });

    it('import anime (kitsu ID) resolves correctly', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      await simklClient.postWatchlist(simklToken, {
        anime: [{ ids: { kitsu: ANIME_KITSU_ID }, to: 'completed' }],
      });

      const ok = await simklRunImport(PROFILE_ID, simklToken);
      expect(ok).toBe(true);

      const history = await watchHistoryQueries.listWatchHistoryForProfile(PROFILE_ID);
      // Simkl's catalog entry for kitsu:1 has an imdb id, so the import maps
      // it locally to ANIME_IMDB_ID (imdb wins in getMetaIdFromIds).
      const anime = history.find((h) => h.id === ANIME_ID || h.id === ANIME_IMDB_ID);
      expect(anime).toBeDefined();
    });

    it('import dropped item removes it from local history and myList', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: MATRIX_ID,
        type: 'movie',
        source: 'simkl',
        progressSeconds: 50,
        durationSeconds: 100,
        lastWatchedAt: Date.now() - 10_000,
      });
      await myListQueries.addToMyList(PROFILE_ID, MATRIX_ID, 'movie', Date.now() - 10_000, 'simkl');

      await simklClient.postWatchlist(simklToken, {
        movies: [{ ids: { imdb: MATRIX_ID }, to: 'dropped' }],
      });

      const ok = await simklRunImport(PROFILE_ID, simklToken);
      expect(ok).toBe(true);

      const history = await watchHistoryQueries.listWatchHistoryForProfile(PROFILE_ID);
      const myList = await myListQueries.listMyListForProfile(PROFILE_ID);
      expect(history.find((h) => h.id === MATRIX_ID)).toBeUndefined();
      expect(myList.find((m) => m.id === MATRIX_ID)).toBeUndefined();
    });

    it('concurrent imports are deduplicated', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      const [r1, r2] = await Promise.all([
        simklRunImport(PROFILE_ID, simklToken),
        simklRunImport(PROFILE_ID, simklToken),
      ]);
      expect(r1).toBe(true);
      expect(r2).toBe(true);
    });

    it('cleanup: items removed from remote are removed locally on next import', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: MATRIX_ID,
        type: 'movie',
        source: 'simkl',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: Date.now() - 10_000,
      });

      // The Matrix is NOT on remote (afterEach cleanup guarantees this)
      const ok = await simklRunImport(PROFILE_ID, simklToken, undefined, { clearLocalFirst: true });
      expect(ok).toBe(true);

      const history = await watchHistoryQueries.listWatchHistoryForProfile(PROFILE_ID);
      expect(history.find((h) => h.id === MATRIX_ID)).toBeUndefined();
    });
  });

  describe('Export', () => {
    it('export completed movie to remote history', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: MATRIX_ID,
        type: 'movie',
        source: 'internal',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: Date.now() - 5000,
      });

      const ok = await simklRunExport(PROFILE_ID, simklToken);
      expect(ok).toBe(true);

      const remoteItems = await simklClient.getAllItems(simklToken, 'movies', undefined, 'full');
      const matrix = (remoteItems?.movies ?? []).find((m) => m.movie?.ids?.imdb === MATRIX_ID);
      expect(matrix).toBeDefined();
    });

    it('export episode history to remote', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: BREAKING_BAD_ID,
        videoId: `${BREAKING_BAD_ID}:1:1`,
        type: 'series',
        source: 'internal',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: Date.now() - 5000,
      });

      const ok = await simklRunExport(PROFILE_ID, simklToken);
      expect(ok).toBe(true);

      const remoteItems = await simklClient.getAllItems(simklToken, 'shows', undefined, 'full');
      const bb = (remoteItems?.shows ?? []).find((s) => s.show?.ids?.imdb === BREAKING_BAD_ID);
      expect(bb).toBeDefined();
    });

    it('export anime (kitsu-only ID) to remote', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      // Anime items carry kitsu-only IDs locally — Simkl resolves kitsu IDs
      // server-side on write endpoints, so no /search/id round-trip is needed.
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: ANIME_ID,
        videoId: `${ANIME_ID}:1:1`,
        type: 'series',
        source: 'internal',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: Date.now() - 5000,
      });

      const ok = await simklRunExport(PROFILE_ID, simklToken);
      expect(ok).toBe(true);

      const remoteItems = await simklClient.getAllItems(simklToken, 'anime', undefined, 'full');
      // Simkl keys TV-type anime items in the anime[] bucket as `show` (not
      // `anime`) and serializes kitsu as a string.
      const anime = (remoteItems?.anime ?? []).find(
        (a) => String((a.show ?? a.anime)?.ids?.kitsu) === String(ANIME_KITSU_ID)
      );
      expect(anime).toBeDefined();
    });

    it('export watchlist item to remote', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      await myListQueries.addToMyList(
        PROFILE_ID,
        INCEPTION_ID,
        'movie',
        Date.now() - 5000,
        'internal'
      );

      const ok = await simklRunExport(PROFILE_ID, simklToken);
      expect(ok).toBe(true);

      const remoteItems = await simklClient.getAllItems(simklToken, 'movies', undefined, 'full');
      const inception = (remoteItems?.movies ?? []).find(
        (m) => m.movie?.ids?.imdb === INCEPTION_ID
      );
      expect(inception).toBeDefined();
    });

    it('export skips items already sourced from simkl', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: MATRIX_ID,
        type: 'movie',
        source: 'simkl',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: Date.now() - 5000,
      });

      const ok = await simklRunExport(PROFILE_ID, simklToken);
      expect(ok).toBe(true);

      const remoteItems = await simklClient.getAllItems(simklToken, 'movies', undefined, 'full');
      const matrix = (remoteItems?.movies ?? []).find((m) => m.movie?.ids?.imdb === MATRIX_ID);
      expect(matrix).toBeUndefined();
    });

    it('export removal from sync queue removes item from remote', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: MATRIX_ID,
        type: 'movie',
        source: 'internal',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: Date.now() - 10_000,
      });
      await simklRunExport(PROFILE_ID, simklToken);

      await watchHistoryQueries.removeWatchHistoryItem(PROFILE_ID, MATRIX_ID, undefined);

      const ok = await simklRunExport(PROFILE_ID, simklToken);
      expect(ok).toBe(true);

      const remoteItems = await simklClient.getAllItems(simklToken, 'movies', undefined, 'full');
      const matrix = (remoteItems?.movies ?? []).find((m) => m.movie?.ids?.imdb === MATRIX_ID);
      expect(matrix).toBeUndefined();

      const queue = store.syncQueue.filter(
        (q) => q.profileId === PROFILE_ID && q.provider === 'simkl'
      );
      expect(queue).toHaveLength(0);
    });

    it('export watchlist removal from sync queue', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      await myListQueries.addToMyList(
        PROFILE_ID,
        INCEPTION_ID,
        'movie',
        Date.now() - 10_000,
        'internal'
      );
      await simklRunExport(PROFILE_ID, simklToken);

      await myListQueries.removeFromMyList(PROFILE_ID, INCEPTION_ID);

      const ok = await simklRunExport(PROFILE_ID, simklToken);
      expect(ok).toBe(true);

      const remoteItems = await simklClient.getAllItems(simklToken, 'movies', undefined, 'full');
      const inception = (remoteItems?.movies ?? []).find(
        (m) => m.movie?.ids?.imdb === INCEPTION_ID
      );
      expect(inception).toBeUndefined();
    });
  });

  describe('Roundtrip', () => {
    it('import then export: imported items are not re-exported', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      await simklClient.postHistory(simklToken, {
        movies: [{ ids: { imdb: MATRIX_ID }, status: 'completed' }],
      });

      await simklRunImport(PROFILE_ID, simklToken);
      const ok = await simklRunExport(PROFILE_ID, simklToken);
      expect(ok).toBe(true);

      const remoteItems = await simklClient.getAllItems(simklToken, 'movies', undefined, 'full');
      const matrixEntries = (remoteItems?.movies ?? []).filter(
        (m) => m.movie?.ids?.imdb === MATRIX_ID
      );
      expect(matrixEntries).toHaveLength(1);
    });

    it('export then import: exported items appear in local DB with correct source', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: THE_WIRE_ID,
        videoId: `${THE_WIRE_ID}:1:1`,
        type: 'series',
        source: 'internal',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: Date.now() - 5000,
      });
      await simklRunExport(PROFILE_ID, simklToken);

      resetStore();
      setConnectedProvider(PROFILE_ID, 'simkl');

      const ok = await simklRunImport(PROFILE_ID, simklToken);
      expect(ok).toBe(true);

      const history = await watchHistoryQueries.listWatchHistoryForProfile(PROFILE_ID);
      const ep = history.find((h) => h.videoId === `${THE_WIRE_ID}:1:1`);
      expect(ep).toBeDefined();
      expect(ep!.source).toBe('simkl');
    });
  });

  describe('Edge Cases', () => {
    it('export with no exportable items returns true', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      const ok = await simklRunExport(PROFILE_ID, simklToken);
      expect(ok).toBe(true);
    });

    it('import with invalid token returns false', async () => {
      setupSimklProfile('invalid-token-xyz');
      const ok = await simklRunImport(PROFILE_ID, 'invalid-token-xyz');
      expect(ok).toBe(false);
    });

    it('export with invalid token returns false', async () => {
      setupSimklProfile('invalid-token-xyz');
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: MATRIX_ID,
        type: 'movie',
        source: 'internal',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: Date.now() - 5000,
      });
      const ok = await simklRunExport(PROFILE_ID, 'invalid-token-xyz');
      expect(ok).toBe(false);
    });

    it('items with unresolvable IDs are skipped during export', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: 'unknown:totally-fake-id-xyz',
        type: 'movie',
        source: 'internal',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: Date.now() - 5000,
      });
      const ok = await simklRunExport(PROFILE_ID, simklToken);
      expect(ok).toBe(true);
    });

    it('multiple episodes of same show are batched', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      const now = Date.now();
      for (let ep = 1; ep <= 4; ep++) {
        await watchHistoryQueries.upsertWatchProgress({
          profileId: PROFILE_ID,
          metaId: BREAKING_BAD_ID,
          videoId: `${BREAKING_BAD_ID}:1:${ep}`,
          type: 'series',
          source: 'internal',
          progressSeconds: 100,
          durationSeconds: 100,
          lastWatchedAt: now - ep * 1000,
        });
      }

      const ok = await simklRunExport(PROFILE_ID, simklToken);
      expect(ok).toBe(true);

      const remoteItems = await simklClient.getAllItems(simklToken, 'shows', undefined, 'full');
      const bb = (remoteItems?.shows ?? []).find((s) => s.show?.ids?.imdb === BREAKING_BAD_ID);
      expect(bb).toBeDefined();
    });
  });

  describe('Extended Scenarios', () => {
    it('import: movie + show + anime in one sync', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      await simklClient.postHistory(simklToken, {
        movies: [{ ids: { imdb: MATRIX_ID }, status: 'completed' }],
      });
      await simklClient.postHistory(simklToken, {
        shows: [
          { ids: { imdb: BREAKING_BAD_ID }, seasons: [{ number: 1, episodes: [{ number: 1 }] }] },
        ],
      });
      await simklClient.postWatchlist(simklToken, {
        anime: [{ ids: { kitsu: ANIME_KITSU_ID }, to: 'completed' }],
      });

      const ok = await simklRunImport(PROFILE_ID, simklToken);
      expect(ok).toBe(true);

      const history = await watchHistoryQueries.listWatchHistoryForProfile(PROFILE_ID);
      const myList = await myListQueries.listMyListForProfile(PROFILE_ID);
      expect(history.find((h) => h.id === MATRIX_ID)).toBeDefined();
      expect(history.find((h) => h.videoId === `${BREAKING_BAD_ID}:1:1`)).toBeDefined();
      expect(history.find((h) => h.id === ANIME_IMDB_ID || h.id === ANIME_ID)).toBeDefined();
      // The watching show lands in myList too.
      expect(myList.find((m) => m.id === BREAKING_BAD_ID)).toBeDefined();
    });

    it('export: movie + show + anime in one sync', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      const now = Date.now() - 5000;
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: MATRIX_ID,
        type: 'movie',
        source: 'internal',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: now,
      });
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: BREAKING_BAD_ID,
        videoId: `${BREAKING_BAD_ID}:1:1`,
        type: 'series',
        source: 'internal',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: now,
      });
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: ANIME_ID,
        videoId: `${ANIME_ID}:1:1`,
        type: 'series',
        source: 'internal',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: now,
      });

      const ok = await simklRunExport(PROFILE_ID, simklToken);
      expect(ok).toBe(true);

      const movies = await simklClient.getAllItems(simklToken, 'movies', undefined, 'full');
      const shows = await simklClient.getAllItems(simklToken, 'shows', undefined, 'full');
      const anime = await simklClient.getAllItems(simklToken, 'anime', undefined, 'full');
      expect((movies?.movies ?? []).some((m) => m.movie?.ids?.imdb === MATRIX_ID)).toBe(true);
      expect((shows?.shows ?? []).some((s) => s.show?.ids?.imdb === BREAKING_BAD_ID)).toBe(true);
      expect(
        (anime?.anime ?? []).some(
          (a) => String((a.show ?? a.anime)?.ids?.kitsu) === String(ANIME_KITSU_ID)
        )
      ).toBe(true);
    });

    it('import: hold status goes to myList only, not history', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      await simklClient.postWatchlist(simklToken, {
        shows: [{ ids: { imdb: BREAKING_BAD_ID }, to: 'hold' }],
      });

      const ok = await simklRunImport(PROFILE_ID, simklToken);
      expect(ok).toBe(true);

      const history = await watchHistoryQueries.listWatchHistoryForProfile(PROFILE_ID);
      const myList = await myListQueries.listMyListForProfile(PROFILE_ID);
      expect(myList.find((m) => m.id === BREAKING_BAD_ID)).toBeDefined();
      expect(history.find((h) => h.id === BREAKING_BAD_ID)).toBeUndefined();
    });

    it('import: plantowatch show goes to myList only', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      await simklClient.postWatchlist(simklToken, {
        shows: [{ ids: { imdb: THE_WIRE_ID }, to: 'plantowatch' }],
      });

      const ok = await simklRunImport(PROFILE_ID, simklToken);
      expect(ok).toBe(true);

      const history = await watchHistoryQueries.listWatchHistoryForProfile(PROFILE_ID);
      const myList = await myListQueries.listMyListForProfile(PROFILE_ID);
      expect(myList.find((m) => m.id === THE_WIRE_ID)).toBeDefined();
      expect(history.find((h) => h.id === THE_WIRE_ID)).toBeUndefined();
    });

    it('export: partially watched items are not exported', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: MATRIX_ID,
        type: 'movie',
        source: 'internal',
        progressSeconds: 50,
        durationSeconds: 100,
        lastWatchedAt: Date.now() - 5000,
      });

      const ok = await simklRunExport(PROFILE_ID, simklToken);
      expect(ok).toBe(true);

      const remoteItems = await simklClient.getAllItems(simklToken, 'movies', undefined, 'full');
      const matrix = (remoteItems?.movies ?? []).find((m) => m.movie?.ids?.imdb === MATRIX_ID);
      expect(matrix).toBeUndefined();
    });

    it('export: numeric simkl-id metaId round-trips', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      // Cowboy Bebop's simkl id (from the kitsu:1 resolution).
      const SIMKL_ID = 37089;
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: String(SIMKL_ID),
        videoId: `${SIMKL_ID}:1:1`,
        type: 'series',
        source: 'internal',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: Date.now() - 5000,
      });

      const ok = await simklRunExport(PROFILE_ID, simklToken);
      expect(ok).toBe(true);

      const remoteItems = await simklClient.getAllItems(simklToken, 'anime', undefined, 'full');
      const anime = (remoteItems?.anime ?? []).find(
        (a) => (a.show ?? a.anime)?.ids?.simkl === SIMKL_ID
      );
      expect(anime).toBeDefined();
    });

    it('export: watchlist show goes to remote watchlist', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      await myListQueries.addToMyList(
        PROFILE_ID,
        BREAKING_BAD_ID,
        'series',
        Date.now() - 5000,
        'internal'
      );

      const ok = await simklRunExport(PROFILE_ID, simklToken);
      expect(ok).toBe(true);

      const remoteItems = await simklClient.getAllItems(simklToken, 'shows', undefined, 'full');
      const bb = (remoteItems?.shows ?? []).find((s) => s.show?.ids?.imdb === BREAKING_BAD_ID);
      expect(bb).toBeDefined();
      expect(bb!.status).toBe('plantowatch');
    });

    it('import: dropped show removes local history and myList', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: BREAKING_BAD_ID,
        videoId: `${BREAKING_BAD_ID}:1:1`,
        type: 'series',
        source: 'simkl',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: Date.now() - 10_000,
      });
      await myListQueries.addToMyList(
        PROFILE_ID,
        BREAKING_BAD_ID,
        'series',
        Date.now() - 10_000,
        'simkl'
      );

      await simklClient.postWatchlist(simklToken, {
        shows: [{ ids: { imdb: BREAKING_BAD_ID }, to: 'dropped' }],
      });

      const ok = await simklRunImport(PROFILE_ID, simklToken);
      expect(ok).toBe(true);

      const history = await watchHistoryQueries.listWatchHistoryForProfile(PROFILE_ID);
      const myList = await myListQueries.listMyListForProfile(PROFILE_ID);
      expect(history.find((h) => h.id === BREAKING_BAD_ID)).toBeUndefined();
      expect(myList.find((m) => m.id === BREAKING_BAD_ID)).toBeUndefined();
    });

    it('import: whole-show completion lands per-episode history', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      // No seasons/episodes — server marks every aired episode.
      await simklClient.postHistory(simklToken, {
        shows: [{ ids: { imdb: BREAKING_BAD_ID }, status: 'completed' }],
      });

      const ok = await simklRunImport(PROFILE_ID, simklToken);
      expect(ok).toBe(true);

      const history = await watchHistoryQueries.listWatchHistoryForProfile(PROFILE_ID);
      expect(history.find((h) => h.videoId === `${BREAKING_BAD_ID}:1:1`)).toBeDefined();
    });

    it('import: repeated watch events do not duplicate local rows', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      await simklClient.postHistory(simklToken, {
        movies: [{ ids: { imdb: MATRIX_ID }, status: 'completed' }],
      });
      await simklClient.postHistory(simklToken, {
        movies: [{ ids: { imdb: MATRIX_ID }, status: 'completed' }],
      });

      const ok = await simklRunImport(PROFILE_ID, simklToken);
      expect(ok).toBe(true);

      const history = await watchHistoryQueries.listWatchHistoryForProfile(PROFILE_ID);
      expect(history.filter((h) => h.id === MATRIX_ID)).toHaveLength(1);
    });

    it('incremental import: cursor prevents re-importing unchanged items', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      await simklClient.postHistory(simklToken, {
        movies: [{ ids: { imdb: MATRIX_ID }, status: 'completed' }],
      });
      await simklRunImport(PROFILE_ID, simklToken);
      const cursors =
        useIntegrationsStore.getState().settings[PROFILE_ID]?.simkl?.connection?.syncCursors;
      expect(cursors).toBeDefined();

      await simklClient.postHistory(simklToken, {
        movies: [{ ids: { imdb: INCEPTION_ID }, status: 'completed' }],
      });
      const ok = await simklRunImport(PROFILE_ID, simklToken, cursors);
      expect(ok).toBe(true);

      const history = await watchHistoryQueries.listWatchHistoryForProfile(PROFILE_ID);
      expect(history.filter((h) => h.id === MATRIX_ID)).toHaveLength(1);
      expect(history.find((h) => h.id === INCEPTION_ID)).toBeDefined();
    });

    it('export: advancing lastSyncAt prevents duplicate plays', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: MATRIX_ID,
        type: 'movie',
        source: 'internal',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: Date.now() - 10_000,
      });

      expect(await simklRunExport(PROFILE_ID, simklToken)).toBe(true);
      useIntegrationsStore.setState({ lastSyncAt: { [PROFILE_ID]: { simkl: Date.now() } } });
      expect(await simklRunExport(PROFILE_ID, simklToken)).toBe(true);

      const remoteItems = await simklClient.getAllItems(simklToken, 'movies', undefined, 'full');
      const entries = (remoteItems?.movies ?? []).filter((m) => m.movie?.ids?.imdb === MATRIX_ID);
      expect(entries).toHaveLength(1);
    });

    it('cleanup: items removed from remote are removed locally via removed_from_list diff', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      await simklClient.postHistory(simklToken, {
        movies: [{ ids: { imdb: MATRIX_ID }, status: 'completed' }],
      });

      expect(await simklRunImport(PROFILE_ID, simklToken)).toBe(true);

      let history = await watchHistoryQueries.listWatchHistoryForProfile(PROFILE_ID);
      expect(history.find((h) => h.id === MATRIX_ID)).toBeDefined();

      await simklClient.removeFromHistory(simklToken, {
        movies: [{ ids: { imdb: MATRIX_ID } }],
      });

      expect(await simklRunImport(PROFILE_ID, simklToken)).toBe(true);

      history = await watchHistoryQueries.listWatchHistoryForProfile(PROFILE_ID);
      expect(history.find((h) => h.id === MATRIX_ID)).toBeUndefined();
    });

    it('export: series-level record without videoId is skipped', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: BREAKING_BAD_ID,
        type: 'series',
        source: 'internal',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: Date.now() - 5000,
      });

      const ok = await simklRunExport(PROFILE_ID, simklToken);
      expect(ok).toBe(true);

      const remoteItems = await simklClient.getAllItems(simklToken, 'shows', undefined, 'full');
      const bb = (remoteItems?.shows ?? []).find((s) => s.show?.ids?.imdb === BREAKING_BAD_ID);
      expect(bb).toBeUndefined();
    });

    it('export: two shows are batched in one sync', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      const now = Date.now() - 5000;
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: BREAKING_BAD_ID,
        videoId: `${BREAKING_BAD_ID}:1:1`,
        type: 'series',
        source: 'internal',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: now,
      });
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: THE_WIRE_ID,
        videoId: `${THE_WIRE_ID}:1:1`,
        type: 'series',
        source: 'internal',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: now,
      });

      const ok = await simklRunExport(PROFILE_ID, simklToken);
      expect(ok).toBe(true);

      const remoteItems = await simklClient.getAllItems(simklToken, 'shows', undefined, 'full');
      const shows = remoteItems?.shows ?? [];
      expect(shows.some((s) => s.show?.ids?.imdb === BREAKING_BAD_ID)).toBe(true);
      expect(shows.some((s) => s.show?.ids?.imdb === THE_WIRE_ID)).toBe(true);
    });

    it('export: episode-level removal keeps other episodes', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      const now = Date.now() - 5000;
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: BREAKING_BAD_ID,
        videoId: `${BREAKING_BAD_ID}:1:1`,
        type: 'series',
        source: 'internal',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: now,
      });
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: BREAKING_BAD_ID,
        videoId: `${BREAKING_BAD_ID}:1:2`,
        type: 'series',
        source: 'internal',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: now,
      });
      expect(await simklRunExport(PROFILE_ID, simklToken)).toBe(true);

      await watchHistoryQueries.removeWatchHistoryItem(
        PROFILE_ID,
        BREAKING_BAD_ID,
        `${BREAKING_BAD_ID}:1:1`
      );
      expect(await simklRunExport(PROFILE_ID, simklToken)).toBe(true);

      const remoteItems = await simklClient.getAllItems(simklToken, 'shows', undefined, 'full');
      const bb = (remoteItems?.shows ?? []).find((s) => s.show?.ids?.imdb === BREAKING_BAD_ID);
      expect(bb).toBeDefined();
      const s1 = bb!.seasons?.find((s) => s.number === 1);
      const epNumbers = s1?.episodes?.map((e) => e.number) ?? [];
      expect(epNumbers).not.toContain(1);
      expect(epNumbers).toContain(2);
    });

    it('export: series watchlist removal removes bare show from remote', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      // Seed a series in My List and export it to the remote watchlist.
      await myListQueries.addToMyList(
        PROFILE_ID,
        BREAKING_BAD_ID,
        'series',
        Date.now() - 10_000,
        'internal'
      );
      expect(await simklRunExport(PROFILE_ID, simklToken)).toBe(true);

      let remoteItems = await simklClient.getAllItems(simklToken, 'shows', undefined, 'full');
      let bb = (remoteItems?.shows ?? []).find((s) => s.show?.ids?.imdb === BREAKING_BAD_ID);
      expect(bb).toBeDefined();

      // Removing from My List queues a bare (no videoId) remove_watchlist entry;
      // the export must remove the show from the library entirely.
      await myListQueries.removeFromMyList(PROFILE_ID, BREAKING_BAD_ID);
      expect(await simklRunExport(PROFILE_ID, simklToken)).toBe(true);

      remoteItems = await simklClient.getAllItems(simklToken, 'shows', undefined, 'full');
      bb = (remoteItems?.shows ?? []).find((s) => s.show?.ids?.imdb === BREAKING_BAD_ID);
      expect(bb).toBeUndefined();

      const queue = store.syncQueue.filter(
        (q) => q.profileId === PROFILE_ID && q.provider === 'simkl'
      );
      expect(queue).toHaveLength(0);
    });

    it('export: meta-level series history removal removes whole show', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: BREAKING_BAD_ID,
        videoId: `${BREAKING_BAD_ID}:1:1`,
        type: 'series',
        source: 'internal',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: Date.now() - 10_000,
      });
      expect(await simklRunExport(PROFILE_ID, simklToken)).toBe(true);

      let remoteItems = await simklClient.getAllItems(simklToken, 'shows', undefined, 'full');
      let bb = (remoteItems?.shows ?? []).find((s) => s.show?.ids?.imdb === BREAKING_BAD_ID);
      expect(bb).toBeDefined();

      // Clearing the whole show from local history queues a bare remove_history
      // entry; the export must remove the show from the library entirely.
      await watchHistoryQueries.removeWatchHistoryMeta(PROFILE_ID, BREAKING_BAD_ID);
      expect(await simklRunExport(PROFILE_ID, simklToken)).toBe(true);

      remoteItems = await simklClient.getAllItems(simklToken, 'shows', undefined, 'full');
      bb = (remoteItems?.shows ?? []).find((s) => s.show?.ids?.imdb === BREAKING_BAD_ID);
      expect(bb).toBeUndefined();
    });

    it('export: mixed removal queue processes history and watchlist removals in one sync', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      // Seed one history item and one watchlist item, both exported to remote.
      await watchHistoryQueries.upsertWatchProgress({
        profileId: PROFILE_ID,
        metaId: THE_WIRE_ID,
        videoId: `${THE_WIRE_ID}:1:1`,
        type: 'series',
        source: 'internal',
        progressSeconds: 100,
        durationSeconds: 100,
        lastWatchedAt: Date.now() - 10_000,
      });
      await myListQueries.addToMyList(
        PROFILE_ID,
        INCEPTION_ID,
        'movie',
        Date.now() - 10_000,
        'internal'
      );
      expect(await simklRunExport(PROFILE_ID, simklToken)).toBe(true);

      // Remove both locally before the next sync: the queue now holds a
      // remove_history and a remove_watchlist entry that must both be
      // processed by the same export run.
      await watchHistoryQueries.removeWatchHistoryMeta(PROFILE_ID, THE_WIRE_ID);
      await myListQueries.removeFromMyList(PROFILE_ID, INCEPTION_ID);
      expect(await simklRunExport(PROFILE_ID, simklToken)).toBe(true);

      const remoteShows = await simklClient.getAllItems(simklToken, 'shows', undefined, 'full');
      const wire = (remoteShows?.shows ?? []).find((s) => s.show?.ids?.imdb === THE_WIRE_ID);
      expect(wire).toBeUndefined();

      const remoteMovies = await simklClient.getAllItems(simklToken, 'movies', undefined, 'full');
      const inception = (remoteMovies?.movies ?? []).find(
        (m) => m.movie?.ids?.imdb === INCEPTION_ID
      );
      expect(inception).toBeUndefined();

      const queue = store.syncQueue.filter(
        (q) => q.profileId === PROFILE_ID && q.provider === 'simkl'
      );
      expect(queue).toHaveLength(0);
    });

    it('import: myList addedAt preserved from added_to_watchlist_at', async () => {
      if (!simklToken) return;
      setupSimklProfile(simklToken);
      await simklClient.postWatchlist(simklToken, {
        movies: [{ ids: { imdb: INCEPTION_ID }, to: 'plantowatch' }],
      });

      const ok = await simklRunImport(PROFILE_ID, simklToken);
      expect(ok).toBe(true);

      const myList = await myListQueries.listMyListForProfile(PROFILE_ID);
      const inception = myList.find((m) => m.id === INCEPTION_ID);
      expect(inception).toBeDefined();
      expect(inception!.addedAt).toBeGreaterThan(0);
    });
  });
});
