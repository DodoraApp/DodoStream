import type { Stream } from '@/types/stremio';

/** Vertical resolutions a stream can be filtered by, highest first. */
export const STREAM_RESOLUTIONS = ['2160p', '1440p', '1080p', '720p', '480p'] as const;
export type StreamResolution = (typeof STREAM_RESOLUTIONS)[number];

/** Upper file size limits offered by the size filter, in gigabytes. */
export const STREAM_MAX_SIZE_OPTIONS_GB = [1, 2, 5, 10, 20] as const;

export interface StreamFilters {
  /** Only streams of exactly this resolution. */
  resolution: StreamResolution | null;
  /** Only streams up to this size in gigabytes. */
  maxSizeGb: number | null;
}

export const NO_STREAM_FILTERS: StreamFilters = { resolution: null, maxSizeGb: null };

// Decimal units, so the limits match the sizes addons display ("5.26 GB").
const BYTES_PER_UNIT = 1000;
const BYTES_PER_GB = BYTES_PER_UNIT ** 3;

/** Names shown for resolutions that are better known by another name. */
const RESOLUTION_LABELS: Partial<Record<StreamResolution, string>> = { '2160p': '4K' };

/** Display name of a resolution, e.g. "4K" for 2160p. */
export const getResolutionLabel = (resolution: StreamResolution): string =>
  RESOLUTION_LABELS[resolution] ?? resolution;

const RESOLUTION_PATTERNS: readonly [StreamResolution, RegExp][] = [
  ['2160p', /\b(2160p|4k|uhd)\b/i],
  ['1440p', /\b(1440p|2k|qhd)\b/i],
  ['1080p', /\b(1080p|fhd)\b/i],
  ['720p', /\b720p\b/i],
  ['480p', /\b(480p|576p|sd)\b/i],
];

const SIZE_PATTERN = /(\d+(?:[.,]\d+)?)\s*(tb|gb|mb|kb|tib|gib|mib|kib)\b/i;

const SIZE_UNIT_EXPONENT: Record<string, number> = { k: 1, m: 2, g: 3, t: 4 };

/** Addons describe quality and size in free text spread over these fields. */
const getStreamText = (stream: Stream): string =>
  [stream.name, stream.title, stream.description].filter(Boolean).join('\n');

/** Resolution an addon states for the stream, or undefined when it states none. */
export const getStreamResolution = (stream: Stream): StreamResolution | undefined => {
  const text = getStreamText(stream);
  return RESOLUTION_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0];
};

/** File size in bytes from the addon hint or its description, or undefined when unknown. */
export const getStreamSizeBytes = (stream: Stream): number | undefined => {
  const hinted = (stream.behaviorHints as { videoSize?: unknown } | undefined)?.videoSize;
  if (typeof hinted === 'number' && hinted > 0) return hinted;

  const match = SIZE_PATTERN.exec(getStreamText(stream));
  if (!match) return undefined;

  const value = Number.parseFloat(match[1].replace(',', '.'));
  const exponent = SIZE_UNIT_EXPONENT[match[2][0].toLowerCase()];
  if (!Number.isFinite(value) || value <= 0 || !exponent) return undefined;

  return value * BYTES_PER_UNIT ** exponent;
};

export const hasActiveStreamFilters = (filters: StreamFilters): boolean =>
  filters.resolution !== null || filters.maxSizeGb !== null;

/**
 * Applies the filters. A stream whose resolution or size is unknown cannot
 * satisfy the corresponding filter and is left out while that filter is active.
 */
export const filterStreams = (streams: Stream[], filters: StreamFilters): Stream[] => {
  if (!hasActiveStreamFilters(filters)) return streams;

  const maxSizeBytes = filters.maxSizeGb === null ? null : filters.maxSizeGb * BYTES_PER_GB;

  return streams.filter((stream) => {
    if (filters.resolution !== null && getStreamResolution(stream) !== filters.resolution) {
      return false;
    }
    if (maxSizeBytes !== null) {
      const size = getStreamSizeBytes(stream);
      if (size === undefined || size > maxSizeBytes) return false;
    }
    return true;
  });
};

/** Resolutions that occur among the streams, highest first. */
export const getAvailableResolutions = (streams: Stream[]): StreamResolution[] => {
  const present = new Set(streams.map(getStreamResolution));
  return STREAM_RESOLUTIONS.filter((resolution) => present.has(resolution));
};
