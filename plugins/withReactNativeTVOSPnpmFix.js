const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Expo config plugin to fix React Native TVOS with pnpm compatibility issues
 * 
 * This plugin:
 * 1. Modifies the Podfile to set REACT_NATIVE_NODE_MODULES_DIR before any requires
 * 2. Creates a symlink from react-native to react-native-tvos in pnpm's node_modules
 */
const withReactNativeTVOSPnpmFix = (config) => {
    return withDangerousMod(config, [
        'ios',
        async (config) => {
            const iosRoot = config.modRequest.platformProjectRoot;
            const projectRoot = config.modRequest.projectRoot;
            const podfilePath = path.join(iosRoot, 'Podfile');

            // Step 1: Modify Podfile to set environment variables before any requires
            if (fs.existsSync(podfilePath)) {
                let podfileContent = fs.readFileSync(podfilePath, 'utf8');

                // Check if our fix is already applied
                const fixMarker = '# Fix for react-native-tvos and pnpm';
                if (!podfileContent.includes(fixMarker)) {
                    // Find the first require statement
                    const firstRequireIndex = podfileContent.indexOf('require ');

                    if (firstRequireIndex !== -1) {
                        const envSetup = `# Fix for react-native-tvos and pnpm: Set the node_modules directory for version detection
# MUST be set before any requires that might load podspecs
# Get the absolute path to the react-native (tvos) package directory
react_native_package_json = \`node --print "require.resolve('react-native/package.json')"\`.strip
react_native_path = File.dirname(react_native_package_json)
ENV['REACT_NATIVE_NODE_MODULES_DIR'] = react_native_path
ENV['REACT_NATIVE_PATH'] = react_native_path

`;
                        podfileContent =
                            podfileContent.slice(0, firstRequireIndex) +
                            envSetup +
                            podfileContent.slice(firstRequireIndex);

                        fs.writeFileSync(podfilePath, podfileContent, 'utf8');
                        console.log('✅ Podfile modified to set REACT_NATIVE_NODE_MODULES_DIR');
                    }
                }
            }

            // Step 2: Create symlink from react-native to react-native-tvos in pnpm node_modules
            try {
                // Find the react-native-tvos package location
                const rnPackageJson = execSync(
                    'node --print "require.resolve(\'react-native/package.json\')"',
                    { cwd: projectRoot, encoding: 'utf8' }
                ).trim();

                const rnPackageDir = path.dirname(rnPackageJson);
                const pnpmNodeModulesDir = path.dirname(rnPackageDir);
                const symlinkPath = path.join(pnpmNodeModulesDir, 'react-native');
                const targetPath = 'react-native-tvos';

                // Check if symlink already exists or if react-native is already there
                if (!fs.existsSync(symlinkPath)) {
                    // Create symlink
                    fs.symlinkSync(targetPath, symlinkPath, 'dir');
                    console.log('✅ Created symlink: react-native -> react-native-tvos');
                } else {
                    const stats = fs.lstatSync(symlinkPath);
                    if (stats.isSymbolicLink()) {
                        const currentTarget = fs.readlinkSync(symlinkPath);
                        if (currentTarget !== targetPath) {
                            // Update symlink if it points to the wrong target
                            fs.unlinkSync(symlinkPath);
                            fs.symlinkSync(targetPath, symlinkPath, 'dir');
                            console.log('✅ Updated symlink: react-native -> react-native-tvos');
                        }
                    }
                }
            } catch (error) {
                console.warn('⚠️  Could not create react-native symlink:', error.message);
                console.warn('   The build may fail. Try running: pnpm run postinstall');
            }

            return config;
        },
    ]);
};

module.exports = withReactNativeTVOSPnpmFix;
