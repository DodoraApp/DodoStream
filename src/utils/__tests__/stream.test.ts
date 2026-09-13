import type { Stream } from '@/types/stremio';
import { getStreamStableId, isStreamSelected } from '@/utils/stream';

describe('isStreamSelected', () => {
  const stream = {
    addonId: 'addon-1',
    url: 'https://example.com/current.m3u8',
  } as Stream;

  it('matches the stable stream ID', () => {
    expect(isStreamSelected(stream, 'addon-1::https://example.com/current.m3u8')).toBe(true);
  });

  it('does not use the URL fallback when a different stable stream ID is selected', () => {
    const selectedStream = {
      addonId: 'addon-1',
      infoHash: 'hash-1',
      url: 'https://example.com/current.m3u8',
    } as Stream;
    const sameUrlFromAnotherAddon = {
      addonId: 'addon-2',
      url: selectedStream.url,
    } as Stream;

    expect(
      isStreamSelected(
        sameUrlFromAnotherAddon,
        getStreamStableId(selectedStream),
        selectedStream.url
      )
    ).toBe(false);
  });

  it('matches the current URL when autoplay has no stable stream ID', () => {
    expect(isStreamSelected(stream, undefined, stream.url)).toBe(true);
  });
  it('matches encoded addon URLs to the decoded player source', () => {
    const encodedStream = {
      addonId: 'addon-1',
      url: 'https://example.com/The%20Simpsons%20S01E11.m3u8',
    } as Stream;

    expect(
      isStreamSelected(encodedStream, undefined, 'https://example.com/The Simpsons S01E11.m3u8')
    ).toBe(true);
    expect(getStreamStableId(encodedStream)).toBe(
      'addon-1::https://example.com/The Simpsons S01E11.m3u8'
    );
  });

  it('does not mark a different stream as active', () => {
    expect(isStreamSelected(stream, undefined, 'https://example.com/other.m3u8')).toBe(false);
  });
});
