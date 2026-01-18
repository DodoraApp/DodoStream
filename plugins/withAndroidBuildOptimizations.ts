import { ConfigPlugin, withDangerousMod } from 'expo/config-plugins';
import fs from 'fs';
import path from 'path';

/**
 * Expo config plugin to enable Android build optimizations
 * 
 * This plugin:
 * 1. Enables separate builds per CPU architecture (reduces APK size)
 * 2. Enables ProGuard in release builds (code optimization and obfuscation)
 */
const withAndroidBuildOptimizations: ConfigPlugin = (config) => {
    return withDangerousMod(config, [
        'android',
        async (config) => {
            const androidRoot = config.modRequest.platformProjectRoot;
            const buildGradlePath = path.join(androidRoot, 'app', 'build.gradle');

            if (!fs.existsSync(buildGradlePath)) {
                console.warn('⚠️  build.gradle not found at:', buildGradlePath);
                return config;
            }

            let buildGradleContent = fs.readFileSync(buildGradlePath, 'utf8');
            let modified = false;

            // Step 1: Add enableSeparateBuildPerCPUArchitecture definition
            const separateBuildDef = 'def enableSeparateBuildPerCPUArchitecture = true';

            if (!buildGradleContent.includes('enableSeparateBuildPerCPUArchitecture')) {
                // Find the position after enableMinifyInReleaseBuilds definition
                const minifyDefRegex = /def enableMinifyInReleaseBuilds = .*\n/;
                const match = buildGradleContent.match(minifyDefRegex);

                if (match && match.index !== undefined) {
                    const insertPosition = match.index + match[0].length;
                    buildGradleContent =
                        buildGradleContent.slice(0, insertPosition) +
                        `${separateBuildDef}\n` +
                        buildGradleContent.slice(insertPosition);

                    console.log('✅ Added enableSeparateBuildPerCPUArchitecture = true');
                    modified = true;
                } else {
                    console.warn('⚠️  Could not find enableMinifyInReleaseBuilds definition');
                }
            } else {
                console.log('ℹ️  enableSeparateBuildPerCPUArchitecture already defined');
            }

            // Step 2: Add enableProguardInReleaseBuilds definition
            const proguardDef = 'def enableProguardInReleaseBuilds = true';

            if (!buildGradleContent.includes('enableProguardInReleaseBuilds')) {
                // Find the position after enableSeparateBuildPerCPUArchitecture or enableMinifyInReleaseBuilds
                const targetRegex = /def enable(SeparateBuildPerCPUArchitecture|MinifyInReleaseBuilds) = .*\n/g;
                let lastMatch;
                let match;

                while ((match = targetRegex.exec(buildGradleContent)) !== null) {
                    lastMatch = match;
                }

                if (lastMatch && lastMatch.index !== undefined) {
                    const insertPosition = lastMatch.index + lastMatch[0].length;
                    buildGradleContent =
                        buildGradleContent.slice(0, insertPosition) +
                        `${proguardDef}\n` +
                        buildGradleContent.slice(insertPosition);

                    console.log('✅ Added enableProguardInReleaseBuilds = true');
                    modified = true;
                } else {
                    console.warn('⚠️  Could not find suitable insertion point for enableProguardInReleaseBuilds');
                }
            } else {
                console.log('ℹ️  enableProguardInReleaseBuilds already defined');
            }

            // Step 3: Add splits block in android.buildTypes.release if enableSeparateBuildPerCPUArchitecture is enabled
            if (!buildGradleContent.includes('splits {') && buildGradleContent.includes('enableSeparateBuildPerCPUArchitecture')) {
                // Find the android block and add splits configuration
                const androidBlockRegex = /android\s*\{/;
                const androidMatch = buildGradleContent.match(androidBlockRegex);

                if (androidMatch && androidMatch.index !== undefined) {
                    const insertPosition = androidMatch.index + androidMatch[0].length;
                    const splitsBlock = `
    splits {
        abi {
            reset()
            enable enableSeparateBuildPerCPUArchitecture
            universalApk false  // If true, also generate a universal APK
            include "armeabi-v7a", "x86", "arm64-v8a", "x86_64"
        }
    }
`;

                    buildGradleContent =
                        buildGradleContent.slice(0, insertPosition) +
                        splitsBlock +
                        buildGradleContent.slice(insertPosition);

                    console.log('✅ Added splits configuration for CPU architectures');
                    modified = true;
                }
            }

            if (modified) {
                fs.writeFileSync(buildGradlePath, buildGradleContent, 'utf8');
            }

            return config;
        },
    ]);
};

export default withAndroidBuildOptimizations;
