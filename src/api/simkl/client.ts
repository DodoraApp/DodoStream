import type {
  SimklAllItemsResponse,
  SimklPinResponse,
  SimklPinStatusResponse,
  SimklUserSettings,
  SimklActivities,
  SimklMediaItem,
} from '@/types/simkl';
import { SIMKL_APP_NAME } from './config';
import { createDebugLogger } from '@/utils/debug';
import { getInstalledAppVersion } from '@/hooks/useAppInfo';

const debug = createDebugLogger('SimklClient');

const BASE_URL = 'https://api.simkl.com';

/** Append required Simkl query params to any path (preserves existing params). */
function withSimklParams(path: string): string {
  const separator = path.includes('?') ? '&' : '?';
  const appVersion = getInstalledAppVersion()
  return `${path}${separator}app-name=${encodeURIComponent(SIMKL_APP_NAME)}&app-version=${encodeURIComponent(appVersion)}`;
}

async function simklFetch<T>(
  path: string,
  options: RequestInit & { token?: string; clientId?: string } = {}
): Promise<T> {
  const { token, clientId, ...fetchOptions } = options;
  const userAgent = `${SIMKL_APP_NAME}/${getInstalledAppVersion()}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': userAgent,
    ...(fetchOptions.headers as Record<string, string>),
  };
  if (clientId) headers['simkl-api-key'] = clientId;
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const url = `${BASE_URL}${withSimklParams(path)}`;
  
  debug('request', { url, method: fetchOptions.method || 'GET', body: fetchOptions.body ? JSON.stringify(fetchOptions.body) : undefined });

  const response = await fetch(url, { ...fetchOptions, headers });

  if (!response.ok) {
    debug('responseError', { status: response.status, url });
    throw new Error(`Simkl API error ${response.status}: ${path}`);
  }

  const data = (await response.json()) as T;
  
  debug('response', { url, data: JSON.stringify(data) });

  return data;
}

export function getPinCode(clientId: string): Promise<SimklPinResponse> {
  return simklFetch<SimklPinResponse>(`/oauth/pin?client_id=${encodeURIComponent(clientId)}`);
}

export function pollPin(userCode: string, clientId: string): Promise<SimklPinStatusResponse> {
  return simklFetch<SimklPinStatusResponse>(
    `/oauth/pin/${encodeURIComponent(userCode)}?client_id=${encodeURIComponent(clientId)}`
  );
}

export function getUserSettings(token: string, clientId: string): Promise<SimklUserSettings> {
  return simklFetch<SimklUserSettings>('/users/settings', { token, clientId });
}

export function getActivities(token: string, clientId: string): Promise<SimklActivities> {
  return simklFetch<SimklActivities>('/sync/activities', { token, clientId });
}

export function getAllItems(
  token: string,
  clientId: string,
  type: 'movies' | 'shows' | 'anime',
  dateFrom?: string
): Promise<SimklAllItemsResponse> {
  const extended = type === 'anime' ? 'full_anime_seasons' : 'full';
  const params = new URLSearchParams({ extended, episode_watched_at: 'yes' });
  if (dateFrom) params.set('date_from', dateFrom);
  return simklFetch<SimklAllItemsResponse>(`/sync/all-items/${type}?${params.toString()}`, {
    token,
    clientId,
  });
}

export function postHistory(token: string, clientId: string, payload: object): Promise<unknown> {
  return simklFetch('/sync/history', {
    method: 'POST',
    token,
    clientId,
    body: JSON.stringify(payload),
  });
}

export function postWatchlist(token: string, clientId: string, payload: object): Promise<unknown> {
  return simklFetch('/sync/add-to-list', {
    method: 'POST',
    token,
    clientId,
    body: JSON.stringify(payload),
  });
}


export function searchById(clientId: string, imdbId: string): Promise<SimklMediaItem[]> {
  return simklFetch<SimklMediaItem[]>(
    `/search/id?imdb=${encodeURIComponent(imdbId)}&client_id=${encodeURIComponent(clientId)}`
  );
}
