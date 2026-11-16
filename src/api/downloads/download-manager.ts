import { AppState, type AppStateStatus, PermissionsAndroid, Platform } from 'react-native';

import { t } from 'i18next';

import {
  configureFileDownloads,
  deleteDownloadFile,
  type FileDownloadHandlers,
  type FileDownloadTask,
  getDownloadFileSize,
  getExistingFileDownloads,
  startFileDownload,
} from '@/api/downloads/download-fs';
import { fetchStreams } from '@/api/stremio/client';
import {
  DOWNLOAD_PROGRESS_PERSIST_INTERVAL_MS,
  DOWNLOAD_PROGRESS_UI_INTERVAL_MS,
  DOWNLOAD_TASK_ID_PREFIX,
  MAX_CONCURRENT_DOWNLOADS,
} from '@/constants/downloads';
import {
  createDownload,
  type DbDownload,
  deleteDownload,
  getDownloadById,
  getDownloadForVideo,
  listUnfinishedDownloads,
  markDownloadCompleted,
  markDownloadFailed,
  markDownloadStarted,
  removeProfileDownloads,
  updateDownloadProgress,
} from '@/db/queries/downloads';
import { useAppSettingsStore } from '@/store/app-settings.store';
import { useDownloadsStore } from '@/store/downloads.store';
import { showToast } from '@/store/toast.store';
import type { ContentType, Stream } from '@/types/stremio';
import { createDebugLogger } from '@/utils/debug';
import {
  buildDownloadFileName,
  findMatchingStream,
  getDownloadFileExtension,
  getStreamRequestHeaders,
  isStreamDownloadable,
} from '@/utils/downloads';
import { queryClient } from '@/utils/query';
import { getStreamStableId } from '@/utils/stream';

const debug = createDebugLogger('DownloadManager');

export const downloadKeys = {
  all: ['downloads-db'] as const,
  list: (profileId: string) => [...downloadKeys.all, 'list', profileId] as const,
  video: (profileId: string, metaId: string, videoId?: string) =>
    [...downloadKeys.all, 'video', profileId, metaId, videoId ?? '_'] as const,
};

export type DownloadErrorCode = 'not_downloadable' | 'already_exists' | 'not_found';

export class DownloadError extends Error {
  readonly code: DownloadErrorCode;

  constructor(code: DownloadErrorCode) {
    super(code);
    this.name = 'DownloadError';
    this.code = code;
  }
}

export type StartDownloadParams = {
  profileId: string;
  metaId: string;
  videoId?: string;
  type: ContentType;
  title: string;
  stream: Stream;
};

export type SeasonEpisode = {
  videoId: string;
  title: string;
};

export type StartSeasonDownloadParams = {
  profileId: string;
  metaId: string;
  type: ContentType;
  /** The stream the user picked; other episodes use the corresponding stream. */
  referenceStream: Stream;
  episodes: SeasonEpisode[];
};

export type SeasonDownloadResult = {
  started: number;
  skipped: number;
};

/**
 * File transfers known to this app process, keyed by download id. The native
 * side runs them (and limits how many transfer at once), so they also
 * continue while the JavaScript side is suspended in the background.
 */
const activeTasks = new Map<number, FileDownloadTask>();

/** True while transfers are paused because the app left the foreground. */
let pausedForBackground = false;

const getTaskId = (id: number) => `${DOWNLOAD_TASK_ID_PREFIX}${id}`;

const invalidateDownloads = () => queryClient.invalidateQueries({ queryKey: downloadKeys.all });

const isBackgroundEnabled = () => useAppSettingsStore.getState().backgroundDownloadsEnabled;

const removeFileQuietly = async (fileName: string) => {
  try {
    await deleteDownloadFile(fileName);
  } catch (error) {
    debug('deleteFileFailed', { fileName, error });
  }
};

const stopTaskQuietly = async (id: number, task: FileDownloadTask | undefined) => {
  if (!task) return;
  try {
    await task.cancel();
  } catch (error) {
    debug('cancelFailed', { id, error });
  }
};

const applyConfig = () => {
  configureFileDownloads({
    maxParallelDownloads: MAX_CONCURRENT_DOWNLOADS,
    showNotifications: isBackgroundEnabled(),
    texts: {
      title: t('media:downloads'),
      starting: t('media:download_notification_starting'),
      progress: t('media:download_notification_progress'),
      paused: t('media:download_notification_paused'),
    },
  });
};

/**
 * Android only shows the progress notification of a background transfer
 * when the user allows notifications. The transfer itself does not depend on it.
 */
const requestNotificationPermission = async () => {
  if (Platform.OS !== 'android' || !isBackgroundEnabled()) return;
  try {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  } catch (error) {
    debug('notificationPermissionFailed', { error });
  }
};

const createHandlers = (id: number): FileDownloadHandlers => {
  let lastUiUpdate = 0;
  let lastPersist = Date.now();

  return {
    onStart: () => {
      markDownloadStarted(id)
        .then(invalidateDownloads)
        .catch((error: unknown) => {
          debug('markStartedFailed', { id, error });
        });
    },
    onProgress: (progress) => {
      const now = Date.now();

      if (now - lastUiUpdate >= DOWNLOAD_PROGRESS_UI_INTERVAL_MS) {
        lastUiUpdate = now;
        useDownloadsStore.getState().setProgress(id, progress);
      }

      if (now - lastPersist >= DOWNLOAD_PROGRESS_PERSIST_INTERVAL_MS) {
        lastPersist = now;
        updateDownloadProgress(id, progress.bytesDownloaded, progress.bytesTotal).catch(
          (error: unknown) => {
            debug('persistProgressFailed', { id, error });
          }
        );
      }
    },
  };
};

const finishCompleted = async (download: DbDownload, bytesTotal?: number) => {
  await markDownloadCompleted(download.id, bytesTotal);
  debug('completed', { id: download.id, bytesTotal });
  showToast({
    title: t('media:download_completed'),
    message: download.title,
    preset: 'success',
  });
};

const finishFailed = async (download: DbDownload, message?: string) => {
  debug('failed', { id: download.id, message });
  await removeFileQuietly(download.fileName);
  await markDownloadFailed(download.id, message);
  showToast({
    title: t('media:download_failed'),
    message: download.title,
    preset: 'error',
  });
};

/** Follows a transfer until it settles and writes the final state. */
const track = (download: DbDownload, task: FileDownloadTask): void => {
  const { id } = download;
  activeTasks.set(id, task);

  // A task that is no longer registered was canceled; its row and file are already gone.
  const isCurrent = () => activeTasks.get(id) === task;

  void task.promise
    .then(async (result) => {
      if (!isCurrent()) return;
      activeTasks.delete(id);
      await finishCompleted(download, result.bytesTotal);
    })
    .catch(async (error: unknown) => {
      if (!isCurrent()) return;
      activeTasks.delete(id);
      await finishFailed(download, error instanceof Error ? error.message : undefined);
    })
    .catch((error: unknown) => {
      debug('finalizeFailed', { id, error });
    })
    .finally(() => {
      useDownloadsStore.getState().clearProgress(id);
      void invalidateDownloads();
    });
};

const runDownload = (download: DbDownload): void => {
  track(
    download,
    startFileDownload({
      taskId: getTaskId(download.id),
      url: download.sourceUrl,
      fileName: download.fileName,
      headers: download.requestHeaders,
      title: download.title,
      ...createHandlers(download.id),
    })
  );
};

/**
 * Starts downloading a stream for offline playback. Several downloads
 * transfer at the same time; further ones wait until a slot is free.
 * A profile holds at most one download per video; a failed attempt is replaced.
 */
export async function startDownload(params: StartDownloadParams): Promise<DbDownload> {
  const { profileId, metaId, videoId, type, title, stream } = params;

  if (!stream.url || !isStreamDownloadable(stream)) {
    throw new DownloadError('not_downloadable');
  }

  const existing = await getDownloadForVideo(profileId, metaId, videoId);
  if (existing && existing.status !== 'failed') {
    throw new DownloadError('already_exists');
  }
  if (existing) {
    await removeFileQuietly(existing.fileName);
  }

  const download = await createDownload({
    profileId,
    metaId,
    videoId,
    type,
    title,
    streamId: getStreamStableId(stream),
    streamTitle: stream.title ?? stream.name ?? undefined,
    sourceUrl: stream.url,
    requestHeaders: getStreamRequestHeaders(stream),
    fileName: buildDownloadFileName(
      metaId,
      videoId,
      getDownloadFileExtension(stream),
      Date.now().toString(36)
    ),
  });

  debug('start', { id: download.id, metaId, videoId, hasHeaders: !!download.requestHeaders });
  void requestNotificationPermission();
  runDownload(download);
  await invalidateDownloads();
  return download;
}

/**
 * Starts several episodes at once. For every episode the addon of the
 * reference stream is asked for its streams and the corresponding one
 * (same binge group or name) is downloaded. Episodes that already have a
 * download or offer no corresponding direct stream are skipped.
 */
export async function startSeasonDownload(
  params: StartSeasonDownloadParams
): Promise<SeasonDownloadResult> {
  const { profileId, metaId, type, referenceStream, episodes } = params;
  const { addonManifestUrl } = referenceStream;

  if (!addonManifestUrl || !isStreamDownloadable(referenceStream)) {
    throw new DownloadError('not_downloadable');
  }

  const result: SeasonDownloadResult = { started: 0, skipped: 0 };

  // One request at a time keeps the load on the addon low.
  for (const episode of episodes) {
    try {
      const existing = await getDownloadForVideo(profileId, metaId, episode.videoId);
      if (existing && existing.status !== 'failed') {
        result.skipped += 1;
        continue;
      }

      const response = await fetchStreams(addonManifestUrl, type, episode.videoId);
      const candidates = (response.streams ?? []).map((stream) => ({
        ...stream,
        addonId: referenceStream.addonId,
        addonName: referenceStream.addonName,
        addonManifestUrl,
      }));
      const stream = findMatchingStream(referenceStream, candidates);
      if (!stream) {
        debug('seasonEpisodeNoMatch', { videoId: episode.videoId, count: candidates.length });
        result.skipped += 1;
        continue;
      }

      await startDownload({
        profileId,
        metaId,
        videoId: episode.videoId,
        type,
        title: episode.title,
        stream,
      });
      result.started += 1;
    } catch (error) {
      debug('seasonEpisodeFailed', { videoId: episode.videoId, error });
      result.skipped += 1;
    }
  }

  return result;
}

/** Restarts a failed download from the stored URL and request headers. */
export async function retryDownload(id: number): Promise<DbDownload> {
  const existing = await getDownloadById(id);
  if (!existing) throw new DownloadError('not_found');
  if (existing.status !== 'failed') throw new DownloadError('already_exists');

  await removeFileQuietly(existing.fileName);

  const download = await createDownload({
    profileId: existing.profileId,
    metaId: existing.metaId,
    videoId: existing.videoId,
    type: existing.type,
    title: existing.title,
    streamId: existing.streamId,
    streamTitle: existing.streamTitle,
    sourceUrl: existing.sourceUrl,
    requestHeaders: existing.requestHeaders,
    fileName: existing.fileName,
  });

  debug('retry', { id: download.id });
  runDownload(download);
  await invalidateDownloads();
  return download;
}

/** Cancels a running download or deletes a finished one, including its file. */
export async function removeDownload(id: number): Promise<void> {
  const task = activeTasks.get(id);
  activeTasks.delete(id);
  await stopTaskQuietly(id, task);

  const removed = await deleteDownload(id);
  if (removed) await removeFileQuietly(removed.fileName);

  useDownloadsStore.getState().clearProgress(id);
  debug('removed', { id, wasRunning: !!task });
  await invalidateDownloads();
}

/** Removes all downloads of a profile, including running ones and their files. */
export async function removeAllDownloadsForProfile(profileId: string): Promise<void> {
  const removed = await removeProfileDownloads(profileId);

  for (const download of removed) {
    const task = activeTasks.get(download.id);
    activeTasks.delete(download.id);
    await stopTaskQuietly(download.id, task);
    useDownloadsStore.getState().clearProgress(download.id);
    await removeFileQuietly(download.fileName);
  }

  await invalidateDownloads();
}

/**
 * Brings the database back in sync after an app start. Transfers the system
 * kept running are followed again; downloads whose transfer is gone are
 * marked as completed or failed depending on what is on disk.
 */
export async function recoverDownloads(): Promise<void> {
  const unfinished = (await listUnfinishedDownloads()).filter(
    (download) => !activeTasks.has(download.id)
  );
  if (unfinished.length === 0) return;

  const existing = await getExistingFileDownloads().catch((error: unknown) => {
    debug('listExistingFailed', { error });
    return [];
  });
  const existingById = new Map(existing.map((entry) => [entry.taskId, entry]));

  for (const download of unfinished) {
    const entry = existingById.get(getTaskId(download.id));

    try {
      if (entry?.state === 'running' || entry?.state === 'paused') {
        debug('reattached', { id: download.id, state: entry.state });
        const task = entry.attach(createHandlers(download.id));
        track(download, task);
        if (entry.state === 'running') await markDownloadStarted(download.id);
        else if (!pausedForBackground) await task.resume();
        continue;
      }

      const size = await getDownloadFileSize(download.fileName);
      const isComplete =
        entry?.state === 'done' ||
        (size !== undefined && !!download.bytesTotal && size >= download.bytesTotal);

      if (isComplete) {
        await markDownloadCompleted(download.id, size ?? download.bytesTotal);
      } else {
        await removeFileQuietly(download.fileName);
        await markDownloadFailed(download.id);
      }
      debug('recovered', { id: download.id, isComplete });
    } catch (error) {
      debug('recoverFailed', { id: download.id, error });
    }
  }

  await invalidateDownloads();
}

const pauseForBackground = async () => {
  if (pausedForBackground || activeTasks.size === 0) return;
  pausedForBackground = true;
  debug('pauseForBackground', { count: activeTasks.size });
  await Promise.all(
    [...activeTasks.entries()].map(([id, task]) =>
      task.pause().catch((error: unknown) => debug('pauseFailed', { id, error }))
    )
  );
};

const resumeFromBackground = async () => {
  if (!pausedForBackground) return;
  pausedForBackground = false;
  debug('resumeFromBackground', { count: activeTasks.size });
  await Promise.all(
    [...activeTasks.entries()].map(([id, task]) =>
      task.resume().catch((error: unknown) => debug('resumeFailed', { id, error }))
    )
  );
};

/**
 * Applies the "continue in background" setting when the app moves between
 * foreground and background. With the setting off, transfers pause while
 * the app is not visible and continue when it returns.
 */
export async function handleAppStateChange(state: AppStateStatus): Promise<void> {
  if (state === 'active') {
    await resumeFromBackground();
    return;
  }
  if (state === 'background' && !isBackgroundEnabled()) {
    await pauseForBackground();
  }
}

let isInitialized = false;

/** Call once on app start, after the database is ready. */
export async function initializeDownloads(): Promise<void> {
  if (isInitialized) return;
  isInitialized = true;

  applyConfig();
  useAppSettingsStore.subscribe((state, previous) => {
    if (state.backgroundDownloadsEnabled !== previous.backgroundDownloadsEnabled) applyConfig();
  });
  AppState.addEventListener('change', (state) => {
    void handleAppStateChange(state);
  });

  await recoverDownloads();
}

/** Whether a transfer for this download is known to this app process. */
export const isDownloadRunning = (id: number): boolean => activeTasks.has(id);
