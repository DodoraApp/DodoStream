import type { TraktIds } from '@/types/trakt';

export type { TraktIds };

export function getImdbIdFromMetaId(metaId: string): string | undefined {
  if (metaId.startsWith('tt')) {
    return metaId.split(':')[0]; // e.g. tt0944947:1:1 -> tt0944947
  }
  return undefined;
}

export function getTmdbIdFromMetaId(metaId: string): string | undefined {
  if (metaId.startsWith('tmdb:')) {
    const parts = metaId.split(':');
    return parts[2]; // e.g. tmdb:movie:12345 -> 12345
  }
  return undefined;
}

/**
 * Builds Trakt ids object from local metaId.
 */
export function buildTraktIdsFromMetaId(metaId: string): TraktIds {
  const imdbId = getImdbIdFromMetaId(metaId);
  const tmdbId = getTmdbIdFromMetaId(metaId);
  return {
    imdb: imdbId,
    tmdb: tmdbId ? parseInt(tmdbId, 10) : undefined,
  };
}

/**
 * Maps a Trakt item to our local `metaId`.
 * Priority: IMDB -> TMDB
 */
export function resolveTraktIds(ids: TraktIds, type: 'movie' | 'series'): string | undefined {
  if (ids.imdb) {
    return ids.imdb;
  }
  if (ids.tmdb) {
    return `tmdb:${type === 'movie' ? 'movie' : 'series'}:${ids.tmdb}`;
  }
  return undefined;
}
