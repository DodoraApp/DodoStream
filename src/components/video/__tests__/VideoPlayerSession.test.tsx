import React from 'react';
import { act } from '@testing-library/react-native';
import { renderWithProviders } from '@/utils/test-utils';

import * as mockReact from 'react';
import { View as mockView } from 'react-native';

import { VideoPlayerSession } from '../VideoPlayerSession';

const mockShowToast = jest.fn();
jest.mock('@/store/toast.store', () => ({ showToast: (...args: any[]) => mockShowToast(...args) }));

const mockReplaceToStreams = jest.fn();
jest.mock('@/hooks/useMediaNavigation', () => ({
  useMediaNavigation: () => ({ replaceToStreams: mockReplaceToStreams }),
}));

jest.mock('@/store/profile.store', () => ({
  useProfileStore: jest.fn((selector: any) => selector({ activeProfileId: 'p1' })),
}));

jest.mock('@/store/profile-settings.store', () => ({
  useProfileSettingsStore: jest.fn((selector: any) =>
    selector({
      byProfile: {
        p1: {
          preferredAudioLanguages: undefined,
          preferredSubtitleLanguages: undefined,
        },
      },
    })
  ),
}));

const mockUpsertItem = jest.fn();
const mockSetLastStreamTarget = jest.fn();
const watchHistoryState: any = {
  byProfile: {
    p1: {},
  },
};

const useWatchHistoryStoreMock: any = (selector: any) => selector(watchHistoryState);
useWatchHistoryStoreMock.getState = () => ({
  upsertItem: mockUpsertItem,
  setLastStreamTarget: mockSetLastStreamTarget,
});

jest.mock('@/store/watch-history.store', () => ({
  useWatchHistoryStore: useWatchHistoryStoreMock,
}));

let mockLastExoProps: any;
let mockLastVlcProps: any;
const mockSeekTo = jest.fn();

jest.mock('../RNVideoPlayer', () => {
  return {
    RNVideoPlayer: mockReact.forwardRef((props: any, ref: any) => {
      mockLastExoProps = props;
      mockReact.useImperativeHandle(ref, () => ({ seekTo: mockSeekTo }));
      return null;
    }),
  };
});

jest.mock('../VLCPlayer', () => {
  return {
    VLCPlayer: mockReact.forwardRef((props: any, ref: any) => {
      mockLastVlcProps = props;
      mockReact.useImperativeHandle(ref, () => ({ seekTo: mockSeekTo }));
      return null;
    }),
  };
});

jest.mock('../PlayerControls', () => ({
  PlayerControls: (props: any) => {
    return mockReact.createElement(mockView, props);
  },
}));

let mockUpNextResolved: any | undefined;
jest.mock('../UpNextPopup', () => ({
  UpNextPopup: (props: any) => {
    mockReact.useEffect(() => {
      if (mockUpNextResolved) {
        props.onUpNextResolved(mockUpNextResolved);
      }
    }, [props]);
    return null;
  },
}));

describe('VideoPlayerSession', () => {
  let dateNowSpy: jest.SpyInstance<number, []>;

  beforeEach(() => {
    jest.useFakeTimers();
    mockLastExoProps = undefined;
    mockLastVlcProps = undefined;
    mockUpNextResolved = undefined;
    mockSeekTo.mockReset();
    mockUpsertItem.mockReset();
    mockSetLastStreamTarget.mockReset();
    mockShowToast.mockReset();
    mockReplaceToStreams.mockReset();
    watchHistoryState.byProfile.p1 = {};
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(10_000);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    dateNowSpy.mockRestore();
  });

  const renderSession = (
    overrides: Partial<React.ComponentProps<typeof VideoPlayerSession>> = {}
  ) => {
    const props: React.ComponentProps<typeof VideoPlayerSession> = {
      source: 'https://example.com/stream.m3u8',
      title: 'Title',
      mediaType: 'movie' as any,
      metaId: 'm1',
      videoId: undefined,
      bingeGroup: undefined,
      onStop: jest.fn(),
      onError: jest.fn(),
      usedPlayerType: 'exoplayer',
      setUsedPlayerType: jest.fn(),
      playerType: 'exoplayer',
      automaticFallback: true,
      ...overrides,
    };

    const { createTestQueryClient } = require('@/utils/test-utils');
    return {
      ...renderWithProviders(<VideoPlayerSession {...props} />, {
        queryClient: createTestQueryClient(),
      }),
      props,
    };
  };

  it('renders the correct player component based on usedPlayerType', () => {
    // Arrange / Act
    renderSession({ usedPlayerType: 'exoplayer' });

    // Assert
    expect(mockLastExoProps).toBeTruthy();
    expect(mockLastVlcProps).toBeUndefined();

    // Arrange / Act
    renderSession({ usedPlayerType: 'vlc' });

    // Assert
    expect(mockLastVlcProps).toBeTruthy();
  });

  it('applies resume progress on load and seeks to resume time', () => {
    // Arrange
    watchHistoryState.byProfile.p1 = {
      m1: {
        _: {
          id: 'm1',
          type: 'movie',
          progressSeconds: 30,
          durationSeconds: 100,
          lastWatchedAt: 1,
        },
      },
    };

    renderSession({
      usedPlayerType: 'exoplayer',
      playerType: 'exoplayer',
      automaticFallback: false,
    });

    // Act
    act(() => {
      mockLastExoProps.onLoad({ duration: 100 });
    });

    act(() => {
      jest.runOnlyPendingTimers();
    });

    // Assert
    expect(mockSeekTo).toHaveBeenCalledWith(30, 100);
    expect(mockUpsertItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'm1', progressSeconds: 30, durationSeconds: 100 })
    );
  });

  it('persists last stream target on successful load (duration > 0) only once', () => {
    // Arrange
    renderSession();

    // Act: duration 0 should not persist
    act(() => {
      mockLastExoProps.onLoad({ duration: 0 });
    });

    // Act: first successful load should persist
    act(() => {
      mockLastExoProps.onLoad({ duration: 100 });
    });

    // Act: subsequent load should not persist again
    act(() => {
      mockLastExoProps.onLoad({ duration: 200 });
    });

    // Assert
    expect(mockSetLastStreamTarget).toHaveBeenCalledTimes(1);
    expect(mockSetLastStreamTarget).toHaveBeenCalledWith('m1', undefined, 'movie', {
      type: 'url',
      value: 'https://example.com/stream.m3u8',
    });
  });

  it('attempts automatic fallback on error when enabled and user-selected player fails', () => {
    // Arrange
    const setUsedPlayerType = jest.fn();

    renderSession({
      usedPlayerType: 'exoplayer',
      playerType: 'exoplayer',
      automaticFallback: true,
      setUsedPlayerType,
    });

    // Act
    act(() => {
      mockLastExoProps.onError('boom');
    });

    // Assert
    expect(setUsedPlayerType).toHaveBeenCalledWith('vlc');
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('Switching to'),
      })
    );
  });

  it('autoplays next episode on end when Up Next is resolved and not cancelled', () => {
    // Arrange
    mockUpNextResolved = { videoId: 'v2', episodeLabel: 'S1E2' };

    const { createTestQueryClient } = require('@/utils/test-utils');
    renderWithProviders(
      <VideoPlayerSession
        source="s"
        title="t"
        mediaType={'series' as any}
        metaId="m1"
        videoId="v1"
        bingeGroup="bg"
        onStop={jest.fn()}
        onError={jest.fn()}
        usedPlayerType="exoplayer"
        setUsedPlayerType={jest.fn()}
        playerType="exoplayer"
        automaticFallback={false}
      />,
      { queryClient: createTestQueryClient() }
    );

    // Act
    act(() => {
      mockLastExoProps.onEnd();
    });

    // Assert
    expect(mockReplaceToStreams).toHaveBeenCalledWith(
      { metaId: 'm1', videoId: 'v2', type: 'series' },
      { autoPlay: '1', bingeGroup: 'bg' }
    );
  });
});
