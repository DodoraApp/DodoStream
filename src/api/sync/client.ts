import { createDebugLogger } from '@/utils/debug';
import type {
    SyncAuthResponse,
    SyncDeviceStatusResponse,
    SyncServerInfo,
    SyncSnapshot,
    SyncOperation,
} from './types';

const debug = createDebugLogger('SyncClient');

/** Default timeout for sync API requests in milliseconds */
const SYNC_API_TIMEOUT_MS = 10_000;

/**
 * Error class for sync server API errors.
 */
export class SyncApiError extends Error {
    constructor(
        message: string,
        public readonly statusCode?: number,
        public readonly endpoint?: string,
    ) {
        super(message);
        this.name = 'SyncApiError';
    }
}

/**
 * Makes a JSON request to the sync server.
 */
async function syncRequest<T>(
    baseUrl: string,
    path: string,
    options: {
        method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
        body?: unknown;
        token?: string;
        timeout?: number;
    } = {},
): Promise<T> {
    const { method = 'GET', body, token, timeout = SYNC_API_TIMEOUT_MS } = options;
    const url = `${baseUrl}${path}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
        });

        if (!response.ok) {
            const errorBody = await response.text().catch(() => '');
            throw new SyncApiError(
                errorBody || `${response.status} ${response.statusText}`,
                response.status,
                path,
            );
        }

        const json = await response.json();
        return json as T;
    } catch (error) {
        if (error instanceof SyncApiError) throw error;
        if ((error as Error).name === 'AbortError') {
            throw new SyncApiError('Request timed out', undefined, path);
        }
        throw new SyncApiError(
            error instanceof Error ? error.message : 'Unknown error',
            undefined,
            path,
        );
    } finally {
        clearTimeout(timeoutId);
    }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Checks whether the sync server is reachable and returns basic info.
 */
export async function getSyncServerInfo(baseUrl: string): Promise<SyncServerInfo> {
    debug('getServerInfo', { baseUrl });
    return syncRequest<SyncServerInfo>(baseUrl, '/api/info');
}

/**
 * Registers / authenticates a device with the sync server.
 * Returns a token for subsequent API calls and WebSocket auth.
 *
 * @param baseUrl - Sync server base URL (e.g. http://192.168.1.50:8080)
 * @param deviceName - Human-readable name for this device
 * @param platform - Platform identifier (e.g. 'android', 'android-tv', 'ios', 'web')
 * @param serverPassword - Optional server password if the server requires one
 */
export async function registerDevice(
    baseUrl: string,
    deviceName: string,
    platform: string,
    serverPassword?: string,
): Promise<SyncAuthResponse> {
    debug('registerDevice', { baseUrl, deviceName, platform });
    return syncRequest<SyncAuthResponse>(baseUrl, '/api/auth/register', {
        method: 'POST',
        body: { deviceName, platform, password: serverPassword },
    });
}

/**
 * Fetches a full snapshot of all synced data from the server.
 * Used on initial connect to hydrate local stores.
 */
export async function fetchSnapshot(
    baseUrl: string,
    token: string,
): Promise<SyncSnapshot> {
    debug('fetchSnapshot');
    return syncRequest<SyncSnapshot>(baseUrl, '/api/sync/snapshot', { token });
}

/**
 * Pushes a sync operation to the server via REST (fallback if WebSocket is down).
 */
export async function pushOperation(
    baseUrl: string,
    token: string,
    operation: SyncOperation,
): Promise<void> {
    debug('pushOperation', { collection: operation.collection, action: operation.action });
    await syncRequest<{ ok: boolean }>(baseUrl, '/api/sync/push', {
        method: 'POST',
        token,
        body: { operation },
    });
}

/**
 * Pushes a batch of sync operations to the server at once.
 * Useful for offline queue flush.
 */
export async function pushOperationBatch(
    baseUrl: string,
    token: string,
    operations: SyncOperation[],
): Promise<void> {
    debug('pushOperationBatch', { count: operations.length });
    await syncRequest<{ ok: boolean }>(baseUrl, '/api/sync/push-batch', {
        method: 'POST',
        token,
        body: { operations },
    });
}

/**
 * Lists devices currently registered with the sync server.
 */
export async function listDevices(
    baseUrl: string,
    token: string,
): Promise<{ devices: Array<{ id: string; name: string; platform: string; lastSeenAt: number }> }> {
    debug('listDevices');
    return syncRequest(baseUrl, '/api/devices', { token });
}

/**
 * Removes a device from the sync server.
 */
export async function removeDevice(
    baseUrl: string,
    token: string,
    deviceId: string,
): Promise<void> {
    debug('removeDevice', { deviceId });
    await syncRequest<{ ok: boolean }>(baseUrl, `/api/devices/${deviceId}`, {
        method: 'DELETE',
        token,
    });
}

/**
 * Polls the server to check if the device has been approved by the admin.
 * This endpoint does not require auth — the device might still be pending.
 */
export async function checkDeviceStatus(
    baseUrl: string,
    deviceId: string,
): Promise<SyncDeviceStatusResponse> {
    debug('checkDeviceStatus', { deviceId });
    return syncRequest<SyncDeviceStatusResponse>(
        baseUrl,
        `/api/auth/status?device_id=${encodeURIComponent(deviceId)}`,
    );
}
