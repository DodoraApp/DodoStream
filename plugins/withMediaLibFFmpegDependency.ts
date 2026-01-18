import { ConfigPlugin, withDangerousMod } from 'expo/config-plugins';
import fs from 'fs';
import path from 'path';

/**
 * Expo config plugin to add androidx-media3 FFmpeg decoder dependency and ProGuard rules
 * 
 * This plugin:
 * 1. Adds the FFmpeg decoder AAR library dependency to build.gradle
 * 2. Adds ProGuard rules for androidx.media3 to prevent obfuscation
 * 3. Copies the FFmpeg decoder AAR file to android/app/libs/
 */
const withMediaLibFFmpegDependency: ConfigPlugin = (config) => {
    return withDangerousMod(config, [
        'android',
        async (config) => {
            const androidRoot = config.modRequest.platformProjectRoot;
            const projectRoot = config.modRequest.projectRoot;
            const buildGradlePath = path.join(androidRoot, 'app', 'build.gradle');
            const proguardRulesPath = path.join(androidRoot, 'app', 'proguard-rules.pro');

            // Step 1: Add FFmpeg decoder dependency to build.gradle
            if (fs.existsSync(buildGradlePath)) {
                let buildGradleContent = fs.readFileSync(buildGradlePath, 'utf8');

                const dependencyLine = 'implementation files("libs/androidx-media-lib-decoder-ffmpeg-release.aar")';

                // Check if the dependency is already added
                if (!buildGradleContent.includes(dependencyLine)) {
                    // Find the dependencies block
                    const dependenciesBlockRegex = /dependencies\s*\{/;
                    const match = buildGradleContent.match(dependenciesBlockRegex);

                    if (match && match.index !== undefined) {
                        const insertPosition = match.index + match[0].length;

                        // Add the dependency at the beginning of the dependencies block
                        const dependencyEntry = `\n    // androidx.media3 FFmpeg decoder\n    ${dependencyLine}\n`;

                        buildGradleContent =
                            buildGradleContent.slice(0, insertPosition) +
                            dependencyEntry +
                            buildGradleContent.slice(insertPosition);

                        fs.writeFileSync(buildGradlePath, buildGradleContent, 'utf8');
                        console.log('✅ Added androidx-media3 FFmpeg decoder dependency to build.gradle');
                    } else {
                        console.warn('⚠️  Could not find dependencies block in build.gradle');
                    }
                } else {
                    console.log('ℹ️  androidx-media3 FFmpeg decoder dependency already exists in build.gradle');
                }
            } else {
                console.warn('⚠️  build.gradle not found at:', buildGradlePath);
            }

            // Step 2: Add ProGuard rules for androidx.media3
            if (fs.existsSync(proguardRulesPath)) {
                let proguardContent = fs.readFileSync(proguardRulesPath, 'utf8');

                const media3Rules = [
                    '-keep class androidx.media3.** { *; }',
                    '-dontwarn androidx.media3.**'
                ];

                let rulesAdded = false;

                media3Rules.forEach(rule => {
                    if (!proguardContent.includes(rule)) {
                        if (!rulesAdded) {
                            // Add a comment before the first rule
                            proguardContent += '\n# androidx.media3\n';
                            rulesAdded = true;
                        }
                        proguardContent += rule + '\n';
                    }
                });

                if (rulesAdded) {
                    fs.writeFileSync(proguardRulesPath, proguardContent, 'utf8');
                    console.log('✅ Added androidx.media3 ProGuard rules to proguard-rules.pro');
                } else {
                    console.log('ℹ️  androidx.media3 ProGuard rules already exist in proguard-rules.pro');
                }
            } else {
                console.warn('⚠️  proguard-rules.pro not found at:', proguardRulesPath);
            }

            // Step 3: Copy FFmpeg decoder AAR file to android/app/libs/
            const sourceAarPath = path.join(projectRoot, 'libs', 'androidx-media-lib-decoder-ffmpeg-release.aar');
            const targetLibsDir = path.join(androidRoot, 'app', 'libs');
            const targetAarPath = path.join(targetLibsDir, 'androidx-media-lib-decoder-ffmpeg-release.aar');

            if (fs.existsSync(sourceAarPath)) {
                // Create target directory if it doesn't exist
                if (!fs.existsSync(targetLibsDir)) {
                    fs.mkdirSync(targetLibsDir, { recursive: true });
                    console.log('✅ Created android/app/libs directory');
                }

                // Check if the target file already exists
                if (!fs.existsSync(targetAarPath)) {
                    fs.copyFileSync(sourceAarPath, targetAarPath);
                    console.log('✅ Copied androidx-media-lib-decoder-ffmpeg-release.aar to android/app/libs/');
                } else {
                    // Copy anyway to ensure it's up to date
                    fs.copyFileSync(sourceAarPath, targetAarPath);
                    console.log('✅ Updated androidx-media-lib-decoder-ffmpeg-release.aar in android/app/libs/');
                }
            } else {
                console.warn('⚠️  Source AAR file not found at:', sourceAarPath);
                console.warn('   Please ensure the file exists at libs/libs/androidx-media-lib-decoder-ffmpeg-release.aar');
            }

            return config;
        },
    ]);
};

export default withMediaLibFFmpegDependency;
