import { StremioApiError } from '@/api/errors';
import {
  CatalogResponse,
  Manifest,
  MetaResponse,
  StreamResponse,
  SubtitlesResponse,
} from '@/types/stremio';

const TIMEOUTS = {
  manifest: 10_000,
  catalog: 15_000,
  meta: 15_000,
  streams: 20_000,
  subtitles: 15_000,
} as const;

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetches and validates a Stremio addon manifest
 * @param manifestUrl - The URL ending with manifest.json
 * @returns The parsed manifest object
 * @throws Error if the fetch fails or the manifest is invalid
 */
export async function fetchManifest(manifestUrl: string): Promise<Manifest> {
  if (!manifestUrl.endsWith('manifest.json')) {
    throw new StremioApiError(
      'Invalid manifest URL: must end with manifest.json',
      undefined,
      manifestUrl
    );
  }

  const response = await fetchWithTimeout(manifestUrl, TIMEOUTS.manifest);

  if (!response.ok) {
    throw StremioApiError.fromResponse(response, manifestUrl);
  }

  const manifest: Manifest = await response.json();

  // Validate required fields
  if (
    !manifest.id ||
    !manifest.version ||
    !manifest.name ||
    !manifest.resources ||
    !manifest.types
  ) {
    throw new StremioApiError('Invalid manifest: missing required fields', undefined, manifestUrl);
  }

  return manifest;
}

/**
 * Constructs the base URL from a manifest URL
 * Example: https://v3-cinemeta.strem.io/manifest.json -> https://v3-cinemeta.strem.io
 */
function getBaseUrl(manifestUrl: string): string {
  return manifestUrl.replace(/\/manifest\.json$/, '');
}

/**
 * Fetches a catalog from a Stremio addon
 * @param manifestUrl - The addon's manifest URL
 * @param type - The content type (movie, series, etc.)
 * @param id - The catalog ID
 * @param extra - Optional extra parameters (skip for pagination, genre filters, etc.)
 * @returns The catalog response with metas
 */
export async function fetchCatalog(
  manifestUrl: string,
  type: string,
  id: string,
  extra?: Record<string, string>
): Promise<CatalogResponse> {
  const baseUrl = getBaseUrl(manifestUrl);

  // Build the URL: /catalog/{type}/{id}.json or /catalog/{type}/{id}/{extra}.json
  let catalogPath = `/catalog/${type}/${id}`;

  if (extra && Object.keys(extra).length > 0) {
    const extraString = Object.entries(extra)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    catalogPath += `/${extraString}`;
  }

  catalogPath += '.json';

  const url = `${baseUrl}${catalogPath}`;

  const response = await fetchWithTimeout(url, TIMEOUTS.catalog);

  if (!response.ok) {
    throw StremioApiError.fromResponse(response, url);
  }

  const data: CatalogResponse = await response.json();

  return data;
}

/**
 * Fetches a catalog with pagination support
 * @param manifestUrl - The addon's manifest URL
 * @param type - The content type (movie, series, etc.)
 * @param id - The catalog ID
 * @param skip - Number of items to skip (for pagination)
 * @returns The catalog response with metas
 */
export async function fetchCatalogWithPagination(
  manifestUrl: string,
  type: string,
  id: string,
  skip: number = 0
): Promise<CatalogResponse> {
  const extra = skip > 0 ? { skip: skip.toString() } : undefined;
  return fetchCatalog(manifestUrl, type, id, extra);
}

/**
 * Fetches detailed metadata for a specific item
 * @param manifestUrl - The addon's manifest URL
 * @param type - The content type (movie, series, etc.)
 * @param id - The item ID (e.g., IMDB ID like "tt1254207")
 * @returns The meta response with full details
 */
export async function fetchMeta(
  manifestUrl: string,
  type: string,
  id: string
): Promise<MetaResponse> {
  const baseUrl = getBaseUrl(manifestUrl);

  // Build the URL: /meta/{type}/{id}.json
  const metaPath = `/meta/${type}/${id}.json`;
  const url = `${baseUrl}${metaPath}`;

  const response = await fetchWithTimeout(url, TIMEOUTS.meta);

  if (!response.ok) {
    throw StremioApiError.fromResponse(response, url);
  }

  const data: MetaResponse = await response.json();

  return data;
}

/**
 * Fetches streams for a specific item
 * @param manifestUrl - The addon's manifest URL
 * @param type - The content type (movie, series, etc.)
 * @param id - The item ID (e.g., IMDB ID like "tt1254207")
 * @returns The stream response with available streams
 */
export async function fetchStreams(
  manifestUrl: string,
  type: string,
  id: string
): Promise<StreamResponse> {
  const baseUrl = getBaseUrl(manifestUrl);

  // Build the URL: /stream/{type}/{id}.json
  const streamPath = `/stream/${type}/${id}.json`;
  const url = `${baseUrl}${streamPath}`;

  const response = await fetchWithTimeout(url, TIMEOUTS.streams);

  if (!response.ok) {
    throw StremioApiError.fromResponse(response, url);
  }

  const data: StreamResponse = await response.json();

  return data;
}

/**
 * Fetches external subtitles for a specific item from an addon.
 *
 * Stremio protocol supports an optional `extra` segment, typically including
 * `videoHash` and `videoSize` (and potentially more depending on the addon).
 */
export async function fetchSubtitles(
  manifestUrl: string,
  type: string,
  id: string,
  extra?: Record<string, string>
): Promise<SubtitlesResponse> {
  const baseUrl = getBaseUrl(manifestUrl);

  let subtitlesPath = `/subtitles/${type}/${id}`;
  if (extra && Object.keys(extra).length > 0) {
    const extraString = Object.entries(extra)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    subtitlesPath += `/${extraString}`;
  }
  subtitlesPath += '.json';

  const url = `${baseUrl}${subtitlesPath}`;

  const response = await fetchWithTimeout(url, TIMEOUTS.subtitles);

  if (!response.ok) {
    throw StremioApiError.fromResponse(response, url);
  }

  const data: SubtitlesResponse = await response.json();
  return data;
}
