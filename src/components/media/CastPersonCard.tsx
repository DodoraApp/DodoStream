import { memo } from 'react';

import FastImage from '@d11/react-native-fast-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shopify/restyle';

import { Focusable } from '@/components/basic/Focusable';
import type { Theme } from '@/theme/theme';
import { Box, Text } from '@/theme/theme';
import type { CastMember } from '@/types/stremio';

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
            <FastImage
              source={{ uri: person.photo }}
              style={{ width: avatarSize, height: avatarSize }}
              resizeMode={FastImage.resizeMode.cover}
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
          <Text variant="caption" color="textLink" textAlign="center" numberOfLines={1}>
            {person.character}
          </Text>
        ) : null}
      </Box>
    </Box>
  );
});

CastPersonCard.displayName = 'CastPersonCard';
