import React from 'react';

import { act, render } from '@testing-library/react-native';

import type { PlayerRef } from '@/types/player';

import { RNVideoPlayer } from '../RNVideoPlayer';

let mockNativeVideoProps: Record<string, any> | undefined;
const mockNativeSeek = jest.fn();
let mockPlaybackState: any;

jest.mock('react-native-video', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories require() their mocks
  const ReactMock = require('react');
  return {
    __esModule: true,
    default: ReactMock.forwardRef((props: Record<string, any>, ref: unknown) => {
      mockNativeVideoProps = props;
      ReactMock.useImperativeHandle(ref, () => ({ seek: mockNativeSeek }));
      return null;
    }),
  };
});

jest.mock('@/store/profile.store', () => ({
  useProfileStore: jest.fn((selector: any) => selector({ activeProfileId: 'profile-1' })),
}));

jest.mock('@/store/playback.store', () => ({
  DEFAULT_PROFILE_PLAYBACK_SETTINGS: {
    tunneled: false,
    audioPassthrough: false,
    enableWorkarounds: true,
    showVideoStatistics: false,
    matchFrameRate: false,
    enableVideoSoftwareDecoding: false,
  },
  usePlaybackStore: jest.fn((selector: any) => selector(mockPlaybackState)),
}));

jest.mock('@/utils/debug', () => {
  const debug = jest.fn();
  (globalThis as typeof globalThis & { __rnVideoPlayerDebug: jest.Mock }).__rnVideoPlayerDebug =
    debug;
  return { createDebugLogger: () => debug };
});

const getMockDebug = () =>
  (globalThis as typeof globalThis & { __rnVideoPlayerDebug: jest.Mock }).__rnVideoPlayerDebug;

const getNativeCallback = <T extends (...args: any[]) => any>(name: string): T => {
  const callback = mockNativeVideoProps?.[name];
  if (typeof callback !== 'function') throw new Error(`${name} was not registered`);
  return callback as T;
};

describe('RNVideoPlayer native adapter', () => {
  beforeEach(() => {
    mockNativeVideoProps = undefined;
    mockNativeSeek.mockReset();
    getMockDebug().mockReset();
    mockPlaybackState = {
      byProfile: {
        'profile-1': {
          tunneled: true,
          audioPassthrough: true,
          enableWorkarounds: false,
          showVideoStatistics: true,
          matchFrameRate: true,
          enableVideoSoftwareDecoding: true,
        },
      },
    };
  });

  it('translates load, progress, buffering, end, and statistics events without changing their meaning', () => {
    const onLoad = jest.fn();
    const onProgress = jest.fn();
    const onBuffer = jest.fn();
    const onEnd = jest.fn();
    const onStatistics = jest.fn();
    render(
      <RNVideoPlayer
        source="https://cdn.example/video.m3u8"
        paused={false}
        onLoad={onLoad}
        onProgress={onProgress}
        onBuffer={onBuffer}
        onEnd={onEnd}
        onStatistics={onStatistics}
      />
    );

    act(() => {
      getNativeCallback('onLoad')({ duration: 120 });
      getNativeCallback('onProgress')({ currentTime: 12.5, seekableDuration: 90 });
      getNativeCallback('onProgress')({ currentTime: 13, seekableDuration: 0 });
      getNativeCallback('onBuffer')({ isBuffering: true });
      getNativeCallback('onBuffer')({ isBuffering: false });
      getNativeCallback('onEnd')();
      getNativeCallback('onVideoStatistics')({ bitrate: 4_000_000, droppedFrames: 2 });
    });

    expect(onLoad).toHaveBeenCalledWith({ duration: 120 });
    expect(onProgress).toHaveBeenNthCalledWith(1, { currentTime: 12.5, duration: 90 });
    expect(onProgress).toHaveBeenNthCalledWith(2, { currentTime: 13, duration: 0 });
    expect(onBuffer).toHaveBeenNthCalledWith(1, true);
    expect(onBuffer).toHaveBeenNthCalledWith(2, false);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onStatistics).toHaveBeenCalledWith({ bitrate: 4_000_000, droppedFrames: 2 });
  });

  it('forwards chapter metadata emitted by react-native-video', () => {
    const chapters = [
      { title: 'Intro', startTime: 0, endTime: 62.5, type: 'INTRO' },
      { title: 'Main', startTime: 62.5, endTime: 120 },
    ];
    const onChapters = jest.fn();
    render(
      <RNVideoPlayer
        source="https://cdn.example/video.m3u8"
        paused={false}
        onChapters={onChapters}
      />
    );

    act(() => {
      getNativeCallback('onChapters')({ chapters });
    });

    expect(getMockDebug()).toHaveBeenCalledWith('chapters', { count: chapters.length, chapters });
    expect(onChapters).toHaveBeenCalledWith(chapters);
  });

  it('maps native tracks to stable app tracks and preserves the native subtitle index', () => {
    const onAudioTracks = jest.fn();
    const onTextTracks = jest.fn();
    render(
      <RNVideoPlayer
        source="https://cdn.example/video.m3u8"
        paused={false}
        onAudioTracks={onAudioTracks}
        onTextTracks={onTextTracks}
      />
    );

    act(() => {
      getNativeCallback('onAudioTracks')({
        audioTracks: [
          { title: 'English', language: 'en', type: 'main' },
          { title: 'Deutsch', language: 'de', type: 'commentary' },
        ],
      });
      getNativeCallback('onTextTracks')({
        textTracks: [
          { title: 'English CC', language: 'en', index: 7 },
          { title: 'Deutsch', language: 'de', index: 12 },
        ],
      });
    });

    expect(onAudioTracks).toHaveBeenCalledWith([
      { index: 0, title: 'English', language: 'en', type: 'main' },
      { index: 1, title: 'Deutsch', language: 'de', type: 'commentary' },
    ]);
    expect(onTextTracks).toHaveBeenCalledWith([
      { source: 'video', index: 0, title: 'English CC', language: 'en', playerIndex: 7 },
      { source: 'video', index: 1, title: 'Deutsch', language: 'de', playerIndex: 12 },
    ]);
  });
  it('treats malformed native track and error events as empty or unknown instead of crashing', () => {
    const onAudioTracks = jest.fn();
    const onTextTracks = jest.fn();
    const onError = jest.fn();
    render(
      <RNVideoPlayer
        source="https://cdn.example/video.m3u8"
        paused={false}
        onAudioTracks={onAudioTracks}
        onTextTracks={onTextTracks}
        onError={onError}
      />
    );

    act(() => {
      getNativeCallback('onAudioTracks')({});
      getNativeCallback('onTextTracks')({});
      getNativeCallback('onError')({});
    });

    expect(onAudioTracks).toHaveBeenCalledWith([]);
    expect(onTextTracks).toHaveBeenCalledWith([]);
    expect(onError).toHaveBeenCalledWith('Unknown player error');
  });

  it('produces useful error text from partial and empty native error payloads', () => {
    const onError = jest.fn();
    render(
      <RNVideoPlayer source="https://cdn.example/video.m3u8" paused={false} onError={onError} />
    );

    act(() => {
      getNativeCallback('onError')({
        error: {
          errorCode: '22001',
          errorString: 'decoder failed',
          errorException: undefined,
          error: 'CodecException',
        },
      });
      getNativeCallback('onError')({ error: {} });
    });

    expect(onError).toHaveBeenNthCalledWith(1, '22001 decoder failed CodecException');
    expect(onError).toHaveBeenNthCalledWith(2, '{}');
  });

  it('selects requested audio and embedded subtitle tracks while explicitly disabling subtitles by default', () => {
    const { rerender } = render(
      <RNVideoPlayer source="https://cdn.example/video.m3u8" paused={false} />
    );

    expect(mockNativeVideoProps).toEqual(
      expect.objectContaining({
        selectedAudioTrack: undefined,
        selectedTextTrack: { type: 'disabled', value: '' },
      })
    );

    rerender(
      <RNVideoPlayer
        source="https://cdn.example/video.m3u8"
        paused={false}
        selectedAudioTrack={{ index: 3, language: 'de' }}
        selectedTextTrack={{ source: 'video', index: 2, playerIndex: 9, language: 'en' }}
      />
    );

    expect(mockNativeVideoProps).toEqual(
      expect.objectContaining({
        selectedAudioTrack: { type: 'index', value: 3 },
        selectedTextTrack: { type: 'index', value: 9 },
      })
    );
  });

  it('forwards imperative seek requests and applies all active playback settings', () => {
    const ref = React.createRef<PlayerRef>();
    render(<RNVideoPlayer ref={ref} source="https://cdn.example/video.m3u8" paused />);

    act(() => {
      ref.current?.seekTo(42.25, 120);
    });

    expect(mockNativeSeek).toHaveBeenCalledWith(42.25);
    expect(mockNativeVideoProps).toEqual(
      expect.objectContaining({
        paused: true,
        tunneled: true,
        audioPassthrough: true,
        enableWorkarounds: false,
        reportStatistics: true,
        matchFrameRate: true,
        enableVideoSoftwareDecoding: true,
        controls: false,
        preventsDisplaySleepDuringVideoPlayback: true,
      })
    );
  });
});
