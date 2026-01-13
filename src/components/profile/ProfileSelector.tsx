import { FC, useState, useCallback } from 'react';
import { ScrollView } from 'react-native';
import { Box, Text, Theme } from '@/theme/theme';
import { ProfileCard } from './ProfileCard';
import { ProfileEditor } from './ProfileEditor';
import { PINPrompt } from './PINPrompt';
import { useProfileStore, Profile } from '@/store/profile.store';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@shopify/restyle';
import { MotiView } from 'moti';
import { Easing } from 'react-native-reanimated';
import { PROFILE_EXIT_ANIMATION_MS } from '@/constants/ui';

import { showToast } from '@/store/toast.store';

interface ProfileSelectorProps {
  onSelect: () => void;
}

export const ProfileSelector: FC<ProfileSelectorProps> = ({ onSelect }) => {
  const theme = useTheme<Theme>();
  const profiles = useProfileStore((state) => state.getProfilesList());
  const switchProfile = useProfileStore((state) => state.switchProfile);
  const [showEditor, setShowEditor] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | undefined>(undefined);
  const [showPINPrompt, setShowPINPrompt] = useState(false);
  const [selectedProfileForPIN, setSelectedProfileForPIN] = useState<Profile | undefined>(
    undefined
  );
  const [pinInput, setPinInput] = useState('');
  const [isExiting, setIsExiting] = useState(false);

  const triggerExit = useCallback(
    (profileId: string) => {
      setIsExiting(true);
      setTimeout(() => {
        const success = switchProfile(profileId);
        if (success) {
          onSelect();
        } else {
          setIsExiting(false);
        }
      }, PROFILE_EXIT_ANIMATION_MS);
    },
    [switchProfile, onSelect]
  );

  const handleProfileSelect = useCallback(
    (profileId: string) => {
      const profile = profiles.find((p) => p.id === profileId);

      // If profile has PIN, show PIN prompt
      if (profile?.pin) {
        setSelectedProfileForPIN(profile);
        setPinInput('');
        setShowPINPrompt(true);
        return;
      }

      // Trigger exit animation then switch
      triggerExit(profileId);
    },
    [profiles, triggerExit]
  );

  const handlePINSubmit = useCallback(() => {
    if (!selectedProfileForPIN) return;
    // Check PIN first before triggering exit
    const success = switchProfile(selectedProfileForPIN.id, pinInput);
    if (success) {
      // PIN was correct, now undo the switch and do exit animation
      // Actually, switchProfile already switched, so we proceed
      setShowPINPrompt(false);
      setSelectedProfileForPIN(undefined);
      setPinInput('');
      // Trigger exit animation
      setIsExiting(true);
      setTimeout(() => {
        onSelect();
      }, PROFILE_EXIT_ANIMATION_MS);
      return;
    }

    showToast({
      title: 'Wrong PIN',
      preset: 'error',
    });
  }, [selectedProfileForPIN, switchProfile, pinInput, onSelect]);

  const handlePINCancel = useCallback(() => {
    setShowPINPrompt(false);
    setSelectedProfileForPIN(undefined);
    setPinInput('');
  }, []);

  const handleAddProfile = useCallback(() => {
    setEditingProfile(undefined);
    setShowEditor(true);
  }, []);

  const handleEditorClose = useCallback(() => {
    setShowEditor(false);
    setEditingProfile(undefined);
  }, []);

  const handleEditorSave = useCallback(
    (profileId: string) => {
      setShowEditor(false);
      setEditingProfile(undefined);
      // Auto-select the newly created profile
      if (profileId) {
        handleProfileSelect(profileId);
      }
    },
    [handleProfileSelect]
  );

  if (showEditor) {
    return (
      <ProfileEditor
        profile={editingProfile}
        onClose={handleEditorClose}
        onSave={handleEditorSave}
      />
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.mainBackground }}>
      <MotiView
        from={{ opacity: 1, translateY: 0 }}
        animate={{
          opacity: isExiting ? 0 : 1,
          translateY: isExiting ? 100 : 0,
        }}
        transition={{
          type: 'timing',
          duration: PROFILE_EXIT_ANIMATION_MS,
          easing: Easing.in(Easing.cubic),
        }}
        style={{ flex: 1 }}>
        <Box flex={1} backgroundColor="mainBackground" justifyContent="center" alignItems="center">
          <Box width="100%" maxWidth={800} paddingHorizontal="l">
            <Box marginBottom="xl" alignItems="center">
              <Text
                variant="header"
                color="mainForeground"
                textAlign="center"
                style={{ fontSize: 48, fontWeight: '700' }}>
                Who&apos;s watching?
              </Text>
            </Box>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: 24,
                paddingVertical: 16,
              }}>
              {profiles.map((profile) => (
                <ProfileCard
                  key={profile.id}
                  profile={profile}
                  onPress={() => handleProfileSelect(profile.id)}
                />
              ))}
              <ProfileCard isAddCard onPress={handleAddProfile} />
            </ScrollView>
          </Box>
        </Box>
      </MotiView>

      <PINPrompt
        visible={showPINPrompt}
        title={`Enter PIN for ${selectedProfileForPIN?.name ?? ''}`}
        value={pinInput}
        onChangeText={setPinInput}
        onSubmit={handlePINSubmit}
        onCancel={handlePINCancel}
      />
    </SafeAreaView>
  );
};
