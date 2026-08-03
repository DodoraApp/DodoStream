import { getExternalIdsForMetaId } from '@/db/queries/idMapping';
import type { SimklIds } from '@/types/simkl';
import type { ContentType } from '@/types/stremio';
import { createDebugLogger } from '@/utils/debug';

const debug = createDebugLogger('SimklIdResolver');

/**
 * Resolves a metaId to Simkl-compatible external IDs.
 *
 * Simkl's write endpoints (POST /sync/history, /sync/add-to-list, …) accept
 * any combination of external IDs (`imdb`, `tmdb`, `tvdb`, `mal`, `kitsu`, …)
 * and resolve them server-side — so no `/search/id` round-trips are needed
 * (the docs explicitly discourage looping `/search/id` for export resolution).
 *
 * Resolution order:
 * - Embedded provider IDs in the metaId are returned directly:
 *   numeric → `{ simkl }`, `tt…` → `{ imdb }`, `tmdb:…` → `{ tmdb }`,
 *   `kitsu:…` → `{ kitsu }`, `mal:…` → `{ mal }`, `tvdb:…` → `{ tvdb }`
 * - Otherwise, check the meta_ids DB cache for previously resolved IDs.
 */
export async function resolveSimklIds(metaId: string, type: ContentType): Promise<SimklIds | null> {
  // Numeric Simkl ID — no lookup needed
  if (/^\d+$/.test(metaId)) {
    const num = Number(metaId);
    if (!isNaN(num)) {
      return { simkl: num };
    }
  }

  // IMDB ID — return directly (Simkl API expects this format)
  if (metaId.startsWith('tt')) {
    return { imdb: metaId };
  }

  // TMDB ID — extract the numeric part
  if (metaId.startsWith('tmdb:')) {
    const parts = metaId.split(':');
    const tmdbId = Number(parts[2]);
    if (!isNaN(tmdbId)) {
      return { tmdb: tmdbId };
    }
  }

  // Anime catalog IDs — Simkl resolves these server-side on write endpoints
  const kitsuMatch = metaId.match(/^kitsu:(\d+)$/);
  if (kitsuMatch) {
    return { kitsu: Number(kitsuMatch[1]) };
  }
  const malMatch = metaId.match(/^mal:(\d+)$/);
  if (malMatch) {
    return { mal: Number(malMatch[1]) };
  }
  const tvdbMatch = metaId.match(/^tvdb:(\d+)$/);
  if (tvdbMatch) {
    return { tvdb: Number(tvdbMatch[1]) };
  }

  // Check DB for existing resolved IDs
  const existing = await getExternalIdsForMetaId(metaId);
  if (existing) {
    const ids = buildSimklIds(existing);
    if (ids && Object.keys(ids).length > 0) {
      debug('resolvedFromDb', { metaId, ids });
      return ids;
    }
  }

  debug('notFound', { metaId, type });
  return null;
}

function buildSimklIds(external: {
  simklId: string | null;
  imdbId: string | null;
  tmdbId: string | null;
  tvdbId: string | null;
  kitsuId: string | null;
  anilistId: string | null;
  malId: string | null;
}): SimklIds | null {
  const ids: SimklIds = {};
  if (external.simklId) ids.simkl = Number(external.simklId);
  if (external.imdbId) ids.imdb = external.imdbId;
  if (external.tmdbId) ids.tmdb = Number(external.tmdbId);
  if (external.tvdbId) ids.tvdb = Number(external.tvdbId);
  if (external.kitsuId) ids.kitsu = Number(external.kitsuId);
  if (external.malId) ids.mal = Number(external.malId);
  return Object.keys(ids).length > 0 ? ids : null;
}
