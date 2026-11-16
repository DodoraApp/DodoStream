import type { Stream } from '@/types/stremio';
import {
  filterStreams,
  getAvailableResolutions,
  hasActiveStreamFilters,
  NO_STREAM_FILTERS,
} from '@/utils/stream-filters';

const stream = (value: Record<string, unknown>) => value as unknown as Stream;
const GB = 1000 ** 3;
const MB = 1000 ** 2;

const uhd = stream({
  title: '✅ | 🔥4K | 🟡',
  description: '🖥️ DV | HDR10 📺 HEVC\n🎥 WEB-DL 📦 9.18 GB',
});
const fullHd = stream({ name: 'Addon\n1080p', title: 'Movie.2020.1080p.WEB-DL\n💾 2,4 GB' });
const hd = stream({ name: 'Addon 720p', behaviorHints: { videoSize: 800 * MB } });
const unknown = stream({ name: 'Addon', title: 'Some stream' });

describe('filterStreams', () => {
  const all = [uhd, fullHd, hd, unknown];

  it('returns the same list without active filters', () => {
    expect(hasActiveStreamFilters(NO_STREAM_FILTERS)).toBe(false);
    expect(filterStreams(all, NO_STREAM_FILTERS)).toBe(all);
  });

  it('filters by resolution', () => {
    expect(filterStreams(all, { resolution: '1080p', maxSizeGb: null })).toEqual([fullHd]);
  });

  it('filters by maximum size and leaves out streams of unknown size', () => {
    expect(filterStreams(all, { resolution: null, maxSizeGb: 5 })).toEqual([fullHd, hd]);
    expect(filterStreams(all, { resolution: null, maxSizeGb: 1 })).toEqual([hd]);
  });

  it('uses the size an addon displays: "5.26 GB" is not within "up to 5 GB"', () => {
    const shown = stream({ name: 'Addon 1080p', description: '📦 5.26 GB' });
    const hinted = stream({ name: 'Addon 1080p', behaviorHints: { videoSize: 5.26 * GB } });
    const within = stream({ name: 'Addon 1080p', description: '📦 4.78 GB' });

    expect(filterStreams([shown, hinted, within], { resolution: null, maxSizeGb: 5 })).toEqual([
      within,
    ]);
  });

  it('combines both filters', () => {
    expect(filterStreams(all, { resolution: '2160p', maxSizeGb: 5 })).toEqual([]);
    expect(filterStreams(all, { resolution: '2160p', maxSizeGb: 10 })).toEqual([uhd]);
  });
});

describe('getAvailableResolutions', () => {
  it('lists the resolutions that occur, highest first', () => {
    expect(getAvailableResolutions([hd, unknown, uhd])).toEqual(['2160p', '720p']);
    expect(getAvailableResolutions([unknown])).toEqual([]);
  });
});
