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
      movies: { plantowatch: '2026-01-01T00:00:00.000Z' },
      tv_shows: { plantowatch: '2026-01-01T00:00:00.000Z' },
      anime: { plantowatch: '2026-01-01T00:00:00.000Z' },
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
      const cursorsObj = { plantowatch: cursor };

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
      expect(mockGetAllItems).toHaveBeenNthCalledWith(3, 'token', 'anime', undefined, 'full');
    });

    it('fetches category when activity timestamp is newer than cursor', async () => {
      // Arrange
      mockGetActivities.mockResolvedValueOnce({
        movies: { plantowatch: '2026-02-01T00:00:00.000Z' },
        tv_shows: { plantowatch: '2026-02-01T00:00:00.000Z' },
        anime: { plantowatch: '2026-02-01T00:00:00.000Z' },
      });

      // Act
      await runImport(
        'profile-1',
        'token',
        {
          movies: { plantowatch: '2026-01-01T00:00:00.000Z' },
          tv_shows: { plantowatch: '2026-01-01T00:00:00.000Z' },
          anime: { plantowatch: '2026-01-01T00:00:00.000Z' },
        }
      );

      // Assert
      expect(mockGetAllItems).toHaveBeenCalledTimes(3);
      expect(mockGetAllItems).toHaveBeenNthCalledWith(
        1,
        'token',
        'movies',
        '2026-01-01T00:00:00.000Z',
        'full'
      );
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
                status: 'completed',
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

      // Watching -> History
      expect(mockUpsertWatchProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: 'profile-1',
          metaId: '333',
        })
      );

      // Dropped -> Ignored (wait, the new logic removes dropped from My List and History!)
      // My list removals are called:
      expect(mockRemoveFromMyList).toHaveBeenCalledWith('profile-1', '222');
      expect(mockRemoveWatchHistoryMeta).toHaveBeenCalledWith('profile-1', '222');
    });

    it('clears local history first when clearLocalFirst is true', async () => {
      // Arrange / Act
      await runImport('profile-1', 'token', undefined, { clearLocalFirst: true });

      // Assert
      expect(mockRemoveProfileWatchHistory).toHaveBeenCalledWith('profile-1');
    });

    it('saves new cursors after successful import', async () => {
      // Arrange / Act
      await runImport('profile-1', 'token');

      // Assert
      expect(mockUpdateSimklCursors).toHaveBeenCalledWith('profile-1', {
        movies: { plantowatch: '2026-01-01T00:00:00.000Z' },
        tv_shows: { plantowatch: '2026-01-01T00:00:00.000Z' },
        anime: { plantowatch: '2026-01-01T00:00:00.000Z' },
      });
    });

    it('does not throw on error (fail-safe)', async () => {
      // Arrange
      mockGetActivities.mockRejectedValueOnce(new Error('boom'));

      // Act / Assert
      await expect(runImport('profile-1', 'token')).resolves.toBe(false);
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
