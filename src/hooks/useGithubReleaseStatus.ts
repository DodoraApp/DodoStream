import { useCallback, useMemo } from 'react';
import { toGithubLatestReleaseApiUrl } from '@/api/github/client';
import { useLatestGithubRelease } from '@/api/github/hooks';
import type { GithubRelease } from '@/api/github/types';
import { areVersionsDifferent, extractSemverFromText, normalizeVersion } from '@/utils/version';

const RELEASES_URL_RAW = process.env.EXPO_PUBLIC_GITHUB_RELEASES_URL;

export interface GithubReleaseStatus {
    installedVersion: string;
    latestVersion: string;
    latestTagName: string;
    latestRelease: GithubRelease | null;
    isFetching: boolean;
    canCheck: boolean;
    isUpdateAvailable: boolean | null;
    checkNow: () => Promise<{
        latestVersion: string;
        latestTagName: string;
        isUpdateAvailable: boolean | null;
    } | null>;
}

export function useGithubReleaseStatus(params: {
    installedVersion: string;
    enabled?: boolean;
}): GithubReleaseStatus {
    const { installedVersion, enabled = true } = params;

    const releasesApiUrl = useMemo(() => {
        if (!RELEASES_URL_RAW) return null;
        return toGithubLatestReleaseApiUrl(RELEASES_URL_RAW);
    }, []);

    const canCheck = !!releasesApiUrl;

    const query = useLatestGithubRelease({
        releasesApiUrl: releasesApiUrl ?? '',
        enabled: enabled && !!releasesApiUrl,
    });

    const latestTagName = query.data?.tagName ?? '';

    const latestVersion = useMemo(() => {
        if (!latestTagName) return '';
        return extractSemverFromText(latestTagName) ?? normalizeVersion(latestTagName);
    }, [latestTagName]);

    const isUpdateAvailable = useMemo(() => {
        if (!installedVersion) return null;
        if (!latestVersion) return null;
        return areVersionsDifferent(installedVersion, latestVersion);
    }, [installedVersion, latestVersion]);

    const checkNow = useCallback(async () => {
        if (!releasesApiUrl) return null;
        const result = await query.refetch();
        const tagName = result.data?.tagName ?? '';
        const version = tagName
            ? (extractSemverFromText(tagName) ?? normalizeVersion(tagName))
            : '';

        const updateAvailable = installedVersion && version
            ? areVersionsDifferent(installedVersion, version)
            : null;

        return {
            latestVersion: version,
            latestTagName: tagName,
            isUpdateAvailable: updateAvailable,
        };
    }, [installedVersion, query, releasesApiUrl]);

    return {
        installedVersion,
        latestVersion,
        latestTagName,
        latestRelease: query.data ?? null,
        isFetching: query.isFetching,
        canCheck,
        isUpdateAvailable,
        checkNow,
    };
}
