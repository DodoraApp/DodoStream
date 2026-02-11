import { Stack } from 'expo-router';
import { Theme } from '@/theme/theme';
import { useTheme } from '@shopify/restyle';

/**
 * Setup wizard layout
 * Provides a stack navigator for wizard steps with no visible header
 */
export default function SetupLayout() {
  const theme = useTheme<Theme>();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: {
          backgroundColor: theme.colors.mainBackground,
        },
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="ui" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="addons" />
      <Stack.Screen name="home" />
      <Stack.Screen name="playback" />
      <Stack.Screen name="complete" />
    </Stack>
  );
}
