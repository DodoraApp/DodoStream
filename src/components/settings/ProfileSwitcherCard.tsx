import { forwardRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@shopify/restyle';
import { Box, Text, type Theme } from '@/theme/theme';
import { useProfileStore } from '@/store/profile.store';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { Button } from '@/components/basic/Button';
import { useRouter } from 'expo-router';

interface ProfileSwitcherCardProps {
  title?: string;
}

export const ProfileSwitcherCard = forwardRef<any, ProfileSwitcherCardProps>(
  ({ title }, ref) => {
    const { t } = useTranslation(['profiles', 'common']);
    const theme = useTheme<Theme>();
    const router = useRouter();
    const profiles = useProfileStore((state) => state.profiles);
    const activeProfileId = useProfileStore((state) => state.activeProfileId);
    const clearActiveProfile = useProfileStore((state) => state.clearActiveProfile);

    const activeProfile = useMemo(() => {
      if (!activeProfileId) return undefined;
      return profiles[activeProfileId];
    }, [activeProfileId, profiles]);

    const canSwitch = useMemo(() => Object.keys(profiles).length > 1, [profiles]);

    const handleSwitchProfile = useCallback(() => {
      clearActiveProfile();
      router.replace('/');
    }, [clearActiveProfile, router]);

    return (
      <Box gap="m">
        <Box flexDirection="row" alignItems="center" gap="m">
          <ProfileAvatar
            icon={activeProfile?.avatarIcon ?? 'person'}
            color={activeProfile?.avatarColor ?? theme.colors.primaryBackground}
            size="small"
          />
          <Box flex={1} gap="xs">
            <Text variant="cardTitle">{title || t('current_profile')}</Text>
            <Text variant="caption" color="textSecondary">
              {activeProfile?.name ?? t('common:none')}
            </Text>
          </Box>
        </Box>

        <Button
          ref={ref}
          title={t('switch_profile')}
          variant="primary"
          icon="swap-horizontal"
          onPress={handleSwitchProfile}
          disabled={!canSwitch}
        />
      </Box>
    );
  }
);

ProfileSwitcherCard.displayName = 'ProfileSwitcherCard';
