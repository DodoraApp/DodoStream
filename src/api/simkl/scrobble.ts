import type { ContentType } from '@/types/stremio';
import { isImdbId, parseStremioVideoId } from '@/utils/video-id';
import type { SimklScrobbleResponse } from '@/api/simkl/types';
import { simklRequest } from '@/api/simkl/client';
import { SIMKL_SCROBBLE_FINISHED_PERCENT } from '@/constants/tracking';
import { createDebugLogger } from '@/utils/debug';

const debug = createDebugLogger('SimklScrobbleApi');

type ScrobbleAction = 'start' | 'pause' | 'stop';

const clampProgress = (percent: number): number => {
    if (!Number.isFinite(percent)) return 0;
    return Math.max(0, Math.min(100, percent));
};

const buildScrobbleBody = (params: {
    metaId: string;
    contentType: ContentType;
    videoId?: string;
    progressPercent: number;
}): any => {
    const { metaId, contentType, videoId, progressPercent } = params;

    const ids = isImdbId(metaId) ? { imdb: metaId } : undefined;
    if (!ids) {
        // Keep the request valid even if we can't identify the item by IMDB.
        // Caller should avoid scrobbling in this case.
        debug('buildScrobbleBodyNoImdb', { metaId, contentType, progressPercent });
        return { progress: clampProgress(progressPercent) };
    }

    if (contentType === 'movie') {
        debug('buildScrobbleBodyMovie', { metaId, progressPercent });
        return {
            progress: clampProgress(progressPercent),
            movie: { ids },
        };
    }

    // Default to show episode for any non-movie content.
    if (videoId) {
        const parsed = parseStremioVideoId(videoId);
        if (parsed) {
            debug('buildScrobbleBodyEpisode', { metaId, season: parsed.season, episode: parsed.episode, progressPercent });
            return {
                progress: clampProgress(progressPercent),
                show: { ids },
                episode: { season: parsed.season, number: parsed.episode },
            };
        }
        debug('buildScrobbleBodyVideoIdParseFailed', { metaId, videoId });
    }

    // Fallback: treat as show-level scrobble (less precise)
    debug('buildScrobbleBodyShowFallback', { metaId, progressPercent });
    return {
        progress: clampProgress(progressPercent),
        show: { ids },
    };
};

const scrobble = async (action: ScrobbleAction, params: {
    token: string;
    metaId: string;
    contentType: ContentType;
    videoId?: string;
    progressSeconds: number;
    durationSeconds: number;
}): Promise<SimklScrobbleResponse> => {
    const percent = params.durationSeconds > 0 ? (params.progressSeconds / params.durationSeconds) * 100 : 0;

    debug('scrobble', {
        action,
        metaId: params.metaId,
        contentType: params.contentType,
        videoId: params.videoId,
        progressPercent: percent.toFixed(1),
        progressSeconds: params.progressSeconds,
        durationSeconds: params.durationSeconds,
    });

    const body = buildScrobbleBody({
        metaId: params.metaId,
        contentType: params.contentType,
        videoId: params.videoId,
        progressPercent: percent,
    });

    const response = await simklRequest<SimklScrobbleResponse>(`/scrobble/${action}`, {
        method: 'POST',
        token: params.token,
        body,
    });

    debug('scrobbleResponse', { action, metaId: params.metaId, response });
    return response;
};

export const simklScrobbleStart = async (params: {
    token: string;
    metaId: string;
    contentType: ContentType;
    videoId?: string;
    progressSeconds: number;
    durationSeconds: number;
}): Promise<SimklScrobbleResponse> => {
    return scrobble('start', params);
};

export const simklScrobblePause = async (params: {
    token: string;
    metaId: string;
    contentType: ContentType;
    videoId?: string;
    progressSeconds: number;
    durationSeconds: number;
}): Promise<SimklScrobbleResponse> => {
    return scrobble('pause', params);
};

export const simklScrobbleStop = async (params: {
    token: string;
    metaId: string;
    contentType: ContentType;
    videoId?: string;
    progressSeconds: number;
    durationSeconds: number;
}): Promise<SimklScrobbleResponse> => {
    return scrobble('stop', params);
};

export const isSimklFinishedScrobble = (progressSeconds: number, durationSeconds: number): boolean => {
    if (durationSeconds <= 0) {
        debug('isSimklFinishedScrobble', { result: false, reason: 'no-duration', progressSeconds, durationSeconds });
        return false;
    }
    const percent = (progressSeconds / durationSeconds) * 100;
    const result = percent >= SIMKL_SCROBBLE_FINISHED_PERCENT;
    debug('isSimklFinishedScrobble', { result, percent: percent.toFixed(1), threshold: SIMKL_SCROBBLE_FINISHED_PERCENT });
    return result;
};
