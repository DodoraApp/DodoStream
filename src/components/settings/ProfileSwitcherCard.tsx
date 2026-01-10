import { FC, memo, useCallback, useMemo } from 'react';
import theme, { Box, Text } from '@/theme/theme';
import { useProfileStore } from '@/store/profile.store';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { Button } from '@/components/basic/Button';
import { useRouter } from 'expo-router';

interface ProfileSwitcherCardProps {
  title?: string;
}

export const ProfileSwitcherCard: FC<ProfileSwitcherCardProps> = memo(
  ({ title = 'Current Profile' }) => {
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
            <Text variant="cardTitle">{title}</Text>
            <Text variant="caption" color="textSecondary">
              {activeProfile?.name ?? 'None'}
            </Text>
          </Box>
        </Box>

        <Button
          title="Switch Profile"
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
