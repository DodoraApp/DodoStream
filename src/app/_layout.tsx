import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import {
  Outfit_400Regular,
  Outfit_600SemiBold,
  Outfit_700Bold,
  useFonts,
} from '@expo-google-fonts/outfit';
import {
  Poppins_400Regular,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { ThemeProvider, useTheme } from '@shopify/restyle';
import { QueryClientProvider } from '@tanstack/react-query';
import { useDrizzleStudio } from 'expo-drizzle-studio-plugin';
import { type ErrorBoundaryProps, Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { AppStartAnimation } from '@/components/basic/AppStartAnimation';
import { Button } from '@/components/basic/Button';
import { Container } from '@/components/basic/Container';
import { ToastContainer } from '@/components/basic/Toast';
import { initializeDatabase, runSqliteDataMigration, sqliteDb } from '@/db';
import { initializeAddons, useAddonStore } from '@/store/addon.store';
import { initializeProfiles, useProfileStore } from '@/store/profile.store';
import { initializeUIStore, useUIStore } from '@/store/ui.store';
import { Box, defaultTheme, Text, type Theme } from '@/theme/theme';
import { AppThemeProvider } from '@/theme/ThemeContext';
import { queryClient } from '@/utils/query';

import '@/i18n';

SplashScreen.preventAutoHideAsync();

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { t } = useTranslation('common');
  const handleRetry = useCallback(() => {
    retry();
  }, [retry]);

  return (
    <ThemeProvider theme={defaultTheme}>
      <Container>
        <Box flex={1} justifyContent="center" gap="m">
          <Box gap="xs">
            <Text variant="header">{t('unexpected_error')}</Text>
            <Text variant="body" color="textSecondary">
              {error.name}: {error.message}
            </Text>
          </Box>
          <Button title={t('retry')} onPress={handleRetry} hasTVPreferredFocus />
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
  useDrizzleStudio(sqliteDb);

  useEffect(() => {
    if (!fontsLoaded) return;
    if (didInitRef.current) return;
    didInitRef.current = true;

    void SplashScreen.hideAsync();

    const init = async () => {
      try {
        await initializeDatabase();
        await runSqliteDataMigration();
        await initializeUIStore();
        await initializeProfiles();
        await initializeAddons();
      } catch (error) {
        console.error('[boot] init failed', error);
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

export default Layout;
