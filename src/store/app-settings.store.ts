import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** What happens to a download once it has been watched to the end. */
export type DownloadAfterWatching = 'keep' | 'ask' | 'delete';

interface AppSettingsState {
  releaseCheckOnStartup: boolean;
  setReleaseCheckOnStartup: (releaseCheckOnStartup: boolean) => void;
  showWhatsNewOnStartup: boolean;
  setShowWhatsNewOnStartup: (showWhatsNewOnStartup: boolean) => void;
  lastSeenWhatsNewId: string | null;
  setLastSeenWhatsNewId: (lastSeenWhatsNewId: string | null) => void;
  /** Keep downloads running while the app is in the background or the screen is locked. */
  backgroundDownloadsEnabled: boolean;
  setBackgroundDownloadsEnabled: (backgroundDownloadsEnabled: boolean) => void;
  downloadAfterWatching: DownloadAfterWatching;
  setDownloadAfterWatching: (downloadAfterWatching: DownloadAfterWatching) => void;
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
      backgroundDownloadsEnabled: true,
      setBackgroundDownloadsEnabled: (backgroundDownloadsEnabled) =>
        set({ backgroundDownloadsEnabled }),
      downloadAfterWatching: 'ask',
      setDownloadAfterWatching: (downloadAfterWatching) => set({ downloadAfterWatching }),
    }),
    {
      name: 'app-settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        releaseCheckOnStartup: state.releaseCheckOnStartup,
        showWhatsNewOnStartup: state.showWhatsNewOnStartup,
        lastSeenWhatsNewId: state.lastSeenWhatsNewId,
        backgroundDownloadsEnabled: state.backgroundDownloadsEnabled,
        downloadAfterWatching: state.downloadAfterWatching,
      }),
    }
  )
);
