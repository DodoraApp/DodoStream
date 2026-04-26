import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import * as Localization from 'expo-localization';
import {
  DEFAULT_THEME_PRESET_ID,
  DEFAULT_SCALING_FACTOR,
  SCALING_FACTOR_MIN,
  SCALING_FACTOR_MAX,
} from '@/theme/theme-presets';
import i18n from '@/i18n';

interface UIState {
  /** Currently selected theme preset ID */
  themePresetId: string;
  /** UI scaling factor (affects spacing, fonts, etc.) */
  scalingFactor: number;
  /** App language (undefined means follow system) */
  language?: string;
  /** Whether the store has been initialized from persistence */
  isInitialized: boolean;

  // Actions
  setThemePresetId: (id: string) => void;
  setScalingFactor: (factor: number) => void;
  setLanguage: (language?: string) => void;
  setInitialized: (initialized: boolean) => void;
}

/**
 * Updates i18next language based on store value or system locale.
 */
const applyLanguage = (language?: string) => {
  if (language) {
    i18n.changeLanguage(language);
  } else {
    const systemLanguage = Localization.getLocales()?.[0]?.languageCode ?? 'en';
    i18n.changeLanguage(systemLanguage);
  }
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      themePresetId: DEFAULT_THEME_PRESET_ID,
      scalingFactor: DEFAULT_SCALING_FACTOR,
      language: undefined, // Default to system
      isInitialized: false,

      setThemePresetId: (themePresetId) => set({ themePresetId }),

      setScalingFactor: (factor) => {
        // Clamp to valid range
        const clamped = Math.min(Math.max(factor, SCALING_FACTOR_MIN), SCALING_FACTOR_MAX);
        set({ scalingFactor: clamped });
      },

      setLanguage: (language) => {
        set({ language });
        applyLanguage(language);
      },

      setInitialized: (isInitialized) => set({ isInitialized }),
    }),
    {
      name: 'ui-settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        themePresetId: state.themePresetId,
        scalingFactor: state.scalingFactor,
        language: state.language,
      }),
      onRehydrateStorage: () => (state) => {
        // Apply persisted language if it exists
        applyLanguage(state?.language);
        // Mark as initialized after rehydration
        state?.setInitialized(true);
      },
    }
  )
);

// Initialize UI store (call on app start)
export const initializeUIStore = async () => {
  // The store auto-rehydrates via persist middleware
  // This function ensures the store is marked initialized even if rehydration fails
  const { isInitialized, setInitialized, language } = useUIStore.getState();
  if (!isInitialized) {
    applyLanguage(language);
    setInitialized(true);
  }
};
