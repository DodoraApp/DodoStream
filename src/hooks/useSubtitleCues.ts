import { useQuery } from '@tanstack/react-query';
import { SubtitleCue } from '@/types/player';
import { loadSubtitles } from '@/utils/subtitles';
import { useDebugLogger } from '@/utils/debug';

/**
 * React Query hook to fetch and parse subtitle cues from a URL.
 * Uses staleTime: Infinity to prevent refetching once loaded.
 */
export function useSubtitleCues(url: string | undefined) {
    const debug = useDebugLogger('useSubtitleCues');

    return useQuery<SubtitleCue[], Error>({
        queryKey: ['subtitle-cues', url],
        queryFn: async () => {
            if (!url) {
                debug('fetch:skip', { reason: 'no URL' });
                return [];
            }
            debug('fetch:start', { url: url.substring(0, 80) });
            const cues = await loadSubtitles(url);
            debug('fetch:success', { cueCount: cues.length });
            return cues;
        },
        enabled: !!url,
        staleTime: Infinity, // Never refetch once loaded
        gcTime: 1000 * 60 * 60, // Keep in cache for 60 minutes
        retry: 1, // Only retry once on failure
    });
}
