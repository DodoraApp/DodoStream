import type { Stream } from '@/types/stremio';
import {
  buildDownloadFileName,
  findMatchingStream,
  formatBytes,
  getDownloadFileExtension,
  getDownloadProgressRatio,
  getStreamRequestHeaders,
  isStreamDownloadable,
} from '@/utils/downloads';

const stream = (value: Record<string, unknown>) => value as unknown as Stream;

describe('isStreamDownloadable', () => {
  it('accepts direct http and https files', () => {
    expect(isStreamDownloadable(stream({ url: 'https://example.com/movie.mkv' }))).toBe(true);
    expect(isStreamDownloadable(stream({ url: 'http://example.com/dl/abc123' }))).toBe(true);
  });

  it('rejects adaptive manifests even with a query string', () => {
    expect(isStreamDownloadable(stream({ url: 'https://example.com/index.m3u8?token=1' }))).toBe(
      false
    );
    expect(isStreamDownloadable(stream({ url: 'https://example.com/manifest.mpd' }))).toBe(false);
  });

  it('rejects torrents, external links, YouTube and non-http schemes', () => {
    expect(isStreamDownloadable(stream({ infoHash: 'hash' }))).toBe(false);
    expect(
      isStreamDownloadable(stream({ infoHash: 'hash', url: 'https://example.com/a.mkv' }))
    ).toBe(false);
    expect(isStreamDownloadable(stream({ externalUrl: 'https://example.com' }))).toBe(false);
    expect(isStreamDownloadable(stream({ ytId: 'abc' }))).toBe(false);
    expect(isStreamDownloadable(stream({ url: 'magnet:?xt=urn:btih:hash' }))).toBe(false);
    expect(isStreamDownloadable(stream({ url: 'file:///data/movie.mkv' }))).toBe(false);
  });
});

describe('getStreamRequestHeaders', () => {
  it('reads proxyHeaders.request', () => {
    expect(
      getStreamRequestHeaders(
        stream({
          url: 'https://example.com/a.mkv',
          behaviorHints: { proxyHeaders: { request: { Referer: 'https://example.com/' } } },
        })
      )
    ).toEqual({ Referer: 'https://example.com/' });
  });

  it('falls back to behaviorHints.headers and drops non-string values', () => {
    expect(
      getStreamRequestHeaders(
        stream({
          url: 'https://example.com/a.mkv',
          behaviorHints: { headers: { 'User-Agent': 'Dodo', Broken: 1 } },
        })
      )
    ).toEqual({ 'User-Agent': 'Dodo' });
  });

  it('returns undefined without usable headers', () => {
    expect(getStreamRequestHeaders(stream({ url: 'https://example.com/a.mkv' }))).toBeUndefined();
    expect(
      getStreamRequestHeaders(
        stream({ url: 'https://example.com/a.mkv', behaviorHints: { proxyHeaders: {} } })
      )
    ).toBeUndefined();
  });
});

describe('findMatchingStream', () => {
  const episode = (text: string, extra: Record<string, unknown> = {}) =>
    stream({
      description: text,
      url: `https://example.com/${encodeURIComponent(text)}.mkv`,
      ...extra,
    });

  const reference = episode('🇬🇧 1080p 📦 2.0 GB', { name: 'Addon' });

  it('picks the stream with the same language and resolution', () => {
    const otherResolution = episode('🇬🇧 2160p 📦 2.1 GB');
    const otherLanguage = episode('🇩🇪 1080p 📦 2.0 GB');
    const match = episode('🇬🇧 1080p 📦 2.2 GB');

    expect(findMatchingStream(reference, [otherResolution, otherLanguage, match])).toBe(match);
  });

  it('treats the UK and US flag as the same language and needs every language to match', () => {
    const usFlag = episode('🇺🇸 1080p 📦 2.0 GB');
    const dual = episode('🇬🇧 🇩🇪 1080p 📦 2.0 GB');

    expect(findMatchingStream(reference, [dual, usFlag])).toBe(usFlag);
    expect(findMatchingStream(reference, [dual])).toBeUndefined();
  });

  it('picks the closest file size among the matching streams', () => {
    const larger = episode('🇬🇧 1080p 📦 3.5 GB');
    const closest = episode('🇬🇧 1080p 📦 1.8 GB');
    const smaller = episode('🇬🇧 1080p 📦 1.1 GB');

    expect(findMatchingStream(reference, [larger, closest, smaller])).toBe(closest);
  });

  it('rejects streams that are far larger or smaller', () => {
    const remux = episode('🇬🇧 1080p 📦 9.0 GB');
    const tiny = episode('🇬🇧 1080p 📦 400 MB');

    expect(findMatchingStream(reference, [remux, tiny])).toBeUndefined();
  });

  it('prefers the same binge group over a closer size', () => {
    const grouped = stream({
      description: '🇬🇧 1080p 📦 2.0 GB',
      url: 'https://example.com/e1.mkv',
      behaviorHints: { bingeGroup: 'addon|1080p|x265' },
    });
    const closerSize = episode('🇬🇧 1080p 📦 2.0 GB');
    const sameGroup = episode('🇬🇧 1080p 📦 2.6 GB', {
      behaviorHints: { bingeGroup: 'addon|1080p|x265' },
    });

    expect(findMatchingStream(grouped, [closerSize, sameGroup])).toBe(sameGroup);
  });

  it('keeps a stream of unknown size as a candidate', () => {
    const noSize = episode('🇬🇧 1080p');

    expect(findMatchingStream(reference, [noSize])).toBe(noSize);
  });

  it('never returns a stream that cannot be downloaded', () => {
    const hls = stream({ description: '🇬🇧 1080p 📦 2.0 GB', url: 'https://example.com/e2.m3u8' });

    expect(findMatchingStream(reference, [hls])).toBeUndefined();
  });

  it('falls back to binge group or name when the reference states no quality', () => {
    const plain = stream({
      name: 'Addon stream',
      url: 'https://example.com/e1.mkv',
      behaviorHints: { group: 'addon-group' },
    });
    const sameName = stream({ name: 'Addon stream', url: 'https://example.com/a.mkv' });
    const sameGroup = stream({
      name: 'Other',
      url: 'https://example.com/b.mkv',
      behaviorHints: { bingeGroup: 'addon-group' },
    });
    const unrelated = stream({ name: 'Other', url: 'https://example.com/c.mkv' });

    expect(findMatchingStream(plain, [unrelated, sameName, sameGroup])).toBe(sameGroup);
    expect(findMatchingStream(plain, [unrelated, sameName])).toBe(sameName);
    expect(findMatchingStream(plain, [unrelated])).toBeUndefined();
  });
});

describe('getDownloadFileExtension', () => {
  it('prefers the addon filename hint', () => {
    expect(
      getDownloadFileExtension(
        stream({ url: 'https://example.com/dl/abc', behaviorHints: { filename: 'Movie.2020.MKV' } })
      )
    ).toBe('mkv');
  });

  it('uses the URL path and ignores the query string', () => {
    expect(getDownloadFileExtension(stream({ url: 'https://example.com/a.webm?x=1.avi' }))).toBe(
      'webm'
    );
  });

  it('defaults to mp4 when nothing usable is found', () => {
    expect(getDownloadFileExtension(stream({ url: 'https://example.com/dl/abc' }))).toBe('mp4');
    expect(getDownloadFileExtension(stream({ url: 'https://example.com/a.toolongext' }))).toBe(
      'mp4'
    );
  });
});

describe('buildDownloadFileName', () => {
  it('builds a filesystem-safe name', () => {
    expect(buildDownloadFileName('tt123', 'tt123:1:2', 'mkv', 42)).toBe('tt123_tt123-1-2_42.mkv');
  });

  it('omits the video id for movies', () => {
    expect(buildDownloadFileName('tt123', undefined, 'mp4', 1)).toBe('tt123_1.mp4');
    expect(buildDownloadFileName('tt123', 'tt123', 'mp4', 1)).toBe('tt123_1.mp4');
  });

  it('never keeps path separators', () => {
    expect(buildDownloadFileName('../etc/passwd', 'a/b', 'mp4', 1)).not.toContain('/');
  });
});

describe('getDownloadProgressRatio', () => {
  it('returns undefined for an unknown total', () => {
    expect(getDownloadProgressRatio(10)).toBeUndefined();
    expect(getDownloadProgressRatio(10, 0)).toBeUndefined();
  });

  it('clamps between 0 and 1', () => {
    expect(getDownloadProgressRatio(50, 200)).toBe(0.25);
    expect(getDownloadProgressRatio(300, 200)).toBe(1);
  });
});

describe('formatBytes', () => {
  it('formats sizes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1.5 * 1024 ** 3)).toBe('1.5 GB');
    expect(formatBytes(250 * 1024 ** 2)).toBe('250 MB');
  });
});
