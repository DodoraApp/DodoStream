import { FC, useCallback, useMemo, useState } from 'react';
import { FlashList } from '@shopify/flash-list';
import theme, { Box, Text } from '@/theme/theme';
import { ContentType, MetaVideo } from '@/types/stremio';
import { PickerInput } from '@/components/basic/PickerInput';
import { PickerItem } from '@/components/basic/PickerModal';
import { EpisodeItem } from '@/components/media/EpisodeItem';
import { useResponsiveLayout } from '@/hooks/useBreakpoint';
import { HorizontalSpacer, VerticalSpacer } from '@/components/basic/Spacer';
import FadeIn from '@/components/basic/FadeIn';
import { useContinueWatchingForMeta } from '@/hooks/useContinueWatching';

const getSeasonLabel = (season: number) => (season === 0 ? 'Specials' : `Season ${season}`);

interface EpisodeListProps {
  metaId: string;
  videos: MetaVideo[];
  onEpisodePress: (video: MetaVideo) => void;
}

interface GroupedEpisodes {
  [season: number]: MetaVideo[];
}

export const EpisodeList: FC<EpisodeListProps> = ({ metaId, videos, onEpisodePress }) => {
  const { isPlatformTV } = useResponsiveLayout();
  const isHorizontal = isPlatformTV;
  const continueWatching = useContinueWatchingForMeta(metaId, { videos });

  // Group episodes by season
  const groupedEpisodes = useMemo(() => {
    const grouped: GroupedEpisodes = {};

    videos.forEach((video) => {
      const season = video.season ?? 0;
      if (!grouped[season]) {
        grouped[season] = [];
      }
      grouped[season].push(video);
    });

    return grouped;
  }, [videos]);

  const seasons = useMemo(() => {
    return Object.keys(groupedEpisodes)
      .map(Number)
      .sort((a, b) => a - b);
  }, [groupedEpisodes]);

  const [userSelectedSeason, setUserSelectedSeason] = useState<number | undefined>(undefined);

  const selectedSeason = useMemo(() => {
    if (seasons.length === 0) return 0;

    if (userSelectedSeason !== undefined && seasons.includes(userSelectedSeason)) {
      return userSelectedSeason;
    }

    if (
      continueWatching?.video?.season !== undefined &&
      seasons.includes(continueWatching.video.season)
    ) {
      return continueWatching.video.season;
    }

    return seasons[0] ?? 0;
  }, [continueWatching, seasons, userSelectedSeason]);

  const selectedSeasonEpisodes = groupedEpisodes[selectedSeason] ?? [];

  const seasonItems = useMemo<PickerItem<number>[]>(() => {
    return Array.isArray(seasons)
      ? seasons.map((season) => ({ label: getSeasonLabel(season), value: season }))
      : [];
  }, [seasons]);

  const initialScrollIndex = useMemo(() => {
    if (!continueWatching?.video?.episode) return 0;
    return Math.max(continueWatching.video.episode - 1, 0);
  }, [continueWatching]);

  const handleSeasonChange = useCallback((value: number) => {
    setUserSelectedSeason(value);
  }, []);

  if (seasons.length === 0) {
    return null;
  }

  return (
    <Box gap="m">
      <FadeIn>
        <Box
          flexDirection="row"
          gap="m"
          justifyContent={isHorizontal ? undefined : 'space-between'}
          alignItems="center">
          <Text variant="subheader">Episodes</Text>
          {seasons.length > 1 && (
            <PickerInput
              label="Select Season"
              items={seasonItems}
              selectedValue={selectedSeason}
              onValueChange={handleSeasonChange}
              selectedLabel={getSeasonLabel(selectedSeason)}
            />
          )}
        </Box>
      </FadeIn>

      <FadeIn>
        <FlashList<MetaVideo>
          data={selectedSeasonEpisodes}
          horizontal={isHorizontal}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialScrollIndex}
          renderItem={({ item }) => (
            <EpisodeItem
              metaId={metaId}
              video={item}
              onPress={() => onEpisodePress(item)}
              horizontal={isHorizontal}
            />
          )}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => (isHorizontal ? <HorizontalSpacer /> : <VerticalSpacer />)}
        />
      </FadeIn>
    </Box>
  );
};
