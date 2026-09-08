import React from 'react';

import { act, render } from '@testing-library/react-native';

import { RNVideoPlayer } from '../RNVideoPlayer';
import { VideoPlayer } from '../VideoPlayer';

const mockSession = jest.fn<null, [unknown]>((_props) => null);
let mockNativeVideoProps: Record<string, unknown> | undefined;

jest.mock('../VideoPlayerSession', () => ({
  VideoPlayerSession: (props: unknown) => {
    mockSession(props);
    return null;
  },
}));

jest.mock('react-native-video', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories require() their mocks
  const ReactMock = require('react');
  return {
    __esModule: true,
    default: ReactMock.forwardRef((props: Record<string, unknown>, _ref: unknown) => {
      mockNativeVideoProps = props;
      return null;
    }),
  };
});

jest.mock('@/store/profile.store', () => ({
  useProfileStore: jest.fn((selector: any) => selector({ activeProfileId: 'p1' })),
}));

jest.mock('@/store/playback.store', () => ({
  DEFAULT_PROFILE_PLAYBACK_SETTINGS: { player: 'vlc', automaticFallback: true },
  usePlaybackStore: jest.fn((selector: any) =>
    selector({
      byProfile: {
        p1: {
          player: 'exoplayer',
          automaticFallback: false,
        },
      },
    })
  ),
}));

describe('VideoPlayer', () => {
  beforeEach(() => {
    mockSession.mockClear();
  });

  it('passes player settings through to VideoPlayerSession', () => {
    // Arrange

    // Act
    render(
      <VideoPlayer
        source="https://example.com/stream.m3u8"
        title="Title"
        mediaType="movie"
        metaId="m1"
        videoId={undefined}
      />
    );

    // Assert
    expect(mockSession).toHaveBeenCalledTimes(1);
    const props = mockSession.mock.calls[0]?.[0] as any;
    expect(props).toBeDefined();

    expect(props.playerType).toBe('exoplayer');
    expect(props.automaticFallback).toBe(false);
    expect(props.usedPlayerType).toBe('exoplayer');
    expect(typeof props.setUsedPlayerType).toBe('function');
  });
});

describe('RNVideoPlayer', () => {
  beforeEach(() => {
    mockNativeVideoProps = undefined;
  });

  it('forwards native buffering events to the player callback', () => {
    // Arrange
    const onBuffer = jest.fn<void, [boolean]>();
    render(
      <RNVideoPlayer source="https://example.com/stream.m3u8" paused={false} onBuffer={onBuffer} />
    );
    const nativeOnBuffer = mockNativeVideoProps?.onBuffer;
    if (typeof nativeOnBuffer !== 'function') {
      throw new Error('Native video buffer callback was not registered');
    }
    const handleNativeBuffer = nativeOnBuffer as (data: { isBuffering: boolean }) => void;

    // Act
    act(() => {
      handleNativeBuffer({ isBuffering: true });
      handleNativeBuffer({ isBuffering: false });
    });

    // Assert
    expect(onBuffer).toHaveBeenNthCalledWith(1, true);
    expect(onBuffer).toHaveBeenNthCalledWith(2, false);
  });
});
