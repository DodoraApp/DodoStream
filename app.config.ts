import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
    ...config,
    "name": "DodoStream",
    "slug": "dodostream",
    "version": "0.0.3",
    "newArchEnabled": true,
    "scheme": "dodostream",
    "platforms": [
        "ios",
        "android"
    ],
    "buildCacheProvider": {
        "plugin": "expo-build-disk-cache",
        "options": {
            "cacheDir": "node_modules/.expo-build-disk-cache"
        }
    },
    "plugins": [
        [
            "expo-build-properties",
            {
                "android": {
                    "usesCleartextTraffic": true,
                    "buildArchs": [
                        "armeabi-v7a",
                        "arm64-v8a"
                    ],
                    "minSdkVersion": 26
                }
            }
        ],
        "@react-native-tvos/config-tv",
        "expo-router",
        "expo-localization",
        [
            "expo-font",
            {
                "fonts": [
                    "node_modules/@expo-google-fonts/outfit/400Regular/Outfit_400Regular.ttf",
                    "node_modules/@expo-google-fonts/outfit/700Bold/Outfit_700Bold.ttf",
                    "node_modules/@expo-google-fonts/poppins/400Regular/Poppins_400Regular.ttf",
                    "node_modules/@expo-google-fonts/poppins/700Bold/Poppins_700Bold.ttf"
                ]
            }
        ],
        [
            "react-native-video",
            {
                "enableNotificationControls": true,
                "enableBackgroundAudio": false,
                "enableADSExtension": false,
                "enableCacheExtension": true,
                "enableAndroidPictureInPicture": true,
                "androidExtensions": {
                    "useExoplayerRtsp": false,
                    "useExoplayerSmoothStreaming": false,
                    "useExoplayerHls": false,
                    "useExoplayerDash": false
                }
            }
        ],
        "expo-libvlc-player"
    ],
    "experiments": {
        "typedRoutes": true,
        "tsconfigPaths": true
    },
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "userInterfaceStyle": "dark",
    "splash": {
        "image": "./assets/images/splash-icon-dark.png",
        "resizeMode": "contain",
        "backgroundColor": "#181A20"
    },
    "assetBundlePatterns": [
        "**/*"
    ],
    "ios": {
        "supportsTablet": true,
        "bundleIdentifier": "app.dodora.dodostream"
    },
    "android": {
        "adaptiveIcon": {
            "foregroundImage": "./assets/images/adaptive-icon.png",
            "backgroundColor": "#181A20"
        },
        "package": "app.dodora.dodostream",
        "permissions": [
            "android.permission.FOREGROUND_SERVICE",
            "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK"
        ]
    },
    "extra": {
        "router": {},
        "eas": {
            "projectId": "c7e4f244-2ba8-42dc-a3f6-c197df3d8236"
        }
    },
    "runtimeVersion": {
        "policy": "appVersion"
    },
    "updates": {
        "url": "https://u.expo.dev/c7e4f244-2ba8-42dc-a3f6-c197df3d8236"
    }
})