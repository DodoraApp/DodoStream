import { and, desc, eq, notInArray } from 'drizzle-orm';

import { db, initializeDatabase } from '@/db/client';
import { getMetaCacheNames } from '@/db/queries/metaCache';
import { syncLog, type SyncLogDirection, type SyncLogProvider } from '@/db/schema';
import type { ContentType } from '@/types/stremio';

/** Max log rows kept per profile. Older entries are pruned on insert. */
export const SYNC_LOG_LIMIT = 100;

export interface DbSyncLogItem {
  id: number;
  profileId: string;
  provider: SyncLogProvider;
  direction: SyncLogDirection;
  metaId: string;
  type: ContentType;
  title: string;
  createdAt: number;
}

/** One loggable synced item. `title` falls back to `metaId` when omitted. */
export interface SyncLogItemInput {
  metaId: string;
  type: ContentType;
  title?: string;
}

/**
 * Records synced items (newest-first view, capped at SYNC_LOG_LIMIT per
 * profile). Prunes the oldest rows so the table never grows unbounded.
 */
export async function logSyncedItems(
  profileId: string,
  provider: SyncLogProvider,
  direction: SyncLogDirection,
  items: SyncLogItemInput[]
): Promise<void> {
  if (items.length === 0) return;

  await initializeDatabase();

  const now = Date.now();
  await db.insert(syncLog).values(
    items.map((item) => ({
      profileId,
      provider,
      direction,
      metaId: item.metaId,
      type: item.type,
      title: item.title ?? item.metaId,
      createdAt: now,
    }))
  );

  await pruneSyncLog(profileId);
}

/**
 * Same as logSyncedItems but resolves display titles from the meta cache.
 * Used by exports, where only meta ids are known. Dedupes by meta id.
 */
export async function logSyncedItemsForMetaIds(
  profileId: string,
  provider: SyncLogProvider,
  direction: SyncLogDirection,
  items: { id: string; type: ContentType }[]
): Promise<void> {
  if (items.length === 0) return;

  const seen = new Set<string>();
  const unique: { metaId: string; type: ContentType }[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push({ metaId: item.id, type: item.type });
  }

  const names = await getMetaCacheNames(unique.map((item) => item.metaId));
  await logSyncedItems(
    profileId,
    provider,
    direction,
    unique.map((item) => ({ ...item, title: names.get(item.metaId) }))
  );
}

/** Returns the newest sync log entries for a profile (newest first). */
export async function listSyncLogForProfile(
  profileId: string,
  limit = SYNC_LOG_LIMIT
): Promise<DbSyncLogItem[]> {
  await initializeDatabase();

  const rows = await db
    .select()
    .from(syncLog)
    .where(eq(syncLog.profileId, profileId))
    .orderBy(desc(syncLog.id))
    .limit(limit);

  return rows as unknown as DbSyncLogItem[];
}

/** Keeps only the newest SYNC_LOG_LIMIT rows for a profile. */
async function pruneSyncLog(profileId: string): Promise<void> {
  const keepIds = db
    .select({ id: syncLog.id })
    .from(syncLog)
    .where(eq(syncLog.profileId, profileId))
    .orderBy(desc(syncLog.id))
    .limit(SYNC_LOG_LIMIT);

  await db
    .delete(syncLog)
    .where(and(eq(syncLog.profileId, profileId), notInArray(syncLog.id, keepIds)));
}
