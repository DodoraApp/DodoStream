import { FC, useState, useCallback, memo } from 'react';
import { Modal, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Box, Text, Theme } from '@/theme/theme';
import { ProfileAvatar } from './ProfileAvatar';
import { useProfileStore, Profile } from '@/store/profile.store';
import { Button } from '@/components/basic/Button';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@shopify/restyle';

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

        {/* Name Input */}
        <Box width="100%" maxWidth={400} gap="s">
          <Text variant="body" color="mainForeground" style={{ fontWeight: '600' }}>
            Profile Name
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Enter name"
            placeholderTextColor={theme.colors.textPlaceholder}
            maxLength={20}
            style={{
              backgroundColor: theme.colors.inputBackground,
              color: theme.colors.textPrimary,
              padding: 16,
              borderRadius: 12,
              fontSize: 16,
              borderWidth: 1,
              borderColor: theme.colors.cardBorder,
            }}
          />
        </Box>

        {/* PIN Input */}
        {showPin && (
          <Box width="100%" maxWidth={400} gap="s">
            <Text variant="body" color="mainForeground" style={{ fontWeight: '600' }}>
              PIN (optional)
            </Text>
            <TextInput
              value={pin}
              onChangeText={setPin}
              placeholder="4+ digits"
              placeholderTextColor={theme.colors.textPlaceholder}
              keyboardType="number-pad"
              maxLength={8}
              secureTextEntry
              style={{
                backgroundColor: theme.colors.inputBackground,
                color: theme.colors.textPrimary,
                padding: 16,
                borderRadius: 12,
                fontSize: 16,
                borderWidth: 1,
                borderColor: theme.colors.cardBorder,
              }}
            />
            <Text variant="caption" color="textSecondary">
              Leave empty for no PIN
            </Text>
          </Box>
        )}

        {/* Icon Selection */}
        <Box width="100%" maxWidth={500} gap="s">
          <Text variant="body" color="mainForeground" style={{ fontWeight: '600' }}>
            Choose Icon
          </Text>
          <Box
            flexDirection="row"
            flexWrap="wrap"
            gap="m"
            justifyContent="center"
            backgroundColor="cardBackground"
            padding="m"
            borderRadius="l">
            {AVATAR_ICONS.map((icon) => (
              <TouchableOpacity
                key={icon}
                onPress={() => setSelectedIcon(icon)}
                style={{
                  padding: 8,
                  borderRadius: 12,
                  backgroundColor:
                    selectedIcon === icon
                      ? theme.colors.primaryBackground
                      : theme.colors.transparent,
                }}>
                <Ionicons name={icon as any} size={32} color={theme.colors.mainForeground} />
              </TouchableOpacity>
            ))}
          </Box>
        </Box>

        {/* Color Selection */}
        <Box width="100%" maxWidth={500} gap="s">
          <Text variant="body" color="mainForeground" style={{ fontWeight: '600' }}>
            Choose Color
          </Text>
          <Box
            flexDirection="row"
            flexWrap="wrap"
            gap="m"
            justifyContent="center"
            backgroundColor="cardBackground"
            padding="m"
            borderRadius="l">
            {AVATAR_COLORS.map((color) => (
              <TouchableOpacity
                key={color}
                onPress={() => setSelectedColor(color)}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: color,
                  borderWidth: selectedColor === color ? 3 : 0,
                  borderColor: theme.colors.mainForeground,
                }}
              />
            ))}
          </Box>
        </Box>

        {/* Save Button */}
        {showSaveButton && (
          <Box width="100%" maxWidth={400} marginTop="m">
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
 * Profile editor modal - wraps ProfileEditorContent in a full-screen modal
 */
export const ProfileEditor: FC<ProfileEditorProps> = ({ profile, onClose, onSave }) => {
  const theme = useTheme<Theme>();
  const isEditing = !!profile;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.mainBackground }}>
        <Box flex={1} backgroundColor="mainBackground">
          {/* Header */}
          <Box
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            paddingHorizontal="l"
            paddingVertical="m">
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={32} color={theme.colors.mainForeground} />
            </TouchableOpacity>
            <Text variant="subheader" color="mainForeground">
              {isEditing ? 'Edit Profile' : 'Create Profile'}
            </Text>
            {/* Spacer for centering */}
            <Box width={32} />
          </Box>

          <ProfileEditorContent profile={profile} onSave={onSave} />
        </Box>
      </SafeAreaView>
    </Modal>
  );
};
