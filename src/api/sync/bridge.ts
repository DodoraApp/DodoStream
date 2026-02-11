import type { SyncOperation } from '@/api/sync/types';

/**
 * A lightweight bridge so domain stores (addon, watch-history, etc.)
 * can push sync operations without importing the sync store directly.
 *
 * This avoids circular dependencies: sync.store imports domain stores
 * to apply incoming operations, while domain stores use this bridge to
 * broadcast outgoing mutations.
 *
 * The sync store registers itself as the handler on initialisation.
 */

type SyncPushHandler = (operation: Omit<SyncOperation, 'timestamp' | 'deviceId'>) => void;

let pushHandler: SyncPushHandler | null = null;
let checkApplyingRemote: (() => boolean) | null = null;

/** Called by sync.store.ts at module load to register itself. */
export function registerSyncPushHandler(
    handler: SyncPushHandler,
    isApplyingRemote: () => boolean,
): void {
    pushHandler = handler;
    checkApplyingRemote = isApplyingRemote;
}

/**
 * Push a sync operation if sync is configured. Safe to call even when
 * sync is disabled — it will silently no-op.
 */
export function pushSyncOperation(operation: Omit<SyncOperation, 'timestamp' | 'deviceId'>): void {
    // Don't re-broadcast operations that are being applied from the server
    if (checkApplyingRemote?.()) return;
    pushHandler?.(operation);
}
