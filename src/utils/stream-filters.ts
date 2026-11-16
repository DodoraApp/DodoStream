import type { Stream } from '@/types/stremio';
import {
  BYTES_PER_GB,
  getStreamResolution,
  getStreamSizeBytes,
  STREAM_RESOLUTIONS,
  type StreamResolution,
} from '@/utils/stream-info';

/** Upper file size limits offered by the size filter, in gigabytes. */
export const STREAM_MAX_SIZE_OPTIONS_GB = [1, 2, 5, 10, 20] as const;

export interface StreamFilters {
  /** Only streams of exactly this resolution. */
  resolution: StreamResolution | null;
  /** Only streams up to this size in gigabytes. */
  maxSizeGb: number | null;
}

export const NO_STREAM_FILTERS: StreamFilters = { resolution: null, maxSizeGb: null };

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
