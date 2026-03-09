import { memo } from 'react';
import { useTheme } from '@shopify/restyle';
import type { Theme } from '@/theme/theme';
import { Box, Text } from '@/theme/theme';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Focusable } from '@/components/basic/Focusable';

interface TrailerCardProps {
  trailer: { title: string; ytId: string; lang?: string };
  onPress: () => void;
  recyclingKey?: string;
}

export const TrailerCard = memo(({ trailer, onPress, recyclingKey }: TrailerCardProps) => {
  const theme = useTheme<Theme>();
  const { width, height } = theme.cardSizes.continueWatching;

  const thumbnailUrl = `https://img.youtube.com/vi/${trailer.ytId}/hqdefault.jpg`;

  return (
    <Box width={width} gap="s">
      <Focusable
        onPress={onPress}
        variant="outline"
        focusedStyle={{ borderRadius: theme.borderRadii.l }}>
        <Box
          height={height}
          width={width}
          borderRadius="l"
          overflow="hidden"
          backgroundColor="cardBackground"
          position="relative">
          <Image
            source={{ uri: thumbnailUrl }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            recyclingKey={recyclingKey ?? trailer.ytId}
          />

          {/* Play icon overlay */}
          <Box
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            alignItems="center"
            justifyContent="center">
            <Box
              width={theme.sizes.iconXLarge}
              height={theme.sizes.iconXLarge}
              borderRadius="full"
              backgroundColor="semiTransparentBackground"
              alignItems="center"
              justifyContent="center">
              <Ionicons
                name="play"
                size={theme.sizes.iconMedium}
                color={theme.colors.textPrimary}
              />
            </Box>
          </Box>
        </Box>
      </Focusable>

      <Text variant="caption" numberOfLines={1}>
        {trailer.title}
        {trailer.lang ? ` (${trailer.lang.toUpperCase()})` : ''}
      </Text>
    </Box>
  );
});

TrailerCard.displayName = 'TrailerCard';
