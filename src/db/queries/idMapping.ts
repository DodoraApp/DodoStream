import type { InferSelectModel } from 'drizzle-orm';
import { and, eq, getTableColumns, inArray, isNotNull, sql } from 'drizzle-orm';

import { db, initializeDatabase } from '@/db/client';
import { metaIds } from '@/db/schema';

export type MetaIdsRow = InferSelectModel<typeof metaIds>;

interface UpsertMetaIdsParams {
  metaId: string;
  imdbId?: string | null;
  tmdbId?: string | null;
  traktId?: string | null;
  simklId?: string | null;
  tvdbId?: string | null;
  kitsuId?: string | null;
  anilistId?: string | null;
  malId?: string | null;
}

const SQLITE_MAX_BIND_PARAMS = 999;

export async function upsertMetaIds(params: UpsertMetaIdsParams): Promise<void> {
  await initializeDatabase();

  const now = Date.now();
  const { metaId, ...externalIds } = params;

  // Build set object that only includes provided (non-undefined) external IDs.
  // Using sql`excluded.col` ensures we never overwrite a non-null DB value with null.
  const set: Record<string, ReturnType<typeof sql> | string | number> = {
    updatedAt: now,
  };

  const columns = getTableColumns(metaIds);
  for (const [key, value] of Object.entries(externalIds)) {
    if (value !== undefined && key in columns) {
      // Preserve existing non-null value; only update if the column is null OR the new value is non-null.
      const col = columns[key as keyof typeof columns];
      set[key] = sql`COALESCE(excluded.${sql.identifier(col.name)}, ${col})`;
    }
  }

  await db
    .insert(metaIds)
    .values({
      metaId,
      ...Object.fromEntries(Object.entries(externalIds).filter(([, v]) => v !== undefined)),
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: metaIds.metaId,
      set,
    });
}

export async function getMetaIdByTraktId(traktId: string): Promise<string | null> {
  await initializeDatabase();

  const rows = await db
    .select({ metaId: metaIds.metaId })
    .from(metaIds)
    .where(eq(metaIds.traktId, traktId))
    .limit(1);

  return rows[0]?.metaId ?? null;
}

export async function getMetaIdByTmdbId(tmdbId: string): Promise<string | null> {
  await initializeDatabase();

  const rows = await db
    .select({ metaId: metaIds.metaId })
    .from(metaIds)
    .where(eq(metaIds.tmdbId, tmdbId))
    .limit(1);

  return rows[0]?.metaId ?? null;
}

export async function getMetaIdByImdbId(imdbId: string): Promise<string | null> {
  await initializeDatabase();

  const rows = await db
    .select({ metaId: metaIds.metaId })
    .from(metaIds)
    .where(eq(metaIds.imdbId, imdbId))
    .limit(1);

  return rows[0]?.metaId ?? null;
}

export async function getMetaIdBySimklId(simklId: string): Promise<string | null> {
  await initializeDatabase();

  const rows = await db
    .select({ metaId: metaIds.metaId })
    .from(metaIds)
    .where(eq(metaIds.simklId, simklId))
    .limit(1);

  return rows[0]?.metaId ?? null;
}

export async function getMetaIdsByTraktIds(traktIds: string[]): Promise<Map<string, string>> {
  await initializeDatabase();

  if (traktIds.length === 0) return new Map();

  const result = new Map<string, string>();

  // Chunk to stay under SQLite bind param limits.
  const chunkSize = SQLITE_MAX_BIND_PARAMS;
  for (let i = 0; i < traktIds.length; i += chunkSize) {
    const chunk = traktIds.slice(i, i + chunkSize);
    const rows = await db
      .select({ metaId: metaIds.metaId, traktId: metaIds.traktId })
      .from(metaIds)
      .where(and(inArray(metaIds.traktId, chunk), isNotNull(metaIds.traktId)));

    for (const row of rows) {
      if (row.traktId) {
        result.set(row.traktId, row.metaId);
      }
    }
  }

  return result;
}

export async function getExternalIdsForMetaId(metaId: string): Promise<{
  imdbId: string | null;
  tmdbId: string | null;
  traktId: string | null;
  simklId: string | null;
  tvdbId: string | null;
  kitsuId: string | null;
  anilistId: string | null;
  malId: string | null;
} | null> {
  await initializeDatabase();

  const rows = await db
    .select({
      imdbId: metaIds.imdbId,
      tmdbId: metaIds.tmdbId,
      traktId: metaIds.traktId,
      simklId: metaIds.simklId,
      tvdbId: metaIds.tvdbId,
      kitsuId: metaIds.kitsuId,
      anilistId: metaIds.anilistId,
      malId: metaIds.malId,
    })
    .from(metaIds)
    .where(eq(metaIds.metaId, metaId))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    imdbId: row.imdbId ?? null,
    tmdbId: row.tmdbId ?? null,
    traktId: row.traktId ?? null,
    simklId: row.simklId ?? null,
    tvdbId: row.tvdbId ?? null,
    kitsuId: row.kitsuId ?? null,
    anilistId: row.anilistId ?? null,
    malId: row.malId ?? null,
  };
}

export async function countMetaIds(): Promise<number> {
  await initializeDatabase();
  const rows = await db.select({ count: sql<number>`count(*)` }).from(metaIds);
  return Number(rows[0]?.count ?? 0);
}

export async function clearMetaIds(): Promise<void> {
  await initializeDatabase();
  await db.delete(metaIds);
}
