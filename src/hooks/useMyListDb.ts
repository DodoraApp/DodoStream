import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { ContentType } from '@/types/stremio';
import { useProfileStore } from '@/store/profile.store';
import { addToMyList, listMyListForProfile, removeFromMyList } from '@/db';

const myListKeys = {
  all: ['my-list-db'] as const,
  list: (profileId: string) => [...myListKeys.all, profileId] as const,
};

export function useMyList() {
  const profileId = useProfileStore((state) => state.activeProfileId);

  return useQuery({
    queryKey: profileId ? myListKeys.list(profileId) : myListKeys.all,
    queryFn: async () => {
      if (!profileId) return [];
      return listMyListForProfile(profileId);
    },
    enabled: !!profileId,
  });
}

export function useIsInMyList(metaId: string, type: ContentType) {
  const { data } = useMyList();

  return useMemo(() => {
    return (data ?? []).some((item) => item.id === metaId && item.type === type);
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
