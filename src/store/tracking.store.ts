import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createDebugLogger } from '@/utils/debug';

const debug = createDebugLogger('TrackingStore');

export type TrackingProviderId = 'simkl';

export type TrackingSyncStatus = 'idle' | 'syncing' | 'error';

export interface TrackingProfileState {
    provider?: TrackingProviderId;
    enabled: boolean;
    autoSyncEnabled: boolean;

    lastSyncAt?: number;
    syncStatus: TrackingSyncStatus;
    syncError?: string;
}

interface TrackingState {
    activeProfileId?: string;
    byProfile: Record<string, TrackingProfileState>;

    // Cross-store sync
    setActiveProfileId: (profileId?: string) => void;

    // Selectors
    getActiveTracking: () => TrackingProfileState;

    // Mutations (active profile)
    setEnabled: (enabled: boolean) => void;
    setProvider: (provider: TrackingProviderId | undefined) => void;
    setAutoSyncEnabled: (autoSyncEnabled: boolean) => void;
    setSyncStatus: (status: TrackingSyncStatus, error?: string) => void;
    setLastSyncAt: (timestampMs: number) => void;
    reset: () => void;

    // Mutations (specific profile)
    setEnabledForProfile: (profileId: string, enabled: boolean) => void;
    setProviderForProfile: (profileId: string, provider: TrackingProviderId | undefined) => void;
    setAutoSyncEnabledForProfile: (profileId: string, autoSyncEnabled: boolean) => void;
    setSyncStatusForProfile: (profileId: string, status: TrackingSyncStatus, error?: string) => void;
    setLastSyncAtForProfile: (profileId: string, timestampMs: number) => void;
    resetForProfile: (profileId: string) => void;
}

export const DEFAULT_TRACKING_PROFILE_STATE: TrackingProfileState = {
    provider: 'simkl',
    enabled: false,
    autoSyncEnabled: true,
    syncStatus: 'idle',
};

export const useTrackingStore = create<TrackingState>()(
    persist(
        (set, get) => ({
            activeProfileId: undefined,
            byProfile: {},

            setActiveProfileId: (profileId) => {
                set({ activeProfileId: profileId });
            },

            getActiveTracking: () => {
                const profileId = get().activeProfileId;
                if (!profileId) return DEFAULT_TRACKING_PROFILE_STATE;
                return get().byProfile[profileId] ?? DEFAULT_TRACKING_PROFILE_STATE;
            },

            setEnabled: (enabled) => {
                const profileId = get().activeProfileId;
                if (!profileId) return;
                get().setEnabledForProfile(profileId, enabled);
            },

            setProvider: (provider) => {
                const profileId = get().activeProfileId;
                if (!profileId) return;
                get().setProviderForProfile(profileId, provider);
            },

            setAutoSyncEnabled: (autoSyncEnabled) => {
                const profileId = get().activeProfileId;
                if (!profileId) return;
                get().setAutoSyncEnabledForProfile(profileId, autoSyncEnabled);
            },

            setSyncStatus: (status, error) => {
                const profileId = get().activeProfileId;
                if (!profileId) return;
                get().setSyncStatusForProfile(profileId, status, error);
            },

            setLastSyncAt: (timestampMs) => {
                const profileId = get().activeProfileId;
                if (!profileId) return;
                get().setLastSyncAtForProfile(profileId, timestampMs);
            },

            reset: () => {
                const profileId = get().activeProfileId;
                if (!profileId) return;
                get().resetForProfile(profileId);
            },

            setEnabledForProfile: (profileId, enabled) => {
                debug('setEnabled', { profileId, enabled });
                set((state) => ({
                    byProfile: {
                        ...state.byProfile,
                        [profileId]: {
                            ...(state.byProfile[profileId] ?? DEFAULT_TRACKING_PROFILE_STATE),
                            enabled,
                        },
                    },
                }));
            },

            setProviderForProfile: (profileId, provider) => {
                debug('setProvider', { profileId, provider });
                set((state) => ({
                    byProfile: {
                        ...state.byProfile,
                        [profileId]: {
                            ...(state.byProfile[profileId] ?? DEFAULT_TRACKING_PROFILE_STATE),
                            provider,
                        },
                    },
                }));
            },

            setAutoSyncEnabledForProfile: (profileId, autoSyncEnabled) => {
                debug('setAutoSyncEnabled', { profileId, autoSyncEnabled });
                set((state) => ({
                    byProfile: {
                        ...state.byProfile,
                        [profileId]: {
                            ...(state.byProfile[profileId] ?? DEFAULT_TRACKING_PROFILE_STATE),
                            autoSyncEnabled,
                        },
                    },
                }));
            },

            setSyncStatusForProfile: (profileId, syncStatus, syncError) => {
                debug('setSyncStatus', { profileId, syncStatus, syncError });
                set((state) => ({
                    byProfile: {
                        ...state.byProfile,
                        [profileId]: {
                            ...(state.byProfile[profileId] ?? DEFAULT_TRACKING_PROFILE_STATE),
                            syncStatus,
                            syncError,
                        },
                    },
                }));
            },

            setLastSyncAtForProfile: (profileId, lastSyncAt) => {
                debug('setLastSyncAt', { profileId, lastSyncAt: new Date(lastSyncAt).toISOString() });
                set((state) => ({
                    byProfile: {
                        ...state.byProfile,
                        [profileId]: {
                            ...(state.byProfile[profileId] ?? DEFAULT_TRACKING_PROFILE_STATE),
                            lastSyncAt,
                        },
                    },
                }));
            },

            resetForProfile: (profileId) => {
                debug('reset', { profileId });
                set((state) => ({
                    byProfile: {
                        ...state.byProfile,
                        [profileId]: {
                            ...DEFAULT_TRACKING_PROFILE_STATE,
                        },
                    },
                }));
            },
        }),
        {
            name: 'tracking-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({ byProfile: state.byProfile }),
        }
    )
);
