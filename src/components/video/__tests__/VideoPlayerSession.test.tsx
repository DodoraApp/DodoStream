import * as mockReact from 'react';
import React from 'react';
import { View as mockView } from 'react-native';

import { act } from '@testing-library/react-native';

import { createTestQueryClient, renderWithProviders } from '@/utils/test-utils';

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

let mockIntroData: any;
let mockPreferredAudioLanguages: string[] | undefined;
let mockShowVideoStatistics = false;
jest.mock('@/api/introdb', () => ({
  useIntro: () => ({ data: mockIntroData }),
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
        p1: {
          preferredAudioLanguages: mockPreferredAudioLanguages,
          preferredSubtitleLanguages: undefined,
          showVideoStatistics: mockShowVideoStatistics,
          skipIntroEnabled: true,
        },
      },
    })
  ),
}));

const mockUpsertItem = jest.fn();
const mockSetLastStreamTarget = jest.fn().mockResolvedValue(undefined);
let mockResumeHistoryItem: any;

jest.mock('@/hooks/useWatchHistoryDb', () => ({
  useWatchHistoryActions: () => ({
    upsert: mockUpsertItem,
    removeMeta: jest.fn(),
  }),
  useWatchHistoryItem: () => ({
    data: mockResumeHistoryItem,
  }),
  watchHistoryKeys: {
    all: ['watch-history-db'],
    item: (...args: any[]) => ['watch-history-db', 'item', ...args],
    streamTarget: (...args: any[]) => ['watch-history-db', 'stream-target', ...args],
    continueWatching: (...args: any[]) => ['watch-history-db', 'continue-watching', ...args],
    metaSummaries: (...args: any[]) => ['watch-history-db', 'meta-summaries', ...args],
  },
}));

jest.mock('@/db', () => ({
  setLastStreamTarget: (...args: any[]) => mockSetLastStreamTarget(...args),
}));

let mockLastExoProps: any;
type MockPlayerControlsProps = React.ComponentProps<typeof mockView> & {
  currentTime?: number;
  disableControls?: boolean;
  showLoadingIndicator?: boolean;
  introData?: unknown;
  onPlayPause?: () => void;
  onVisibilityChange?: (visible: boolean) => void;
  selectedAudioTrack?: { index: number };
  onSelectAudioTrack?: (index: number) => void;
};
let mockPlayerControlsProps: MockPlayerControlsProps | undefined;
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
  PlayerControls: (props: MockPlayerControlsProps) => {
    mockPlayerControlsProps = props;
    return mockReact.createElement(mockView, props);
  },
}));

let mockStatisticsOverlayProps:
  | {
      statistics: Record<string, unknown>;
      diagnostics: { rebufferCount: number; bufferHistory: number[] };
    }
  | undefined;
jest.mock('../PlayerStatisticsOverlay', () => ({
  PlayerStatisticsOverlay: (props: any) => {
    mockStatisticsOverlayProps = props;
    return null;
  },
}));

let mockUpNextResolved: any | undefined;
let mockUpNextProps: any;
jest.mock('../UpNextPopup', () => ({
  UpNextPopup: (props: any) => {
    mockUpNextProps = props;
    mockReact.useEffect(() => {
      if (mockUpNextResolved) {
        props.onUpNextResolved(mockUpNextResolved);
      }
    }, [props.onUpNextResolved]);
    return null;
  },
}));
const triggerBuffering = (playerProps: any) => {
  act(() => {
    playerProps.onLoad({ duration: 100 });
    mockPlayerControlsProps?.onVisibilityChange?.(false);
    playerProps.onBuffer(true);
  });
};

describe('VideoPlayerSession', () => {
  let dateNowSpy: jest.SpyInstance<number, []>;

  beforeEach(() => {
    jest.useFakeTimers();
    mockLastExoProps = undefined;
    mockLastVlcProps = undefined;
    mockPlayerControlsProps = undefined;
    mockUpNextResolved = undefined;
    mockUpNextProps = undefined;
    mockSeekTo.mockReset();
    mockUpsertItem.mockReset();
    mockSetLastStreamTarget.mockReset().mockResolvedValue(undefined);
    mockResumeHistoryItem = undefined;
    mockIntroData = undefined;
    mockPreferredAudioLanguages = undefined;
    mockShowVideoStatistics = false;
    mockShowToast.mockReset();
    mockReplaceToStreams.mockReset();
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

    return {
      ...renderWithProviders(<VideoPlayerSession {...props} />, {
        queryClient: createTestQueryClient(),
      }),
      props,
    };
  };

  it('renders the correct player component based on usedPlayerType', () => {
    renderSession({ usedPlayerType: 'exoplayer' });

    expect(mockLastExoProps).toBeTruthy();
    expect(mockLastVlcProps).toBeUndefined();

    renderSession({ usedPlayerType: 'vlc' });
    expect(mockLastVlcProps).toBeTruthy();
  });

  it('shows reliable buffering events before and after playback starts', () => {
    const { getByTestId, queryByTestId } = renderSession();
    triggerBuffering(mockLastExoProps);
    expect(mockPlayerControlsProps?.disableControls).toBe(false);
    expect(getByTestId('player-buffering-indicator')).toBeTruthy();
    act(() => mockLastExoProps.onBuffer(false));
    expect(queryByTestId('player-buffering-indicator')).toBeNull();
    act(() => {
      mockLastExoProps.onPlaying();
      mockLastExoProps.onBuffer(true);
    });
    expect(getByTestId('player-buffering-indicator')).toBeTruthy();

    const vlcSession = renderSession({ usedPlayerType: 'vlc', playerType: 'vlc' });
    triggerBuffering(mockLastVlcProps);
    expect(vlcSession.queryByTestId('player-buffering-indicator')).toBeTruthy();
    expect(mockPlayerControlsProps?.showLoadingIndicator).toBe(true);
    act(() => {
      mockLastVlcProps.onPlaying();
      mockLastVlcProps.onBuffer(true);
    });
    expect(vlcSession.queryByTestId('player-buffering-indicator')).toBeNull();
    expect(mockPlayerControlsProps?.showLoadingIndicator).toBe(false);

    act(() => {
      mockPlayerControlsProps?.onPlayPause?.();
      mockLastVlcProps.onBuffer(true);
    });
    expect(vlcSession.queryByTestId('player-buffering-indicator')).toBeNull();
  });
  it('collects diagnostics only while the statistics overlay is visible', () => {
    const { rerender } = renderSession({ usedPlayerType: 'exoplayer' });
    act(() => {
      mockLastExoProps.onLoad({ duration: 100 });
      mockLastExoProps.onStatistics({ videoCodecName: 'HEVC' });
      mockLastExoProps.onPlaying();
      mockLastExoProps.onBuffer(true);
      mockLastExoProps.onBuffer(false);
      mockLastExoProps.onProgress({ currentTime: 10, bufferedDuration: 30 });
    });

    expect(mockStatisticsOverlayProps).toBeUndefined();
    expect(mockLastExoProps).toBeTruthy();

    // Enabling the overlay starts collection from the next event.
    mockShowVideoStatistics = true;
    rerender(
      <VideoPlayerSession
        source="https://example.com/stream.m3u8"
        title="Title"
        mediaType="movie"
        metaId="m1"
        onStop={jest.fn()}
        onError={jest.fn()}
        usedPlayerType="exoplayer"
        setUsedPlayerType={jest.fn()}
        playerType="exoplayer"
        automaticFallback
      />
    );
    act(() => {
      mockLastExoProps.onPlaying();
      mockLastExoProps.onStatistics({ videoCodecName: 'HEVC' });
      mockLastExoProps.onProgress({ currentTime: 10, bufferedDuration: 30 });
    });

    expect(mockStatisticsOverlayProps?.statistics.videoCodecName).toBe('HEVC');
    expect(mockStatisticsOverlayProps?.diagnostics.bufferHistory).toEqual([20]);
  });
  it('applies resume progress on load and seeks to resume time', () => {
    // Arrange
    mockResumeHistoryItem = { progressSeconds: 30 };

    renderSession({
      usedPlayerType: 'exoplayer',
      playerType: 'exoplayer',
      automaticFallback: false,
    });

    // Act
    act(() => mockLastExoProps.onLoad({ duration: 100 }));

    act(() => {
      jest.runOnlyPendingTimers();
    });

    // Assert
    expect(mockSeekTo).toHaveBeenCalledWith(30, 100);
    expect(mockUpsertItem).toHaveBeenCalledWith(
      expect.objectContaining({ metaId: 'm1', progressSeconds: 30, durationSeconds: 100 })
    );
  });
  it('only seeks the current source when a delayed resume is superseded by a stream switch', () => {
    mockResumeHistoryItem = { progressSeconds: 30 };
    const { props, rerender } = renderSession({ source: 'https://example.com/first.m3u8' });

    act(() => {
      mockLastExoProps.onLoad({ duration: 100 });
    });

    rerender(<VideoPlayerSession {...props} source="https://example.com/second.m3u8" />);

    act(() => {
      mockLastExoProps.onLoad({ duration: 200 });
      jest.runOnlyPendingTimers();
    });

    expect(mockSeekTo).toHaveBeenCalledTimes(1);
    expect(mockSeekTo).toHaveBeenCalledWith(30, 200);
  });

  it('does not seek through an unmounted player session', () => {
    mockResumeHistoryItem = { progressSeconds: 30 };
    const { unmount } = renderSession();

    act(() => {
      mockLastExoProps.onLoad({ duration: 100 });
    });
    unmount();
    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(mockSeekTo).not.toHaveBeenCalled();
  });

  it('keeps skip intro hidden until the resumed position is reported', () => {
    mockResumeHistoryItem = { type: 'series', progressSeconds: 30 };
    mockIntroData = { start_ms: 0, end_ms: 60_000 };
    renderSession({ mediaType: 'series' as any, metaId: 'tt1234567', videoId: 'tt1234567:1:1' });

    act(() => {
      mockLastExoProps.onLoad({ duration: 100 });
      mockLastExoProps.onProgress({ currentTime: 0 });
    });
    expect(mockPlayerControlsProps?.introData).toBeUndefined();
    expect(mockPlayerControlsProps?.currentTime).toBe(30);
    expect(mockUpsertItem).toHaveBeenCalledTimes(1);
    expect(mockUpsertItem).toHaveBeenCalledWith(
      expect.objectContaining({ progressSeconds: 30, durationSeconds: 100 })
    );
    act(() => mockLastExoProps.onProgress({ currentTime: 30 }));
    expect(mockPlayerControlsProps?.introData).toEqual(mockIntroData);
    expect(mockPlayerControlsProps?.currentTime).toBe(30);
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
    expect(mockSetLastStreamTarget).toHaveBeenCalledWith({
      profileId: 'p1',
      metaId: 'm1',
      videoId: undefined,
      type: 'movie',
      target: {
        type: 'url',
        value: 'https://example.com/stream.m3u8',
      },
    });
  });
  it('persists the stable stream ID with the last stream target', () => {
    renderSession({ streamId: 'addon-1::info-hash' });

    act(() => {
      mockLastExoProps.onLoad({ duration: 100 });
    });

    expect(mockSetLastStreamTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        streamId: 'addon-1::info-hash',
      })
    );
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
        title: 'switching_to',
      })
    );
  });
  it.each([
    ['a network error', 'Network timeout', 'exoplayer', 'exoplayer', true],
    ['a codec error when fallback is disabled', 'Decoder failed', 'exoplayer', 'exoplayer', false],
    [
      'a codec error from a player that was not selected',
      'Decoder failed',
      'vlc',
      'exoplayer',
      true,
    ],
    ['a codec error after VLC is exhausted', 'Decoder failed', 'vlc', 'vlc', true],
  ])(
    'reports %s without switching players',
    (_description, message, usedPlayerType, playerType, automaticFallback) => {
      const setUsedPlayerType = jest.fn();
      const onError = jest.fn();
      renderSession({
        usedPlayerType: usedPlayerType as 'exoplayer' | 'vlc',
        playerType: playerType as 'exoplayer' | 'vlc',
        automaticFallback,
        setUsedPlayerType,
        onError,
      });

      act(() => {
        const playerProps = usedPlayerType === 'vlc' ? mockLastVlcProps : mockLastExoProps;
        playerProps.onError(message);
      });

      expect(setUsedPlayerType).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(message);
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'playback_error', preset: 'error' })
      );
    }
  );

  it('autoplays next episode on end when Up Next is resolved and not cancelled', () => {
    // Arrange
    mockUpNextResolved = { videoId: 'v2', episodeLabel: 'S1E2' };

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
  it('handles duplicated terminal events once for a resolved next episode', () => {
    mockUpNextResolved = { videoId: 'v2', episodeLabel: 'S1E2' };
    renderSession({ mediaType: 'series' as any, videoId: 'v1', bingeGroup: 'bg' });

    act(() => {
      mockLastExoProps.onEnd();
      mockLastExoProps.onEnd();
    });

    expect(mockReplaceToStreams).toHaveBeenCalledTimes(1);
    expect(mockReplaceToStreams).toHaveBeenCalledWith(
      { metaId: 'm1', videoId: 'v2', type: 'series' },
      { autoPlay: '1', bingeGroup: 'bg' }
    );
  });

  it('honors cancellation that races with the terminal event', () => {
    mockUpNextResolved = { videoId: 'v2', episodeLabel: 'S1E2' };
    const onStop = jest.fn();
    renderSession({ mediaType: 'series' as any, videoId: 'v1', bingeGroup: 'bg', onStop });

    act(() => {
      mockUpNextProps.onCancelAutoplay();
      mockLastExoProps.onEnd();
    });

    expect(mockReplaceToStreams).not.toHaveBeenCalled();
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('chooses the preferred audio track and ignores an unknown manual track index', () => {
    mockPreferredAudioLanguages = ['de'];
    renderSession();

    act(() => {
      mockLastExoProps.onAudioTracks([
        { index: 0, title: 'English', language: 'en' },
        { index: 1, title: 'Deutsch', language: 'de' },
      ]);
    });

    expect(mockPlayerControlsProps?.selectedAudioTrack).toEqual(
      expect.objectContaining({ index: 1, language: 'de' })
    );

    act(() => {
      mockPlayerControlsProps?.onSelectAudioTrack?.(99);
    });

    expect(mockPlayerControlsProps?.selectedAudioTrack).toEqual(
      expect.objectContaining({ index: 1, language: 'de' })
    );
  });

  it('publishes throttled progressRatio to UpNextPopup from player events', () => {
    // Arrange
    renderSession({ usedPlayerType: 'exoplayer', playerType: 'exoplayer' });

    // Duration 0 publishes 0 and never publishes a ratio
    act(() => {
      mockLastExoProps.onLoad({ duration: 0 });
    });
    expect(mockUpNextProps.progressRatio).toBe(0);

    // Act - load with a valid duration
    act(() => {
      mockLastExoProps.onLoad({ duration: 100 });
    });
    expect(mockUpNextProps.progressRatio).toBe(0);

    // Below threshold (movie: 0.90): publishes on 5% bucket changes
    act(() => {
      mockLastExoProps.onProgress({ currentTime: 10 });
    });
    expect(mockUpNextProps.progressRatio).toBe(0.1);

    // Same 5% bucket (0.1 and 0.12 both floor to bucket 2): unchanged
    act(() => {
      mockLastExoProps.onProgress({ currentTime: 12 });
    });
    expect(mockUpNextProps.progressRatio).toBe(0.1);

    // New 5% bucket: publishes
    act(() => {
      mockLastExoProps.onProgress({ currentTime: 20 });
    });
    expect(mockUpNextProps.progressRatio).toBe(0.2);

    act(() => {
      mockLastExoProps.onProgress({ currentTime: 25 });
    });
    expect(mockUpNextProps.progressRatio).toBe(0.25);

    // Crossing the movie threshold publishes the crossing ratio
    act(() => {
      mockLastExoProps.onProgress({ currentTime: 90 });
    });
    expect(mockUpNextProps.progressRatio).toBe(0.9);

    // Post-threshold ticks keep publishing each new ratio
    act(() => {
      mockLastExoProps.onProgress({ currentTime: 91 });
    });
    expect(mockUpNextProps.progressRatio).toBe(0.91);

    // Later progress below the threshold publishes again once its bucket changes
    act(() => {
      mockLastExoProps.onProgress({ currentTime: 50 });
    });
    expect(mockUpNextProps.progressRatio).toBe(0.5);
  });
});
