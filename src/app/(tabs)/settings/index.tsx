import { useState, useMemo, useCallback } from 'react';
import theme, { Box, Text } from '@/theme/theme';
import { Container } from '@/components/basic/Container';
import { SettingsShell } from '@/components/settings/SettingsShell';
import { SettingsMenu } from '@/components/settings/SettingsMenu';
import { PageHeader } from '@/components/basic/PageHeader';
import { useProfileStore } from '@/store/profile.store';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { Button } from '@/components/basic/Button';
import { useResponsiveLayout } from '@/hooks/useBreakpoint';
import { SETTINGS_MENU_ITEMS } from '@/constants/settings';
import { PlaybackSettingsContent } from '@/components/settings/PlaybackSettingsContent';
import { ProfilesSettingsContent } from '@/components/settings/ProfilesSettingsContent';
import { AddonsSettingsContent } from '@/components/settings/AddonsSettingsContent';
import { IntegrationsSettingsContent } from '@/components/settings/IntegrationsSettingsContent';

export default function Settings() {
  const profiles = useProfileStore((state) => state.profiles);
  const activeProfileId = useProfileStore((state) => state.activeProfileId);
  const clearActiveProfile = useProfileStore((state) => state.clearActiveProfile);
  const { splitLayout } = useResponsiveLayout();

  const [selectedPage, setSelectedPage] = useState('playback');

  const activeProfile = useMemo(() => {
    if (!activeProfileId) return undefined;
    return profiles[activeProfileId];
  }, [activeProfileId, profiles]);

  const handleSelectPage = useCallback((id: string) => {
    setSelectedPage(id);
  }, []);

  // Render content based on selected page (for wide layout)
  const renderContent = () => {
    switch (selectedPage) {
      case 'playback':
        return <PlaybackSettingsContent />;
      case 'profiles':
        return <ProfilesSettingsContent />;
      case 'addons':
        return <AddonsSettingsContent />;
      case 'integrations':
        return <IntegrationsSettingsContent />;
      default:
        return <PlaybackSettingsContent />;
    }
  };

  // Wide layout: use SettingsShell with split view
  if (splitLayout.enabled) {
    return (
      <Container disablePadding>
        <SettingsShell
          menuItems={SETTINGS_MENU_ITEMS}
          selectedId={selectedPage}
          onSelectItem={handleSelectPage}>
          {renderContent()}
        </SettingsShell>
      </Container>
    );
  }

  // Mobile layout: show menu with links to separate pages
  return (
    <Container>
      <Box flex={1}>
        <PageHeader title="Settings" />
        <Box paddingVertical="m" gap="m">
          <Box backgroundColor="cardBackground" padding="m" borderRadius="m" gap="m">
            <Box flexDirection="row" alignItems="center" gap="m">
              <ProfileAvatar
                icon={activeProfile?.avatarIcon ?? 'person'}
                color={activeProfile?.avatarColor ?? theme.colors.primaryBackground}
                size="small"
              />
              <Box flex={1} gap="xs">
                <Text variant="cardTitle">Current Profile</Text>
                <Text variant="caption" color="textSecondary">
                  {activeProfile?.name ?? 'None'}
                </Text>
              </Box>
            </Box>
            <Button
              title="Switch Profile"
              variant="secondary"
              icon="swap-horizontal"
              onPress={() => clearActiveProfile()}
              disabled={Object.keys(profiles).length <= 1}
            />
          </Box>

          <SettingsMenu items={SETTINGS_MENU_ITEMS} selectedId="" navigationMode />
        </Box>
      </Box>
    </Container>
  );
}
