import { simklScrobblePause, simklScrobbleStart, simklScrobbleStop } from '@/api/simkl/scrobble';
import {
    SIMKL_SCROBBLE_DEBOUNCE_MS,
    SIMKL_SCROBBLE_FINISHED_PERCENT,
    SIMKL_SCROBBLE_MIN_INTERVAL_MS,
    SIMKL_SCROBBLE_MIN_PROGRESS_DELTA_PERCENT,
    SIMKL_SCROBBLE_START_PERCENT,
} from '@/constants/tracking';
import type { WatchHistoryItem } from '@/store/watch-history.store';
import { useWatchHistoryStore } from '@/store/watch-history.store';
import { useSimklStore } from '@/store/simkl.store';
import { useTrackingStore } from '@/store/tracking.store';
import { createDebugLogger } from '@/utils/debug';
import { isImdbId } from '@/utils/video-id';

const debug = createDebugLogger('SimklScrobble');

type ScrobbleSessionState = {
    started: boolean;
    stopped: boolean;
    lastSentAt: number;
    lastSentProgressPercent: number;
};

// TODO use the same key util at all locations
const getScrobbleKey = (item: WatchHistoryItem): string => {
    const videoKey = item.videoId ?? '_';
    return `${item.id}::${videoKey}`;
};

const toProgressPercent = (item: WatchHistoryItem): number => {
    if (item.durationSeconds <= 0) return 0;
    return (item.progressSeconds / item.durationSeconds) * 100;
};

export const initializeSimklScrobbleMiddleware = (): (() => void) => {
    debug('initialize');

    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    const staged = new Map<string, WatchHistoryItem>();
    const sessions = new Map<string, ScrobbleSessionState>();

    // Ensure Simkl scrobble calls are sent sequentially.
    let scrobbleChain: Promise<void> = Promise.resolve();
    const enqueue = (fn: () => Promise<void>) => {
        scrobbleChain = scrobbleChain
            .then(fn)
            .catch((error) => {
                debug('scrobbleRequestFailed', { error });
            });
    };

    let prevState = useWatchHistoryStore.getState();

    const flush = () => {
        if (staged.size === 0) return;

        const tracking = useTrackingStore.getState().getActiveTracking();
        if (!tracking.enabled || tracking.provider !== 'simkl') {
            staged.clear();
            return;
        }

        const simklState = useSimklStore.getState();
        const token = simklState.getAccessToken();
        if (!token) {
            staged.clear();
            return;
        }

        // Check if scrobbling is enabled for this profile
        if (!simklState.isScrobblingEnabled()) {
            debug('scrobblingDisabled');
            staged.clear();
            return;
        }

        const items = Array.from(staged.values());
        staged.clear();

        for (const item of items) {
            const progressPercent = toProgressPercent(item);

            if (!isImdbId(item.id)) {
                debug('skipNonImdbId', { metaId: item.id });
                continue;
            }

            if (progressPercent < SIMKL_SCROBBLE_START_PERCENT) {
                debug('skipBelowThreshold', { metaId: item.id, progressPercent: progressPercent.toFixed(1), threshold: SIMKL_SCROBBLE_START_PERCENT });
                continue;
            }

            const key = getScrobbleKey(item);
            const now = Date.now();
            const existing = sessions.get(key) ?? {
                started: false,
                stopped: false,
                lastSentAt: 0,
                lastSentProgressPercent: 0,
            };

            if (existing.stopped) {
                debug('skipAlreadyStopped', { metaId: item.id, videoId: item.videoId });
                continue;
            }

            const delta = Math.abs(progressPercent - existing.lastSentProgressPercent);
            const timeSinceLast = now - existing.lastSentAt;

            if (progressPercent >= SIMKL_SCROBBLE_FINISHED_PERCENT) {
                sessions.set(key, {
                    ...existing,
                    started: true,
                    stopped: true,
                    lastSentAt: now,
                    lastSentProgressPercent: progressPercent,
                });

                debug('queueStop', {
                    metaId: item.id,
                    videoId: item.videoId,
                    progressPercent,
                });

                enqueue(async () => {
                    await simklScrobbleStop({
                        token,
                        metaId: item.id,
                        contentType: item.type,
                        videoId: item.videoId,
                        progressSeconds: item.progressSeconds,
                        durationSeconds: item.durationSeconds,
                    });
                });
                continue;
            }

            if (!existing.started) {
                sessions.set(key, {
                    ...existing,
                    started: true,
                    lastSentAt: now,
                    lastSentProgressPercent: progressPercent,
                });

                debug('queueStart', {
                    metaId: item.id,
                    videoId: item.videoId,
                    progressPercent,
                });

                enqueue(async () => {
                    await simklScrobbleStart({
                        token,
                        metaId: item.id,
                        contentType: item.type,
                        videoId: item.videoId,
                        progressSeconds: item.progressSeconds,
                        durationSeconds: item.durationSeconds,
                    });
                });
                continue;
            }

            if (timeSinceLast < SIMKL_SCROBBLE_MIN_INTERVAL_MS && delta < SIMKL_SCROBBLE_MIN_PROGRESS_DELTA_PERCENT) {
                debug('skipUpdate', { metaId: item.id, reason: 'throttled', timeSinceLast, delta: delta.toFixed(1) });
                continue;
            }

            sessions.set(key, {
                ...existing,
                lastSentAt: now,
                lastSentProgressPercent: progressPercent,
            });

            debug('queuePause', {
                metaId: item.id,
                videoId: item.videoId,
                progressPercent,
                timeSinceLast,
                delta,
            });

            enqueue(async () => {
                await simklScrobblePause({
                    token,
                    metaId: item.id,
                    contentType: item.type,
                    videoId: item.videoId,
                    progressSeconds: item.progressSeconds,
                    durationSeconds: item.durationSeconds,
                });
            });
        }
    };

    const unsubscribe = useWatchHistoryStore.subscribe((nextState) => {
        const nextProfileId = nextState.activeProfileId;
        const prevProfileId = prevState.activeProfileId;

        if (!nextProfileId) {
            prevState = nextState;
            return;
        }

        // Profile changed: reset session state to avoid cross-profile bleed.
        if (prevProfileId !== nextProfileId) {
            debug('profileChanged', { from: prevProfileId, to: nextProfileId });
            sessions.clear();
            staged.clear();
            prevState = nextState;
            return;
        }

        const currentProfileData = nextState.byProfile[nextProfileId] ?? {};
        const prevProfileData = prevState.byProfile[nextProfileId] ?? {};

        for (const [metaId, metaItems] of Object.entries(currentProfileData)) {
            const prevMetaItems = prevProfileData[metaId];
            if (prevMetaItems === metaItems) continue;

            for (const [videoKey, item] of Object.entries(metaItems)) {
                const prevItem = prevMetaItems?.[videoKey];
                if (
                    prevItem &&
                    prevItem.progressSeconds === item.progressSeconds &&
                    prevItem.durationSeconds === item.durationSeconds &&
                    prevItem.lastWatchedAt === item.lastWatchedAt
                ) {
                    continue;
                }

                staged.set(`${metaId}::${videoKey}`, item);
            }
        }

        if (staged.size > 0) {
            debug('stagedItems', { count: staged.size });
        }

        prevState = nextState;

        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(flush, SIMKL_SCROBBLE_DEBOUNCE_MS);
    });

    return () => {
        debug('destroy');
        unsubscribe();
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        staged.clear();
        sessions.clear();
    };
};
