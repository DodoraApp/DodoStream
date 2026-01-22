import { memo, useRef } from 'react';
import { Animated, Easing } from 'react-native';
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
import { CARD_ANIMATION_DURATION, CARD_SCALE_FOCUSED, CARD_SCALE_NORMAL } from '@/constants/media';

const AnimatedBox = Animated.createAnimatedComponent(Box);

interface ContinueWatchingCardProps {
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
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const animateFocus = (focused: boolean) => {
      Animated.timing(scaleAnim, {
        toValue: focused ? CARD_SCALE_FOCUSED : CARD_SCALE_NORMAL,
        duration: CARD_ANIMATION_DURATION,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }).start();
    };

    const { isUpNext, progressRatio, video, metaName, imageUrl, key } = entry;

    const clampedProgress = isUpNext ? 0 : Math.min(1, Math.max(0, progressRatio));
    const episodeLabel = formatSeasonEpisodeLabel(video);
    const title = metaName ?? '';
    const subtitle = formatEpisodeCardTitle(video);
    const finalImageSource = getImageSource(video?.thumbnail ?? imageUrl, NO_POSTER_LANDSCAPE);

    return (
      <Focusable
        onPress={onPress}
        onLongPress={onLongPress}
        hasTVPreferredFocus={hasTVPreferredFocus}
        testID={testID}
        onFocusChange={(isFocused) => {
          animateFocus(isFocused);
          if (isFocused) onFocused?.();
        }}>
        {() => (
          <AnimatedBox
            width={theme.cardSizes.continueWatching.width}
            gap="s"
            style={{ transform: [{ scale: scaleAnim }] }}
            shadowColor="mainForeground"
            shadowOffset={{ width: 0, height: 4 }}
            shadowOpacity={0.3}
            shadowRadius={6}
            elevation={4}>
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

              {!isUpNext && clampedProgress > 0 && clampedProgress < 1 && (
                <Box position="absolute" left={0} right={0} bottom={0}>
                  <ProgressBar
                    testID="continue-watching-progress"
                    progress={clampedProgress}
                    height={theme.sizes.progressBarHeight}
                  />
                </Box>
              )}
            </Box>

            {!hideText && (
              <Box gap="xs">
                <Text variant="cardTitle" numberOfLines={1}>
                  {title}
                </Text>
                {subtitle && (
                  <Text variant="caption" numberOfLines={1} color="textSecondary">
                    {subtitle}
                  </Text>
                )}
              </Box>
            )}
          </AnimatedBox>
        )}
      </Focusable>
    );
  }
);

ContinueWatchingCard.displayName = 'ContinueWatchingCard';
