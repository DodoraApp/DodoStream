import {
  completeHandler,
  createDownloadTask,
  directories,
  type DownloadTask,
  getExistingDownloadTasks,
  setConfig,
} from '@kesha-antonov/react-native-background-downloader';
import { Directory, File } from 'expo-file-system';

import { DOWNLOADS_DIRECTORY_NAME } from '@/constants/downloads';

/**
 * Thin layer over the native transfer and file APIs. Everything else works
 * with file names only and never touches paths or native tasks.
 */

export interface FileDownloadProgress {
  bytesDownloaded: number;
  bytesTotal?: number;
}

export interface FileDownloadResult {
  bytesTotal?: number;
}

export interface FileDownloadHandlers {
  /** The server answered and the transfer began. */
  onStart?: () => void;
  onProgress?: (progress: FileDownloadProgress) => void;
}

export interface FileDownloadTask {
  /** Resolves when the file is complete, rejects when the transfer failed. */
  promise: Promise<FileDownloadResult>;
  cancel: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
}

export interface StartFileDownloadParams extends FileDownloadHandlers {
  /** Stable id used to find the transfer again after an app restart. */
  taskId: string;
  url: string;
  fileName: string;
  headers?: Record<string, string>;
  /** Shown in the system notification of the transfer. */
  title?: string;
}

export interface ExistingFileDownload {
  taskId: string;
  state: 'running' | 'paused' | 'done' | 'failed';
  /** Follows the transfer again with new handlers. */
  attach: (handlers: FileDownloadHandlers) => FileDownloadTask;
}

export interface FileDownloadsConfig {
  maxParallelDownloads: number;
  /** Show a progress notification while a transfer runs. */
  showNotifications: boolean;
  texts: { title: string; starting: string; progress: string; paused: string };
}

const FILE_SCHEME = 'file://';

const toPositive = (value: number | undefined): number | undefined =>
  typeof value === 'number' && value > 0 ? value : undefined;

const getDownloadsDirectoryPath = (): string =>
  `${directories.documents}/${DOWNLOADS_DIRECTORY_NAME}`;

const getDownloadFilePath = (fileName: string): string =>
  `${getDownloadsDirectoryPath()}/${fileName}`;

/** `file://` URI of a downloaded file, as expected by the players. */
export const getDownloadFileUri = (fileName: string): string =>
  `${FILE_SCHEME}${getDownloadFilePath(fileName)}`;

const getFile = (fileName: string): File => new File(getDownloadFileUri(fileName));

const ensureDownloadsDirectory = (): void => {
  const directory = new Directory(`${FILE_SCHEME}${getDownloadsDirectoryPath()}`);
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
};

export async function downloadFileExists(fileName: string): Promise<boolean> {
  return getFile(fileName).exists;
}

/** Size of the file on disk in bytes, or undefined when it does not exist. */
export async function getDownloadFileSize(fileName: string): Promise<number | undefined> {
  const file = getFile(fileName);
  if (!file.exists) return undefined;
  return file.size ?? undefined;
}

export async function deleteDownloadFile(fileName: string): Promise<void> {
  const file = getFile(fileName);
  if (file.exists) file.delete();
}

export function configureFileDownloads(config: FileDownloadsConfig): void {
  setConfig({
    maxParallelDownloads: config.maxParallelDownloads,
    showNotificationsEnabled: config.showNotifications,
    notificationsGrouping: {
      enabled: config.showNotifications,
      mode: 'summaryOnly',
      texts: {
        downloadTitle: config.texts.title,
        downloadStarting: config.texts.starting,
        downloadProgress: config.texts.progress,
        downloadPaused: config.texts.paused,
        groupTitle: config.texts.title,
      },
    },
  });
}

const bind = (task: DownloadTask, handlers: FileDownloadHandlers): FileDownloadTask => {
  const promise = new Promise<FileDownloadResult>((resolve, reject) => {
    task
      .begin(() => handlers.onStart?.())
      .progress(({ bytesDownloaded, bytesTotal }) => {
        handlers.onProgress?.({ bytesDownloaded, bytesTotal: toPositive(bytesTotal) });
      })
      .done(({ bytesDownloaded, bytesTotal }) => {
        completeHandler(task.id);
        resolve({ bytesTotal: toPositive(bytesTotal) ?? toPositive(bytesDownloaded) });
      })
      .error(({ error, errorCode }) => {
        completeHandler(task.id);
        reject(new Error(error || `Download error ${errorCode}`));
      });
  });

  return {
    promise,
    cancel: () => task.stop(),
    pause: () => task.pause(),
    resume: () => task.resume(),
  };
};

/** Starts a transfer that keeps running while the app is in the background. */
export function startFileDownload(params: StartFileDownloadParams): FileDownloadTask {
  const { taskId, url, fileName, headers, title, ...handlers } = params;

  ensureDownloadsDirectory();

  const task = createDownloadTask({
    id: taskId,
    url,
    destination: getDownloadFilePath(fileName),
    headers,
    notificationTitle: title,
    groupId: DOWNLOADS_DIRECTORY_NAME,
  });
  const bound = bind(task, handlers);
  task.start();
  return bound;
}

const STATE_MAP: Record<DownloadTask['state'], ExistingFileDownload['state']> = {
  PENDING: 'running',
  DOWNLOADING: 'running',
  PAUSED: 'paused',
  DONE: 'done',
  FAILED: 'failed',
  STOPPED: 'failed',
};

/** Transfers the system still knows from an earlier run of the app. */
export async function getExistingFileDownloads(): Promise<ExistingFileDownload[]> {
  const tasks = await getExistingDownloadTasks();

  return tasks.map((task) => ({
    taskId: task.id,
    state: STATE_MAP[task.state],
    attach: (handlers) => bind(task, handlers),
  }));
}
