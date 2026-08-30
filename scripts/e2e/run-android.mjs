#!/usr/bin/env node
/**
 * Build, install, and visually test one Android E2E profile.
 *
 * A missing snapshot is captured once, then the flow is rerun with visual
 * assertions enabled. Existing snapshots are never overwritten.
 */
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);

const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index === -1) return fallback;

  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`missing value for ${name}`);
  return value;
};

const profile = option('--profile', 'phone');
const flow = option('--flow', 'full-journey.yaml');
const device = option('--device', process.env.DEVICE);
const profiles = new Set(['phone', 'tablet', 'tv']);
if (!profiles.has(profile))
  throw new Error(`unknown profile: ${profile} (expected phone|tablet|tv)`);

const orientation = profile === 'phone' ? 'portrait' : 'landscape';
const addonPort = 8765;
const publicBaseUrl = `http://10.0.2.2:${addonPort}`;
const assertScreenshots = (process.env.E2E_VISUAL_ASSERT ?? '1') === '1';
const addonManifestUrl = process.env.ADDON_MANIFEST_URL ?? `${publicBaseUrl}/manifest.json`;
const deviceArgs = device ? ['-s', device] : [];
const snapshotDirectory = path.join(ROOT, '.maestro', 'snapshots', profile);
const outputDirectory = path.join(
  ROOT,
  'artifacts',
  'maestro',
  profile,
  path.basename(flow, path.extname(flow))
);
const children = new Set();

const run = (command, commandArgs, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { cwd: ROOT, stdio: 'inherit', ...options });
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });

const runChecked = async (command, commandArgs, options) => {
  const code = await run(command, commandArgs, options);
  if (code !== 0) throw new Error(`${command} exited ${code}`);
};

const start = (command, commandArgs, options = {}) => {
  const child = spawn(command, commandArgs, { cwd: ROOT, stdio: 'inherit', ...options });
  children.add(child);
  child.on('exit', () => children.delete(child));
  return child;
};

const cleanup = () => {
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
};

process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit(130);
});
process.on('SIGTERM', () => {
  cleanup();
  process.exit(143);
});

const waitForManifest = async () => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`http://127.0.0.1:${addonPort}/manifest.json`)).ok) return;
    } catch {
      // The fixture server has not started yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('timed out waiting for the fixture add-on');
};

const waitForPackageManager = async () => {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (
      (await run('adb', [...deviceArgs, 'shell', 'cmd', 'package', 'list', 'packages'], {
        stdio: 'ignore',
      })) === 0
    ) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error('timed out waiting for the Android package manager');
};

const isDirectory = (entry) => entry.isDirectory();

const screenshotFiles = (directory, relativeDirectory = '') => {
  if (!existsSync(directory)) return [];

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDirectory, entry.name);
    const absolutePath = path.join(directory, entry.name);
    if (isDirectory(entry)) return screenshotFiles(absolutePath, relativePath);
    return entry.name.endsWith('.png') ? [{ absolutePath, relativePath }] : [];
  });
};

const takeScreenshotFiles = (directory) => {
  if (!existsSync(directory)) return [];

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (!isDirectory(entry)) return [];
    if (entry.name === 'takeScreenshot') return screenshotFiles(absolutePath);
    return takeScreenshotFiles(absolutePath);
  });
};

const addMissingSnapshots = (directory) => {
  let created = 0;
  for (const { absolutePath, relativePath } of takeScreenshotFiles(directory)) {
    const destination = path.join(snapshotDirectory, relativePath);
    if (existsSync(destination)) continue;
    mkdirSync(path.dirname(destination), { recursive: true });
    copyFileSync(absolutePath, destination);
    created += 1;
  }
  return created;
};

const maestroRun = async (name, assertScreenshots) => {
  const directory = path.join(outputDirectory, name);
  rmSync(directory, { force: true, recursive: true });
  await runChecked('maestro', [
    'test',
    '--test-output-dir',
    directory,
    ...deviceArgs,
    '--env',
    `ADDON_MANIFEST_URL=${addonManifestUrl}`,
    '--env',
    `PROFILE=${profile}`,
    '--env',
    `E2E_ORIENTATION=${orientation}`,
    '--env',
    `E2E_VISUAL_ASSERT=${assertScreenshots ? '1' : '0'}`,
    path.join('.maestro', 'flows', flow),
  ]);
  return directory;
};

const runVisualAssertions = async () => {
  while (true) {
    try {
      await maestroRun('assertion', assertScreenshots);
      return;
    } catch (error) {
      const created = addMissingSnapshots(path.join(outputDirectory, 'assertion'));
      if (created === 0) throw error;
      process.stdout.write(`[e2e] created ${created} missing snapshot(s) for ${profile}\n`);
    }
  }
};

const buildEnvironment = {
  ...process.env,
  APP_VARIANT: 'dev',
  EXPO_PUBLIC_E2E: '1',
  E2E_ORIENTATION: orientation,
  ADDON_MANIFEST_URL: addonManifestUrl,
  EXPO_TV: profile === 'tv' ? '1' : '0',
};

try {
  start(
    path.join(ROOT, 'packages', 'e2e-addon', 'node_modules', '.bin', 'tsx'),
    ['src/server.ts'],
    {
      cwd: path.join(ROOT, 'packages', 'e2e-addon'),
      env: { ...process.env, PORT: String(addonPort), PUBLIC_BASE_URL: publicBaseUrl },
    }
  );
  await waitForManifest();

  await runChecked('pnpm', ['exec', 'expo', 'prebuild', '--platform', 'android', '--no-install'], {
    env: buildEnvironment,
  });
  await runChecked('./gradlew', ['assembleRelease'], {
    cwd: path.join(ROOT, 'android'),
    env: buildEnvironment,
  });

  const abiResult = spawnSync('adb', [...deviceArgs, 'shell', 'getprop', 'ro.product.cpu.abi'], {
    encoding: 'utf8',
  });
  if (abiResult.error || abiResult.status !== 0) {
    throw abiResult.error ?? new Error('could not determine the Android device ABI');
  }
  const apkDirectory = path.join(ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'release');
  const abi = abiResult.stdout.trim();
  const apk = existsSync(path.join(apkDirectory, `app-${abi}-release.apk`))
    ? path.join(apkDirectory, `app-${abi}-release.apk`)
    : path.join(apkDirectory, 'app-release.apk');
  if (!existsSync(apk)) throw new Error(`release APK was not found in ${apkDirectory}`);

  await waitForPackageManager();
  await runChecked('adb', [...deviceArgs, 'install', '-r', apk]);
  await runChecked('bash', ['scripts/e2e/configure-device.sh', profile, ...deviceArgs]);
  await runVisualAssertions();
  process.stdout.write(`[e2e] ${profile} ${flow} passed\n`);
} finally {
  cleanup();
}
