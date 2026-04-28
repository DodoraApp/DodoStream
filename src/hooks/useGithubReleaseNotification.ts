import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { showToast } from '@/store/toast.store';
import * as Linking from 'expo-linking';
import * as Device from 'expo-device';
import { createDebugLogger } from '@/utils/debug'
import { TOAST_DURATION_SHORT } from '@/constants/ui';
import { useAppInfo } from '@/hooks/useAppInfo';
import { useGithubReleaseStatus } from '@/hooks/useGithubReleaseStatus';
import { findMatchingAsset } from '@/utils/github-release-asset';

const debug = createDebugLogger('useGithubReleaseNotification');

const STORAGE_KEY_LAST_DISMISSED_TAG = 'githubRelease:lastDismissedTag';

export interface GithubReleaseNotification {
  isVisible: boolean;
  heading: string;
  subheading: string;
  body: string;
  hasDirectAsset: boolean;
  onDismiss: () => void;
  onRemindLater: () => void;
  onDownloadRelease: () => void;
}

export function useGithubReleaseNotification(params: { enabled: boolean }) {
  const { t } = useTranslation('settings');
  const { enabled } = params;

  const appInfo = useAppInfo();
  const releaseStatus = useGithubReleaseStatus({
    installedVersion: appInfo.appVersion,
    enabled,
  });

  const [isStorageLoaded, setIsStorageLoaded] = useState(false);
  const [lastDismissedTag, setLastDismissedTag] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

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
  }, [enabled]);

  const latestRelease = releaseStatus.latestRelease;

  const directAssetUrl = useMemo(() => {
    if (Platform.OS !== 'android') return null;
    if (!latestRelease?.assets?.length) return null;

    const supportedAbis = Device.supportedCpuArchitectures ?? null;
    const asset = findMatchingAsset(
      latestRelease.assets,
      releaseStatus.latestVersion,
      Platform.isTV,
      supportedAbis
    );
    return asset?.browserDownloadUrl ?? null;
  }, [latestRelease, releaseStatus.latestVersion]);

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
  }, [latestRelease]);

  const downloadRelease = useCallback(async () => {
    const url = directAssetUrl ?? latestRelease?.htmlUrl;
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch (error) {
      debug('failedToOpenReleaseUrl', { error, url });
      showToast({
        title: t('about.could_not_open_release'),
        message: t('about.try_again_later'),
        duration: TOAST_DURATION_SHORT,
      });
    }
  }, [directAssetUrl, latestRelease, t]);

  const body = useMemo(() => {
    if (!latestRelease) return '';
    const header = `${t('about.installed')}: ${releaseStatus.installedVersion}\n${t('about.latest')}: ${releaseStatus.latestVersion}`;
    const releaseTitle = latestRelease.name?.trim() ? `\n\n${latestRelease.name.trim()}` : '';
    const notes = latestRelease.body?.trim() ? `\n\n${latestRelease.body.trim()}` : '';
    return `${header}${releaseTitle}${notes}`.trim();
  }, [latestRelease, releaseStatus.installedVersion, releaseStatus.latestVersion, t]);

  const releaseNotification: GithubReleaseNotification | null = useMemo(() => {
    if (!latestRelease) return null;
    if (!shouldNotify) return null;

    return {
      isVisible,
      heading: t('about.update_available'),
      subheading: t('about.new_release', { tag: latestRelease.tagName }),
      body,
      hasDirectAsset: directAssetUrl !== null,
      onDismiss: () => {
        void dismiss();
      },
      onRemindLater: remindLater,
      onDownloadRelease: () => {
        void downloadRelease();
      },
    };
  }, [
    latestRelease,
    shouldNotify,
    isVisible,
    body,
    directAssetUrl,
    dismiss,
    downloadRelease,
    remindLater,
    t,
  ]);

  return releaseNotification;
}
