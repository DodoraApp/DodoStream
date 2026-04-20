import { act } from '@testing-library/react-native';
import { createTestQueryClient, renderHookWithProviders } from '@/utils/test-utils';

import { useInstallAddon, stremioKeys } from '../hooks';

const mockFetchManifest = jest.fn();
jest.mock('../client', () => ({
  fetchManifest: (...args: any[]) => mockFetchManifest(...args),
  fetchCatalogWithPagination: jest.fn(),
  fetchMeta: jest.fn(),
  fetchStreams: jest.fn(),
  fetchCatalog: jest.fn(),
}));

const mockAddAddon = jest.fn();
jest.mock('@/store/addon.store', () => ({
  useAddonStore: jest.fn((selector: any) => selector({ addAddon: mockAddAddon })),
}));

describe('stremio hooks', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  beforeEach(() => {
    mockFetchManifest.mockReset();
    mockAddAddon.mockReset();
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
});
