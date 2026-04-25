import type {
  SimklAllItemsResponse,
  SimklPinResponse,
  SimklPinStatusResponse,
  SimklUserSettings,
  SimklActivities,
  SimklMediaItem,
  SimklActivityCategory,
} from '@/types/simkl';
import { SIMKL_APP_NAME, SIMKL_CLIENT_ID } from './config';
import { createDebugLogger } from '@/utils/debug';
import { getInstalledAppVersion } from '@/hooks/useAppInfo';
import { SimklMediaType } from '@/types/integrations';

const debug = createDebugLogger('SimklClient');

const BASE_URL = 'https://api.simkl.com';

/** Append required Simkl query params to any path (preserves existing params). */
function withSimklParams(path: string): string {
  const separator = path.includes('?') ? '&' : '?';
  const appVersion = getInstalledAppVersion();
  let url = `${path}${separator}app-name=${encodeURIComponent(
    SIMKL_APP_NAME
  )}&app-version=${encodeURIComponent(appVersion)}`;

  if (!path.includes('client_id=')) {
    url += `&client_id=${encodeURIComponent(SIMKL_CLIENT_ID)}`;
  }
  return url;
}

// Throttler for POST requests (1 request per second)
let lastPostTime = 0;
async function throttlePost() {
  const now = Date.now();
  const diff = now - lastPostTime;
  if (diff < 1000) {
    await new Promise((resolve) => setTimeout(resolve, 1000 - diff));
  }
  lastPostTime = Date.now();
}

async function simklFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, ...fetchOptions } = options;

  if (fetchOptions.method === 'POST') {
    await throttlePost();
  }

  const userAgent = `${SIMKL_APP_NAME}/${getInstalledAppVersion()}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': userAgent,
    'simkl-api-key': SIMKL_CLIENT_ID,
    ...(fetchOptions.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const url = `${BASE_URL}${withSimklParams(path)}`;

  debug('request', {
    url,
    method: fetchOptions.method || 'GET',
    body: fetchOptions.body ? JSON.stringify(fetchOptions.body) : undefined,
  });

  const response = await fetch(url, { ...fetchOptions, headers });

  if (!response.ok) {
    debug('responseError', { status: response.status, url });
    throw new Error(`Simkl API error ${response.status}: ${path}`);
  }

  const data = (await response.json()) as T;

  debug('response', { url, data: JSON.stringify(data) });

  return data;
}

export function getPinCode(): Promise<SimklPinResponse> {
  return simklFetch<SimklPinResponse>('/oauth/pin');
}

export function pollPin(userCode: string): Promise<SimklPinStatusResponse> {
  return simklFetch<SimklPinStatusResponse>(`/oauth/pin/${encodeURIComponent(userCode)}`);
}

export function getUserSettings(token: string): Promise<SimklUserSettings> {
  return simklFetch<SimklUserSettings>('/users/settings', { token });
}

export function getActivities(token: string): Promise<SimklActivities> {
  return simklFetch<SimklActivities>('/sync/activities', { token });
}

/**
 * Fetch items from Simkl.
 */
export function getAllItems(
  token: string,
  type: SimklMediaType,
  dateFrom?: string,
  extended: 'full' | 'ids_only' = 'full'
): Promise<SimklAllItemsResponse> {
  const path = `/sync/all-items/${type}`;
  const params = new URLSearchParams({ extended });
  if (extended === 'full') {
    params.set('episode_watched_at', 'yes');
  }
  if (dateFrom) params.set('date_from', dateFrom);
  return simklFetch<SimklAllItemsResponse>(`${path}?${params.toString()}`, {
    token,
  });
}

export function postHistory(token: string, payload: object): Promise<unknown> {
  return simklFetch('/sync/history', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

export function postWatchlist(token: string, payload: object): Promise<unknown> {
  return simklFetch('/sync/add-to-list', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

export function removeFromHistory(token: string, payload: object): Promise<unknown> {
  return simklFetch('/sync/history/remove', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

export function searchById(imdbId: string): Promise<SimklMediaItem[]> {
  return simklFetch<SimklMediaItem[]>(`/search/id?imdb=${encodeURIComponent(imdbId)}`);
}
