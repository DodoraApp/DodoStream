import { execSync } from 'child_process';
import { ConfigPlugin, withDangerousMod } from 'expo/config-plugins';
import fs from 'fs';
import path from 'path';

/**
 * Expo config plugin that builds the remote-ui SPA and embeds it
 * into src/api/local-server/web-ui.ts before native project generation.
 *
 * Registered on both platforms so it runs regardless of which platform
 * is being prebuilt. A module-level flag ensures the build only executes once
 * when both platforms are built together.
 *
 * Runs: pnpm --filter remote-ui build && node scripts/embed-web-ui.mjs
 */

let built = false;

function buildRemoteUI(projectRoot: string): void {
  if (built) return;
  built = true;

  const webUiPath = path.join(projectRoot, 'src/api/local-server/web-ui.ts');

  console.log('🌐 Building remote-ui SPA...');
  try {
    execSync('pnpm --filter remote-ui build', { cwd: projectRoot, stdio: 'inherit' });
    execSync('node scripts/embed-web-ui.mjs', { cwd: projectRoot, stdio: 'inherit' });
    console.log('✓ Remote UI embedded successfully');
  } catch (error) {
    console.error('⚠️  Failed to build remote-ui:', error);
    // Don't fail the prebuild — write a stub if the file is missing
    if (!fs.existsSync(webUiPath)) {
      fs.writeFileSync(
        webUiPath,
        "// AUTO-GENERATED — do not edit. Run pnpm build:ui to regenerate.\nexport const WEB_UI_HTML = '';\n",
        'utf-8'
      );
    }
  }
}

const withRemoteUIBuild: ConfigPlugin = (config) => {
  for (const platform of ['ios', 'android'] as const) {
    config = withDangerousMod(config, [
      platform,
      (modConfig) => {
        buildRemoteUI(modConfig.modRequest.projectRoot);
        return modConfig;
      },
    ]);
  }
  return config;
};

export default withRemoteUIBuild;
