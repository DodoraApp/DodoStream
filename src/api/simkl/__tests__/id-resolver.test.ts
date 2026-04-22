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
    const result = await resolveSimklIds('meta-1', 'movie', 'client-1');

    // Assert
    expect(result).toEqual(ids);
    expect(mockSearchById).toHaveBeenCalledWith('client-1', 'meta-1');
  });

  it('returns null when searchById returns empty array', async () => {
    // Arrange
    mockSearchById.mockResolvedValueOnce([]);

    // Act
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resolveSimklIds } = require('../id-resolver') as typeof import('../id-resolver');
    const result = await resolveSimklIds('meta-2', 'series', 'client-1');

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
    const first = await resolveSimklIds('cached-meta', 'movie', 'client-1');
    const second = await resolveSimklIds('cached-meta', 'movie', 'client-1');

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
    const first = await resolveSimklIds('error-meta', 'movie', 'client-1');
    const second = await resolveSimklIds('error-meta', 'movie', 'client-1');

    // Assert
    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(mockSearchById).toHaveBeenCalledTimes(1);
  });

  it("handles metaId starting with 'tt' (IMDB format)", async () => {
    // Arrange
    const ids = { simkl: 333, imdb: 'tt9999999' };
    mockSearchById.mockResolvedValueOnce([{ ids }]);

    // Act
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resolveSimklIds } = require('../id-resolver') as typeof import('../id-resolver');
    const result = await resolveSimklIds('tt9999999', 'movie', 'client-1');

    // Assert
    expect(result).toEqual(ids);
    expect(mockSearchById).toHaveBeenCalledWith('client-1', 'tt9999999');
  });
});
