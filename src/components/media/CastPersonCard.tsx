import { memo } from 'react';
import { useTheme } from '@shopify/restyle';
import type { Theme } from '@/theme/theme';
import { Box, Text } from '@/theme/theme';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import type { CastMember } from '@/types/stremio';
import { Focusable } from '@/components/basic/Focusable';

interface CastPersonCardProps {
  person: CastMember;
  onPress: () => void;
  recyclingKey?: string;
}

export const CastPersonCard = memo(({ person, onPress, recyclingKey }: CastPersonCardProps) => {
  const theme = useTheme<Theme>();
  const avatarSize = theme.cardSizes.avatar.size;

  return (
    <Box width={avatarSize + theme.spacing.m * 2} alignItems="center" gap="s">
      <Focusable
        onPress={onPress}
        variant="outline"
        focusedStyle={{ borderRadius: avatarSize / 2 + theme.focus.borderWidth }}>
        <Box
          width={avatarSize}
          height={avatarSize}
          borderRadius="full"
          overflow="hidden"
          backgroundColor="cardBackground"
          alignItems="center"
          justifyContent="center">
          {person.photo ? (
            <Image
              source={{ uri: person.photo }}
              style={{ width: avatarSize, height: avatarSize }}
              contentFit="cover"
              recyclingKey={recyclingKey ?? person.name}
            />
          ) : (
            <Ionicons name="person" size={avatarSize / 2} color={theme.colors.textSecondary} />
          )}
        </Box>
      </Focusable>

      <Box gap="xs" alignItems="center">
        <Text variant="caption" color="textPrimary" textAlign="center" numberOfLines={2}>
          {person.name}
        </Text>

        {person.character ? (
          <Text variant="caption" color="textSecondary" textAlign="center" numberOfLines={1}>
            {person.character}
          </Text>
        ) : null}
      </Box>
    </Box>
  );
});

CastPersonCard.displayName = 'CastPersonCard';
