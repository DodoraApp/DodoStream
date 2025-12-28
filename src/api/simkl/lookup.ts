import { getSimklClientId } from '@/utils/env';
import { isImdbId } from '@/utils/video-id';
import { createDebugLogger } from '@/utils/debug';
import type { SimklIdObject } from '@/api/simkl/types';

const debug = createDebugLogger('SimklLookup');

const SIMKL_API_URL = 'https://api.simkl.com';

export interface LookupResult {
    ids: SimklIdObject;
    title?: string;
    year?: number;
}

export interface LookupMetadata {
    title?: string;
    year?: number;
    type?: 'movie' | 'show' | 'anime';
    tmdbId?: number;
    tvdbId?: number;
}

/**
 * Lookup a media item on Simkl by various IDs
 *
 * Simkl supports lookup by: imdb, tmdb, tvdb, mal, anidb, hulu, netflix, etc.
 * If we only have a non-standard ID, we try title+year search as fallback.
 */
export const lookupMedia = async (
    mediaId: string,
    metadata?: LookupMetadata
): Promise<LookupResult | null> => {
    // Priority 1: IMDB ID - direct lookup
    if (isImdbId(mediaId)) {
        return { ids: { imdb: mediaId } };
    }

    // Priority 2: TMDB/TVDB ID if provided in metadata
    if (metadata?.tmdbId) {
        const result = await lookupByExternalId('tmdb', metadata.tmdbId, metadata.type);
        if (result) return result;
    }

    if (metadata?.tvdbId) {
        const result = await lookupByExternalId('tvdb', metadata.tvdbId, metadata.type);
        if (result) return result;
    }

    // Priority 3: Title + year search
    if (metadata?.title) {
        const result = await searchByTitle(metadata.title, metadata.year, metadata.type);
        if (result) return result;
    }

    // No match found - cannot track this item
    debug('noMatch', { mediaId, metadata });
    return null;
};

const lookupByExternalId = async (
    idType: 'tmdb' | 'tvdb' | 'mal',
    idValue: number,
    type?: 'movie' | 'show' | 'anime'
): Promise<LookupResult | null> => {
    try {
        const params = new URLSearchParams({
            [idType]: String(idValue),
            client_id: getSimklClientId(),
        });

        if (type) {
            params.set('type', type === 'show' ? 'tv' : type);
        }

        const response = await fetch(`${SIMKL_API_URL}/search/id?${params}`);

        if (!response.ok) {
            debug('lookupByExternalIdFailed', { idType, idValue, status: response.status });
            return null;
        }

        const data = await response.json();
        if (!data || data.length === 0) return null;

        return {
            ids: data[0].ids,
            title: data[0].title,
            year: data[0].year,
        };
    } catch (error) {
        debug('lookupByExternalIdError', { idType, idValue, error });
        return null;
    }
};

const searchByTitle = async (
    title: string,
    year?: number,
    type?: 'movie' | 'show' | 'anime'
): Promise<LookupResult | null> => {
    try {
        const endpoint = type === 'movie' ? '/search/movie' : '/search/tv';
        const params = new URLSearchParams({
            q: title,
            client_id: getSimklClientId(),
        });

        if (year) {
            params.set('year', String(year));
        }

        const response = await fetch(`${SIMKL_API_URL}${endpoint}?${params}`);

        if (!response.ok) {
            debug('searchByTitleFailed', { title, status: response.status });
            return null;
        }

        const data = await response.json();
        if (!data || data.length === 0) return null;

        return {
            ids: data[0].ids,
            title: data[0].title,
            year: data[0].year,
        };
    } catch (error) {
        debug('searchByTitleError', { title, error });
        return null;
    }
};

/**
 * Check if we can track this media item
 * Returns true if we have enough info to identify it on Simkl
 */
export const canTrackMedia = (
    mediaId: string,
    metadata?: { title?: string; tmdbId?: number; tvdbId?: number }
): boolean => {
    // IMDB IDs always work
    if (isImdbId(mediaId)) return true;

    // TMDB/TVDB IDs work
    if (metadata?.tmdbId || metadata?.tvdbId) return true;

    // Title search can work but is less reliable
    if (metadata?.title) return true;

    // No way to identify this content
    return false;
};
