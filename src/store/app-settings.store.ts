import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface AppSettingsState {
    releaseCheckOnStartup: boolean;
    setReleaseCheckOnStartup: (releaseCheckOnStartup: boolean) => void;
}

export const useAppSettingsStore = create<AppSettingsState>()(
    persist(
        (set) => ({
            releaseCheckOnStartup: true,
            setReleaseCheckOnStartup: (releaseCheckOnStartup) => set({ releaseCheckOnStartup }),
        }),
        {
            name: 'app-settings-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({ releaseCheckOnStartup: state.releaseCheckOnStartup }),
        }
    )
);
