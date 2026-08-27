import { useQuery } from '@tanstack/react-query';

import { type DbSyncLogItem, listSyncLogForProfile } from '@/db';

const syncLogKeys = {
  all: ['sync-log'] as const,
  forProfile: (profileId: string) => [...syncLogKeys.all, profileId] as const,
};

/**
 * Returns the most recent integration sync log entries (newest first).
 * Invalidated by the integration sync hook after each successful sync.
 */
export function useSyncLog(profileId?: string) {
  return useQuery<DbSyncLogItem[]>({
    queryKey: profileId ? syncLogKeys.forProfile(profileId) : syncLogKeys.all,
    queryFn: async () => (profileId ? listSyncLogForProfile(profileId) : []),
    enabled: !!profileId,
  });
}

export { syncLogKeys };
