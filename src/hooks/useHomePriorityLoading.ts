import { useQueries } from '@tanstack/react-query';
import { stremioKeys, fetchCatalogWithPagination } from '@/api/stremio';

export interface PriorityCatalogEntry {
  manifestUrl: string;
  type: string;
  id: string;
}

/**
 * Tracks whether the "priority" (above-the-fold) catalog queries have all
 * resolved. Priority catalogs share the same React Query cache keys as the
 * CatalogSection rows, so this hook adds no extra network requests — it
 * simply observes the same query results.
 *
 * @param priorityCatalogs - The first N catalog entries visible on screen
 * @param heroCatalogSources - The catalog sources used by the hero section
 * @returns `isPriorityReady` — true once every priority + hero query has settled
 */
export function useHomePriorityLoading(
  priorityCatalogs: PriorityCatalogEntry[],
  heroCatalogSources: PriorityCatalogEntry[]
): { isPriorityReady: boolean } {
  const allSources = dedupeSources([...priorityCatalogs, ...heroCatalogSources]);

  const results = useQueries({
    queries: allSources.map((source) => ({
      queryKey: stremioKeys.catalog(source.manifestUrl, source.type, source.id, 0),
      queryFn: () => fetchCatalogWithPagination(source.manifestUrl, source.type, source.id, 0),
      enabled: allSources.length > 0,
      staleTime: 1000 * 60 * 10,
      gcTime: 1000 * 60 * 30,
      refetchOnMount: false,
    })),
  });

  if (allSources.length === 0) {
    return { isPriorityReady: true };
  }

  const isPriorityReady = results.every((r) => !r.isLoading);

  return { isPriorityReady };
}

/** Deduplicate sources by their composite key to avoid firing the same query twice */
function dedupeSources(sources: PriorityCatalogEntry[]): PriorityCatalogEntry[] {
  const seen = new Set<string>();
  return sources.filter((s) => {
    const key = `${s.manifestUrl}::${s.type}::${s.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
