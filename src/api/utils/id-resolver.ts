import {
  getMetaIdByImdbId,
  getMetaIdBySimklId,
  getMetaIdByTmdbId,
  getMetaIdByTraktId,
  upsertMetaIds,
} from '@/db/queries/idMapping';
import type { ContentType } from '@/types/stremio';
import { createDebugLogger } from '@/utils/debug';

const debug = createDebugLogger('IdResolver');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ResolveMetaIdParams {
  ids: {
    imdb?: string | null;
    tmdb?: string | null;
    trakt?: string | null;
    simkl?: string | null;
  };
  type: ContentType;
  provider: 'trakt' | 'simkl';
}

interface UpsertMetaIdMappingParams {
  metaId: string;
  imdbId?: string | null;
  tmdbId?: string | null;
  traktId?: string | null;
  simklId?: string | null;
}

// ---------------------------------------------------------------------------
// Resolve
// ---------------------------------------------------------------------------

/**
 * Resolves a metaId from provider IDs, using the DB cache first.
 *
 * Strategy:
 * 1. Check meta_ids DB table by any available provider ID (fast, persistent).
 * 2. Parse metaId directly if it embeds an external ID (imdb: 'tt…', tmdb: 'tmdb:movie:123').
 * 3. Return null if nothing resolves.
 */
export async function resolveMetaId(params: ResolveMetaIdParams): Promise<string | null> {
  const { ids, type, provider } = params;
  debug('resolveMetaId:start', { ids, type, provider });

  // 1. DB cache – try each available provider ID.
  const dbLookup = await lookupMetaIdInDb(ids);
  if (dbLookup) {
    debug('resolveMetaId:dbHit', { metaId: dbLookup });
    return dbLookup;
  }

  // 2. Direct parsing – metaId may already embed an external ID.
  const parsed = parseMetaId(ids, type, provider);
  if (parsed) {
    debug('resolveMetaId:parsed', { metaId: parsed });
    return parsed;
  }

  debug('resolveMetaId:notFound', { ids });
  return null;
}

/** Look up a metaId in the DB using any non-null provider ID. */
async function lookupMetaIdInDb(ids: ResolveMetaIdParams['ids']): Promise<string | null> {
  const { trakt, imdb, tmdb, simkl } = ids;

  // Try each available provider ID against the DB.
  if (trakt) {
    const metaId = await getMetaIdByTraktId(trakt);
    if (metaId) return metaId;
  }
  if (imdb) {
    const metaId = await getMetaIdByImdbId(imdb);
    if (metaId) return metaId;
  }
  if (tmdb) {
    const normalized = normalizeTmdbForLookup(tmdb);
    const metaId = await getMetaIdByTmdbId(normalized);
    if (metaId) return metaId;
  }
  if (simkl) {
    const metaId = await getMetaIdBySimklId(simkl);
    if (metaId) return metaId;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

/** Attempt to construct a metaId from raw provider IDs. */
function parseMetaId(
  ids: ResolveMetaIdParams['ids'],
  _type: ContentType,
  _provider: 'trakt' | 'simkl'
): string | null {
  // Prefer IMDB ID as the canonical metaId format (starts with 'tt').
  if (ids.imdb && ids.imdb.startsWith('tt')) {
    return ids.imdb;
  }

  // TMDB IDs are stored as 'tmdb:<type>:<numeric>' in Stremio.
  if (ids.tmdb) {
    const tmdbValue = normalizeTmdbForLookup(ids.tmdb);
    return _type === 'series' ? `tmdb:show:${tmdbValue}` : `tmdb:movie:${tmdbValue}`;
  }

  // Trakt numeric ID – store as-is.
  if (ids.trakt) {
    return ids.trakt;
  }

  // Simkl numeric ID.
  if (ids.simkl) {
    return ids.simkl;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Upsert
// ---------------------------------------------------------------------------

/**
 * Saves a resolved ID mapping to the meta_ids table.
 * Delegates to `upsertMetaIds` from `src/db/queries/idMapping.ts`.
 */
export async function upsertMetaIdMapping(params: UpsertMetaIdMappingParams): Promise<void> {
  const { metaId, imdbId, tmdbId, traktId, simklId } = params;
  debug('upsertMetaIdMapping', { metaId, imdbId, tmdbId, traktId, simklId });

  await upsertMetaIds({
    metaId,
    imdbId: imdbId ?? undefined,
    tmdbId: tmdbId ?? undefined,
    traktId: traktId ?? undefined,
    simklId: simklId ?? undefined,
  });
}

/**
 * Normalizes a TMDB ID for DB lookup.
 * TMDB IDs in metaId strings are 'tmdb:movie:123' or 'tmdb:show:123' — strip the prefix.
 * Raw numeric TMDB IDs are used as-is.
 */
function normalizeTmdbForLookup(tmdb: string): string {
  if (tmdb.startsWith('tmdb:')) {
    const parts = tmdb.split(':');
    return parts[parts.length - 1] ?? tmdb;
  }
  return tmdb;
}
