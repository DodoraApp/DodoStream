/**
 * Regression tests for the addon store migration.
 *
 * Background: The 0.9.0 release shipped an async migrate function that silently
 * broke because Zustand's newImpl (used when `storage` option is provided) does
 * NOT await the Promise returned by migrate — it uses the Promise object itself
 * as the migrated state, resulting in an empty store and all addons appearing lost.
 *
 * Fix (0.9.1):
 *  - version bumped to 3 with a synchronous migrate
 *  - addons without per-profile config entries are treated as inactive
 *    (pre-migration users must re-enable addons)
 */

interface AddonProfileConfig {
  isActive: boolean;
  useCatalogsOnHome: boolean;
  useCatalogsInSearch: boolean;
  useForSubtitles: boolean;
}

interface InstalledAddon {
  id: string;
  manifestUrl: string;
  manifest: Record<string, unknown>;
  installedAt: number;
}

interface AddonState {
  addons: Record<string, InstalledAddon>;
  configsByProfile: Record<string, Record<string, AddonProfileConfig>>;
}


/** Mirrors the synchronous migrate function in addon.store.ts (version 3). */
const migrateAddonStoreState = (
  persistedState: AddonState & { addons?: Record<string, any> },
  version: number
): AddonState => {
  let state = persistedState as AddonState;

  if (version < 2 && state.addons) {
    const migratedAddons: Record<string, InstalledAddon> = {};
    for (const [id, addon] of Object.entries(state.addons) as [string, any][]) {
      migratedAddons[id] = {
        id: addon.id,
        manifestUrl: addon.manifestUrl,
        manifest: addon.manifest,
        installedAt: addon.installedAt,
      };
    }
    state.addons = migratedAddons;
    state.configsByProfile = state.configsByProfile || {};
  }

  return state;
};

/** Simulates the config lookup used in hooks.ts (no fallback — missing config = undefined). */
const getConfig = (
  configsByProfile: Record<string, Record<string, AddonProfileConfig>>,
  profileId: string,
  addonId: string
): AddonProfileConfig | undefined => configsByProfile[profileId]?.[addonId];

describe('addon store migration', () => {
  describe('v1 -> v3: strips legacy flat fields from addon objects', () => {
    it('removes legacy fields and preserves core addon shape', () => {
      // Arrange
      const persistedState = {
        addons: {
          addonOne: {
            id: 'addonOne',
            manifestUrl: 'https://example.com/one/manifest.json',
            manifest: { id: 'addonOne', name: 'Addon One' },
            installedAt: 111,
            useCatalogsOnHome: false,
            useCatalogsInSearch: true,
            useForSubtitles: false,
            legacyField: 'legacy',
          },
        },
        configsByProfile: {},
      };

      // Act
      const migrated = migrateAddonStoreState(persistedState as any, 1);

      // Assert
      expect(migrated.addons).toEqual({
        addonOne: {
          id: 'addonOne',
          manifestUrl: 'https://example.com/one/manifest.json',
          manifest: { id: 'addonOne', name: 'Addon One' },
          installedAt: 111,
        },
      });
    });

    it('leaves configsByProfile empty (populated at read time via fallback)', () => {
      // Arrange
      const persistedState = {
        addons: {
          addonOne: {
            id: 'addonOne',
            manifestUrl: 'https://example.com/one/manifest.json',
            manifest: { id: 'addonOne' },
            installedAt: 100,
            useCatalogsOnHome: true,
            useCatalogsInSearch: true,
            useForSubtitles: true,
          },
        },
        configsByProfile: {},
      };

      // Act
      const migrated = migrateAddonStoreState(persistedState as any, 1);

      // Assert
      expect(migrated.configsByProfile).toEqual({});
    });

    it('handles multiple addons', () => {
      // Arrange
      const persistedState = {
        addons: {
          addonOne: {
            id: 'addonOne',
            manifestUrl: 'https://a.com/manifest.json',
            manifest: { id: 'addonOne' },
            installedAt: 1,
            useCatalogsOnHome: true,
          },
          addonTwo: {
            id: 'addonTwo',
            manifestUrl: 'https://b.com/manifest.json',
            manifest: { id: 'addonTwo' },
            installedAt: 2,
            useCatalogsOnHome: false,
          },
        },
        configsByProfile: {},
      };

      // Act
      const migrated = migrateAddonStoreState(persistedState as any, 1);

      // Assert
      expect(Object.keys(migrated.addons)).toEqual(['addonOne', 'addonTwo']);
      expect(migrated.addons.addonOne).not.toHaveProperty('useCatalogsOnHome');
      expect(migrated.addons.addonTwo).not.toHaveProperty('useCatalogsOnHome');
    });
  });

  describe('v2 -> v3: no-op (state passes through unchanged)', () => {
    it('returns state unchanged when version is 2', () => {
      // Arrange
      const stateV2: AddonState = {
        addons: {
          addonOne: {
            id: 'addonOne',
            manifestUrl: 'https://example.com/one/manifest.json',
            manifest: { id: 'addonOne' },
            installedAt: 100,
          },
        },
        configsByProfile: {
          profileA: {
            addonOne: {
              isActive: false,
              useCatalogsOnHome: false,
              useCatalogsInSearch: false,
              useForSubtitles: false,
            },
          },
        },
      };

      // Act
      const migrated = migrateAddonStoreState(stateV2 as any, 2);

      // Assert — same reference and same value
      expect(migrated).toBe(stateV2);
    });

    it('returns state unchanged when version is 3', () => {
      // Arrange
      const stateV3: AddonState = {
        addons: {
          addonOne: {
            id: 'addonOne',
            manifestUrl: 'https://x.com/m.json',
            manifest: {},
            installedAt: 1,
          },
        },
        configsByProfile: {},
      };

      // Act
      const migrated = migrateAddonStoreState(stateV3 as any, 3);

      // Assert
      expect(migrated).toBe(stateV3);
    });
  });

  describe('config lookup without fallback (addons without config are inactive)', () => {
    it('returns undefined when configsByProfile is empty', () => {
      // Arrange — configsByProfile is empty
      const configsByProfile: Record<string, Record<string, AddonProfileConfig>> = {};

      // Act
      const config = getConfig(configsByProfile, 'profileA', 'addonOne');

      // Assert
      expect(config).toBeUndefined();
    });

    it('returns the stored config when one exists', () => {
      // Arrange
      const storedConfig: AddonProfileConfig = {
        isActive: false,
        useCatalogsOnHome: false,
        useCatalogsInSearch: true,
        useForSubtitles: false,
      };
      const configsByProfile = { profileA: { addonOne: storedConfig } };

      // Act
      const config = getConfig(configsByProfile, 'profileA', 'addonOne');

      // Assert — stored config wins (including isActive: false)
      expect(config).toBe(storedConfig);
      expect(config!.isActive).toBe(false);
    });

    it('returns undefined for a profile that has no entry for this addon', () => {
      // Arrange — profile exists in configsByProfile but has no entry for this addon
      const configsByProfile: Record<string, Record<string, AddonProfileConfig>> = {
        profileA: {},
      };

      // Act
      const config = getConfig(configsByProfile, 'profileA', 'addonOne');

      // Assert
      expect(config).toBeUndefined();
    });
  });
});
