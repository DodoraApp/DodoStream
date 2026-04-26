import { FC, useState, useCallback, memo } from 'react';
import { ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation('profiles');
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
          title: t('name_required'),
          preset: 'error',
        });
        return;
      }

      const normalizedPin = pin.trim();
      if (showPin && normalizedPin.length > 0 && normalizedPin.length < 4) {
        showToast({
          title: t('invalid_pin'),
          message: t('pin_min_length'),
          preset: 'error',
        });
        return;
      }

      if (showPin && normalizedPin.length > 0 && !/^\d+$/.test(normalizedPin)) {
        showToast({
          title: t('invalid_pin'),
          message: t('pin_digits_only'),
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
      t,
    ]);

    const content = (
      <Box paddingHorizontal="l" paddingVertical="xl" gap="xl" alignItems="center">
        {/* Avatar Preview */}
        <Box alignItems="center" gap="m">
          <ProfileAvatar icon={selectedIcon} color={selectedColor} size="large" />
          <Text variant="body" color="textSecondary">
            {t('customize_avatar')}
          </Text>
        </Box>

        {/* Settings Section */}
        <Box width="100%" gap="m">
          {/* Name Input */}
          <SettingsRow label={t('name_label')} description={t('name_description')}>
            <Input
              value={name}
              onChangeText={setName}
              placeholder={t('name_placeholder')}
              maxLength={20}
              icon="person"
            />
          </SettingsRow>

          {/* PIN Input */}
          {showPin && (
            <SettingsRow label={t('pin_label')} description={t('pin_description')}>
              <Input
                value={pin}
                onChangeText={setPin}
                placeholder={t('pin_placeholder')}
                keyboardType="number-pad"
                maxLength={8}
                secureTextEntry
                icon="lock-closed"
              />
            </SettingsRow>
          )}

          {/* Icon Selection */}
          <SettingsRow
            label={t('avatar_icon_label')}
            description={t('avatar_icon_description')}>
            <IconPicker value={selectedIcon} onValueChange={setSelectedIcon} icons={AVATAR_ICONS} />
          </SettingsRow>

          {/* Color Selection */}
          <SettingsRow
            label={t('avatar_color_label')}
            description={t('avatar_color_description')}>
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
              title={
                saveButtonLabel ??
                (isEditing ? t('save_changes') : t('create_profile'))
              }
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
  const { t } = useTranslation('profiles');
  const isEditing = !!profile;

  return (
    <Modal
      visible
      onClose={onClose}
      label={isEditing ? t('edit_profile') : t('create_profile')}
      icon="person"
      animationType="slide"
      closeOnBackdropPress={false}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ProfileEditorContent profile={profile} onSave={onSave} scrollable={false} />
      </ScrollView>
    </Modal>
  );
};
