import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { SIMKL_CLIENT_ID } from '@/api/simkl/config';
import {
  SIMKL_AUTO_SYNC_INTERVAL_MS,
  SIMKL_PIN_POLL_INTERVAL_MS,
  SIMKL_PIN_TIMEOUT_MS,
  TOAST_DURATION_SHORT,
} from '@/constants/ui';
import { watchHistoryKeys } from '@/hooks/useWatchHistoryDb';
import { useIntegrationsStore } from '@/store/integrations.store';
import { showToast } from '@/store/toast.store';
import { getPinCode, pollPin, getUserSettings } from './client';
import { runImport, runExport } from './sync-service';
import type { SimklConnection } from '@/types/integrations';
import { createDebugLogger } from '@/utils/debug';

const debug = createDebugLogger('SimklHooks');

export type PinAuthStatus = 'idle' | 'pending' | 'success' | 'expired';

export interface SimklPinAuthState {
  userCode: string | null;
  verificationUrl: string | null;
  status: PinAuthStatus;
  start: () => void;
  cancel: () => void;
}

export function useSimklConnection(profileId: string | undefined) {
  return useIntegrationsStore((state) =>
    profileId ? state.settings[profileId]?.simkl : undefined
  );
}

export function useSimklPinAuth(onSuccess: (accessToken: string) => void): SimklPinAuthState {
  const [status, setStatus] = useState<PinAuthStatus>('idle');
  const [userCode, setUserCode] = useState<string | null>(null);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    clearTimers();
    setStatus('idle');
    setUserCode(null);
    setVerificationUrl(null);
  }, [clearTimers]);

  const start = useCallback(async () => {
    try {
      cancel();
      setStatus('pending');

      const pinData = await getPinCode(SIMKL_CLIENT_ID);
      setUserCode(pinData.user_code);
      setVerificationUrl(pinData.verification_url);

      // Start polling
      pollIntervalRef.current = setInterval(async () => {
        try {
          const result = await pollPin(pinData.user_code, SIMKL_CLIENT_ID);
          if (result.result === 'OK' && result.access_token) {
            clearTimers();
            setStatus('success');
            onSuccess(result.access_token);
          }
        } catch (error) {
          debug('pollError', { error });
        }
      }, SIMKL_PIN_POLL_INTERVAL_MS);

      // Expire after 15 minutes
      timeoutRef.current = setTimeout(() => {
        clearTimers();
        setStatus('expired');
      }, SIMKL_PIN_TIMEOUT_MS);
    } catch (error) {
      debug('startPinAuthError', { error });
      setStatus('idle');
    }
  }, [cancel, clearTimers, onSuccess]);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  return { userCode, verificationUrl, status, start, cancel };
}

export interface SimklSyncState {
  sync: () => Promise<void>;
  isSyncing: boolean;
  lastSyncAt?: number;
}

export function useSimklSync(profileId?: string): SimklSyncState {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  const isSyncingRef = useRef(false);
  const simklSettings = useIntegrationsStore((state) =>
    profileId ? state.settings[profileId]?.simkl : undefined
  );
  const lastSyncAt = useIntegrationsStore((state) =>
    profileId ? (state.lastSyncAt[profileId] ?? undefined) : undefined
  );
  const { setLastSyncAt, setSyncStatus } = useIntegrationsStore();

  const sync = useCallback(async () => {
    if (!profileId || !simklSettings?.connection || isSyncingRef.current) return;

    const { accessToken, syncCursors } = simklSettings.connection;
    const { syncMode } = simklSettings;

    isSyncingRef.current = true;
    setIsSyncing(true);
    setSyncStatus(profileId, 'simkl', 'syncing');
    try {
      let importOk = true;
      let exportOk = true;

      if (syncMode === 'pull' || syncMode === 'full') {
        importOk = await runImport(profileId, accessToken, SIMKL_CLIENT_ID, syncCursors);
      }
      if (syncMode === 'push' || syncMode === 'full') {
        exportOk = await runExport(profileId, accessToken, SIMKL_CLIENT_ID);
      }

      if (importOk && exportOk) {
        setLastSyncAt(profileId, Date.now());
        setSyncStatus(profileId, 'simkl', 'success');
        await Promise.all([
          // Invalidate items for this profile
          queryClient.invalidateQueries({ queryKey: ['my-list-db'] }),
          queryClient.invalidateQueries({ queryKey: [...watchHistoryKeys.all, 'item', profileId] }),
          queryClient.invalidateQueries({
            queryKey: [...watchHistoryKeys.all, 'items-for-meta', profileId],
          }),
          queryClient.invalidateQueries({ queryKey: watchHistoryKeys.continueWatching(profileId) }),
          queryClient.invalidateQueries({ queryKey: watchHistoryKeys.metaSummaries(profileId) }),
        ]);
      } else {
        setSyncStatus(profileId, 'simkl', 'error');
        showToast({
          title: 'Sync failed',
          message: 'Could not sync with Simkl. Check your connection.',
          preset: 'error',
          duration: TOAST_DURATION_SHORT,
        });
      }
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [profileId, queryClient, setLastSyncAt, setSyncStatus, simklSettings]);

  // Sync on mount and when returning from background (throttled to SIMKL_AUTO_SYNC_INTERVAL_MS)
  const shouldSync = useCallback(() => {
    const now = Date.now();
    return !lastSyncAt || now - lastSyncAt > SIMKL_AUTO_SYNC_INTERVAL_MS;
  }, [lastSyncAt]);

  // Sync on mount if connected
  useEffect(() => {
    if (!profileId || !simklSettings?.connection) return;
    if (shouldSync()) sync();
  }, [profileId, simklSettings?.connection, shouldSync, sync]);

  // Sync when app returns to foreground
  useEffect(() => {
    if (!profileId || !simklSettings?.connection) return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && shouldSync()) {
        sync();
      }
    });

    return () => subscription.remove();
  }, [profileId, simklSettings, shouldSync, sync]);

  return { sync, isSyncing, lastSyncAt };
}

/**
 * Complete the Simkl connection flow: fetch user settings and save to store.
 */
export async function completeSimklConnection(
  profileId: string,
  accessToken: string,
): Promise<SimklConnection> {
  debug('completeSimklConnection:start', { profileId });
  try {
    const userSettings = await getUserSettings(accessToken, SIMKL_CLIENT_ID);
    const connection: SimklConnection = {
      accessToken,
      userId: String(userSettings.account.id),
      username: userSettings.user.name,
    };
    debug('completeSimklConnection:success', { userId: connection.userId, username: connection.username });
    return connection;
  } catch (error) {
    debug('completeSimklConnection:error', { error });
    throw error;
  }
}
