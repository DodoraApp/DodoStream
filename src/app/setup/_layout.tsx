import { Stack } from 'expo-router';
import theme from '@/theme/theme';

/**
 * Setup wizard layout
 * Provides a stack navigator for wizard steps with no visible header
 */
export default function SetupLayout() {
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
      <Stack.Screen name="profile" />
      <Stack.Screen name="addons" />
      <Stack.Screen name="home" />
      <Stack.Screen name="playback" />
      <Stack.Screen name="complete" />
    </Stack>
  );
}
