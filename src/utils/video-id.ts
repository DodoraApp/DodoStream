/**
 * Separator for show ID + video ID composite key
 * Example: "tt1234567::tt1234567:1:5"
 */
const COMPOSITE_KEY_SEPARATOR = '::';

export interface ParsedStremioVideoId {
    metaId: string;
    season: number;
    episode: number;
}

export interface CompositeKey {
    mediaId: string;
    videoId: string | undefined;
}

// Stremio-style episode id used in this app: `${metaId}:${season}:${episode}`
const EPISODE_VIDEO_ID_RE = /^(?<metaId>[^:]+):(?<season>\d+):(?<episode>\d+)$/;

export const parseStremioVideoId = (videoId: string): ParsedStremioVideoId | undefined => {
    const match = videoId.match(EPISODE_VIDEO_ID_RE);
    const groups = match?.groups as { metaId?: string; season?: string; episode?: string } | undefined;
    if (!groups?.metaId || !groups?.season || !groups?.episode) return undefined;
    const season = Number(groups.season);
    const episode = Number(groups.episode);
    if (!Number.isFinite(season) || !Number.isFinite(episode)) return undefined;
    if (season <= 0 || episode <= 0) return undefined;
    return { metaId: groups.metaId, season, episode };
};

export const buildStremioEpisodeVideoId = (metaId: string, season: number, episode: number): string => {
    return `${metaId}:${season}:${episode}`;
};

export const isImdbId = (id: string): boolean => {
    return /^tt\d+$/.test(id);
};

/**
 * Extract IMDB ID from various formats
 * Returns undefined if not an IMDB ID
 */
export const extractImdbId = (id: string): string | undefined => {
    if (isImdbId(id)) return id;

    // Try to extract from URL format or composite string
    const match = id.match(/tt\d+/);
    return match?.[0];
};

/**
 * Create a composite key for watch history storage
 * Format: "{mediaId}::{videoId}" or just "{mediaId}" for movies
 */
export const createCompositeKey = (mediaId: string, videoId?: string): string => {
    if (!videoId) return mediaId;
    return `${mediaId}${COMPOSITE_KEY_SEPARATOR}${videoId}`;
};

/**
 * Parse a composite key back into components
 */
export const parseCompositeKey = (key: string): CompositeKey => {
    const separatorIndex = key.indexOf(COMPOSITE_KEY_SEPARATOR);
    if (separatorIndex === -1) {
        return { mediaId: key, videoId: undefined };
    }
    return {
        mediaId: key.slice(0, separatorIndex),
        videoId: key.slice(separatorIndex + COMPOSITE_KEY_SEPARATOR.length),
    };
};
