import 'tsx/cjs';
import { ExpoConfig, ConfigContext } from 'expo/config';
const packageJson = require('./package.json');

export default ({ config }: ConfigContext): ExpoConfig => {
    const appBackgroundColor = '#181A20';

    // Build variant selection (used to keep dev/prod separately installable).
    // Set via EAS build profile env: APP_VARIANT=dev|prod
    const appVariant = (process.env.APP_VARIANT ?? 'prod').toLowerCase();
    const isDevVariant = appVariant !== 'prod';

    const appName = isDevVariant ? 'DodoStream (Dev)' : 'DodoStream';
    const iosBundleIdentifier = isDevVariant ? 'app.dodora.dodostream.dev' : 'app.dodora.dodostream';
    const androidPackage = isDevVariant ? 'app.dodora.dodostream.dev' : 'app.dodora.dodostream';
    return {
        ...config,
        name: appName,
        slug: 'dodostream',
        version: packageJson.version,
        newArchEnabled: true,
        scheme: 'dodostream',
        platforms: ['ios', 'android'],
        buildCacheProvider: {
            plugin: 'expo-build-disk-cache',
            options: {
                cacheDir: 'node_modules/.expo-build-disk-cache',
            },
        },
        plugins: [
            [
                'expo-build-properties',
                {
                    android: {
                        usesCleartextTraffic: true,
                        buildArchs: ['armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64'],
                        minSdkVersion: 26,
                        enableSeparateBuildPerCPUArchitecture: true,
                        enableProguardInReleaseBuilds: true
                    },
                },
            ],
            'expo-system-ui',
            [
                '@react-native-tvos/config-tv',
                {
                    androidTVBanner: "assets/app/banner.png",
                }
            ],
            'expo-router',
            'expo-localization',
            [
                'expo-font',
                {
                    fonts: [
                        'node_modules/@expo-google-fonts/outfit/400Regular/Outfit_400Regular.ttf',
                        'node_modules/@expo-google-fonts/outfit/700Bold/Outfit_700Bold.ttf',
                        'node_modules/@expo-google-fonts/poppins/400Regular/Poppins_400Regular.ttf',
                        'node_modules/@expo-google-fonts/poppins/700Bold/Poppins_700Bold.ttf',
                    ],
                },
            ],
            [
                'react-native-video',
                {
                    enableNotificationControls: true,
                    enableBackgroundAudio: false,
                    enableADSExtension: false,
                    enablFeCacheExtension: true,
                    enableAndroidPictureInPicture: true,
                    androidExtensions: {
                        useExoplayerRtsp: false,
                        useExoplayerSmoothStreaming: false,
                        useExoplayerHls: true,
                        useExoplayerDash: true,
                    },
                },
            ],
            'expo-libvlc-player',
            [
                "@sentry/react-native/expo",
                {
                    organization: process.env.SENTRY_ORG ?? 'dodora',
                    project: process.env.SENTRY_PROJECT ?? 'dodostream',
                }
            ],
            './plugins/withReactNativeTVOSPnpmFix',
            './plugins/withMediaLibFFmpegDependency'
        ],
        experiments: {
            typedRoutes: true,
            tsconfigPaths: true,
        },
        orientation: 'portrait',
        icon: './assets/app/icon.png',
        backgroundColor: appBackgroundColor,
        userInterfaceStyle: 'dark',
        splash: {
            image: './assets/app/splash-icon.png',
            resizeMode: 'contain',
            backgroundColor: appBackgroundColor,
        },
        assetBundlePatterns: ['**/*'],
        ios: {
            supportsTablet: true,
            bundleIdentifier: iosBundleIdentifier,
            backgroundColor: appBackgroundColor,
            infoPlist: {
                ITSAppUsesNonExemptEncryption: false
            }
        },
        android: {
            userInterfaceStyle: 'dark',
            package: androidPackage,
            permissions: [
                'android.permission.FOREGROUND_SERVICE',
                'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
            ],
        },
        extra: {
            router: {},
            eas: {
                projectId: 'c7e4f244-2ba8-42dc-a3f6-c197df3d8236',
            },
        },
        runtimeVersion: {
            policy: 'appVersion',
        },
    };
};