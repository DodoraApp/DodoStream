#!/usr/bin/env node
/**
 * Build the Android E2E release APK as a device-free artifact.
 *
 * Usage:
 *   node scripts/e2e/build-release.mjs --profile <phone|tablet|tv> [--abi <abi>]
 *
 * Applies the profile's build environment, runs the Expo prebuild and the
 * release Gradle build, then prints the selected APK and records
 * artifacts/e2e/<profile>/artifact.json for the agent-device MCP install step.
 * No Metro bundle and no device interaction.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createBuildConfig } from './android-build.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const parseBuildArgs = (argv, env = process.env) => {
  const option = (name) => {
    const index = argv.indexOf(name);
    if (index === -1) return undefined;
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for ${name}`);
    return value;
  };

  const abi = option('--abi');
  const profile = option('--profile') ?? 'phone';
  return {
    profile,
    abi,
    skipLint: (env.E2E_LINT ?? '0') !== '1',
    addonManifestUrl: env.ADDON_MANIFEST_URL,
  };
};

export const selectReleaseArtifact = (apkFiles, abi) => {
  if (!abi && apkFiles.includes('app-universal-release.apk')) {
    return 'app-universal-release.apk';
  }
  const wanted = abi ? `app-${abi}-release.apk` : 'app-release.apk';
  if (apkFiles.includes(wanted)) return wanted;
  throw new Error(
    `no matching release APK (wanted ${wanted}); available: ${apkFiles.sort().join(', ') || 'none'}`
  );
};

const resolveArtifactAbi = (apkFile) => {
  if (apkFile === 'app-universal-release.apk') return 'universal';
  if (apkFile === 'app-release.apk') return 'device';
  return apkFile.replace(/^app-/, '').replace(/-release\.apk$/, '');
};

const runChecked = (command, args, options) => {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} exited ${result.status ?? 'with an unknown status'}`);
  }
};

const main = () => {
  const { profile, abi, skipLint, addonManifestUrl } = parseBuildArgs(process.argv.slice(2));
  const config = createBuildConfig({ profile, addonManifestUrl });
  const env = { ...process.env, ...config.environment };

  runChecked('pnpm', ['exec', 'expo', 'prebuild', '--platform', 'android', '--no-install'], {
    cwd: ROOT,
    env,
  });

  const gradleArgs = ['assembleRelease'];
  if (skipLint) gradleArgs.push('-x', 'lintVitalRelease');
  runChecked('./gradlew', gradleArgs, { cwd: path.join(ROOT, 'android'), env });

  const apkDirectory = path.join(ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'release');
  const apkFile = selectReleaseArtifact(readdirSync(apkDirectory), abi);
  const apk = path.join(apkDirectory, apkFile);

  const outputDirectory = path.join(ROOT, 'artifacts', 'e2e', profile);
  mkdirSync(outputDirectory, { recursive: true });
  const artifact = {
    profile,
    abi: resolveArtifactAbi(apkFile),
    apk,
    addonManifestUrl: config.addonManifestUrl,
    orientation: config.orientation,
    builtAt: new Date().toISOString(),
  };
  writeFileSync(
    path.join(outputDirectory, 'artifact.json'),
    `${JSON.stringify(artifact, null, 2)}\n`
  );

  process.stdout.write(`[e2e:build] ${profile} release APK: ${apk} (abi: ${artifact.abi})\n`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
