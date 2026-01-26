import { useQuery } from '@tanstack/react-query';
import { fetchIntro } from './client';
import type { IntroData } from '@/types/introdb';
import type { ContentType } from '@/types/stremio';
import { isImdbId, parseVideoId } from '@/utils/id';
import { useDebugLogger } from '@/utils/debug';

/**
 * Query keys for IntroDB data
 */
export const introDbKeys = {
    all: ['introdb'] as const,
    intros: () => [...introDbKeys.all, 'intros'] as const,
    intro: (imdbId: string, season: number, episode: number) =>
        [...introDbKeys.intros(), { imdbId, season, episode }] as const,
};

interface UseIntroOptions {
    /** Whether the query should run (default: true) */
    enabled?: boolean;
}

/**
 * Hook to fetch intro timestamps for a TV series episode
 *
 * Only fetches for series content type with valid IMDb IDs.
 * Parses videoId to extract season/episode information.
 *
 * @param metaId - The media's IMDb ID (e.g., 'tt0944947')
 * @param videoId - The video ID containing season/episode (e.g., 'tt0944947:1:1')
 * @param mediaType - Content type ('series' or 'movie')
 * @param options - Additional options
 * @returns Query result with intro data
 */
export function useIntro(
    metaId: string,
    videoId: string | undefined,
    mediaType: ContentType,
    options: UseIntroOptions = {}
) {
    const debug = useDebugLogger('useIntro');
    const { enabled = true } = options;

    // Only fetch for series with valid IMDb IDs and parsed video IDs
    const isSeries = mediaType === 'series';
    const hasValidImdbId = isImdbId(metaId);
    const parsedVideo = videoId ? parseVideoId(videoId) : undefined;
    const canFetch = isSeries && hasValidImdbId && !!parsedVideo;

    return useQuery<IntroData | null>({
        queryKey: introDbKeys.intro(metaId, parsedVideo?.season ?? 0, parsedVideo?.episode ?? 0),
        queryFn: async () => {
            if (!parsedVideo) return null;

            debug('fetchingIntro', {
                metaId,
                season: parsedVideo.season,
                episode: parsedVideo.episode,
            });

            const result = await fetchIntro(metaId, parsedVideo.season, parsedVideo.episode);

            debug('introResult', {
                found: !!result,
                startMs: result?.start_ms,
                endMs: result?.end_ms,
                confidence: result?.confidence,
            });

            return result;
        },
        enabled: enabled && canFetch,
        // Intro data is stable - cache for a long time
        staleTime: 1000 * 60 * 60 * 24, // 24 hours
        gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        retry: 1,
    });
}
