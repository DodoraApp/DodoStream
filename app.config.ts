// tsx is registered for Node so the local TypeScript config plugins under
// ./plugins resolve at prebuild time; SDK 55+ evaluates this config file
// itself with the project TypeScript toolchain.
import type { ConfigContext, ExpoConfig } from 'expo/config';

import packageJson from './package.json' with { type: 'json' };

import 'tsx/cjs';

export default ({ config }: ConfigContext): ExpoConfig => {
  const appBackgroundColor = '#181A20';

  // Build variant selection (used to keep dev/prod separately installable).
  // Set via EAS build profile env: APP_VARIANT=dev|prod
  const appVariant = (process.env.APP_VARIANT ?? 'prod').toLowerCase();
  const isDevVariant = appVariant !== 'prod';
  const isTVVariant = process.env.EXPO_TV === '1';
  const e2eOrientation: ExpoConfig['orientation'] =
    process.env.EXPO_PUBLIC_E2E === '1'
      ? process.env.E2E_ORIENTATION === 'landscape'
        ? 'landscape'
        : 'portrait'
      : 'default';

  const appName = isDevVariant ? 'DodoStream (Dev)' : 'DodoStream';
  const iosBundleIdentifier = isDevVariant ? 'app.dodora.dodostream.dev' : 'app.dodora.dodostream';
  const androidPackage = isDevVariant ? 'app.dodora.dodostream.dev' : 'app.dodora.dodostream';
  return {
    ...config,
    name: appName,
    slug: 'dodostream',
    version: packageJson.version,
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
          },
        },
      ],
      'expo-system-ui',
      '@react-native-vector-icons/ionicons',
      '@react-native-vector-icons/material-design-icons',
      [
        'expo-splash-screen',
        {
          image: './assets/app/splash-icon.png',
          backgroundColor: appBackgroundColor,
        },
      ],
      [
        '@react-native-tvos/config-tv',
        {
          androidTVBanner: 'assets/app/banner.png',
          androidTVRequired: isTVVariant,
        },
      ],
      'expo-router',
      'expo-sqlite',
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
          enableCacheExtension: true,
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
      './plugins/withRemoteUIBuild',
      './plugins/withWhatsNewBuild',
      './plugins/withReactNativeTVOSPnpmFix',
      './plugins/withAndroidBuildOptimizations',
      './plugins/withAndroidConfigChanges',
    ],
    experiments: {
      typedRoutes: true,
      tsconfigPaths: true,
      reactCompiler: true,
    },
    orientation: e2eOrientation,
    icon: './assets/app/icon.png',
    backgroundColor: appBackgroundColor,
    userInterfaceStyle: 'dark',
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: iosBundleIdentifier,
      backgroundColor: appBackgroundColor,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      userInterfaceStyle: 'dark',
      package: androidPackage,
      permissions: [
        'android.permission.FOREGROUND_SERVICE',
        'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
        'android.permission.INTERNET',
        'android.permission.ACCESS_NETWORK_STATE',
        'android.permission.ACCESS_WIFI_STATE',
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
