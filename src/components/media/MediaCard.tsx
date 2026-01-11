import { memo, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { Box, Text } from '@/theme/theme';
import { MetaPreview } from '@/types/stremio';
import { Image } from 'expo-image';
import { useTheme } from '@shopify/restyle';
import type { Theme } from '@/theme/theme';

import { Badge } from '@/components/basic/Badge';
import { NO_POSTER_PORTRAIT } from '@/constants/images';
import { Focusable } from '@/components/basic/Focusable';
import { getImageSource } from '@/utils/image';
import { CARD_ANIMATION_DURATION, CARD_SCALE_FOCUSED, CARD_SCALE_NORMAL } from '@/constants/media';

const AnimatedBox = Animated.createAnimatedComponent(Box);

interface MediaCardProps {
  media: MetaPreview;
  onPress: (media: MetaPreview) => void;
  badgeLabel?: string;
  testID?: string;
  hasTVPreferredFocus?: boolean;
  onFocused?: () => void;
}

export const MediaCard = memo(
  ({
    media,
    onPress,
    badgeLabel,
    testID,
    hasTVPreferredFocus = false,
    onFocused,
  }: MediaCardProps) => {
    const theme = useTheme<Theme>();
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const posterSource = getImageSource(media.poster || media.background, NO_POSTER_PORTRAIT);

    const animateFocus = (focused: boolean) => {
      Animated.timing(scaleAnim, {
        toValue: focused ? CARD_SCALE_FOCUSED : CARD_SCALE_NORMAL,
        duration: CARD_ANIMATION_DURATION,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }).start();
    };

    return (
      <Focusable
        onPress={() => onPress(media)}
        testID={testID}
        hasTVPreferredFocus={hasTVPreferredFocus}
        recyclingKey={media.id}
        onFocusChange={(isFocused) => {
          animateFocus(isFocused);
          if (isFocused) onFocused?.();
        }}>
        {() => (
          <AnimatedBox
            width={theme.cardSizes.media.width}
            gap="s"
            style={{ transform: [{ scale: scaleAnim }] }}
            shadowColor="mainForeground"
            shadowOffset={{ width: 0, height: 4 }}
            shadowOpacity={0.3}
            shadowRadius={6}
            elevation={4}>
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

              {badgeLabel && (
                <Box position="absolute" top={theme.spacing.s} right={theme.spacing.s}>
                  <Badge label={badgeLabel} />
                </Box>
              )}
            </Box>
            <Text variant="cardTitle" numberOfLines={1}>
              {media.name}
            </Text>
          </AnimatedBox>
        )}
      </Focusable>
    );
  }
);

MediaCard.displayName = 'MediaCard';
