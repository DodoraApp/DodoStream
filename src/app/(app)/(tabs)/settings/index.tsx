import { useState, useCallback } from 'react';
import { ScrollView } from 'react-native';
import { Box, Text } from '@/theme/theme';
import { Container } from '@/components/basic/Container';
import { SettingsShell } from '@/components/settings/SettingsShell';
import { SettingsMenu } from '@/components/settings/SettingsMenu';
import { PageHeader } from '@/components/basic/PageHeader';
import { useResponsiveLayout } from '@/hooks/useBreakpoint';
import { SETTINGS_GLOBAL_MENU_ITEMS, SETTINGS_PROFILE_MENU_ITEMS } from '@/constants/settings';
import { PlaybackSettingsContent } from '@/components/settings/PlaybackSettingsContent';
import { ProfilesSettingsContent } from '@/components/settings/ProfilesSettingsContent';
import { AddonsSettingsContent } from '@/components/settings/AddonsSettingsContent';
import { AboutSettingsContent } from '@/components/settings/AboutSettingsContent';
import { SubtitlesSettingsContent } from '@/components/settings/SubtitlesSettingsContent';
import { HomeSettingsContent } from '@/components/settings/HomeSettingsContent';
import { ProfileSwitcherCard } from '@/components/settings/ProfileSwitcherCard';
import { SettingsLink } from '@/components/settings/SettingsLink';

export default function Settings() {
  const { splitLayout } = useResponsiveLayout();

  const [selectedPage, setSelectedPage] = useState('playback');

  const handleSelectPage = useCallback((id: string) => {
    setSelectedPage(id);
  }, []);

  // Render content based on selected page (for wide layout)
  const renderContent = () => {
    switch (selectedPage) {
      case 'home':
        return <HomeSettingsContent />;
      case 'playback':
        return <PlaybackSettingsContent />;
      case 'subtitles':
        return <SubtitlesSettingsContent />;
      case 'profiles':
        return <ProfilesSettingsContent />;
      case 'addons':
        return <AddonsSettingsContent />;
      case 'about':
        return <AboutSettingsContent />;
      default:
        return <PlaybackSettingsContent />;
    }
  };

  // Wide layout: use SettingsShell with split view
  if (splitLayout.enabled) {
    return (
      <Container disablePadding>
        <SettingsShell
          menu={
            <ScrollView showsVerticalScrollIndicator={false}>
              <Box gap="m" paddingHorizontal="s">
                <Text variant="subheader">Settings</Text>
                <ProfileSwitcherCard />

                <Text variant="sectionLabel">Profile</Text>
                <SettingsMenu
                  items={SETTINGS_PROFILE_MENU_ITEMS}
                  selectedId={selectedPage}
                  onSelect={handleSelectPage}
                  scrollable={false}
                />

                <Text variant="sectionLabel">Global</Text>
                <SettingsMenu
                  items={SETTINGS_GLOBAL_MENU_ITEMS}
                  selectedId={selectedPage}
                  onSelect={handleSelectPage}
                  scrollable={false}
                />
              </Box>
            </ScrollView>
          }>
          {renderContent()}
        </SettingsShell>
      </Container>
    );
  }

  // Mobile layout: show menu with links to separate pages
  return (
    <Container safeAreaEdges={['left', 'right', 'top']}>
      <Box flex={1}>
        <PageHeader title="Settings" />
        <ScrollView showsVerticalScrollIndicator={false}>
          <Box paddingVertical="m" gap="m">
            <Text variant="sectionLabel">Profile</Text>
            <ProfileSwitcherCard />

            <Box gap="s">
              {SETTINGS_PROFILE_MENU_ITEMS.map((item) => (
                <SettingsLink
                  key={item.id}
                  title={item.title}
                  description={item.description}
                  icon={item.icon}
                  href={item.href ?? '/settings'}
                />
              ))}
            </Box>

            <Text variant="sectionLabel">Global</Text>
            <Box gap="s">
              {SETTINGS_GLOBAL_MENU_ITEMS.map((item) => (
                <SettingsLink
                  key={item.id}
                  title={item.title}
                  description={item.description}
                  icon={item.icon}
                  href={item.href ?? '/settings'}
                />
              ))}
            </Box>
          </Box>
        </ScrollView>
      </Box>
    </Container>
  );
}
