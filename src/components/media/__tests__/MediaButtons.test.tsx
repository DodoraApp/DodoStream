import React from 'react';

import { fireEvent } from '@testing-library/react-native';

import type { MetaDetail } from '@/types/stremio';
import { renderWithProviders } from '@/utils/test-utils';

import { MediaButtons } from '../MediaButtons';

const mockPushToStreams = jest.fn();

jest.mock('@/components/basic/Button', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories require() their mocks
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories require() their mocks
  const { Pressable, Text } = require('react-native');

  return {
    Button: ({ title, onPress }: { title?: string; onPress?: () => void }) =>
      React.createElement(
        Pressable,
        { accessibilityRole: 'button', onPress },
        React.createElement(Text, undefined, title)
      ),
  };
});

jest.mock('@/components/basic/PickerModal', () => ({ PickerModal: () => null }));
jest.mock('@/components/basic/ProgressButton', () => ({ ProgressButton: () => null }));
jest.mock('@/components/media/MyListHeaderButton', () => ({ MyListHeaderButton: () => null }));

jest.mock('@/hooks/useBreakpoint', () => ({
  useResponsiveLayout: () => ({ isTVLayout: false }),
}));

jest.mock('@/hooks/useContinueWatching', () => ({
  useContinueWatchingForMeta: () => ({ entry: undefined }),
}));

jest.mock('@/hooks/useMediaDetailsActions', () => ({
  useMediaDetailsActions: () => ({
    isVisible: false,
    items: [],
    openActions: jest.fn(),
    closeActions: jest.fn(),
    handleAction: jest.fn(),
  }),
}));

jest.mock('@/hooks/useMediaNavigation', () => ({
  useMediaNavigation: () => ({ pushToStreams: mockPushToStreams }),
}));

jest.mock('@/hooks/useMyListDb', () => ({
  useIsInMyList: () => false,
  useMyListActions: () => ({ toggleMyList: jest.fn() }),
}));

jest.mock('@/hooks/useWatchHistoryDb', () => ({
  useWatchHistoryActions: () => ({ upsert: jest.fn() }),
  useWatchHistoryItem: () => ({ data: undefined }),
  useWatchProgress: () => 0,
  useWatchState: () => 'not-started',
}));

jest.mock('@/store/toast.store', () => ({ showToast: jest.fn() }));
jest.mock('@/utils/playback', () => ({ resetProgressToStart: jest.fn() }));

const media = {
  id: 'meta-1',
  name: 'Example movie',
  type: 'movie',
  videos: [{ id: 'video-1' }],
} as MetaDetail;

describe('MediaButtons', () => {
  beforeEach(() => {
    mockPushToStreams.mockClear();
  });

  it('routes the Play action to streams', () => {
    const { getByText } = renderWithProviders(
      <MediaButtons metaId="meta-1" type="movie" media={media} />
    );

    fireEvent.press(getByText('play'));

    expect(mockPushToStreams).toHaveBeenCalledWith({
      metaId: 'meta-1',
      videoId: 'video-1',
      type: 'movie',
    });
  });
});
