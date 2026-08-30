#!/usr/bin/env node
/**
 * Run every committed Android visual E2E profile.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const runner = path.join(ROOT, 'scripts', 'e2e', 'run-android.mjs');
const entries = [
  ['phone', 'full-journey.yaml'],
  ['tablet', 'full-journey.yaml'],
  ['tv', 'full-journey.yaml'],
  ['tv', 'tv-navigation.yaml'],
];
const forwardedArgs = process.argv.slice(2);

if (forwardedArgs.some((arg) => arg === '--profile' || arg.startsWith('--profile='))) {
  throw new Error('e2e:android:all runs every profile; use e2e:android for one profile');
}
if (forwardedArgs.some((arg) => arg === '--flow' || arg.startsWith('--flow='))) {
  throw new Error('e2e:android:all runs every flow; use e2e:android for one flow');
}

const failures = [];
for (const [profile, flow] of entries) {
  process.stdout.write(`[e2e] running ${profile} ${flow}\n`);
  const result = spawnSync(
    process.execPath,
    [runner, ...forwardedArgs, '--profile', profile, '--flow', flow],
    { cwd: ROOT, stdio: 'inherit' }
  );
  if (result.status !== 0) failures.push(`${profile} ${flow}`);
}

if (failures.length > 0) {
  throw new Error(`failed: ${failures.join(', ')}`);
}
