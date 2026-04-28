import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type {
  IntegrationProvider,
  IntegrationSyncStatus,
  ProfileIntegrationSettings,
  SimklConnection,
  SimklSyncCursors,
  SyncMode,
} from '@/types/integrations';
import { createDebugLogger } from '@/utils/debug';

const debug = createDebugLogger('IntegrationsStore');

interface IntegrationsState {
  settings: Record<string, ProfileIntegrationSettings>;
  lastSyncAt: Record<string, number>;
  syncStatus: Partial<Record<string, Partial<Record<IntegrationProvider, IntegrationSyncStatus>>>>;

  connectSimkl: (profileId: string, connection: SimklConnection, syncMode: SyncMode) => void;
  disconnectSimkl: (profileId: string) => void;
  setSyncMode: (profileId: string, mode: SyncMode) => void;
  updateSimklCursors: (profileId: string, cursors: SimklSyncCursors) => void;
  setLastSyncAt: (profileId: string, timestamp: number) => void;
  setSyncStatus: (
    profileId: string,
    provider: IntegrationProvider,
    status: IntegrationSyncStatus
  ) => void;
  clearProfileIntegrations: (profileId: string) => void;
}

export const useIntegrationsStore = create<IntegrationsState>()(
  persist(
    (set) => ({
      settings: {},
      lastSyncAt: {},
      syncStatus: {},

      connectSimkl: (profileId, connection, syncMode) => {
        debug('connectSimkl', { profileId, connection: JSON.stringify(connection), syncMode });
        set((state) => ({
          settings: {
            ...state.settings,
            [profileId]: {
              ...state.settings[profileId],
              simkl: { connection, syncMode },
            },
          },
        }));
      },

      disconnectSimkl: (profileId) => {
        debug('disconnectSimkl', { profileId });
        set((state) => {
          const profile = state.settings[profileId];
          if (!profile) return state;
          return {
            settings: {
              ...state.settings,
              [profileId]: {
                ...profile,
                simkl: profile.simkl ? { ...profile.simkl, connection: undefined } : undefined,
              },
            },
          };
        });
      },

      setSyncMode: (profileId, mode) => {
        debug('setSyncMode', { profileId, mode });
        set((state) => {
          const profile = state.settings[profileId];
          if (!profile?.simkl) return state;
          return {
            settings: {
              ...state.settings,
              [profileId]: {
                ...profile,
                simkl: { ...profile.simkl, syncMode: mode },
              },
            },
          };
        });
      },

      updateSimklCursors: (profileId, cursors) => {
        debug('updateSimklCursors', { profileId, cursors: JSON.stringify(cursors) });
        set((state) => {
          const profile = state.settings[profileId];
          if (!profile?.simkl?.connection) return state;
          return {
            settings: {
              ...state.settings,
              [profileId]: {
                ...profile,
                simkl: {
                  ...profile.simkl,
                  connection: {
                    ...profile.simkl.connection,
                    syncCursors: {
                      ...profile.simkl.connection.syncCursors,
                      ...cursors,
                    },
                  },
                },
              },
            },
          };
        });
      },

      clearProfileIntegrations: (profileId) => {
        debug('clearProfileIntegrations', { profileId });
        set((state) => {
          const { [profileId]: _removed, ...rest } = state.settings;
          const { [profileId]: _removedSync, ...restSync } = state.lastSyncAt;
          const { [profileId]: _removedStatus, ...restStatus } = state.syncStatus;
          return { settings: rest, lastSyncAt: restSync, syncStatus: restStatus };
        });
      },

      setLastSyncAt: (profileId, timestamp) => {
        debug('setLastSyncAt', { profileId, timestamp });
        set((state) => ({
          lastSyncAt: { ...state.lastSyncAt, [profileId]: timestamp },
        }));
      },

      setSyncStatus: (profileId, provider, status) => {
        debug('setSyncStatus', { profileId, provider, status });
        set((state) => ({
          syncStatus: {
            ...state.syncStatus,
            [profileId]: {
              ...state.syncStatus[profileId],
              [provider]: status,
            },
          },
        }));
      },
    }),
    {
      name: 'integrations-registry',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: (persistedState: any, version: number) => {
        if (version === 0 && persistedState && typeof persistedState === 'object') {
          const state = persistedState as any;

          if (state.settings) {
            for (const profileId in state.settings) {
              const simkl = state.settings[profileId]?.simkl;
              const cursors = simkl?.connection?.syncCursors;
              if (cursors && typeof cursors === 'object') {
                for (const key of ['movies', 'tv_shows', 'anime']) {
                  if (typeof cursors[key] === 'string') {
                    cursors[key] = { all: cursors[key] };
                  }
                }
              }
            }
          }
        }
        return persistedState;
      },
      partialize: (state) => ({
        settings: state.settings,
        lastSyncAt: state.lastSyncAt,
        syncStatus: state.syncStatus,
      }),
    }
  )
);
