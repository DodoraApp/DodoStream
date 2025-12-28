import { simklRequest } from '@/api/simkl/client';
import type { SimklActivitiesResponse, SimklAllItemsResponse, SimklPlaybackItem } from '@/api/simkl/types';
import type { ContentType } from '@/types/stremio';
import { isImdbId, parseStremioVideoId } from '@/utils/video-id';
import { createDebugLogger } from '@/utils/debug';

const debug = createDebugLogger('SimklSyncApi');

export const simklGetActivities = async (token: string): Promise<SimklActivitiesResponse> => {
    debug('getActivities', { hasToken: !!token });
    const response = await simklRequest<SimklActivitiesResponse>('/sync/activities', { method: 'POST', token });
    debug('getActivitiesResponse', { all: response.all });
    return response;
};

export type SimklPlaybackType = 'movies' | 'episodes';

export const simklGetPlaybackSessions = async (params: {
    token: string;
    type?: SimklPlaybackType;
    /** ISO date string to pull only updates since that time (incremental sync). */
    dateFromIso?: string;
}): Promise<SimklPlaybackItem[]> => {
    debug('getPlaybackSessions', { type: params.type, dateFromIso: params.dateFromIso });
    const path = params.type ? `/sync/playback/${params.type}` : '/sync/playback';
    const response = await simklRequest<SimklPlaybackItem[]>(path, {
        token: params.token,
        query: params.dateFromIso ? { date_from: params.dateFromIso } : undefined,
    });
    debug('getPlaybackSessionsResponse', { count: response.length });
    return response;
};

export const simklDeletePlaybackSession = async (token: string, id: number): Promise<void> => {
    debug('deletePlaybackSession', { id });
    await simklRequest<void>(`/sync/playback/${id}`, { method: 'DELETE', token });
    debug('deletePlaybackSessionComplete', { id });
};

export const simklAddToHistory = async (params: {
    token: string;
    metaId: string;
    contentType: ContentType;
    videoId?: string;
    watchedAtIso?: string;
}): Promise<unknown> => {
    debug('addToHistory', {
        metaId: params.metaId,
        contentType: params.contentType,
        videoId: params.videoId,
        watchedAtIso: params.watchedAtIso,
    });

    const ids = isImdbId(params.metaId) ? { imdb: params.metaId } : undefined;
    if (!ids) {
        // Caller should avoid using this when we can't provide reliable IDs.
        debug('addToHistoryNoImdb', { metaId: params.metaId });
        return simklRequest('/sync/history', { method: 'POST', token: params.token, body: {} });
    }

    if (params.contentType === 'movie') {
        debug('addToHistoryMovie', { metaId: params.metaId });
        return simklRequest('/sync/history', {
            method: 'POST',
            token: params.token,
            body: {
                movies: [
                    {
                        ids,
                        watched_at: params.watchedAtIso,
                    },
                ],
            },
        });
    }

    const parsed = params.videoId ? parseStremioVideoId(params.videoId) : undefined;
    if (parsed) {
        debug('addToHistoryEpisode', { metaId: params.metaId, season: parsed.season, episode: parsed.episode });
        return simklRequest('/sync/history', {
            method: 'POST',
            token: params.token,
            body: {
                episodes: [
                    {
                        watched_at: params.watchedAtIso,
                        show: { ids },
                        episode: { season: parsed.season, number: parsed.episode },
                    },
                ],
            },
        });
    }

    debug('addToHistoryShowFallback', { metaId: params.metaId });
    return simklRequest('/sync/history', {
        method: 'POST',
        token: params.token,
        body: {
            shows: [
                {
                    ids,
                },
            ],
        },
    });
};

/**
 * Fetches all items from the user's watchlist (watched history).
 * According to Simkl docs:
 * - First sync: call WITHOUT date_from to get the full history
 * - Subsequent syncs: call WITH date_from to get only updates since that time
 * - Returns null if there are no items or no updates since date_from
 */
export const simklGetAllItems = async (params: {
    token: string;
    /** Optional type filter: 'shows', 'anime', 'movies' */
    type?: 'shows' | 'anime' | 'movies';
    /** ISO date string for incremental sync (use activity timestamp from previous sync) */
    dateFromIso?: string;
    /** If true, includes watched episode details */
    extended?: boolean;
}): Promise<SimklAllItemsResponse | null> => {
    const path = params.type ? `/sync/all-items/${params.type}/` : '/sync/all-items/';

    const query: Record<string, string> = {};
    if (params.dateFromIso) {
        query.date_from = params.dateFromIso;
    }
    if (params.extended) {
        query.extended = 'full';
    }

    debug('getAllItems', {
        type: params.type ?? 'all',
        dateFromIso: params.dateFromIso,
        extended: params.extended,
        isFirstSync: !params.dateFromIso,
    });

    // Simkl returns null if there are no items or no updates since date_from
    const response = await simklRequest<SimklAllItemsResponse | null>(path, {
        token: params.token,
        query: Object.keys(query).length > 0 ? query : undefined,
    });

    debug('getAllItemsResponse', {
        isNull: response === null,
        showCount: response?.shows?.length ?? 0,
        animeCount: response?.anime?.length ?? 0,
        movieCount: response?.movies?.length ?? 0,
    });

    return response;
};
