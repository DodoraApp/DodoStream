import { FC, memo } from 'react';
import { useTheme } from '@shopify/restyle';
import { Box, Text, Theme } from '@/theme/theme';
import { ProfileAvatar } from './ProfileAvatar';
import { Profile } from '@/store/profile.store';
import { Ionicons } from '@expo/vector-icons';
import { Focusable } from '@/components/basic/Focusable';
import { getFocusableBackgroundColor } from '@/utils/focus-colors';

interface ProfileCardProps {
  profile?: Profile; // undefined for "Add Profile" card
  onPress: () => void;
  isAddCard?: boolean;
}

export const ProfileCard: FC<ProfileCardProps> = memo(({ profile, onPress, isAddCard = false }) => {
  const theme = useTheme<Theme>();

  if (isAddCard) {
    return (
      <Focusable onPress={onPress}>
        {({ isFocused }) => (
          <Box
            width={theme.cardSizes.profile.width}
            height={theme.cardSizes.profile.height}
            backgroundColor={getFocusableBackgroundColor({ isFocused })}
            borderRadius="l"
            justifyContent="center"
            alignItems="center"
            gap="m">
            <ProfileAvatar icon="add" color={theme.colors.secondaryBackground} size="medium" />
            <Text variant="body" color="textSecondary" textAlign="center">
              Add Profile
            </Text>
          </Box>
        )}
      </Focusable>
    );
  }

  if (!profile) return null;

  return (
    <Focusable onPress={onPress}>
      {({ isFocused }) => (
        <Box
          width={theme.cardSizes.profile.width}
          height={theme.cardSizes.profile.height}
          backgroundColor={getFocusableBackgroundColor({ isFocused })}
          borderRadius="l"
          justifyContent="center"
          alignItems="center"
          gap="m"
          paddingHorizontal="s">
          <ProfileAvatar
            icon={profile.avatarIcon || 'person'}
            color={profile.avatarColor || theme.colors.primaryBackground}
            size="medium"
          />
          <Text
            variant="body"
            color="mainForeground"
            textAlign="center"
            numberOfLines={2}
            style={{ fontWeight: '600' }}>
            {profile.name}
          </Text>
          {profile.pin && (
            <Ionicons
              name="lock-closed"
              size={theme.sizes.iconSmall}
              color={theme.colors.textSecondary}
              style={{ marginTop: -theme.spacing.s }}
            />
          )}
        </Box>
      )}
    </Focusable>
  );
});

ProfileCard.displayName = 'ProfileCard';
