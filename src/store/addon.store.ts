import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { InstalledAddon, Manifest } from '@/types/stremio';
import { useProfileStore } from '@/store/profile.store';

export interface AddonProfileConfig {
  isActive: boolean;
  useCatalogsOnHome: boolean;
  useCatalogsInSearch: boolean;
  useForSubtitles: boolean;
}

interface AddonState {
  addons: Record<string, InstalledAddon>;
  configsByProfile: Record<string, Record<string, AddonProfileConfig>>;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Actions
  addAddon: (id: string, manifestUrl: string, manifest: Manifest) => void;
  removeAddon: (id: string) => void;
  activateAddon: (id: string, profileId?: string) => void;
  deactivateAddon: (id: string, profileId?: string) => void;
  updateAddon: (id: string, manifest: Manifest) => void;
  toggleUseCatalogsOnHome: (id: string, profileId?: string) => void;
  toggleUseCatalogsInSearch: (id: string, profileId?: string) => void;
  toggleUseForSubtitles: (id: string, profileId?: string) => void;
  hasAddons: () => boolean;
  hasAddon: (id: string) => boolean;
  getAddonConfig: (id: string, profileId?: string) => AddonProfileConfig | undefined;
  getAddonsList: () => InstalledAddon[];
  setLoading: (isLoading: boolean) => void;
  setInitialized: (isInitialized: boolean) => void;
  setError: (error: string | null) => void;
}

const DEFAULT_ADDON_CONFIG: AddonProfileConfig = {
  isActive: true,
  useCatalogsOnHome: true,
  useCatalogsInSearch: true,
  useForSubtitles: true,
};

export const useAddonStore = create<AddonState>()(
  persist(
    (set, get) => ({
      // Initial state
      addons: {},
      configsByProfile: {},
      isLoading: false,
      isInitialized: false,
      error: null,

      addAddon: (id: string, manifestUrl: string, manifest: Manifest) => {
        const { addons, configsByProfile, hasAddon } = get();
        const activeProfileId = useProfileStore.getState().activeProfileId;

        // Prevent duplicates
        if (hasAddon(id)) {
          set({ error: 'Addon already installed' });
          return;
        }

        const newAddon: InstalledAddon = {
          id,
          manifestUrl,
          manifest,
          installedAt: Date.now(),
        };

        const newConfigs = { ...configsByProfile };
        if (activeProfileId) {
          if (!newConfigs[activeProfileId]) {
            newConfigs[activeProfileId] = {};
          }
          newConfigs[activeProfileId] = {
            ...newConfigs[activeProfileId],
            [id]: { ...DEFAULT_ADDON_CONFIG },
          };
        }

        set({
          addons: { ...addons, [id]: newAddon },
          configsByProfile: newConfigs,
          error: null,
        });
      },

      removeAddon: (id: string) => {
        set((state) => {
          const { [id]: removed, ...rest } = state.addons;

          // Remove config from all profiles
          const newConfigs = { ...state.configsByProfile };
          for (const profileId of Object.keys(newConfigs)) {
            if (newConfigs[profileId] && newConfigs[profileId][id]) {
              const { [id]: _, ...restConfigs } = newConfigs[profileId];
              newConfigs[profileId] = restConfigs;
            }
          }

          return {
            addons: rest,
            configsByProfile: newConfigs,
            error: null,
          };
        });
      },

      activateAddon: (id: string, profileId?: string) => {
        const targetProfileId = profileId || useProfileStore.getState().activeProfileId;
        if (!targetProfileId) return;

        set((state) => {
          const profileConfigs = state.configsByProfile[targetProfileId] || {};
          return {
            configsByProfile: {
              ...state.configsByProfile,
              [targetProfileId]: {
                ...profileConfigs,
                [id]: { ...DEFAULT_ADDON_CONFIG },
              }
            }
          };
        });
      },

      deactivateAddon: (id: string, profileId?: string) => {
        const targetProfileId = profileId || useProfileStore.getState().activeProfileId;
        if (!targetProfileId) return;

        set((state) => {
          const profileConfigs = state.configsByProfile[targetProfileId];
          if (!profileConfigs || !profileConfigs[id]) return state;

          return {
            configsByProfile: {
              ...state.configsByProfile,
              [targetProfileId]: {
                ...profileConfigs,
                [id]: {
                  ...profileConfigs[id],
                  isActive: false,
                },
              }
            }
          };
        });
      },

      updateAddon: (id: string, manifest: Manifest) => {
        const { addons } = get();
        const existingAddon = addons[id];

        if (!existingAddon) {
          set({ error: 'Addon not found' });
          return;
        }

        set((state) => ({
          addons: {
            ...state.addons,
            [id]: {
              ...existingAddon,
              manifest,
            },
          },
          error: null,
        }));
      },

      toggleUseCatalogsOnHome: (id: string, profileId?: string) => {
        const targetProfileId = profileId || useProfileStore.getState().activeProfileId;
        if (!targetProfileId) return;

        set((state) => {
          const profileConfigs = state.configsByProfile[targetProfileId];
          if (!profileConfigs || !profileConfigs[id]) return state;

          return {
            configsByProfile: {
              ...state.configsByProfile,
              [targetProfileId]: {
                ...profileConfigs,
                [id]: {
                  ...profileConfigs[id],
                  useCatalogsOnHome: !profileConfigs[id].useCatalogsOnHome,
                },
              }
            }
          };
        });
      },

      toggleUseCatalogsInSearch: (id: string, profileId?: string) => {
        const targetProfileId = profileId || useProfileStore.getState().activeProfileId;
        if (!targetProfileId) return;

        set((state) => {
          const profileConfigs = state.configsByProfile[targetProfileId];
          if (!profileConfigs || !profileConfigs[id]) return state;

          return {
            configsByProfile: {
              ...state.configsByProfile,
              [targetProfileId]: {
                ...profileConfigs,
                [id]: {
                  ...profileConfigs[id],
                  useCatalogsInSearch: !profileConfigs[id].useCatalogsInSearch,
                },
              }
            }
          };
        });
      },

      toggleUseForSubtitles: (id: string, profileId?: string) => {
        const targetProfileId = profileId || useProfileStore.getState().activeProfileId;
        if (!targetProfileId) return;

        set((state) => {
          const profileConfigs = state.configsByProfile[targetProfileId];
          if (!profileConfigs || !profileConfigs[id]) return state;

          return {
            configsByProfile: {
              ...state.configsByProfile,
              [targetProfileId]: {
                ...profileConfigs,
                [id]: {
                  ...profileConfigs[id],
                  useForSubtitles: !profileConfigs[id].useForSubtitles,
                },
              }
            }
          };
        });
      },

      hasAddons: () => {
        return Object.keys(get().addons).length > 0;
      },

      hasAddon: (id: string) => {
        return id in get().addons;
      },

      getAddonConfig: (id: string, profileId?: string) => {
        const targetProfileId = profileId || useProfileStore.getState().activeProfileId;
        if (!targetProfileId) return undefined;

        return get().configsByProfile[targetProfileId]?.[id];
      },

      getAddonsList: () => {
        return Object.values(get().addons);
      },

      setLoading: (isLoading: boolean) => {
        set({ isLoading });
      },

      setInitialized: (isInitialized: boolean) => {
        set({ isInitialized });
      },

      setError: (error: string | null) => {
        set({ error });
      },
    }),
    {
      name: 'addon-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ addons: state.addons, configsByProfile: state.configsByProfile }),
      version: 2,
      migrate: async (persistedState: any, version) => {
        let state = persistedState as AddonState;

        // Apply migrations sequentially from stored version to current
        // v0 -> v1: Add useForSubtitles=true to all existing addons
        // v1 -> v2: Migrate to per-profile configs
        if (version < 2 && state.addons) {
          const migratedAddons: Record<string, InstalledAddon> = {};
          const newConfigs: Record<string, Record<string, AddonProfileConfig>> = {};

          // Read profiles directly from AsyncStorage to avoid a race condition:
          // useProfileStore.getState() may return empty initial state if the profile
          // store has not yet finished its own async hydration when this migration runs.
          let profileIds: string[] = [];
          try {
            const raw = await AsyncStorage.getItem('profiles-registry');
            if (raw) {
              const parsed = JSON.parse(raw);
              profileIds = Object.keys(parsed?.state?.profiles || {});
            }
          } catch {
            // If we cannot read profiles, fall back to an empty list — configs will
            // be created on first use via the normal per-profile config path.
          }

          for (const [id, addon] of Object.entries(state.addons) as [string, any][]) {
            migratedAddons[id] = {
              id: addon.id,
              manifestUrl: addon.manifestUrl,
              manifest: addon.manifest,
              installedAt: addon.installedAt,
            };

            if (profileIds.length > 0) {
              profileIds.forEach(profileId => {
                if (!newConfigs[profileId]) newConfigs[profileId] = {};
                newConfigs[profileId][id] = {
                  isActive: true,
                  useCatalogsOnHome: addon.useCatalogsOnHome ?? true,
                  useCatalogsInSearch: addon.useCatalogsInSearch ?? true,
                  useForSubtitles: addon.useForSubtitles ?? true,
                };
              });
            }
          }
          state.addons = migratedAddons;
          state.configsByProfile = Object.assign(state.configsByProfile || {}, newConfigs);
        }

        return state as any;
      },
    }
  )
);

export const initializeAddons = async () => {
  const { addons, updateAddon, setInitialized, setLoading, isInitialized } =
    useAddonStore.getState();

  if (isInitialized) {
    return;
  }

  setLoading(true);

  try {
    const { fetchManifest } = await import('@/api/stremio/client');
    await Promise.allSettled(
      Object.values(addons).map(async (addon) => {
        try {
          const manifest = await fetchManifest(addon.manifestUrl);
          updateAddon(addon.id, manifest);
        } catch {
          // Silently ignore per-addon failures — stale manifests are fine
        }
      })
    );
  } finally {
    setLoading(false);
    setInitialized(true);
  }
};
