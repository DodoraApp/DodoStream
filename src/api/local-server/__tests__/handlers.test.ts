import {
  deleteAddon,
  getProfileAddons,
  getProfiles,
  installAddon,
  patchProfileAddon,
  reorderProfileAddons,
} from '../handlers';

import { useAddonStore } from '@/store/addon.store';
import { type AddonConfig } from '@/types/addon-config';
import { useProfileStore } from '@/store/profile.store';

jest.mock('@/store/addon.store', () => ({
  useAddonStore: {
    getState: jest.fn(),
  },
}));

jest.mock('@/store/profile.store', () => ({
  useProfileStore: {
    getState: jest.fn(),
  },
}));


interface MockProfile {
  id: string;
  name: string;
  avatarIcon: string;
  avatarColor: string;
}

interface MockInstalledAddon {
  id: string;
  manifestUrl: string;
  manifest: {
    id: string;
    name: string;
    version: string;
    description?: string;
  };
}

const mockUseProfileStore = useProfileStore as jest.Mocked<typeof useProfileStore>;
const mockUseAddonStore = useAddonStore as jest.Mocked<typeof useAddonStore>;

const defaultConfig: AddonConfig = {
  isActive: true,
  useCatalogsOnHome: true,
  useCatalogsInSearch: true,
  useForSubtitles: true,
};

function createAddonStoreState(overrides?: {
  orderedAddons?: MockInstalledAddon[];
  configByAddonId?: Record<string, AddonConfig | undefined>;
}) {
  const orderedAddons = overrides?.orderedAddons ?? [];
  const configByAddonId = overrides?.configByAddonId ?? {};

  const addAddon = jest.fn();
  const removeAddon = jest.fn();
  const activateAddon = jest.fn((addonId: string) => {
    const cfg = configByAddonId[addonId];
    if (cfg) {
      configByAddonId[addonId] = { ...cfg, isActive: true };
    }
  });
  const deactivateAddon = jest.fn((addonId: string) => {
    const cfg = configByAddonId[addonId];
    if (cfg) {
      configByAddonId[addonId] = { ...cfg, isActive: false };
    }
  });
  const reorderAddon = jest.fn((fromIndex: number, toIndex: number) => {
    const [moved] = orderedAddons.splice(fromIndex, 1);
    orderedAddons.splice(toIndex, 0, moved);
  });
  const toggleUseCatalogsOnHome = jest.fn((addonId: string) => {
    const cfg = configByAddonId[addonId];
    if (cfg) {
      configByAddonId[addonId] = { ...cfg, useCatalogsOnHome: !cfg.useCatalogsOnHome };
    }
  });
  const toggleUseCatalogsInSearch = jest.fn((addonId: string) => {
    const cfg = configByAddonId[addonId];
    if (cfg) {
      configByAddonId[addonId] = { ...cfg, useCatalogsInSearch: !cfg.useCatalogsInSearch };
    }
  });
  const toggleUseForSubtitles = jest.fn((addonId: string) => {
    const cfg = configByAddonId[addonId];
    if (cfg) {
      configByAddonId[addonId] = { ...cfg, useForSubtitles: !cfg.useForSubtitles };
    }
  });
  const getAddonConfig = jest.fn((addonId: string) => configByAddonId[addonId]);
  const setAddonConfig = jest.fn((addonId: string, config: Partial<AddonConfig>) => {
    const existing = configByAddonId[addonId] ?? defaultConfig;
    configByAddonId[addonId] = { ...existing, ...config };
  });
  const getOrderedAddonsList = jest.fn(() => orderedAddons);
  return {
    addons: {},
    configsByProfile: {},
    addonOrderByProfile: {},
    addAddon,
    removeAddon,
    activateAddon,
    deactivateAddon,
    reorderAddon,
    toggleUseCatalogsOnHome,
    toggleUseCatalogsInSearch,
    toggleUseForSubtitles,
    getAddonConfig,
    setAddonConfig,
    getOrderedAddonsList,
  };
}

function setProfiles(profiles: Record<string, MockProfile>) {
  mockUseProfileStore.getState.mockReturnValue({ profiles } as never);
}

describe('local server handlers', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('getProfiles', () => {
    it('returns 200 with mapped profile list', () => {
      // Arrange
      setProfiles({
        p1: { id: 'p1', name: 'Alice', avatarIcon: 'person', avatarColor: 'blue' },
        p2: { id: 'p2', name: 'Bob', avatarIcon: 'robot', avatarColor: 'red' },
      });

      // Act
      const result = getProfiles();

      // Assert
      expect(result).toEqual({
        status: 200,
        body: [
          {
            id: 'p1',
            name: 'Alice',
            color: 'blue',
          },
          {
            id: 'p2',
            name: 'Bob',
            color: 'red',
          },
        ],
      });
    });

    it('returns 200 with empty array when no profiles', () => {
      // Arrange
      setProfiles({});

      // Act
      const result = getProfiles();

      // Assert
      expect(result).toEqual({ status: 200, body: [] });
    });
  });

  describe('getProfileAddons', () => {
    it('returns 404 when profile not found', () => {
      // Arrange
      setProfiles({});

      // Act
      const result = getProfileAddons('missing-profile');

      // Assert
      expect(result).toEqual({ status: 404, body: { error: 'Profile not found' } });
    });

    it('returns 200 with addon list including config', () => {
      // Arrange
      setProfiles({ p1: { id: 'p1', name: 'Alice', avatarIcon: 'person', avatarColor: 'blue' } });

      const addonStore = createAddonStoreState({
        orderedAddons: [
          {
            id: 'addon.one',
            manifestUrl: 'https://example.com/one/manifest.json',
            manifest: {
              id: 'addon.one',
              name: 'Addon One',
              version: '1.2.3',
              description: 'First addon',
            },
          },
        ],
        configByAddonId: {
          'addon.one': { ...defaultConfig, useCatalogsOnHome: false },
        },
      });
      mockUseAddonStore.getState.mockReturnValue(addonStore as never);

      // Act
      const result = getProfileAddons('p1');

      // Assert
      expect(result).toEqual({
        status: 200,
        body: [
          {
            id: 'addon.one',
            name: 'Addon One',
            version: '1.2.3',
            description: 'First addon',
            manifestUrl: 'https://example.com/one/manifest.json',
            config: {
              isActive: true,
              useCatalogsOnHome: false,
              useCatalogsInSearch: true,
              useForSubtitles: true,
            },
            configurable: false
          },
        ],
      });
    });

    it('returns 200 with empty array when profile has no addons', () => {
      // Arrange
      setProfiles({ p1: { id: 'p1', name: 'Alice', avatarIcon: 'person', avatarColor: 'blue' } });
      const addonStore = createAddonStoreState();
      mockUseAddonStore.getState.mockReturnValue(addonStore as never);

      // Act
      const result = getProfileAddons('p1');

      // Assert
      expect(result).toEqual({ status: 200, body: [] });
    });
  });

  describe('installAddon', () => {
    it('returns 400 when manifestUrl is missing', async () => {
      // Act
      const result = await installAddon({});

      // Assert
      expect(result).toEqual({ status: 400, body: { error: 'manifestUrl is required' } });
    });

    it('returns 400 when manifestUrl is not a string', async () => {
      // Act
      const result = await installAddon({ manifestUrl: 123 });

      // Assert
      expect(result).toEqual({ status: 400, body: { error: 'manifestUrl is required' } });
    });

    it('returns 400 when fetch fails with network error', async () => {
      // Arrange
      const fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('network failed'));

      // Act
      const result = await installAddon({ manifestUrl: 'https://example.com/manifest.json' });

      // Assert
      expect(result).toEqual({ status: 400, body: { error: 'Failed to fetch manifest' } });
      fetchSpy.mockRestore();
    });

    it('returns 400 when response is not ok', async () => {
      // Arrange
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      // Act
      const result = await installAddon({ manifestUrl: 'https://example.com/missing.json' });

      // Assert
      expect(result).toEqual({
        status: 400,
        body: { error: 'Failed to fetch manifest (404)' },
      });
      fetchSpy.mockRestore();
    });

    it('returns 400 when manifest is missing required fields', async () => {
      // Arrange
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'addon.invalid' }),
      } as Response);

      // Act
      const result = await installAddon({ manifestUrl: 'https://example.com/manifest.json' });

      // Assert
      expect(result).toEqual({
        status: 400,
        body: { error: 'Invalid manifest: missing required fields' },
      });
      fetchSpy.mockRestore();
    });

    it('returns 200 with id and calls addAddon when manifest is valid', async () => {
      // Arrange
      const addonStore = createAddonStoreState();
      mockUseAddonStore.getState.mockReturnValue(addonStore as never);

      const manifest = {
        id: 'addon.valid',
        name: 'Valid Addon',
        version: '1.0.0',
      };
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => manifest,
      } as Response);

      // Act
      const result = await installAddon({ manifestUrl: 'https://example.com/manifest.json' });

      // Assert
      expect(result).toEqual({ status: 200, body: { id: 'addon.valid' } });
      expect(addonStore.addAddon).toHaveBeenCalledWith(
        'addon.valid',
        'https://example.com/manifest.json',
        manifest
      );
      fetchSpy.mockRestore();
    });
  });

  describe('deleteAddon', () => {
    it('calls removeAddon with decoded addonId and returns 204', () => {
      // Arrange
      const addonStore = createAddonStoreState();
      mockUseAddonStore.getState.mockReturnValue(addonStore as never);

      // Act
      const result = deleteAddon('my%2Faddon');

      // Assert
      expect(addonStore.removeAddon).toHaveBeenCalledWith('my%2Faddon');
      expect(result).toEqual({ status: 204 });
    });
  });

  describe('patchProfileAddon', () => {
    it('returns 404 when profile not found', () => {
      // Arrange
      setProfiles({});

      // Act
      const result = patchProfileAddon('missing-profile', 'addon.one', {});

      // Assert
      expect(result).toEqual({ status: 404, body: { error: 'Profile not found' } });
    });

    it('returns 200 with no-op when body is empty', () => {
      // Arrange
      setProfiles({ p1: { id: 'p1', name: 'Alice', avatarIcon: 'person', avatarColor: 'blue' } });
      const addonStore = createAddonStoreState({
        configByAddonId: {
          'addon.one': { ...defaultConfig },
        },
      });
      mockUseAddonStore.getState.mockReturnValue(addonStore as never);

      // Act
      const result = patchProfileAddon('p1', 'addon.one', {});

      // Assert
      expect(addonStore.setAddonConfig).not.toHaveBeenCalled();
      expect(result).toEqual({ status: 200, body: { ok: true } });
    });

    it('calls setAddonConfig with isActive: true', () => {
      // Arrange
      setProfiles({ p1: { id: 'p1', name: 'Alice', avatarIcon: 'person', avatarColor: 'blue' } });
      const addonStore = createAddonStoreState({
        configByAddonId: {
          'addon.one': { ...defaultConfig, isActive: false },
        },
      });
      mockUseAddonStore.getState.mockReturnValue(addonStore as never);

      // Act
      const result = patchProfileAddon('p1', 'addon.one', { isActive: true });

      // Assert
      expect(addonStore.setAddonConfig).toHaveBeenCalledWith(
        'addon.one',
        { isActive: true },
        'p1',
      );
      expect(result).toEqual({ status: 200, body: { ok: true } });
    });

    it('calls setAddonConfig with isActive: false when config exists', () => {
      // Arrange
      setProfiles({ p1: { id: 'p1', name: 'Alice', avatarIcon: 'person', avatarColor: 'blue' } });
      const addonStore = createAddonStoreState({
        configByAddonId: {
          'addon.one': { ...defaultConfig, isActive: true },
        },
      });
      mockUseAddonStore.getState.mockReturnValue(addonStore as never);

      // Act
      const result = patchProfileAddon('p1', 'addon.one', { isActive: false });

      // Assert
      expect(addonStore.setAddonConfig).toHaveBeenCalledWith(
        'addon.one',
        { isActive: false },
        'p1',
      );
      expect(result).toEqual({ status: 200, body: { ok: true } });
    });

    it('returns 404 when deactivating and no config exists', () => {
      // Arrange
      setProfiles({ p1: { id: 'p1', name: 'Alice', avatarIcon: 'person', avatarColor: 'blue' } });
      const addonStore = createAddonStoreState({
        configByAddonId: { 'addon.one': undefined },
      });
      mockUseAddonStore.getState.mockReturnValue(addonStore as never);

      // Act
      const result = patchProfileAddon('p1', 'addon.one', { isActive: false });

      // Assert
      expect(addonStore.setAddonConfig).not.toHaveBeenCalled();
      expect(result).toEqual({ status: 404, body: { error: 'Addon config not found' } });
    });

    it('calls setAddonConfig with useCatalogsOnHome', () => {
      // Arrange
      setProfiles({ p1: { id: 'p1', name: 'Alice', avatarIcon: 'person', avatarColor: 'blue' } });
      const addonStore = createAddonStoreState({
        configByAddonId: {
          'addon.one': { ...defaultConfig, useCatalogsOnHome: true },
        },
      });
      mockUseAddonStore.getState.mockReturnValue(addonStore as never);

      // Act
      patchProfileAddon('p1', 'addon.one', { useCatalogsOnHome: false });

      // Assert
      expect(addonStore.setAddonConfig).toHaveBeenCalledWith(
        'addon.one',
        { useCatalogsOnHome: false },
        'p1',
      );
    });

    it('calls setAddonConfig with useCatalogsInSearch', () => {
      // Arrange
      setProfiles({ p1: { id: 'p1', name: 'Alice', avatarIcon: 'person', avatarColor: 'blue' } });
      const addonStore = createAddonStoreState({
        configByAddonId: {
          'addon.one': { ...defaultConfig, useCatalogsInSearch: false },
        },
      });
      mockUseAddonStore.getState.mockReturnValue(addonStore as never);

      // Act
      patchProfileAddon('p1', 'addon.one', { useCatalogsInSearch: true });

      // Assert
      expect(addonStore.setAddonConfig).toHaveBeenCalledWith(
        'addon.one',
        { useCatalogsInSearch: true },
        'p1',
      );
    });

    it('calls setAddonConfig with useForSubtitles', () => {
      // Arrange
      setProfiles({ p1: { id: 'p1', name: 'Alice', avatarIcon: 'person', avatarColor: 'blue' } });
      const addonStore = createAddonStoreState({
        configByAddonId: {
          'addon.one': { ...defaultConfig, useForSubtitles: false },
        },
      });
      mockUseAddonStore.getState.mockReturnValue(addonStore as never);

      // Act
      const result = patchProfileAddon('p1', 'addon.one', { useForSubtitles: true });

      // Assert
      expect(addonStore.setAddonConfig).toHaveBeenCalledWith(
        'addon.one',
        { useForSubtitles: true },
        'p1',
      );
      expect(result).toEqual({ status: 200, body: { ok: true } });
    });

    it('calls setAddonConfig with multiple fields at once', () => {
      // Arrange
      setProfiles({ p1: { id: 'p1', name: 'Alice', avatarIcon: 'person', avatarColor: 'blue' } });
      const addonStore = createAddonStoreState({
        configByAddonId: {
          'addon.one': { ...defaultConfig },
        },
      });
      mockUseAddonStore.getState.mockReturnValue(addonStore as never);

      // Act
      patchProfileAddon('p1', 'addon.one', {
        isActive: false,
        useCatalogsOnHome: false,
        useForSubtitles: false,
      });

      // Assert
      expect(addonStore.setAddonConfig).toHaveBeenCalledWith(
        'addon.one',
        {
          isActive: false,
          useCatalogsOnHome: false,
          useForSubtitles: false,
        },
        'p1',
      );
    });
  });

  describe('reorderProfileAddons', () => {
    it('returns 404 when profile not found', () => {
      // Arrange
      setProfiles({});

      // Act
      const result = reorderProfileAddons('missing-profile', { orderedIds: [] });

      // Assert
      expect(result).toEqual({ status: 404, body: { error: 'Profile not found' } });
    });

    it('returns 400 when orderedIds is not an array', () => {
      // Arrange
      setProfiles({ p1: { id: 'p1', name: 'Alice', avatarIcon: 'person', avatarColor: 'blue' } });

      // Act
      const result = reorderProfileAddons('p1', { orderedIds: 'not-an-array' });

      // Assert
      expect(result).toEqual({ status: 400, body: { error: 'orderedIds must be an array of strings' } });
    });

    it('calls reorderAddon with correct fromIndex/toIndex for moved items and returns 200', () => {
      // Arrange
      setProfiles({ p1: { id: 'p1', name: 'Alice', avatarIcon: 'person', avatarColor: 'blue' } });

      const addonStore = createAddonStoreState({
        orderedAddons: [
          {
            id: 'addon/a',
            manifestUrl: 'https://example.com/a.json',
            manifest: { id: 'addon/a', name: 'A', version: '1.0.0' },
          },
          {
            id: 'addon/b',
            manifestUrl: 'https://example.com/b.json',
            manifest: { id: 'addon/b', name: 'B', version: '1.0.0' },
          },
          {
            id: 'addon/c',
            manifestUrl: 'https://example.com/c.json',
            manifest: { id: 'addon/c', name: 'C', version: '1.0.0' },
          },
          {
            id: 'addon/d',
            manifestUrl: 'https://example.com/d.json',
            manifest: { id: 'addon/d', name: 'D', version: '1.0.0' },
          },
        ],
      });
      mockUseAddonStore.getState.mockReturnValue(addonStore as never);

      // Act
      const result = reorderProfileAddons('p1', {
        orderedIds: ['addon%2Fd', 'addon%2Fb', 'addon%2Fa', 'addon%2Fc'],
      });

      // Assert
      expect(addonStore.reorderAddon).toHaveBeenCalledTimes(2);
      expect(addonStore.reorderAddon).toHaveBeenNthCalledWith(1, 3, 0, 'p1');
      expect(addonStore.reorderAddon).toHaveBeenNthCalledWith(2, 2, 1, 'p1');
      expect(result).toEqual({ status: 200, body: { ok: true } });
    });
  });
});
