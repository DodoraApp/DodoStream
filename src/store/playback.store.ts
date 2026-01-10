import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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

export interface ProfilePlaybackState {
    subtitlePreference?: SubtitlePreference;
}

interface PlaybackState {
    activeProfileId?: string;
    byProfile: Record<string, ProfilePlaybackState>;

    // Cross-store sync
    setActiveProfileId: (profileId?: string) => void;

    // Selectors
    getActivePlaybackState: () => ProfilePlaybackState;

    // Mutations (active profile)
    setSubtitlePreference: (preference: SubtitlePreference) => void;
    clearSubtitlePreference: () => void;

    // Mutations (specific profile)
    setSubtitlePreferenceForProfile: (profileId: string, preference: SubtitlePreference) => void;
    clearSubtitlePreferenceForProfile: (profileId: string) => void;
}

const DEFAULT_PROFILE_PLAYBACK_STATE: ProfilePlaybackState = {};

export const usePlaybackStore = create<PlaybackState>()(
    persist(
        (set, get) => ({
            activeProfileId: undefined,
            byProfile: {},

            setActiveProfileId: (profileId) => {
                set({ activeProfileId: profileId });
            },

            getActivePlaybackState: () => {
                const profileId = get().activeProfileId;
                if (!profileId) return DEFAULT_PROFILE_PLAYBACK_STATE;
                return get().byProfile[profileId] ?? DEFAULT_PROFILE_PLAYBACK_STATE;
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

            setSubtitlePreferenceForProfile: (profileId, subtitlePreference) => {
                set((state) => ({
                    byProfile: {
                        ...state.byProfile,
                        [profileId]: {
                            ...(state.byProfile[profileId] ?? DEFAULT_PROFILE_PLAYBACK_STATE),
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
                            ...(state.byProfile[profileId] ?? DEFAULT_PROFILE_PLAYBACK_STATE),
                            subtitlePreference: undefined,
                        },
                    },
                }));
            },
        }),
        {
            name: 'playback-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({ byProfile: state.byProfile }),
            version: 1,
        }
    )
);
