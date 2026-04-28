import { FC, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LegendList } from '@legendapp/list/react-native';

import FadeIn from '@/components/basic/FadeIn';
import { PickerInput } from '@/components/basic/PickerInput';
import { PickerItem } from '@/components/basic/PickerModal';
import { HorizontalSpacer, VerticalSpacer } from '@/components/basic/Spacer';
import { EpisodeItem } from '@/components/media/EpisodeItem';
import { MediaSectionHeader } from '@/components/media/MediaSectionHeader';
import { useResponsiveLayout } from '@/hooks/useBreakpoint';
import { useContinueWatchingForMeta } from '@/hooks/useContinueWatching';
import { Box } from '@/theme/theme';
import { MetaVideo } from '@/types/stremio';

interface EpisodeListProps {
  metaId: string;
  videos: MetaVideo[];
  onEpisodePress: (video: MetaVideo) => void;
  onEpisodeLongPress?: (video: MetaVideo) => void;
}

interface GroupedEpisodes {
  [season: number]: MetaVideo[];
}

export const EpisodeList: FC<EpisodeListProps> = ({
  metaId,
  videos,
  onEpisodePress,
  onEpisodeLongPress,
}) => {
  const { t } = useTranslation('media');
  const { isPlatformTV } = useResponsiveLayout();
  const isHorizontal = isPlatformTV;
  const { entry: continueWatching } = useContinueWatchingForMeta(metaId, { videos });

  const getSeasonLabel = useCallback(
    (season: number) => (season === 0 ? t('specials') : t('season', { number: season })),
    [t]
  );

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

  // Get unique seasons in order they appear (videos are already sorted with season 0 last)
  const seasons = useMemo(() => {
    const seen = new Set<number>();
    const result: number[] = [];
    for (const video of videos) {
      const season = video.season ?? 0;
      if (!seen.has(season)) {
        seen.add(season);
        result.push(season);
      }
    }
    return result;
  }, [videos]);

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
  }, [getSeasonLabel, seasons]);

  const initialScrollIndex = useMemo(() => {
    if (!continueWatching?.video?.episode) return 0;
    return Math.max(continueWatching.video.episode - 1, 0);
  }, [continueWatching]);

  const handleSeasonChange = useCallback((value: number) => {
    setUserSelectedSeason(value);
  }, []);

  const handleEpisodePress = useCallback(
    (video: MetaVideo) => {
      onEpisodePress(video);
    },
    [onEpisodePress]
  );

  const renderItem = useCallback(
    ({ item }: { item: MetaVideo }) => (
      <EpisodeItem
        metaId={metaId}
        video={item}
        onPress={() => handleEpisodePress(item)}
        onLongPress={onEpisodeLongPress ? () => onEpisodeLongPress(item) : undefined}
        horizontal={isHorizontal}
      />
    ),
    [metaId, handleEpisodePress, onEpisodeLongPress, isHorizontal]
  );

  const keyExtractor = useCallback((item: MetaVideo) => item.id, []);

  const Separator = isHorizontal ? HorizontalSpacer : VerticalSpacer;

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
          <MediaSectionHeader title={t('episodes')} />
          {seasons.length > 1 && (
            <PickerInput
              label={t('select_season')}
              items={seasonItems}
              selectedValue={selectedSeason}
              onValueChange={handleSeasonChange}
              selectedLabel={getSeasonLabel(selectedSeason)}
            />
          )}
        </Box>
      </FadeIn>

      <FadeIn>
        <LegendList<MetaVideo>
          data={selectedSeasonEpisodes}
          horizontal={isHorizontal}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialScrollIndex}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ItemSeparatorComponent={Separator}
        />
      </FadeIn>
    </Box>
  );
};
