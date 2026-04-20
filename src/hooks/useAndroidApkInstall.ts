import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Linking from 'expo-linking';
import { useDebugLogger } from '@/utils/debug';
import { showToast } from '@/store/toast.store';
import { TOAST_DURATION_SHORT } from '@/constants/ui';
import type { GithubReleaseAsset } from '@/api/github/types';

export type ApkInstallStatus = 'idle' | 'downloading' | 'ready' | 'error';

export interface AndroidApkInstallState {
    status: ApkInstallStatus;
    /** Download progress from 0 to 1 */
    progress: number;
    error: string | null;
    startDownload: (asset: GithubReleaseAsset) => Promise<void>;
    triggerInstall: () => Promise<void>;
    cancel: () => void;
    reset: () => void;
}

/** Picks the best APK asset for the current device from a list of release assets. */
export function pickApkAsset(assets: GithubReleaseAsset[]): GithubReleaseAsset | null {
    if (Platform.OS !== 'android') return null;

    const apkAssets = assets.filter(
        (a) =>
            a.name.toLowerCase().endsWith('.apk') &&
            a.browserDownloadUrl &&
            // Exclude TV-specific builds when possible
            !a.name.toLowerCase().includes('tv')
    );

    // Prefer arm64 universal APK if available, otherwise take first match
    return (
        apkAssets.find((a) => a.name.toLowerCase().includes('arm64')) ??
        apkAssets[0] ??
        null
    );
}

/**
 * Hook for downloading and installing an APK update on Android.
 * Returns a disabled-state object on non-Android platforms.
 */
export function useAndroidApkInstall(): AndroidApkInstallState {
    const debug = useDebugLogger('useAndroidApkInstall');

    const [status, setStatus] = useState<ApkInstallStatus>('idle');
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [localUri, setLocalUri] = useState<string | null>(null);

    const downloadResumableRef = useRef<FileSystem.DownloadResumable | null>(null);

    const reset = useCallback(() => {
        setStatus('idle');
        setProgress(0);
        setError(null);
        setLocalUri(null);
    }, []);

    const cancel = useCallback(() => {
        const resumable = downloadResumableRef.current;
        if (resumable) {
            void resumable.pauseAsync().catch(() => {});
            downloadResumableRef.current = null;
        }
        reset();
    }, [reset]);

    const startDownload = useCallback(
        async (asset: GithubReleaseAsset) => {
            if (Platform.OS !== 'android') return;

            debug('startDownload', { name: asset.name, size: asset.size });
            setStatus('downloading');
            setProgress(0);
            setError(null);
            setLocalUri(null);

            const destUri = `${FileSystem.cacheDirectory}dodostream-update.apk`;

            // Remove any stale file from previous attempt
            try {
                const info = await FileSystem.getInfoAsync(destUri);
                if (info.exists) {
                    await FileSystem.deleteAsync(destUri, { idempotent: true });
                }
            } catch {
                // ignore cleanup errors
            }

            const resumable = FileSystem.createDownloadResumable(
                asset.browserDownloadUrl,
                destUri,
                {},
                (downloadProgress) => {
                    const { totalBytesWritten, totalBytesExpectedToWrite } = downloadProgress;
                    if (totalBytesExpectedToWrite > 0) {
                        setProgress(totalBytesWritten / totalBytesExpectedToWrite);
                    }
                }
            );
            downloadResumableRef.current = resumable;

            try {
                const result = await resumable.downloadAsync();
                downloadResumableRef.current = null;

                if (!result?.uri) {
                    throw new Error('Download returned no file URI');
                }

                debug('downloadComplete', { uri: result.uri });
                setLocalUri(result.uri);
                setProgress(1);
                setStatus('ready');
            } catch (err: unknown) {
                downloadResumableRef.current = null;

                // Ignore errors caused by explicit cancellation
                const message = err instanceof Error ? err.message : String(err);
                if (message.includes('cancelled') || message.includes('paused')) {
                    debug('downloadCancelled');
                    return;
                }

                debug('downloadError', { error: err });
                setError(message);
                setStatus('error');
                showToast({
                    title: 'Download failed',
                    message: 'Could not download the update. Please try again.',
                    duration: TOAST_DURATION_SHORT,
                });
            }
        },
        [debug]
    );

    const triggerInstall = useCallback(async () => {
        if (Platform.OS !== 'android') return;
        if (!localUri) {
            debug('triggerInstall:noUri');
            return;
        }

        try {
            debug('triggerInstall', { localUri });
            const contentUri = await FileSystem.getContentUriAsync(localUri);
            await Linking.openURL(contentUri);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            debug('triggerInstallError', { error: err });
            showToast({
                title: 'Install failed',
                message: 'Could not open the installer. Please install the APK manually.',
                duration: TOAST_DURATION_SHORT,
            });
            setError(message);
            setStatus('error');
        }
    }, [localUri, debug]);

    return { status, progress, error, startDownload, triggerInstall, cancel, reset };
}
