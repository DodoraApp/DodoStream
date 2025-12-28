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
import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/utils/query';
import { initializeAddons, useAddonStore } from '@/store/addon.store';
import { initializeProfiles, useProfileStore } from '@/store/profile.store';
import { ProfileSelector } from '@/components/profile/ProfileSelector';
import { initializeSimklScrobbleMiddleware } from '@/api/tracking/scrobble';
import { initializeTrackingSync } from '@/api/tracking/sync';

SplashScreen.preventAutoHideAsync();

let didInit = false;

export default function Layout() {
  const router = useRouter();
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

  const showProfileSelector = !activeProfileId;

  // Key the entire app subtree by profile. This resets navigation state and all component state.
  const appKey = activeProfileId ?? 'no-profile';

  useEffect(() => {
    if (!fontsLoaded) return;
    if (didInit) return;
    didInit = true;

    // Initialize both addons and profiles after fonts are loaded.
    const init = async () => {
      await initializeProfiles();
      await initializeAddons();
    };
    init();
  }, [fontsLoaded]);

  useEffect(() => {
    if (fontsLoaded && isAddonsInitialized && isProfilesInitialized) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isAddonsInitialized, isProfilesInitialized]);

  useEffect(() => {
    if (!fontsLoaded || !isAddonsInitialized || !isProfilesInitialized) return;
    return initializeSimklScrobbleMiddleware();
  }, [fontsLoaded, isAddonsInitialized, isProfilesInitialized]);

  useEffect(() => {
    if (!fontsLoaded || !isAddonsInitialized || !isProfilesInitialized) return;
    return initializeTrackingSync();
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
