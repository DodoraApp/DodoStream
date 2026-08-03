/**
 * Authentication helpers for sync E2E tests.
 *
 * - Persists tokens to .e2e-tokens.json so re-auth is only needed when tokens expire.
 * - Trakt: device-code flow with automatic refresh if token is near expiry.
 * - Simkl: PIN flow (no refresh token).
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline/promises';

import { getPinCode, pollPin } from '../../src/api/simkl/client';
// Jest module mocking handles @/ aliases, so imports work correctly.
import {
  getDeviceCode,
  pollDeviceToken,
  refreshToken as traktRefreshToken,
} from '../../src/api/trakt/client';

// ─── Token file ──────────────────────────────────────────────────────────────

const TOKEN_FILE = path.resolve(__dirname, '../../.e2e-tokens.json');

interface TokenStore {
  trakt?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number; // ms epoch
  };
  simkl?: {
    accessToken: string;
  };
}

function loadTokens(): TokenStore {
  // Force re-auth if requested
  if (process.env.E2E_FORCE_REAUTH === '1') {
    return {};
  }
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8')) as TokenStore;
    }
  } catch {
    // Corrupt file — start fresh
  }
  return {};
}

function saveTokens(tokens: TokenStore): void {
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), 'utf-8');
}

// ─── Trakt auth ──────────────────────────────────────────────────────────────

const TRAKT_REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh if < 5 min remaining

export async function authTrakt(): Promise<string> {
  const tokens = loadTokens();

  // 1. Try cached token
  if (tokens.trakt) {
    const { accessToken, refreshToken, expiresAt } = tokens.trakt;

    if (expiresAt > 0 && Date.now() < expiresAt - TRAKT_REFRESH_BUFFER_MS) {
      console.log(
        '  ✓ Using cached Trakt token (expires',
        new Date(expiresAt).toLocaleString(),
        ')'
      );
      return accessToken;
    }

    // Token near expiry — try refresh
    console.log('  ↻ Trakt token near expiry, refreshing...');
    try {
      const refreshed = await traktRefreshToken(refreshToken);
      const newExpiresAt = Date.now() + refreshed.expires_in * 1000;
      tokens.trakt = {
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token,
        expiresAt: newExpiresAt,
      };
      saveTokens(tokens);
      console.log('  ✓ Trakt token refreshed');
      return refreshed.access_token;
    } catch (err) {
      console.warn('  ⚠ Trakt token refresh failed, re-authenticating...', err);
    }
  }

  // 2. Full device-code flow
  console.log('\n  Starting Trakt device-code authentication...');
  const deviceCode = await getDeviceCode();

  console.log(`\n  ┌─────────────────────────────────────────────┐`);
  console.log(`  │  Open: ${deviceCode.verification_url.padEnd(37)}│`);
  console.log(`  │  Code: ${deviceCode.user_code.padEnd(37)}│`);
  console.log(`  └─────────────────────────────────────────────┘\n`);

  const intervalMs = (deviceCode.interval ?? 5) * 1000;
  const expiresMs = (deviceCode.expires_in ?? 600) * 1000;
  const deadline = Date.now() + expiresMs;

  while (Date.now() < deadline) {
    await sleep(intervalMs);
    try {
      const tokenResponse = await pollDeviceToken(deviceCode.device_code);
      if (tokenResponse.access_token) {
        const expiresAt = Date.now() + tokenResponse.expires_in * 1000;
        tokens.trakt = {
          accessToken: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token,
          expiresAt,
        };
        saveTokens(tokens);
        console.log('  ✓ Trakt authenticated successfully');
        return tokenResponse.access_token;
      }
    } catch (err: unknown) {
      // 400 = still pending (expected), anything else is a real error
      const statusErr =
        typeof err === 'object' && err !== null && 'status' in err
          ? (err as { status?: unknown; message?: unknown })
          : undefined;
      if (statusErr && statusErr.status !== 400) {
        throw new Error(`Trakt auth polling failed: ${statusErr.message ?? err}`);
      }
    }
  }

  throw new Error('Trakt device-code authentication timed out');
}

// ─── Simkl auth ──────────────────────────────────────────────────────────────

// Simkl auth
const SIMKL_TIMEOUT_MS = 15 * 60 * 1000;

export async function authSimkl(): Promise<string> {
  const tokens = loadTokens();

  // 1. Try cached token (Simkl tokens don't expire)
  if (tokens.simkl?.accessToken) {
    console.log('  ✓ Using cached Simkl token');
    return tokens.simkl.accessToken;
  }

  // 2. PIN flow
  console.log('\n  Starting Simkl PIN authentication...');
  const pinResponse = await getPinCode();

  console.log(`\n  ┌─────────────────────────────────────────────┐`);
  console.log(`  │  Open: ${pinResponse.verification_url.padEnd(37)}│`);
  console.log(`  │  PIN:  ${pinResponse.user_code.padEnd(37)}│`);
  console.log(`  └─────────────────────────────────────────────┘\n`);

  // Docs: respect the returned interval (5s) and expires_in (15 min).
  const intervalMs = (pinResponse.interval ?? 5) * 1000;
  const expiresMs = (pinResponse.expires_in ?? SIMKL_TIMEOUT_MS / 1000) * 1000;
  const deadline = Date.now() + expiresMs;

  while (Date.now() < deadline) {
    await sleep(intervalMs);
    try {
      const status = await pollPin(pinResponse.user_code);
      if (status.result === 'OK' && status.access_token) {
        tokens.simkl = { accessToken: status.access_token };
        saveTokens(tokens);
        console.log('  ✓ Simkl authenticated successfully');
        return status.access_token;
      }
    } catch {
      // Polling errors are transient — keep trying
    }
  }

  throw new Error('Simkl PIN authentication timed out');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return rl.question(question).finally(() => rl.close());
}
