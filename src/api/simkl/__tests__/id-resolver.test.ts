const mockGetExternalIdsForMetaId = jest.fn();

jest.mock('@/db/queries/idMapping', () => ({
  getExternalIdsForMetaId: (...args: unknown[]) => mockGetExternalIdsForMetaId(...args),
}));

describe('resolveSimklIds', () => {
  beforeEach(() => {
    jest.resetModules();
    mockGetExternalIdsForMetaId.mockReset().mockResolvedValue(null);
  });

  it("handles metaId starting with 'tt' (IMDB format)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resolveSimklIds } = require('../id-resolver') as typeof import('../id-resolver');
    const result = await resolveSimklIds('tt9999999', 'movie');

    // IMDB IDs are returned directly without a DB or network lookup
    expect(result).toEqual({ imdb: 'tt9999999' });
    expect(mockGetExternalIdsForMetaId).not.toHaveBeenCalled();
  });

  it('handles numeric Simkl IDs', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resolveSimklIds } = require('../id-resolver') as typeof import('../id-resolver');
    const result = await resolveSimklIds('53536', 'movie');

    expect(result).toEqual({ simkl: 53536 });
    expect(mockGetExternalIdsForMetaId).not.toHaveBeenCalled();
  });

  it('handles TMDB metaIds (tmdb:type:id)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resolveSimklIds } = require('../id-resolver') as typeof import('../id-resolver');
    const movie = await resolveSimklIds('tmdb:movie:27205', 'movie');
    const series = await resolveSimklIds('tmdb:show:1399', 'series');

    expect(movie).toEqual({ tmdb: 27205 });
    expect(series).toEqual({ tmdb: 1399 });
    expect(mockGetExternalIdsForMetaId).not.toHaveBeenCalled();
  });

  it('handles anime metaIds (kitsu/mal/tvdb) without a network lookup', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resolveSimklIds } = require('../id-resolver') as typeof import('../id-resolver');
    const kitsu = await resolveSimklIds('kitsu:5081', 'series');
    const mal = await resolveSimklIds('mal:16498', 'series');
    const tvdb = await resolveSimklIds('tvdb:121361', 'series');

    expect(kitsu).toEqual({ kitsu: 5081 });
    expect(mal).toEqual({ mal: 16498 });
    expect(tvdb).toEqual({ tvdb: 121361 });
    expect(mockGetExternalIdsForMetaId).not.toHaveBeenCalled();
  });

  it('returns existing IDs from DB without API call', async () => {
    mockGetExternalIdsForMetaId.mockResolvedValue({
      simklId: '333',
      imdbId: 'tt333',
      tmdbId: null,
      tvdbId: null,
      kitsuId: null,
      anilistId: null,
      malId: null,
    });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resolveSimklIds } = require('../id-resolver') as typeof import('../id-resolver');
    const result = await resolveSimklIds('db-known', 'movie');

    expect(result).toEqual({ simkl: 333, imdb: 'tt333' });
    expect(mockGetExternalIdsForMetaId).toHaveBeenCalledWith('db-known');
  });

  it('builds anime IDs from DB mappings (kitsu, mal)', async () => {
    mockGetExternalIdsForMetaId.mockResolvedValue({
      simklId: null,
      imdbId: null,
      tmdbId: null,
      tvdbId: null,
      kitsuId: '5081',
      anilistId: null,
      malId: '16498',
    });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resolveSimklIds } = require('../id-resolver') as typeof import('../id-resolver');
    const result = await resolveSimklIds('db-anime', 'series');

    expect(result).toEqual({ kitsu: 5081, mal: 16498 });
  });

  it('returns null when the metaId has no resolvable ID and no DB mapping', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resolveSimklIds } = require('../id-resolver') as typeof import('../id-resolver');
    const result = await resolveSimklIds('unknown:totally-fake-id-xyz', 'movie');

    expect(result).toBeNull();
    expect(mockGetExternalIdsForMetaId).toHaveBeenCalledWith('unknown:totally-fake-id-xyz');
  });

  it('returns null when DB lookup yields no usable IDs', async () => {
    mockGetExternalIdsForMetaId.mockResolvedValue({
      simklId: null,
      imdbId: null,
      tmdbId: null,
      tvdbId: null,
      kitsuId: null,
      anilistId: null,
      malId: null,
    });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resolveSimklIds } = require('../id-resolver') as typeof import('../id-resolver');
    const result = await resolveSimklIds('db-empty', 'movie');

    expect(result).toBeNull();
  });
});
