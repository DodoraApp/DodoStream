import { runExport, runImport } from '../sync-service';

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

const mockUpdateSimklCursors = jest.fn();
jest.mock('@/store/integrations.store', () => ({
  useIntegrationsStore: {
    getState: () => ({
      updateSimklCursors: mockUpdateSimklCursors,
      lastSyncAt: {},
    }),
  },
}));

describe('simkl sync service', () => {
  beforeEach(() => {
    mockGetActivities.mockReset();
    mockGetAllItems.mockReset();
    mockPostHistory.mockReset();
    mockPostWatchlist.mockReset();
    mockResolveSimklIds.mockReset();
    mockUpsertWatchProgress.mockReset();
    mockListWatchHistory.mockReset();
    mockListExportableWatchHistory.mockReset();
    mockListExportableMyList.mockReset();
    mockRemoveProfileWatchHistory.mockReset();
    mockRemoveWatchHistoryMeta.mockReset();
    mockUpdateSimklCursors.mockReset();
    mockAddToMyList.mockReset();
    mockRemoveFromMyList.mockReset();
    mockRemoveProfileMyList.mockReset();
    mockAddToSyncQueue.mockReset();
    mockCancelPendingSyncRemovals.mockReset();
    mockListSyncQueueForProvider.mockReset();
    mockDeleteFromSyncQueue.mockReset();

    mockGetActivities.mockResolvedValue({
      all: '2026-01-01T00:00:00.000Z',
      movies: { all: '2026-01-01T00:00:00.000Z', plantowatch: '2026-01-01T00:00:00.000Z' },
      tv_shows: { all: '2026-01-01T00:00:00.000Z', plantowatch: '2026-01-01T00:00:00.000Z' },
      anime: { all: '2026-01-01T00:00:00.000Z', plantowatch: '2026-01-01T00:00:00.000Z' },
    });
    mockGetAllItems.mockResolvedValue({ movies: [], shows: [], anime: [] });
    mockListWatchHistory.mockResolvedValue([]);
    mockListExportableWatchHistory.mockResolvedValue([]);
    mockListExportableMyList.mockResolvedValue([]);
    mockListSyncQueueForProvider.mockResolvedValue([]);
    mockResolveSimklIds.mockResolvedValue({ simkl: 10, imdb: 'tt10' });
  });

  describe('runImport', () => {
    it('skips category when cursor matches activity timestamp', async () => {
      // Arrange
      const cursor = '2026-01-01T00:00:00.000Z';
      const cursorsObj = { all: cursor, plantowatch: cursor };

      // Act
      await runImport(
        'profile-1',
        'token',
        { movies: cursorsObj, tv_shows: cursorsObj, anime: cursorsObj }
      );

      // Assert
      expect(mockGetAllItems).not.toHaveBeenCalled();
    });

    it('fetches category when no cursor exists', async () => {
      // Arrange / Act
      await runImport('profile-1', 'token');

      // Assert
      expect(mockGetAllItems).toHaveBeenCalledTimes(3);
      expect(mockGetAllItems).toHaveBeenNthCalledWith(1, 'token', 'movies', undefined, 'full');
      expect(mockGetAllItems).toHaveBeenNthCalledWith(2, 'token', 'shows', undefined, 'full');
      expect(mockGetAllItems).toHaveBeenNthCalledWith(3, 'token', 'anime', undefined, 'full_anime_seasons');
    });

    it('fetches category when activity timestamp is newer than cursor', async () => {
      // Arrange
      mockGetActivities.mockResolvedValueOnce({
        movies: { all: '2026-02-01T00:00:00.000Z' },
        tv_shows: { all: '2026-02-01T00:00:00.000Z' },
        anime: { all: '2026-02-01T00:00:00.000Z' },
      });

      // Act
      await runImport(
        'profile-1',
        'token',
        {
          movies: { all: '2026-01-01T00:00:00.000Z' },
          tv_shows: { all: '2026-01-01T00:00:00.000Z' },
          anime: { all: '2026-01-01T00:00:00.000Z' },
        }
      );

      // Assert
      expect(mockGetAllItems).toHaveBeenCalledTimes(3);
      expect(mockUpdateSimklCursors).toHaveBeenCalledWith(
        'profile-1',
        expect.objectContaining({
          movies: expect.objectContaining({ all: '2026-02-01T00:00:00.000Z' }),
        })
      );
    });

    it('skips category when object activity timestamp matches cursor', async () => {
      // Arrange
      const cursor = '2026-01-01T00:00:00.000Z';
      mockGetActivities.mockResolvedValueOnce({
        movies: { all: { all: cursor } },
        tv_shows: { all: { all: cursor } },
        anime: { all: { all: cursor } },
      });

      // Act
      await runImport(
        'profile-1',
        'token',
        {
          movies: { all: cursor },
          tv_shows: { all: cursor },
          anime: { all: cursor },
        }
      );

      // Assert
      expect(mockGetAllItems).not.toHaveBeenCalled();
    });

    it('imports movie items correctly', async () => {
      // Arrange
      mockGetAllItems.mockImplementation((_token: string, type: string) => {
        if (type === 'movies') {
          return Promise.resolve({
            movies: [
              {
                movie: { ids: { simkl: 555 }, title: 'Movie' },
                last_watched_at: '2026-03-01T10:00:00.000Z',
                status: 'watching',
              },
            ],
          });
        }
        return Promise.resolve({});
      });

      // Act
      await runImport('profile-1', 'token');

      // Assert
      expect(mockUpsertWatchProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: 'profile-1',
          metaId: '555',
          type: 'movie',
        })
      );
    });

    it('imports show episodes correctly with videoId metaId:season:episode', async () => {
      // Arrange
      mockGetAllItems.mockImplementation((_token: string, type: string) => {
        if (type === 'shows') {
          return Promise.resolve({
            shows: [
              {
                show: { ids: { imdb: 'tt12345' }, title: 'Show' },
                status: 'watching', // Changed to 'watching' to ensure episodes are imported
                seasons: [
                  { number: 2, episodes: [{ number: 3, watched_at: '2026-03-02T00:00:00.000Z' }] },
                ],
              },
            ],
          });
        }
        return Promise.resolve({});
      });

      // Act
      await runImport('profile-1', 'token');

      // Assert
      expect(mockUpsertWatchProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: 'profile-1',
          metaId: 'tt12345',
          videoId: 'tt12345:2:3',
          type: 'series',
        })
      );
    });

    it('imports counts-only show items as meta-level series history row', async () => {
      // Arrange
      mockGetAllItems.mockImplementation((_token: string, type: string) => {
        if (type === 'shows') {
          return Promise.resolve({
            shows: [
              {
                show: { ids: { imdb: 'tt1695360' }, title: 'Gravity Falls' },
                status: 'watching',
                watched_episodes_count: 40,
                last_watched_at: '2026-03-03T12:34:56.000Z',
              },
            ],
          });
        }
        return Promise.resolve({});
      });

      // Act
      await runImport('profile-1', 'token');

      // Assert
      expect(mockUpsertWatchProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: 'profile-1',
          metaId: 'tt1695360',
          videoId: undefined,
          type: 'series',
          lastWatchedAt: new Date('2026-03-03T12:34:56.000Z').getTime(),
        })
      );
    });

    it('filters items by status: plantowatch to My List, dropped ignored', async () => {
      // Arrange
      mockGetAllItems.mockImplementation((_token: string, type: string) => {
        if (type === 'movies') {
          return Promise.resolve({
            movies: [
              {
                movie: { ids: { simkl: 111 }, title: 'Plan Movie' },
                status: 'plantowatch',
              },
              {
                movie: { ids: { simkl: 222 }, title: 'Dropped Movie' },
                status: 'dropped',
              },
              {
                movie: { ids: { simkl: 333 }, title: 'Watching Movie' },
                status: 'watching',
                last_watched_at: '2026-03-01T10:00:00.000Z',
              },
            ],
          });
        }
        return Promise.resolve({});
      });

      // Act
      await runImport('profile-1', 'token');

      // Assert
      // Plan to watch -> My List
      expect(mockAddToMyList).toHaveBeenCalledWith('profile-1', '111', 'movie', undefined);

      // Watching -> My List AND History
      expect(mockAddToMyList).toHaveBeenCalledWith('profile-1', '333', 'movie', undefined);
      expect(mockUpsertWatchProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: 'profile-1',
          metaId: '333',
        })
      );

      // Dropped -> Removals
      expect(mockRemoveFromMyList).toHaveBeenCalledWith('profile-1', '222');
      expect(mockRemoveWatchHistoryMeta).toHaveBeenCalledWith('profile-1', '222');
    });

    it('imports anime items correctly using the anime property', async () => {
      // Arrange
      mockGetAllItems.mockImplementation((_token: string, type: string) => {
        if (type === 'anime') {
          return Promise.resolve({
            anime: [
              {
                anime: { ids: { kitsu: 123 }, title: 'Anime Series' },
                status: 'watching',
                seasons: [
                  { number: 1, episodes: [{ number: 1, watched_at: '2026-03-01T10:00:00.000Z' }] },
                ],
              },
            ],
          });
        }
        return Promise.resolve({});
      });

      // Act
      await runImport('profile-1', 'token');

      // Assert
      expect(mockUpsertWatchProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: 'profile-1',
          metaId: 'kitsu:123',
          videoId: 'kitsu:123:1:1',
          type: 'series',
        })
      );
    });

    it('clears local history first when clearLocalFirst is true', async () => {
      // Arrange / Act
      await runImport('profile-1', 'token', undefined, { clearLocalFirst: true });

      // Assert
      expect(mockRemoveProfileWatchHistory).toHaveBeenCalledWith('profile-1');
    });

    it('deduplicates metaIds during cleanup', async () => {
      // Arrange
      mockGetActivities.mockResolvedValueOnce({
        movies: { removed_from_list: '2026-02-01T00:00:00.000Z' },
      });
      mockGetAllItems.mockResolvedValueOnce({ movies: [] }); // Simkl list is empty
      mockListWatchHistory.mockResolvedValueOnce([
        { id: 'movie-1', source: 'simkl', type: 'movie' },
        { id: 'movie-1', source: 'simkl', type: 'movie' }, // Duplicate metaId
      ]);

      // Act
      await runImport('profile-1', 'token', {
        movies: { removed_from_list: '2026-01-01T00:00:00.000Z' },
      });

      // Assert
      expect(mockRemoveWatchHistoryMeta).toHaveBeenCalledTimes(1);
      expect(mockRemoveWatchHistoryMeta).toHaveBeenCalledWith('profile-1', 'movie-1');
    });

    it('imports items with hold status correctly', async () => {
      // Arrange
      mockGetAllItems.mockImplementation((_token: string, type: string) => {
        if (type === 'shows') {
          return Promise.resolve({
            shows: [
              {
                show: { ids: { imdb: 'tt123' }, title: 'Hold Show' },
                status: 'hold',
                watched_episodes_count: 5,
                last_watched_at: '2026-03-01T10:00:00.000Z',
              },
            ],
          });
        }
        return Promise.resolve({});
      });

      // Act
      await runImport('profile-1', 'token');

      // Assert
      expect(mockUpsertWatchProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: 'profile-1',
          metaId: 'tt123',
          type: 'series',
        })
      );
      // Hold should also be in My List
      expect(mockAddToMyList).toHaveBeenCalledWith('profile-1', 'tt123', 'series', undefined);
    });

    it('parses last_watched string into videoId when episode arrays are missing', async () => {
      // Arrange
      mockGetAllItems.mockImplementation((_token: string, type: string) => {
        if (type === 'shows') {
          return Promise.resolve({
            shows: [
              {
                show: { ids: { imdb: 'tt1317187' }, title: 'The Last of Us' },
                status: 'watching',
                last_watched: 'S01E09',
                last_watched_at: '2025-06-22T11:52:39Z',
              },
            ],
          });
        }
        return Promise.resolve({});
      });

      // Act
      await runImport('profile-1', 'token');

      // Assert
      expect(mockUpsertWatchProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          metaId: 'tt1317187',
          videoId: 'tt1317187:1:9',
          type: 'series',
        })
      );
    });

    it('saves all new cursors after successful import', async () => {
      // Arrange
      mockGetActivities.mockResolvedValue({
        movies: {
          all: '2026-04-25T14:15:00Z',
          watched_at: '2026-04-25T14:14:00Z',
          plantowatch: '2026-04-25T14:13:00Z',
          hold: '2026-04-25T14:12:00Z',
        },
      });

      // Act
      await runImport('profile-1', 'token');

      // Assert
      expect(mockUpdateSimklCursors).toHaveBeenCalledWith(
        'profile-1',
        expect.objectContaining({
          movies: expect.objectContaining({
            plantowatch: '2026-04-25T14:13:00Z',
            hold: '2026-04-25T14:12:00Z',
          }),
        })
      );
    });

    it('does not throw on error (fail-safe)', async () => {
      // Arrange
      mockGetActivities.mockRejectedValueOnce(new Error('boom'));

      // Act / Assert
      await expect(runImport('profile-1', 'token')).resolves.toBe(false);
    });

    it('handles null response from getAllItems gracefully', async () => {
      // Arrange
      mockGetActivities.mockResolvedValueOnce({
        movies: { plantowatch: '2026-02-01T00:00:00.000Z' },
        tv_shows: { plantowatch: '2026-02-01T00:00:00.000Z' },
        anime: { plantowatch: '2026-02-01T00:00:00.000Z' },
      });
      // Simulate API returning null (as seen in logs)
      mockGetAllItems.mockResolvedValue(null);

      // Act
      const result = await runImport('profile-1', 'token', {
        movies: { plantowatch: '2026-01-01T00:00:00.000Z' },
        tv_shows: { plantowatch: '2026-01-01T00:00:00.000Z' },
        anime: { plantowatch: '2026-01-01T00:00:00.000Z' },
      });

      // Assert
      expect(result).toBe(true);
      expect(mockGetAllItems).toHaveBeenCalled();
      // Should not have crashed and should have updated cursors
      expect(mockUpdateSimklCursors).toHaveBeenCalled();
    });
  });

  describe('runExport', () => {
    it('posts completed movies to Simkl (ratio >= 0.9)', async () => {
      // Arrange
      mockListExportableWatchHistory.mockResolvedValueOnce([
        {
          id: 'movie-1',
          type: 'movie',
          status: 'completed',
          progressSeconds: 90,
          durationSeconds: 100,
          lastWatchedAt: Date.now(),
        },
      ]);
      mockResolveSimklIds.mockResolvedValueOnce({ simkl: 77, imdb: 'tt77' });

      // Act
      await runExport('profile-1', 'token');

      // Assert
      expect(mockPostHistory).toHaveBeenCalledWith('token', {
        movies: [{ ids: { simkl: 77, imdb: 'tt77' } }],
        shows: [],
      });
    });

    it('skips items below completion threshold', async () => {
      // Arrange — DB filters out non-completed items; mock returns empty list
      mockListExportableWatchHistory.mockResolvedValueOnce([]);

      // Act
      await runExport('profile-1', 'token');

      // Assert
      expect(mockResolveSimklIds).not.toHaveBeenCalled();
      expect(mockPostHistory).not.toHaveBeenCalled();
    });

    it('groups show episodes by season correctly', async () => {
      // Arrange
      mockListExportableWatchHistory.mockResolvedValueOnce([
        {
          id: 'show-1',
          type: 'series',
          videoId: 'show-1:1:2',
          status: 'completed',
          progressSeconds: 95,
          durationSeconds: 100,
          lastWatchedAt: Date.now(),
        },
        {
          id: 'show-1',
          type: 'series',
          videoId: 'show-1:1:3',
          status: 'completed',
          progressSeconds: 96,
          durationSeconds: 100,
          lastWatchedAt: Date.now(),
        },
        {
          id: 'show-1',
          type: 'series',
          videoId: 'show-1:2:1',
          status: 'completed',
          progressSeconds: 97,
          durationSeconds: 100,
          lastWatchedAt: Date.now(),
        },
      ]);
      mockResolveSimklIds.mockResolvedValue({ simkl: 888, imdb: 'tt888' });

      // Act
      await runExport('profile-1', 'token');

      // Assert
      expect(mockPostHistory).toHaveBeenCalledWith('token', {
        movies: [],
        shows: [
          {
            ids: { simkl: 888, imdb: 'tt888' },
            seasons: [
              { number: 1, episodes: [{ number: 2 }, { number: 3 }] },
              { number: 2, episodes: [{ number: 1 }] },
            ],
          },
        ],
      });
    });

    it('does not throw on error (fail-safe)', async () => {
      // Arrange
      mockListExportableWatchHistory.mockRejectedValueOnce(new Error('db broken'));

      // Act / Assert
      await expect(runExport('profile-1', 'token')).resolves.toBe(false);
    });

    it('skips items where resolveSimklIds returns null', async () => {
      // Arrange
      mockListExportableWatchHistory.mockResolvedValueOnce([
        {
          id: 'movie-1',
          type: 'movie',
          status: 'completed',
          progressSeconds: 100,
          durationSeconds: 100,
          lastWatchedAt: Date.now(),
        },
      ]);
      mockResolveSimklIds.mockResolvedValueOnce(null);

      // Act
      await runExport('profile-1', 'token');

      // Assert
      expect(mockPostHistory).not.toHaveBeenCalled();
    });

    it('exports My List items to Simkl watchlist', async () => {
      // Arrange
      mockListExportableMyList.mockResolvedValueOnce([
        { id: 'movie-99', type: 'movie', addedAt: Date.now() },
        { id: 'show-99', type: 'series', addedAt: Date.now() },
      ]);
      mockResolveSimklIds.mockImplementation((id) => {
        if (id === 'movie-99') return Promise.resolve({ simkl: 991 });
        if (id === 'show-99') return Promise.resolve({ simkl: 992 });
        return Promise.resolve(null);
      });

      // Act
      await runExport('profile-1', 'token');

      // Assert
      expect(mockPostWatchlist).toHaveBeenCalledWith('token', {
        movies: [{ ids: { simkl: 991 }, to: 'plantowatch' }],
        shows: [{ ids: { simkl: 992 }, to: 'plantowatch' }],
      });
    });
  });
});
