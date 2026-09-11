import type { Stream } from '@/types/stremio';

/**
 * Normalize equivalent encoded/unencoded stream URLs before comparing them.
 * Addons commonly return `%20` while the player route contains decoded spaces.
 */
export const normalizeStreamUrl = (url: string): string => {
  try {
    return decodeURI(url);
  } catch {
    return url;
  }
};

/** Returns whether a stream can be opened by the player. */
export const isStreamAvailable = (stream: Stream): boolean =>
  Boolean(stream.url || stream.externalUrl || stream.ytId);

/**
 * Best-effort stable identifier for a stream choice.
 * Used to remember the last selected stream for Continue Watching.
 */
export const getStreamStableId = (stream: Stream): string => {
  const addonId = stream.addonId ?? 'unknown';

  const core =
    stream.infoHash ??
    (stream.url ? normalizeStreamUrl(stream.url) : undefined) ??
    stream.externalUrl ??
    stream.ytId ??
    stream.behaviorHints?.group ??
    stream.title ??
    stream.name ??
    'stream';

  return `${addonId}::${core}`;
};

/** Matches the active stream by stable ID, with URL fallback for autoplay sessions. */
export const isStreamSelected = (
  stream: Stream,
  selectedStreamId?: string,
  selectedStreamUrl?: string
): boolean =>
  selectedStreamId === getStreamStableId(stream) ||
  (!!selectedStreamUrl &&
    !!stream.url &&
    normalizeStreamUrl(stream.url) === normalizeStreamUrl(selectedStreamUrl));

export const getVideoSessionId = (
  source: string,
  metaId?: string,
  videoId?: string,
  usedPlayerType?: string
): string => `${source}::${metaId ?? ''}::${videoId ?? ''}::${usedPlayerType}`;
