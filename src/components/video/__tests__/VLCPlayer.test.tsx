import React from 'react';

import { act, render } from '@testing-library/react-native';

import type { PlayerProps, PlayerRef } from '@/types/player';

import { VLCPlayer } from '../VLCPlayer';

// Props-capturing mock of the native view, following the pattern used by
// VideoPlayerSession.test.tsx. The v8 package types are erased at runtime,
// so the module factory only needs the view and the ref shape.
const mockSeek = jest.fn();
let mockLastProps: any;

jest.mock('expo-libvlc-player', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories require() their mocks
  const ReactMock = require('react');
  return {
    LibVlcPlayerView: ReactMock.forwardRef((props: any, ref: any) => {
      mockLastProps = props;
      ReactMock.useImperativeHandle(ref, () => ({ seek: mockSeek }));
      return null;
    }),
  };
});

jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories require() their mocks
  const ReactMock = require('react');
  return {
    useFocusEffect: (callback: () => void) => {
      ReactMock.useEffect(() => {
        callback();
      }, [callback]);
    },
  };
});

jest.mock('@/store/profile.store', () => ({
  useProfileStore: jest.fn((selector: any) => selector({ activeProfileId: 'p1' })),
}));

jest.mock('@/store/playback.store', () => ({
  DEFAULT_PROFILE_PLAYBACK_SETTINGS: {
    player: 'exoplayer',
    automaticFallback: true,
    autoPlayFirstStream: false,
    showVideoStatistics: false,
    tunneled: false,
    audioPassthrough: false,
    enableWorkarounds: true,
  },
  usePlaybackStore: jest.fn((selector: any) =>
    selector({
      byProfile: {
        p1: { subtitleStyle: undefined },
      },
    })
  ),
}));

const renderVLC = (props: Partial<PlayerProps>, ref?: React.Ref<PlayerRef>) =>
  render(<VLCPlayer ref={ref} source="https://example.com/media.mp4" paused={false} {...props} />);

const flushFocusRemount = () => {
  // The focus-remount workaround renders null for 100ms after mount
  act(() => {
    jest.advanceTimersByTime(200);
  });
};

const fireFirstPlay = (lengthMs: number) => {
  act(() => {
    mockLastProps.onFirstPlay({ width: 1920, height: 1080, length: lengthMs, seekable: true });
  });
};

describe('VLCPlayer (expo-libvlc-player v8 adapter)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockLastProps = undefined;
    mockSeek.mockReset();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('converts onTimeChanged {value} milliseconds to seconds', () => {
    const onProgress = jest.fn();
    renderVLC({ onProgress });
    flushFocusRemount();

    act(() => {
      mockLastProps.onTimeChanged({ value: 5000 });
    });

    expect(onProgress).toHaveBeenCalledWith({ currentTime: 5 });
  });

  it('forwards onEncounteredError {message} as the error string', () => {
    const onError = jest.fn();
    renderVLC({ onError });
    flushFocusRemount();

    act(() => {
      mockLastProps.onEncounteredError({ message: 'vlc decode failure' });
    });

    expect(onError).toHaveBeenCalledWith('vlc decode failure');
  });

  it('maps onESAdded audio and subtitle tracks', () => {
    const onAudioTracks = jest.fn();
    const onTextTracks = jest.fn();
    renderVLC({ onAudioTracks, onTextTracks });
    flushFocusRemount();

    act(() => {
      mockLastProps.onESAdded({
        audio: [
          { id: 1, name: 'English' },
          { id: -1, name: 'disabled' },
        ],
        video: [{ id: 0, name: 'Video' }],
        subtitle: [{ id: 2, name: 'CC' }],
      });
    });

    expect(onAudioTracks).toHaveBeenCalledWith([{ index: 1, title: 'English' }]);
    expect(onTextTracks).toHaveBeenCalledWith([
      { source: 'video', index: 2, title: 'CC', playerIndex: 2 },
    ]);
  });

  it('maps fitMode to contentFit: stretch -> fill, others -> contain', () => {
    const { rerender } = renderVLC({ fitMode: 'stretch' });
    flushFocusRemount();
    expect(mockLastProps.contentFit).toBe('fill');

    rerender(<VLCPlayer source="https://example.com/media.mp4" paused={false} fitMode="contain" />);
    flushFocusRemount();
    expect(mockLastProps.contentFit).toBe('contain');

    rerender(<VLCPlayer source="https://example.com/media.mp4" paused={false} fitMode="cover" />);
    flushFocusRemount();
    expect(mockLastProps.contentFit).toBe('contain');
  });

  it('seeks in milliseconds once the player is ready', () => {
    const ref = React.createRef<PlayerRef>();
    renderVLC({}, ref);
    flushFocusRemount();

    // Seek is gated on readiness
    act(() => {
      ref.current?.seekTo(12.5, 600);
    });
    expect(mockSeek).not.toHaveBeenCalled();

    fireFirstPlay(600_000);
    act(() => {
      ref.current?.seekTo(12.5, 600);
    });
    expect(mockSeek).toHaveBeenCalledWith(12_500, 'time');
  });

  it('reports natural end exactly once when stopped near the duration', () => {
    const onEnd = jest.fn();
    renderVLC({ onEnd });
    flushFocusRemount();

    fireFirstPlay(600_000);
    act(() => {
      mockLastProps.onTimeChanged({ value: 599_500 }); // 0.5s from the end
    });
    act(() => {
      mockLastProps.onStopped();
    });
    act(() => {
      mockLastProps.onStopped(); // teardown stop must not repeat the end
    });

    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('does not report end when stopped mid-playback (teardown)', () => {
    const onEnd = jest.fn();
    renderVLC({ onEnd });
    flushFocusRemount();

    fireFirstPlay(600_000);
    act(() => {
      mockLastProps.onTimeChanged({ value: 10_000 });
    });
    act(() => {
      mockLastProps.onStopped();
    });

    expect(onEnd).not.toHaveBeenCalled();
  });

  it('resets the end guard when a new source is prepared', () => {
    const onEnd = jest.fn();
    const { rerender } = renderVLC({ onEnd });
    flushFocusRemount();

    fireFirstPlay(600_000);
    act(() => {
      mockLastProps.onTimeChanged({ value: 599_500 });
    });
    act(() => {
      mockLastProps.onStopped();
    });
    expect(onEnd).toHaveBeenCalledTimes(1);

    rerender(<VLCPlayer source="https://example.com/next.mp4" paused={false} onEnd={onEnd} />);
    flushFocusRemount();
    fireFirstPlay(600_000);
    act(() => {
      mockLastProps.onTimeChanged({ value: 10_000 });
    });
    act(() => {
      mockLastProps.onStopped();
    });
    expect(onEnd).toHaveBeenCalledTimes(1); // no second end for the new source
  });

  it('maps selected tracks into the tracks prop', () => {
    renderVLC({
      selectedAudioTrack: { index: 3 },
      selectedTextTrack: { source: 'video', index: 4, playerIndex: 7 },
    });
    flushFocusRemount();

    expect(mockLastProps.tracks).toEqual({ audio: 3, subtitle: 7 });
  });
});
