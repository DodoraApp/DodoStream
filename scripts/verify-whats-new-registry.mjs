#!/usr/bin/env node
/**
 * Deterministic gate: `src/constants/whats-new/_registry.ts` must match the output of
 * `scripts/generate-whats-new-registry.mjs`. Restores the original file on drift so the
 * gate never leaves the working tree dirty.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = resolve(root, 'src/constants/whats-new/_registry.ts');
const generatorPath = resolve(root, 'scripts/generate-whats-new-registry.mjs');

const original = readFileSync(registryPath);

const generator = spawnSync(process.execPath, [generatorPath], { cwd: root, stdio: 'ignore' });
if (generator.error) {
  console.error(`✗ could not run generator: ${generator.error.message}`);
  process.exit(1);
}
if (generator.status !== 0) {
  console.error(`✗ registry generator exited with ${generator.status}`);
  process.exit(generator.status ?? 1);
}

if (original.equals(readFileSync(registryPath))) {
  console.log("✓ What's New registry matches generated output");
  process.exit(0);
}

writeFileSync(registryPath, original);
console.error("✗ What's New registry drift — run pnpm generate-whats-new and commit the result");
process.exit(1);
