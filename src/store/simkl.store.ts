import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist, subscribeWithSelector } from 'zustand/middleware';
import { createDebugLogger } from '@/utils/debug';

const debug = createDebugLogger('SimklStore');

export type SimklAuthStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface SimklPinState {
    userCode: string;
    verificationUrl?: string;
    createdAt: number;
    expiresAt?: number;
}

export interface ScrobbleSession {
    mediaKey: string;
    startedAt: number;
    hasStarted: boolean;
    hasFinished: boolean;
    lastProgress: number;
}

export interface OfflineQueueItem {
    type: 'scrobble-start' | 'scrobble-finish' | 'history-add';
    payload: unknown;
    createdAt: number;
}

export interface SimklProfileState {
    accessToken?: string;
    authStatus: SimklAuthStatus;
    authError?: string;

    pin?: SimklPinState;

    // Settings
    scrobblingEnabled: boolean;

    // Sync state
    lastActivitiesAt?: number;

    // Scrobble sessions (per media item)
    scrobbleSessions: Record<string, ScrobbleSession>;

    // Offline queue for failed requests
    offlineQueue: OfflineQueueItem[];
}

interface SimklState {
    activeProfileId?: string;
    byProfile: Record<string, SimklProfileState>;

    // Cross-store sync
    setActiveProfileId: (profileId?: string) => void;

    // Selectors
    getActiveSimkl: () => SimklProfileState;
    getAccessToken: () => string | undefined;
    isScrobblingEnabled: () => boolean;

    // Mutations (active profile)
    setAuthStatus: (status: SimklAuthStatus, error?: string) => void;
    setAccessToken: (token?: string) => void;
    setPin: (pin?: SimklPinState) => void;
    clearAuth: () => void;
    setLastActivitiesAt: (timestampMs: number) => void;
    setScrobblingEnabled: (enabled: boolean) => void;

    // Scrobble session management (active profile)
    getOrCreateSession: (mediaKey: string) => ScrobbleSession;
    updateSession: (mediaKey: string, updates: Partial<ScrobbleSession>) => void;
    clearSession: (mediaKey: string) => void;
    clearExpiredSessions: () => void;

    // Offline queue management (active profile)
    addToOfflineQueue: (item: OfflineQueueItem) => void;
    clearOfflineQueue: () => void;
    getOfflineQueue: () => OfflineQueueItem[];

    // Mutations (specific profile)
    setAuthStatusForProfile: (profileId: string, status: SimklAuthStatus, error?: string) => void;
    setAccessTokenForProfile: (profileId: string, token?: string) => void;
    setPinForProfile: (profileId: string, pin?: SimklPinState) => void;
    clearAuthForProfile: (profileId: string) => void;
    setLastActivitiesAtForProfile: (profileId: string, timestampMs: number) => void;
    setScrobblingEnabledForProfile: (profileId: string, enabled: boolean) => void;
}

const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export const DEFAULT_SIMKL_PROFILE_STATE: SimklProfileState = {
    authStatus: 'disconnected',
    scrobblingEnabled: true,
    scrobbleSessions: {},
    offlineQueue: [],
};

export const useSimklStore = create<SimklState>()(
    subscribeWithSelector(
        persist(
            (set, get) => ({
                activeProfileId: undefined,
                byProfile: {},

                setActiveProfileId: (profileId) => {
                    set({ activeProfileId: profileId });
                },

                getActiveSimkl: () => {
                    const profileId = get().activeProfileId;
                    if (!profileId) return DEFAULT_SIMKL_PROFILE_STATE;
                    return get().byProfile[profileId] ?? DEFAULT_SIMKL_PROFILE_STATE;
                },

                getAccessToken: () => {
                    const profileId = get().activeProfileId;
                    if (!profileId) return undefined;
                    return get().byProfile[profileId]?.accessToken;
                },

                isScrobblingEnabled: () => {
                    const profileId = get().activeProfileId;
                    if (!profileId) return false;
                    return get().byProfile[profileId]?.scrobblingEnabled ?? true;
                },

                setAuthStatus: (status, error) => {
                    const profileId = get().activeProfileId;
                    if (!profileId) return;
                    get().setAuthStatusForProfile(profileId, status, error);
                },

                setAccessToken: (token) => {
                    const profileId = get().activeProfileId;
                    if (!profileId) return;
                    get().setAccessTokenForProfile(profileId, token);
                },

                setPin: (pin) => {
                    const profileId = get().activeProfileId;
                    if (!profileId) return;
                    get().setPinForProfile(profileId, pin);
                },

                clearAuth: () => {
                    const profileId = get().activeProfileId;
                    if (!profileId) return;
                    get().clearAuthForProfile(profileId);
                },

                setLastActivitiesAt: (timestampMs) => {
                    const profileId = get().activeProfileId;
                    if (!profileId) return;
                    get().setLastActivitiesAtForProfile(profileId, timestampMs);
                },

                setScrobblingEnabled: (enabled) => {
                    const profileId = get().activeProfileId;
                    if (!profileId) return;
                    get().setScrobblingEnabledForProfile(profileId, enabled);
                },

                getOrCreateSession: (mediaKey) => {
                    const profileId = get().activeProfileId;
                    if (!profileId) {
                        return {
                            mediaKey,
                            startedAt: Date.now(),
                            hasStarted: false,
                            hasFinished: false,
                            lastProgress: 0,
                        };
                    }

                    const profile = get().byProfile[profileId] ?? DEFAULT_SIMKL_PROFILE_STATE;
                    const sessions = profile.scrobbleSessions ?? {};

                    if (sessions[mediaKey]) {
                        return sessions[mediaKey];
                    }

                    const newSession: ScrobbleSession = {
                        mediaKey,
                        startedAt: Date.now(),
                        hasStarted: false,
                        hasFinished: false,
                        lastProgress: 0,
                    };

                    set((state) => ({
                        byProfile: {
                            ...state.byProfile,
                            [profileId]: {
                                ...(state.byProfile[profileId] ?? DEFAULT_SIMKL_PROFILE_STATE),
                                scrobbleSessions: {
                                    ...(state.byProfile[profileId]?.scrobbleSessions ?? {}),
                                    [mediaKey]: newSession,
                                },
                            },
                        },
                    }));

                    return newSession;
                },

                updateSession: (mediaKey, updates) => {
                    const profileId = get().activeProfileId;
                    if (!profileId) return;

                    const profile = get().byProfile[profileId] ?? DEFAULT_SIMKL_PROFILE_STATE;
                    const sessions = profile.scrobbleSessions ?? {};
                    if (!sessions[mediaKey]) return;

                    set((state) => ({
                        byProfile: {
                            ...state.byProfile,
                            [profileId]: {
                                ...(state.byProfile[profileId] ?? DEFAULT_SIMKL_PROFILE_STATE),
                                scrobbleSessions: {
                                    ...(state.byProfile[profileId]?.scrobbleSessions ?? {}),
                                    [mediaKey]: { ...sessions[mediaKey], ...updates },
                                },
                            },
                        },
                    }));
                },

                clearSession: (mediaKey) => {
                    const profileId = get().activeProfileId;
                    if (!profileId) return;

                    const profile = get().byProfile[profileId] ?? DEFAULT_SIMKL_PROFILE_STATE;
                    const sessions = { ...(profile.scrobbleSessions ?? {}) };
                    delete sessions[mediaKey];

                    set((state) => ({
                        byProfile: {
                            ...state.byProfile,
                            [profileId]: {
                                ...(state.byProfile[profileId] ?? DEFAULT_SIMKL_PROFILE_STATE),
                                scrobbleSessions: sessions,
                            },
                        },
                    }));
                },

                clearExpiredSessions: () => {
                    const profileId = get().activeProfileId;
                    if (!profileId) return;

                    const now = Date.now();
                    const profile = get().byProfile[profileId] ?? DEFAULT_SIMKL_PROFILE_STATE;
                    const sessions = profile.scrobbleSessions ?? {};
                    const validSessions: Record<string, ScrobbleSession> = {};

                    for (const [key, session] of Object.entries(sessions)) {
                        if (now - session.startedAt < SESSION_EXPIRY_MS) {
                            validSessions[key] = session;
                        }
                    }

                    set((state) => ({
                        byProfile: {
                            ...state.byProfile,
                            [profileId]: {
                                ...(state.byProfile[profileId] ?? DEFAULT_SIMKL_PROFILE_STATE),
                                scrobbleSessions: validSessions,
                            },
                        },
                    }));
                },

                addToOfflineQueue: (item) => {
                    const profileId = get().activeProfileId;
                    if (!profileId) return;

                    set((state) => ({
                        byProfile: {
                            ...state.byProfile,
                            [profileId]: {
                                ...(state.byProfile[profileId] ?? DEFAULT_SIMKL_PROFILE_STATE),
                                offlineQueue: [
                                    ...(state.byProfile[profileId]?.offlineQueue ?? []),
                                    item,
                                ],
                            },
                        },
                    }));
                },

                clearOfflineQueue: () => {
                    const profileId = get().activeProfileId;
                    if (!profileId) return;

                    set((state) => ({
                        byProfile: {
                            ...state.byProfile,
                            [profileId]: {
                                ...(state.byProfile[profileId] ?? DEFAULT_SIMKL_PROFILE_STATE),
                                offlineQueue: [],
                            },
                        },
                    }));
                },

                getOfflineQueue: () => {
                    const profileId = get().activeProfileId;
                    if (!profileId) return [];
                    return get().byProfile[profileId]?.offlineQueue ?? [];
                },

                setAuthStatusForProfile: (profileId, authStatus, authError) => {
                    debug('setAuthStatus', { profileId, authStatus, hasError: !!authError });
                    set((state) => ({
                        byProfile: {
                            ...state.byProfile,
                            [profileId]: {
                                ...(state.byProfile[profileId] ?? DEFAULT_SIMKL_PROFILE_STATE),
                                authStatus,
                                authError,
                            },
                        },
                    }));
                },

                setAccessTokenForProfile: (profileId, accessToken) => {
                    debug('setAccessToken', { profileId, hasToken: !!accessToken });
                    set((state) => ({
                        byProfile: {
                            ...state.byProfile,
                            [profileId]: {
                                ...(state.byProfile[profileId] ?? DEFAULT_SIMKL_PROFILE_STATE),
                                accessToken,
                                authStatus: accessToken ? 'connected' : 'disconnected',
                                authError: undefined,
                            },
                        },
                    }));
                },

                setPinForProfile: (profileId, pin) => {
                    debug('setPin', { profileId, hasPin: !!pin });
                    set((state) => ({
                        byProfile: {
                            ...state.byProfile,
                            [profileId]: {
                                ...(state.byProfile[profileId] ?? DEFAULT_SIMKL_PROFILE_STATE),
                                pin,
                            },
                        },
                    }));
                },

                clearAuthForProfile: (profileId) => {
                    debug('clearAuth', { profileId });
                    set((state) => ({
                        byProfile: {
                            ...state.byProfile,
                            [profileId]: {
                                ...DEFAULT_SIMKL_PROFILE_STATE,
                            },
                        },
                    }));
                },

                setLastActivitiesAtForProfile: (profileId, lastActivitiesAt) => {
                    set((state) => ({
                        byProfile: {
                            ...state.byProfile,
                            [profileId]: {
                                ...(state.byProfile[profileId] ?? DEFAULT_SIMKL_PROFILE_STATE),
                                lastActivitiesAt,
                            },
                        },
                    }));
                },

                setScrobblingEnabledForProfile: (profileId, scrobblingEnabled) => {
                    debug('setScrobblingEnabled', { profileId, scrobblingEnabled });
                    set((state) => ({
                        byProfile: {
                            ...state.byProfile,
                            [profileId]: {
                                ...(state.byProfile[profileId] ?? DEFAULT_SIMKL_PROFILE_STATE),
                                scrobblingEnabled,
                            },
                        },
                    }));
                },
            }),
            {
                name: 'simkl-storage',
                storage: createJSONStorage(() => AsyncStorage),
                partialize: (state) => ({ byProfile: state.byProfile }),
            }
        )
    )
);
