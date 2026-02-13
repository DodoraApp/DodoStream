import type { ContentType, Manifest } from '@/types/stremio';

// ── Device ──────────────────────────────────────────────────────────────────

/** Unique device registration payload */
export interface SyncDevice {
    id: string;
    name: string;
    platform: string;
    lastSeenAt: number;
}

// ── Sync Entities ───────────────────────────────────────────────────────────

/** An addon record as stored on the sync server */
export interface SyncAddon {
    id: string;
    manifestUrl: string;
    manifest: Manifest;
    installedAt: number;
    useCatalogsOnHome: boolean;
    useCatalogsInSearch: boolean;
    useForSubtitles: boolean;
}

/** A continue-watching / watch-history entry on the server */
export interface SyncWatchHistoryItem {
    id: string;
    type: ContentType;
    videoId?: string;
    progressSeconds: number;
    durationSeconds: number;
    lastStreamTargetType?: 'url' | 'external' | 'yt';
    lastStreamTargetValue?: string;
    lastWatchedAt: number;
}

/** A my-list entry on the server */
export interface SyncMyListItem {
    id: string;
    type: ContentType;
    addedAt: number;
}

/** Continue-watching hidden entries */
export interface SyncContinueWatchingHidden {
    hidden: Record<string, true>;
}

// ── Sync Operations ─────────────────────────────────────────────────────────

/**
 * Every mutation that can be synced across devices.
 * The `collection` field indicates which data domain is affected.
 * The `action` field indicates the mutation type.
 * The `payload` carries the data needed to apply the mutation.
 * The `timestamp` is the wall-clock time when the mutation occurred.
 * The `deviceId` is the originating device so receivers can skip their own echoes.
 */
export type SyncOperation =
    | AddonSyncOperation
    | WatchHistorySyncOperation
    | MyListSyncOperation
    | ContinueWatchingSyncOperation
    | ProfileSyncOperation;

// ── Addon operations ────────────────────────────────────────────────────────

export type AddonSyncOperation =
    | { collection: 'addons'; action: 'add'; payload: SyncAddon; timestamp: number; deviceId: string }
    | { collection: 'addons'; action: 'remove'; payload: { id: string }; timestamp: number; deviceId: string }
    | { collection: 'addons'; action: 'update'; payload: SyncAddon; timestamp: number; deviceId: string }
    | { collection: 'addons'; action: 'clear'; payload: null; timestamp: number; deviceId: string }
    | { collection: 'addons'; action: 'toggle_home'; payload: { id: string; value: boolean }; timestamp: number; deviceId: string }
    | { collection: 'addons'; action: 'toggle_search'; payload: { id: string; value: boolean }; timestamp: number; deviceId: string }
    | { collection: 'addons'; action: 'toggle_subtitles'; payload: { id: string; value: boolean }; timestamp: number; deviceId: string };

// ── Watch history operations ────────────────────────────────────────────────

export type WatchHistorySyncOperation =
    | { collection: 'watch_history'; action: 'upsert'; payload: SyncWatchHistoryItem & { profileId: string }; timestamp: number; deviceId: string }
    | { collection: 'watch_history'; action: 'remove'; payload: { id: string; videoId?: string; profileId: string }; timestamp: number; deviceId: string }
    | { collection: 'watch_history'; action: 'remove_meta'; payload: { id: string; profileId: string }; timestamp: number; deviceId: string };

// ── My list operations ──────────────────────────────────────────────────────

export type MyListSyncOperation =
    | { collection: 'my_list'; action: 'add'; payload: SyncMyListItem & { profileId: string }; timestamp: number; deviceId: string }
    | { collection: 'my_list'; action: 'remove'; payload: { id: string; type: ContentType; profileId: string }; timestamp: number; deviceId: string };

// ── Continue watching operations ────────────────────────────────────────────

export type ContinueWatchingSyncOperation =
    | { collection: 'continue_watching'; action: 'set_hidden'; payload: { metaId: string; hidden: boolean; profileId: string }; timestamp: number; deviceId: string }
    | { collection: 'continue_watching'; action: 'clear_hidden'; payload: { profileId: string }; timestamp: number; deviceId: string };

// ── Profile operations ──────────────────────────────────────────────────────

export type ProfileSyncOperation =
    | { collection: 'profiles'; action: 'create'; payload: { id: string; name: string; avatarIcon?: string; avatarColor?: string }; timestamp: number; deviceId: string }
    | { collection: 'profiles'; action: 'update'; payload: { id: string; name?: string; avatarIcon?: string; avatarColor?: string }; timestamp: number; deviceId: string }
    | { collection: 'profiles'; action: 'remove'; payload: { id: string }; timestamp: number; deviceId: string };

// ── Server Responses ────────────────────────────────────────────────────────

export interface SyncServerInfo {
    version: string;
    name: string;
    uptime: number;
}

export interface SyncAuthResponse {
    token: string;
    deviceId: string;
    expiresAt: number;
    /** Device approval status: 'pending' | 'approved' | 'rejected' */
    status: 'pending' | 'approved' | 'rejected';
}

export interface SyncDeviceStatusResponse {
    deviceId: string;
    status: 'pending' | 'approved' | 'rejected';
}

/** Full snapshot of all synced data returned on initial connect / full sync */
export interface SyncSnapshot {
    addons: SyncAddon[];
    watchHistory: Record<string, SyncWatchHistoryItem[]>; // keyed by profileId
    myList: Record<string, SyncMyListItem[]>; // keyed by profileId
    continueWatchingHidden: Record<string, Record<string, true>>; // keyed by profileId
    profiles: Array<{ id: string; name: string; avatarIcon?: string; avatarColor?: string }>;
    timestamp: number;
}

// ── WebSocket Messages ──────────────────────────────────────────────────────

export type SyncWebSocketMessage =
    | { type: 'auth'; token: string }
    | { type: 'auth_ok'; deviceId: string }
    | { type: 'auth_error'; message: string }
    | { type: 'sync_operation'; operation: SyncOperation }
    | { type: 'sync_snapshot'; snapshot: SyncSnapshot }
    | { type: 'request_snapshot' }
    | { type: 'ping' }
    | { type: 'pong' };
