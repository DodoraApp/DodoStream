import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { PLAYBACK_FINISHED_RATIO } from '@/constants/playback';
import { useProfileStore } from '@/store/profile.store';
import {
  getLastStreamTarget,
  getWatchHistoryItem,
  listWatchedMetaSummaries,
  removeWatchHistoryMeta,
  upsertWatchProgress,
  type DbWatchHistoryItem,
  type DbWatchedMetaSummary,
} from '@/db';
import type { ContentType } from '@/types/stremio';

const watchHistoryKeys = {
  all: ['watch-history-db'] as const,
  item: (profileId: string, metaId: string, videoId?: string) =>
    [...watchHistoryKeys.all, 'item', profileId, metaId, videoId ?? '_'] as const,
  metaSummaries: (profileId: string) => [...watchHistoryKeys.all, 'summaries', profileId] as const,
  streamTarget: (profileId: string, metaId: string, videoId?: string) =>
    [...watchHistoryKeys.all, 'stream-target', profileId, metaId, videoId ?? '_'] as const,
  continueWatching: (profileId: string) => [...watchHistoryKeys.all, 'continue-watching', profileId] as const,
};

const toWatchState = (item?: DbWatchHistoryItem): 'not-watched' | 'in-progress' | 'watched' => {
  if (!item || item.durationSeconds <= 0) return 'not-watched';
  const ratio = item.progressSeconds / item.durationSeconds;
  if (ratio >= PLAYBACK_FINISHED_RATIO) return 'watched';
  if (ratio > 0) return 'in-progress';
  return 'not-watched';
};

export function useWatchHistoryItem(metaId: string, videoId?: string) {
  const profileId = useProfileStore((state) => state.activeProfileId);

  return useQuery<DbWatchHistoryItem | null>({
    queryKey: profileId ? watchHistoryKeys.item(profileId, metaId, videoId) : watchHistoryKeys.all,
    queryFn: async () => {
      if (!profileId) return null;
      const item = await getWatchHistoryItem(profileId, metaId, videoId);
      return item ?? null;
    },
    enabled: !!profileId,
  });
}

export function useWatchProgress(metaId: string, videoId?: string) {
  const { data: item } = useWatchHistoryItem(metaId, videoId);

  return useMemo(() => {
    if (!item || item.durationSeconds <= 0) return 0;
    return item.progressSeconds / item.durationSeconds;
  }, [item]);
}

export function useWatchState(metaId: string, videoId?: string) {
  const { data: item } = useWatchHistoryItem(metaId, videoId);
  return toWatchState(item ?? undefined);
}

export function useLastStreamTarget(metaId: string, videoId?: string) {
  const profileId = useProfileStore((state) => state.activeProfileId);

  return useQuery<{ type: 'url' | 'external' | 'yt'; value: string } | null>({
    queryKey: profileId ? watchHistoryKeys.streamTarget(profileId, metaId, videoId) : watchHistoryKeys.all,
    queryFn: async () => {
      if (!profileId) return null;
      const target = await getLastStreamTarget(profileId, metaId, videoId);
      return target ?? null;
    },
    enabled: !!profileId,
  });
}

export function useWatchedMetaSummaries() {
  const profileId = useProfileStore((state) => state.activeProfileId);

  return useQuery<DbWatchedMetaSummary[]>({
    queryKey: profileId ? watchHistoryKeys.metaSummaries(profileId) : watchHistoryKeys.all,
    queryFn: async () => {
      if (!profileId) return [];
      return listWatchedMetaSummaries(profileId);
    },
    enabled: !!profileId,
    initialData: [],
  });
}

export function useWatchHistoryActions() {
  const profileId = useProfileStore((state) => state.activeProfileId);
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: watchHistoryKeys.all });
  };

  const upsert = useMutation({
    mutationFn: async (params: {
      metaId: string;
      videoId?: string;
      type: ContentType;
      progressSeconds: number;
      durationSeconds: number;
      lastStreamTargetType?: 'url' | 'external' | 'yt';
      lastStreamTargetValue?: string;
    }) => {
      if (!profileId) return;
      await upsertWatchProgress({ profileId, ...params });
    },
    onSuccess: invalidate,
  });

  const removeMeta = useMutation({
    mutationFn: async (metaId: string) => {
      if (!profileId) return;
      await removeWatchHistoryMeta(profileId, metaId);
    },
    onSuccess: invalidate,
  });

  return {
    upsert: upsert.mutate,
    removeMeta: removeMeta.mutate,
  };
}

export { watchHistoryKeys };
