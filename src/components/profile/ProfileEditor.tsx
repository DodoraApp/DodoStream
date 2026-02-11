import { FC, useState, useCallback, memo } from 'react';
import { ScrollView } from 'react-native';
import { useTheme } from '@shopify/restyle';
import { Box, Text, Theme } from '@/theme/theme';
import { ProfileAvatar } from './ProfileAvatar';
import { useProfileStore, Profile } from '@/store/profile.store';
import { Button } from '@/components/basic/Button';
import { Input } from '@/components/basic/Input';
import { Modal } from '@/components/basic/Modal';
import { ColorPicker } from '@/components/basic/ColorPicker';
import { IconPicker } from '@/components/basic/IconPicker';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { AVATAR_ICONS, AVATAR_COLORS } from '@/constants/profiles';
import { showToast } from '@/store/toast.store';

export interface ProfileEditorContentProps {
  /** Existing profile to edit, or undefined for creating new profile */
  profile?: Profile;
  /** Called when save is successful with the profile ID */
  onSave: (profileId: string) => void;
  /** Whether to show the PIN input field (default: true) */
  showPin?: boolean;
  /** Whether to show the save button (default: true) */
  showSaveButton?: boolean;
  /** Custom label for save button */
  saveButtonLabel?: string;
  /** Whether to wrap content in ScrollView (default: true) */
  scrollable?: boolean;
}

/**
 * Profile editor form content - reusable for modal and wizard contexts
 */
export const ProfileEditorContent: FC<ProfileEditorContentProps> = memo(
  ({
    profile,
    onSave,
    showPin = true,
    showSaveButton = true,
    saveButtonLabel,
    scrollable = true,
  }) => {
    const theme = useTheme<Theme>();
    const createProfile = useProfileStore((state) => state.createProfile);
    const updateProfile = useProfileStore((state) => state.updateProfile);

    const [name, setName] = useState(profile?.name || '');
    const [selectedIcon, setSelectedIcon] = useState(profile?.avatarIcon || 'person');
    const [selectedColor, setSelectedColor] = useState(
      profile?.avatarColor || theme.colors.primaryBackground
    );
    const [pin, setPin] = useState(profile?.pin ?? '');

    const isEditing = !!profile;

    const handleSave = useCallback(() => {
      if (!name.trim()) {
        showToast({
          title: 'Profile name required',
          preset: 'error',
        });
        return;
      }

      const normalizedPin = pin.trim();
      if (showPin && normalizedPin.length > 0 && normalizedPin.length < 4) {
        showToast({
          title: 'Invalid PIN',
          message: 'PIN must be at least 4 digits',
          preset: 'error',
        });
        return;
      }

      if (showPin && normalizedPin.length > 0 && !/^\d+$/.test(normalizedPin)) {
        showToast({
          title: 'Invalid PIN',
          message: 'PIN can only contain digits',
          preset: 'error',
        });
        return;
      }

      if (isEditing) {
        updateProfile(profile.id, {
          name: name.trim(),
          avatarIcon: selectedIcon,
          avatarColor: selectedColor,
          pin: showPin && normalizedPin.length > 0 ? normalizedPin : undefined,
        });
        onSave(profile.id);
      } else {
        const newProfileId = createProfile(name.trim(), {
          avatarIcon: selectedIcon,
          avatarColor: selectedColor,
          pin: showPin && normalizedPin.length > 0 ? normalizedPin : undefined,
        });
        onSave(newProfileId);
      }
    }, [
      name,
      pin,
      selectedIcon,
      selectedColor,
      showPin,
      isEditing,
      profile,
      createProfile,
      updateProfile,
      onSave,
    ]);

    const content = (
      <Box paddingHorizontal="l" paddingVertical="xl" gap="xl" alignItems="center">
        {/* Avatar Preview */}
        <Box alignItems="center" gap="m">
          <ProfileAvatar icon={selectedIcon} color={selectedColor} size="large" />
          <Text variant="body" color="textSecondary">
            Customize your avatar
          </Text>
        </Box>

        {/* Settings Section */}
        <Box width="100%" gap="m">
          {/* Name Input */}
          <SettingsRow label="Profile Name" description="Enter a name for this profile">
            <Input
              value={name}
              onChangeText={setName}
              placeholder="Enter name"
              maxLength={20}
              icon="person"
            />
          </SettingsRow>

          {/* PIN Input */}
          {showPin && (
            <SettingsRow label="PIN (optional)" description="4+ digits to protect this profile">
              <Input
                value={pin}
                onChangeText={setPin}
                placeholder="4+ digits"
                keyboardType="number-pad"
                maxLength={8}
                secureTextEntry
                icon="lock-closed"
              />
            </SettingsRow>
          )}

          {/* Icon Selection */}
          <SettingsRow label="Avatar Icon" description="Choose an icon for your profile">
            <IconPicker value={selectedIcon} onValueChange={setSelectedIcon} icons={AVATAR_ICONS} />
          </SettingsRow>

          {/* Color Selection */}
          <SettingsRow label="Avatar Color" description="Choose a background color">
            <ColorPicker
              value={selectedColor}
              onValueChange={setSelectedColor}
              colors={AVATAR_COLORS}
            />
          </SettingsRow>
        </Box>

        {/* Save Button */}
        {showSaveButton && (
          <Box width="100%" marginTop="m">
            <Button
              title={saveButtonLabel ?? (isEditing ? 'Save Changes' : 'Create Profile')}
              onPress={handleSave}
              disabled={!name.trim()}
            />
          </Box>
        )}
      </Box>
    );

    if (scrollable) {
      return <ScrollView showsVerticalScrollIndicator={false}>{content}</ScrollView>;
    }

    return content;
  }
);

ProfileEditorContent.displayName = 'ProfileEditorContent';

interface ProfileEditorProps {
  profile?: Profile;
  onClose: () => void;
  onSave: (profileId: string) => void;
}

/**
 * Profile editor modal - wraps ProfileEditorContent in a Modal
 */
export const ProfileEditor: FC<ProfileEditorProps> = ({ profile, onClose, onSave }) => {
  const isEditing = !!profile;

  return (
    <Modal
      visible
      onClose={onClose}
      label={isEditing ? 'Edit Profile' : 'Create Profile'}
      icon="person"
      animationType="slide"
      closeOnBackdropPress={false}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ProfileEditorContent profile={profile} onSave={onSave} scrollable={false} />
      </ScrollView>
    </Modal>
  );
};
