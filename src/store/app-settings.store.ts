import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { NO_STREAM_FILTERS, type StreamFilters } from '@/utils/stream-filters';

interface AppSettingsState {
  releaseCheckOnStartup: boolean;
  setReleaseCheckOnStartup: (releaseCheckOnStartup: boolean) => void;
  showWhatsNewOnStartup: boolean;
  setShowWhatsNewOnStartup: (showWhatsNewOnStartup: boolean) => void;
  lastSeenWhatsNewId: string | null;
  setLastSeenWhatsNewId: (lastSeenWhatsNewId: string | null) => void;
  /** Resolution and size filters of the stream list; remembered between titles. */
  streamFilters: StreamFilters;
  setStreamFilters: (streamFilters: StreamFilters) => void;
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
      streamFilters: NO_STREAM_FILTERS,
      setStreamFilters: (streamFilters) => set({ streamFilters }),
    }),
    {
      name: 'app-settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        releaseCheckOnStartup: state.releaseCheckOnStartup,
        showWhatsNewOnStartup: state.showWhatsNewOnStartup,
        lastSeenWhatsNewId: state.lastSeenWhatsNewId,
        streamFilters: state.streamFilters,
      }),
    }
  )
);
