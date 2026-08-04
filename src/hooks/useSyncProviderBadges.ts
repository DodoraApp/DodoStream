import { useSimklConnection } from '@/api/simkl/hooks';
import { useTraktConnection } from '@/api/trakt/hooks';
import { useIntegrationsStore } from '@/store/integrations.store';
import { useProfileStore } from '@/store/profile.store';
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
  const simklLastSyncAt = useIntegrationsStore((state) =>
    activeProfileId ? state.lastSyncAt[activeProfileId]?.simkl : undefined
  );
  const simklSyncStatus = useIntegrationsStore((state) =>
    activeProfileId ? state.syncStatus[activeProfileId]?.simkl : undefined
  );
  const trakt = useTraktConnection(activeProfileId ?? undefined);
  const traktLastSyncAt = useIntegrationsStore((state) =>
    activeProfileId ? state.lastSyncAt[activeProfileId]?.trakt : undefined
  );
  const traktSyncStatus = useIntegrationsStore((state) =>
    activeProfileId ? state.syncStatus[activeProfileId]?.trakt : undefined
  );

  const badges: SyncProviderBadge[] = [];

  if (simkl?.connection) {
    badges.push({
      key: 'simkl',
      status: mapSyncStatusToBadgeStatus(simklSyncStatus, Boolean(simklLastSyncAt)),
    });
  }

  if (trakt?.connection) {
    badges.push({
      key: 'trakt',
      status: mapSyncStatusToBadgeStatus(traktSyncStatus, Boolean(traktLastSyncAt)),
    });
  }

  return badges;
}
