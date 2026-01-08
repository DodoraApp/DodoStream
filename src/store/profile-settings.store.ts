import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { PlayerType } from '@/types/player';

export interface ProfilePlaybackSettings {
  player: PlayerType;
  automaticFallback: boolean;
  autoPlayFirstStream: boolean;
  preferredAudioLanguages?: string[];
  preferredSubtitleLanguages?: string[];
}

interface ProfileSettingsState {
  activeProfileId?: string;
  byProfile: Record<string, ProfilePlaybackSettings>;

  // Cross-store sync
  setActiveProfileId: (profileId?: string) => void;

  // Selectors
  getActiveSettings: () => ProfilePlaybackSettings;

  // Mutations (active profile)
  setPlayer: (player: PlayerType) => void;
  setAutomaticFallback: (automaticFallback: boolean) => void;
  setAutoPlayFirstStream: (autoPlayFirstStream: boolean) => void;
  setPreferredAudioLanguages: (languages: string[]) => void;
  setPreferredSubtitleLanguages: (languages: string[]) => void;

  // Mutations (specific profile)
  setPlayerForProfile: (profileId: string, player: PlayerType) => void;
  setAutomaticFallbackForProfile: (profileId: string, automaticFallback: boolean) => void;
  setAutoPlayFirstStreamForProfile: (profileId: string, autoPlayFirstStream: boolean) => void;
  setPreferredAudioLanguagesForProfile: (profileId: string, languages: string[]) => void;
  setPreferredSubtitleLanguagesForProfile: (profileId: string, languages: string[]) => void;
}

export const DEFAULT_PROFILE_PLAYBACK_SETTINGS: ProfilePlaybackSettings = {
  player: 'exoplayer',
  automaticFallback: true,
  autoPlayFirstStream: false,
};

export const useProfileSettingsStore = create<ProfileSettingsState>()(
  persist(
    (set, get) => ({
      activeProfileId: undefined,
      byProfile: {},

      setActiveProfileId: (profileId) => {
        set({ activeProfileId: profileId });
      },

      getActiveSettings: () => {
        const profileId = get().activeProfileId;
        if (!profileId) return DEFAULT_PROFILE_PLAYBACK_SETTINGS;
        return get().byProfile[profileId] ?? DEFAULT_PROFILE_PLAYBACK_SETTINGS;
      },

      setPlayer: (player) => {
        const profileId = get().activeProfileId;
        if (!profileId) return;
        get().setPlayerForProfile(profileId, player);
      },

      setAutomaticFallback: (automaticFallback) => {
        const profileId = get().activeProfileId;
        if (!profileId) return;
        get().setAutomaticFallbackForProfile(profileId, automaticFallback);
      },

      setAutoPlayFirstStream: (autoPlayFirstStream) => {
        const profileId = get().activeProfileId;
        if (!profileId) return;
        get().setAutoPlayFirstStreamForProfile(profileId, autoPlayFirstStream);
      },

      setPreferredAudioLanguages: (languages) => {
        const profileId = get().activeProfileId;
        if (!profileId) return;
        get().setPreferredAudioLanguagesForProfile(profileId, languages);
      },

      setPreferredSubtitleLanguages: (languages) => {
        const profileId = get().activeProfileId;
        if (!profileId) return;
        get().setPreferredSubtitleLanguagesForProfile(profileId, languages);
      },

      setPlayerForProfile: (profileId, player) => {
        set((state) => ({
          byProfile: {
            ...state.byProfile,
            [profileId]: {
              ...(state.byProfile[profileId] ?? DEFAULT_PROFILE_PLAYBACK_SETTINGS),
              player,
            },
          },
        }));
      },

      setAutomaticFallbackForProfile: (profileId, automaticFallback) => {
        set((state) => ({
          byProfile: {
            ...state.byProfile,
            [profileId]: {
              ...(state.byProfile[profileId] ?? DEFAULT_PROFILE_PLAYBACK_SETTINGS),
              automaticFallback,
            },
          },
        }));
      },

      setAutoPlayFirstStreamForProfile: (profileId, autoPlayFirstStream) => {
        set((state) => ({
          byProfile: {
            ...state.byProfile,
            [profileId]: {
              ...(state.byProfile[profileId] ?? DEFAULT_PROFILE_PLAYBACK_SETTINGS),
              autoPlayFirstStream,
            },
          },
        }));
      },

      setPreferredAudioLanguagesForProfile: (profileId, preferredAudioLanguages) => {
        set((state) => ({
          byProfile: {
            ...state.byProfile,
            [profileId]: {
              ...(state.byProfile[profileId] ?? DEFAULT_PROFILE_PLAYBACK_SETTINGS),
              preferredAudioLanguages,
            },
          },
        }));
      },

      setPreferredSubtitleLanguagesForProfile: (profileId, preferredSubtitleLanguages) => {
        set((state) => ({
          byProfile: {
            ...state.byProfile,
            [profileId]: {
              ...(state.byProfile[profileId] ?? DEFAULT_PROFILE_PLAYBACK_SETTINGS),
              preferredSubtitleLanguages,
            },
          },
        }));
      },
    }),
    {
      name: 'profile-settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ byProfile: state.byProfile }),
      version: 1,
      migrate: (persistedState, version) => {
        if (!persistedState) return persistedState;
        const state = persistedState as { byProfile: Record<string, ProfilePlaybackSettings> };
        if (version === 0) {
          const migratedByProfile: Record<string, ProfilePlaybackSettings> = {};
          for (const [profileId, settings] of Object.entries(state.byProfile)) {
            migratedByProfile[profileId] = {
              ...settings,
              autoPlayFirstStream: settings.autoPlayFirstStream ?? false,
            };
          }
          return { ...persistedState, byProfile: migratedByProfile };
        }

        return persistedState;
      },
    }
  )
);
