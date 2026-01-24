import { ConfigPlugin, AndroidConfig, withAndroidManifest } from 'expo/config-plugins';

/**
 * Expo config plugin to add additional configChanges to the MainActivity
 * 
 * This prevents the activity from being recreated when certain configuration changes occur,
 * which fixes the "linking configured in multiple places" error with expo-router
 * and prevents app reloads when video display modes change.
 * 
 * Adds: smallestScreenSize, density
 */
const withAndroidConfigChanges: ConfigPlugin = (config) => {
    return withAndroidManifest(config, (config) => {
        const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(config.modResults);

        // Get existing configChanges or create array
        const existingConfigChanges = mainActivity.$?.['android:configChanges']?.split('|') || [];

        // Add our required config changes if not already present
        const requiredChanges = ['smallestScreenSize', 'density'];
        const newConfigChanges = [...new Set([...existingConfigChanges, ...requiredChanges])];

        // Update the activity with the new configChanges
        if (mainActivity.$) {
            mainActivity.$['android:configChanges'] = newConfigChanges.join('|');
            console.log('✅ Android MainActivity configChanges updated:', mainActivity.$['android:configChanges']);
        }

        return config;
    });
};

export default withAndroidConfigChanges;
