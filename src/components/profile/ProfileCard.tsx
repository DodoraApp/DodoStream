import { FC } from 'react';
import { Box, Text, Theme } from '@/theme/theme';
import { ProfileAvatar } from './ProfileAvatar';
import { Profile } from '@/store/profile.store';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shopify/restyle';
import { Focusable } from '@/components/basic/Focusable';
import { getFocusableBackgroundColor } from '@/utils/focus-colors';

interface ProfileCardProps {
  profile?: Profile; // undefined for "Add Profile" card
  onPress: () => void;
  isAddCard?: boolean;
}

export const ProfileCard: FC<ProfileCardProps> = ({ profile, onPress, isAddCard = false }) => {
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
            <Box
              width={80}
              height={80}
              borderRadius="full"
              backgroundColor="mainBackground"
              justifyContent="center"
              alignItems="center"
              style={{
                borderWidth: 2,
                borderColor: theme.colors.primaryBackground,
                borderStyle: 'dashed',
              }}>
              <Ionicons name="add" size={48} color={theme.colors.primaryBackground} />
            </Box>
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
              size={16}
              color={theme.colors.textSecondary}
              style={{ marginTop: -8 }}
            />
          )}
        </Box>
      )}
    </Focusable>
  );
};
