import { useMemo } from 'react';
import Constants from 'expo-constants';

function getInstalledAppVersion(): string {
    const expoConfigVersion = Constants.expoConfig?.version;
    const manifestVersion = (Constants as any)?.manifest?.version;
    const fallbackVersion = (Constants as any)?.manifest2?.extra?.expoClient?.version;
    return expoConfigVersion ?? manifestVersion ?? fallbackVersion ?? '0.0.0';
}

function getRuntimeVersion(): string {
    const runtimeVersion = (Constants.expoConfig as any)?.runtimeVersion;
    if (!runtimeVersion) return '';

    if (typeof runtimeVersion === 'string') return runtimeVersion;
    if (typeof runtimeVersion?.policy === 'string') return runtimeVersion.policy;
    return '';
}

function getCommitHash(): string {
    const envHash =
        process.env.EXPO_PUBLIC_GIT_COMMIT_HASH;

    const extraHash = (Constants.expoConfig as any)?.extra?.gitCommitHash;
    const hash = (envHash ?? extraHash ?? '').trim();
    return hash;
}

export interface AppInfo {
    appName: string;
    appVersion: string;
    runtimeVersion: string;
    commitHash?: string;
}

export function useAppInfo(): AppInfo {
    return useMemo(() => {
        const expoConfig = Constants.expoConfig;

        const commitHash = getCommitHash();

        return {
            appName: expoConfig?.name ?? 'DodoStream',
            appVersion: getInstalledAppVersion(),
            runtimeVersion: getRuntimeVersion(),
            commitHash,
        };
    }, []);
}
