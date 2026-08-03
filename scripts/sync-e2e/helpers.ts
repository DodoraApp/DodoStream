/**
 * Helper functions for sync E2E tests.
 *
 * - Constants for test media IDs
 * - Profile setup/teardown
 * - Remote cleanup utilities
 */

import * as simklClient from '../../src/api/simkl/client';
import * as traktClient from '../../src/api/trakt/client';
import { TRAKT_CLIENT_ID } from '../../src/api/trakt/config';
import { useIntegrationsStore } from '../../src/store/integrations.store';
import { resetStore, setConnectedProvider } from './db-store';

/**
 * Raw Trakt POST for endpoints the client doesn't wrap. MUST send a
 * User-Agent — without one, Cloudflare rejects undici's default UA with 403.
 */
export async function traktRawPost(token: string, path: string, body: unknown): Promise<Response> {
  return fetch(`https://api.trakt.tv${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'DodoStream-E2E/1.0.0',
      'trakt-api-version': '2',
      'trakt-api-key': TRAKT_CLIENT_ID,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const PROFILE_ID = 'e2e-test-profile';

// Well-known stable media IDs
export const MATRIX_ID = 'tt0133093';
export const INCEPTION_ID = 'tt1375666';
export const BREAKING_BAD_ID = 'tt0903747';
export const THE_WIRE_ID = 'tt0306414';
// kitsu:1 resolves on Simkl to Cowboy Bebop (finished, 26 eps). It has an IMDb
// id in Simkl's catalog, so imported items map locally to tt0213338 (imdb takes
// priority over kitsu in getMetaIdFromIds).
export const ANIME_ID = 'kitsu:1';
export const ANIME_KITSU_ID = 1;
export const ANIME_IMDB_ID = 'tt0213338';

// ─── Setup helpers ────────────────────────────────────────────────────────────

export function setupTraktProfile(token: string): void {
  resetStore();
  setConnectedProvider(PROFILE_ID, 'trakt');
  useIntegrationsStore.setState({
    settings: {
      [PROFILE_ID]: {
        trakt: {
          connection: {
            accessToken: token,
            refreshToken: '',
            expiresAt: Date.now() + 3600_000,
            userId: 'e2e-user',
            username: 'e2e-user',
          },
          syncMode: 'full',
        },
      },
    },
    lastSyncAt: {},
    syncStatus: {},
  });
}

export function setupSimklProfile(token: string): void {
  resetStore();
  setConnectedProvider(PROFILE_ID, 'simkl');
  useIntegrationsStore.setState({
    settings: {
      [PROFILE_ID]: {
        simkl: {
          connection: {
            accessToken: token,
            userId: 'e2e-user',
            username: 'e2e-user',
          },
          syncMode: 'full',
        },
      },
    },
    lastSyncAt: {},
    syncStatus: {},
  });
}

// ─── Remote cleanup helpers ───────────────────────────────────────────────────

/** Remove test items from Trakt history and watchlist so tests start clean. */
export async function cleanupTraktRemote(token: string): Promise<void> {
  console.log('  Cleaning up remote Trakt state...');
  try {
    await traktClient.removeFromHistory(token, {
      movies: [{ ids: { imdb: MATRIX_ID } }, { ids: { imdb: INCEPTION_ID } }],
      shows: [
        {
          ids: { imdb: BREAKING_BAD_ID },
          // Cover every episode any test seeds (batching tests go up to E05).
          seasons: [
            {
              number: 1,
              episodes: [{ number: 1 }, { number: 2 }, { number: 3 }, { number: 4 }, { number: 5 }],
            },
          ],
        },
        { ids: { imdb: THE_WIRE_ID }, seasons: [{ number: 1, episodes: [{ number: 1 }] }] },
      ],
    });
    await traktClient.removeFromWatchlist(token, {
      movies: [{ ids: { imdb: MATRIX_ID } }, { ids: { imdb: INCEPTION_ID } }],
      shows: [{ ids: { imdb: BREAKING_BAD_ID } }, { ids: { imdb: THE_WIRE_ID } }],
    });
    // Un-hide test shows so a failed/interrupted hidden-shows test can't
    // poison later runs (the client has no hidden-remove wrapper).
    await traktRawPost(token, '/users/hidden/progress_watched/remove', {
      shows: [{ ids: { imdb: BREAKING_BAD_ID } }, { ids: { imdb: THE_WIRE_ID } }],
    });
  } catch {
    // Items may not exist — that's fine
  }
  console.log('  ✓ Remote Trakt state cleaned');
}

/** Remove test items from Simkl history and watchlist so tests start clean. */
export async function cleanupSimklRemote(token: string): Promise<void> {
  console.log('  Cleaning up remote Simkl state...');
  try {
    // Per docs, items sent without seasons/episodes are removed from the user's
    // library entirely (history AND watchlist) — the canonical un-track path.
    await simklClient.removeFromHistory(token, {
      movies: [{ ids: { imdb: MATRIX_ID } }, { ids: { imdb: INCEPTION_ID } }],
      shows: [
        { ids: { imdb: BREAKING_BAD_ID } },
        { ids: { imdb: THE_WIRE_ID } },
        // Anime goes in shows[] per docs (kitsu:1 — Cowboy Bebop)
        { ids: { kitsu: 1 } },
      ],
    });
  } catch {
    // Items may not exist — that's fine
  }
  console.log('  ✓ Remote Simkl state cleaned');
}
