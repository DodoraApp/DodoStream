import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState } from 'react-native';

import { useQueryClient } from '@tanstack/react-query';
import * as Network from 'expo-network';

import { INTEGRATION_AUTO_SYNC_INTERVAL_MS, TOAST_DURATION_SHORT } from '@/constants/ui';
import { syncLogKeys } from '@/hooks/useSyncLog';
import { watchHistoryKeys } from '@/hooks/useWatchHistoryDb';
import { useIntegrationsStore } from '@/store/integrations.store';
import { showToast } from '@/store/toast.store';
import type { IntegrationProvider, IntegrationSyncState, SyncMode } from '@/types/integrations';

export interface IntegrationSyncProvider<TSnapshot = unknown, TSyncCursors = unknown> {
  provider: IntegrationProvider;
  profileId: string | undefined;
  /** Get the current connection from store */
  getConnection: () => { accessToken: string; syncCursors?: TSyncCursors } | undefined;
  /** Get the current sync mode from store */
  getSyncMode: () => SyncMode | undefined;
  /** Execute import. Return true on success. */
  runImport: (
    profileId: string,
    accessToken: string,
    syncCursors?: TSyncCursors,
    snapshot?: TSnapshot
  ) => Promise<boolean>;
  /** Pre-fetch provider state snapshot before export (avoids re-importing our own export). */
  preSync?: (accessToken: string) => Promise<TSnapshot>;
  /** Called before sync operations. Use for token refresh or other pre-flight checks. */
  beforeSync?: (connection: {
    accessToken: string;
    syncCursors?: TSyncCursors;
  }) => Promise<{ accessToken: string; syncCursors?: TSyncCursors }>;
  /** Execute export. Return true on success. */
  runExport: (profileId: string, accessToken: string) => Promise<boolean>;
  /** i18n key for sync failure title (e.g. 'settings:trakt.sync_failed') */
  errorTitleKey: string;
  /** i18n key for sync failure message */
  errorMessageKey: string;
}

export interface IntegrationSyncOptions {
  /**
   * Sync on mount and when the app returns to the foreground (default: true).
   * Turn it off for an instance that only syncs on demand.
   */
  autoSync?: boolean;
}

/**
 * Syncs running right now, keyed by profile and provider. Shared by every
 * hook instance, so the player, the settings and the catch-up sync never run
 * the same sync twice at once.
 */
const runningSyncs = new Set<string>();

/**
 * Whether the device can reach the internet. An unknown state counts as
 * online, so a sync is only skipped when the device is known to be offline.
 */
export async function isDeviceOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return state.isConnected !== false && state.isInternetReachable !== false;
  } catch {
    return true;
  }
}

/**
 * Generic integration sync hook.
 *
 * Encapsulates the sync-on-mount, foreground-resume, throttled-auto-sync
 * pattern that was previously duplicated between Trakt and Simkl hooks.
 * Each provider supplies a thin adapter with its API functions and store
 * accessors.
 */
export function useIntegrationSync<TSnapshot, TSyncCursors>(
  config: IntegrationSyncProvider<TSnapshot, TSyncCursors>,
  { autoSync = true }: IntegrationSyncOptions = {}
): IntegrationSyncState {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  const { setLastSyncAt, setSyncStatus } = useIntegrationsStore();
  const lastSyncAt = useIntegrationsStore((state) =>
    config.profileId
      ? (state.lastSyncAt[config.profileId]?.[config.provider] ?? undefined)
      : undefined
  );

  // Always-accurate config reference to avoid stale closures
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const sync = useCallback(async () => {
    const cfg = configRef.current;
    const connection = cfg.getConnection();
    const syncMode = cfg.getSyncMode();
    if (!cfg.profileId || !connection || !syncMode) return;

    const runningKey = `${cfg.profileId}:${cfg.provider}`;
    if (runningSyncs.has(runningKey)) return;
    runningSyncs.add(runningKey);
    try {
      // Offline (for example while watching a download) there is nothing to
      // gain but an error toast. Watched items stay in the local history and
      // are exported with the next sync, which also covers several of them.
      if (!(await isDeviceOnline())) return;

      setIsSyncing(true);
      setSyncStatus(cfg.profileId, cfg.provider, 'syncing');
      // Allow providers to refresh tokens or perform other pre-flight checks.
      const activeConnection = cfg.beforeSync ? await cfg.beforeSync(connection) : connection;

      let importOk = true;
      let exportOk = true;

      // Pre-fetch provider state before export so import can compare against
      // the pre-export snapshot (export POSTs update last_activity on remote).
      const needsImport = syncMode === 'pull' || syncMode === 'full';
      const needsExport = syncMode === 'push' || syncMode === 'full';
      let snapshot: TSnapshot | undefined;
      if (needsImport && needsExport && cfg.preSync) {
        snapshot = await cfg.preSync(activeConnection.accessToken);
      }

      if (needsExport) {
        exportOk = await cfg.runExport(cfg.profileId, activeConnection.accessToken);
      }
      if (needsImport) {
        importOk = await cfg.runImport(
          cfg.profileId,
          activeConnection.accessToken,
          activeConnection.syncCursors,
          snapshot
        );
      }

      if (importOk && exportOk) {
        setLastSyncAt(cfg.profileId, cfg.provider, Date.now());
        setSyncStatus(cfg.profileId, cfg.provider, 'success');
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['my-list-db'] }),
          queryClient.invalidateQueries({ queryKey: syncLogKeys.all }),
          queryClient.invalidateQueries({
            queryKey: [...watchHistoryKeys.all, 'item', cfg.profileId],
          }),
          queryClient.invalidateQueries({
            queryKey: [...watchHistoryKeys.all, 'items-for-meta', cfg.profileId],
          }),
          queryClient.invalidateQueries({
            queryKey: watchHistoryKeys.continueWatching(cfg.profileId),
          }),
          queryClient.invalidateQueries({
            queryKey: watchHistoryKeys.metaSummaries(cfg.profileId),
          }),
        ]);
      } else {
        setSyncStatus(cfg.profileId, cfg.provider, 'error');
        showToast({
          title: t(cfg.errorTitleKey),
          message: t(cfg.errorMessageKey),
          preset: 'error',
          duration: TOAST_DURATION_SHORT,
        });
      }
    } finally {
      runningSyncs.delete(runningKey);
      setIsSyncing(false);
    }
  }, [queryClient, setLastSyncAt, setSyncStatus, t]);

  // Sync on mount if connected and throttled
  const shouldSync = useCallback(() => {
    const now = Date.now();
    return !lastSyncAt || now - lastSyncAt > INTEGRATION_AUTO_SYNC_INTERVAL_MS;
  }, [lastSyncAt]);

  useEffect(() => {
    const cfg = configRef.current;
    if (!autoSync || !cfg.profileId || !cfg.getConnection()) return;
    if (shouldSync()) sync();
  }, [autoSync, config.profileId, shouldSync, sync]);

  // Sync when app returns to foreground
  useEffect(() => {
    const cfg = configRef.current;
    if (!autoSync || !cfg.profileId || !cfg.getConnection()) return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && shouldSync()) {
        sync();
      }
    });

    return () => subscription.remove();
  }, [autoSync, config.profileId, shouldSync, sync]);

  return { sync, isSyncing, lastSyncAt };
}
