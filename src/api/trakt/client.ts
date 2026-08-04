import { getInstalledAppVersion } from '@/hooks/useAppInfo';
import { TraktSyncCursors } from '@/types/integrations';
import type {
  ListedMovieResponse,
  ListedShowResponse,
  TraktDeviceCodeResponse,
  TraktHiddenShow,
  TraktHistoryRemoveResponse,
  TraktListRemoveResponse,
  TraktSyncItem,
  TraktSyncResponse,
  TraktTokenResponse,
  TraktUserSettings,
  TraktWatchedMovie,
  TraktWatchedShow,
} from '@/types/trakt';
import { createDebugLogger } from '@/utils/debug';

import { TRAKT_APP_NAME, TRAKT_CLIENT_ID, TRAKT_CLIENT_SECRET } from './config';
import { traktRateLimiter } from './rate-limiter';

const debug = createDebugLogger('TraktClient');

const BASE_URL = 'https://api.trakt.tv';
const PAGE_LIMIT = 250;
const MAX_PAGES = 500; // safety cap (~125k items)

async function traktGetAll<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const separator = path.includes('?') ? '&' : '?';
    const batch = await traktFetch<T[]>(
      `${path}${separator}page=${page}&limit=${PAGE_LIMIT}`,
      options
    );
    all.push(...batch);
    // Trakt returns `limit` items per page except the last one, so a short
    // batch means we're done; avoids one extra empty-page request.
    if (batch.length < PAGE_LIMIT) break;
  }
  return all;
}

export class TraktAPIError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function traktFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, ...fetchOptions } = options;

  if (['POST', 'PUT', 'DELETE'].includes(fetchOptions.method || 'GET')) {
    await traktRateLimiter.throttlePost();
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': `${TRAKT_APP_NAME}/${getInstalledAppVersion()}`,
    'trakt-api-version': '2',
    'trakt-api-key': TRAKT_CLIENT_ID,
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (token) headers['Authorization'] = `Bearer ${token}`;

  const url = `${BASE_URL}${path}`;

  debug('request', {
    url,
    method: fetchOptions.method || 'GET',
    body: fetchOptions.body ? JSON.parse(fetchOptions.body as string) : undefined,
  });

  const response = await fetch(url, { ...fetchOptions, headers });

  const retryAfter = response.headers.get('Retry-After');
  if (retryAfter) {
    traktRateLimiter.setRetryAfter(parseInt(retryAfter, 10));
  }

  if (!response.ok) {
    debug('responseError', { status: response.status, url });
    throw new TraktAPIError(response.status, `Trakt API error ${response.status}: ${path}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  const data = (await response.json()) as T;
  debug('response', { url, data });

  return data;
}

export function getDeviceCode(): Promise<TraktDeviceCodeResponse> {
  return traktFetch<TraktDeviceCodeResponse>('/oauth/device/code', {
    method: 'POST',
    body: JSON.stringify({ client_id: TRAKT_CLIENT_ID }),
  });
}

export function pollDeviceToken(deviceCode: string): Promise<TraktTokenResponse> {
  return traktFetch<TraktTokenResponse>('/oauth/device/token', {
    method: 'POST',
    body: JSON.stringify({
      code: deviceCode,
      client_id: TRAKT_CLIENT_ID,
      client_secret: TRAKT_CLIENT_SECRET,
    }),
  });
}

export function refreshToken(refreshTokenStr: string): Promise<TraktTokenResponse> {
  return traktFetch<TraktTokenResponse>('/oauth/token', {
    method: 'POST',
    body: JSON.stringify({
      refresh_token: refreshTokenStr,
      client_id: TRAKT_CLIENT_ID,
      client_secret: TRAKT_CLIENT_SECRET,
      grant_type: 'refresh_token',
      redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
    }),
  });
}

export function getUserSettings(token: string): Promise<TraktUserSettings> {
  return traktFetch<TraktUserSettings>('/users/settings', { token });
}

export function getLastActivities(token: string): Promise<TraktSyncCursors> {
  return traktFetch<TraktSyncCursors>('/sync/last_activities', { token });
}

export function getWatchedMovies(token: string): Promise<TraktWatchedMovie[]> {
  return traktGetAll<TraktWatchedMovie>('/sync/watched/movies?extended=images', { token });
}

export function getWatchedShows(token: string): Promise<TraktWatchedShow[]> {
  return traktGetAll<TraktWatchedShow>('/sync/watched/shows?extended=noseasons,images', { token });
}

export function getWatchedShowsWithSeasons(token: string): Promise<TraktWatchedShow[]> {
  // Season progress now requires extended=progress (default/other extended
  // values return no seasons since 2026-06-30). Images don't combine with
  // progress, so poster enrichment is skipped for imported shows.
  return traktGetAll<TraktWatchedShow>('/sync/watched/shows?extended=progress', { token });
}

export function postHistory(token: string, payload: TraktSyncItem): Promise<TraktSyncResponse> {
  return traktFetch<TraktSyncResponse>('/sync/history', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

export function removeFromHistory(
  token: string,
  payload: TraktSyncItem
): Promise<TraktHistoryRemoveResponse> {
  return traktFetch<TraktHistoryRemoveResponse>('/sync/history/remove', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

export function getWatchlistMovies(token: string): Promise<ListedMovieResponse[]> {
  return traktGetAll<ListedMovieResponse>('/sync/watchlist/movies/rank/asc?extended=images', {
    token,
  });
}

export function getWatchlistShows(token: string): Promise<ListedShowResponse[]> {
  return traktGetAll<ListedShowResponse>('/sync/watchlist/shows/rank/asc?extended=images', {
    token,
  });
}

export function postWatchlist(token: string, payload: TraktSyncItem): Promise<TraktSyncResponse> {
  return traktFetch<TraktSyncResponse>('/sync/watchlist', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

export function removeFromWatchlist(
  token: string,
  payload: TraktSyncItem
): Promise<TraktListRemoveResponse> {
  return traktFetch<TraktListRemoveResponse>('/sync/watchlist/remove', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

export function getHiddenShows(token: string): Promise<TraktHiddenShow[]> {
  return traktGetAll<TraktHiddenShow>('/users/hidden/progress_watched?type=show', { token });
}
