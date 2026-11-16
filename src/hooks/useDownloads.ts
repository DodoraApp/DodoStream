import { useCallback } from 'react';
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
    enabled: !!profileId,
    staleTime: 0,
  });
}

/** The download of the active profile for one video, or null when there is none. */
export function useDownloadForVideo(metaId: string, videoId?: string) {
  const profileId = useProfileStore((state) => state.activeProfileId);

  return useQuery<DbDownload | null>({
    queryKey: profileId ? downloadKeys.video(profileId, metaId, videoId) : downloadKeys.all,
    queryFn: () => (profileId ? getDownloadForVideo(profileId, metaId, videoId) : null),
    enabled: !!profileId && !!metaId,
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
