import { and, eq, inArray } from 'drizzle-orm';
import { db, initializeDatabase } from '@/db/client';
import { syncQueue } from '@/db/schema';
import type { ContentType } from '@/types/stremio';
import { useIntegrationsStore } from '@/store/integrations.store';

export type SyncAction = 'remove_history' | 'remove_watchlist';
export type SyncProvider = 'simkl';

export async function addToSyncQueue(
  profileId: string,
  action: SyncAction,
  metaId: string,
  type: ContentType,
  videoId?: string,
  ignoreProvider?: SyncProvider
): Promise<void> {
  await initializeDatabase();

  // Get active providers for the profile to know which queues to populate
  const state = useIntegrationsStore.getState();
  const activeProviders: SyncProvider[] = [];

  if (state.settings[profileId]?.simkl?.connection && ignoreProvider !== 'simkl') {
    activeProviders.push('simkl');
  }

  if (activeProviders.length === 0) return;

  const now = Date.now();
  const inserts = activeProviders.map(provider => ({
    profileId,
    provider,
    action,
    metaId,
    videoId,
    type,
    createdAt: now,
  }));

  await db.insert(syncQueue).values(inserts);
}
export async function cancelPendingSyncRemovals(
  profileId: string,
  metaId: string,
  actions: SyncAction[]
): Promise<void> {
  await initializeDatabase();

  for (const action of actions) {
    await db
      .delete(syncQueue)
      .where(
        and(
          eq(syncQueue.profileId, profileId),
          eq(syncQueue.metaId, metaId),
          eq(syncQueue.action, action)
        )
      );
  }
}

export async function listSyncQueueForProvider(
  profileId: string,
  provider: SyncProvider
) {
  await initializeDatabase();

  return db
    .select()
    .from(syncQueue)
    .where(
      and(
        eq(syncQueue.profileId, profileId),
        eq(syncQueue.provider, provider)
      )
    );
}

export async function deleteFromSyncQueue(ids: number[]): Promise<void> {
  if (ids.length === 0) return;

  await initializeDatabase();
  await db.delete(syncQueue).where(inArray(syncQueue.id, ids));
}
