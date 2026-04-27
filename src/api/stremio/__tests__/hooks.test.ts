import { act, waitFor } from '@testing-library/react-native';
import { createTestQueryClient, renderHookWithProviders } from '@/utils/test-utils';
import { watchHistoryKeys } from '@/hooks/useWatchHistoryDb';

import { useInstallAddon, useMeta, stremioKeys } from '../hooks';

const mockFetchManifest = jest.fn();
const mockFetchMeta = jest.fn();
jest.mock('../client', () => ({
  fetchManifest: (...args: any[]) => mockFetchManifest(...args),
  fetchCatalogWithPagination: jest.fn(),
  fetchMeta: (...args: any[]) => mockFetchMeta(...args),
  fetchStreams: jest.fn(),
  fetchCatalog: jest.fn(),
}));

const mockAddAddon = jest.fn();
const mockGetAddonsList = jest.fn();
jest.mock('@/store/addon.store', () => ({
  useAddonStore: jest.fn((selector: any) =>
    selector({
      addAddon: mockAddAddon,
      configsByProfile: { 'profile-1': { 'addon.id': { isActive: true, useCatalogsOnHome: true, useCatalogsInSearch: true, useForSubtitles: true } } },
      getAddonsList: mockGetAddonsList,
    })
  ),
}));

const mockUseProfileStore = jest.fn();
jest.mock('@/store/profile.store', () => ({
  useProfileStore: (selector: any) => mockUseProfileStore(selector),
}));

const mockUpsertMetaCache = jest.fn();
jest.mock('@/db', () => ({
  upsertMetaCache: (...args: any[]) => mockUpsertMetaCache(...args),
}));

describe('stremio hooks', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  beforeEach(() => {
    mockFetchManifest.mockReset();
    mockFetchMeta.mockReset();
    mockAddAddon.mockReset();
    mockGetAddonsList.mockReset();
    mockUseProfileStore.mockReset();
    mockUpsertMetaCache.mockReset();

    mockUseProfileStore.mockImplementation((selector: any) =>
      selector({ activeProfileId: 'profile-1' })
    );

    mockGetAddonsList.mockReturnValue([
      {
        id: 'addon.id',
        manifestUrl: 'https://example.com/manifest.json',
        manifest: {
          id: 'addon.id',
          name: 'Addon',
          types: ['series', 'movie'],
          resources: ['meta'],
        },
      },
    ]);
  });

  afterEach(() => {
    // React Query schedules notifications; ensure timers are fully flushed.
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('useInstallAddon installs manifest and invalidates manifest queries', async () => {
    // Arrange
    const manifestUrl = 'https://example.com/manifest.json';
    const manifest = { id: 'addon.id', name: 'Addon', types: [], resources: [] };
    mockFetchManifest.mockResolvedValueOnce(manifest);

    const queryClient = createTestQueryClient();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHookWithProviders(() => useInstallAddon(), { queryClient });

    // Act
    await act(async () => {
      await result.current.mutateAsync(manifestUrl);
    });

    // React Query's notifyManager may schedule async notifications.
    act(() => {
      jest.runOnlyPendingTimers();
    });

    // Assert
    expect(mockFetchManifest).toHaveBeenCalledWith(manifestUrl);
    expect(mockAddAddon).toHaveBeenCalledWith(
      'addon.id',
      manifestUrl,
      expect.objectContaining({ id: 'addon.id' })
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: stremioKeys.manifests() });
  });

  it('useMeta invalidates watch-history queries after meta cache upsert succeeds', async () => {
    // Arrange
    mockFetchMeta.mockResolvedValueOnce({
      meta: {
        id: 'tt123',
        videos: [],
      },
    });
    mockUpsertMetaCache.mockResolvedValueOnce(undefined);

    const queryClient = createTestQueryClient();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    // Act
    const { result } = renderHookWithProviders(() => useMeta('series', 'tt123', true), {
      queryClient,
    });

    await waitFor(() => {
      expect(result.current.data?.id).toBe('tt123');
    });

    await waitFor(() => {
      expect(mockUpsertMetaCache).toHaveBeenCalledWith(expect.objectContaining({ id: 'tt123' }));
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: watchHistoryKeys.continueWatching('profile-1'),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: watchHistoryKeys.metaSummaries('profile-1'),
      });
    });
  });
});
