import { memo } from 'react';
import { Image } from 'expo-image';
import { Box, Text } from '@/theme/theme';
import { useTheme } from '@shopify/restyle';
import type { Theme } from '@/theme/theme';

import { Badge } from '@/components/basic/Badge';
import { NO_POSTER_LANDSCAPE } from '@/constants/images';
import { Focusable } from '@/components/basic/Focusable';
import { ProgressBar } from '@/components/basic/ProgressBar';
import { getImageSource } from '@/utils/image';
import { type ContinueWatchingEntry } from '@/hooks/useContinueWatching';
import { formatSeasonEpisodeLabel, formatEpisodeCardTitle } from '@/utils/format';
import { Pressable } from 'react-native';

interface ContinueWatchingCardProps {
  /** The continue watching entry to display */
  entry: ContinueWatchingEntry;
  hideText?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  onFocused?: () => void;
  hasTVPreferredFocus?: boolean;
  testID?: string;
}

export const ContinueWatchingCard = memo(
  ({
    entry,
    hideText,
    onPress,
    onLongPress,
    onFocused,
    hasTVPreferredFocus = false,
    testID,
  }: ContinueWatchingCardProps) => {
    const theme = useTheme<Theme>();

    const { isUpNext, progressRatio, video, metaName, imageUrl, key } = entry;

    // Derive display values
    const clampedProgress = isUpNext ? 0 : Math.min(1, Math.max(0, progressRatio));
    const episodeLabel = formatSeasonEpisodeLabel(video);
    const title = metaName ?? '';
    const subtitle = formatEpisodeCardTitle(video);
    const finalImageSource = getImageSource(video?.thumbnail ?? imageUrl, NO_POSTER_LANDSCAPE);

    return (
      <Box width={theme.cardSizes.continueWatching.width} gap="s">
        <Focusable
          onPress={onPress}
          onLongPress={onLongPress}
          onFocus={() => onFocused?.()}
          hasTVPreferredFocus={hasTVPreferredFocus}
          variant="outline"
          focusedStyle={{ borderRadius: theme.borderRadii.l }}
          testID={testID}>
          <Box
            height={theme.cardSizes.continueWatching.height}
            width={theme.cardSizes.continueWatching.width}
            borderRadius="l"
            overflow="hidden"
            backgroundColor="cardBackground"
            position="relative">
            <Image
              source={finalImageSource}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              recyclingKey={key}
            />

            <Box
              position="absolute"
              top={theme.spacing.s}
              right={theme.spacing.s}
              flexDirection="row"
              gap="s">
              {isUpNext && <Badge label="UP NEXT" variant="tertiary" />}
              {episodeLabel && <Badge label={episodeLabel} />}
            </Box>

            {!isUpNext && clampedProgress > 0 && clampedProgress < 1 ? (
              <Box position="absolute" left={0} right={0} bottom={0}>
                <ProgressBar
                  testID="continue-watching-progress"
                  progress={clampedProgress}
                  height={theme.sizes.progressBarHeight}
                />
              </Box>
            ) : null}
          </Box>
        </Focusable>

        {!hideText && (
          <Pressable onPress={onPress} onLongPress={onLongPress} focusable={false}>
            <Box gap="xs">
              <Text variant="cardTitle" numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? (
                <Text variant="caption" numberOfLines={1} color="textSecondary">
                  {subtitle}
                </Text>
              ) : null}
            </Box>
          </Pressable>
        )}
      </Box>
    );
  }
);

ContinueWatchingCard.displayName = 'ContinueWatchingCard';
