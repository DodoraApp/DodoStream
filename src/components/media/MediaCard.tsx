import { memo } from 'react';
import { Box, Text } from '@/theme/theme';
import { MetaPreview } from '@/types/stremio';
import { Image } from 'expo-image';
import { useTheme } from '@shopify/restyle';
import type { Theme } from '@/theme/theme';

import { Badge } from '@/components/basic/Badge';
import { ProgressBar } from '@/components/basic/ProgressBar';
import { NO_POSTER_PORTRAIT } from '@/constants/images';
import { Focusable } from '@/components/basic/Focusable';
import { getImageSource } from '@/utils/image';
import { Pressable } from 'react-native';

interface MediaCardProps {
  media: MetaPreview;
  onPress: (media: MetaPreview) => void;
  badgeLabel?: string;
  /** Progress ratio (0-1) to show at bottom of card */
  progress?: number;
  testID?: string;
  hasTVPreferredFocus?: boolean;
  onFocused?: () => void;
}

export const MediaCard = memo(
  ({
    media,
    onPress,
    badgeLabel,
    progress,
    testID,
    hasTVPreferredFocus = false,
    onFocused,
  }: MediaCardProps) => {
    const theme = useTheme<Theme>();

    const posterSource = getImageSource(media.poster || media.background, NO_POSTER_PORTRAIT);

    // Clamp progress for display
    const clampedProgress = progress != null ? Math.min(1, Math.max(0, progress)) : undefined;
    const showProgress = clampedProgress != null && clampedProgress > 0 && clampedProgress < 1;

    return (
      <Box width={theme.cardSizes.media.width} gap="s">
        <Focusable
          onPress={() => onPress(media)}
          variant="outline"
          testID={testID}
          hasTVPreferredFocus={hasTVPreferredFocus}
          recyclingKey={media.id}
          focusedStyle={{ borderRadius: theme.borderRadii.l }}
          onFocusChange={(isFocused) => {
            if (isFocused) onFocused?.();
          }}>
          <Box
            height={theme.cardSizes.media.height}
            width={theme.cardSizes.media.width}
            borderRadius="l"
            overflow="hidden"
            backgroundColor="cardBackground"
            position="relative">
            <Image
              source={posterSource}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              recyclingKey={media.id}
            />

            {badgeLabel ? (
              <Box position="absolute" top={theme.spacing.s} right={theme.spacing.s}>
                <Badge label={badgeLabel} />
              </Box>
            ) : null}

            {showProgress ? (
              <Box position="absolute" left={0} right={0} bottom={0}>
                <ProgressBar progress={clampedProgress} height={theme.sizes.progressBarHeight} />
              </Box>
            ) : null}
          </Box>
        </Focusable>
        <Pressable onPress={() => onPress(media)} focusable={false}>
          <Text variant="cardTitle" numberOfLines={1}>
            {media.name}
          </Text>
        </Pressable>
      </Box>
    );
  }
);

MediaCard.displayName = 'MediaCard';
