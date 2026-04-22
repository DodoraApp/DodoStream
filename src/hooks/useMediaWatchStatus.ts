import { useQuery } from '@tanstack/react-query';
import { getMetaWatchStatus } from '@/db';
import { watchHistoryKeys } from '@/hooks/useWatchHistoryDb';
import { useProfileStore } from '@/store/profile.store';
import type { WatchHistorySource } from '@/db/schema';

interface UseMediaWatchStatusResult {
  state: 'not-watched' | 'watching' | 'completed';
  source?: WatchHistorySource;
  isLoading: boolean;
}

export function useMediaWatchStatus(metaId: string): UseMediaWatchStatusResult {
  const activeProfileId = useProfileStore((state) => state.activeProfileId);

  const { data, isLoading } = useQuery({
    queryKey: activeProfileId
      ? [...watchHistoryKeys.itemsForMeta(activeProfileId, metaId), 'status']
      : watchHistoryKeys.all,
    queryFn: async () => {
      if (!activeProfileId) {
        return { state: 'not-watched' as const, source: undefined };
      }
      return getMetaWatchStatus(activeProfileId, metaId);
    },
    enabled: !!activeProfileId,
  });

  return {
    state: data?.state ?? 'not-watched',
    source: data?.source,
    isLoading,
  };
}
