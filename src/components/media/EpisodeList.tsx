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

export interface EpisodeListProps {
  metaId: string;
  videos: MetaVideo[];
  currentVideoId?: string;
  onEpisodePress: (video: MetaVideo) => void;
  onEpisodeLongPress?: (video: MetaVideo) => void;
  /** When true, the list sizes to its content and centers vertically (overlay usage). */
  centered?: boolean;
  /** When false, the "Episodes" section title is hidden (overlay header already shows it). Default true. */
  showTitle?: boolean;
  /** Defaults to the platform layout. Player rails force a vertical list. */
  layout?: 'auto' | 'horizontal' | 'vertical';
}

interface GroupedEpisodes {
  [season: number]: MetaVideo[];
}

export const EpisodeList: FC<EpisodeListProps> = ({
  metaId,
  videos,
  currentVideoId,
  onEpisodePress,
  onEpisodeLongPress,
  centered = false,
  showTitle = true,
  layout = 'auto',
}) => {
  const { t } = useTranslation('media');
  const { isTVLayout } = useResponsiveLayout();
  const isHorizontal = layout === 'auto' ? isTVLayout : layout === 'horizontal';
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

    const currentEpisode = videos.find((video) => video.id === currentVideoId);
    if (currentEpisode) {
      const currentSeason = currentEpisode.season ?? 0;
      if (seasons.includes(currentSeason)) {
        return currentSeason;
      }
    }

    const continueWatchingEpisode = continueWatching?.video;
    if (continueWatchingEpisode) {
      const continueWatchingSeason = continueWatchingEpisode.season ?? 0;
      if (seasons.includes(continueWatchingSeason)) {
        return continueWatchingSeason;
      }
    }

    return seasons[0] ?? 0;
  }, [continueWatching, currentVideoId, seasons, userSelectedSeason, videos]);

  const selectedSeasonEpisodes = useMemo(
    () => groupedEpisodes[selectedSeason] ?? [],
    [groupedEpisodes, selectedSeason]
  );

  const seasonItems = useMemo<PickerItem<number>[]>(() => {
    return Array.isArray(seasons)
      ? seasons.map((season) => ({ label: getSeasonLabel(season), value: season }))
      : [];
  }, [getSeasonLabel, seasons]);

  const initialScrollIndex = useMemo(() => {
    const targetVideoId = currentVideoId ?? continueWatching?.videoId;
    if (!targetVideoId) return 0;

    const index = selectedSeasonEpisodes.findIndex((video) => video.id === targetVideoId);
    return Math.max(index, 0);
  }, [continueWatching?.videoId, currentVideoId, selectedSeasonEpisodes]);

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
        testID={`episode-${item.id}`}
        hasTVPreferredFocus={item.id === currentVideoId}
        isCurrentEpisode={item.id === currentVideoId}
      />
    ),
    [metaId, handleEpisodePress, onEpisodeLongPress, isHorizontal, currentVideoId]
  );

  const keyExtractor = useCallback((item: MetaVideo) => item.id, []);

  const Separator = isHorizontal ? HorizontalSpacer : VerticalSpacer;

  if (seasons.length === 0) {
    return null;
  }

  return (
    <Box flex={1} gap="m">
      {(showTitle || seasons.length > 1) && (
        <FadeIn>
          <Box
            flexDirection="row"
            gap="m"
            justifyContent={isHorizontal ? undefined : 'space-between'}
            alignItems="center">
            {showTitle && <MediaSectionHeader title={t('episodes')} />}
            {seasons.length > 1 && (
              <PickerInput
                label={t('select_season')}
                items={seasonItems}
                selectedValue={selectedSeason}
                onValueChange={handleSeasonChange}
                selectedLabel={getSeasonLabel(selectedSeason)}
                testID="settings-picker-season"
              />
            )}
          </Box>
        </FadeIn>
      )}

      <FadeIn style={centered ? { flex: 1, justifyContent: 'center' } : { flex: 1 }}>
        <LegendList<MetaVideo>
          data={selectedSeasonEpisodes}
          dataKey={`${metaId}:${selectedSeason}`}
          horizontal={isHorizontal}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialScrollIndex}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ItemSeparatorComponent={Separator}
          // ScrollView grows by default (flexGrow: 1), which pins content to the
          // top; in centered mode it must size to content so centering applies.
          style={centered ? { flexGrow: 0, flexShrink: 1 } : undefined}
        />
      </FadeIn>
    </Box>
  );
};
