import { upsertMinimalMetaCache } from '@/db/queries/metaCache';
import * as myListQueries from '@/db/queries/myList';
import * as syncQueueQueries from '@/db/queries/syncQueue';
import * as watchHistoryQueries from '@/db/queries/watchHistory';
import { useIntegrationsStore } from '@/store/integrations.store';
import type { TraktSyncCursors } from '@/types/integrations';

import * as client from '../client';
import { runExport, runImport } from '../sync-service';

// Mock dependencies
jest.mock('../client');
jest.mock('@/db/queries/watchHistory');
jest.mock('@/db/queries/myList');
jest.mock('@/db/queries/syncQueue');
jest.mock('@/db/queries/metaCache');

const mockGetLastActivities = client.getLastActivities as jest.Mock;
const mockGetWatchedMovies = client.getWatchedMovies as jest.Mock;
const mockGetWatchedShowsWithSeasons = client.getWatchedShowsWithSeasons as jest.Mock;
const mockPostHistory = client.postHistory as jest.Mock;
const mockRemoveFromHistory = client.removeFromHistory as jest.Mock;

const mockGetWatchlistMovies = client.getWatchlistMovies as jest.Mock;
const mockGetWatchlistShows = client.getWatchlistShows as jest.Mock;
const mockPostWatchlist = client.postWatchlist as jest.Mock;
const mockRemoveFromWatchlist = client.removeFromWatchlist as jest.Mock;

const mockUpsertWatchProgress = watchHistoryQueries.upsertWatchProgress as jest.Mock;
const mockListWatchHistory = watchHistoryQueries.listWatchHistoryForProfile as jest.Mock;
const mockRemoveWatchHistoryItem = watchHistoryQueries.removeWatchHistoryItem as jest.Mock;
const mockListExportableWatchHistory =
  watchHistoryQueries.listExportableWatchHistoryForProfile as jest.Mock;
const mockListExportableMyList = myListQueries.listExportableMyListForProfile as jest.Mock;
const mockAddToMyList = myListQueries.addToMyList as jest.Mock;
const mockRemoveFromMyList = myListQueries.removeFromMyList as jest.Mock;
const mockListSyncQueue = syncQueueQueries.listSyncQueueForProvider as jest.Mock;
const mockDeleteFromSyncQueue = syncQueueQueries.deleteFromSyncQueue as jest.Mock;
const mockUpsertMinimalMetaCache = upsertMinimalMetaCache as jest.Mock;

describe('Trakt Sync Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListWatchHistory.mockResolvedValue([]);
    mockListExportableMyList.mockResolvedValue([]);
    useIntegrationsStore.setState({
      settings: {
        profile1: {
          trakt: {
            syncMode: 'full',
            connection: {
              accessToken: 'token',
              refreshToken: 'refresh',
              expiresAt: 0,
              userId: 'user',
              username: 'user',
              syncCursors: {},
            },
          },
        },
      },
      lastSyncAt: {},
    });
  });

  describe('runImport', () => {
    it('skips import if no activities have changed', async () => {
      mockGetLastActivities.mockResolvedValue({
        movies: { watched_at: '2023-01-01T00:00:00.000Z' },
      });

      // Providing a newer local cursor
      await runImport('profile1', 'token', {
        movies: { watched_at: '2023-01-02T00:00:00.000Z' },
      });

      expect(mockGetWatchedMovies).not.toHaveBeenCalled();
    });

    it('syncs movies if remote cursor is newer', async () => {
      mockGetLastActivities.mockResolvedValue({
        movies: { watched_at: '2023-01-02T00:00:00.000Z' },
      });
      mockGetWatchedMovies.mockResolvedValue([
        {
          movie: { ids: { imdb: 'tt123' }, title: 'Movie 1', year: 2023 },
          last_watched_at: '2023-01-02T00:00:00.000Z',
        },
      ]);

      // Providing an older local cursor
      await runImport('profile1', 'token', {
        movies: { watched_at: '2023-01-01T00:00:00.000Z' },
      });

      expect(mockGetWatchedMovies).toHaveBeenCalled();
      expect(mockUpsertWatchProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          metaId: 'tt123',
          type: 'movie',
          source: 'trakt',
          progressSeconds: 100,
        })
      );

      expect(mockUpsertMinimalMetaCache).toHaveBeenCalledWith(
        expect.objectContaining({
          metaId: 'tt123',
          name: 'Movie 1',
          poster: undefined, // no images in mock yet
        })
      );
    });

    it('populates meta cache with posters if available', async () => {
      mockGetLastActivities.mockResolvedValue({
        movies: { watched_at: '2023-01-02T00:00:00.000Z' },
      });
      mockGetWatchedMovies.mockResolvedValue([
        {
          movie: {
            ids: { imdb: 'tt-poster' },
            title: 'Movie Poster',
            year: 2023,
            images: {
              poster: ['walter.trakt.tv/poster.jpg'],
            },
          },
          last_watched_at: '2023-01-02T00:00:00.000Z',
        },
      ]);

      await runImport('profile1', 'token', {
        movies: { watched_at: '2023-01-01T00:00:00.000Z' },
      });

      expect(mockUpsertMinimalMetaCache).toHaveBeenCalledWith(
        expect.objectContaining({
          metaId: 'tt-poster',
          poster: 'https://walter.trakt.tv/poster.jpg',
        })
      );
    });

    it('syncs shows if remote cursor is newer', async () => {
      mockGetLastActivities.mockResolvedValue({
        episodes: { watched_at: '2023-01-02T00:00:00.000Z' },
      });
      mockGetWatchedShowsWithSeasons.mockResolvedValue([
        {
          show: { ids: { tmdb: 456 }, title: 'Show 1', year: 2023 },
          seasons: [
            {
              number: 1,
              episodes: [{ number: 2, last_watched_at: '2023-01-02T00:00:00.000Z' }],
            },
          ],
        },
      ]);

      await runImport('profile1', 'token', {
        episodes: { watched_at: '2023-01-01T00:00:00.000Z' },
      });

      expect(mockGetWatchedShowsWithSeasons).toHaveBeenCalled();
      expect(mockUpsertWatchProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          metaId: 'tmdb:series:456',
          videoId: 'tmdb:series:456:1:2',
          type: 'series',
          source: 'trakt',
        })
      );
    });

    it('syncs watchlist if remote cursor is newer', async () => {
      mockGetLastActivities.mockResolvedValue({
        watchlist: { updated_at: '2023-01-02T00:00:00.000Z' },
      });
      mockGetWatchlistMovies.mockResolvedValue([
        { movie: { ids: { imdb: 'tt123' }, title: 'Movie 1', year: 2023 } },
      ]);
      mockGetWatchlistShows.mockResolvedValue([]);

      await runImport('profile1', 'token', {
        watchlist: { updated_at: '2023-01-01T00:00:00.000Z' },
      });

      expect(mockGetWatchlistMovies).toHaveBeenCalled();
      expect(mockAddToMyList).toHaveBeenCalledWith(
        'profile1',
        'tt123',
        'movie',
        undefined,
        'trakt'
      );
    });

    it('passes listed_at as addedAt when available', async () => {
      mockGetLastActivities.mockResolvedValue({
        watchlist: { updated_at: '2023-01-02T00:00:00.000Z' },
      });
      mockGetWatchlistMovies.mockResolvedValue([
        {
          movie: { ids: { imdb: 'tt456' }, title: 'Movie 2', year: 2024 },
          listed_at: '2023-06-15T12:00:00.000Z',
        },
      ]);
      mockGetWatchlistShows.mockResolvedValue([]);

      await runImport('profile1', 'token', {
        watchlist: { updated_at: '2023-01-01T00:00:00.000Z' },
      });

      expect(mockAddToMyList).toHaveBeenCalledWith(
        'profile1',
        'tt456',
        'movie',
        new Date('2023-06-15T12:00:00.000Z').getTime(),
        'trakt'
      );
    });

    it('uses provided activities snapshot instead of calling getLastActivities', async () => {
      const snapshot: TraktSyncCursors = {
        watchlist: { updated_at: '2023-01-02T00:00:00.000Z' },
      };
      mockGetWatchlistMovies.mockResolvedValue([
        {
          movie: { ids: { imdb: 'tt789' }, title: 'Movie 3', year: 2023 },
          listed_at: '2023-01-01T00:00:00.000Z',
        },
      ]);
      mockGetWatchlistShows.mockResolvedValue([]);

      await runImport(
        'profile1',
        'token',
        {
          watchlist: { updated_at: '2023-01-01T00:00:00.000Z' },
        },
        {
          activities: snapshot,
        }
      );

      expect(mockGetLastActivities).not.toHaveBeenCalled();
      expect(mockGetWatchlistMovies).toHaveBeenCalled();
      expect(mockAddToMyList).toHaveBeenCalledWith(
        'profile1',
        'tt789',
        'movie',
        new Date('2023-01-01T00:00:00.000Z').getTime(),
        'trakt'
      );
    });
  });

  describe('runExport', () => {
    beforeEach(() => {
      mockListExportableMyList.mockResolvedValue([]);
    });

    it('exports offline removals from syncQueue', async () => {
      mockListSyncQueue.mockResolvedValue([
        {
          id: 1,
          action: 'remove_history',
          type: 'movie',
          metaId: 'tt123',
          createdAt: 9999999999999,
        },
        {
          id: 2,
          action: 'remove_watchlist',
          type: 'series',
          metaId: 'tt456',
          createdAt: 9999999999999,
        },
      ]);
      mockListExportableWatchHistory.mockResolvedValue([]);

      await runExport('profile1', 'token');

      expect(mockRemoveFromHistory).toHaveBeenCalledWith('token', {
        movies: [{ ids: { imdb: 'tt123', tmdb: undefined } }],
        shows: [],
      });
      expect(mockRemoveFromWatchlist).toHaveBeenCalledWith('token', {
        movies: [],
        shows: [{ ids: { imdb: 'tt456', tmdb: undefined } }],
      });
      expect(mockDeleteFromSyncQueue).toHaveBeenCalledWith([1, 2]);
    });

    it('exports new watch history items', async () => {
      mockListSyncQueue.mockResolvedValue([]);
      mockListExportableWatchHistory.mockResolvedValue([
        { id: 'tt123', type: 'movie', lastWatchedAt: 1672531200000 },
        {
          id: 'tmdb:series:456',
          videoId: 'tmdb:series:456:1:2',
          type: 'series',
          lastWatchedAt: 1672531200000,
        },
      ]);

      await runExport('profile1', 'token');

      expect(mockPostHistory).toHaveBeenCalledWith('token', {
        movies: [
          { ids: { imdb: 'tt123', tmdb: undefined }, watched_at: '2023-01-01T00:00:00.000Z' },
        ],
        episodes: [],
        shows: [
          {
            ids: { imdb: undefined, tmdb: 456 },
            seasons: [
              { number: 1, episodes: [{ number: 2, watched_at: '2023-01-01T00:00:00.000Z' }] },
            ],
          },
        ],
      });
    });

    it('exports new watchlist items', async () => {
      mockListSyncQueue.mockResolvedValue([]);
      mockListExportableWatchHistory.mockResolvedValue([]);
      mockListExportableMyList.mockResolvedValue([
        { id: 'tt123', type: 'movie' },
        { id: 'tmdb:series:456', type: 'series' },
      ]);

      await runExport('profile1', 'token');

      expect(mockPostWatchlist).toHaveBeenCalledWith('token', {
        movies: [{ ids: { imdb: 'tt123', tmdb: undefined } }],
        shows: [{ ids: { imdb: undefined, tmdb: 456 } }],
      });
    });
  });
});
