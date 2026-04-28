import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { PlayerType } from '@/types/player';
import type { SubtitleStyle } from '@/types/subtitles';

/**
 * Remembered subtitle preference for automatic reselection.
 * We store the addon ID/name and language so we can find a matching track
 * when starting a new video.
 */
export interface SubtitlePreference {
  /** 'video' for embedded subtitles, 'addon' for external addon subtitles */
  source: 'video' | 'addon';
  /** Normalized language code (e.g., 'en', 'de') */
  language?: string;
  /** Addon ID for addon-provided subtitles */
  addonId?: string;
  /** Addon name for display/matching purposes */
  addonName?: string;
}

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
  matchFrameRate: boolean;
  enableVideoSoftwareDecoding: boolean;
  // Skip intro feature (IntroDB)
  skipIntroEnabled: boolean;
  // Previously from playback.store.ts
  subtitlePreference?: SubtitlePreference;
}

export const DEFAULT_PROFILE_PLAYBACK_SETTINGS: ProfilePlaybackSettings = {
  player: 'exoplayer',
  automaticFallback: true,
  autoPlayFirstStream: false,
  showVideoStatistics: false,
  tunneled: false,
  audioPassthrough: false,
  enableWorkarounds: true,
  matchFrameRate: false,
  enableVideoSoftwareDecoding: false,
  skipIntroEnabled: false,
};

interface PlaybackState {
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
  setMatchFrameRate: (matchFrameRate: boolean) => void;
  setEnableVideoSoftwareDecoding: (enableVideoSoftwareDecoding: boolean) => void;
  setSkipIntroEnabled: (skipIntroEnabled: boolean) => void;
  setSubtitlePreference: (preference: SubtitlePreference) => void;
  clearSubtitlePreference: () => void;

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
  setMatchFrameRateForProfile: (profileId: string, matchFrameRate: boolean) => void;
  setEnableVideoSoftwareDecodingForProfile: (
    profileId: string,
    enableVideoSoftwareDecoding: boolean
  ) => void;
  setSkipIntroEnabledForProfile: (profileId: string, skipIntroEnabled: boolean) => void;
  setSubtitlePreferenceForProfile: (profileId: string, preference: SubtitlePreference) => void;
  clearSubtitlePreferenceForProfile: (profileId: string) => void;
}

export const usePlaybackStore = create<PlaybackState>()(
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
        if (!profileId) return DEFAULT_PROFILE_PLAYBACK_SETTINGS;
        const profileSettings = get().byProfile[profileId];
        if (!profileSettings) return DEFAULT_PROFILE_PLAYBACK_SETTINGS;
        return { ...DEFAULT_PROFILE_PLAYBACK_SETTINGS, ...profileSettings };
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

      setMatchFrameRate: (matchFrameRate) => {
        const profileId = get().activeProfileId;
        if (!profileId) return;
        get().setMatchFrameRateForProfile(profileId, matchFrameRate);
      },

      setEnableVideoSoftwareDecoding: (enableVideoSoftwareDecoding) => {
        const profileId = get().activeProfileId;
        if (!profileId) return;
        get().setEnableVideoSoftwareDecodingForProfile(profileId, enableVideoSoftwareDecoding);
      },

      setSkipIntroEnabled: (skipIntroEnabled) => {
        const profileId = get().activeProfileId;
        if (!profileId) return;
        get().setSkipIntroEnabledForProfile(profileId, skipIntroEnabled);
      },

      setSubtitlePreference: (preference) => {
        const profileId = get().activeProfileId;
        if (!profileId) return;
        get().setSubtitlePreferenceForProfile(profileId, preference);
      },

      clearSubtitlePreference: () => {
        const profileId = get().activeProfileId;
        if (!profileId) return;
        get().clearSubtitlePreferenceForProfile(profileId);
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

      setMatchFrameRateForProfile: (profileId, matchFrameRate) => {
        set((state) => ({
          byProfile: {
            ...state.byProfile,
            [profileId]: {
              ...(state.byProfile[profileId] ?? DEFAULT_PROFILE_PLAYBACK_SETTINGS),
              matchFrameRate,
            },
          },
        }));
      },

      setEnableVideoSoftwareDecodingForProfile: (profileId, enableVideoSoftwareDecoding) => {
        set((state) => ({
          byProfile: {
            ...state.byProfile,
            [profileId]: {
              ...(state.byProfile[profileId] ?? DEFAULT_PROFILE_PLAYBACK_SETTINGS),
              enableVideoSoftwareDecoding,
            },
          },
        }));
      },

      setSkipIntroEnabledForProfile: (profileId, skipIntroEnabled) => {
        set((state) => ({
          byProfile: {
            ...state.byProfile,
            [profileId]: {
              ...(state.byProfile[profileId] ?? DEFAULT_PROFILE_PLAYBACK_SETTINGS),
              skipIntroEnabled,
            },
          },
        }));
      },

      setSubtitlePreferenceForProfile: (profileId, subtitlePreference) => {
        set((state) => ({
          byProfile: {
            ...state.byProfile,
            [profileId]: {
              ...(state.byProfile[profileId] ?? DEFAULT_PROFILE_PLAYBACK_SETTINGS),
              subtitlePreference,
            },
          },
        }));
      },

      clearSubtitlePreferenceForProfile: (profileId) => {
        set((state) => ({
          byProfile: {
            ...state.byProfile,
            [profileId]: {
              ...(state.byProfile[profileId] ?? DEFAULT_PROFILE_PLAYBACK_SETTINGS),
              subtitlePreference: undefined,
            },
          },
        }));
      },
    }),
    {
      name: 'playback-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    }
  )
);
