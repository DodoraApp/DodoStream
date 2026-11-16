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

    try {
      if (settings?.simkl?.connection && (await hasUnsyncedWatches(profileId, 'simkl'))) {
        debug('syncSimkl', { profileId });
        await syncSimkl();
      }
      if (settings?.trakt?.connection && (await hasUnsyncedWatches(profileId, 'trakt'))) {
        debug('syncTrakt', { profileId });
        await syncTrakt();
      }
    } catch (error) {
      debug('syncPendingFailed', { error });
    }
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
