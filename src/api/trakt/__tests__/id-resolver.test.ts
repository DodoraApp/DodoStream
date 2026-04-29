import {
  buildTraktIdsFromMetaId,
  getImdbIdFromMetaId,
  getTmdbIdFromMetaId,
  resolveTraktIds,
} from '../id-resolver';

describe('Trakt ID Resolver', () => {
  describe('getImdbIdFromMetaId', () => {
    it('extracts IMDB ID correctly', () => {
      expect(getImdbIdFromMetaId('tt0944947:1:1')).toBe('tt0944947');
      expect(getImdbIdFromMetaId('tt0944947')).toBe('tt0944947');
    });

    it('returns undefined for non-IMDB IDs', () => {
      expect(getImdbIdFromMetaId('tmdb:movie:12345')).toBeUndefined();
      expect(getImdbIdFromMetaId('yt:12345')).toBeUndefined();
    });
  });

  describe('getTmdbIdFromMetaId', () => {
    it('extracts TMDB ID correctly', () => {
      expect(getTmdbIdFromMetaId('tmdb:movie:12345')).toBe('12345');
      expect(getTmdbIdFromMetaId('tmdb:series:54321')).toBe('54321');
    });

    it('returns undefined for non-TMDB IDs', () => {
      expect(getTmdbIdFromMetaId('tt0944947:1:1')).toBeUndefined();
      expect(getTmdbIdFromMetaId('yt:12345')).toBeUndefined();
    });
  });

  describe('buildTraktIdsFromMetaId', () => {
    it('builds TraktIds for IMDB ID', () => {
      const result = buildTraktIdsFromMetaId('tt0944947:1:1');
      expect(result).toEqual({ imdb: 'tt0944947', tmdb: undefined });
    });

    it('builds TraktIds for TMDB ID', () => {
      const result = buildTraktIdsFromMetaId('tmdb:movie:12345');
      expect(result).toEqual({ imdb: undefined, tmdb: 12345 });
    });

    it('returns empty/undefined TraktIds for unknown format', () => {
      const result = buildTraktIdsFromMetaId('yt:12345');
      expect(result).toEqual({ imdb: undefined, tmdb: undefined });
    });
  });

  describe('resolveTraktIds', () => {
    it('prioritizes IMDB ID over TMDB ID', () => {
      const result = resolveTraktIds({ imdb: 'tt1234567', tmdb: 98765 }, 'movie');
      expect(result).toBe('tt1234567');
    });

    it('uses TMDB ID for movies if IMDB is missing', () => {
      const result = resolveTraktIds({ tmdb: 98765 }, 'movie');
      expect(result).toBe('tmdb:movie:98765');
    });

    it('uses TMDB ID for series if IMDB is missing', () => {
      const result = resolveTraktIds({ tmdb: 98765 }, 'series');
      expect(result).toBe('tmdb:series:98765');
    });

    it('returns undefined if neither is present', () => {
      const result = resolveTraktIds({ trakt: 123 }, 'movie');
      expect(result).toBeUndefined();
    });
  });
});
