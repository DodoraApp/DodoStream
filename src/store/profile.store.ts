import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AVATAR_ICONS, AVATAR_COLORS } from '@/constants/profiles';
import { createDebugLogger } from '@/utils/debug';
import { useMyListStore } from '@/store/my-list.store';
import { usePlaybackStore } from '@/store/playback.store';
import { useProfileSettingsStore } from '@/store/profile-settings.store';
import { useWatchHistoryStore } from '@/store/watch-history.store';
import { useContinueWatchingStore } from '@/store/continue-watching.store';
import { useHomeStore } from '@/store/home.store';

export interface Profile extends ProfileOptions {
    id: string;
    name: string;
    createdAt: number;
    lastUsedAt: number;
}

export interface ProfileOptions {
    avatarIcon?: string;
    avatarColor?: string;
    pin?: string;
}

interface ProfileState {
    profiles: Record<string, Profile>;
    activeProfileId?: string;
    isInitialized: boolean;

    // Actions
    createProfile: (name: string, options?: ProfileOptions) => string;
    deleteProfile: (id: string) => void;
    switchProfile: (id: string, pin?: string) => boolean;
    updateProfile: (id: string, updates: Partial<Profile>) => void;
    getActiveProfile: () => Profile | undefined;
    clearActiveProfile: () => void;
    getProfilesList: () => Profile[];
    setInitialized: (isInitialized: boolean) => void;
}

// Generate a simple unique ID
const generateId = (): string => {
    return `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const getRandomItem = <T,>(array: T[]): T => {
    return array[Math.floor(Math.random() * array.length)];
};

const debug = createDebugLogger('ProfileStore');

export const useProfileStore = create<ProfileState>()(
    persist(
        (set, get) => ({
            // Initial state
            profiles: {},
            activeProfileId: undefined,
            isInitialized: false,

            clearActiveProfile: () => {
                set((state) => ({
                    ...state,
                    activeProfileId: undefined
                }));
            },

            createProfile: (name: string, options?: ProfileOptions) => {
                const id = generateId();
                const newProfile: Profile = {
                    id,
                    name,
                    avatarIcon: options?.avatarIcon || getRandomItem(AVATAR_ICONS),
                    avatarColor: options?.avatarColor || getRandomItem(AVATAR_COLORS),
                    pin: options?.pin,
                    createdAt: Date.now(),
                    lastUsedAt: Date.now(),
                };

                set((state) => ({
                    profiles: {
                        ...state.profiles,
                        [id]: newProfile,
                    },
                }));

                return id;
            },

            deleteProfile: (id: string) => {
                const { profiles, activeProfileId } = get();

                // Prevent deleting if it's the only profile
                if (Object.keys(profiles).length === 1) {
                    debug('cannotDeleteLastProfile', { id, profilesCount: Object.keys(profiles).length });
                    return;
                }

                // If deleting active profile, switch to another one
                if (activeProfileId === id) {
                    const remainingProfiles = Object.keys(profiles).filter((pid) => pid !== id);
                    if (remainingProfiles.length > 0) {
                        set({ activeProfileId: remainingProfiles[0] });
                    }
                }

                set((state) => {
                    const { [id]: removed, ...rest } = state.profiles;
                    return { profiles: rest };
                });

                // Clean up profile data from AsyncStorage
                AsyncStorage.removeItem(`profile-${id}-watch-history`).catch((error) => {
                    debug('removeProfileStorageFailed', { id, key: `profile-${id}-watch-history`, error });
                });
                AsyncStorage.removeItem(`profile-${id}-my-list`).catch((error) => {
                    debug('removeProfileStorageFailed', { id, key: `profile-${id}-my-list`, error });
                });
                AsyncStorage.removeItem(`profile-${id}-settings`).catch((error) => {
                    debug('removeProfileStorageFailed', { id, key: `profile-${id}-settings`, error });
                });
            },

            switchProfile: (id: string, pin?: string) => {
                const { profiles } = get();
                const profile = profiles[id];

                if (!profile) {
                    debug('profileNotFoundOnSwitch', { id });
                    return false;
                }

                if (profile.pin && profile.pin !== pin) {
                    debug('invalidPinOnSwitch', { id });
                    return false;
                }

                set({
                    activeProfileId: id,
                    profiles: {
                        ...profiles,
                        [id]: {
                            ...profile,
                            lastUsedAt: Date.now(),
                        },
                    },
                });

                return true;
            },

            updateProfile: (id: string, updates: Partial<Profile>) => {
                const { profiles } = get();
                const profile = profiles[id];

                if (!profile) {
                    debug('profileNotFoundOnUpdate', { id });
                    return;
                }

                set((state) => ({
                    profiles: {
                        ...state.profiles,
                        [id]: {
                            ...profile,
                            ...updates,
                            id, // Ensure ID cannot be changed
                            createdAt: profile.createdAt, // Ensure createdAt cannot be changed
                        },
                    },
                }));
            },

            getActiveProfile: () => {
                const { profiles, activeProfileId } = get();
                if (!activeProfileId) return undefined;
                return profiles[activeProfileId];
            },

            getProfilesList: () => {
                const { profiles } = get();
                return Object.values(profiles).sort((a, b) => b.lastUsedAt - a.lastUsedAt);
            },

            setInitialized: (isInitialized: boolean) => {
                set({ isInitialized });
            },
        }),
        {
            name: 'profiles-registry',
            storage: createJSONStorage(() => AsyncStorage),
            // Persist only the profile registry; keep runtime-only fields out of disk state.
            partialize: (state) => ({ profiles: state.profiles }),
        }
    )
);

// Sync active profile into dependent stores (one-way).
const syncActiveProfileId = (profileId?: string) => {
    useMyListStore.getState().setActiveProfileId(profileId);
    usePlaybackStore.getState().setActiveProfileId(profileId);
    useProfileSettingsStore.getState().setActiveProfileId(profileId);
    useWatchHistoryStore.getState().setActiveProfileId(profileId);
    useContinueWatchingStore.getState().setActiveProfileId(profileId);
    useHomeStore.getState().setActiveProfileId(profileId);
};

let lastSyncedProfileId: string | undefined = useProfileStore.getState().activeProfileId;
syncActiveProfileId(lastSyncedProfileId);

useProfileStore.subscribe((state) => {
    const nextActiveProfileId = state.activeProfileId;
    if (nextActiveProfileId === lastSyncedProfileId) return;
    lastSyncedProfileId = nextActiveProfileId;
    syncActiveProfileId(nextActiveProfileId);
});

// Initialize profiles system on app start
export const initializeProfiles = async () => {
    const { profiles, setInitialized, clearActiveProfile, createProfile, switchProfile, isInitialized } = useProfileStore.getState();

    // IMPORTANT: initializeProfiles can be called more than once (e.g. remounts).
    // Never clear the active profile after the app has already initialized.
    if (isInitialized) return;

    // If no profiles exist, create a default one
    if (Object.keys(profiles).length === 0) {
        const defaultProfileId = createProfile('Default');
        switchProfile(defaultProfileId);
    }

    clearActiveProfile();
    setInitialized(true);
};
