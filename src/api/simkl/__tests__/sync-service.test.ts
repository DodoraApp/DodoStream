import { runExport, runImport } from '../sync-service';

const mockGetActivities = jest.fn();
const mockGetAllItems = jest.fn();
const mockPostHistory = jest.fn();

jest.mock('../client', () => ({
  getActivities: (...args: any[]) => mockGetActivities(...args),
  getAllItems: (...args: any[]) => mockGetAllItems(...args),
  postHistory: (...args: any[]) => mockPostHistory(...args),
}));

const mockResolveSimklIds = jest.fn();
jest.mock('../id-resolver', () => ({
  resolveSimklIds: (...args: any[]) => mockResolveSimklIds(...args),
}));

const mockUpsertWatchProgress = jest.fn();
const mockListWatchHistory = jest.fn();
const mockRemoveProfileWatchHistory = jest.fn();
jest.mock('@/db/queries/watchHistory', () => ({
  upsertWatchProgress: (...args: any[]) => mockUpsertWatchProgress(...args),
  listWatchHistoryForProfile: (...args: any[]) => mockListWatchHistory(...args),
  removeProfileWatchHistory: (...args: any[]) => mockRemoveProfileWatchHistory(...args),
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
    mockResolveSimklIds.mockReset();
    mockUpsertWatchProgress.mockReset();
    mockListWatchHistory.mockReset();
    mockRemoveProfileWatchHistory.mockReset();
    mockUpdateSimklCursors.mockReset();

    mockGetActivities.mockResolvedValue({
      all: '2026-01-01T00:00:00.000Z',
      movies: { all: '2026-01-01T00:00:00.000Z' },
      tv_shows: { all: '2026-01-01T00:00:00.000Z' },
      anime: { all: '2026-01-01T00:00:00.000Z' },
    });
    mockGetAllItems.mockResolvedValue({ movies: [], shows: [], anime: [] });
    mockListWatchHistory.mockResolvedValue([]);
    mockResolveSimklIds.mockResolvedValue({ simkl: 10, imdb: 'tt10' });
  });

  describe('runImport', () => {
    it('skips category when cursor matches activity timestamp', async () => {
      // Arrange
      const cursor = '2026-01-01T00:00:00.000Z';

      // Act
      await runImport(
        'profile-1',
        'token',
        'client',
        { movies: cursor, shows: cursor, anime: cursor },
        undefined
      );

      // Assert
      expect(mockGetAllItems).not.toHaveBeenCalled();
    });

    it('fetches category when no cursor exists', async () => {
      // Arrange / Act
      await runImport('profile-1', 'token', 'client');

      // Assert
      expect(mockGetAllItems).toHaveBeenCalledTimes(3);
      expect(mockGetAllItems).toHaveBeenNthCalledWith(1, 'token', 'client', 'movies', undefined);
      expect(mockGetAllItems).toHaveBeenNthCalledWith(2, 'token', 'client', 'shows', undefined);
      expect(mockGetAllItems).toHaveBeenNthCalledWith(3, 'token', 'client', 'anime', undefined);
    });

    it('fetches category when activity timestamp is newer than cursor', async () => {
      // Arrange
      mockGetActivities.mockResolvedValueOnce({
        all: '2026-02-01T00:00:00.000Z',
        movies: { all: '2026-02-01T00:00:00.000Z' },
        tv_shows: { all: '2026-02-01T00:00:00.000Z' },
        anime: { all: '2026-02-01T00:00:00.000Z' },
      });

      // Act
      await runImport(
        'profile-1',
        'token',
        'client',
        {
          movies: '2026-01-01T00:00:00.000Z',
          shows: '2026-01-01T00:00:00.000Z',
          anime: '2026-01-01T00:00:00.000Z',
        },
        undefined
      );

      // Assert
      expect(mockGetAllItems).toHaveBeenCalledTimes(3);
      expect(mockGetAllItems).toHaveBeenNthCalledWith(
        1,
        'token',
        'client',
        'movies',
        '2026-01-01T00:00:00.000Z'
      );
    });

    it('imports movie items correctly', async () => {
      // Arrange
      mockGetAllItems.mockImplementation((_token: string, _clientId: string, type: string) => {
        if (type === 'movies') {
          return Promise.resolve({
            movies: [
              {
                movie: { ids: { simkl: 555 }, title: 'Movie' },
                last_watched_at: '2026-03-01T10:00:00.000Z',
              },
            ],
          });
        }
        return Promise.resolve({});
      });

      // Act
      await runImport('profile-1', 'token', 'client');

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
      mockGetAllItems.mockImplementation((_token: string, _clientId: string, type: string) => {
        if (type === 'shows') {
          return Promise.resolve({
            shows: [
              {
                show: { ids: { imdb: 'tt12345' }, title: 'Show' },
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
      await runImport('profile-1', 'token', 'client');

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
      mockGetAllItems.mockImplementation((_token: string, _clientId: string, type: string) => {
        if (type === 'shows') {
          return Promise.resolve({
            shows: [
              {
                show: { ids: { imdb: 'tt1695360' }, title: 'Gravity Falls' },
                watched_episodes_count: 40,
                last_watched_at: '2026-03-03T12:34:56.000Z',
              },
            ],
          });
        }
        return Promise.resolve({});
      });

      // Act
      await runImport('profile-1', 'token', 'client');

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

    it('clears local history first when clearLocalFirst is true', async () => {
      // Arrange / Act
      await runImport('profile-1', 'token', 'client', undefined, { clearLocalFirst: true });

      // Assert
      expect(mockRemoveProfileWatchHistory).toHaveBeenCalledWith('profile-1');
    });

    it('saves new cursors after successful import', async () => {
      // Arrange / Act
      await runImport('profile-1', 'token', 'client');

      // Assert
      expect(mockUpdateSimklCursors).toHaveBeenCalledWith('profile-1', {
        movies: '2026-01-01T00:00:00.000Z',
        shows: '2026-01-01T00:00:00.000Z',
        anime: '2026-01-01T00:00:00.000Z',
      });
    });

    it('does not throw on error (fail-safe)', async () => {
      // Arrange
      mockGetActivities.mockRejectedValueOnce(new Error('boom'));

      // Act / Assert
      await expect(runImport('profile-1', 'token', 'client')).resolves.toBe(false);
    });
  });

  describe('runExport', () => {
    it('posts completed movies to Simkl (ratio >= 0.9)', async () => {
      // Arrange
      mockListWatchHistory.mockResolvedValueOnce([
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
      await runExport('profile-1', 'token', 'client');

      // Assert
      expect(mockPostHistory).toHaveBeenCalledWith('token', 'client', {
        movies: [{ ids: { simkl: 77, imdb: 'tt77' } }],
        shows: [],
      });
    });

    it('skips items below completion threshold', async () => {
      // Arrange
      mockListWatchHistory.mockResolvedValueOnce([
        {
          id: 'movie-1',
          type: 'movie',
          status: 'watching',
          progressSeconds: 89,
          durationSeconds: 100,
          lastWatchedAt: Date.now(),
        },
      ]);

      // Act
      await runExport('profile-1', 'token', 'client');

      // Assert
      expect(mockResolveSimklIds).not.toHaveBeenCalled();
      expect(mockPostHistory).not.toHaveBeenCalled();
    });

    it('groups show episodes by season correctly', async () => {
      // Arrange
      mockListWatchHistory.mockResolvedValueOnce([
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
      await runExport('profile-1', 'token', 'client');

      // Assert
      expect(mockPostHistory).toHaveBeenCalledWith('token', 'client', {
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
      mockListWatchHistory.mockRejectedValueOnce(new Error('db broken'));

      // Act / Assert
      await expect(runExport('profile-1', 'token', 'client')).resolves.toBe(false);
    });

    it('skips items where resolveSimklIds returns null', async () => {
      // Arrange
      mockListWatchHistory.mockResolvedValueOnce([
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
      await runExport('profile-1', 'token', 'client');

      // Assert
      expect(mockPostHistory).not.toHaveBeenCalled();
    });
  });
});
