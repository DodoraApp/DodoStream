import * as mockReact from 'react';
import React from 'react';
import { View as mockView } from 'react-native';

import { act, fireEvent, within } from '@testing-library/react-native';

import type { EpisodeListProps } from '@/components/media/EpisodeList';
import type { StreamListProps } from '@/components/media/StreamList';
import { SKIP_FORWARD_SECONDS } from '@/constants/playback';
import { renderWithProviders } from '@/utils/test-utils';

import { PlayerControls } from '../PlayerControls';

jest.mock('@/components/video/controls/ControlButton', () => ({
  ControlButton: (props: any) =>
    mockReact.createElement(
      mockView,
      props,
      props.label ? mockReact.createElement('Text', null, props.label) : null
    ),
}));

jest.mock('@/components/basic/LoadingIndicator', () => ({
  LoadingIndicator: (props: object) =>
    mockReact.createElement(mockView, { ...props, testID: 'player-loading-indicator' }),
}));

jest.mock('@/store/profile.store', () => ({
  useProfileStore: jest.fn((selector: any) => selector({ activeProfileId: 'p1' })),
}));

jest.mock('@/store/playback.store', () => ({
  usePlaybackStore: jest.fn((selector: any) =>
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

jest.mock('@react-native-community/slider', () => {
  return (props: any) => mockReact.createElement(mockView, props);
});

jest.mock('@/components/media/EpisodeList', () => ({
  EpisodeList: (props: EpisodeListProps) =>
    mockReact.createElement(mockView, { ...props, testID: 'episode-list-mock' }),
}));

jest.mock('@/components/media/StreamList', () => ({
  StreamList: (props: StreamListProps) =>
    mockReact.createElement(mockView, { ...props, testID: 'stream-list-mock' }),
}));
jest.mock('@/components/video/PlayerMenuOverlay', () => ({
  PlayerMenuOverlay: (props: any) =>
    props.visible
      ? mockReact.createElement(
          mockView,
          { ...props, testID: 'player-menu-overlay' },
          mockReact.createElement('Text', null, props.title),
          props.children
        )
      : null,
}));

describe('PlayerControls basic interactions', () => {
  it('renders title and toggles visibility on press', () => {
    // Arrange
    const { getByText, queryByText, getByTestId } = renderWithProviders(
      <PlayerControls
        paused={true}
        currentTime={0}
        duration={100}
        showLoadingIndicator={false}
        title="My Title"
        audioTracks={[]}
        textTracks={[]}
        mediaType="movie"
        metaId="test-meta-id"
        onPlayPause={() => {}}
        onSeek={() => {}}
        onSkipBackward={() => {}}
        onSkipForward={() => {}}
        onSelectAudioTrack={() => {}}
        onSelectTextTrack={() => {}}
        subtitleDelay={0}
        onSubtitleDelayChange={() => {}}
        fitMode="contain"
        onToggleFitMode={() => {}}
        onStreamSelect={() => {}}
        onEpisodeSelect={() => {}}
      />
    );

    // Assert (initial - controls are hidden)
    expect(queryByText('My Title')).toBeNull();

    // Act - press to show controls
    fireEvent.press(getByTestId('player-controls-invisible-area'));

    // Assert - controls are now visible
    expect(getByText('My Title')).toBeTruthy();

    expect(getByTestId('player-fit-mode')).toBeTruthy();

    // Act - press overlay to hide controls
    fireEvent.press(getByTestId('player-controls-overlay'));

    // Assert - controls are hidden again
    expect(queryByText('My Title')).toBeNull();
  });

  it('keeps controls visible after skip-forward', () => {
    const onSkipForward = jest.fn();
    const playbackProps = {
      paused: true,
      currentTime: 0,
      duration: 100,
      showLoadingIndicator: false,
      title: 'My Title',
      audioTracks: [],
      textTracks: [],
      onPlayPause: () => {},
      onSeek: () => {},
      onSkipBackward: () => {},
      onSkipForward,
      onSelectAudioTrack: () => {},
      onSelectTextTrack: () => {},
      subtitleDelay: 0,
      onSubtitleDelayChange: () => {},
      fitMode: 'contain' as const,
      onToggleFitMode: () => {},
      mediaType: 'movie',
      metaId: 'movie-1',
      onStreamSelect: () => {},
      onEpisodeSelect: () => {},
    } satisfies React.ComponentProps<typeof PlayerControls>;
    const { getByText, getByTestId } = renderWithProviders(<PlayerControls {...playbackProps} />);

    fireEvent.press(getByTestId('player-controls-invisible-area'));
    fireEvent.press(getByText(`+${SKIP_FORWARD_SECONDS}s`));

    expect(onSkipForward).toHaveBeenCalledTimes(1);
    expect(getByText('My Title')).toBeTruthy();
    expect(getByTestId('player-controls-overlay').props.focusable).toBe(false);
  });

  it('shows the loading indicator without disabling controls during buffering', () => {
    // Arrange
    const { getByText, getByTestId } = renderWithProviders(
      <PlayerControls
        paused={false}
        currentTime={0}
        duration={100}
        showLoadingIndicator={true}
        disableControls={false}
        title="My Title"
        audioTracks={[]}
        textTracks={[]}
        onPlayPause={() => {}}
        onSeek={() => {}}
        onSkipBackward={() => {}}
        onSkipForward={() => {}}
        onSelectAudioTrack={() => {}}
        onSelectTextTrack={() => {}}
        subtitleDelay={0}
        onSubtitleDelayChange={() => {}}
        fitMode="contain"
        onToggleFitMode={() => {}}
        mediaType="movie"
        metaId="movie-1"
        onStreamSelect={() => {}}
        onEpisodeSelect={() => {}}
      />
    );

    // Act
    fireEvent.press(getByTestId('player-controls-invisible-area'));

    const loadingOverlay = getByTestId('player-loading-indicator-overlay');
    expect(loadingOverlay.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
        }),
        expect.objectContaining({ justifyContent: 'center', alignItems: 'center' }),
      ])
    );
    expect(getByTestId('player-loading-indicator').props.noFlex).toBe(true);
    expect(getByText(`+${SKIP_FORWARD_SECONDS}s`).parent?.props.disabled).toBeFalsy();
    expect(getByText('pause').parent?.props.disabled).toBeFalsy();
  });

  it('displays subtitle items with correct labels', () => {
    // Arrange: build sample combined tracks (pre-sorted as the combiner would produce)
    // Since no preferred languages are set, order is alphabetical by language display name:
    // German (de) comes before English (en) which comes before Spanish (es)
    // Within each language group, addon tracks come before video tracks
    const tracks = [
      // German (first alphabetically)
      {
        source: 'addon',
        index: 0,
        title: 'De Addon Subtitle',
        language: 'de',
        addonName: 'De Addon',
      },
      // English (addon first, then video)
      {
        source: 'addon',
        index: 1,
        title: 'Eng Addon Subtitle',
        language: 'en',
        addonName: 'Eng Addon',
      },
      { source: 'video', index: 2, title: 'Video EN', language: 'en' },
      // Spanish
      { source: 'video', index: 3, title: 'Video ES', language: 'es' },
    ];

    const { getByText, getByTestId } = renderWithProviders(
      <PlayerControls
        paused={true}
        currentTime={0}
        duration={100}
        showLoadingIndicator={false}
        title="My Title"
        audioTracks={[]}
        textTracks={tracks as any}
        mediaType="movie"
        metaId="test-meta-id"
        onPlayPause={() => {}}
        onSeek={() => {}}
        onSkipBackward={() => {}}
        onSkipForward={() => {}}
        onSelectAudioTrack={() => {}}
        onSelectTextTrack={() => {}}
        subtitleDelay={0}
        onSubtitleDelayChange={() => {}}
        fitMode="contain"
        onToggleFitMode={() => {}}
        onStreamSelect={() => {}}
        onEpisodeSelect={() => {}}
      />
    );

    // First show controls
    fireEvent.press(getByTestId('player-controls-invisible-area'));

    // Open subtitles modal
    fireEvent.press(getByText('subtitles'));

    // Assert: All subtitle tracks should be displayed with correct labeling
    // Addon tracks show: "{addonName} | {language}"
    expect(getByText(/De Addon \| German/)).toBeTruthy();
    expect(getByText(/Eng Addon \| English/)).toBeTruthy();

    // Video tracks show: "{title} | {language}" or just "{language}" if title matches language
    expect(getByText(/Video EN \| English/)).toBeTruthy();
    expect(getByText(/Video ES \| Spanish/)).toBeTruthy();
  });
  it('shows and handles a generic skip credits button', () => {
    const onSkipChapter = jest.fn();
    const { getByTestId, getByText } = renderWithProviders(
      <PlayerControls
        paused={true}
        currentTime={90}
        duration={100}
        showLoadingIndicator={false}
        audioTracks={[]}
        textTracks={[]}
        skipTargets={[{ type: 'CREDITS', startTime: 80, endTime: 100 }]}
        onSkipChapter={onSkipChapter}
        mediaType="movie"
        metaId="test-meta-id"
        onPlayPause={() => {}}
        onSeek={() => {}}
        onSkipBackward={() => {}}
        onSkipForward={() => {}}
        onSelectAudioTrack={() => {}}
        onSelectTextTrack={() => {}}
        subtitleDelay={0}
        onSubtitleDelayChange={() => {}}
        fitMode="contain"
        onToggleFitMode={() => {}}
        onStreamSelect={() => {}}
        onEpisodeSelect={() => {}}
      />
    );

    fireEvent.press(getByTestId('player-controls-invisible-area'));
    fireEvent.press(getByText('skip_credits'));

    expect(onSkipChapter).toHaveBeenCalledWith({
      type: 'CREDITS',
      startTime: 80,
      endTime: 100,
    });
  });
});

describe('PlayerControls episode selection', () => {
  it('closes the episodes overlay without redirecting when the current episode is selected', () => {
    const videos = [
      { id: 'e1', title: 'Episode 1', released: '2020-01-01T00:00:00.000Z', season: 1, episode: 1 },
      { id: 'e2', title: 'Episode 2', released: '2020-01-02T00:00:00.000Z', season: 1, episode: 2 },
    ];
    const onEpisodeSelect = jest.fn();
    const { getByText, getByTestId, queryByTestId } = renderWithProviders(
      <PlayerControls
        paused={true}
        currentTime={0}
        duration={100}
        showLoadingIndicator={false}
        title="My Title"
        audioTracks={[]}
        textTracks={[]}
        mediaType="series"
        metaId="test-meta-id"
        videoId="e1"
        videos={videos}
        onPlayPause={() => {}}
        onSeek={() => {}}
        onSkipBackward={() => {}}
        onSkipForward={() => {}}
        onSelectAudioTrack={() => {}}
        onSelectTextTrack={() => {}}
        subtitleDelay={0}
        onSubtitleDelayChange={() => {}}
        fitMode="contain"
        onToggleFitMode={() => {}}
        onStreamSelect={() => {}}
        onEpisodeSelect={onEpisodeSelect}
      />
    );

    fireEvent.press(getByTestId('player-controls-invisible-area'));
    fireEvent.press(getByText('episodes'));

    act(() => {
      getByTestId('episode-list-mock').props.onEpisodePress(videos[0]);
    });

    expect(onEpisodeSelect).not.toHaveBeenCalled();
    expect(queryByTestId('episode-list-mock')).toBeNull();
  });

  it('does not resume playback when selecting another episode', () => {
    const videos = [
      {
        id: 'e1',
        title: 'Episode 1',
        released: '2020-01-01T00:00:00.000Z',
        season: 1,
        episode: 1,
      },
      {
        id: 'e2',
        title: 'Episode 2',
        released: '2020-01-02T00:00:00.000Z',
        season: 1,
        episode: 2,
      },
    ];
    const onPlayPause = jest.fn();
    const onEpisodeSelect = jest.fn();
    const { getByText, getByTestId } = renderWithProviders(
      <PlayerControls
        paused={false}
        currentTime={0}
        duration={100}
        showLoadingIndicator={false}
        title="My Title"
        audioTracks={[]}
        textTracks={[]}
        mediaType="series"
        metaId="test-meta-id"
        videoId="e1"
        videos={videos}
        onPlayPause={onPlayPause}
        onSeek={() => {}}
        onSkipBackward={() => {}}
        onSkipForward={() => {}}
        onSelectAudioTrack={() => {}}
        onSelectTextTrack={() => {}}
        subtitleDelay={0}
        onSubtitleDelayChange={() => {}}
        fitMode="contain"
        onToggleFitMode={() => {}}
        onStreamSelect={() => {}}
        onEpisodeSelect={onEpisodeSelect}
      />
    );

    fireEvent.press(getByTestId('player-controls-invisible-area'));
    fireEvent.press(getByText('episodes'));
    expect(onPlayPause).toHaveBeenCalledTimes(1);

    act(() => {
      getByTestId('episode-list-mock').props.onEpisodePress(videos[1]);
    });

    expect(onEpisodeSelect).toHaveBeenCalledWith(videos[1]);
    expect(onPlayPause).toHaveBeenCalledTimes(1);
  });
});

describe('PlayerControls stream selection', () => {
  it('closes the streams overlay without redirecting when the current stream is selected', () => {
    const currentStreamUrl = 'https://example.com/current.m3u8';
    const currentStreamId = `unknown::${currentStreamUrl}`;
    const onStreamSelect = jest.fn();
    const { getByText, getByTestId, queryByTestId } = renderWithProviders(
      <PlayerControls
        paused={true}
        currentTime={0}
        duration={100}
        showLoadingIndicator={false}
        title="My Title"
        audioTracks={[]}
        textTracks={[]}
        mediaType="movie"
        metaId="test-meta-id"
        currentStreamUrl={currentStreamUrl}
        streamId={currentStreamId}
        onPlayPause={() => {}}
        onSeek={() => {}}
        onSkipBackward={() => {}}
        onSkipForward={() => {}}
        onSelectAudioTrack={() => {}}
        onSelectTextTrack={() => {}}
        subtitleDelay={0}
        onSubtitleDelayChange={() => {}}
        fitMode="contain"
        onToggleFitMode={() => {}}
        onStreamSelect={onStreamSelect}
        onEpisodeSelect={() => {}}
      />
    );

    fireEvent.press(getByTestId('player-controls-invisible-area'));
    fireEvent.press(getByText('streams'));

    expect(getByTestId('stream-list-mock').props.selectedStreamId).toBe(currentStreamId);
    expect(getByTestId('stream-list-mock').props.selectedStreamUrl).toBe(currentStreamUrl);

    expect(getByTestId('player-menu-overlay').props.autoFocus).toBe(false);
    expect(getByTestId('stream-list-mock').props.autoFocus).toBe(false);

    act(() => {
      getByTestId('stream-list-mock').props.onSelectOverride({
        addonId: 'unknown',
        url: currentStreamUrl,
      });
    });

    expect(onStreamSelect).not.toHaveBeenCalled();
    expect(queryByTestId('stream-list-mock')).toBeNull();
  });

  it('redirects and closes the streams overlay when a different stream is selected', () => {
    const onPlayPause = jest.fn();
    const onStreamSelect = jest.fn();
    const { getByText, getByTestId, queryByTestId } = renderWithProviders(
      <PlayerControls
        paused={false}
        currentTime={0}
        duration={100}
        showLoadingIndicator={false}
        title="My Title"
        audioTracks={[]}
        textTracks={[]}
        mediaType="movie"
        metaId="test-meta-id"
        currentStreamUrl="https://example.com/current.m3u8"
        onPlayPause={onPlayPause}
        onSeek={() => {}}
        onSkipBackward={() => {}}
        onSkipForward={() => {}}
        onSelectAudioTrack={() => {}}
        onSelectTextTrack={() => {}}
        subtitleDelay={0}
        onSubtitleDelayChange={() => {}}
        fitMode="contain"
        onToggleFitMode={() => {}}
        onStreamSelect={onStreamSelect}
        onEpisodeSelect={() => {}}
      />
    );

    fireEvent.press(getByTestId('player-controls-invisible-area'));
    fireEvent.press(getByText('streams'));
    expect(onPlayPause).toHaveBeenCalledTimes(1);

    const nextStream = { url: 'https://example.com/next.m3u8' };
    act(() => {
      getByTestId('stream-list-mock').props.onSelectOverride(nextStream);
    });

    expect(onStreamSelect).toHaveBeenCalledWith(nextStream);
    expect(onPlayPause).toHaveBeenCalledTimes(1);
    expect(queryByTestId('stream-list-mock')).toBeNull();
  });

  it.each([
    ['an external URL', { externalUrl: 'https://external.example/movie' }],
    ['a YouTube stream', { ytId: 'youtube-video-id' }],
  ])('does not resume playback when selecting %s', (_label, externalStream) => {
    const onPlayPause = jest.fn();
    const onStreamSelect = jest.fn();
    const { getByText, getByTestId } = renderWithProviders(
      <PlayerControls
        paused={false}
        currentTime={0}
        duration={100}
        showLoadingIndicator={false}
        title="My Title"
        audioTracks={[]}
        textTracks={[]}
        mediaType="movie"
        metaId="test-meta-id"
        currentStreamUrl="https://example.com/current.m3u8"
        onPlayPause={onPlayPause}
        onSeek={() => {}}
        onSkipBackward={() => {}}
        onSkipForward={() => {}}
        onSelectAudioTrack={() => {}}
        onSelectTextTrack={() => {}}
        subtitleDelay={0}
        onSubtitleDelayChange={() => {}}
        fitMode="contain"
        onToggleFitMode={() => {}}
        onStreamSelect={onStreamSelect}
        onEpisodeSelect={() => {}}
      />
    );

    fireEvent.press(getByTestId('player-controls-invisible-area'));
    fireEvent.press(getByText('streams'));
    expect(onPlayPause).toHaveBeenCalledTimes(1);

    act(() => {
      getByTestId('stream-list-mock').props.onSelectOverride(externalStream);
    });

    expect(onStreamSelect).toHaveBeenCalledWith(externalStream);
    expect(onPlayPause).toHaveBeenCalledTimes(1);
  });
});

describe('PlayerControls chapters', () => {
  const renderWithChapters = (currentTime: number) =>
    renderWithProviders(
      <PlayerControls
        paused={true}
        currentTime={currentTime}
        duration={100}
        showLoadingIndicator={false}
        audioTracks={[]}
        textTracks={[]}
        chapters={
          [
            { startTime: 0, endTime: 20, type: 'INTRO' },
            { title: 'Main', startTime: 20, endTime: 100 },
          ] as any
        }
        mediaType="movie"
        metaId="test-meta-id"
        onPlayPause={() => {}}
        onSeek={() => {}}
        onSkipBackward={() => {}}
        onSkipForward={() => {}}
        onSelectAudioTrack={() => {}}
        onSelectTextTrack={() => {}}
        subtitleDelay={0}
        onSubtitleDelayChange={() => {}}
        fitMode="contain"
        onToggleFitMode={() => {}}
        onStreamSelect={() => {}}
        onEpisodeSelect={() => {}}
      />
    );

  it('renders every chapter label above its segment and marks the active one', () => {
    const { getByTestId, getByText } = renderWithChapters(5);
    fireEvent.press(getByTestId('player-controls-invisible-area'));

    expect(getByTestId('chapter-label-0')).toBeTruthy();
    expect(getByTestId('chapter-label-1')).toBeTruthy();
    expect(within(getByTestId('chapter-label-0')).getByTestId('chapter-label-active')).toBeTruthy();
    expect(within(getByTestId('chapter-label-1')).queryByTestId('chapter-label-active')).toBeNull();
    expect(getByText('chapter_intro')).toBeTruthy();
    expect(getByText('Main')).toBeTruthy();
  });

  it('moves the active chapter marker as playback advances', () => {
    const { getByTestId } = renderWithChapters(50);
    fireEvent.press(getByTestId('player-controls-invisible-area'));

    expect(within(getByTestId('chapter-label-1')).getByTestId('chapter-label-active')).toBeTruthy();
    expect(within(getByTestId('chapter-label-0')).queryByTestId('chapter-label-active')).toBeNull();
  });
});
