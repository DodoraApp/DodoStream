import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Slot, type ErrorBoundaryProps } from 'expo-router';
import { ThemeProvider, useTheme } from '@shopify/restyle';
import { defaultTheme, Box, Text, type Theme } from '@/theme/theme';
import { AppThemeProvider } from '@/theme/ThemeContext';
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
import { useCallback, useEffect, useRef } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/utils/query';
import { initializeAddons, useAddonStore } from '@/store/addon.store';
import { initializeProfiles, useProfileStore } from '@/store/profile.store';
import { initializeUIStore, useUIStore } from '@/store/ui.store';
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
    tracesSampleRate: 0.2,
    enableLogs: true,
    profilesSampleRate: 0.3,
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
    <ThemeProvider theme={defaultTheme}>
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

/**
 * Root layout - provides global context and renders child routes
 * The (app) group handles profile checking and redirects
 */
function Layout() {
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
  const isUIInitialized = useUIStore((state) => state.isInitialized);
  const storesInitialized = isAddonsInitialized && isProfilesInitialized && isUIInitialized;

  useEffect(() => {
    if (!fontsLoaded) return;
    if (didInitRef.current) return;
    didInitRef.current = true;

    void SplashScreen.hideAsync();

    const init = async () => {
      try {
        await initializeUIStore();
        await initializeProfiles();
        await initializeAddons();
      } catch (error) {
        console.warn('[boot] init failed', error);
        useUIStore.getState().setInitialized(true);
        useProfileStore.getState().setInitialized(true);
        useAddonStore.getState().setInitialized(true);
      }
    };
    void init();
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  if (!storesInitialized) {
    return (
      <ThemeProvider theme={defaultTheme}>
        <AppStartAnimation />
      </ThemeProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider>
        <ThemedAppRoot />
      </AppThemeProvider>
    </QueryClientProvider>
  );
}

/**
 * Inner component that uses the dynamic theme from AppThemeProvider
 */
function ThemedAppRoot() {
  const currentTheme = useTheme<Theme>();

  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: currentTheme.colors.mainBackground }}>
      <ToastContainer />
      <Slot />
    </GestureHandlerRootView>
  );
}

const AppLayout = isSentryEnabled ? Sentry.wrap(Layout) : Layout;
export default AppLayout;
