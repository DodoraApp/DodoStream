import { useQuery } from '@tanstack/react-query';
import { fetchLatestGithubRelease } from './client';

export const githubKeys = {
    all: ['github'] as const,
    releases: () => [...githubKeys.all, 'releases'] as const,
    latestRelease: (releasesApiUrl: string) => [...githubKeys.releases(), { releasesApiUrl }] as const,
};

export function useLatestGithubRelease(params: { releasesApiUrl: string; enabled?: boolean }) {
    const { releasesApiUrl, enabled = true } = params;

    return useQuery({
        queryKey: githubKeys.latestRelease(releasesApiUrl),
        queryFn: () => fetchLatestGithubRelease(releasesApiUrl),
        enabled: enabled && !!releasesApiUrl,
        staleTime: 1000 * 60 * 60 * 12, // 12 hours
        gcTime: 1000 * 60 * 60 * 24, // 24 hours
        retry: 1,
        refetchOnMount: false,
    });
}
