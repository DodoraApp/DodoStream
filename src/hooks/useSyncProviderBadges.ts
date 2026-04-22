import { useProfileStore } from '@/store/profile.store';
import { useSimklConnection } from '@/api/simkl/hooks';
import { useIntegrationsStore } from '@/store/integrations.store';
import type { IntegrationProvider, IntegrationSyncStatus } from '@/types/integrations';

export type SyncStatus = 'synced' | 'waiting' | 'error';

export interface SyncProviderBadge {
  /** Unique key for the provider */
  key: IntegrationProvider;
  /** Current sync status */
  status: SyncStatus;
}

const mapSyncStatusToBadgeStatus = (
  status: IntegrationSyncStatus | undefined,
  hasLastSyncAt: boolean
): SyncStatus => {
  if (status === 'error') return 'error';
  if (status === 'success' || hasLastSyncAt) return 'synced';
  return 'waiting';
};

/** Returns badges for all connected sync providers for the active profile. */
export function useSyncProviderBadges(): SyncProviderBadge[] {
  const activeProfileId = useProfileStore((state) => state.activeProfileId);
  const simkl = useSimklConnection(activeProfileId ?? undefined);
  const lastSyncAt = useIntegrationsStore((state) =>
    activeProfileId ? state.lastSyncAt[activeProfileId] : undefined
  );
  const simklSyncStatus = useIntegrationsStore((state) =>
    activeProfileId ? state.syncStatus[activeProfileId]?.simkl : undefined
  );

  const badges: SyncProviderBadge[] = [];

  if (simkl?.connection) {
    badges.push({
      key: 'simkl',
      status: mapSyncStatusToBadgeStatus(simklSyncStatus, Boolean(lastSyncAt)),
    });
  }

  return badges;
}
