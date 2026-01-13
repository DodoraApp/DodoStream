import { FC, memo, useState, useCallback, useMemo } from 'react';
import { ScrollView } from 'react-native-gesture-handler';
import theme, { Box, Text } from '@/theme/theme';
import { useProfileStore, Profile } from '@/store/profile.store';
import { Button } from '@/components/basic/Button';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { ProfileEditor } from '@/components/profile/ProfileEditor';
import { PINPrompt } from '@/components/profile/PINPrompt';
import { showToast } from '@/store/toast.store';
import { TOAST_DURATION_SHORT } from '@/constants/ui';
import { useRouter } from 'expo-router';
import { SettingsCard } from '@/components/settings/SettingsCard';

/**
 * Profiles settings content component
 * Extracted for use in both standalone page and split layout
 */
export const ProfilesSettingsContent: FC = memo(() => {
  const profiles = useProfileStore((state) => state.profiles);
  const activeProfileId = useProfileStore((state) => state.activeProfileId);
  const switchProfile = useProfileStore((state) => state.switchProfile);
  const deleteProfile = useProfileStore((state) => state.deleteProfile);
  const router = useRouter();

  const [editingProfile, setEditingProfile] = useState<Profile | undefined>();
  const [showEditor, setShowEditor] = useState(false);

  const [pendingSwitch, setPendingSwitch] = useState<Profile | undefined>();
  const [pinInput, setPinInput] = useState('');

  const profileList = useMemo(() => Object.values(profiles), [profiles]);

  const beginSwitch = useCallback(
    (profile: Profile) => {
      if (profile.id === activeProfileId) return;

      if (profile.pin) {
        setPendingSwitch(profile);
        setPinInput('');
        return;
      }

      switchProfile(profile.id);
      showToast({
        title: 'Profile switched',
        message: profile.name,
        preset: 'success',
        duration: TOAST_DURATION_SHORT,
      });
      router.replace('/');
    },
    [activeProfileId, router, switchProfile]
  );

  const confirmSwitchWithPin = useCallback(() => {
    if (!pendingSwitch) return;

    const ok = switchProfile(pendingSwitch.id, pinInput);
    if (!ok) {
      showToast({
        title: 'Wrong PIN',
        preset: 'error',
      });
      return;
    }

    showToast({
      title: 'Profile switched',
      message: pendingSwitch.name,
      preset: 'success',
      duration: TOAST_DURATION_SHORT,
    });
    setPendingSwitch(undefined);
    setPinInput('');
    router.replace('/');
  }, [pendingSwitch, pinInput, router, switchProfile]);

  const handleDelete = useCallback(
    (profile: Profile) => {
      if (profile.id === activeProfileId) {
        showToast({
          title: 'Cannot delete active profile',
          preset: 'error',
        });
        return;
      }

      deleteProfile(profile.id);
      showToast({
        title: 'Profile deleted',
        message: profile.name,
        preset: 'success',
        duration: TOAST_DURATION_SHORT,
      });
    },
    [activeProfileId, deleteProfile]
  );

  return (
    <>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Box padding="m" gap="m">
          <SettingsCard title="Manage Profiles">
            <Text variant="caption" color="textSecondary">
              Switch, edit, or delete profiles. Playback settings and My List are per-profile.
            </Text>
            <Button
              title="Add Profile"
              icon="add"
              onPress={() => {
                setEditingProfile(undefined);
                setShowEditor(true);
              }}
            />
          </SettingsCard>
          <Text variant="subheader">Profiles</Text>

          {profileList.map((profile) => {
            const isActive = profile.id === activeProfileId;
            return (
              <Box
                key={profile.id}
                backgroundColor="cardBackground"
                padding="m"
                borderRadius="m"
                gap="m">
                <Box flexDirection="row" alignItems="center" gap="m">
                  <ProfileAvatar
                    icon={profile.avatarIcon ?? 'person'}
                    color={profile.avatarColor ?? theme.colors.primaryBackground}
                    size="small"
                  />
                  <Box flex={1} gap="xs">
                    <Text variant="cardTitle">
                      {profile.name}
                      {isActive ? ' (Active)' : ''}
                    </Text>
                    {profile.pin ? (
                      <Text variant="caption" color="textSecondary">
                        PIN protected
                      </Text>
                    ) : (
                      <Text variant="caption" color="textSecondary">
                        No PIN
                      </Text>
                    )}
                  </Box>
                </Box>

                <Box flexDirection="row" gap="s" alignSelf="flex-end">
                  <Button
                    variant="secondary"
                    icon="swap-horizontal"
                    disabled={isActive}
                    onPress={() => beginSwitch(profile)}
                    style={{ flex: 1 }}
                  />
                  <Button
                    variant="secondary"
                    icon="create-outline"
                    onPress={() => {
                      setEditingProfile(profile);
                      setShowEditor(true);
                    }}
                    style={{ flex: 1 }}
                  />
                  <Button
                    variant="tertiary"
                    icon="trash-outline"
                    disabled={isActive}
                    onPress={() => handleDelete(profile)}
                    style={{ flex: 1 }}
                  />
                </Box>
              </Box>
            );
          })}
        </Box>
      </ScrollView>

      {showEditor && (
        <ProfileEditor
          profile={editingProfile}
          onClose={() => setShowEditor(false)}
          onSave={() => setShowEditor(false)}
        />
      )}

      <PINPrompt
        visible={!!pendingSwitch}
        title={`Enter PIN for ${pendingSwitch?.name ?? ''}`}
        value={pinInput}
        onChangeText={setPinInput}
        onCancel={() => {
          setPendingSwitch(undefined);
          setPinInput('');
        }}
        onSubmit={confirmSwitchWithPin}
      />
    </>
  );
});
