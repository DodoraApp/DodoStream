import { FC, memo } from 'react';
import { useTranslation } from 'react-i18next';

import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shopify/restyle';

import { Focusable } from '@/components/basic/Focusable';
import { Profile } from '@/store/profile.store';
import { Box, Text, Theme } from '@/theme/theme';
import { getFocusableBackgroundColor } from '@/utils/focus-colors';

import { ProfileAvatar } from './ProfileAvatar';

interface ProfileCardProps {
  profile?: Profile; // undefined for "Add Profile" card
  onPress: () => void;
  isAddCard?: boolean;
}

export const ProfileCard: FC<ProfileCardProps> = memo(({ profile, onPress, isAddCard = false }) => {
  const { t } = useTranslation('profiles');
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
              {t('add_profile')}
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
