import { SEASON_MATCH_MAX_SIZE_FACTOR } from '@/constants/downloads';
import type { DownloadStatus } from '@/db/schema';
import type { Stream } from '@/types/stremio';
import { getStreamLanguages, getStreamResolution, getStreamSizeBytes } from '@/utils/stream-info';

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
 * so a whole season is downloaded in the same quality: same audio languages,
 * same resolution and a similar file size. Streams of the same binge group
 * are preferred, because addons use it for exactly this purpose.
 *
 * Returns undefined rather than guessing when nothing corresponds, so the
 * user can pick a stream for that episode.
 */
export const findMatchingStream = (reference: Stream, candidates: Stream[]): Stream | undefined => {
  const downloadable = candidates.filter(isStreamDownloadable);

  const resolution = getStreamResolution(reference);
  const languages = getStreamLanguages(reference).join(',');
  const size = getStreamSizeBytes(reference);

  const sameQuality = downloadable.filter(
    (candidate) =>
      (!resolution || getStreamResolution(candidate) === resolution) &&
      (!languages || getStreamLanguages(candidate).join(',') === languages)
  );

  // Without any stated quality the stream name is the only thing to go by.
  if (!resolution && !languages) {
    const group = getBingeGroup(reference);
    return (
      (group ? downloadable.find((candidate) => getBingeGroup(candidate) === group) : undefined) ??
      (reference.name
        ? downloadable.find((candidate) => candidate.name === reference.name)
        : undefined)
    );
  }

  const similarSize = sameQuality.filter((candidate) => {
    const candidateSize = getStreamSizeBytes(candidate);
    if (!size || !candidateSize) return true;
    const ratio = candidateSize / size;
    return ratio >= 1 / SEASON_MATCH_MAX_SIZE_FACTOR && ratio <= SEASON_MATCH_MAX_SIZE_FACTOR;
  });
  if (similarSize.length === 0) return undefined;

  const group = getBingeGroup(reference);
  const sameGroup = group
    ? similarSize.filter((candidate) => getBingeGroup(candidate) === group)
    : [];
  const pool = sameGroup.length > 0 ? sameGroup : similarSize;

  if (!size) return pool[0];

  // Closest in size; the first one wins a tie, which keeps the addon's order.
  return pool.reduce((best, candidate) => {
    const distance = Math.abs((getStreamSizeBytes(candidate) ?? size) - size);
    const bestDistance = Math.abs((getStreamSizeBytes(best) ?? size) - size);
    return distance < bestDistance ? candidate : best;
  });
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

/** Icon that stands for the state of a download across the app. */
export const getDownloadStatusIcon = (
  status: DownloadStatus
): 'download' | 'hourglass-outline' | 'alert-circle-outline' => {
  if (status === 'completed') return 'download';
  if (status === 'queued' || status === 'downloading') return 'hourglass-outline';
  return 'alert-circle-outline';
};

/**
 * State that sums up several downloads of one title: in progress wins over
 * a problem, a problem wins over finished.
 */
export const getOverallDownloadStatus = (
  statuses: DownloadStatus[]
): DownloadStatus | undefined => {
  if (statuses.length === 0) return undefined;
  const active = statuses.find((status) => status === 'downloading' || status === 'queued');
  if (active) return active;
  return statuses.find((status) => status === 'failed' || status === 'needs_stream') ?? 'completed';
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
