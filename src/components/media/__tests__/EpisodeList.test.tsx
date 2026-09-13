import * as mockReact from 'react';
import { ScrollView, View as mockView } from 'react-native';

import { useContinueWatchingForMeta } from '@/hooks/useContinueWatching';
import type { MetaVideo } from '@/types/stremio';
import { renderWithProviders } from '@/utils/test-utils';

import { EpisodeList } from '../EpisodeList';

jest.mock('@/hooks/useBreakpoint', () => ({
  useResponsiveLayout: () => ({ isTVLayout: false }),
}));

jest.mock('@/hooks/useContinueWatching', () => ({
  useContinueWatchingForMeta: jest.fn(),
}));

jest.mock('@/components/basic/FadeIn', () => ({
  __esModule: true,
  default: ({ children }: { children: mockReact.ReactNode }) => children,
}));

jest.mock('@/components/basic/PickerInput', () => ({
  PickerInput: () => null,
}));

jest.mock('@/components/media/EpisodeItem', () => ({
  EpisodeItem: ({ testID, hasTVPreferredFocus, isCurrentEpisode }: any) =>
    mockReact.createElement(mockView, { testID, hasTVPreferredFocus, isCurrentEpisode } as any),
}));

jest.mock('@/components/media/MediaSectionHeader', () => ({
  MediaSectionHeader: () => null,
}));

const mockUseContinueWatchingForMeta = useContinueWatchingForMeta as jest.MockedFunction<
  typeof useContinueWatchingForMeta
>;

const seasonOneEpisode = { id: 'season-1-episode', season: 1, title: 'Season 1' } as MetaVideo;
const specialEpisode = { id: 'special-episode', title: 'Special' } as MetaVideo;
const videos = [
  seasonOneEpisode,
  { id: 'special-first', title: 'Special 1' } as MetaVideo,
  specialEpisode,
];

const renderEpisodeList = (props: Partial<mockReact.ComponentProps<typeof EpisodeList>> = {}) =>
  renderWithProviders(
    <EpisodeList
      metaId="series-1"
      videos={videos}
      onEpisodePress={() => {}}
      layout="vertical"
      {...props}
    />
  );

describe('EpisodeList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseContinueWatchingForMeta.mockReturnValue({ entry: undefined, isLoading: false });
  });

  it('selects Specials and scrolls to the current episode when its season is missing', () => {
    const { UNSAFE_getByType, getByTestId, queryByTestId } = renderEpisodeList({
      currentVideoId: specialEpisode.id,
    });

    expect(UNSAFE_getByType(ScrollView).props.initialScrollIndex).toBe(1);
    expect(getByTestId(`episode-${specialEpisode.id}`).props.hasTVPreferredFocus).toBe(true);
    expect(getByTestId(`episode-${specialEpisode.id}`).props.isCurrentEpisode).toBe(true);
    expect(queryByTestId(`episode-${seasonOneEpisode.id}`)).toBeNull();
  });

  it('selects Specials and scrolls to the continue-watching episode when its season is missing', () => {
    mockUseContinueWatchingForMeta.mockReturnValue({
      entry: { videoId: specialEpisode.id, video: specialEpisode } as any,
      isLoading: false,
    });

    const { UNSAFE_getByType, getByTestId, queryByTestId } = renderEpisodeList();

    expect(UNSAFE_getByType(ScrollView).props.initialScrollIndex).toBe(1);
    expect(getByTestId(`episode-${specialEpisode.id}`)).toBeTruthy();
    expect(queryByTestId(`episode-${seasonOneEpisode.id}`)).toBeNull();
  });
});
