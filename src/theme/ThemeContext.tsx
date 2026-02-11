import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import { ThemeProvider as RestyleThemeProvider } from '@shopify/restyle';
import { createAppTheme, type Theme } from './theme';
import { useUIStore } from '@/store/ui.store';
import { getThemePreset, type ThemePreset } from './theme-presets';

interface ThemeContextValue {
  /** The current merged theme */
  theme: Theme;
  /** Current theme preset */
  preset: ThemePreset;
  /** Current scaling factor */
  scalingFactor: number;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface AppThemeProviderProps {
  children: ReactNode;
}

/**
 * App Theme Provider that combines Restyle ThemeProvider with dynamic theme/scaling.
 * Subscribes to UIStore and memoizes the merged theme.
 */
export const AppThemeProvider: React.FC<AppThemeProviderProps> = ({ children }) => {
  const themePresetId = useUIStore((state) => state.themePresetId);
  const scalingFactor = useUIStore((state) => state.scalingFactor);

  // Get the preset (memoized)
  const preset = useMemo(() => getThemePreset(themePresetId), [themePresetId]);

  // Create merged theme (memoized)
  const theme = useMemo(() => {
    // Create base theme with the current scaling factor
    const baseTheme = createAppTheme(scalingFactor);

    // Merge preset color overrides
    if (preset.colors && Object.keys(preset.colors).length > 0) {
      return {
        ...baseTheme,
        colors: {
          ...baseTheme.colors,
          ...preset.colors,
        },
      };
    }

    return baseTheme;
  }, [scalingFactor, preset]);

  const contextValue = useMemo<ThemeContextValue>(
    () => ({
      theme,
      preset,
      scalingFactor,
    }),
    [theme, preset, scalingFactor]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      <RestyleThemeProvider theme={theme}>{children}</RestyleThemeProvider>
    </ThemeContext.Provider>
  );
};

/**
 * Hook to access the current theme context including preset info.
 * For just the theme object, you can also use useTheme from @shopify/restyle.
 */
export const useAppTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within an AppThemeProvider');
  }
  return context;
};

export { ThemeContext };
