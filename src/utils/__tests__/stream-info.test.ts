import type { Stream } from '@/types/stremio';
import {
  BYTES_PER_GB,
  getResolutionLabel,
  getStreamLanguages,
  getStreamResolution,
  getStreamSizeBytes,
} from '@/utils/stream-info';

const stream = (value: Record<string, unknown>) => value as unknown as Stream;
const MB = 1000 ** 2;

describe('getStreamResolution', () => {
  it('reads common notations from name, title and description', () => {
    expect(getStreamResolution(stream({ title: '✅ | 🔥4K | 🟡' }))).toBe('2160p');
    expect(getStreamResolution(stream({ description: 'Movie 2160p HDR' }))).toBe('2160p');
    expect(getStreamResolution(stream({ name: 'UHD BluRay' }))).toBe('2160p');
    expect(getStreamResolution(stream({ name: 'Addon\n1080p' }))).toBe('1080p');
    expect(getStreamResolution(stream({ name: 'Addon 720p' }))).toBe('720p');
    expect(getStreamResolution(stream({ title: 'Movie 480p' }))).toBe('480p');
  });

  it('prefers a stated pixel count over a quality label of the source', () => {
    expect(getStreamResolution(stream({ title: 'Movie.4K.Remaster.1080p.BluRay' }))).toBe('1080p');
    expect(getStreamResolution(stream({ name: 'UHD', description: 'Movie 720p' }))).toBe('720p');
  });

  it('returns undefined when no resolution is stated', () => {
    expect(getStreamResolution(stream({ name: 'Addon', title: 'Some stream' }))).toBeUndefined();
    // HDR and HD are not resolutions on their own.
    expect(getStreamResolution(stream({ title: 'Movie HDR10 HD' }))).toBeUndefined();
  });
});

describe('getResolutionLabel', () => {
  it('names 2160p the way users know it', () => {
    expect(getResolutionLabel('2160p')).toBe('4K');
    expect(getResolutionLabel('1080p')).toBe('1080p');
  });
});

describe('getStreamSizeBytes', () => {
  it('prefers the addon hint', () => {
    expect(
      getStreamSizeBytes(stream({ title: '9 GB', behaviorHints: { videoSize: 800 * MB } }))
    ).toBe(800 * MB);
  });

  it('parses sizes with dot or comma in decimal units, as addons display them', () => {
    expect(getStreamSizeBytes(stream({ description: '📦 9.18 GB' }))).toBeCloseTo(
      9.18 * BYTES_PER_GB
    );
    expect(getStreamSizeBytes(stream({ title: '💾 2,4 GB' }))).toBeCloseTo(2.4 * BYTES_PER_GB);
    expect(getStreamSizeBytes(stream({ title: '700 MB' }))).toBe(700 * MB);
    expect(getStreamSizeBytes(stream({ title: '1.5GiB' }))).toBe(1.5 * BYTES_PER_GB);
  });

  it('returns undefined when no size is stated', () => {
    expect(getStreamSizeBytes(stream({ name: 'Addon' }))).toBeUndefined();
    expect(getStreamSizeBytes(stream({ title: 'Atmos 5.1' }))).toBeUndefined();
  });
});

describe('getStreamLanguages', () => {
  it('reads flag emojis and treats the US flag as English', () => {
    expect(getStreamLanguages(stream({ description: '🌐 🇬🇧\\n🎧 Atmos' }))).toEqual(['GB']);
    expect(getStreamLanguages(stream({ description: '🇺🇸' }))).toEqual(['GB']);
    expect(getStreamLanguages(stream({ description: '🇩🇪 🇬🇧' }))).toEqual(['DE', 'GB']);
  });

  it('reads language names and multi-audio markers', () => {
    expect(getStreamLanguages(stream({ title: 'Movie.German.DL.1080p' }))).toEqual(['DE']);
    expect(getStreamLanguages(stream({ title: 'Movie MULTI 1080p' }))).toEqual(['MULTI']);
  });

  it('returns an empty list when no language is stated', () => {
    expect(getStreamLanguages(stream({ title: 'Movie 1080p WEB-DL' }))).toEqual([]);
  });
});
