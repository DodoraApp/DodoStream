import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showToast } from '@/store/toast.store';
import * as Linking from 'expo-linking';
import { useDebugLogger } from '@/utils/debug';
import { TOAST_DURATION_SHORT } from '@/constants/ui';
import { useAppInfo } from '@/hooks/useAppInfo';
import { useGithubReleaseStatus } from '@/hooks/useGithubReleaseStatus';
import { useAndroidApkInstall, pickApkAsset } from '@/hooks/useAndroidApkInstall';
import type { ApkInstallStatus } from '@/hooks/useAndroidApkInstall';

const STORAGE_KEY_LAST_DISMISSED_TAG = 'githubRelease:lastDismissedTag';

export interface GithubReleaseNotification {
    isVisible: boolean;
    /** Android only: whether the APK install progress modal should be shown */
    isInstallModalVisible: boolean;
    heading: string;
    subheading: string;
    body: string;
    onDismiss: () => void;
    onRemindLater: () => void;
    onDownloadRelease: () => void;
    /** Android only: download + install the APK directly */
    onInstallAndroid: (() => void) | null;
    /** Android only: whether an APK asset is available for in-app install */
    hasAndroidApk: boolean;
    /** Android only: current install status */
    androidInstallStatus: ApkInstallStatus;
    /** Android only: download progress 0–1 */
    androidInstallProgress: number;
    /** Android only: APK asset file name */
    androidApkName: string;
    onCancelAndroidInstall: () => void;
    onTriggerAndroidInstall: () => void;
}

export function useGithubReleaseNotification(params: { enabled: boolean }) {
    const { enabled } = params;
    const debug = useDebugLogger('useGithubReleaseNotification');

    const appInfo = useAppInfo();
    const releaseStatus = useGithubReleaseStatus({
        installedVersion: appInfo.appVersion,
        enabled,
    });

    const [isStorageLoaded, setIsStorageLoaded] = useState(false);
    const [lastDismissedTag, setLastDismissedTag] = useState<string | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isInstallModalVisible, setIsInstallModalVisible] = useState(false);

    const apkInstall = useAndroidApkInstall();

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

    const latestRelease = releaseStatus.latestRelease;

    const shouldNotify = useMemo(() => {
        if (!enabled) return false;
        if (!releaseStatus.canCheck) return false;
        if (!isStorageLoaded) return false;
        if (!latestRelease) return false;

        if (releaseStatus.isUpdateAvailable !== true) {
            debug('noUpdate', {
                installedVersion: releaseStatus.installedVersion,
                latestVersion: releaseStatus.latestVersion,
                tagName: latestRelease.tagName,
            });
            return false;
        }

        if (lastDismissedTag && lastDismissedTag === latestRelease.tagName) {
            debug('dismissedAlready', { tagName: latestRelease.tagName });
            return false;
        }

        debug('updateAvailable', {
            installedVersion: releaseStatus.installedVersion,
            latestVersion: releaseStatus.latestVersion,
            tagName: latestRelease.tagName,
            dismissedTag: lastDismissedTag,
        });

        return true;
    }, [
        enabled,
        isStorageLoaded,
        latestRelease,
        lastDismissedTag,
        debug,
        releaseStatus.canCheck,
        releaseStatus.installedVersion,
        releaseStatus.isUpdateAvailable,
        releaseStatus.latestVersion,
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
            showToast({
                title: 'Could not open release',
                message: 'Please try again later.',
                duration: TOAST_DURATION_SHORT,
            });
        }
    }, [latestRelease, debug]);

    const apkAsset = useMemo(() => {
        if (!latestRelease) return null;
        return pickApkAsset(latestRelease.assets);
    }, [latestRelease]);

    const installAndroid = useCallback(() => {
        if (!apkAsset) return;
        setIsVisible(false);
        setIsInstallModalVisible(true);
        void apkInstall.startDownload(apkAsset);
    }, [apkAsset, apkInstall]);

    const cancelAndroidInstall = useCallback(() => {
        apkInstall.cancel();
        setIsInstallModalVisible(false);
    }, [apkInstall]);

    const triggerAndroidInstall = useCallback(async () => {
        await apkInstall.triggerInstall();
    }, [apkInstall]);

    const body = useMemo(() => {
        if (!latestRelease) return '';
        const header = `Installed: ${releaseStatus.installedVersion}\nLatest: ${releaseStatus.latestVersion}`;
        const releaseTitle = latestRelease.name?.trim() ? `\n\n${latestRelease.name.trim()}` : '';
        const notes = latestRelease.body?.trim() ? `\n\n${latestRelease.body.trim()}` : '';
        return `${header}${releaseTitle}${notes}`.trim();
    }, [latestRelease, releaseStatus.installedVersion, releaseStatus.latestVersion]);

    const releaseNotification: GithubReleaseNotification | null = useMemo(() => {
        if (!latestRelease) return null;
        if (!shouldNotify && !isInstallModalVisible) return null;

        return {
            isVisible,
            isInstallModalVisible,
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
            hasAndroidApk: Platform.OS === 'android' && !!apkAsset,
            onInstallAndroid: Platform.OS === 'android' && apkAsset ? installAndroid : null,
            androidInstallStatus: apkInstall.status,
            androidInstallProgress: apkInstall.progress,
            androidApkName: apkAsset?.name ?? '',
            onCancelAndroidInstall: cancelAndroidInstall,
            onTriggerAndroidInstall: () => {
                void triggerAndroidInstall();
            },
        };
    }, [
        latestRelease,
        shouldNotify,
        isInstallModalVisible,
        isVisible,
        body,
        dismiss,
        downloadRelease,
        apkAsset,
        installAndroid,
        apkInstall.status,
        apkInstall.progress,
        cancelAndroidInstall,
        triggerAndroidInstall,
        remindLater,
    ]);

    return releaseNotification;
}
