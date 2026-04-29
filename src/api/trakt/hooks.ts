import { useCallback, useMemo } from 'react';

import {
  type IntegrationSyncProvider,
  useIntegrationSync,
} from '@/api/integrations/use-integration-sync';
import { type PinAuthProvider, usePinAuth } from '@/api/integrations/use-pin-auth';
import { useIntegrationsStore } from '@/store/integrations.store';
import type { TraktConnection, TraktSyncCursors } from '@/types/integrations';
import { createDebugLogger } from '@/utils/debug';

import {
  getDeviceCode,
  getLastActivities,
  getUserSettings,
  pollDeviceToken,
  refreshToken,
} from './client';
import { runExport, runImport } from './sync-service';

const debug = createDebugLogger('TraktHooks');

// Re-export shared types for backward compatibility
export type { PinAuthStatus, PinAuthState as TraktPinAuthState } from '@/types/integrations';

export function useTraktConnection(profileId: string | undefined) {
  return useIntegrationsStore((state) =>
    profileId ? state.settings[profileId]?.trakt : undefined
  );
}

export function useTraktPinAuth(
  onSuccess: (accessToken: string, refreshToken: string, expiresAt: number) => void
) {
  const handleSuccess = useCallback(
    (result: Record<string, unknown>) => {
      onSuccess(
        result.access_token as string,
        result.refresh_token as string,
        Date.now() + (result.expires_in as number) * 1000
      );
    },
    [onSuccess]
  );

  const provider: PinAuthProvider = useMemo(
    () => ({
      requestCode: async () => {
        const pinData = await getDeviceCode();
        return {
          userCode: pinData.user_code,
          deviceCode: pinData.device_code,
          verificationUrl: pinData.verification_url,
          pollConfig: {
            intervalMs: pinData.interval * 1000,
            expiresMs: pinData.expires_in * 1000,
          },
        };
      },
      pollToken: async (codes: { userCode: string; deviceCode: string }) => {
        try {
          const result = await pollDeviceToken(codes.deviceCode);
          return result as unknown as Record<string, unknown>;
        } catch (error: any) {
          // 400 is expected (Pending), we just continue polling
          if (error?.status !== 400) {
            debug('pollError', { error });
          }
          return null;
        }
      },
      isSuccess: (result: Record<string, unknown>) => !!result.access_token,
    }),
    []
  );

  return usePinAuth(provider, handleSuccess);
}

export function useTraktSync(profileId?: string) {
  const traktSettings = useIntegrationsStore((state) =>
    profileId ? state.settings[profileId]?.trakt : undefined
  );
  const updateTraktToken = useIntegrationsStore((state) => state.updateTraktToken);

  const syncProvider: IntegrationSyncProvider<TraktSyncCursors, TraktSyncCursors> = useMemo(
    () => ({
      provider: 'trakt',
      profileId,
      getConnection: () => traktSettings?.connection,
      getSyncMode: () => traktSettings?.syncMode,
      beforeSync: async (connection) => {
        const conn = traktSettings?.connection;
        if (!conn?.refreshToken || !conn.expiresAt) return connection;

        // Refresh if token expires within 5 minutes
        if (Date.now() < conn.expiresAt - 5 * 60 * 1000) return connection;

        debug('tokenExpired, refreshing', { profileId });
        try {
          const result = await refreshToken(conn.refreshToken);
          const newExpiresAt = Date.now() + result.expires_in * 1000;
          if (profileId) {
            updateTraktToken(profileId, result.access_token, result.refresh_token, newExpiresAt);
          }
          return {
            accessToken: result.access_token,
            syncCursors: connection.syncCursors,
          };
        } catch (error) {
          debug('tokenRefreshFailed', { error });
          return connection;
        }
      },
      runImport: (pid, token, cursors, snapshot) =>
        runImport(pid, token, cursors, { activities: snapshot }),
      preSync: (token) => getLastActivities(token),
      runExport: (pid, token) => runExport(pid, token),
      errorTitleKey: 'settings:trakt.sync_failed',
      errorMessageKey: 'settings:trakt.sync_failed_desc',
    }),
    [profileId, traktSettings, updateTraktToken]
  );

  return useIntegrationSync(syncProvider);
}

export async function completeTraktConnection(
  profileId: string,
  accessToken: string,
  refreshToken: string,
  expiresAt: number
): Promise<TraktConnection> {
  debug('completeTraktConnection:start', { profileId });
  try {
    const userSettings = await getUserSettings(accessToken);
    const connection: TraktConnection = {
      accessToken,
      refreshToken,
      expiresAt,
      userId: userSettings.user.ids.slug,
      username: (userSettings.user.username || userSettings.user.name) ?? '',
    };
    debug('completeTraktConnection:success', {
      userId: connection.userId,
      username: connection.username,
    });
    return connection;
  } catch (error) {
    debug('completeTraktConnection:error', { error });
    throw error;
  }
}
