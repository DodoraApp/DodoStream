import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
    DEFAULT_THEME_PRESET_ID,
    DEFAULT_SCALING_FACTOR,
    SCALING_FACTOR_MIN,
    SCALING_FACTOR_MAX,
} from '@/theme/theme-presets';

interface UIState {
    /** Currently selected theme preset ID */
    themePresetId: string;
    /** UI scaling factor (affects spacing, fonts, etc.) */
    scalingFactor: number;
    /** Whether the store has been initialized from persistence */
    isInitialized: boolean;

    // Actions
    setThemePresetId: (id: string) => void;
    setScalingFactor: (factor: number) => void;
    setInitialized: (initialized: boolean) => void;
}

export const useUIStore = create<UIState>()(
    persist(
        (set) => ({
            themePresetId: DEFAULT_THEME_PRESET_ID,
            scalingFactor: DEFAULT_SCALING_FACTOR,
            isInitialized: false,

            setThemePresetId: (themePresetId) => set({ themePresetId }),

            setScalingFactor: (factor) => {
                // Clamp to valid range
                const clamped = Math.min(Math.max(factor, SCALING_FACTOR_MIN), SCALING_FACTOR_MAX);
                set({ scalingFactor: clamped });
            },

            setInitialized: (isInitialized) => set({ isInitialized }),
        }),
        {
            name: 'ui-settings-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                themePresetId: state.themePresetId,
                scalingFactor: state.scalingFactor,
            }),
            onRehydrateStorage: () => (state) => {
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
    const { isInitialized, setInitialized } = useUIStore.getState();
    if (!isInitialized) {
        setInitialized(true);
    }
};
