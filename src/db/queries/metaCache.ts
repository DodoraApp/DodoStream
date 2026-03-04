import { and, eq, gte, inArray } from 'drizzle-orm';
import type { MetaDetail, MetaVideo } from '@/types/stremio';
import { db, initializeDatabase } from '@/db/client';
import { metaCache, videos } from '@/db/schema';

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function upsertMetaCache(meta: MetaDetail): Promise<void> {
  await initializeDatabase();

  const now = Date.now();
  const expiresAt = now + CACHE_TTL_MS;

  await db.transaction(async (tx) => {
    await tx
      .insert(metaCache)
      .values({
        metaId: meta.id,
        type: meta.type,
        name: meta.name,
        description: meta.description,
        poster: meta.poster,
        background: meta.background,
        logo: meta.logo,
        imdbRating: meta.imdbRating,
        releaseYear: meta.releaseInfo?.split('–')[0],
        fetchedAt: now,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: metaCache.metaId,
        set: {
          type: meta.type,
          name: meta.name,
          description: meta.description,
          poster: meta.poster,
          background: meta.background,
          logo: meta.logo,
          imdbRating: meta.imdbRating,
          releaseYear: meta.releaseInfo?.split('–')[0],
          fetchedAt: now,
          expiresAt,
        },
      });

    if (!meta.videos || meta.videos.length === 0) return;

    for (const video of meta.videos) {
      await tx
        .insert(videos)
        .values({
          metaId: meta.id,
          videoId: video.id,
          title: video.title,
          season: video.season ?? null,
          episode: video.episode ?? null,
          thumbnail: video.thumbnail,
          overview: video.overview,
          released: video.released,
          fetchedAt: now,
        })
        .onConflictDoUpdate({
          target: [videos.metaId, videos.videoId],
          set: {
            title: video.title,
            season: video.season ?? null,
            episode: video.episode ?? null,
            thumbnail: video.thumbnail,
            overview: video.overview,
            released: video.released,
            fetchedAt: now,
          },
        });
    }
  });
}

export async function isMetaCacheStale(metaId: string): Promise<boolean> {
  await initializeDatabase();

  const rows = await db
    .select({ expiresAt: metaCache.expiresAt })
    .from(metaCache)
    .where(eq(metaCache.metaId, metaId))
    .limit(1);

  if (!rows.length) return true;
  return Date.now() > Number(rows[0].expiresAt);
}

export async function getStaleMetaIds(metaIds: string[]): Promise<string[]> {
  await initializeDatabase();
  if (metaIds.length === 0) return [];

  const now = Date.now();

  // Query for all requested metaIds that exist and are NOT expired
  const validRows = await db
    .select({ metaId: metaCache.metaId })
    .from(metaCache)
    .where(and(inArray(metaCache.metaId, metaIds), gte(metaCache.expiresAt, now)));

  const validSet = new Set(validRows.map((row) => row.metaId));

  // Return all metaIds that are NOT in the valid set (either expired or missing)
  return metaIds.filter((id) => !validSet.has(id));
}

/**
 * Retrieves a single video entry from the SQLite videos table.
 * Returns null if the video is not cached yet.
 */
export async function getVideoForEntry(metaId: string, videoId: string): Promise<MetaVideo | null> {
  await initializeDatabase();

  const rows = await db
    .select()
    .from(videos)
    .where(and(eq(videos.metaId, metaId), eq(videos.videoId, videoId)))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.videoId ?? videoId,
    title: row.title ?? '',
    released: row.released ?? '',
    season: row.season ?? undefined,
    episode: row.episode ?? undefined,
    thumbnail: row.thumbnail ?? undefined,
    overview: row.overview ?? undefined,
  };
}
