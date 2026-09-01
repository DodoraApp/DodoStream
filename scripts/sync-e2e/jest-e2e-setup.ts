/**
 * Jest setup file for sync E2E tests.
 *
 * Loaded via Jest's `setupFiles` (before module caching).
 * Provides RN globals + dotenv without Module._load hacks.
 */

/// <reference types="node" />

import { config } from 'dotenv';
import path from 'path';

// Load .env.local from project root
config({ path: path.resolve(__dirname, '../../.env.local') });

// ─── 1. Global shims ──────────────────────────────────────────────────────────

// Unchecked casts: augmenting globalThis with jest-expo runtime globals.
type GlobalShim = {
  __DEV__: boolean;
  Platform: unknown;
  ExpoConstants: unknown;
};
const shim = globalThis as unknown as GlobalShim;

shim.__DEV__ = true;

shim.Platform = {
  OS: 'ios',
  Version: '17',
  select: (obj: Record<string, unknown>) => obj['ios'] ?? obj['default'],
};

// Minimal Constants shim (Simkl client reads expoConfig.name)
shim.ExpoConstants = {
  expoConfig: { name: 'DodoStream-E2E' },
};

// Minimal fetch is available in Node 18+; no shim needed.
