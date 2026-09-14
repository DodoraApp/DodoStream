import * as mockReact from 'react';
import { ScrollView, View as mockView } from 'react-native';

import {
  type ContinueWatchingEntry,
  useContinueWatchingForMeta,
} from '@/hooks/useContinueWatching';
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
const getContinueWatchingEntry = (video: MetaVideo): ContinueWatchingEntry => ({
  key: `series-1::${video.id}`,
  type: 'series',
  metaId: 'series-1',
  videoId: video.id,
  progressSeconds: 0,
  durationSeconds: 1,
  progressRatio: 0,
  lastWatchedAt: 0,
  isUpNext: true,
  video,
});

const seasonOneEpisode = { id: 'season-1-episode', season: 1, title: 'Season 1' } as MetaVideo;
const specialEpisode = { id: 'special-episode', title: 'Special' } as MetaVideo;
const videos = [
  seasonOneEpisode,
  { id: 'special-first', title: 'Special 1' } as MetaVideo,
  specialEpisode,
];
const seasonFourEpisodes = [
  { id: 'season-4-episode-1', season: 4, title: 'Season 4 Episode 1' },
  { id: 'season-4-episode-2', season: 4, title: 'Season 4 Episode 2' },
  { id: 'season-4-episode-3', season: 4, title: 'Season 4 Episode 3' },
] as MetaVideo[];
const seasonFiveEpisode = {
  id: 'season-5-episode-1',
  season: 5,
  title: 'Season 5 Episode 1',
} as MetaVideo;

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
      entry: getContinueWatchingEntry(specialEpisode),
      isLoading: false,
    });

    const { UNSAFE_getByType, getByTestId, queryByTestId } = renderEpisodeList();

    expect(UNSAFE_getByType(ScrollView).props.initialScrollIndex).toBe(1);
    expect(getByTestId(`episode-${specialEpisode.id}`)).toBeTruthy();
    expect(queryByTestId(`episode-${seasonOneEpisode.id}`)).toBeNull();
  });
  it('resets the dataset when continue watching advances to a shorter next season', () => {
    const episodeListProps = {
      videos: [...seasonFourEpisodes, seasonFiveEpisode],
      onEpisodePress: jest.fn(),
      layout: 'vertical' as const,
    };

    mockUseContinueWatchingForMeta.mockReturnValue({
      entry: getContinueWatchingEntry(seasonFourEpisodes[2]),
      isLoading: false,
    });

    const { UNSAFE_getByType, getByTestId, queryByTestId, rerender } =
      renderEpisodeList(episodeListProps);
    const list = UNSAFE_getByType(ScrollView);

    expect(getByTestId(`episode-${seasonFourEpisodes[2].id}`)).toBeTruthy();
    expect(queryByTestId(`episode-${seasonFiveEpisode.id}`)).toBeNull();
    expect(list.props.initialScrollIndex).toBe(2);
    expect(list.props.dataKey).toBe('series-1:4');

    mockUseContinueWatchingForMeta.mockReturnValue({
      entry: getContinueWatchingEntry(seasonFiveEpisode),
      isLoading: false,
    });

    rerender(<EpisodeList metaId="series-1" {...episodeListProps} />);

    expect(getByTestId(`episode-${seasonFiveEpisode.id}`)).toBeTruthy();
    expect(queryByTestId(`episode-${seasonFourEpisodes[0].id}`)).toBeNull();
    expect(queryByTestId(`episode-${seasonFourEpisodes[1].id}`)).toBeNull();
    expect(queryByTestId(`episode-${seasonFourEpisodes[2].id}`)).toBeNull();
    expect(UNSAFE_getByType(ScrollView).props.initialScrollIndex).toBe(0);
    expect(UNSAFE_getByType(ScrollView).props.dataKey).toBe('series-1:5');
  });
});
