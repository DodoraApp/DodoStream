import { execSync } from 'child_process';
import { ConfigPlugin, withDangerousMod } from 'expo/config-plugins';
import fs from 'fs';
import path from 'path';

/**
 * Expo config plugin that generates the What's New registry
 * from markdown files before native project generation.
 *
 * Registered on both platforms so it runs regardless of which platform
 * is being prebuilt. A module-level flag ensures the build only executes once
 * when both platforms are built together.
 *
 * Runs: node scripts/generate-whats-new-registry.mjs
 */

let built = false;

function generateWhatsNewRegistry(projectRoot: string): void {
  if (built) return;
  built = true;

  const registryPath = path.join(projectRoot, 'src/constants/whats-new/_registry.ts');

  console.log("📝 Generating What's New registry...");
  try {
    execSync('node scripts/generate-whats-new-registry.mjs', {
      cwd: projectRoot,
      stdio: 'inherit',
    });
    console.log("✓ What's New registry generated successfully");
  } catch (error) {
    console.error("⚠️  Failed to generate What's New registry:", error);
    // Don't fail the prebuild — write a stub if the file is missing
    if (!fs.existsSync(registryPath)) {
      fs.writeFileSync(
        registryPath,
        `// AUTO-GENERATED — do not edit. Run pnpm generate-whats-new to regenerate.\n\nimport type { WhatsNewEntry } from '@/types/whats-new';\n\nexport const whatsNewEntries: WhatsNewEntry[] = [];\n`,
        'utf-8'
      );
    }
  }
}

const withWhatsNewBuild: ConfigPlugin = (config) => {
  for (const platform of ['ios', 'android'] as const) {
    config = withDangerousMod(config, [
      platform,
      (modConfig) => {
        generateWhatsNewRegistry(modConfig.modRequest.projectRoot);
        return modConfig;
      },
    ]);
  }
  return config;
};

export default withWhatsNewBuild;
