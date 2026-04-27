import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api, Addon, Profile, AddonConfig, isSessionEndedError } from './api';

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const queryKeys = {
  profiles: {
    all: ['profiles'] as const,
  },
  addons: {
    all: ['addons'] as const,
    profile: (profileId: string) => ['addons', profileId] as const,
  },
} as const;

// ─── AddonsView Hooks ─────────────────────────────────────────────────────────

/** Fetch addons across all profiles, merging into a flat list with per-addon profile membership. */
export function useAllAddonsQuery(profiles: Profile[], onSessionEnded?: () => void) {
  const queries = useQueries({
    queries: profiles.map((p) => ({
      queryKey: queryKeys.addons.profile(p.id),
      queryFn: () => api.getAddons(p.id),
      enabled: profiles.length > 0,
    })),
  });

  const hasSessionError = queries.some((q) => q.isError && isSessionEndedError(q.error));
  useEffect(() => {
    if (hasSessionError) onSessionEnded?.();
  }, [hasSessionError, onSessionEnded]);

  const addonMap = new Map<string, Addon>();
  const activeByProfile: Record<string, Profile[]> = {};

  for (let i = 0; i < queries.length; i++) {
    const data = queries[i].data;
    if (!data) continue;
    const profile = profiles[i];
    for (const addon of data) {
      if (!addonMap.has(addon.id)) {
        addonMap.set(addon.id, addon);
        activeByProfile[addon.id] = [];
      }
      if (addon.config.isActive) {
        activeByProfile[addon.id].push(profile);
      }
    }
  }

  const firstError = queries.find((q) => q.isError)?.error;

  return {
    addons: Array.from(addonMap.values()),
    activeByProfile,
    isLoading: queries.some((q) => q.isLoading),
    error: firstError instanceof Error ? firstError.message : null,
  };
}

export function useInstallAddonMutation(onSessionEnded?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (manifestUrl: string) => api.installAddon(manifestUrl),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.addons.all });
    },
    onError: (err: unknown) => {
      if (isSessionEndedError(err)) onSessionEnded?.();
    },
  });
}

export function useRemoveAddonMutation(onSessionEnded?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (addonId: string) => api.removeAddon(addonId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.addons.all });
    },
    onError: (err: unknown) => {
      if (isSessionEndedError(err)) onSessionEnded?.();
    },
  });
}

// ─── ProfilesView Hooks ───────────────────────────────────────────────────────

export function useProfileAddonsQuery(profileId: string, onSessionEnded?: () => void) {
  const query = useQuery({
    queryKey: queryKeys.addons.profile(profileId),
    queryFn: () => api.getAddons(profileId),
    enabled: !!profileId,
  });

  const hasSessionError = query.isError && isSessionEndedError(query.error);
  useEffect(() => {
    if (hasSessionError) onSessionEnded?.();
  }, [hasSessionError, onSessionEnded]);

  return {
    addons: query.data ?? [],
    isLoading: query.isLoading,
    error: query.isError
      ? query.error instanceof Error
        ? query.error.message
        : 'Failed to load profile addons'
      : null,
    refetch: query.refetch,
  };
}

export function useReorderAddonsMutation(profileId: string, onSessionEnded?: () => void) {
  const queryClient = useQueryClient();
  const key = queryKeys.addons.profile(profileId);

  return useMutation({
    mutationFn: (orderedIds: string[]) => api.reorderAddons(profileId, orderedIds),
    onMutate: async (orderedIds) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previousAddons = queryClient.getQueryData<Addon[]>(key);

      if (previousAddons) {
        const byId = new Map(previousAddons.map((a) => [a.id, a]));
        const reordered = orderedIds.map((id) => byId.get(id)!).filter(Boolean);
        const reorderedSet = new Set(orderedIds);
        const remaining = previousAddons.filter((a) => !reorderedSet.has(a.id));
        queryClient.setQueryData<Addon[]>(key, [...reordered, ...remaining]);
      }

      return { previousAddons };
    },
    onError: (err: unknown, _vars, context) => {
      if (isSessionEndedError(err)) {
        onSessionEnded?.();
      } else if (context?.previousAddons) {
        queryClient.setQueryData(key, context.previousAddons);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useToggleActiveMutation(profileId: string, onSessionEnded?: () => void) {
  const queryClient = useQueryClient();
  const key = queryKeys.addons.profile(profileId);

  return useMutation({
    mutationFn: ({ addonId, isActive }: { addonId: string; isActive: boolean }) =>
      api.updateAddonConfig(profileId, addonId, { isActive }),
    onMutate: async ({ addonId, isActive }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previousAddons = queryClient.getQueryData<Addon[]>(key);

      if (previousAddons) {
        queryClient.setQueryData<Addon[]>(
          key,
          previousAddons.map((a) =>
            a.id === addonId ? { ...a, config: { ...a.config, isActive } } : a,
          ),
        );
      }

      return { previousAddons };
    },
    onError: (err: unknown, _vars, context) => {
      if (isSessionEndedError(err)) {
        onSessionEnded?.();
      } else if (context?.previousAddons) {
        queryClient.setQueryData(key, context.previousAddons);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useUpdateAddonConfigMutation(profileId: string, onSessionEnded?: () => void) {
  const queryClient = useQueryClient();
  const key = queryKeys.addons.profile(profileId);

  return useMutation({
    mutationFn: ({
      addonId,
      configUpdates,
    }: {
      addonId: string;
      configUpdates: Partial<AddonConfig>;
    }) => api.updateAddonConfig(profileId, addonId, configUpdates),
    onMutate: async ({ addonId, configUpdates }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previousAddons = queryClient.getQueryData<Addon[]>(key);

      if (previousAddons) {
        queryClient.setQueryData<Addon[]>(
          key,
          previousAddons.map((a) =>
            a.id === addonId ? { ...a, config: { ...a.config, ...configUpdates } } : a,
          ),
        );
      }

      return { previousAddons };
    },
    onError: (err: unknown, _vars, context) => {
      if (isSessionEndedError(err)) {
        onSessionEnded?.();
      } else if (context?.previousAddons) {
        queryClient.setQueryData(key, context.previousAddons);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
