import { InfiniteData, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { ContentType } from '@/types/stremio';
import { useProfileStore } from '@/store/profile.store';
import { addToMyList, listMyListForProfile, removeFromMyList, type DbMyListItem } from '@/db';

const myListKeys = {
  all: ['my-list-db'] as const,
  list: (profileId: string) => [...myListKeys.all, profileId] as const,
};

export function useMyList() {
  const profileId = useProfileStore((state) => state.activeProfileId);

  return useInfiniteQuery<
    DbMyListItem[],
    Error,
    InfiniteData<DbMyListItem[]>,
    readonly unknown[],
    number
  >({
    queryKey: profileId ? myListKeys.list(profileId) : myListKeys.all,
    queryFn: async ({ pageParam }) => {
      if (!profileId) return [];
      return listMyListForProfile(profileId, { limit: 30, offset: pageParam });
    },
    enabled: !!profileId,
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < 30) return undefined;
      return allPages.reduce((acc, page) => acc + page.length, 0);
    },
  });
}

export function useIsInMyList(metaId: string, type: ContentType) {
  const { data } = useMyList();

  return useMemo(() => {
    const allItems = data?.pages.flat() ?? [];
    return allItems.some((item) => item.id === metaId && item.type === type);
  }, [data, metaId, type]);
}

export function useMyListActions() {
  const profileId = useProfileStore((state) => state.activeProfileId);
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: myListKeys.all });
  };

  const addMutation = useMutation({
    mutationFn: async ({ id, type }: { id: string; type: ContentType }) => {
      if (!profileId) return;
      await addToMyList(profileId, id, type);
    },
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      if (!profileId) return;
      await removeFromMyList(profileId, id);
    },
    onSuccess: invalidate,
  });

  const toggleMyList = ({
    id,
    type,
    currentlyInList,
  }: {
    id: string;
    type: ContentType;
    currentlyInList: boolean;
  }) => {
    if (currentlyInList) {
      removeMutation.mutate({ id });
      return false;
    }

    addMutation.mutate({ id, type });
    return true;
  };

  return {
    addToMyList: addMutation.mutate,
    removeFromMyList: removeMutation.mutate,
    toggleMyList,
  };
}
