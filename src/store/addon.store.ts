import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { InstalledAddon, Manifest } from '@/types/stremio';
import { createDebugLogger } from '@/utils/debug';
import { fetchWithTimeout } from '@/utils/network';
import { ADDON_MANIFEST_FETCH_TIMEOUT_MS } from '@/constants/ui';

const debug = createDebugLogger('AddonStore');

interface AddonState {
    addons: Record<string, InstalledAddon>;
    isLoading: boolean;
    isInitialized: boolean;
    error: string | null;

    // Actions
    addAddon: (id: string, manifestUrl: string, manifest: Manifest) => void;
    removeAddon: (id: string) => void;
    updateAddon: (id: string, manifest: Manifest) => void;
    toggleUseCatalogsOnHome: (id: string) => void;
    toggleUseCatalogsInSearch: (id: string) => void;
    hasAddons: () => boolean;
    hasAddon: (id: string) => boolean;
    getAddonsList: () => InstalledAddon[];
    setLoading: (isLoading: boolean) => void;
    setInitialized: (isInitialized: boolean) => void;
    setError: (error: string | null) => void;
}

export const useAddonStore = create<AddonState>()(
    persist(
        (set, get) => ({
            // Initial state
            addons: {},
            isLoading: false,
            isInitialized: false,
            error: null,

            addAddon: (id: string, manifestUrl: string, manifest: Manifest) => {
                const { addons, hasAddon } = get();

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
                    useCatalogsOnHome: true,
                    useCatalogsInSearch: true,
                };

                set({
                    addons: { ...addons, [id]: newAddon },
                    error: null,
                });
            },

            removeAddon: (id: string) => {
                set((state) => {
                    const { [id]: removed, ...rest } = state.addons;
                    return {
                        addons: rest,
                        error: null,
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

            toggleUseCatalogsOnHome: (id: string) => {
                const { addons } = get();
                const addon = addons[id];

                if (!addon) {
                    set({ error: 'Addon not found' });
                    return;
                }

                set((state) => ({
                    addons: {
                        ...state.addons,
                        [id]: {
                            ...addon,
                            useCatalogsOnHome: !addon.useCatalogsOnHome,
                        },
                    },
                    error: null,
                }));
            },

            toggleUseCatalogsInSearch: (id: string) => {
                const { addons } = get();
                const addon = addons[id];

                if (!addon) {
                    set({ error: 'Addon not found' });
                    return;
                }

                set((state) => ({
                    addons: {
                        ...state.addons,
                        [id]: {
                            ...addon,
                            useCatalogsInSearch: !addon.useCatalogsInSearch,
                        },
                    },
                    error: null,
                }));
            },

            hasAddons: () => {
                return Object.keys(get().addons).length > 0;
            },

            hasAddon: (id: string) => {
                return id in get().addons;
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
            partialize: (state) => ({ addons: state.addons }),
        }
    )
);

// Initialize and update addons on app start
export const initializeAddons = async () => {
    const { addons, updateAddon, setInitialized, setLoading, isInitialized } = useAddonStore.getState();

    // Idempotency guard: don't re-run if already initialized
    if (isInitialized) {
        return;
    }

    const addonsList = Object.values(addons);

    setLoading(true);

    try {
        // Update all existing addons
        const updatePromises = addonsList.map(async (addon) => {
            try {
                const response = await fetchWithTimeout(
                    addon.manifestUrl,
                    ADDON_MANIFEST_FETCH_TIMEOUT_MS
                );
                if (response.ok) {
                    const manifest: Manifest = await response.json();
                    updateAddon(addon.id, manifest);
                }
            } catch (error) {
                const name = (error as { name?: string } | null)?.name;
                if (name === 'AbortError') {
                    debug('updateAddonTimedOut', {
                        addonId: addon.id,
                        manifestUrl: addon.manifestUrl,
                        timeoutMs: ADDON_MANIFEST_FETCH_TIMEOUT_MS,
                    });
                } else {
                    debug('updateAddonFailed', { addonId: addon.id, manifestUrl: addon.manifestUrl, error });
                }
            }
        });
        await Promise.allSettled(updatePromises);
    } finally {
        setLoading(false);
        // Mark as initialized even if there were errors
        setInitialized(true);
    }
};
