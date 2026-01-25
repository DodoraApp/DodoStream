import type { MetaDetail } from '@/types/stremio';

// ============================================================================
// Types
// ============================================================================

/**
 * Minimal interface for video objects that contain season/episode info.
 * Works with MetaVideo and partial video objects.
 */
export interface SeasonEpisodeLike {
    season?: number;
    episode?: number;
    title?: string;
    name?: string;
}

// ============================================================================
// Pure Formatting Functions
// ============================================================================

/**
 * Format season/episode label (e.g., "S1E2").
 */
export const formatSeasonEpisodeLabel = (video?: SeasonEpisodeLike | null): string | undefined => {
    const { season, episode } = video ?? {};
    if (season != null && episode != null) return `S${season}E${episode}`;
    if (season != null) return `S${season}`;
    if (episode != null) return `E${episode}`;
    return undefined;
};

/**
 * Get episode title (prefers title over name).
 */
export const formatEpisodeTitle = (video?: SeasonEpisodeLike | null): string | undefined => {
    return video?.title ?? video?.name ?? undefined;
};

/**
 * Format episode card title (e.g., "S1E2: Episode Title").
 * Used for continue watching cards and similar displays.
 * Returns undefined for movies (no video info).
 */
export const formatEpisodeCardTitle = (video?: SeasonEpisodeLike | null): string | undefined => {
    if (!video) return undefined;
    const label = formatSeasonEpisodeLabel(video);
    const title = formatEpisodeTitle(video);

    if (!label) return title;
    return title ? `${label}: ${title}` : label;
};

/**
 * Format episode list title (e.g., "2. Episode Title").
 * Used in episode lists.
 */
export const formatEpisodeListTitle = (video?: SeasonEpisodeLike | null): string => {
    const episodeNum = video?.episode ?? '?';
    const title = video?.title ?? video?.name ?? 'Unknown';
    return `${episodeNum}. ${title}`;
};

/**
 * Format player title for video player display.
 * - Movies: "Movie Name"
 * - Series: "Show Name S1E2: Episode Title"
 */
export const formatPlayerTitle = (
    meta?: Partial<MetaDetail> | null,
    video?: SeasonEpisodeLike | null
): string | undefined => {
    const metaName = meta?.name;
    if (!metaName) return undefined;
    const episodeInfo = formatEpisodeCardTitle(video);
    if (!episodeInfo) return metaName;

    return `${metaName} ${episodeInfo}`;
};

/**
 * Format release date as localized string.
 */
export const formatReleaseDate = (released?: string | null): string | undefined => {
    if (!released) return undefined;
    const date = new Date(released);
    if (Number.isNaN(date.getTime())) return undefined;
    return date.toLocaleDateString();
};

/**
 * Format release year from ISO date string.
 */
export const formatReleaseYear = (released?: string | null): string | undefined => {
    if (!released) return undefined;
    const date = new Date(released);
    if (Number.isNaN(date.getTime())) return undefined;
    return String(date.getFullYear());
};

/**
 * Format release info - prefers meta.releaseInfo, falls back to year.
 */
export const formatReleaseInfo = (
    meta?: Partial<MetaDetail> | null,
    video?: SeasonEpisodeLike & { released?: string } | null
): string | undefined => {
    const releaseInfoTrimmed = (meta as Partial<MetaDetail> | undefined)?.releaseInfo?.trim();
    if (releaseInfoTrimmed) return releaseInfoTrimmed;

    const releasedIso =
        (video as { released?: string } | undefined)?.released ??
        (meta as Partial<MetaDetail> | undefined)?.released;
    return formatReleaseYear(releasedIso);
};

/**
 * Get runtime string from meta or video.
 */
export const formatRuntime = (
    meta?: Partial<MetaDetail> | null,
    video?: SeasonEpisodeLike | null
): string | undefined => {
    const fromVideo = (video as Partial<{ runtime?: string }> | undefined)?.runtime;
    const fromMeta = (meta as Partial<MetaDetail> | undefined)?.runtime;
    return fromVideo?.trim() || fromMeta?.trim() || undefined;
};

/**
 * Get description from meta or video.
 */
export const formatDescription = (
    meta?: Partial<MetaDetail> | null,
    video?: SeasonEpisodeLike | null
): string | undefined => {
    const fromVideo = (video as Partial<{ overview?: string }> | undefined)?.overview;
    const fromMeta = (meta as Partial<MetaDetail> | undefined)?.description;
    return fromVideo?.trim() || fromMeta?.trim() || undefined;
};

/**
 * Format seconds as time string (e.g., "1:23:45" or "23:45").
 * Shows hours only when duration >= 1 hour.
 */
export const formatPlaybackTime = (seconds: number): string => {
    if (!isFinite(seconds) || seconds < 0) return '0:00';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

