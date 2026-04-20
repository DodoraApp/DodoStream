import { QueryClient } from '@tanstack/react-query';

/**
 * Query client configuration for React Query
 *
 * Default stale time: 5 minutes (catalogs don't change frequently)
 * Default cache time: 30 minutes (keep data in cache longer)
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});
