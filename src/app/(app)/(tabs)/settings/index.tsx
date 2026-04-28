import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, TVFocusGuideView, View } from 'react-native';

import { Container } from '@/components/basic/Container';
import { PageHeader } from '@/components/basic/PageHeader';
import { AboutSettingsContent } from '@/components/settings/AboutSettingsContent';
import { AddonsSettingsContent } from '@/components/settings/AddonsSettingsContent';
import { DataSettingsContent } from '@/components/settings/DataSettingsContent';
import { HomeSettingsContent } from '@/components/settings/HomeSettingsContent';
import { IntegrationsSettingsContent } from '@/components/settings/IntegrationsSettingsContent';
import { PlaybackSettingsContent } from '@/components/settings/PlaybackSettingsContent';
import { ProfilesSettingsContent } from '@/components/settings/ProfilesSettingsContent';
import { ProfileSwitcherCard } from '@/components/settings/ProfileSwitcherCard';
import { SettingsLink } from '@/components/settings/SettingsLink';
import { SettingsMenu } from '@/components/settings/SettingsMenu';
import { SettingsShell } from '@/components/settings/SettingsShell';
import { SubtitlesSettingsContent } from '@/components/settings/SubtitlesSettingsContent';
import { UISettingsContent } from '@/components/settings/UISettingsContent';
import { SETTINGS_GLOBAL_MENU_ITEMS, SETTINGS_PROFILE_MENU_ITEMS } from '@/constants/settings';
import { useResponsiveLayout } from '@/hooks/useBreakpoint';
import { Box, Text } from '@/theme/theme';

export default function Settings() {
  const { t } = useTranslation('settings');
  const { splitLayout } = useResponsiveLayout();
  // Ref to the first menu item for TV focus navigation (used by SettingsShell)
  const firstMenuItemRef = useRef<View>(null);
  const [selectedPage, setSelectedPage] = useState('profiles');

  const translatedProfileMenuItems = useMemo(() => SETTINGS_PROFILE_MENU_ITEMS(t), [t]);
  const translatedGlobalMenuItems = useMemo(() => SETTINGS_GLOBAL_MENU_ITEMS(t), [t]);

  const handleSelectPage = useCallback((id: string) => {
    setSelectedPage(id);
  }, []);

  // Wide layout: use SettingsShell with split view
  if (splitLayout.enabled) {
    return (
      <Container disablePadding>
        <SettingsShell
          firstMenuItemRef={firstMenuItemRef}
          menu={
            <ScrollView showsVerticalScrollIndicator={false}>
              <Box gap="m" paddingHorizontal="s">
                <Text variant="subheader">{t('title')}</Text>
                <ProfileSwitcherCard ref={firstMenuItemRef} />

                <Text variant="sectionLabel">{t('profile_section')}</Text>
                <SettingsMenu
                  items={translatedProfileMenuItems}
                  selectedId={selectedPage}
                  onSelect={handleSelectPage}
                  scrollable={false}
                />

                <Text variant="sectionLabel">{t('global_section')}</Text>
                <SettingsMenu
                  items={translatedGlobalMenuItems}
                  selectedId={selectedPage}
                  onSelect={handleSelectPage}
                  scrollable={false}
                />
              </Box>
            </ScrollView>
          }>
          <TVFocusGuideView trapFocusUp trapFocusDown>
            <PageContent selectedPage={selectedPage} />
          </TVFocusGuideView>
        </SettingsShell>
      </Container>
    );
  }

  // Mobile layout: show menu with links to separate pages
  return (
    <Container safeAreaEdges={['left', 'right', 'top']}>
      <Box flex={1}>
        <PageHeader title={t('title')} />
        <ScrollView showsVerticalScrollIndicator={false}>
          <Box paddingVertical="m" gap="m">
            <Text variant="sectionLabel">{t('profile_section')}</Text>
            <ProfileSwitcherCard ref={firstMenuItemRef} />

            <Box gap="s">
              {translatedProfileMenuItems.map((item) => (
                <SettingsLink
                  key={item.id}
                  title={item.title}
                  description={item.description}
                  icon={item.icon}
                  href={item.href ?? '/settings'}
                />
              ))}
            </Box>

            <Text variant="sectionLabel">{t('global_section')}</Text>
            <Box gap="s">
              {translatedGlobalMenuItems.map((item) => (
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

const PageContent = ({ selectedPage }: { selectedPage: string }) => {
  switch (selectedPage) {
    case 'home':
      return <HomeSettingsContent />;
    case 'playback':
      return <PlaybackSettingsContent />;
    case 'subtitles':
      return <SubtitlesSettingsContent />;
    case 'profiles':
      return <ProfilesSettingsContent />;
    case 'ui':
      return <UISettingsContent />;
    case 'addons':
      return <AddonsSettingsContent />;
    case 'data':
      return <DataSettingsContent />;
    case 'about':
      return <AboutSettingsContent />;
    case 'integrations':
      return <IntegrationsSettingsContent />;
    default:
      return <PlaybackSettingsContent />;
  }
};
