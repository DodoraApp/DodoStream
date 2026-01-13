import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack, type ErrorBoundaryProps, useRouter } from 'expo-router';
import { ThemeProvider } from '@shopify/restyle';
import theme, { Box, Text } from '@/theme/theme';
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
import { useCallback, useEffect, useRef, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/utils/query';
import { initializeAddons, useAddonStore } from '@/store/addon.store';
import { initializeProfiles, useProfileStore } from '@/store/profile.store';
import { ProfileSelector } from '@/components/profile/ProfileSelector';
import { GithubReleaseModal } from '@/components/layout/GithubReleaseModal';
import { useAppSettingsStore } from '@/store/app-settings.store';
import { Container } from '@/components/basic/Container';
import { Button } from '@/components/basic/Button';
import { AppStartAnimation } from '@/components/basic/AppStartAnimation';
import { ToastContainer } from '@/components/basic/Toast';
import * as Sentry from '@sentry/react-native';
import { isSentryEnabled, SENTRY_DSN } from '@/utils/sentry';
import { createDebugLogger } from '@/utils/debug';

const debug = createDebugLogger('layout');
if (isSentryEnabled) {
  debug('Initializing Sentry with DSN:', SENTRY_DSN);
  Sentry.init({
    dsn: SENTRY_DSN,

    // Set tracesSampleRate to 1.0 to capture 100% of transactions for tracing.
    // We recommend adjusting this value in production.
    // Learn more at
    // https://docs.sentry.io/platforms/react-native/configuration/options/#traces-sample-rate
    tracesSampleRate: 0.2,
    // Enable logs to be sent to Sentry
    // Learn more at https://docs.sentry.io/platforms/react-native/logs/
    enableLogs: true,
    // profilesSampleRate is relative to tracesSampleRate.
    // Here, we'll capture profiles for 30% of transactions.
    profilesSampleRate: 0.3,
    // Record session replays for 100% of errors and 10% of sessions
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0,
    integrations: [Sentry.mobileReplayIntegration()],
  });
}

SplashScreen.preventAutoHideAsync();

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const handleRetry = useCallback(() => {
    retry();
  }, [retry]);

  return (
    <ThemeProvider theme={theme}>
      <Container>
        <Box flex={1} justifyContent="center" gap="m">
          <Box gap="xs">
            <Text variant="header">Something went wrong</Text>
            <Text variant="body" color="textSecondary">
              {error.name}: {error.message}
            </Text>
          </Box>
          <Button title="Try again" onPress={handleRetry} hasTVPreferredFocus />
        </Box>
      </Container>
    </ThemeProvider>
  );
}

function Layout() {
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

  // Track both animation completion and initialization separately
  const storesInitialized = isAddonsInitialized && isProfilesInitialized;
  const showProfileSelector = !activeProfileId;

  // Key the entire app subtree by profile. This resets navigation state and all component state.
  const appKey = activeProfileId ?? 'no-profile';

  useEffect(() => {
    if (!fontsLoaded) return;
    if (didInitRef.current) return;
    didInitRef.current = true;

    // Hide native splash screen as soon as fonts are loaded - our custom animation takes over
    void SplashScreen.hideAsync();

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

  const handleProfileSelect = () => {
    router.replace('/');
  };

  // Wait for fonts before rendering anything
  if (!fontsLoaded) {
    return null;
  }

  // Show start animation while stores are initializing
  if (!storesInitialized) {
    return (
      <ThemeProvider theme={theme}>
        <AppStartAnimation />
      </ThemeProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <ToastContainer />
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

const AppLayout = isSentryEnabled ? Sentry.wrap(Layout) : Layout;
export default AppLayout;
