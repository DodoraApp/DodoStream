import type { Stream } from '@/types/stremio';

const BYTES_PER_UNIT = 1024;
const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
const DEFAULT_FILE_EXTENSION = 'mp4';
const MAX_FILE_EXTENSION_LENGTH = 5;
const ADAPTIVE_STREAM_EXTENSIONS = ['m3u8', 'm3u', 'mpd', 'ism'];

type HeaderHints = {
  proxyHeaders?: { request?: unknown };
  headers?: unknown;
  filename?: unknown;
  bingeGroup?: unknown;
  group?: unknown;
};

const getHints = (stream: Stream): HeaderHints =>
  (stream.behaviorHints ?? {}) as unknown as HeaderHints;

const getPathExtension = (value: string): string | undefined => {
  const match = /\.([a-z0-9]+)$/i.exec(value);
  const extension = match?.[1]?.toLowerCase();
  if (!extension || extension.length > MAX_FILE_EXTENSION_LENGTH) return undefined;
  return extension;
};

const getUrlPathname = (url: string): string | undefined => {
  try {
    return new URL(url).pathname;
  } catch {
    return undefined;
  }
};

/**
 * Only direct HTTP(S) files can be downloaded.
 * Torrents, external links, YouTube and adaptive manifests (HLS/DASH) are excluded.
 */
export const isStreamDownloadable = (stream: Stream): boolean => {
  if (!stream.url || stream.infoHash) return false;
  if (!/^https?:\/\//i.test(stream.url)) return false;

  const pathname = getUrlPathname(stream.url);
  if (pathname === undefined) return false;

  const extension = getPathExtension(pathname);
  return !extension || !ADAPTIVE_STREAM_EXTENSIONS.includes(extension);
};

const toHeaderRecord = (value: unknown): Record<string, string> | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const entries = Object.entries(value as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[0].length > 0
  );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

/**
 * Request headers an addon asks the client to send for this stream.
 * `proxyHeaders.request` is the Stremio convention; `headers` is used by some addons.
 */
export const getStreamRequestHeaders = (stream: Stream): Record<string, string> | undefined => {
  const hints = getHints(stream);
  return toHeaderRecord(hints.proxyHeaders?.request) ?? toHeaderRecord(hints.headers);
};

const getBingeGroup = (stream: Stream): string | undefined => {
  const hints = getHints(stream);
  const group = hints.bingeGroup ?? hints.group;
  return typeof group === 'string' && group.length > 0 ? group : undefined;
};

/**
 * Finds the stream of another episode that corresponds to a reference stream,
 * so a whole season is downloaded from the same source and in the same quality.
 * Matches the addon's binge group first, then the stream name. Returns
 * undefined rather than guessing when nothing corresponds.
 */
export const findMatchingStream = (reference: Stream, candidates: Stream[]): Stream | undefined => {
  const downloadable = candidates.filter(isStreamDownloadable);

  const group = getBingeGroup(reference);
  if (group) {
    const byGroup = downloadable.find((candidate) => getBingeGroup(candidate) === group);
    if (byGroup) return byGroup;
  }

  if (reference.name) {
    return downloadable.find((candidate) => candidate.name === reference.name);
  }

  return undefined;
};

/** File extension for the downloaded file, taken from the addon hint or the URL. */
export const getDownloadFileExtension = (stream: Stream): string => {
  const filename = getHints(stream).filename;
  const fromHint = typeof filename === 'string' ? getPathExtension(filename) : undefined;
  if (fromHint) return fromHint;

  const pathname = stream.url ? getUrlPathname(stream.url) : undefined;
  return (pathname ? getPathExtension(pathname) : undefined) ?? DEFAULT_FILE_EXTENSION;
};

/** Unique, filesystem-safe file name for a download. */
export const buildDownloadFileName = (
  metaId: string,
  videoId: string | undefined,
  extension: string,
  uniqueSuffix: string | number
): string => {
  const base = [metaId, videoId && videoId !== metaId ? videoId : undefined]
    .filter(Boolean)
    .join('_')
    .replace(/[^a-z0-9._-]+/gi, '-');
  return `${base}_${uniqueSuffix}.${extension}`;
};

/** Progress between 0 and 1, or undefined when the total size is unknown. */
export const getDownloadProgressRatio = (
  bytesDownloaded: number,
  bytesTotal?: number
): number | undefined => {
  if (!bytesTotal || bytesTotal <= 0) return undefined;
  return Math.min(1, Math.max(0, bytesDownloaded / bytesTotal));
};

/** Human readable size, e.g. "1.4 GB". */
export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return `0 ${BYTE_UNITS[0]}`;

  const unitIndex = Math.min(
    BYTE_UNITS.length - 1,
    Math.floor(Math.log(bytes) / Math.log(BYTES_PER_UNIT))
  );
  const value = bytes / BYTES_PER_UNIT ** unitIndex;
  const digits = unitIndex === 0 || value >= 100 ? 0 : 1;
  return `${value.toFixed(digits)} ${BYTE_UNITS[unitIndex]}`;
};
