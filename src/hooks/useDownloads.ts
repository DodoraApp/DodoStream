import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useMutation, useQuery } from '@tanstack/react-query';

import { downloadFileExists, getDownloadFileUri } from '@/api/downloads/download-fs';
import {
  DownloadError,
  downloadKeys,
  removeAllDownloadsForProfile,
  removeDownload,
  retryDownload,
  startDownload,
  type StartDownloadParams,
  startSeasonDownload,
  type StartSeasonDownloadParams,
} from '@/api/downloads/download-manager';
import type { PickerItem } from '@/components/basic/PickerModal';
import { DOWNLOADS_ENABLED } from '@/constants/downloads';
import { type DbDownload, getDownloadForVideo, listDownloadsForProfile } from '@/db';
import { useMediaNavigation } from '@/hooks/useMediaNavigation';
import { type DownloadProgress, useDownloadsStore } from '@/store/downloads.store';
import { useProfileStore } from '@/store/profile.store';
import { showToast } from '@/store/toast.store';
import { createDebugLogger } from '@/utils/debug';

const debug = createDebugLogger('useDownloads');

/** All downloads of the active profile, newest first. */
export function useDownloads() {
  const profileId = useProfileStore((state) => state.activeProfileId);

  return useQuery<DbDownload[]>({
    queryKey: profileId ? downloadKeys.list(profileId) : downloadKeys.all,
    queryFn: () => (profileId ? listDownloadsForProfile(profileId) : []),
    enabled: !!profileId && DOWNLOADS_ENABLED,
    staleTime: 0,
  });
}

/** Downloads of the active profile that belong to one movie or series. */
export function useDownloadsForMeta(metaId: string): DbDownload[] {
  const { data } = useDownloads();
  return useMemo(() => (data ?? []).filter((item) => item.metaId === metaId), [data, metaId]);
}

/** The download of the active profile for one video, or null when there is none. */
export function useDownloadForVideo(metaId: string, videoId?: string, enabled: boolean = true) {
  const profileId = useProfileStore((state) => state.activeProfileId);

  return useQuery<DbDownload | null>({
    queryKey: profileId ? downloadKeys.video(profileId, metaId, videoId) : downloadKeys.all,
    queryFn: () => (profileId ? getDownloadForVideo(profileId, metaId, videoId) : null),
    enabled: !!profileId && !!metaId && enabled && DOWNLOADS_ENABLED,
    staleTime: 0,
  });
}

/**
 * Current byte counts of a download. Uses the live value while the transfer
 * runs in this app process and the stored value otherwise.
 */
export function useDownloadProgress(download: DbDownload): DownloadProgress {
  const live = useDownloadsStore((state) => state.progressById[download.id]);

  if (download.status === 'downloading' && live) return live;
  return { bytesDownloaded: download.bytesDownloaded, bytesTotal: download.bytesTotal };
}

export function useDownloadActions() {
  const { t } = useTranslation('media');
  const profileId = useProfileStore((state) => state.activeProfileId);

  const handleError = useCallback(
    (error: unknown) => {
      debug('actionFailed', { error });
      const isKnown = error instanceof DownloadError;
      showToast({
        title:
          isKnown && error.code === 'not_downloadable'
            ? t('download_not_supported')
            : isKnown && error.code === 'already_exists'
              ? t('download_already_exists')
              : t('download_failed'),
        preset: 'error',
      });
    },
    [t]
  );

  const startMutation = useMutation({
    mutationFn: async (params: Omit<StartDownloadParams, 'profileId'>) => {
      if (!profileId) return null;
      return startDownload({ ...params, profileId });
    },
    retry: false,
    onSuccess: (download) => {
      if (!download) return;
      showToast({ title: t('download_started'), message: download.title });
    },
    onError: handleError,
  });

  const seasonMutation = useMutation({
    mutationFn: async (params: Omit<StartSeasonDownloadParams, 'profileId'>) => {
      if (!profileId) return null;
      return startSeasonDownload({ ...params, profileId });
    },
    retry: false,
    onSuccess: (result) => {
      if (!result) return;
      showToast({
        title: t('download_season_started', { started: result.started }),
        message:
          result.skipped > 0
            ? t('download_season_skipped', { skipped: result.skipped })
            : undefined,
        preset: result.started > 0 ? 'success' : 'warning',
      });
    },
    onError: handleError,
  });

  const removeAllMutation = useMutation({
    mutationFn: async () => {
      if (!profileId) return;
      await removeAllDownloadsForProfile(profileId);
    },
    retry: false,
    onError: handleError,
  });

  const retryMutation = useMutation({
    mutationFn: (id: number) => retryDownload(id),
    retry: false,
    onError: handleError,
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => removeDownload(id),
    retry: false,
    onError: handleError,
  });

  return {
    startDownload: startMutation.mutate,
    isStarting: startMutation.isPending,
    startSeasonDownload: seasonMutation.mutate,
    removeAllDownloads: removeAllMutation.mutateAsync,
    retryDownload: retryMutation.mutate,
    removeDownload: removeMutation.mutate,
  };
}

/** Stable handlers for the actions of a `DownloadItem`. */
export function useDownloadItemHandlers() {
  const { t } = useTranslation('media');
  const { openStreamTarget } = useMediaNavigation();
  const { retryDownload: retry, removeDownload: remove } = useDownloadActions();

  const onPlay = useCallback(
    async (download: DbDownload) => {
      if (!(await downloadFileExists(download.fileName))) {
        debug('fileMissing', { id: download.id });
        showToast({ title: t('download_file_missing'), preset: 'error' });
        return;
      }

      await openStreamTarget({
        metaId: download.metaId,
        videoId: download.videoId,
        type: download.type,
        title: download.title,
        target: { type: 'url', value: getDownloadFileUri(download.fileName) },
        streamId: download.streamId,
      });
    },
    [openStreamTarget, t]
  );

  const onRetry = useCallback((download: DbDownload) => retry(download.id), [retry]);
  const onRemove = useCallback((download: DbDownload) => remove(download.id), [remove]);

  return { onPlay, onRetry, onRemove };
}

export type DownloadMenuAction = 'delete-download' | 'download-season';

const DOWNLOAD_MENU_ACTIONS: readonly string[] = ['delete-download', 'download-season'];

/** Whether a context menu value belongs to the download entries. */
export const isDownloadMenuAction = (value: unknown): value is DownloadMenuAction =>
  typeof value === 'string' && DOWNLOAD_MENU_ACTIONS.includes(value);

interface UseDownloadMenuParams {
  metaId: string;
  /** Video whose download can be deleted from the menu. */
  videoId?: string;
  /** When provided, the menu offers to download a whole season. */
  onDownloadSeason?: () => void;
}

/**
 * Download entries for the context menus of a movie, series or episode:
 * "Download season" and, when the video has a download, "Delete download".
 */
export function useDownloadMenu({ metaId, videoId, onDownloadSeason }: UseDownloadMenuParams) {
  const { t } = useTranslation('media');
  const { data: download } = useDownloadForVideo(metaId, videoId, !!videoId);
  const { removeDownload: remove } = useDownloadActions();

  const items = useMemo<PickerItem<DownloadMenuAction>[]>(() => {
    if (!DOWNLOADS_ENABLED) return [];
    const next: PickerItem<DownloadMenuAction>[] = [];

    if (onDownloadSeason) {
      next.push({
        label: t('download_season'),
        value: 'download-season',
        icon: 'download-outline',
      });
    }

    if (videoId && download) {
      const isActive = download.status === 'queued' || download.status === 'downloading';
      next.push({
        label: isActive ? t('download_cancel') : t('download_delete'),
        value: 'delete-download',
        icon: 'trash-outline',
        tone: 'destructive',
      });
    }

    return next;
  }, [download, onDownloadSeason, t, videoId]);

  const handleAction = useCallback(
    (action: DownloadMenuAction) => {
      if (action === 'download-season') {
        onDownloadSeason?.();
        return;
      }
      if (download) remove(download.id);
    },
    [download, onDownloadSeason, remove]
  );

  return { items, handleAction };
}

interface UseMenuWithDownloadsParams<T extends string> {
  metaId: string;
  /** Video whose download can be deleted from the menu. */
  videoId?: string;
  /** Offer "Download season" (series only). */
  withSeasonDownload?: boolean;
  /** The entries the menu already has. */
  items: PickerItem<T>[];
  /** Handles the entries the menu already has. */
  onAction: (action: T) => void;
}

/**
 * Extends an existing context menu with the download entries and routes
 * each chosen entry to the right handler.
 */
export function useMenuWithDownloads<T extends string>({
  metaId,
  videoId,
  withSeasonDownload = false,
  items,
  onAction,
}: UseMenuWithDownloadsParams<T>) {
  const [isSeasonDownloadVisible, setIsSeasonDownloadVisible] = useState(false);
  const openSeasonDownload = useCallback(() => setIsSeasonDownloadVisible(true), []);
  const closeSeasonDownload = useCallback(() => setIsSeasonDownloadVisible(false), []);

  const { items: downloadItems, handleAction: handleDownloadAction } = useDownloadMenu({
    metaId,
    videoId,
    onDownloadSeason: withSeasonDownload ? openSeasonDownload : undefined,
  });

  const mergedItems = useMemo<PickerItem<T | DownloadMenuAction>[]>(
    () => [...items, ...downloadItems],
    [downloadItems, items]
  );

  const handleAction = useCallback(
    (action: T | DownloadMenuAction) => {
      if (isDownloadMenuAction(action)) handleDownloadAction(action);
      else onAction(action);
    },
    [handleDownloadAction, onAction]
  );

  return { items: mergedItems, handleAction, isSeasonDownloadVisible, closeSeasonDownload };
}
