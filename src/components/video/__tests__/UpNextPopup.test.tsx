import * as mockReact from 'react';
import React from 'react';
import { View as mockView } from 'react-native';

import { act } from '@testing-library/react-native';

import {
  UPNEXT_POPUP_INACTIVE_DELAY_MS,
  UPNEXT_POPUP_MOVIE_RATIO,
  UPNEXT_POPUP_SERIES_RATIO,
} from '@/constants/playback';
import { renderWithProviders } from '@/utils/test-utils';

import { UpNextPopup, UpNextPopupProps } from '../UpNextPopup';

let mockMotiProps: Record<string, unknown> | undefined;
let mockCardProps: Record<string, unknown> | undefined;
let mockButtonProps: Record<string, unknown> | undefined;

jest.mock('moti', () => ({
  MotiView: (props: Record<string, unknown>) => {
    mockMotiProps = props;
    return mockReact.createElement(
      mockView,
      { testID: 'up-next-popup' },
      props.children as React.ReactNode
    );
  },
}));

jest.mock('@/components/media/ContinueWatchingCard', () => ({
  ContinueWatchingCard: (props: Record<string, unknown>) => {
    mockCardProps = props;
    return mockReact.createElement(mockView, { testID: 'up-next-card' });
  },
}));

jest.mock('@/components/basic/Button', () => ({
  Button: (props: Record<string, unknown>) => {
    mockButtonProps = props;
    return mockReact.createElement(mockView, { testID: 'up-next-dismiss' });
  },
}));
jest.mock('@/utils/debug', () => ({ createDebugLogger: () => jest.fn() }));

jest.mock('@/hooks/useContinueWatching', () => ({
  useNextVideo: (videos: { id: string }[] | undefined, currentVideoId: string | undefined) => {
    if (!videos || !currentVideoId) return undefined;
    const currentIndex = videos.findIndex((video) => video.id === currentVideoId);
    return currentIndex >= 0 ? videos[currentIndex + 1] : undefined;
  },
}));

const videos = [
  { id: 'episode-1', title: 'Episode 1', season: 1, episode: 1, released: '2024-01-01' },
  { id: 'episode-2', title: 'Episode 2', season: 1, episode: 2, released: '2024-01-08' },
];

const createProps = (overrides: Partial<UpNextPopupProps> = {}): UpNextPopupProps => ({
  enabled: true,
  metaId: 'series-1',
  mediaType: 'series',
  videoId: 'episode-1',
  videos,
  mediaImageUrl: 'https://images.example/series.jpg',
  mediaTitle: 'Series title',
  progressRatio: UPNEXT_POPUP_SERIES_RATIO,
  dismissed: false,
  autoplayCancelled: false,
  controlsVisible: false,
  onCancelAutoplay: jest.fn(),
  onDismiss: jest.fn(),
  onPlayNext: jest.fn(),
  onUpNextResolved: jest.fn(),
  onVisibilityChange: jest.fn(),
  ...overrides,
});

const renderPopup = (overrides: Partial<UpNextPopupProps> = {}) => {
  const props = createProps(overrides);
  return {
    ...renderWithProviders(<UpNextPopup {...props} />),
    props,
  };
};

describe('UpNextPopup', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockMotiProps = undefined;
    mockCardProps = undefined;
    mockButtonProps = undefined;
  });

  afterEach(() => {
    act(() => {
      jest.clearAllTimers();
    });
    jest.useRealTimers();
  });

  it.each([
    ['before the series threshold', { progressRatio: UPNEXT_POPUP_SERIES_RATIO - 0.001 }],
    ['when disabled', { enabled: false }],
    ['after dismissal', { dismissed: true }],
    ['after autoplay is cancelled', { autoplayCancelled: true }],
    ['without a current episode', { videoId: undefined }],
  ])('stays hidden %s', (_description, overrides) => {
    const { queryByTestId, props } = renderPopup(overrides);

    expect(queryByTestId('up-next-popup')).toBeNull();
    expect(props.onVisibilityChange).toHaveBeenLastCalledWith(false);
  });

  it('stays hidden without a next released episode', () => {
    const { queryByTestId, props } = renderPopup({ videos: [videos[0]] });

    expect(queryByTestId('up-next-popup')).toBeNull();
    expect(props.onVisibilityChange).toHaveBeenLastCalledWith(false);
  });

  it('uses different thresholds for movies and series', () => {
    const { queryByTestId, rerender } = renderPopup({ progressRatio: UPNEXT_POPUP_MOVIE_RATIO });

    expect(queryByTestId('up-next-popup')).toBeNull();

    rerender(
      <UpNextPopup
        {...createProps({ mediaType: 'movie', progressRatio: UPNEXT_POPUP_MOVIE_RATIO })}
      />
    );

    expect(queryByTestId('up-next-popup')).toBeTruthy();
  });

  it('resolves the next episode once, then clears the resolved episode when disabled', () => {
    const onUpNextResolved = jest.fn();
    const { rerender } = renderPopup({ onUpNextResolved });

    expect(onUpNextResolved).toHaveBeenCalledWith(
      expect.objectContaining({
        videoId: 'episode-2',
        title: 'Episode 2',
        imageUrl: 'https://images.example/series.jpg',
      })
    );
    expect(onUpNextResolved).toHaveBeenCalledTimes(1);

    rerender(<UpNextPopup {...createProps({ onUpNextResolved })} />);
    expect(onUpNextResolved).toHaveBeenCalledTimes(1);

    rerender(<UpNextPopup {...createProps({ enabled: false, onUpNextResolved })} />);
    expect(onUpNextResolved).toHaveBeenLastCalledWith(undefined);
  });

  it('sends the complete next episode entry to the card and starts it on press', () => {
    const onPlayNext = jest.fn();
    renderPopup({ onPlayNext });

    expect(mockCardProps).toEqual(
      expect.objectContaining({
        entry: expect.objectContaining({
          metaId: 'series-1',
          videoId: 'episode-2',
          type: 'series',
          isUpNext: true,
          progressRatio: 0,
        }),
        hasTVPreferredFocus: true,
      })
    );

    const onPress = mockCardProps?.onPress;
    if (typeof onPress !== 'function')
      throw new Error('Up Next card did not receive an onPress handler');

    act(() => {
      onPress();
    });

    expect(onPlayNext).toHaveBeenCalledTimes(1);
  });

  it('cancels autoplay and dismisses together from the close control', () => {
    const onCancelAutoplay = jest.fn();
    const onDismiss = jest.fn();
    renderPopup({ onCancelAutoplay, onDismiss });
    const onPress = mockButtonProps?.onPress;
    if (typeof onPress !== 'function') {
      throw new Error('Up Next dismiss button did not receive an onPress handler');
    }

    act(() => {
      onPress();
    });

    expect(onCancelAutoplay).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('becomes inactive only while controls remain hidden and restores active state on interaction', () => {
    const { rerender } = renderPopup();

    expect(mockMotiProps).toEqual(
      expect.objectContaining({ animate: expect.objectContaining({ opacity: 1, scale: 1 }) })
    );

    act(() => {
      jest.advanceTimersByTime(UPNEXT_POPUP_INACTIVE_DELAY_MS);
    });

    expect(mockMotiProps).toEqual(
      expect.objectContaining({ animate: expect.objectContaining({ opacity: 0.3, scale: 0.6 }) })
    );
    expect(mockCardProps).toEqual(expect.objectContaining({ hasTVPreferredFocus: false }));

    rerender(<UpNextPopup {...createProps({ controlsVisible: true })} />);

    expect(mockMotiProps).toEqual(
      expect.objectContaining({ animate: expect.objectContaining({ opacity: 1, scale: 1 }) })
    );
    expect(mockCardProps).toEqual(expect.objectContaining({ hasTVPreferredFocus: false }));
  });

  it('cancels a pending inactivity timer when the popup disappears', () => {
    const { rerender, queryByTestId } = renderPopup();

    rerender(<UpNextPopup {...createProps({ dismissed: true })} />);
    act(() => {
      jest.advanceTimersByTime(UPNEXT_POPUP_INACTIVE_DELAY_MS);
    });

    expect(queryByTestId('up-next-popup')).toBeNull();
  });
});
