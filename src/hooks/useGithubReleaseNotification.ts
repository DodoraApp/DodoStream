import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Burnt from 'burnt';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { useDebugLogger } from '@/utils/debug';
import { TOAST_DURATION_SHORT } from '@/constants/ui';
import { toGithubLatestReleaseApiUrl } from '@/api/github/client';
import { useLatestGithubRelease } from '@/api/github/hooks';
import { areVersionsDifferent, extractSemverFromText, normalizeVersion } from '@/utils/version';

const STORAGE_KEY_LAST_DISMISSED_TAG = 'githubRelease:lastDismissedTag';
const RELEASES_URL_RAW = process.env.EXPO_PUBLIC_GITHUB_RELEASES_URL;

function getInstalledAppVersion(): string {
    const expoConfigVersion = Constants.expoConfig?.version;
    const manifestVersion = (Constants as any)?.manifest?.version;
    const fallbackVersion = (Constants as any)?.manifest2?.extra?.expoClient?.version;
    return expoConfigVersion ?? manifestVersion ?? fallbackVersion ?? '0.0.0';
}

export interface GithubReleaseNotification {
    isVisible: boolean;
    heading: string;
    subheading: string;
    body: string;
    onDismiss: () => void;
    onRemindLater: () => void;
    onDownloadRelease: () => void;
}

export function useGithubReleaseNotification(params: { enabled: boolean }) {
    const { enabled } = params;
    const debug = useDebugLogger('useGithubReleaseNotification');

    const releasesApiUrl = useMemo(() => {
        if (!RELEASES_URL_RAW) return null;
        return toGithubLatestReleaseApiUrl(RELEASES_URL_RAW);
    }, []);

    const installedVersion = useMemo(() => getInstalledAppVersion(), []);

    const [isStorageLoaded, setIsStorageLoaded] = useState(false);
    const [lastDismissedTag, setLastDismissedTag] = useState<string | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    const { data: latestRelease } = useLatestGithubRelease({
        releasesApiUrl: releasesApiUrl ?? '',
        enabled: enabled && !!releasesApiUrl,
    });

    useEffect(() => {
        if (!enabled) return;

        let cancelled = false;
        const load = async () => {
            try {
                const stored = await AsyncStorage.getItem(STORAGE_KEY_LAST_DISMISSED_TAG);
                if (cancelled) return;
                setLastDismissedTag(stored);
            } catch (error) {
                debug('failedToLoadDismissedTag', { error });
            } finally {
                if (!cancelled) setIsStorageLoaded(true);
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [enabled, debug]);

    const latestVersion = useMemo(() => {
        if (!latestRelease) return '';
        return extractSemverFromText(latestRelease.tagName) ?? normalizeVersion(latestRelease.tagName);
    }, [latestRelease]);

    const shouldNotify = useMemo(() => {
        if (!enabled) return false;
        if (!releasesApiUrl) return false;
        if (!isStorageLoaded) return false;
        if (!latestRelease) return false;

        const differs = areVersionsDifferent(installedVersion, latestVersion);
        if (!differs) {
            debug('noUpdate', { installedVersion, latestVersion, tagName: latestRelease.tagName });
            return false;
        }

        if (lastDismissedTag && lastDismissedTag === latestRelease.tagName) {
            debug('dismissedAlready', { tagName: latestRelease.tagName });
            return false;
        }

        debug('updateAvailable', {
            installedVersion,
            latestVersion,
            tagName: latestRelease.tagName,
            dismissedTag: lastDismissedTag,
        });

        return true;
    }, [
        enabled,
        releasesApiUrl,
        isStorageLoaded,
        latestRelease,
        installedVersion,
        latestVersion,
        lastDismissedTag,
        debug,
    ]);

    useEffect(() => {
        if (!shouldNotify) return;
        setIsVisible(true);
    }, [shouldNotify]);

    const remindLater = useCallback(() => {
        setIsVisible(false);
    }, []);

    const dismiss = useCallback(async () => {
        if (!latestRelease) {
            setIsVisible(false);
            return;
        }

        setIsVisible(false);
        setLastDismissedTag(latestRelease.tagName);
        try {
            await AsyncStorage.setItem(STORAGE_KEY_LAST_DISMISSED_TAG, latestRelease.tagName);
        } catch (error) {
            debug('failedToPersistDismissedTag', { error });
        }
    }, [latestRelease, debug]);

    const downloadRelease = useCallback(async () => {
        if (!latestRelease?.htmlUrl) return;
        try {
            await Linking.openURL(latestRelease.htmlUrl);
        } catch (error) {
            debug('failedToOpenReleaseUrl', { error, url: latestRelease.htmlUrl });
            Burnt.toast({
                title: 'Could not open release',
                message: 'Please try again later.',
                duration: TOAST_DURATION_SHORT,
            });
        }
    }, [latestRelease, debug]);

    const body = useMemo(() => {
        if (!latestRelease) return '';
        const header = `Installed: ${installedVersion}\nLatest: ${latestVersion}`;
        const releaseTitle = latestRelease.name?.trim() ? `\n\n${latestRelease.name.trim()}` : '';
        const notes = latestRelease.body?.trim() ? `\n\n${latestRelease.body.trim()}` : '';
        return `${header}${releaseTitle}${notes}`.trim();
    }, [latestRelease, installedVersion, latestVersion]);

    const releaseNotification: GithubReleaseNotification | null = useMemo(() => {
        if (!latestRelease) return null;
        if (!shouldNotify) return null;

        return {
            isVisible,
            heading: 'Update available',
            subheading: `New GitHub release ${latestRelease.tagName}`,
            body,
            onDismiss: () => {
                void dismiss();
            },
            onRemindLater: remindLater,
            onDownloadRelease: () => {
                void downloadRelease();
            },
        };
    }, [latestRelease, shouldNotify, isVisible, body, dismiss, downloadRelease, remindLater]);

    return releaseNotification;
}
