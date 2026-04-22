import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface HeroCatalogSource {
  /** Addon ID (unique identifier for the addon) */
  addonId: string;
  /** Catalog ID within the addon */
  catalogId: string;
  /** Catalog type (e.g., 'movie', 'series') */
  catalogType: string;
}

export interface ProfileHomeSettings {
  /** Whether the hero section is visible */
  heroEnabled: boolean;
  /** Number of items to show in hero rotation */
  heroItemCount: number;
  /** Catalogs that supply hero items */
  heroCatalogSources: HeroCatalogSource[];
  /** Whether to show the continue watching catalog on home */
  continueWatchingEnabled: boolean;
  /** Whether to show the my list catalog on home */
  myListEnabled: boolean;
}

interface HomeSettingsState {
  activeProfileId?: string;
  byProfile: Record<string, ProfileHomeSettings>;

  // Cross-store sync
  setActiveProfileId: (profileId?: string) => void;

  // Selectors
  getActiveSettings: () => ProfileHomeSettings;

  // Mutations (active profile)
  setHeroEnabled: (enabled: boolean) => void;
  setHeroItemCount: (count: number) => void;
  setHeroCatalogSources: (sources: HeroCatalogSource[]) => void;
  setContinueWatchingEnabled: (enabled: boolean) => void;
  setMyListEnabled: (enabled: boolean) => void;
  addHeroCatalogSource: (source: HeroCatalogSource) => void;
  removeHeroCatalogSource: (addonId: string, catalogId: string) => void;

  // Mutations (specific profile)
  setHeroEnabledForProfile: (profileId: string, enabled: boolean) => void;
  setHeroItemCountForProfile: (profileId: string, count: number) => void;
  setHeroCatalogSourcesForProfile: (profileId: string, sources: HeroCatalogSource[]) => void;
  setContinueWatchingEnabledForProfile: (profileId: string, enabled: boolean) => void;
  setMyListEnabledForProfile: (profileId: string, enabled: boolean) => void;
}

export const DEFAULT_HOME_SETTINGS: ProfileHomeSettings = {
  heroEnabled: true,
  heroItemCount: 5,
  heroCatalogSources: [],
  continueWatchingEnabled: true,
  myListEnabled: true,
};

export const useHomeStore = create<HomeSettingsState>()(
  persist(
    (set, get) => ({
      activeProfileId: undefined,
      byProfile: {},

      setActiveProfileId: (profileId) => {
        if (get().activeProfileId === profileId) return;
        set({ activeProfileId: profileId });
      },

      getActiveSettings: () => {
        const profileId = get().activeProfileId;
        if (!profileId) return DEFAULT_HOME_SETTINGS;
        return get().byProfile[profileId] ?? DEFAULT_HOME_SETTINGS;
      },

      // Active profile mutations
      setHeroEnabled: (enabled) => {
        const profileId = get().activeProfileId;
        if (!profileId) return;
        get().setHeroEnabledForProfile(profileId, enabled);
      },

      setHeroItemCount: (count) => {
        const profileId = get().activeProfileId;
        if (!profileId) return;
        get().setHeroItemCountForProfile(profileId, count);
      },

      setHeroCatalogSources: (sources) => {
        const profileId = get().activeProfileId;
        if (!profileId) return;
        get().setHeroCatalogSourcesForProfile(profileId, sources);
      },

      setContinueWatchingEnabled: (enabled) => {
        const profileId = get().activeProfileId;
        if (!profileId) return;
        get().setContinueWatchingEnabledForProfile(profileId, enabled);
      },

      setMyListEnabled: (enabled) => {
        const profileId = get().activeProfileId;
        if (!profileId) return;
        get().setMyListEnabledForProfile(profileId, enabled);
      },

      addHeroCatalogSource: (source) => {
        const profileId = get().activeProfileId;
        if (!profileId) return;
        const current = get().byProfile[profileId] ?? DEFAULT_HOME_SETTINGS;
        const exists = current.heroCatalogSources.some(
          (s) => s.addonId === source.addonId && s.catalogId === source.catalogId
        );
        if (exists) return;
        get().setHeroCatalogSourcesForProfile(profileId, [...current.heroCatalogSources, source]);
      },

      removeHeroCatalogSource: (addonId, catalogId) => {
        const profileId = get().activeProfileId;
        if (!profileId) return;
        const current = get().byProfile[profileId] ?? DEFAULT_HOME_SETTINGS;
        get().setHeroCatalogSourcesForProfile(
          profileId,
          current.heroCatalogSources.filter(
            (s) => !(s.addonId === addonId && s.catalogId === catalogId)
          )
        );
      },

      // Per-profile mutations
      setHeroEnabledForProfile: (profileId, enabled) => {
        set((state) => ({
          byProfile: {
            ...state.byProfile,
            [profileId]: {
              ...(state.byProfile[profileId] ?? DEFAULT_HOME_SETTINGS),
              heroEnabled: enabled,
            },
          },
        }));
      },

      setHeroItemCountForProfile: (profileId, count) => {
        set((state) => ({
          byProfile: {
            ...state.byProfile,
            [profileId]: {
              ...(state.byProfile[profileId] ?? DEFAULT_HOME_SETTINGS),
              heroItemCount: count,
            },
          },
        }));
      },

      setHeroCatalogSourcesForProfile: (profileId, sources) => {
        set((state) => ({
          byProfile: {
            ...state.byProfile,
            [profileId]: {
              ...(state.byProfile[profileId] ?? DEFAULT_HOME_SETTINGS),
              heroCatalogSources: sources,
            },
          },
        }));
      },

      setContinueWatchingEnabledForProfile: (profileId, enabled) => {
        set((state) => ({
          byProfile: {
            ...state.byProfile,
            [profileId]: {
              ...(state.byProfile[profileId] ?? DEFAULT_HOME_SETTINGS),
              continueWatchingEnabled: enabled,
            },
          },
        }));
      },

      setMyListEnabledForProfile: (profileId, enabled) => {
        set((state) => ({
          byProfile: {
            ...state.byProfile,
            [profileId]: {
              ...(state.byProfile[profileId] ?? DEFAULT_HOME_SETTINGS),
              myListEnabled: enabled,
            },
          },
        }));
      },
    }),
    {
      name: 'home-settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ byProfile: state.byProfile }),
    }
  )
);
