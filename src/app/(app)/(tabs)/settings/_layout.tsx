import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useResponsiveLayout } from '@/hooks/useBreakpoint';
import { useTheme } from '@shopify/restyle';
import { Theme } from '@/theme/theme';

export default function SettingsLayout() {
  const theme = useTheme<Theme>();
  const { t } = useTranslation('settings');
  const { splitLayout } = useResponsiveLayout();

  // On wide layouts, settings are shown in split view, so hide headers
  // and prevent navigation to sub-pages (they're rendered inline)
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.cardBackground,
        },
        headerTintColor: theme.colors.mainForeground,
        headerTitleStyle: {
          color: theme.colors.mainForeground,
          fontFamily: theme.fonts.outfitSemiBold,
        },
        contentStyle: {
          backgroundColor: theme.colors.mainBackground,
        },
        // Hide headers on wide layouts since content is inline
        headerShown: !splitLayout.enabled,
      }}>
      <Stack.Screen
        name="index"
        options={{
          title: t('title'),
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="playback"
        options={{
          title: t('menu.playback.title'),
        }}
      />
      <Stack.Screen
        name="subtitles"
        options={{
          title: t('menu.subtitles.title'),
        }}
      />
      <Stack.Screen
        name="profiles"
        options={{
          title: t('menu.profiles.title'),
        }}
      />
      <Stack.Screen
        name="addons"
        options={{
          title: t('menu.addons.title'),
        }}
      />
      <Stack.Screen
        name="about"
        options={{
          title: t('menu.about.title'),
        }}
      />
      <Stack.Screen
        name="developer"
        options={{
          title: t('menu.developer.title'),
        }}
      />
      <Stack.Screen
        name="ui"
        options={{
          title: t('menu.ui.title'),
        }}
      />
      <Stack.Screen
        name="integrations"
        options={{
          title: t('menu.integrations.title'),
        }}
      />
      <Stack.Screen
        name="home"
        options={{
          title: t('menu.home.title'),
        }}
      />
      <Stack.Screen
        name="data"
        options={{
          title: t('menu.data.title'),
        }}
      />
    </Stack>
  );
}
