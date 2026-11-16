import type { Stream } from '@/types/stremio';
import {
  filterStreams,
  getAvailableResolutions,
  getResolutionLabel,
  getStreamResolution,
  getStreamSizeBytes,
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

describe('getStreamResolution', () => {
  it('reads common notations from name, title and description', () => {
    expect(getStreamResolution(uhd)).toBe('2160p');
    expect(getStreamResolution(stream({ description: 'Movie 2160p HDR' }))).toBe('2160p');
    expect(getStreamResolution(stream({ name: 'UHD BluRay' }))).toBe('2160p');
    expect(getStreamResolution(fullHd)).toBe('1080p');
    expect(getStreamResolution(hd)).toBe('720p');
    expect(getStreamResolution(stream({ title: 'Movie 480p' }))).toBe('480p');
  });

  it('returns undefined when no resolution is stated', () => {
    expect(getStreamResolution(unknown)).toBeUndefined();
    // HDR and HD are not resolutions on their own.
    expect(getStreamResolution(stream({ title: 'Movie HDR10 HD' }))).toBeUndefined();
  });
});

describe('getStreamSizeBytes', () => {
  it('prefers the addon hint', () => {
    expect(getStreamSizeBytes(hd)).toBe(800 * MB);
  });

  it('parses sizes with dot or comma and different units', () => {
    expect(getStreamSizeBytes(uhd)).toBeCloseTo(9.18 * GB);
    expect(getStreamSizeBytes(fullHd)).toBeCloseTo(2.4 * GB);
    expect(getStreamSizeBytes(stream({ title: '700 MB' }))).toBe(700 * MB);
    expect(getStreamSizeBytes(stream({ title: '1.5GiB' }))).toBe(1.5 * GB);
  });

  it('returns undefined when no size is stated', () => {
    expect(getStreamSizeBytes(unknown)).toBeUndefined();
    expect(getStreamSizeBytes(stream({ title: 'Atmos 5.1' }))).toBeUndefined();
  });
});

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

describe('getResolutionLabel', () => {
  it('names 2160p the way users know it', () => {
    expect(getResolutionLabel('2160p')).toBe('4K');
    expect(getResolutionLabel('1080p')).toBe('1080p');
  });
});
