import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { PlayerType } from '@/types/player';
import type { SubtitleStyle } from '@/types/subtitles';

export interface ProfilePlaybackSettings {
  player: PlayerType;
  automaticFallback: boolean;
  autoPlayFirstStream: boolean;
  showVideoStatistics: boolean;
  preferredAudioLanguages?: string[];
  preferredSubtitleLanguages?: string[];
  subtitleStyle?: SubtitleStyle;
  // Android & ExoPlayer-specific settings
  tunneled: boolean;
  audioPassthrough: boolean;
  enableWorkarounds: boolean;
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
  setShowVideoStatistics: (showVideoStatistics: boolean) => void;
  setPreferredAudioLanguages: (languages: string[]) => void;
  setPreferredSubtitleLanguages: (languages: string[]) => void;
  setSubtitleStyle: (style: SubtitleStyle) => void;
  setTunneled: (tunneled: boolean) => void;
  setAudioPassthrough: (audioPassthrough: boolean) => void;
  setEnableWorkarounds: (enableWorkarounds: boolean) => void;

  // Mutations (specific profile)
  setPlayerForProfile: (profileId: string, player: PlayerType) => void;
  setAutomaticFallbackForProfile: (profileId: string, automaticFallback: boolean) => void;
  setAutoPlayFirstStreamForProfile: (profileId: string, autoPlayFirstStream: boolean) => void;
  setShowVideoStatisticsForProfile: (profileId: string, showVideoStatistics: boolean) => void;
  setPreferredAudioLanguagesForProfile: (profileId: string, languages: string[]) => void;
  setPreferredSubtitleLanguagesForProfile: (profileId: string, languages: string[]) => void;
  setSubtitleStyleForProfile: (profileId: string, style: SubtitleStyle) => void;
  setTunneledForProfile: (profileId: string, tunneled: boolean) => void;
  setAudioPassthroughForProfile: (profileId: string, audioPassthrough: boolean) => void;
  setEnableWorkaroundsForProfile: (profileId: string, enableWorkarounds: boolean) => void;
}

export const DEFAULT_PROFILE_PLAYBACK_SETTINGS: ProfilePlaybackSettings = {
  player: 'exoplayer',
  automaticFallback: true,
  autoPlayFirstStream: false,
  showVideoStatistics: false,
  tunneled: false,
  audioPassthrough: false,
  enableWorkarounds: true,
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

      setShowVideoStatistics: (showVideoStatistics) => {
        const profileId = get().activeProfileId;
        if (!profileId) return;
        get().setShowVideoStatisticsForProfile(profileId, showVideoStatistics);
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

      setSubtitleStyle: (style) => {
        const profileId = get().activeProfileId;
        if (!profileId) return;
        get().setSubtitleStyleForProfile(profileId, style);
      },

      setTunneled: (tunneled) => {
        const profileId = get().activeProfileId;
        if (!profileId) return;
        get().setTunneledForProfile(profileId, tunneled);
      },

      setAudioPassthrough: (audioPassthrough) => {
        const profileId = get().activeProfileId;
        if (!profileId) return;
        get().setAudioPassthroughForProfile(profileId, audioPassthrough);
      },

      setEnableWorkarounds: (enableWorkarounds) => {
        const profileId = get().activeProfileId;
        if (!profileId) return;
        get().setEnableWorkaroundsForProfile(profileId, enableWorkarounds);
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

      setShowVideoStatisticsForProfile: (profileId, showVideoStatistics) => {
        set((state) => ({
          byProfile: {
            ...state.byProfile,
            [profileId]: {
              ...(state.byProfile[profileId] ?? DEFAULT_PROFILE_PLAYBACK_SETTINGS),
              showVideoStatistics,
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

      setSubtitleStyleForProfile: (profileId, subtitleStyle) => {
        set((state) => ({
          byProfile: {
            ...state.byProfile,
            [profileId]: {
              ...(state.byProfile[profileId] ?? DEFAULT_PROFILE_PLAYBACK_SETTINGS),
              subtitleStyle,
            },
          },
        }));
      },

      setTunneledForProfile: (profileId, tunneled) => {
        set((state) => ({
          byProfile: {
            ...state.byProfile,
            [profileId]: {
              ...(state.byProfile[profileId] ?? DEFAULT_PROFILE_PLAYBACK_SETTINGS),
              tunneled,
            },
          },
        }));
      },

      setAudioPassthroughForProfile: (profileId, audioPassthrough) => {
        set((state) => ({
          byProfile: {
            ...state.byProfile,
            [profileId]: {
              ...(state.byProfile[profileId] ?? DEFAULT_PROFILE_PLAYBACK_SETTINGS),
              audioPassthrough,
            },
          },
        }));
      },

      setEnableWorkaroundsForProfile: (profileId, enableWorkarounds) => {
        set((state) => ({
          byProfile: {
            ...state.byProfile,
            [profileId]: {
              ...(state.byProfile[profileId] ?? DEFAULT_PROFILE_PLAYBACK_SETTINGS),
              enableWorkarounds,
            },
          },
        }));
      },
    }),
    {
      name: 'profile-settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ byProfile: state.byProfile }),
      version: 3,
      migrate: (persistedState, version) => {
        if (!persistedState) return persistedState;
        const state = persistedState as { byProfile: Record<string, ProfilePlaybackSettings> };
        if (version === 0) {
          const migratedByProfile: Record<string, ProfilePlaybackSettings> = {};
          for (const [profileId, settings] of Object.entries(state.byProfile)) {
            migratedByProfile[profileId] = {
              ...settings,
              autoPlayFirstStream: settings.autoPlayFirstStream ?? false,
              showVideoStatistics: settings.showVideoStatistics ?? false,

              tunneled: false,
              audioPassthrough: false,
              enableWorkarounds: true,
            };
          }
          return { ...persistedState, byProfile: migratedByProfile };
        }

        if (version === 1) {
          const migratedByProfile: Record<string, ProfilePlaybackSettings> = {};
          for (const [profileId, settings] of Object.entries(state.byProfile)) {
            migratedByProfile[profileId] = {
              ...settings,
              showVideoStatistics: settings.showVideoStatistics ?? false,
              tunneled: settings.tunneled ?? false,
              audioPassthrough: settings.audioPassthrough ?? false,
              enableWorkarounds: settings.enableWorkarounds ?? true,
            };
          }
          return { ...persistedState, byProfile: migratedByProfile };
        }

        if (version === 2) {
          const migratedByProfile: Record<string, ProfilePlaybackSettings> = {};
          for (const [profileId, settings] of Object.entries(state.byProfile)) {
            migratedByProfile[profileId] = {
              ...settings,
              showVideoStatistics: settings.showVideoStatistics ?? false,
            };
          }
          return { ...persistedState, byProfile: migratedByProfile };
        }

        return persistedState;
      },
    }
  )
);
