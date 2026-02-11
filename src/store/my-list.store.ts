import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ContentType } from '@/types/stremio';
import { pushSyncOperation } from '@/api/sync/bridge';

export interface MyListItem {
  id: string;
  type: ContentType;
  addedAt: number;
}

interface MyListState {
  activeProfileId?: string;
  byProfile: Record<string, Record<string, MyListItem>>;

  // Cross-store sync
  setActiveProfileId: (profileId?: string) => void;

  // Queries
  getActiveList: () => MyListItem[];
  isInMyList: (id: string, type: ContentType) => boolean;

  // Mutations
  addToMyList: (item: Omit<MyListItem, 'addedAt'>) => void;
  removeFromMyList: (id: string, type: ContentType) => void;
  toggleMyList: (item: Omit<MyListItem, 'addedAt'>) => boolean; // returns new isInList
}

const getMyListKey = (id: string, type: ContentType) => `${type}:${id}`;

const computeActiveList = (
  byProfile: Record<string, Record<string, MyListItem>>,
  activeProfileId?: string
): MyListItem[] => {
  if (!activeProfileId) return [];
  const map = byProfile[activeProfileId] ?? {};
  return Object.values(map).sort((a, b) => b.addedAt - a.addedAt);
};

export const useMyListStore = create<MyListState>()(
  persist(
    (set, get) => ({
      activeProfileId: undefined,
      byProfile: {},

      setActiveProfileId: (profileId) => {
        set({ activeProfileId: profileId });
      },

      getActiveList: () => {
        return computeActiveList(get().byProfile, get().activeProfileId);
      },

      isInMyList: (id: string, type: ContentType) => {
        const profileId = get().activeProfileId;
        if (!profileId) return false;
        const map = get().byProfile[profileId] ?? {};
        const key = getMyListKey(id, type);
        return !!map[key] || !!map[id];
      },

      addToMyList: (item) => {
        const profileId = get().activeProfileId;
        if (!profileId) return;

        const key = getMyListKey(item.id, item.type);
        const withTimestamp: MyListItem = {
          ...item,
          addedAt: Date.now(),
        };

        set((state) => ({
          byProfile: {
            ...state.byProfile,
            [profileId]: {
              ...(state.byProfile[profileId] ?? {}),
              [key]: withTimestamp,
            },
          },
        }));

        pushSyncOperation({
          collection: 'my_list',
          action: 'add',
          payload: { id: item.id, type: item.type, addedAt: withTimestamp.addedAt, profileId },
        });
      },

      removeFromMyList: (id, type) => {
        const profileId = get().activeProfileId;
        if (!profileId) return;

        const key = getMyListKey(id, type);

        set((state) => {
          const current = state.byProfile[profileId] ?? {};
          const { [key]: removed, ...rest } = current;
          return {
            byProfile: {
              ...state.byProfile,
              [profileId]: rest,
            },
          };
        });

        pushSyncOperation({
          collection: 'my_list',
          action: 'remove',
          payload: { id, type, profileId },
        });
      },

      toggleMyList: (item) => {
        const profileId = get().activeProfileId;
        if (!profileId) return false;
        const key = getMyListKey(item.id, item.type);
        const current = get().byProfile[profileId] ?? {};
        const isInList = !!current[key] || !!current[item.id];
        if (isInList) {
          get().removeFromMyList(item.id, item.type);
          return false;
        }
        get().addToMyList(item);
        return true;
      },
    }),
    {
      name: 'my-list-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ byProfile: state.byProfile }),
    }
  )
);
