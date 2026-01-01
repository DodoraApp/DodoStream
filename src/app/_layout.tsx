import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack, useRouter } from 'expo-router';
import { ThemeProvider } from '@shopify/restyle';
import theme from '@/theme/theme';
import {
  useFonts,
  Outfit_400Regular,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from '@expo-google-fonts/outfit';
import {
  Poppins_400Regular,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/utils/query';
import { initializeAddons, useAddonStore } from '@/store/addon.store';
import { initializeProfiles, useProfileStore } from '@/store/profile.store';
import { ProfileSelector } from '@/components/profile/ProfileSelector';
import { GithubReleaseModal } from '@/components/layout/GithubReleaseModal';
import { useAppSettingsStore } from '@/store/app-settings.store';

SplashScreen.preventAutoHideAsync();

export default function Layout() {
  const router = useRouter();
  const didInitRef = useRef(false);
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Poppins_400Regular,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const isAddonsInitialized = useAddonStore((state) => state.isInitialized);
  const isProfilesInitialized = useProfileStore((state) => state.isInitialized);
  const activeProfileId = useProfileStore((state) => state.activeProfileId);
  const releaseCheckOnStartup = useAppSettingsStore((state) => state.releaseCheckOnStartup);

  const showProfileSelector = !activeProfileId;

  // Key the entire app subtree by profile. This resets navigation state and all component state.
  const appKey = activeProfileId ?? 'no-profile';

  useEffect(() => {
    if (!fontsLoaded) return;
    if (didInitRef.current) return;
    didInitRef.current = true;

    // Initialize both addons and profiles after fonts are loaded.
    const init = async () => {
      try {
        await initializeProfiles();
        await initializeAddons();
      } catch (error) {
        // Fail open: never let a boot-time init error keep the splash screen forever.
        // Stores should also be resilient, but this is an extra guardrail.
        console.warn('[boot] init failed', error);
        useProfileStore.getState().setInitialized(true);
        useAddonStore.getState().setInitialized(true);
      }
    };
    void init();
  }, [fontsLoaded]);

  useEffect(() => {
    if (fontsLoaded && isAddonsInitialized && isProfilesInitialized) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isAddonsInitialized, isProfilesInitialized]);

  const handleProfileSelect = () => {
    router.replace('/');
  };

  if (!fontsLoaded || !isAddonsInitialized || !isProfilesInitialized) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        {showProfileSelector ? (
          <ProfileSelector onSelect={handleProfileSelect} />
        ) : (
          <GestureHandlerRootView
            key={appKey}
            style={{ flex: 1, backgroundColor: theme.colors.mainBackground }}>
            <GithubReleaseModal enabled={releaseCheckOnStartup && !showProfileSelector} />
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
            </Stack>
          </GestureHandlerRootView>
        )}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
