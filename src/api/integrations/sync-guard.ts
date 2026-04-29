import { removeProfileMyList } from '@/db/queries/myList';
import { removeProfileWatchHistory } from '@/db/queries/watchHistory';
import { createDebugLogger } from '@/utils/debug';

const debug = createDebugLogger('SyncGuard');

/** Default batch size for bulk database operations during sync. */
export const SYNC_BATCH_SIZE = 50;

// ---------------------------------------------------------------------------
// Import concurrency guard
// ---------------------------------------------------------------------------

const activeImportSets = new Map<string, Set<string>>();

function getActiveImports(provider: string): Set<string> {
  let set = activeImportSets.get(provider);
  if (!set) {
    set = new Set();
    activeImportSets.set(provider, set);
  }
  return set;
}

/**
 * Wraps a sync import in a per-provider, per-profile concurrency guard.
 *
 * - Skips (returns `true`) if an import for the same profile is already running.
 * - Clears local data if `clearLocalFirst` is set.
 * - Catches errors, logs them, and returns `false`.
 */
export async function guardedImport(
  provider: string,
  profileId: string,
  opts: { clearLocalFirst?: boolean } | undefined,
  fn: () => Promise<boolean>
): Promise<boolean> {
  const active = getActiveImports(provider);

  if (active.has(profileId)) {
    debug('importSkipped:Concurrent', { provider, profileId });
    return true;
  }

  active.add(profileId);
  try {
    if (opts?.clearLocalFirst) {
      await clearLocalSyncData(profileId);
    }
    return await fn();
  } catch (error) {
    debug('importError', { provider, profileId, error });
    return false;
  } finally {
    active.delete(profileId);
  }
}

// ---------------------------------------------------------------------------
// Local data management
// ---------------------------------------------------------------------------

/**
 * Removes all local watch history and My List entries for a profile.
 * Used during clearLocalFirst imports.
 */
export async function clearLocalSyncData(profileId: string): Promise<void> {
  await removeProfileWatchHistory(profileId);
  await removeProfileMyList(profileId);
}

// ---------------------------------------------------------------------------
// Batch processing
// ---------------------------------------------------------------------------

/**
 * Processes items in batches of `SYNC_BATCH_SIZE` using `Promise.all`.
 */
export async function batchProcess<T>(
  items: T[],
  processItem: (item: T) => Promise<void>
): Promise<void> {
  for (let i = 0; i < items.length; i += SYNC_BATCH_SIZE) {
    await Promise.all(items.slice(i, i + SYNC_BATCH_SIZE).map(processItem));
  }
}
