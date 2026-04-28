import React from 'react';

import { render } from '@testing-library/react-native';

import { VideoPlayer } from '../VideoPlayer';

const mockSession = jest.fn<null, [unknown]>((_props) => null);

jest.mock('../VideoPlayerSession', () => ({
  VideoPlayerSession: (props: unknown) => {
    mockSession(props);
    return null;
  },
}));

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
