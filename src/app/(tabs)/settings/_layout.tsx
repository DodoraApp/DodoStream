import { Stack } from 'expo-router';
import theme from '@/theme/theme';
import { useResponsiveLayout } from '@/hooks/useBreakpoint';

export default function SettingsLayout() {
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
          title: 'Settings',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="playback"
        options={{
          title: 'Playback',
        }}
      />
      <Stack.Screen
        name="subtitles"
        options={{
          title: 'Subtitles',
        }}
      />
      <Stack.Screen
        name="profiles"
        options={{
          title: 'Profiles',
        }}
      />
      <Stack.Screen
        name="addons"
        options={{
          title: 'Addons',
        }}
      />
      <Stack.Screen
        name="about"
        options={{
          title: 'About',
        }}
      />
    </Stack>
  );
}
