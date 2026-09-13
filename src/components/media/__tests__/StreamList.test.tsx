import * as mockReact from 'react';
import React from 'react';
import { View as mockView } from 'react-native';

import { act, fireEvent } from '@testing-library/react-native';

import * as streamsApi from '@/api/stremio';
import * as mediaNavigation from '@/hooks/useMediaNavigation';
import { getStreamStableId } from '@/utils/stream';
import { renderWithProviders } from '@/utils/test-utils';

import { StreamList } from '../StreamList';

let mockLegendProps: Record<string, any> | undefined;
let mockTagFiltersProps: Record<string, any> | undefined;
let mockIsTVLayout = false;

jest.mock('@/api/stremio');
jest.mock('@/hooks/useMediaNavigation', () => ({ useMediaNavigation: jest.fn() }));
jest.mock('@/hooks/useBreakpoint', () => ({
  useResponsiveLayout: () => ({ isTVLayout: mockIsTVLayout }),
}));
jest.mock('@/components/basic/FadeIn', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/components/basic/Focusable', () => ({
  Focusable: ({ children, disabled, onPress, ...props }: Record<string, any>) =>
    mockReact.createElement(
      mockView,
      { ...props, disabled, onPress: disabled ? undefined : onPress } as React.ComponentProps<
        typeof mockView
      >,
      children({ isFocused: false })
    ),
}));
jest.mock('@/components/basic/TagFilters', () => ({
  TagFilters: (props: Record<string, any>) => {
    mockTagFiltersProps = props;
    return mockReact.createElement(mockView, { testID: 'stream-tag-filters' });
  },
}));
jest.mock('@/components/basic/LoadingQuery', () => ({
  LoadingQuery: ({ children, data, isEmpty, isError, isLoading }: Record<string, any>) => {
    if (isLoading) return mockReact.createElement(mockView, { testID: 'stream-loading' });
    if (isError) return mockReact.createElement(mockView, { testID: 'stream-error' });
    if (isEmpty(data)) return mockReact.createElement(mockView, { testID: 'stream-empty' });
    return children(data);
  },
}));
jest.mock('@legendapp/list/react-native', () => ({
  LegendList: (props: Record<string, any>) => {
    mockLegendProps = props;
    return mockReact.createElement(
      mockView,
      { testID: 'stream-legend-list' },
      props.data.map((item: any, index: number) =>
        mockReact.createElement(
          mockReact.Fragment,
          { key: props.keyExtractor(item) },
          props.renderItem({ item, index })
        )
      )
    );
  },
}));
jest.mock('@/utils/debug', () => ({ createDebugLogger: () => jest.fn() }));

const playable = {
  addonId: 'addon-a',
  name: 'Primary stream',
  url: 'https://cdn.example/primary.m3u8',
};
const alternative = {
  addonId: 'addon-b',
  name: 'Alternative stream',
  url: 'https://cdn.example/alternative.m3u8',
};
const external = {
  addonId: 'addon-b',
  name: 'External stream',
  externalUrl: 'https://browser.example/watch',
};
const unavailable = {
  addonId: 'addon-c',
  name: 'Unavailable stream',
  infoHash: 'hash-only',
};

describe('StreamList selection', () => {
  let streams: any[];
  let openStreamFromStream: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLegendProps = undefined;
    mockTagFiltersProps = undefined;
    mockIsTVLayout = false;
    streams = [playable, alternative, external, unavailable];
    openStreamFromStream = jest.fn();
    (mediaNavigation.useMediaNavigation as jest.Mock).mockReturnValue({ openStreamFromStream });
    (streamsApi.useStreams as jest.Mock).mockImplementation(() => ({
      data: streams,
      isLoading: false,
      isError: false,
      allResults: [],
      addons: [
        { id: 'addon-b', name: 'Bravo', manifestUrl: 'https://addons.example/b' },
        { id: 'addon-a', name: 'Alpha', manifestUrl: 'https://addons.example/a' },
      ],
    }));
  });

  it('forwards the complete playback context for a playable stream', () => {
    const { getByTestId } = renderWithProviders(
      <StreamList
        type="series"
        id="series-1"
        videoId="episode-2"
        title="Series S1E2"
        backgroundImage="https://images.example/background.jpg"
        logoImage="https://images.example/logo.png"
      />
    );

    fireEvent.press(getByTestId(`stream-${getStreamStableId(playable as any)}`));

    expect(openStreamFromStream).toHaveBeenCalledWith({
      metaId: 'series-1',
      videoId: 'episode-2',
      type: 'series',
      title: 'Series S1E2',
      backgroundImage: 'https://images.example/background.jpg',
      logoImage: 'https://images.example/logo.png',
      stream: playable,
      navigation: 'push',
    });
  });

  it('uses the player override rather than navigating from the stream list', () => {
    const onSelectOverride = jest.fn();
    const { getByTestId } = renderWithProviders(
      <StreamList type="movie" id="movie-1" onSelectOverride={onSelectOverride} />
    );

    fireEvent.press(getByTestId(`stream-${getStreamStableId(external as any)}`));

    expect(onSelectOverride).toHaveBeenCalledWith(external);
    expect(openStreamFromStream).not.toHaveBeenCalled();
  });

  it('never invokes navigation or an override for a stream without an openable target', () => {
    const onSelectOverride = jest.fn();
    const { getByTestId } = renderWithProviders(
      <StreamList type="movie" id="movie-1" onSelectOverride={onSelectOverride} />
    );

    const unavailableItem = getByTestId(`stream-${getStreamStableId(unavailable as any)}`);
    fireEvent.press(unavailableItem);

    expect(onSelectOverride).not.toHaveBeenCalled();
    expect(openStreamFromStream).not.toHaveBeenCalled();
  });

  it('highlights and scrolls to the stable selected stream even when its URL changed', () => {
    const selectedStreamId = getStreamStableId(alternative as any);
    const { getByTestId } = renderWithProviders(
      <StreamList
        type="movie"
        id="movie-1"
        selectedStreamId={selectedStreamId}
        selectedStreamUrl="https://stale.example/old-url.m3u8"
      />
    );

    expect(getByTestId(`stream-${selectedStreamId}`).props.hasTVPreferredFocus).toBe(true);
    expect(
      getByTestId(`stream-${getStreamStableId(playable as any)}`).props.hasTVPreferredFocus
    ).toBe(false);
    expect(mockLegendProps).toEqual(expect.objectContaining({ initialScrollIndex: 1 }));
  });

  it('supports encoded legacy URL selection only when no stable ID is available', () => {
    const encoded = { addonId: 'addon-a', url: 'https://cdn.example/current%20stream.m3u8' };
    streams = [playable, encoded];

    const { getByTestId } = renderWithProviders(
      <StreamList
        type="movie"
        id="movie-1"
        selectedStreamUrl="https://cdn.example/current stream.m3u8"
      />
    );

    expect(
      getByTestId(`stream-${getStreamStableId(encoded as any)}`).props.hasTVPreferredFocus
    ).toBe(true);
    expect(mockLegendProps).toEqual(expect.objectContaining({ initialScrollIndex: 1 }));
  });

  it('filters stream choices by addon without losing the active selection identity', () => {
    const { getByTestId, queryByTestId } = renderWithProviders(
      <StreamList
        type="movie"
        id="movie-1"
        selectedStreamId={getStreamStableId(alternative as any)}
      />
    );

    const tagFiltersProps = mockTagFiltersProps;
    if (!tagFiltersProps) throw new Error('Tag filters did not render');

    expect(tagFiltersProps.options).toEqual([
      expect.objectContaining({ id: 'addon-a', label: 'Alpha' }),
      expect.objectContaining({ id: 'addon-b', label: 'Bravo' }),
    ]);

    act(() => {
      tagFiltersProps.onSelectId('addon-a');
    });

    expect(getByTestId(`stream-${getStreamStableId(playable as any)}`)).toBeTruthy();
    expect(queryByTestId(`stream-${getStreamStableId(alternative as any)}`)).toBeNull();
  });

  it('renders partial stream results while other addons are still loading', () => {
    (streamsApi.useStreams as jest.Mock).mockReturnValue({
      data: [playable],
      isLoading: true,
      isError: false,
      allResults: [{ isLoading: false }, { isLoading: true }],
      addons: [],
    });

    const { getByTestId, queryByTestId } = renderWithProviders(
      <StreamList type="movie" id="movie-1" />
    );

    expect(getByTestId(`stream-${getStreamStableId(playable as any)}`)).toBeTruthy();
    expect(queryByTestId('stream-loading')).toBeNull();
  });

  it('uses the requested player layout rather than the platform default', () => {
    mockIsTVLayout = true;
    const { rerender } = renderWithProviders(
      <StreamList type="movie" id="movie-1" layout="vertical" centered autoFocus={false} />
    );

    expect(mockLegendProps).toEqual(
      expect.objectContaining({ horizontal: false, style: { flexGrow: 0, flexShrink: 1 } })
    );

    rerender(<StreamList type="movie" id="movie-1" layout="horizontal" />);

    expect(mockLegendProps).toEqual(expect.objectContaining({ horizontal: true }));
  });
});
