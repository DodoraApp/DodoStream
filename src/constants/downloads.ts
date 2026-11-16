/** Name of the directory inside the app's document directory that holds downloaded files. */
export const DOWNLOADS_DIRECTORY_NAME = 'downloads';

/** Prefix of the native transfer id of a download; the database id follows. */
export const DOWNLOAD_TASK_ID_PREFIX = 'download-';

/** Number of file transfers that run at the same time; further downloads wait for a free slot. */
export const MAX_CONCURRENT_DOWNLOADS = 3;

/** Minimum time between two live progress updates of one download (milliseconds). */
export const DOWNLOAD_PROGRESS_UI_INTERVAL_MS = 500;

/** Minimum time between two progress writes to the database for one download (milliseconds). */
export const DOWNLOAD_PROGRESS_PERSIST_INTERVAL_MS = 5000;
