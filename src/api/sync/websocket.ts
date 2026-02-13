import { createDebugLogger } from '@/utils/debug';
import type { SyncOperation, SyncSnapshot, SyncWebSocketMessage } from './types';

const debug = createDebugLogger('SyncWebSocket');

/** WebSocket reconnection parameters */
const INITIAL_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const PING_INTERVAL_MS = 25_000;
const PONG_TIMEOUT_MS = 10_000;

export type SyncConnectionState = 'disconnected' | 'connecting' | 'connected' | 'authenticated' | 'error';

export interface SyncWebSocketCallbacks {
    /** Called when the connection state changes */
    onStateChange: (state: SyncConnectionState) => void;
    /** Called when a sync operation is received from another device */
    onSyncOperation: (operation: SyncOperation) => void;
    /** Called when a full snapshot is received (initial sync or resync) */
    onSnapshot: (snapshot: SyncSnapshot) => void;
    /** Called on authentication error — should attempt re-registration and return fresh credentials, or null to give up */
    onAuthError: (message: string) => Promise<{ token: string; deviceId: string } | null>;
}

/**
 * Manages a persistent WebSocket connection to the sync server.
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Ping/pong keep-alive
 * - Queues operations while disconnected for sending on reconnect
 * - Deduplicates own operations via deviceId filtering
 */
export class SyncWebSocketManager {
    private ws: WebSocket | null = null;
    private state: SyncConnectionState = 'disconnected';
    private reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private pingTimer: ReturnType<typeof setInterval> | null = null;
    private pongTimer: ReturnType<typeof setTimeout> | null = null;
    private pendingQueue: SyncOperation[] = [];
    private isReRegistering = false;
    private intentionalClose = false;

    constructor(
        private serverUrl: string,
        private token: string,
        private deviceId: string,
        private callbacks: SyncWebSocketCallbacks,
    ) {}

    // ── Lifecycle ───────────────────────────────────────────────────────────

    /** Opens the WebSocket connection. Safe to call multiple times. */
    connect(): void {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return;
        }

        this.intentionalClose = false;
        this.setState('connecting');

        const wsUrl = this.serverUrl.replace(/^http/, 'ws') + '/ws/sync';
        debug('connect', { url: wsUrl });

        try {
            this.ws = new WebSocket(wsUrl);
        } catch {
            debug('connectFailed');
            this.setState('error');
            this.scheduleReconnect();
            return;
        }

        this.ws.onopen = () => {
            debug('onopen');
            this.setState('connected');
            this.reconnectDelay = INITIAL_RECONNECT_DELAY_MS;

            // Authenticate immediately
            this.send({ type: 'auth', token: this.token });
            this.startPing();
        };

        this.ws.onmessage = (event: WebSocketMessageEvent) => {
            this.handleMessage(event.data as string);
        };

        this.ws.onerror = () => {
            debug('onerror');
            // onclose will also fire; handle reconnection there
        };

        this.ws.onclose = () => {
            debug('onclose', { intentional: this.intentionalClose });
            this.stopPing();
            this.ws = null;

            if (!this.intentionalClose) {
                this.setState('disconnected');
                this.scheduleReconnect();
            } else {
                this.setState('disconnected');
            }
        };
    }

    /** Gracefully closes the WebSocket and stops reconnection. */
    disconnect(): void {
        debug('disconnect');
        this.intentionalClose = true;
        this.clearReconnectTimer();
        this.stopPing();

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.setState('disconnected');
    }

    /** Updates connection parameters (e.g. after a token refresh). */
    updateCredentials(serverUrl: string, token: string, deviceId: string): void {
        this.serverUrl = serverUrl;
        this.token = token;
        this.deviceId = deviceId;

        // If currently connected, reconnect with new credentials
        if (this.state !== 'disconnected') {
            this.disconnect();
            this.connect();
        }
    }

    /** Returns the current connection state. */
    getState(): SyncConnectionState {
        return this.state;
    }

    // ── Sending ─────────────────────────────────────────────────────────────

    /** Sends a sync operation to the server. Queues if not connected. */
    sendOperation(operation: SyncOperation): void {
        const msg: SyncWebSocketMessage = { type: 'sync_operation', operation };

        if (this.state === 'authenticated' && this.ws?.readyState === WebSocket.OPEN) {
            this.send(msg);
        } else {
            debug('queueOperation', { collection: operation.collection, action: operation.action });
            this.pendingQueue.push(operation);
        }
    }

    /** Requests a full snapshot from the server. */
    requestSnapshot(): void {
        this.send({ type: 'request_snapshot' });
    }

    // ── Private ─────────────────────────────────────────────────────────────

    private send(msg: SyncWebSocketMessage): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }

    private handleMessage(raw: string): void {
        let msg: SyncWebSocketMessage;
        try {
            msg = JSON.parse(raw) as SyncWebSocketMessage;
        } catch {
            debug('invalidMessage', { raw });
            return;
        }

        switch (msg.type) {
            case 'auth_ok':
                debug('authenticated', { deviceId: msg.deviceId });
                this.setState('authenticated');
                this.flushPendingQueue();
                // Request a snapshot on first auth to hydrate
                this.requestSnapshot();
                break;

            case 'auth_error':
                debug('authError', { message: msg.message });
                this.setState('error');
                // Instead of permanently giving up, attempt re-registration.
                // This handles server restarts that invalidate tokens.
                this.handleAuthError(msg.message);
                break;

            case 'sync_operation':
                // Skip operations originating from this device
                if (msg.operation.deviceId === this.deviceId) return;
                debug('receivedOperation', { collection: msg.operation.collection, action: msg.operation.action });
                this.callbacks.onSyncOperation(msg.operation);
                break;

            case 'sync_snapshot':
                debug('receivedSnapshot', { timestamp: msg.snapshot.timestamp });
                this.callbacks.onSnapshot(msg.snapshot);
                break;

            case 'pong':
                this.clearPongTimer();
                break;

            case 'ping':
                this.send({ type: 'pong' });
                break;

            default:
                debug('unknownMessage', { type: (msg as { type: string }).type });
        }
    }

    /**
     * Handles auth errors by attempting re-registration.
     * If the callback returns new credentials, reconnects with them.
     * Otherwise, closes permanently (user must reconnect manually).
     */
    private async handleAuthError(message: string): Promise<void> {
        if (this.isReRegistering) return;
        this.isReRegistering = true;

        // Close the current connection without triggering auto-reconnect
        this.intentionalClose = true;
        this.ws?.close();

        try {
            debug('reRegistering');
            const result = await this.callbacks.onAuthError(message);

            if (result) {
                // Got fresh credentials — reconnect
                debug('reRegisterSuccess', { deviceId: result.deviceId });
                this.token = result.token;
                this.deviceId = result.deviceId;
                this.intentionalClose = false;
                this.isReRegistering = false;
                this.reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
                this.connect();
            } else {
                // Callback says give up
                debug('reRegisterGaveUp');
                this.isReRegistering = false;
            }
        } catch (error) {
            debug('reRegisterFailed', { error });
            // Re-registration failed — schedule another attempt via normal reconnect
            this.intentionalClose = false;
            this.isReRegistering = false;
            this.scheduleReconnect();
        }
    }

    private setState(state: SyncConnectionState): void {
        if (this.state === state) return;
        this.state = state;
        this.callbacks.onStateChange(state);
    }

    // ── Queue ───────────────────────────────────────────────────────────────

    private flushPendingQueue(): void {
        if (this.pendingQueue.length === 0) return;
        debug('flushQueue', { count: this.pendingQueue.length });

        const queue = [...this.pendingQueue];
        this.pendingQueue = [];

        for (const op of queue) {
            this.sendOperation(op);
        }
    }

    /** Returns the current number of queued operations. */
    getPendingCount(): number {
        return this.pendingQueue.length;
    }

    // ── Reconnection ────────────────────────────────────────────────────────

    private scheduleReconnect(): void {
        this.clearReconnectTimer();
        debug('scheduleReconnect', { delayMs: this.reconnectDelay });

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, this.reconnectDelay);

        // Exponential backoff
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
    }

    private clearReconnectTimer(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    // ── Keep-alive ──────────────────────────────────────────────────────────

    private startPing(): void {
        this.stopPing();
        this.pingTimer = setInterval(() => {
            this.send({ type: 'ping' });
            this.pongTimer = setTimeout(() => {
                debug('pongTimeout');
                // Force close — onclose handler will trigger reconnection
                this.ws?.close();
            }, PONG_TIMEOUT_MS);
        }, PING_INTERVAL_MS);
    }

    private stopPing(): void {
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
        this.clearPongTimer();
    }

    private clearPongTimer(): void {
        if (this.pongTimer) {
            clearTimeout(this.pongTimer);
            this.pongTimer = null;
        }
    }
}
