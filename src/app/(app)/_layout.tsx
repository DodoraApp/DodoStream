import { Redirect, Stack, useRouter } from 'expo-router';
import { useCallback } from 'react';
import theme from '@/theme/theme';
import { useProfileStore } from '@/store/profile.store';
import { useAppSettingsStore } from '@/store/app-settings.store';
import { ProfileSelector } from '@/components/profile/ProfileSelector';
import { GithubReleaseModal } from '@/components/layout/GithubReleaseModal';

/**
 * App layout that requires profiles to exist
 * If no profiles exist, redirects to setup wizard
 * If profiles exist but none selected, shows profile selector
 */
export default function AppLayout() {
  const router = useRouter();
  const activeProfileId = useProfileStore((state) => state.activeProfileId);
  const hasProfiles = useProfileStore((state) => state.hasProfiles);
  const releaseCheckOnStartup = useAppSettingsStore((state) => state.releaseCheckOnStartup);

  const profilesExist = hasProfiles();

  const handleProfileSelect = useCallback(() => {
    router.replace('/');
  }, [router]);

  // Redirect to setup wizard if no profiles exist
  if (!profilesExist) {
    return <Redirect href="/setup" />;
  }

  // Show profile selector if profiles exist but none is active
  if (!activeProfileId) {
    return <ProfileSelector onSelect={handleProfileSelect} />;
  }

  // Normal app with active profile
  return (
    <>
      <GithubReleaseModal enabled={releaseCheckOnStartup} />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.colors.cardBackground,
          },
          headerTintColor: theme.colors.mainForeground,
          headerTitleStyle: {
            color: theme.colors.mainForeground,
            fontWeight: '600',
            fontFamily: theme.fonts.outfitSemiBold,
          },
          contentStyle: {
            backgroundColor: theme.colors.mainBackground,
          },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="details/[id]"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen name="search" options={{ headerShown: false }} />
        <Stack.Screen name="streams" options={{ headerShown: false }} />
        <Stack.Screen name="play" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
