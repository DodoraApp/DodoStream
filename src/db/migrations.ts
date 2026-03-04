import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ContentType } from '@/types/stremio';
import { createDebugLogger } from '@/utils/debug';
import { initializeDatabase } from '@/db/client';
import { addToMyList } from '@/db/queries/myList';
import { dismissFromContinueWatching, upsertWatchProgress } from '@/db/queries/watchHistory';

const debug = createDebugLogger('SqliteMigration');
const MIGRATION_KEY = 'sqlite-migration-v1-done';

type LegacyWatchHistoryItem = {
    id: string;
    type: ContentType;
    videoId?: string;
    progressSeconds: number;
    durationSeconds: number;
    lastWatchedAt: number;
    lastStreamTargetType?: 'url' | 'external' | 'yt';
    lastStreamTargetValue?: string;
};

type LegacyWatchStorage = {
    state?: {
        byProfile?: Record<string, Record<string, Record<string, LegacyWatchHistoryItem>>>;
    };
};

type LegacyContinueStorage = {
    state?: {
        byProfile?: Record<string, { hidden?: Record<string, true> }>;
    };
};

type LegacyMyListItem = {
    id: string;
    type: ContentType;
};

type LegacyMyListStorage = {
    state?: {
        byProfile?: Record<string, Record<string, LegacyMyListItem>>;
    };
};

export async function runSqliteDataMigration(): Promise<void> {
    await initializeDatabase();

    const done = await AsyncStorage.getItem(MIGRATION_KEY);
    if (done === '1') return;

    debug('start');

    const [watchHistoryRaw, continueWatchingRaw, myListRaw] = await Promise.all([
        AsyncStorage.getItem('watch-history-storage'),
        AsyncStorage.getItem('continue-watching-storage'),
        AsyncStorage.getItem('my-list-storage'),
    ]);

    if (watchHistoryRaw) {
        try {
            const parsed = JSON.parse(watchHistoryRaw) as LegacyWatchStorage;
            const byProfile = parsed?.state?.byProfile ?? {};

            for (const [profileId, byMeta] of Object.entries(byProfile)) {
                for (const [metaId, byVideoKey] of Object.entries(byMeta ?? {})) {
                    for (const [videoKey, item] of Object.entries(byVideoKey ?? {})) {
                        const videoId = videoKey === '_' ? undefined : item.videoId;
                        if (!item?.durationSeconds || item.progressSeconds <= 0) continue;

                        await upsertWatchProgress({
                            profileId,
                            metaId: item.id || metaId,
                            videoId,
                            type: item.type,
                            progressSeconds: item.progressSeconds,
                            durationSeconds: item.durationSeconds,
                            lastStreamTargetType: item.lastStreamTargetType,
                            lastStreamTargetValue: item.lastStreamTargetValue,
                            lastWatchedAt: item.lastWatchedAt,
                        });
                    }
                }
            }
        } catch (error) {
            debug('watchHistoryParseFailed', { error });
        }
    }

    if (continueWatchingRaw) {
        try {
            const parsed = JSON.parse(continueWatchingRaw) as LegacyContinueStorage;
            const byProfile = parsed?.state?.byProfile ?? {};

            // Build a lookup of metaId → ContentType from watch history so we can create
            // a sentinel row for dismissed items that had no meaningful watch progress and
            // were therefore skipped during the watch history migration pass above.
            const watchHistoryTypes: Record<string, Record<string, ContentType>> = {};
            if (watchHistoryRaw) {
                const wh = JSON.parse(watchHistoryRaw) as LegacyWatchStorage;
                for (const [profileId, byMeta] of Object.entries(wh?.state?.byProfile ?? {})) {
                    watchHistoryTypes[profileId] = {};
                    for (const [metaId, byVideoKey] of Object.entries(byMeta ?? {})) {
                        const firstItem = Object.values(byVideoKey ?? {})[0];
                        if (firstItem?.type) {
                            watchHistoryTypes[profileId][metaId] = firstItem.type;
                        }
                    }
                }
            }

            for (const [profileId, profileState] of Object.entries(byProfile)) {
                const hidden = profileState?.hidden ?? {};
                for (const metaId of Object.keys(hidden)) {
                    const type = watchHistoryTypes[profileId]?.[metaId];
                    if (type) {
                        // Item had no qualifying watch progress — insert a sentinel row so
                        // the subsequent UPDATE has a target row to mark as dismissed.
                        const now = Date.now();
                        await upsertWatchProgress({
                            profileId,
                            metaId,
                            videoId: undefined,
                            type,
                            progressSeconds: 0,
                            durationSeconds: 0,
                            lastWatchedAt: now,
                        });
                    }
                    await dismissFromContinueWatching(profileId, metaId);
                }
            }
        } catch (error) {
            debug('continueWatchingParseFailed', { error });
        }
    }

    if (myListRaw) {
        try {
            const parsed = JSON.parse(myListRaw) as LegacyMyListStorage;
            const byProfile = parsed?.state?.byProfile ?? {};

            for (const [profileId, byItem] of Object.entries(byProfile)) {
                for (const item of Object.values(byItem ?? {})) {
                    if (!item?.id || !item?.type) continue;
                    await addToMyList(profileId, item.id, item.type);
                }
            }
        } catch (error) {
            debug('myListParseFailed', { error });
        }
    }

    await AsyncStorage.setItem(MIGRATION_KEY, '1');
    debug('complete');
}
