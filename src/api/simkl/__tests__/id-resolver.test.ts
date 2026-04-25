const mockSearchById = jest.fn();

jest.mock('../client', () => ({
  searchById: (...args: any[]) => mockSearchById(...args),
}));

describe('resolveSimklIds', () => {
  beforeEach(() => {
    jest.resetModules();
    mockSearchById.mockReset();
  });

  it('returns Simkl IDs when searchById finds a result', async () => {
    // Arrange
    const ids = { simkl: 111, imdb: 'tt123' };
    mockSearchById.mockResolvedValueOnce([{ ids }]);

    // Act
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resolveSimklIds } = require('../id-resolver') as typeof import('../id-resolver');
    const result = await resolveSimklIds('meta-1', 'movie');

    // Assert
    expect(result).toEqual(ids);
    expect(mockSearchById).toHaveBeenCalledWith('meta-1');
  });

  it('returns null when searchById returns empty array', async () => {
    // Arrange
    mockSearchById.mockResolvedValueOnce([]);

    // Act
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resolveSimklIds } = require('../id-resolver') as typeof import('../id-resolver');
    const result = await resolveSimklIds('meta-2', 'series');

    // Assert
    expect(result).toBeNull();
  });

  it('caches results and does not call searchById again for same metaId', async () => {
    // Arrange
    const ids = { simkl: 222, imdb: 'tt222' };
    mockSearchById.mockResolvedValueOnce([{ ids }]);

    // Act
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resolveSimklIds } = require('../id-resolver') as typeof import('../id-resolver');
    const first = await resolveSimklIds('cached-meta', 'movie');
    const second = await resolveSimklIds('cached-meta', 'movie');

    // Assert
    expect(first).toEqual(ids);
    expect(second).toEqual(ids);
    expect(mockSearchById).toHaveBeenCalledTimes(1);
  });

  it('returns null and caches null when searchById throws', async () => {
    // Arrange
    mockSearchById.mockRejectedValueOnce(new Error('network down'));

    // Act
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resolveSimklIds } = require('../id-resolver') as typeof import('../id-resolver');
    const first = await resolveSimklIds('error-meta', 'movie');
    const second = await resolveSimklIds('error-meta', 'movie');

    // Assert
    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(mockSearchById).toHaveBeenCalledTimes(1);
  });

  it("handles metaId starting with 'tt' (IMDB format)", async () => {
    // Arrange / Act
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resolveSimklIds } = require('../id-resolver') as typeof import('../id-resolver');
    const result = await resolveSimklIds('tt9999999', 'movie');

    // Assert — IMDB IDs are returned directly without a network lookup
    expect(result).toEqual({ imdb: 'tt9999999' });
    expect(mockSearchById).not.toHaveBeenCalled();
  });
});
