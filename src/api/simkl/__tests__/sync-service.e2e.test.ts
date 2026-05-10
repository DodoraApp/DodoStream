import { runExport, runImport } from '../sync-service';

// Mock dependencies
const mockGetActivities = jest.fn();
const mockGetAllItems = jest.fn();
const mockPostHistory = jest.fn();
const mockPostWatchlist = jest.fn();
const mockRemoveFromHistory = jest.fn();

jest.mock('../client', () => ({
  getActivities: (...args: any[]) => mockGetActivities(...args),
  getAllItems: (...args: any[]) => mockGetAllItems(...args),
  postHistory: (...args: any[]) => mockPostHistory(...args),
  postWatchlist: (...args: any[]) => mockPostWatchlist(...args),
  removeFromHistory: (...args: any[]) => mockRemoveFromHistory(...args),
}));

const mockResolveSimklIds = jest.fn();
jest.mock('../id-resolver', () => ({
  resolveSimklIds: (...args: any[]) => mockResolveSimklIds(...args),
}));

const mockUpsertWatchProgress = jest.fn();
const mockListWatchHistory = jest.fn();
const mockListExportableWatchHistory = jest.fn();
const mockRemoveProfileWatchHistory = jest.fn();
const mockRemoveWatchHistoryMeta = jest.fn();
jest.mock('@/db/queries/watchHistory', () => ({
  upsertWatchProgress: (...args: any[]) => mockUpsertWatchProgress(...args),
  listWatchHistoryForProfile: (...args: any[]) => mockListWatchHistory(...args),
  listExportableWatchHistoryForProfile: (...args: any[]) => mockListExportableWatchHistory(...args),
  removeProfileWatchHistory: (...args: any[]) => mockRemoveProfileWatchHistory(...args),
  removeWatchHistoryMeta: (...args: any[]) => mockRemoveWatchHistoryMeta(...args),
}));

const mockAddToSyncQueue = jest.fn();
const mockCancelPendingSyncRemovals = jest.fn();
const mockListSyncQueueForProvider = jest.fn();
const mockDeleteFromSyncQueue = jest.fn();
jest.mock('@/db/queries/syncQueue', () => ({
  addToSyncQueue: (...args: any[]) => mockAddToSyncQueue(...args),
  cancelPendingSyncRemovals: (...args: any[]) => mockCancelPendingSyncRemovals(...args),
  listSyncQueueForProvider: (...args: any[]) => mockListSyncQueueForProvider(...args),
  deleteFromSyncQueue: (...args: any[]) => mockDeleteFromSyncQueue(...args),
}));

const mockAddToMyList = jest.fn();
const mockListExportableMyList = jest.fn();
const mockRemoveFromMyList = jest.fn();
const mockRemoveProfileMyList = jest.fn();
jest.mock('@/db/queries/myList', () => ({
  addToMyList: (...args: any[]) => mockAddToMyList(...args),
  listExportableMyListForProfile: (...args: any[]) => mockListExportableMyList(...args),
  removeFromMyList: (...args: any[]) => mockRemoveFromMyList(...args),
  removeProfileMyList: (...args: any[]) => mockRemoveProfileMyList(...args),
}));

jest.mock('@/db/queries/metaCache', () => ({
  upsertMinimalMetaCache: jest.fn(),
}));

const mockUpdateSimklCursors = jest.fn();
jest.mock('@/store/integrations.store', () => ({
  useIntegrationsStore: {
    getState: () => ({
      updateSimklCursors: mockUpdateSimklCursors,
      lastSyncAt: {},
    }),
  },
}));

describe('Simkl Sync Service - Comprehensive E2E', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default activities
    mockGetActivities.mockResolvedValue({
      movies: { all: '2026-04-25T15:00:00Z' },
      tv_shows: { all: '2026-04-25T15:00:00Z' },
      anime: { all: '2026-04-25T15:00:00Z' },
    });

    // Default empty items
    mockGetAllItems.mockResolvedValue({});
    mockListWatchHistory.mockResolvedValue([]);
    mockListExportableWatchHistory.mockResolvedValue([]);
    mockListExportableMyList.mockResolvedValue([]);
    mockListSyncQueueForProvider.mockResolvedValue([]);
    mockResolveSimklIds.mockResolvedValue({ simkl: 123 });
  });

  describe('Import Flow', () => {
    it('correctly categorizes anime as movie or series based on key presence', async () => {
      mockGetAllItems.mockImplementation((_token, type) => {
        if (type === 'anime') {
          return Promise.resolve({
            anime: [
              {
                movie: { ids: { imdb: 'tt_anime_movie' }, title: 'Anime Movie' },
                status: 'completed',
              },
              {
                show: { ids: { imdb: 'tt_anime_series' }, title: 'Anime Series' },
                status: 'watching',
                last_watched: 'S01E01',
              },
            ],
          });
        }
        return Promise.resolve({});
      });

      await runImport('profile-1', 'token');

      // Anime Movie -> movie
      expect(mockUpsertWatchProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          metaId: 'tt_anime_movie',
          type: 'movie',
          progressSeconds: 100, // completed -> 100
        })
      );

      // Anime Series -> series
      expect(mockUpsertWatchProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          metaId: 'tt_anime_series',
          type: 'series',
          progressSeconds: 1, // watching -> 1
        })
      );
    });

    it('protects movies and shows from being deleted by anime category', async () => {
      // Initial state: we have a movie and a show
      mockListWatchHistory.mockResolvedValue([
        { id: 'tt_movie', type: 'movie', source: 'simkl' },
        { id: 'tt_show', type: 'series', source: 'simkl' },
      ]);

      // Removals triggered for all categories
      mockGetActivities.mockResolvedValue({
        movies: { removed_from_list: '2026-04-25T15:00:00Z' },
        tv_shows: { removed_from_list: '2026-04-25T15:00:00Z' },
        anime: { removed_from_list: '2026-04-25T15:00:00Z' },
      });

      mockGetAllItems.mockImplementation((_token, type, _dateFrom, extended) => {
        if (extended !== 'ids_only') return Promise.resolve({});

        // Simkl API can return movies under "movies" or "anime"
        if (type === 'movies')
          return Promise.resolve({ movies: [{ movie: { ids: { imdb: 'tt_movie' } } }] });
        if (type === 'shows')
          return Promise.resolve({ shows: [{ show: { ids: { imdb: 'tt_show' } } }] });
        if (type === 'anime') return Promise.resolve({ anime: [] });

        return Promise.resolve({});
      });

      await runImport('profile-1', 'token', {
        movies: { removed_from_list: '2026-04-25T14:00:00Z' },
        tv_shows: { removed_from_list: '2026-04-25T14:00:00Z' },
        anime: { removed_from_list: '2026-04-25T14:00:00Z' },
      });

      // Nothing should be removed because they were found in their respective categories
      expect(mockRemoveWatchHistoryMeta).not.toHaveBeenCalled();
    });

    it('imports episode-level history for fully completed shows', async () => {
      mockGetAllItems.mockImplementation((_token, type) => {
        if (type === 'shows') {
          return Promise.resolve({
            shows: [
              {
                show: { ids: { imdb: 'tt_completed' }, title: 'Completed Show' },
                status: 'completed',
                seasons: [{ number: 1, episodes: [{ number: 1 }, { number: 2 }] }],
              },
            ],
          });
        }
        return Promise.resolve({});
      });

      await runImport('profile-1', 'token');

      // Should have 2 calls for the episodes, NOT a single call for the series
      expect(mockUpsertWatchProgress).toHaveBeenCalledTimes(2);
      expect(mockUpsertWatchProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          metaId: 'tt_completed',
          videoId: 'tt_completed:1:1',
          progressSeconds: 100,
        })
      );
      expect(mockUpsertWatchProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          metaId: 'tt_completed',
          videoId: 'tt_completed:1:2',
          progressSeconds: 100,
        })
      );
    });

    it('imports watching/hold/plantowatch to My List and watching/completed/hold to history', async () => {
      mockGetAllItems.mockImplementation((_token, type) => {
        if (type === 'movies') {
          return Promise.resolve({
            movies: [
              {
                movie: { ids: { imdb: 'tt_watching' } },
                status: 'watching',
                last_watched_at: '2026-01-01T00:00:00Z',
              },
              {
                movie: { ids: { imdb: 'tt_hold' } },
                status: 'hold',
                last_watched_at: '2026-01-01T00:00:00Z',
              },
              { movie: { ids: { imdb: 'tt_plantowatch' } }, status: 'plantowatch' },
              {
                movie: { ids: { imdb: 'tt_completed' } },
                status: 'completed',
                last_watched_at: '2026-01-01T00:00:00Z',
              },
              { movie: { ids: { imdb: 'tt_dropped' } }, status: 'dropped' },
            ],
          });
        }
        return Promise.resolve({});
      });

      await runImport('profile-1', 'token');

      // My List additions: watching, hold, plantowatch
      expect(mockAddToMyList).toHaveBeenCalledWith(
        'profile-1',
        'tt_watching',
        'movie',
        undefined,
        'simkl'
      );
      expect(mockAddToMyList).toHaveBeenCalledWith(
        'profile-1',
        'tt_hold',
        'movie',
        undefined,
        'simkl'
      );
      expect(mockAddToMyList).toHaveBeenCalledWith(
        'profile-1',
        'tt_plantowatch',
        'movie',
        undefined,
        'simkl'
      );
      expect(mockAddToMyList).not.toHaveBeenCalledWith(
        'profile-1',
        'tt_completed',
        'movie',
        expect.anything()
      );

      // History upserts: watching, hold, completed
      expect(mockUpsertWatchProgress).toHaveBeenCalledWith(
        expect.objectContaining({ metaId: 'tt_watching' })
      );
      expect(mockUpsertWatchProgress).toHaveBeenCalledWith(
        expect.objectContaining({ metaId: 'tt_hold' })
      );
      expect(mockUpsertWatchProgress).toHaveBeenCalledWith(
        expect.objectContaining({ metaId: 'tt_completed' })
      );
      expect(mockUpsertWatchProgress).not.toHaveBeenCalledWith(
        expect.objectContaining({ metaId: 'tt_plantowatch' })
      );

      // Dropped: removals
      expect(mockRemoveFromMyList).toHaveBeenCalledWith('profile-1', 'tt_dropped', 'simkl');
      expect(mockRemoveWatchHistoryMeta).toHaveBeenCalledWith('profile-1', 'tt_dropped', 'simkl');
    });

    it('handles missing IMDB IDs by falling back to kitsu or simkl ID', async () => {
      mockGetAllItems.mockResolvedValue({
        anime: [
          {
            show: { ids: { kitsu: 1234, simkl: 5678 }, title: 'No IMDB' },
            status: 'completed',
          },
        ],
      });

      await runImport('profile-1', 'token');

      expect(mockUpsertWatchProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          metaId: 'kitsu:1234',
          type: 'series',
        })
      );
    });

    it('aborts removal sync if any getAllItems call fails (Empty Response Safety)', async () => {
      mockListWatchHistory.mockResolvedValue([{ id: 'tt_item_1', type: 'movie', source: 'simkl' }]);

      mockGetActivities.mockResolvedValue({
        movies: { removed_from_list: '2026-04-25T15:00:00Z' },
      });

      // Simulate API error (returning null)
      mockGetAllItems.mockResolvedValue(null);

      await runImport('profile-1', 'token', {
        movies: { removed_from_list: '2026-04-25T14:00:00Z' },
      });

      // Cleanup should NOT have been called because one of the ID fetches failed
      expect(mockRemoveWatchHistoryMeta).not.toHaveBeenCalled();
    });

    it('prevents concurrent imports for the same profile', async () => {
      mockGetActivities.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({}), 100))
      );

      const sync1 = runImport('profile-concurrent', 'token');
      const sync2 = runImport('profile-concurrent', 'token');

      const results = await Promise.all([sync1, sync2]);

      // Both should return true (one runs, one skips but returns true)
      expect(results[0]).toBe(true);
      expect(results[1]).toBe(true);

      // getActivities should only have been called once
      expect(mockGetActivities).toHaveBeenCalledTimes(1);
    });

    it('correctly maps various anime types (OVA, ONA, Special)', async () => {
      mockGetAllItems.mockResolvedValue({
        anime: [
          { show: { ids: { imdb: 'tt_ova' } }, status: 'completed' },
          { show: { ids: { imdb: 'tt_ona' } }, status: 'completed' },
          { show: { ids: { imdb: 'tt_special' } }, status: 'completed' },
          { show: { ids: { imdb: 'tt_music' } }, status: 'completed' },
        ],
      });

      await runImport('profile-1', 'token');

      // All should be mapped to 'series' (determined by presence of 'show' key)
      expect(mockUpsertWatchProgress).toHaveBeenCalledWith(
        expect.objectContaining({ metaId: 'tt_ova', type: 'series' })
      );
      expect(mockUpsertWatchProgress).toHaveBeenCalledWith(
        expect.objectContaining({ metaId: 'tt_ona', type: 'series' })
      );
      expect(mockUpsertWatchProgress).toHaveBeenCalledWith(
        expect.objectContaining({ metaId: 'tt_special', type: 'series' })
      );
      expect(mockUpsertWatchProgress).toHaveBeenCalledWith(
        expect.objectContaining({ metaId: 'tt_music', type: 'series' })
      );
    });
  });

  describe('Export Flow', () => {
    it('exports completed items and watchlist items', async () => {
      mockListExportableWatchHistory.mockResolvedValue([
        { id: 'tt_exp_history', type: 'movie', status: 'completed' },
      ]);
      mockListExportableMyList.mockResolvedValue([{ id: 'tt_exp_watchlist', type: 'series' }]);
      mockResolveSimklIds.mockImplementation((id) => {
        if (id === 'tt_exp_history') return Promise.resolve({ imdb: 'tt_exp_history' });
        if (id === 'tt_exp_watchlist') return Promise.resolve({ imdb: 'tt_exp_watchlist' });
        return Promise.resolve(null);
      });

      await runExport('profile-1', 'token');

      expect(mockPostHistory).toHaveBeenCalledWith(
        'token',
        expect.objectContaining({
          movies: [expect.objectContaining({ ids: { imdb: 'tt_exp_history' } })],
        })
      );
      expect(mockPostWatchlist).toHaveBeenCalledWith(
        'token',
        expect.objectContaining({
          shows: [
            expect.objectContaining({ ids: { imdb: 'tt_exp_watchlist' }, to: 'plantowatch' }),
          ],
        })
      );
    });

    it('exports removals from sync queue', async () => {
      mockListSyncQueueForProvider.mockResolvedValue([
        {
          id: 1,
          metaId: 'tt_remove',
          type: 'movie',
          action: 'remove_history',
          createdAt: Date.now(),
        },
      ]);
      // simulate that this item is new since last sync
      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 1000);

      mockResolveSimklIds.mockResolvedValue({ imdb: 'tt_remove' });

      await runExport('profile-1', 'token');

      expect(mockRemoveFromHistory).toHaveBeenCalledWith(
        'token',
        expect.objectContaining({
          movies: [expect.objectContaining({ ids: { imdb: 'tt_remove' } })],
        })
      );
      expect(mockDeleteFromSyncQueue).toHaveBeenCalledWith([1]);
    });

    it('gracefully handles missing Simkl IDs during export', async () => {
      mockListExportableWatchHistory.mockResolvedValue([
        { id: 'tt_unknown', type: 'movie', status: 'completed' },
      ]);
      mockResolveSimklIds.mockResolvedValue(null);

      await runExport('profile-1', 'token');

      // Should not have called postHistory because ID couldn't be resolved
      expect(mockPostHistory).not.toHaveBeenCalled();
    });
  });
});
