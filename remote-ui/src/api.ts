import { type AddonConfig } from '@app/types/addon-config';

// Base URL is the TV's server — same origin when served by the TV
export const isSessionEndedError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  if (error.message === 'UNAUTHORIZED') return true;
  // Browser fetch throws TypeError for network failures (DNS, CORS, offline).
  // These have well-known messages per engine: "Failed to fetch" (Chromium),
  // "Load failed" (WebKit), "NetworkError when attempting to fetch" (Gecko).
  if (error.name === 'TypeError') {
    const msg = error.message;
    return (
      msg.includes('Failed to fetch') ||
      msg.includes('Load failed') ||
      msg.includes('NetworkError when attempting to fetch')
    );
  }
  return false;
};

const getBaseUrl = () => {
  return window.location.origin;
};

const getPin = () => localStorage.getItem('dodostream_pin') ?? '';

export const setPin = (pin: string) => localStorage.setItem('dodostream_pin', pin);
const clearPin = () => localStorage.removeItem('dodostream_pin');

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getPin()}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    clearPin();
    throw new Error('UNAUTHORIZED');
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  if (res.status === 204 || res.status === 205) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export interface Profile {
  id: string;
  name: string;
  color: string;
}

export type { AddonConfig };

export interface Addon {
  id: string;
  name: string;
  version: string;
  description?: string;
  manifestUrl: string;
  configurable: boolean;
  config: AddonConfig;
}

export const api = {
  getProfiles: () => request<Profile[]>('GET', '/api/v1/profiles'),
  getAddons: (profileId: string) => request<Addon[]>('GET', `/api/v1/profiles/${profileId}/addons`),
  installAddon: (manifestUrl: string) => request<{ id: string }>('POST', '/api/v1/addons', { manifestUrl }),
  removeAddon: (addonId: string) => request<void>('DELETE', `/api/v1/addons/${encodeURIComponent(addonId)}`),
  updateAddonConfig: (profileId: string, addonId: string, config: Partial<AddonConfig>) =>
    request<void>('PATCH', `/api/v1/profiles/${profileId}/addons/${encodeURIComponent(addonId)}`, config),
  reorderAddons: (profileId: string, orderedIds: string[]) =>
    request<void>('PUT', `/api/v1/profiles/${profileId}/addons/order`, { orderedIds }),
};
