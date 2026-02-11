import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { pushSyncOperation } from '@/api/sync/bridge';

export interface ContinueWatchingProfileState {
    /** Hidden meta IDs (hide from the home Continue Watching row). */
    hidden: Record<string, true>;
}

interface ContinueWatchingState {
    activeProfileId?: string;
    byProfile: Record<string, ContinueWatchingProfileState>;

    // Cross-store sync
    setActiveProfileId: (profileId?: string) => void;

    // Selectors (active profile)
    isHidden: (metaId: string) => boolean;
    getHiddenMetaIds: () => Record<string, true>;

    // Mutations (active profile)
    setHidden: (metaId: string, hidden: boolean) => void;
    clearHidden: () => void;
}

const DEFAULT_PROFILE_STATE: ContinueWatchingProfileState = { hidden: {} };

export const useContinueWatchingStore = create<ContinueWatchingState>()(
    persist(
        (set, get) => ({
            activeProfileId: undefined,
            byProfile: {},

            setActiveProfileId: (profileId) => {
                set({ activeProfileId: profileId });
            },

            isHidden: (metaId) => {
                const profileId = get().activeProfileId;
                if (!profileId) return false;
                return Boolean(get().byProfile[profileId]?.hidden?.[metaId]);
            },

            getHiddenMetaIds: () => {
                const profileId = get().activeProfileId;
                if (!profileId) return {};
                return get().byProfile[profileId]?.hidden ?? {};
            },

            setHidden: (metaId, hidden) => {
                const profileId = get().activeProfileId;
                if (!profileId) return;

                if(get().isHidden(metaId) === hidden) return;

                set((state) => {
                    const current = state.byProfile[profileId] ?? DEFAULT_PROFILE_STATE;
                    const currentHidden = current.hidden ?? {};
                    const nextHidden: Record<string, true> = hidden
                        ? ({ ...currentHidden, [metaId]: true as const } as Record<string, true>)
                        : (() => {
                            const { [metaId]: _removed, ...rest } = currentHidden;
                            return rest as Record<string, true>;
                        })();

                    return {
                        byProfile: {
                            ...state.byProfile,
                            [profileId]: {
                                ...current,
                                hidden: nextHidden,
                            },
                        },
                    };
                });

                pushSyncOperation({
                    collection: 'continue_watching',
                    action: 'set_hidden',
                    payload: { metaId, hidden, profileId },
                });
            },

            clearHidden: () => {
                const profileId = get().activeProfileId;
                if (!profileId) return;
                set((state) => ({
                    byProfile: {
                        ...state.byProfile,
                        [profileId]: {
                            ...(state.byProfile[profileId] ?? DEFAULT_PROFILE_STATE),
                            hidden: {},
                        },
                    },
                }));

                pushSyncOperation({
                    collection: 'continue_watching',
                    action: 'clear_hidden',
                    payload: { profileId },
                });
            },
        }),
        {
            name: 'continue-watching-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({ byProfile: state.byProfile }),
            version: 1,
        }
    )
);
