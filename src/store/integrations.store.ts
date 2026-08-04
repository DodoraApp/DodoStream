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
  TraktConnection,
  TraktSyncCursors,
} from '@/types/integrations';
import { createDebugLogger } from '@/utils/debug';

const debug = createDebugLogger('IntegrationsStore');

interface IntegrationsState {
  settings: Record<string, ProfileIntegrationSettings>;
  lastSyncAt: Record<string, Partial<Record<IntegrationProvider, number>>>;
  syncStatus: Partial<Record<string, Partial<Record<IntegrationProvider, IntegrationSyncStatus>>>>;

  connectSimkl: (profileId: string, connection: SimklConnection, syncMode: SyncMode) => void;
  disconnectSimkl: (profileId: string) => void;
  connectTrakt: (profileId: string, connection: TraktConnection, syncMode: SyncMode) => void;
  disconnectTrakt: (profileId: string) => void;
  setSyncMode: (profileId: string, provider: IntegrationProvider, mode: SyncMode) => void;
  updateSimklCursors: (profileId: string, cursors: SimklSyncCursors) => void;
  updateTraktCursors: (profileId: string, cursors: TraktSyncCursors) => void;
  updateTraktToken: (
    profileId: string,
    accessToken: string,
    refreshToken: string,
    expiresAt: number
  ) => void;
  setLastSyncAt: (profileId: string, provider: IntegrationProvider, timestamp: number) => void;
  setSyncStatus: (
    profileId: string,
    provider: IntegrationProvider,
    status: IntegrationSyncStatus
  ) => void;
  clearProviderIntegration: (profileId: string, provider: IntegrationProvider) => void;
}

export const useIntegrationsStore = create<IntegrationsState>()(
  persist(
    (set) => ({
      settings: {},
      lastSyncAt: {},
      syncStatus: {},

      connectSimkl: (profileId, connection, syncMode) => {
        debug('connectSimkl', { profileId, connection: JSON.stringify(connection), syncMode });
        set((state) => {
          const existing = state.settings[profileId];
          // Mutual exclusion: auto-disconnect Trakt when connecting Simkl
          const { trakt: _traktRemoved, ...rest } = existing ?? {};
          if (existing?.trakt?.connection) {
            debug('connectSimkl: auto-disconnecting Trakt', { profileId });
          }
          return {
            settings: {
              ...state.settings,
              [profileId]: {
                ...rest,
                simkl: { connection, syncMode },
              },
            },
          };
        });
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

      connectTrakt: (profileId, connection, syncMode) => {
        debug('connectTrakt', { profileId, connection: JSON.stringify(connection), syncMode });
        set((state) => {
          const existing = state.settings[profileId];
          // Mutual exclusion: auto-disconnect Simkl when connecting Trakt
          const { simkl: _simklRemoved, ...rest } = existing ?? {};
          if (existing?.simkl?.connection) {
            debug('connectTrakt: auto-disconnecting Simkl', { profileId });
          }
          return {
            settings: {
              ...state.settings,
              [profileId]: {
                ...rest,
                trakt: { connection, syncMode },
              },
            },
          };
        });
      },

      disconnectTrakt: (profileId) => {
        debug('disconnectTrakt', { profileId });
        set((state) => {
          const profile = state.settings[profileId];
          if (!profile) return state;
          return {
            settings: {
              ...state.settings,
              [profileId]: {
                ...profile,
                trakt: profile.trakt ? { ...profile.trakt, connection: undefined } : undefined,
              },
            },
          };
        });
      },

      setSyncMode: (profileId, provider, mode) => {
        debug('setSyncMode', { profileId, provider, mode });
        set((state) => {
          const profile = state.settings[profileId];
          if (!profile || !profile[provider]) return state;
          return {
            settings: {
              ...state.settings,
              [profileId]: {
                ...profile,
                [provider]: { ...profile[provider], syncMode: mode },
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

      updateTraktCursors: (profileId, cursors) => {
        debug('updateTraktCursors', { profileId, cursors: JSON.stringify(cursors) });
        set((state) => {
          const profile = state.settings[profileId];
          if (!profile?.trakt?.connection) return state;
          return {
            settings: {
              ...state.settings,
              [profileId]: {
                ...profile,
                trakt: {
                  ...profile.trakt,
                  connection: {
                    ...profile.trakt.connection,
                    syncCursors: {
                      ...profile.trakt.connection.syncCursors,
                      ...cursors,
                    },
                  },
                },
              },
            },
          };
        });
      },

      updateTraktToken: (profileId, accessToken, refreshToken, expiresAt) => {
        debug('updateTraktToken', { profileId });
        set((state) => {
          const profile = state.settings[profileId];
          if (!profile?.trakt?.connection) return state;
          return {
            settings: {
              ...state.settings,
              [profileId]: {
                ...profile,
                trakt: {
                  ...profile.trakt,
                  connection: {
                    ...profile.trakt.connection,
                    accessToken,
                    refreshToken,
                    expiresAt,
                  },
                },
              },
            },
          };
        });
      },

      clearProviderIntegration: (profileId, provider) => {
        debug('clearProviderIntegration', { profileId, provider });
        set((state) => {
          const settings = { ...state.settings };
          const profile = settings[profileId];
          if (profile) {
            const { [provider]: _removed, ...rest } = profile;
            settings[profileId] = rest;
          }

          const lastSyncAt = { ...state.lastSyncAt };
          const profileSync = lastSyncAt[profileId];
          if (profileSync) {
            const { [provider]: _removedSync, ...restSync } = profileSync;
            if (Object.keys(restSync).length > 0) lastSyncAt[profileId] = restSync;
            else delete lastSyncAt[profileId];
          }

          const syncStatus = { ...state.syncStatus };
          const profileStatus = syncStatus[profileId];
          if (profileStatus) {
            const { [provider]: _removedStatus, ...restStatus } = profileStatus;
            if (Object.keys(restStatus).length > 0) syncStatus[profileId] = restStatus;
            else delete syncStatus[profileId];
          }

          return { settings, lastSyncAt, syncStatus };
        });
      },

      setLastSyncAt: (profileId, provider, timestamp) => {
        debug('setLastSyncAt', { profileId, provider, timestamp });
        set((state) => ({
          lastSyncAt: {
            ...state.lastSyncAt,
            [profileId]: { ...state.lastSyncAt[profileId], [provider]: timestamp },
          },
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
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: (persistedState: any, version: number) => {
        if (persistedState && typeof persistedState === 'object') {
          const state = persistedState as any;

          // v0 → v1: normalize Simkl sync cursor strings to object cursors
          if (version === 0 && state.settings) {
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

          // v1 → v2: key lastSyncAt by provider. The flat profile-level value
          // belongs to whichever provider is currently connected (mutual
          // exclusion guarantees at most one). If none is connected, drop it —
          // a fresh full export is the safe default.
          if (version <= 1 && state.lastSyncAt) {
            for (const profileId in state.lastSyncAt) {
              const value = state.lastSyncAt[profileId];
              if (typeof value !== 'number') continue;
              if (state.settings?.[profileId]?.simkl?.connection) {
                state.lastSyncAt[profileId] = { simkl: value };
              } else if (state.settings?.[profileId]?.trakt?.connection) {
                state.lastSyncAt[profileId] = { trakt: value };
              } else {
                delete state.lastSyncAt[profileId];
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
