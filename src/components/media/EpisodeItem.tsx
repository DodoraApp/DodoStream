import { memo, useMemo } from 'react';
import { useTheme } from '@shopify/restyle';
import type { Theme } from '@/theme/theme';
import { Box, Text } from '@/theme/theme';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import type { MetaVideo } from '@/types/stremio';
import { PLAYBACK_FINISHED_RATIO } from '@/constants/playback';
import { ProgressBar } from '@/components/basic/ProgressBar';
import { Focusable } from '@/components/basic/Focusable';
import { useWatchHistoryStore } from '@/store/watch-history.store';
import { formatEpisodeListTitle, formatReleaseDate } from '@/utils/format';
import { getFocusableBackgroundColor } from '@/utils/focus-colors';

export interface EpisodeItemProps {
  video: MetaVideo;
  metaId: string;
  horizontal: boolean;
  onPress: () => void;
}

export const EpisodeItem = memo(({ video, metaId, horizontal, onPress }: EpisodeItemProps) => {
  const theme = useTheme<Theme>();

  const progressRatio = useWatchHistoryStore((state) => state.getProgressRatio(metaId, video.id));

  const clampedProgressRatio = Math.min(1, Math.max(0, progressRatio));
  const isFinished = clampedProgressRatio >= PLAYBACK_FINISHED_RATIO;

  const releaseLabel = useMemo(() => formatReleaseDate(video.released), [video.released]);
  const titleText = useMemo(() => formatEpisodeListTitle(video), [video]);
  const imageSource = video.thumbnail ? { uri: video.thumbnail } : undefined;

  return (
    <Focusable
      onPress={onPress}
      hasTVPreferredFocus={false}
      recyclingKey={video.id}
      variant="background"
      style={{ backgroundColor: theme.colors.cardBackground }}>
      <Box
        borderRadius="m"
        overflow="hidden"
        width={horizontal ? theme.cardSizes.episode.width : '100%'}
        flexGrow={1}>
        <Box
          height={theme.cardSizes.episode.imageHeight}
          width="100%"
          backgroundColor="cardBorder"
          position="relative">
          {imageSource ? (
            <Image
              source={imageSource}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />
          ) : null}
          <LinearGradient
            colors={['transparent', theme.colors.cardBackground]}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: 56,
            }}
          />

          {!!isFinished && (
            <Box
              position="absolute"
              padding="s"
              top={0}
              right={0}
              borderBottomLeftRadius="m"
              backgroundColor="primaryBackground">
              <Ionicons name="checkmark-circle" size={theme.sizes.iconSmall} color={theme.colors.primaryForeground} />
            </Box>
          )}

          {!isFinished && clampedProgressRatio > 0 && (
            <Box position="absolute" left={0} right={0} bottom={0}>
              <ProgressBar progress={clampedProgressRatio} height={theme.sizes.progressBarHeight} />
            </Box>
          )}
        </Box>

        <Box padding="m" gap="xs">
          <Box flexDirection="row" justifyContent="space-between" alignItems="flex-start" gap="s">
            <Text variant="cardTitle" style={{ flex: 1, flexShrink: 1 }}>
              {titleText}
            </Text>
            {releaseLabel ? (
              <Text variant="caption" color="textSecondary" style={{ flexShrink: 0 }}>
                {releaseLabel}
              </Text>
            ) : null}
          </Box>

          {video.overview ? (
            <Text variant="caption" color="textSecondary" numberOfLines={3}>
              {video.overview}
            </Text>
          ) : null}
        </Box>
      </Box>
    </Focusable>
  );
});

EpisodeItem.displayName = 'EpisodeItem';
