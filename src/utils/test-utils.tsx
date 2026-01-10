import React from 'react';
import { render, renderHook } from '@testing-library/react-native';
import { ThemeProvider } from '@shopify/restyle';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import theme from '@/theme/theme';

const SAFE_AREA_INITIAL_METRICS = {
  frame: { x: 0, y: 0, width: 0, height: 0 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      // Avoid background GC timers in Jest.
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

export function renderWithProviders(
  ui: React.ReactElement,
  options?: {
    queryClient?: QueryClient;
  }
) {
  const queryClient = options?.queryClient ?? createTestQueryClient();

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    const themed = (
      <SafeAreaProvider initialMetrics={SAFE_AREA_INITIAL_METRICS}>
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </SafeAreaProvider>
    );
    return <QueryClientProvider client={queryClient}>{themed}</QueryClientProvider>;
  };

  return render(ui, { wrapper: Wrapper });
}

export function renderHookWithProviders<TProps, TResult>(
  callback: (props: TProps) => TResult,
  options?: {
    initialProps?: TProps;
    queryClient?: QueryClient;
  }
) {
  const queryClient = options?.queryClient ?? createTestQueryClient();
  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    const themed = (
      <SafeAreaProvider initialMetrics={SAFE_AREA_INITIAL_METRICS}>
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </SafeAreaProvider>
    );
    return <QueryClientProvider client={queryClient}>{themed}</QueryClientProvider>;
  };

  return renderHook(callback, { wrapper: Wrapper, initialProps: options?.initialProps });
}
