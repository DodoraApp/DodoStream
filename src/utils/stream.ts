import type { Stream } from '@/types/stremio';

/**
 * Best-effort stable identifier for a stream choice.
 * Used to remember the last selected stream for Continue Watching.
 */
export const getStreamStableId = (stream: Stream): string => {
  const addonId = stream.addonId ?? 'unknown';

  const core =
    stream.infoHash ??
    stream.url ??
    stream.externalUrl ??
    stream.ytId ??
    stream.behaviorHints?.group ??
    stream.title ??
    stream.name ??
    'stream';

  return `${addonId}::${core}`;
};

export const getVideoSessionId = (
  source: string,
  metaId?: string,
  videoId?: string,
  usedPlayerType?: string
): string => `${source}::${metaId ?? ''}::${videoId ?? ''}::${usedPlayerType}`;
