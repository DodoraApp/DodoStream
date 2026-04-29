import type { SimklIds } from '@/types/simkl';
import type { ContentType } from '@/types/stremio';
import { createDebugLogger } from '@/utils/debug';

import { searchById } from './client';

const debug = createDebugLogger('SimklIdResolver');

// In-memory session cache to avoid repeated ID lookups.
const cache = new Map<string, SimklIds | null>();

/**
 * Resolves a metaId to Simkl IDs.
 * - metaId starting with "tt" → treated as IMDB ID
 * - Otherwise → passed as-is to /search/id
 * Results are cached in memory for the app session.
 */
export async function resolveSimklIds(metaId: string, type: ContentType): Promise<SimklIds | null> {
  const cacheKey = `${type}:${metaId}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey) ?? null;
  }

  // If the ID is already a numeric Simkl ID, skip lookup.
  if (/^\d+$/.test(metaId)) {
    const ids = { simkl: Number(metaId) };
    cache.set(cacheKey, ids);
    return ids;
  }

  // Skip lookup for IMDB IDs.
  if (metaId.startsWith('tt')) {
    const ids = { imdb: metaId };
    cache.set(cacheKey, ids);
    return ids as SimklIds;
  }

  // Skip lookup for TMDB IDs (format: tmdb:type:id, e.g. tmdb:movie:12345).
  if (metaId.startsWith('tmdb:')) {
    const parts = metaId.split(':');
    const tmdbId = Number(parts[2]);
    if (!isNaN(tmdbId)) {
      const ids = { tmdb: tmdbId };
      cache.set(cacheKey, ids);
      return ids as SimklIds;
    }
  }

  try {
    const results = await searchById(metaId);

    if (!results || results.length === 0) {
      debug('notFound', { metaId });
      cache.set(cacheKey, null);
      return null;
    }

    const filteredResults =
      type === 'movie'
        ? results.filter((item) => item.type === 'movie')
        : results.filter((item) => item.type === 'tv' || item.type === 'anime');

    // Prefer type-matching result, fallback to first result
    const ids = (filteredResults[0] ?? results[0]).ids;
    debug('resolved', { metaId, ids });
    cache.set(cacheKey, ids);
    return ids;
  } catch (error) {
    debug('error', { metaId, error });
    cache.set(cacheKey, null);
    return null;
  }
}
