import {
  getDeviceCode,
  getLastActivities,
  getUserSettings,
  getWatchedMovies,
  getWatchedShows,
  getWatchedShowsWithSeasons,
  getWatchlistMovies,
  getWatchlistShows,
  pollDeviceToken,
  postHistory,
  postWatchlist,
  refreshToken,
  removeFromHistory,
  removeFromWatchlist,
  TraktAPIError,
} from '../client';
import { traktRateLimiter } from '../rate-limiter';

// Mock the native fetch
global.fetch = jest.fn();

// Mock the rate limiter so we don't actually wait in tests
jest.mock('../rate-limiter', () => ({
  traktRateLimiter: {
    throttlePost: jest.fn().mockResolvedValue(undefined),
    setRetryAfter: jest.fn(),
  },
}));

describe('Trakt Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockResponse = (status: number, data: any = {}, headers: Record<string, string> = {}) => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      headers: {
        get: (key: string) => headers[key] || null,
      },
      json: async () => data,
    });
  };

  it('getDeviceCode calls the correct endpoint', async () => {
    mockResponse(200, { device_code: '123' });
    const result = await getDeviceCode();
    expect(result.device_code).toBe('123');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.trakt.tv/oauth/device/code',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('pollDeviceToken calls the correct endpoint', async () => {
    mockResponse(200, { access_token: 'abc' });
    const result = await pollDeviceToken('dev_123');
    expect(result.access_token).toBe('abc');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.trakt.tv/oauth/device/token',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('handles 204 No Content correctly', async () => {
    mockResponse(204);
    const result = await removeFromHistory('token', { movies: [] });
    expect(result).toEqual({});
  });

  it('throws TraktAPIError on non-2xx status', async () => {
    mockResponse(400, { error: 'Bad Request' });
    await expect(pollDeviceToken('dev_123')).rejects.toThrow(TraktAPIError);
    await expect(pollDeviceToken('dev_123')).rejects.toMatchObject({ status: 400 });
  });

  it('respects Retry-After header on 429', async () => {
    mockResponse(429, {}, { 'Retry-After': '10' });
    await expect(getUserSettings('token')).rejects.toThrow(TraktAPIError);
    expect(traktRateLimiter.setRetryAfter).toHaveBeenCalledWith(10);
  });

  it('calls throttlePost on POST requests', async () => {
    mockResponse(200, {});
    await postHistory('token', { movies: [] });
    expect(traktRateLimiter.throttlePost).toHaveBeenCalled();
  });

  it('does NOT call throttlePost on GET requests', async () => {
    mockResponse(200, {});
    await getLastActivities('token');
    expect(traktRateLimiter.throttlePost).not.toHaveBeenCalled();
  });

  describe('Endpoints', () => {
    it('getUserSettings', async () => {
      mockResponse(200, { user: { username: 'test' } });
      const result = await getUserSettings('token');
      expect(result.user.username).toBe('test');
    });

    it('getLastActivities', async () => {
      mockResponse(200, { movies: { watched_at: 'date' } });
      const result = await getLastActivities('token');
      expect(result.movies?.watched_at).toBe('date');
    });

    it('getWatchedMovies', async () => {
      mockResponse(200, [{ plays: 1 }]);
      const result = await getWatchedMovies('token');
      expect(result).toHaveLength(1);
    });

    it('getWatchedShows', async () => {
      mockResponse(200, [{ plays: 1 }]);
      await getWatchedShows('token');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/sync/watched/shows?extended=noseasons'),
        expect.any(Object)
      );
    });

    it('getWatchedShowsWithSeasons', async () => {
      mockResponse(200, [{ plays: 1 }]);
      await getWatchedShowsWithSeasons('token');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/sync/watched/shows'),
        expect.any(Object)
      );
    });

    it('getWatchlistMovies', async () => {
      mockResponse(200, [{ rank: 1 }]);
      const result = await getWatchlistMovies('token');
      expect(result).toHaveLength(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/sync/watchlist/movies'),
        expect.any(Object)
      );
    });

    it('getWatchlistShows', async () => {
      mockResponse(200, [{ rank: 1 }]);
      const result = await getWatchlistShows('token');
      expect(result).toHaveLength(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/sync/watchlist/shows'),
        expect.any(Object)
      );
    });

    it('postWatchlist', async () => {
      mockResponse(200, { added: { movies: 1 } });
      const result = await postWatchlist('token', { movies: [] });
      expect(result.added.movies).toBe(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/sync/watchlist'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('removeFromWatchlist', async () => {
      mockResponse(200, { deleted: { movies: 1 } });
      const result = await removeFromWatchlist('token', { movies: [] });
      expect(result.deleted?.movies).toBe(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/sync/watchlist/remove'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
});
