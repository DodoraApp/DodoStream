import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface AppSettingsState {
  releaseCheckOnStartup: boolean;
  setReleaseCheckOnStartup: (releaseCheckOnStartup: boolean) => void;
  showWhatsNewOnStartup: boolean;
  setShowWhatsNewOnStartup: (showWhatsNewOnStartup: boolean) => void;
  lastSeenWhatsNewId: string | null;
  setLastSeenWhatsNewId: (lastSeenWhatsNewId: string | null) => void;
}

export const useAppSettingsStore = create<AppSettingsState>()(
  persist(
    (set) => ({
      releaseCheckOnStartup: true,
      setReleaseCheckOnStartup: (releaseCheckOnStartup) => set({ releaseCheckOnStartup }),
      showWhatsNewOnStartup: true,
      setShowWhatsNewOnStartup: (showWhatsNewOnStartup) => set({ showWhatsNewOnStartup }),
      lastSeenWhatsNewId: null,
      setLastSeenWhatsNewId: (lastSeenWhatsNewId) => set({ lastSeenWhatsNewId }),
    }),
    {
      name: 'app-settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        releaseCheckOnStartup: state.releaseCheckOnStartup,
        showWhatsNewOnStartup: state.showWhatsNewOnStartup,
        lastSeenWhatsNewId: state.lastSeenWhatsNewId,
      }),
    }
  )
);
