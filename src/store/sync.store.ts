import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createDebugLogger } from '@/utils/debug';
import {
    getSyncServerInfo,
    registerDevice,
    fetchSnapshot,
    pushOperation as pushOperationRest,
    pushOperationBatch,
    checkDeviceStatus,
    SyncApiError,
} from '@/api/sync/client';
import {
    SyncWebSocketManager,
    type SyncConnectionState,
} from '@/api/sync/websocket';
import type { SyncOperation, SyncSnapshot } from '@/api/sync/types';
import { useAddonStore } from '@/store/addon.store';
import { useWatchHistoryStore } from '@/store/watch-history.store';
import { useMyListStore } from '@/store/my-list.store';
import { useContinueWatchingStore } from '@/store/continue-watching.store';
import { useProfileStore } from '@/store/profile.store';
import { registerSyncPushHandler } from '@/api/sync/bridge';

const debug = createDebugLogger('SyncStore');

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Generate a deterministic-ish device ID persisted across sessions */
const generateDeviceId = (): string =>
    `device_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

const getDeviceName = (): string => {
    // Provide a reasonable default name based on platform
    const platformName = Platform.OS === 'android' ? 'Android' : Platform.OS === 'ios' ? 'iOS' : 'Web';
    return `DodoStream (${platformName})`;
};

const getPlatform = (): string => {
    if (Platform.isTV) return `${Platform.OS}-tv`;
    return Platform.OS;
};

// ── State ───────────────────────────────────────────────────────────────────

interface SyncState {
    // Persisted config
    serverUrl: string;
    token: string | null;
    deviceId: string;
    isEnabled: boolean;
    lastSyncAt: number | null;
    /** The device's approval status on the server */
    deviceStatus: 'pending' | 'approved' | 'rejected' | null;
    /** Operations queued while disconnected, flushed on reconnect */
    pendingOperations: SyncOperation[];

    // Runtime state (not persisted)
    connectionState: SyncConnectionState;
    error: string | null;
    isTesting: boolean;
    /** Whether we're currently polling for admin approval */
    isPollingApproval: boolean;

    // Actions
    setServerUrl: (url: string) => void;
    connect: (serverPassword?: string) => Promise<void>;
    disconnect: () => void;
    testConnection: (url: string) => Promise<{ ok: boolean; name?: string; version?: string; error?: string }>;

    /**
     * Start polling the server to check if the device has been approved.
     * Resolves when approved, rejects if rejected or on error.
     */
    pollForApproval: () => void;

    /** Stop polling for approval */
    stopPollingApproval: () => void;

    /**
     * Called by other stores after a mutation to broadcast the change.
     * If WebSocket is connected it pushes via WS; otherwise queues or falls back to REST.
     * If offline, operations are persisted and flushed on reconnect.
     */
    pushOperation: (operation: Omit<SyncOperation, 'timestamp' | 'deviceId'>) => void;
}

// ── WebSocket singleton (lives outside Zustand to avoid serialisation) ──────

let wsManager: SyncWebSocketManager | null = null;

/** Timer for polling device approval status */
let approvalPollTimer: ReturnType<typeof setInterval> | null = null;

const APPROVAL_POLL_INTERVAL_MS = 5_000;

// ── Applying incoming operations ────────────────────────────────────────────

/**
 * When we receive an operation from the server (originated on another device),
 * we apply it directly to the relevant Zustand store.
 * This is the "merge" step of the sync protocol.
 */
function applyRemoteOperation(operation: SyncOperation): void {
    debug('applyRemote', { collection: operation.collection, action: operation.action });

    switch (operation.collection) {
        case 'addons': {
            const store = useAddonStore.getState();
            switch (operation.action) {
                case 'add':
                    if (!store.hasAddon(operation.payload.id)) {
                        store.addAddon(operation.payload.id, operation.payload.manifestUrl, operation.payload.manifest);
                    }
                    break;
                case 'remove':
                    store.removeAddon(operation.payload.id);
                    break;
                case 'update':
                    store.updateAddon(operation.payload.id, operation.payload.manifest);
                    break;
                case 'clear':
                    store.clearAllAddons();
                    break;
                case 'toggle_home':
                    if (store.hasAddon(operation.payload.id)) {
                        const addon = store.addons[operation.payload.id];
                        if (addon && addon.useCatalogsOnHome !== operation.payload.value) {
                            store.toggleUseCatalogsOnHome(operation.payload.id);
                        }
                    }
                    break;
                case 'toggle_search':
                    if (store.hasAddon(operation.payload.id)) {
                        const addon = store.addons[operation.payload.id];
                        if (addon && addon.useCatalogsInSearch !== operation.payload.value) {
                            store.toggleUseCatalogsInSearch(operation.payload.id);
                        }
                    }
                    break;
                case 'toggle_subtitles':
                    if (store.hasAddon(operation.payload.id)) {
                        const addon = store.addons[operation.payload.id];
                        if (addon && addon.useForSubtitles !== operation.payload.value) {
                            store.toggleUseForSubtitles(operation.payload.id);
                        }
                    }
                    break;
            }
            break;
        }

        case 'watch_history': {
            const store = useWatchHistoryStore.getState();
            switch (operation.action) {
                case 'upsert': {
                    const { profileId, ...item } = operation.payload;
                    // Temporarily set the active profile to apply the mutation,
                    // then restore the original.
                    const currentProfile = store.activeProfileId;
                    store.setActiveProfileId(profileId);
                    store.upsertItem(item);
                    store.setActiveProfileId(currentProfile);
                    break;
                }
                case 'remove': {
                    const { profileId, id, videoId } = operation.payload;
                    const currentProfile = store.activeProfileId;
                    store.setActiveProfileId(profileId);
                    store.remove(id, videoId);
                    store.setActiveProfileId(currentProfile);
                    break;
                }
                case 'remove_meta': {
                    const { profileId, id } = operation.payload;
                    const currentProfile = store.activeProfileId;
                    store.setActiveProfileId(profileId);
                    store.removeMeta(id);
                    store.setActiveProfileId(currentProfile);
                    break;
                }
            }
            break;
        }

        case 'my_list': {
            const store = useMyListStore.getState();
            switch (operation.action) {
                case 'add': {
                    const { profileId, ...item } = operation.payload;
                    const currentProfile = store.activeProfileId;
                    store.setActiveProfileId(profileId);
                    if (!store.isInMyList(item.id, item.type)) {
                        store.addToMyList(item);
                    }
                    store.setActiveProfileId(currentProfile);
                    break;
                }
                case 'remove': {
                    const { profileId, id, type } = operation.payload;
                    const currentProfile = store.activeProfileId;
                    store.setActiveProfileId(profileId);
                    store.removeFromMyList(id, type);
                    store.setActiveProfileId(currentProfile);
                    break;
                }
            }
            break;
        }

        case 'continue_watching': {
            const store = useContinueWatchingStore.getState();
            switch (operation.action) {
                case 'set_hidden': {
                    const { profileId, metaId, hidden } = operation.payload;
                    const currentProfile = store.activeProfileId;
                    store.setActiveProfileId(profileId);
                    store.setHidden(metaId, hidden);
                    store.setActiveProfileId(currentProfile);
                    break;
                }
                case 'clear_hidden': {
                    const { profileId } = operation.payload;
                    const currentProfile = store.activeProfileId;
                    store.setActiveProfileId(profileId);
                    store.clearHidden();
                    store.setActiveProfileId(currentProfile);
                    break;
                }
            }
            break;
        }

        case 'profiles': {
            const store = useProfileStore.getState();
            switch (operation.action) {
                case 'create': {
                    const { id, name, avatarIcon, avatarColor } = operation.payload;
                    if (!store.profiles[id]) {
                        // Directly set the profile with the server-provided ID
                        useProfileStore.setState((state) => ({
                            profiles: {
                                ...state.profiles,
                                [id]: {
                                    id,
                                    name,
                                    avatarIcon,
                                    avatarColor,
                                    createdAt: Date.now(),
                                    lastUsedAt: Date.now(),
                                },
                            },
                        }));
                    }
                    break;
                }
                case 'update': {
                    const { id, ...updates } = operation.payload;
                    if (store.profiles[id]) {
                        store.updateProfile(id, updates);
                    }
                    break;
                }
                case 'remove': {
                    const { id } = operation.payload;
                    if (store.profiles[id]) {
                        store.deleteProfile(id, { force: true });
                    }
                    break;
                }
            }
            break;
        }

        default:
            debug('unknownCollection', { collection: (operation as SyncOperation).collection });
    }
}

/**
 * Applies a full snapshot to all local stores.
 *
 * Two-way reconciliation:
 *   1. Add / update items present on the server but missing locally.
 *   2. **Remove** local items that the server no longer has (e.g. deleted
 *      on another device while this device was offline).
 */
function applySnapshot(snapshot: SyncSnapshot): void {
    debug('applySnapshot', { timestamp: snapshot.timestamp });

    const serverAddonIds = new Set(snapshot.addons.map((a) => a.id));
    const serverProfileIds = new Set(snapshot.profiles.map((p) => p.id));

    // ── Addons ──────────────────────────────────────────────────────────

    const addonStore = useAddonStore.getState();

    // Add / update addons from server
    for (const addon of snapshot.addons) {
        if (!addonStore.hasAddon(addon.id)) {
            addonStore.addAddon(addon.id, addon.manifestUrl, addon.manifest);
            // Apply synced toggle settings (addAddon defaults all to true)
            const current = useAddonStore.getState().addons[addon.id];
            if (current) {
                if (current.useCatalogsOnHome !== (addon.useCatalogsOnHome ?? true)) {
                    addonStore.toggleUseCatalogsOnHome(addon.id);
                }
                if (current.useCatalogsInSearch !== (addon.useCatalogsInSearch ?? true)) {
                    addonStore.toggleUseCatalogsInSearch(addon.id);
                }
                if (current.useForSubtitles !== (addon.useForSubtitles ?? true)) {
                    addonStore.toggleUseForSubtitles(addon.id);
                }
            }
        } else {
            addonStore.updateAddon(addon.id, addon.manifest);
        }
    }

    // Remove local addons absent from server
    for (const localId of Object.keys(useAddonStore.getState().addons)) {
        if (!serverAddonIds.has(localId)) {
            debug('snapshotRemoveAddon', { id: localId });
            addonStore.removeAddon(localId);
        }
    }

    // ── Watch history ───────────────────────────────────────────────────

    const watchStore = useWatchHistoryStore.getState();
    const currentWatchProfile = watchStore.activeProfileId;

    // Build a set of server watch-history keys per profile for diffing
    const serverWatchKeys: Record<string, Set<string>> = {};
    for (const [profileId, items] of Object.entries(snapshot.watchHistory)) {
        serverWatchKeys[profileId] = new Set(items.map((i) => `${i.id}:${i.videoId ?? '_'}`));
        watchStore.setActiveProfileId(profileId);
        for (const item of items) {
            watchStore.upsertItem(item);
        }
    }

    // Remove local watch-history items absent from server
    for (const [profileId, metaMap] of Object.entries(watchStore.byProfile)) {
        const serverKeys = serverWatchKeys[profileId];
        watchStore.setActiveProfileId(profileId);
        if (!serverKeys) {
            // Server has no history for this profile — remove all
            for (const metaId of Object.keys(metaMap)) {
                watchStore.removeMeta(metaId);
            }
        } else {
            for (const [metaId, videoMap] of Object.entries(metaMap)) {
                for (const item of Object.values(videoMap)) {
                    const key = `${item.id}:${item.videoId ?? '_'}`;
                    if (!serverKeys.has(key)) {
                        watchStore.remove(item.id, item.videoId);
                    }
                }
            }
        }
    }
    watchStore.setActiveProfileId(currentWatchProfile);

    // ── My list ─────────────────────────────────────────────────────────

    const myListStore = useMyListStore.getState();
    const currentMyListProfile = myListStore.activeProfileId;

    // Build server keys per profile
    const serverMyListKeys: Record<string, Set<string>> = {};
    for (const [profileId, items] of Object.entries(snapshot.myList)) {
        serverMyListKeys[profileId] = new Set(items.map((i) => i.id));
        myListStore.setActiveProfileId(profileId);
        for (const item of items) {
            if (!myListStore.isInMyList(item.id, item.type)) {
                myListStore.addToMyList(item);
            }
        }
    }

    // Remove local my-list items absent from server
    for (const [profileId, itemMap] of Object.entries(myListStore.byProfile)) {
        const serverKeys = serverMyListKeys[profileId];
        myListStore.setActiveProfileId(profileId);
        for (const item of Object.values(itemMap)) {
            if (!serverKeys || !serverKeys.has(item.id)) {
                myListStore.removeFromMyList(item.id, item.type);
            }
        }
    }
    myListStore.setActiveProfileId(currentMyListProfile);

    // ── Continue watching hidden ────────────────────────────────────────

    const cwStore = useContinueWatchingStore.getState();
    const currentCwProfile = cwStore.activeProfileId;

    for (const [profileId, hidden] of Object.entries(snapshot.continueWatchingHidden)) {
        cwStore.setActiveProfileId(profileId);
        for (const metaId of Object.keys(hidden)) {
            cwStore.setHidden(metaId, true);
        }
    }

    // Remove local hidden entries absent from server
    for (const [profileId, profileState] of Object.entries(cwStore.byProfile)) {
        const serverHidden = snapshot.continueWatchingHidden[profileId] ?? {};
        cwStore.setActiveProfileId(profileId);
        for (const metaId of Object.keys(profileState.hidden ?? {})) {
            if (!serverHidden[metaId]) {
                cwStore.setHidden(metaId, false);
            }
        }
    }
    cwStore.setActiveProfileId(currentCwProfile);

    // ── Profiles ────────────────────────────────────────────────────────

    const profileStore = useProfileStore.getState();

    // Add / update profiles from server
    for (const syncProfile of snapshot.profiles) {
        if (!profileStore.profiles[syncProfile.id]) {
            useProfileStore.setState((state) => ({
                profiles: {
                    ...state.profiles,
                    [syncProfile.id]: {
                        id: syncProfile.id,
                        name: syncProfile.name,
                        avatarIcon: syncProfile.avatarIcon,
                        avatarColor: syncProfile.avatarColor,
                        createdAt: Date.now(),
                        lastUsedAt: Date.now(),
                    },
                },
            }));
        } else {
            profileStore.updateProfile(syncProfile.id, {
                name: syncProfile.name,
                avatarIcon: syncProfile.avatarIcon,
                avatarColor: syncProfile.avatarColor,
            });
        }
    }

    // Remove local profiles absent from server
    const localProfileIds = Object.keys(useProfileStore.getState().profiles);
    for (const localId of localProfileIds) {
        if (!serverProfileIds.has(localId)) {
            debug('snapshotRemoveProfile', { id: localId });
            useProfileStore.getState().deleteProfile(localId, { force: true });
        }
    }

    useSyncStore.setState({ lastSyncAt: snapshot.timestamp });
}

// ── Store ───────────────────────────────────────────────────────────────────

/**
 * A flag to prevent re-broadcasting operations that originated from the server.
 * When `true`, `pushOperation` will silently no-op.
 */
let applyingRemote = false;

/** Returns whether the system is currently applying a remote operation. */
export function isApplyingRemote(): boolean {
    return applyingRemote;
}

/**
 * Captures all local state and returns the snapshot of data we have.
 * Must be called BEFORE applySnapshot to avoid losing local-only data.
 */
function captureLocalState() {
    return {
        addons: { ...useAddonStore.getState().addons },
        profiles: { ...useProfileStore.getState().profiles },
        watchHistory: { ...useWatchHistoryStore.getState().byProfile },
        myList: { ...useMyListStore.getState().byProfile },
        continueWatchingHidden: { ...useContinueWatchingStore.getState().byProfile },
    };
}

/**
 * Pushes all local data that the server doesn't have yet.
 * Called after applying the server snapshot so we can diff.
 */
async function pushLocalState(
    serverUrl: string,
    token: string,
    deviceId: string,
    serverSnapshot: SyncSnapshot | null,
    localState: ReturnType<typeof captureLocalState>,
): Promise<void> {
    const operations: SyncOperation[] = [];
    const now = Date.now();
    const serverAddonIds = new Set(serverSnapshot?.addons.map((a) => a.id) ?? []);
    const serverProfileIds = new Set(serverSnapshot?.profiles.map((p) => p.id) ?? []);

    // Push local profiles
    for (const profile of Object.values(localState.profiles)) {
        if (!serverProfileIds.has(profile.id)) {
            operations.push({
                collection: 'profiles',
                action: 'create',
                payload: {
                    id: profile.id,
                    name: profile.name,
                    avatarIcon: profile.avatarIcon,
                    avatarColor: profile.avatarColor,
                },
                timestamp: now,
                deviceId,
            });
        }
    }

    // Push local addons
    for (const addon of Object.values(localState.addons)) {
        if (!serverAddonIds.has(addon.id)) {
            operations.push({
                collection: 'addons',
                action: 'add',
                payload: {
                    id: addon.id,
                    manifestUrl: addon.manifestUrl,
                    manifest: addon.manifest,
                    installedAt: addon.installedAt,
                    useCatalogsOnHome: addon.useCatalogsOnHome,
                    useCatalogsInSearch: addon.useCatalogsInSearch,
                    useForSubtitles: addon.useForSubtitles,
                },
                timestamp: now,
                deviceId,
            });
        }
    }

    // Push local watch history
    const serverWatchProfiles = new Set(Object.keys(serverSnapshot?.watchHistory ?? {}));
    for (const [profileId, metaMap] of Object.entries(localState.watchHistory)) {
        const serverItems = serverSnapshot?.watchHistory[profileId] ?? [];
        const serverItemKeys = new Set(serverItems.map((i) => `${i.id}:${i.videoId ?? '_'}`));
        for (const [, videoMap] of Object.entries(metaMap)) {
            for (const item of Object.values(videoMap)) {
                const key = `${item.id}:${item.videoId ?? '_'}`;
                if (!serverWatchProfiles.has(profileId) || !serverItemKeys.has(key)) {
                    operations.push({
                        collection: 'watch_history',
                        action: 'upsert',
                        payload: {
                            profileId,
                            id: item.id,
                            type: item.type,
                            videoId: item.videoId,
                            progressSeconds: item.progressSeconds,
                            durationSeconds: item.durationSeconds,
                            lastStreamTargetType: item.lastStreamTargetType,
                            lastStreamTargetValue: item.lastStreamTargetValue,
                            lastWatchedAt: item.lastWatchedAt,
                        },
                        timestamp: now,
                        deviceId,
                    });
                }
            }
        }
    }

    // Push local my list items
    for (const [profileId, itemMap] of Object.entries(localState.myList)) {
        const serverItems = serverSnapshot?.myList[profileId] ?? [];
        const serverItemIds = new Set(serverItems.map((i) => i.id));
        for (const item of Object.values(itemMap)) {
            if (!serverItemIds.has(item.id)) {
                operations.push({
                    collection: 'my_list',
                    action: 'add',
                    payload: {
                        profileId,
                        id: item.id,
                        type: item.type,
                        addedAt: item.addedAt,
                    },
                    timestamp: now,
                    deviceId,
                });
            }
        }
    }

    // Push local continue watching hidden entries
    for (const [profileId, profileState] of Object.entries(localState.continueWatchingHidden)) {
        const serverHidden = serverSnapshot?.continueWatchingHidden[profileId] ?? {};
        for (const metaId of Object.keys(profileState.hidden ?? {})) {
            if (!serverHidden[metaId]) {
                operations.push({
                    collection: 'continue_watching',
                    action: 'set_hidden',
                    payload: { profileId, metaId, hidden: true },
                    timestamp: now,
                    deviceId,
                });
            }
        }
    }

    if (operations.length > 0) {
        debug('pushLocalState', { count: operations.length });
        try {
            await pushOperationBatch(serverUrl, token, operations);
        } catch (error) {
            debug('pushLocalStateFailed', { error });
        }
    } else {
        debug('pushLocalState', { count: 0, message: 'nothing to push' });
    }
}

/**
 * Helper to connect an already-approved device — fetches snapshot and starts WS.
 * Shared between `connect()` (when auto-approved) and `pollForApproval()` (after admin approves).
 */
async function connectApprovedDevice(
    get: () => SyncState,
    set: (partial: Partial<SyncState>) => void,
): Promise<void> {
    const { serverUrl, token, deviceId } = get();
    if (!serverUrl || !token) return;

    // Capture local state BEFORE applying snapshot so we don't lose local-only data
    const localState = captureLocalState();

    // Fetch initial snapshot via REST
    let serverSnapshot: SyncSnapshot | null = null;
    try {
        serverSnapshot = await fetchSnapshot(serverUrl, token);
        applyingRemote = true;
        try {
            applySnapshot(serverSnapshot);
        } finally {
            applyingRemote = false;
        }
    } catch (snapshotError) {
        debug('snapshotFetchFailed', { error: snapshotError });
        // Non-fatal: we can still connect via WS and receive incremental updates
    }

    // Push all local data that the server doesn't have yet
    await pushLocalState(serverUrl, token, deviceId, serverSnapshot, localState);

    // Flush any operations that were queued while offline
    const { pendingOperations } = useSyncStore.getState();
    if (pendingOperations.length > 0) {
        debug('flushPendingOperations', { count: pendingOperations.length });
        try {
            await pushOperationBatch(serverUrl, token, pendingOperations);
            useSyncStore.setState({ pendingOperations: [] });
        } catch (error) {
            debug('flushPendingOperationsFailed', { error });
            // Keep them in the queue for next reconnect
        }
    }

    // Start WebSocket connection
    if (wsManager) {
        wsManager.disconnect();
    }

    wsManager = new SyncWebSocketManager(serverUrl, token, deviceId, {
        onStateChange: (state) => {
            set({ connectionState: state });
        },
        onSyncOperation: (operation) => {
            applyingRemote = true;
            try {
                applyRemoteOperation(operation);
            } finally {
                applyingRemote = false;
            }
        },
        onSnapshot: (snapshot) => {
            applyingRemote = true;
            try {
                applySnapshot(snapshot);
            } finally {
                applyingRemote = false;
            }
        },
        onAuthError: (message) => {
            set({ error: message, isEnabled: false, token: null });
        },
    });

    wsManager.connect();
}

export const useSyncStore = create<SyncState>()(
    persist(
        (set, get) => ({
            // Persisted
            serverUrl: '',
            token: null,
            deviceId: generateDeviceId(),
            isEnabled: false,
            lastSyncAt: null,
            deviceStatus: null,
            pendingOperations: [],

            // Runtime
            connectionState: 'disconnected',
            error: null,
            isTesting: false,
            isPollingApproval: false,

            setServerUrl: (url: string) => {
                set({ serverUrl: url.replace(/\/+$/, '') });
            },

            testConnection: async (url: string) => {
                set({ isTesting: true, error: null });
                try {
                    const info = await getSyncServerInfo(url.replace(/\/+$/, ''));
                    set({ isTesting: false });
                    return { ok: true, name: info.name, version: info.version };
                } catch (error) {
                    const message = error instanceof SyncApiError ? error.message : 'Connection failed';
                    set({ isTesting: false, error: message });
                    return { ok: false, error: message };
                }
            },

            connect: async (serverPassword?: string) => {
                const { serverUrl, deviceId } = get();
                if (!serverUrl) {
                    set({ error: 'No server URL configured' });
                    return;
                }

                set({ error: null, connectionState: 'connecting' });

                try {
                    // Register device and get token.
                    // Pass the existing deviceId so the server can reuse it
                    // instead of creating a brand-new device entry.
                    const auth = await registerDevice(
                        serverUrl,
                        getDeviceName(),
                        getPlatform(),
                        serverPassword,
                        deviceId,
                    );

                    set({
                        token: auth.token,
                        deviceId: auth.deviceId || deviceId,
                        isEnabled: true,
                        deviceStatus: auth.status,
                    });

                    // If the device is pending approval, don't connect WS yet.
                    // Start polling for approval instead.
                    if (auth.status === 'pending') {
                        set({ connectionState: 'disconnected' });
                        debug('devicePendingApproval', { deviceId: auth.deviceId });
                        get().pollForApproval();
                        return;
                    }

                    if (auth.status === 'rejected') {
                        set({
                            connectionState: 'error',
                            error: 'Device was rejected by the server admin',
                            isEnabled: false,
                        });
                        return;
                    }

                    // Device is approved — proceed to sync
                    await connectApprovedDevice(get, set);
                } catch (error) {
                    const message = error instanceof SyncApiError
                        ? error.message
                        : error instanceof Error
                            ? error.message
                            : 'Connection failed';
                    set({
                        error: message,
                        connectionState: 'error',
                        isEnabled: false,
                    });
                }
            },

            pollForApproval: () => {
                const { isPollingApproval } = get();
                if (isPollingApproval) return;

                set({ isPollingApproval: true });
                debug('startPollingApproval');

                approvalPollTimer = setInterval(async () => {
                    const { serverUrl, deviceId, deviceStatus } = get();
                    if (!serverUrl || !deviceId || deviceStatus === 'approved') {
                        get().stopPollingApproval();
                        return;
                    }

                    try {
                        const result = await checkDeviceStatus(serverUrl, deviceId);
                        debug('pollResult', { status: result.status });

                        if (result.status === 'approved') {
                            set({ deviceStatus: 'approved' });
                            get().stopPollingApproval();
                            // Now connect the WS and fetch snapshot
                            await connectApprovedDevice(get, set);
                        } else if (result.status === 'rejected') {
                            set({
                                deviceStatus: 'rejected',
                                error: 'Device was rejected by the server admin',
                                isEnabled: false,
                                connectionState: 'error',
                            });
                            get().stopPollingApproval();
                        }
                        // 'pending' — keep polling
                    } catch (error) {
                        debug('pollError', { error });
                        // Don't stop polling on transient errors
                    }
                }, APPROVAL_POLL_INTERVAL_MS);
            },

            stopPollingApproval: () => {
                if (approvalPollTimer) {
                    clearInterval(approvalPollTimer);
                    approvalPollTimer = null;
                }
                set({ isPollingApproval: false });
            },

            disconnect: () => {
                if (wsManager) {
                    wsManager.disconnect();
                    wsManager = null;
                }
                if (approvalPollTimer) {
                    clearInterval(approvalPollTimer);
                    approvalPollTimer = null;
                }
                set({
                    connectionState: 'disconnected',
                    isEnabled: false,
                    token: null,
                    error: null,
                    deviceStatus: null,
                    isPollingApproval: false,
                    pendingOperations: [],
                });
            },

            pushOperation: (partialOp) => {
                // Don't re-broadcast operations coming from the server
                if (applyingRemote) return;

                const { isEnabled, deviceId, serverUrl, token } = get();

                const operation = {
                    ...partialOp,
                    timestamp: Date.now(),
                    deviceId,
                } as SyncOperation;

                // If not connected, queue the operation for later
                if (!isEnabled || !token) {
                    // Only queue if sync was configured (serverUrl exists)
                    if (serverUrl) {
                        debug('pushOperation:queued', { collection: operation.collection, action: operation.action });
                        set({ pendingOperations: [...get().pendingOperations, operation] });
                    }
                    return;
                }

                debug('pushOperation', { collection: operation.collection, action: operation.action });

                // Prefer WebSocket, fall back to REST
                if (wsManager && wsManager.getState() === 'authenticated') {
                    wsManager.sendOperation(operation);
                } else if (wsManager) {
                    // WebSocket exists but not authenticated yet — queue it
                    wsManager.sendOperation(operation);
                } else {
                    // No WebSocket at all — push via REST
                    pushOperationRest(serverUrl, token, operation).catch((error) => {
                        debug('restPushFailed', { error });
                    });
                }
            },
        }),
        {
            name: 'sync-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                serverUrl: state.serverUrl,
                token: state.token,
                deviceId: state.deviceId,
                isEnabled: state.isEnabled,
                lastSyncAt: state.lastSyncAt,
                deviceStatus: state.deviceStatus,
                pendingOperations: state.pendingOperations,
            }),
        },
    ),
);

// Register the bridge so domain stores can push operations without circular imports.
registerSyncPushHandler(
    (op) => useSyncStore.getState().pushOperation(op),
    () => applyingRemote,
);

/**
 * Re-establishes the WebSocket connection on app start if sync was previously enabled.
 * If the device is still pending approval, resumes polling instead.
 * Call this from the app layout / root component.
 */
export function initializeSyncOnStartup(): void {
    const { isEnabled, serverUrl, token, deviceStatus, pendingOperations } = useSyncStore.getState();

    // Nothing to do if no server was ever configured
    if (!serverUrl) return;

    debug('initializeSyncOnStartup', { deviceStatus, isEnabled, hasToken: !!token, pendingOps: pendingOperations.length });

    // If connection was lost (e.g. auth error after server restart wiped
    // isEnabled/token), re-register the device automatically.
    if (!isEnabled || !token) {
        debug('initializeSyncOnStartup', { reason: 'reconnecting after disconnect' });
        void useSyncStore.getState().connect();
        return;
    }

    // If device is still pending, resume polling
    if (deviceStatus === 'pending') {
        useSyncStore.getState().pollForApproval();
        return;
    }

    // If device was rejected, don't try to connect
    if (deviceStatus === 'rejected') {
        useSyncStore.setState({
            error: 'Device was rejected by the server admin',
            connectionState: 'error',
        });
        return;
    }

    // Use the same full sync path as initial connection:
    // REST snapshot fetch → bidirectional merge → WebSocket for live updates
    void connectApprovedDevice(
        () => useSyncStore.getState(),
        (partial) => useSyncStore.setState(partial),
    );
}
