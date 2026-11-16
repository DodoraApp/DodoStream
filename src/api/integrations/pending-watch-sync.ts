import { listExportableWatchHistoryForProfile } from '@/db/queries/watchHistory';
import { useIntegrationsStore } from '@/store/integrations.store';
import type { IntegrationProvider } from '@/types/integrations';

/**
 * Whether the profile finished watching something since the last successful
 * sync with the provider, for example a download watched offline.
 */
export async function hasUnsyncedWatches(
  profileId: string,
  provider: IntegrationProvider
): Promise<boolean> {
  const lastSyncAt = useIntegrationsStore.getState().lastSyncAt[profileId]?.[provider] || 0;
  const items = await listExportableWatchHistoryForProfile(profileId, {
    status: 'completed',
    excludeSource: provider,
    minLastWatchedAt: lastSyncAt,
  });
  return items.length > 0;
}
