import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { InstalledAddon, Manifest } from '@/types/stremio';
import { type AddonConfig } from '@/types/addon-config';
import { useProfileStore } from '@/store/profile.store';
import { moveItem } from '@/utils/array';
import { createDebugLogger } from '@/utils/debug';

const debug = createDebugLogger('AddonStore');

let initializing = false;
interface AddonState {
  addons: Record<string, InstalledAddon>;
  configsByProfile: Record<string, Record<string, AddonConfig>>;
  /** Per-profile ordered list of addon IDs. Determines display/catalog order. */
  addonOrderByProfile: Record<string, string[]>;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Actions
  addAddon: (id: string, manifestUrl: string, manifest: Manifest) => void;
  removeAddon: (id: string) => void;
  activateAddon: (id: string, profileId?: string) => void;
  deactivateAddon: (id: string, profileId?: string) => void;
  updateAddon: (id: string, manifest: Manifest) => void;
  reorderAddon: (fromIndex: number, toIndex: number, profileId?: string) => void;
  toggleUseCatalogsOnHome: (id: string, profileId?: string) => void;
  toggleUseCatalogsInSearch: (id: string, profileId?: string) => void;
  toggleUseForSubtitles: (id: string, profileId?: string) => void;
  setAddonConfig: (id: string, config: Partial<AddonConfig>, profileId?: string) => void;
  hasAddons: () => boolean;
  hasAddon: (id: string) => boolean;
  getAddonConfig: (id: string, profileId?: string) => AddonConfig | undefined;
  getAddonsList: () => InstalledAddon[];
  getOrderedAddonsList: (profileId?: string) => InstalledAddon[];
  setLoading: (isLoading: boolean) => void;
  setInitialized: (isInitialized: boolean) => void;
  setError: (error: string | null) => void;
}


export const useAddonStore = create<AddonState>()(
  persist(
    (set, get) => {
      const toggleConfigField = (
        id: string,
        field: keyof Omit<AddonConfig, 'isActive'>,
        profileId?: string,
      ) => {
        const targetProfileId = profileId || useProfileStore.getState().activeProfileId;
        debug('toggleConfigField', { id, field, targetProfileId, profileIdArg: profileId });
        if (!targetProfileId) {
          debug('toggleConfigField: no targetProfileId, aborting');
          return;
        }
        set((state) => {
          const profileConfigs = state.configsByProfile[targetProfileId];
          if (!profileConfigs || !profileConfigs[id]) {
            debug('toggleConfigField: no config entry for addon', {
              targetProfileId, id, hasProfileConfigs: !!profileConfigs,
            });
            return state;
          }
          const oldValue = profileConfigs[id][field];
          debug('toggleConfigField: toggling', { id, field, from: oldValue, to: !oldValue });
          return {
            configsByProfile: {
              ...state.configsByProfile,
              [targetProfileId]: {
                ...profileConfigs,
                [id]: {
                  ...profileConfigs[id],
                  [field]: !oldValue,
                },
              },
            },
          };
        });
      };

      return {
        // Initial state
        addons: {},
        configsByProfile: {},
        addonOrderByProfile: {},
        isLoading: false,
        isInitialized: false,
        error: null,

        addAddon: (id: string, manifestUrl: string, manifest: Manifest) => {
          const { addons, configsByProfile, addonOrderByProfile, hasAddon } = get();
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
          const newOrder = { ...addonOrderByProfile };
          if (activeProfileId) {
            if (!newConfigs[activeProfileId]) {
              newConfigs[activeProfileId] = {};
            }
            newConfigs[activeProfileId] = {
              ...newConfigs[activeProfileId],
              [id]: { isActive: true, useCatalogsOnHome: true, useCatalogsInSearch: true, useForSubtitles: true },
            };
            // Append to end of order for this profile
            newOrder[activeProfileId] = [...(newOrder[activeProfileId] ?? []), id];
          }

          set({
            addons: { ...addons, [id]: newAddon },
            configsByProfile: newConfigs,
            addonOrderByProfile: newOrder,
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

            // Remove from order in all profiles
            const newOrder = { ...state.addonOrderByProfile };
            for (const profileId of Object.keys(newOrder)) {
              newOrder[profileId] = newOrder[profileId].filter((addonId) => addonId !== id);
            }

            return {
              addons: rest,
              configsByProfile: newConfigs,
              addonOrderByProfile: newOrder,
              error: null,
            };
          });
        },

        activateAddon: (id: string, profileId?: string) => {
          const targetProfileId = profileId || useProfileStore.getState().activeProfileId;
          debug('activateAddon', { id, targetProfileId, profileIdArg: profileId });
          if (!targetProfileId) {
            debug('activateAddon: no targetProfileId, aborting');
            return;
          }

          set((state) => {
            const profileConfigs = state.configsByProfile[targetProfileId] || {};
            const existingConfig = profileConfigs[id];
            debug('activateAddon: existing config', {
              id, hasExistingConfig: !!existingConfig,
              previousIsActive: existingConfig?.isActive,
            });

            // Append to end of order if not already tracked
            const currentOrder = state.addonOrderByProfile[targetProfileId] ?? [];
            const newOrder = currentOrder.includes(id) ? currentOrder : [...currentOrder, id];

            return {
              configsByProfile: {
                ...state.configsByProfile,
                [targetProfileId]: {
                  ...profileConfigs,
                  [id]: {
                    ...existingConfig,
                    isActive: true,
                  },
                },
              },
              addonOrderByProfile: {
                ...state.addonOrderByProfile,
                [targetProfileId]: newOrder,
              },
            };
          });
        },

        deactivateAddon: (id: string, profileId?: string) => {
          const targetProfileId = profileId || useProfileStore.getState().activeProfileId;
          debug('deactivateAddon', { id, targetProfileId, profileIdArg: profileId });
          if (!targetProfileId) {
            debug('deactivateAddon: no targetProfileId, aborting');
            return;
          }

          set((state) => {
            const profileConfigs = state.configsByProfile[targetProfileId];
            if (!profileConfigs || !profileConfigs[id]) {
              debug('deactivateAddon: no config entry, silently aborting', {
                targetProfileId, id, hasProfileConfigs: !!profileConfigs,
                profileAddonIds: profileConfigs ? Object.keys(profileConfigs) : [],
              });
              return state;
            }

            debug('deactivateAddon: deactivating', {
              id, previousIsActive: profileConfigs[id].isActive,
            });
            return {
              configsByProfile: {
                ...state.configsByProfile,
                [targetProfileId]: {
                  ...profileConfigs,
                  [id]: {
                    ...profileConfigs[id],
                    isActive: false,
                  },
                },
              },
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

        toggleUseCatalogsOnHome: (id: string, profileId?: string) =>
          toggleConfigField(id, 'useCatalogsOnHome', profileId),

        toggleUseCatalogsInSearch: (id: string, profileId?: string) =>
          toggleConfigField(id, 'useCatalogsInSearch', profileId),

        toggleUseForSubtitles: (id: string, profileId?: string) =>
          toggleConfigField(id, 'useForSubtitles', profileId),


        setAddonConfig: (id: string, config: Partial<AddonConfig>, profileId?: string) => {
          const targetProfileId = profileId || useProfileStore.getState().activeProfileId;
          if (!targetProfileId) {
            debug('setAddonConfig: no targetProfileId, aborting');
            return;
          }

          set((state) => {
            const profileConfigs = state.configsByProfile[targetProfileId] ?? {};
            const existing = profileConfigs[id] ?? { isActive: false, useCatalogsOnHome: true, useCatalogsInSearch: true, useForSubtitles: true };
            const next: AddonConfig = { ...existing, ...config };

            debug('setAddonConfig', { id, targetProfileId, keys: Object.keys(config) });

            // Ensure the addon is in the profile's order list when activating.
            const currentOrder = state.addonOrderByProfile[targetProfileId] ?? [];
            const newOrder = next.isActive && !currentOrder.includes(id)
              ? [...currentOrder, id]
              : currentOrder;

            return {
              configsByProfile: {
                ...state.configsByProfile,
                [targetProfileId]: { ...profileConfigs, [id]: next },
              },
              ...(newOrder !== currentOrder
                ? { addonOrderByProfile: { ...state.addonOrderByProfile, [targetProfileId]: newOrder } }
                : {}),
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
          if (!targetProfileId) {
            debug('getAddonConfig: no targetProfileId', { id, profileIdArg: profileId });
            return undefined;
          }

          const profileConfigs = get().configsByProfile[targetProfileId];
          const config = profileConfigs?.[id];
          if (config) {
            return config;
          }

          debug('getAddonConfig: no config found', { id, targetProfileId });
          return undefined;
        },

        getAddonsList: () => {
          return Object.values(get().addons);
        },

        getOrderedAddonsList: (profileId?: string) => {
          const { addons, addonOrderByProfile } = get();
          const targetProfileId = profileId || useProfileStore.getState().activeProfileId;
          const allAddons = Object.values(addons);

          if (!targetProfileId) return allAddons;

          const order = addonOrderByProfile[targetProfileId];
          if (!order || order.length === 0) return allAddons;

          // Sort by order; addons not in order go to the end, with a stable tiebreaker.
          const orderMap = new Map(order.map((id, index) => [id, index]));
          return [...allAddons].sort((a, b) => {
            const aIndex = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
            const bIndex = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
            return aIndex - bIndex || a.id.localeCompare(b.id);
          });
        },

        reorderAddon: (fromIndex: number, toIndex: number, profileId?: string) => {
          const targetProfileId = profileId || useProfileStore.getState().activeProfileId;
          if (!targetProfileId) return;

          set((state) => {
            const { addons, addonOrderByProfile } = state;
            // Build current order, falling back to insertion order for missing entries
            const allIds = Object.keys(addons);
            const currentOrder = addonOrderByProfile[targetProfileId] ?? allIds;
            // Ensure all addon IDs are represented (handles addons added before order tracking)
            const fullOrder = [...currentOrder, ...allIds.filter((id) => !currentOrder.includes(id))];
            const newOrder = moveItem(fullOrder, fromIndex, toIndex);
            return {
              addonOrderByProfile: {
                ...addonOrderByProfile,
                [targetProfileId]: newOrder,
              },
            };
          });
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
      };
    },
    {
      name: 'addon-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        addons: state.addons,
        configsByProfile: state.configsByProfile,
        addonOrderByProfile: state.addonOrderByProfile,
      }),
      version: 3,
      migrate: (persistedState: any, version) => {
        let state = persistedState as AddonState;

        // v0 -> v1: Add useForSubtitles=true to all existing addons (flat structure)
        // v1 -> v2: Attempted migration to per-profile configs — the async migrate
        //           used in 0.9.0 was silently broken: Zustand's newImpl does not
        //           await the Promise returned by migrate, so configsByProfile was
        //           never populated and all addons appeared inactive/invisible.
        // v2 -> v3: No structural change. Addons without per-profile config entries
        //           are now treated as inactive (users must re-enable them).
        if (version < 2 && state.addons) {
          // Strip legacy flat fields off addon objects (useCatalogsOnHome etc.).
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

        return state as any;
      },
    }
  )
);

export const initializeAddons = async () => {
  const { addons, updateAddon, setInitialized, setLoading, isInitialized } =
    useAddonStore.getState();

  if (isInitialized || initializing) {
    return;
  }
  initializing = true;

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
    initializing = false;
  }
};
