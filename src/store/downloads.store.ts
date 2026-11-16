import { create } from 'zustand';

import type { DbDownload } from '@/db/queries/downloads';

export interface DownloadProgress {
  bytesDownloaded: number;
  bytesTotal?: number;
}

interface DownloadsState {
  /** Live progress of running downloads, keyed by download id. Not persisted. */
  progressById: Record<number, DownloadProgress>;
  setProgress: (id: number, progress: DownloadProgress) => void;
  clearProgress: (id: number) => void;

  /** Watched downloads the user is asked about deleting. Not persisted. */
  watchedDownloads: DbDownload[];
  addWatchedDownload: (download: DbDownload) => void;
  clearWatchedDownloads: () => void;
}

export const useDownloadsStore = create<DownloadsState>((set) => ({
  progressById: {},

  setProgress: (id, progress) =>
    set((state) => ({ progressById: { ...state.progressById, [id]: progress } })),

  clearProgress: (id) =>
    set((state) => {
      if (!(id in state.progressById)) return state;
      const { [id]: _removed, ...rest } = state.progressById;
      return { progressById: rest };
    }),

  watchedDownloads: [],

  addWatchedDownload: (download) =>
    set((state) =>
      state.watchedDownloads.some((item) => item.id === download.id)
        ? state
        : { watchedDownloads: [...state.watchedDownloads, download] }
    ),

  clearWatchedDownloads: () => set({ watchedDownloads: [] }),
}));
