import { useCallback, useMemo } from 'react';

import {
  type IntegrationSyncProvider,
  useIntegrationSync,
} from '@/api/integrations/use-integration-sync';
import { type PinAuthProvider, usePinAuth } from '@/api/integrations/use-pin-auth';
import { SIMKL_PIN_POLL_INTERVAL_MS, SIMKL_PIN_TIMEOUT_MS } from '@/constants/ui';
import { useIntegrationsStore } from '@/store/integrations.store';
import type { SimklConnection, SimklSyncCursors } from '@/types/integrations';
import type { SimklActivities } from '@/types/simkl';
import { createDebugLogger } from '@/utils/debug';

import { getActivities, getPinCode, getUserSettings, pollPin } from './client';
import { runExport, runImport } from './sync-service';

const debug = createDebugLogger('SimklHooks');

// Re-export shared types for backward compatibility
export type { PinAuthStatus, PinAuthState as SimklPinAuthState } from '@/types/integrations';

export function useSimklConnection(profileId: string | undefined) {
  return useIntegrationsStore((state) =>
    profileId ? state.settings[profileId]?.simkl : undefined
  );
}

export function useSimklPinAuth(onSuccess: (accessToken: string) => void) {
  const handleSuccess = useCallback(
    (result: Record<string, unknown>) => {
      onSuccess(result.access_token as string);
    },
    [onSuccess]
  );

  const provider: PinAuthProvider = useMemo(
    () => ({
      requestCode: async () => {
        const pinData = await getPinCode();
        return {
          userCode: pinData.user_code,
          deviceCode: pinData.device_code,
          verificationUrl: pinData.verification_url,
          pollConfig: {
            intervalMs: SIMKL_PIN_POLL_INTERVAL_MS,
            expiresMs: SIMKL_PIN_TIMEOUT_MS,
          },
        };
      },
      pollToken: async (codes: { userCode: string; deviceCode: string }) => {
        try {
          const result = await pollPin(codes.userCode);
          if (result.result === 'OK') {
            return result as unknown as Record<string, unknown>;
          }
          return null;
        } catch (error) {
          debug('pollError', { error });
          return null;
        }
      },
      isSuccess: (result: Record<string, unknown>) => !!result.access_token,
    }),
    []
  );

  return usePinAuth(provider, handleSuccess);
}

export function useSimklSync(profileId?: string) {
  const simklSettings = useIntegrationsStore((state) =>
    profileId ? state.settings[profileId]?.simkl : undefined
  );

  const syncProvider: IntegrationSyncProvider<SimklActivities, SimklSyncCursors> = useMemo(
    () => ({
      provider: 'simkl',
      profileId,
      getConnection: () => simklSettings?.connection,
      getSyncMode: () => simklSettings?.syncMode,
      runImport: (pid, token, cursors, snapshot) =>
        runImport(pid, token, cursors, { activities: snapshot }),
      preSync: (token) => getActivities(token),
      runExport: (pid, token) => runExport(pid, token),
      errorTitleKey: 'settings:simkl.sync_failed',
      errorMessageKey: 'settings:simkl.sync_failed_desc',
    }),
    [profileId, simklSettings]
  );

  return useIntegrationSync(syncProvider);
}

/**
 * Complete the Simkl connection flow: fetch user settings and save to store.
 */
export async function completeSimklConnection(
  profileId: string,
  accessToken: string
): Promise<SimklConnection> {
  debug('completeSimklConnection:start', { profileId });
  try {
    const userSettings = await getUserSettings(accessToken);
    const connection: SimklConnection = {
      accessToken,
      userId: String(userSettings.account.id),
      username: userSettings.user.name,
    };
    debug('completeSimklConnection:success', {
      userId: connection.userId,
      username: connection.username,
    });
    return connection;
  } catch (error) {
    debug('completeSimklConnection:error', { error });
    throw error;
  }
}
