import { TraktSyncCursors } from '@/types/integrations';
import type {
  ListedMovieResponse,
  ListedShowResponse,
  TraktDeviceCodeResponse,
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

import { TRAKT_CLIENT_ID, TRAKT_CLIENT_SECRET } from './config';
import { traktRateLimiter } from './rate-limiter';

const debug = createDebugLogger('TraktClient');

const BASE_URL = 'https://api.trakt.tv';

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
  return traktFetch<TraktWatchedMovie[]>('/sync/watched/movies?extended=images', { token });
}

export function getWatchedShows(token: string): Promise<TraktWatchedShow[]> {
  return traktFetch<TraktWatchedShow[]>('/sync/watched/shows?extended=noseasons,images', { token });
}

export function getWatchedShowsWithSeasons(token: string): Promise<TraktWatchedShow[]> {
  return traktFetch<TraktWatchedShow[]>('/sync/watched/shows?extended=images', { token });
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
  return traktFetch<ListedMovieResponse[]>('/sync/watchlist/movies?extended=images', { token });
}

export function getWatchlistShows(token: string): Promise<ListedShowResponse[]> {
  return traktFetch<ListedShowResponse[]>('/sync/watchlist/shows?extended=images', { token });
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
