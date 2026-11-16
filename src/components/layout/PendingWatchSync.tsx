import { memo, useCallback, useEffect } from 'react';

import * as Network from 'expo-network';

import { hasUnsyncedWatches } from '@/api/integrations/pending-watch-sync';
import { useSimklSync } from '@/api/simkl/hooks';
import { useTraktSync } from '@/api/trakt/hooks';
import { useIntegrationsStore } from '@/store/integrations.store';
import { useProfileStore } from '@/store/profile.store';
import { createDebugLogger } from '@/utils/debug';

const debug = createDebugLogger('PendingWatchSync');

/**
 * Sends what was watched without a connection (for example downloads) to
 * the connected services as soon as the device is online again, and on app
 * start when something is still unsynced. Does nothing while every watch is
 * already synced, so it adds no extra syncs to the usual ones.
 */
export const PendingWatchSync = memo(() => {
  const profileId = useProfileStore((state) => state.activeProfileId);
  const { sync: syncSimkl } = useSimklSync(profileId, { autoSync: false });
  const { sync: syncTrakt } = useTraktSync(profileId, { autoSync: false });

  const syncPending = useCallback(async () => {
    if (!profileId) return;
    const settings = useIntegrationsStore.getState().settings[profileId];

    // Each service on its own, so a failure at one does not hold back the other.
    const syncIfPending = async (provider: 'simkl' | 'trakt', sync: () => Promise<void>) => {
      try {
        if (!settings?.[provider]?.connection) return;
        if (!(await hasUnsyncedWatches(profileId, provider))) return;
        debug('sync', { profileId, provider });
        await sync();
      } catch (error) {
        debug('syncPendingFailed', { provider, error });
      }
    };

    await syncIfPending('simkl', syncSimkl);
    await syncIfPending('trakt', syncTrakt);
  }, [profileId, syncSimkl, syncTrakt]);

  useEffect(() => {
    void syncPending();

    const subscription = Network.addNetworkStateListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) void syncPending();
    });
    return () => subscription.remove();
  }, [syncPending]);

  return null;
});

PendingWatchSync.displayName = 'PendingWatchSync';
