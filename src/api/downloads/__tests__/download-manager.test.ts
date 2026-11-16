/**
 * Tests for the download manager against a real SQLite database
 * (expo-sqlite-mock) with a mocked native transfer layer.
 */

import type {
  ExistingFileDownload,
  FileDownloadHandlers,
  FileDownloadResult,
  FileDownloadTask,
  StartFileDownloadParams,
} from '@/api/downloads/download-fs';
import * as downloadFs from '@/api/downloads/download-fs';
import { fetchStreams } from '@/api/stremio/client';
import { db, initializeDatabase } from '@/db/client';
import {
  createDownload,
  getDownloadById,
  getDownloadForVideo,
  listDownloadsForProfile,
  markDownloadStarted,
  updateDownloadProgress,
} from '@/db/queries/downloads';
import { getWatchHistoryItem } from '@/db/queries/watchHistory';
import { downloads } from '@/db/schema';
import { useAppSettingsStore } from '@/store/app-settings.store';
import { useDownloadsStore } from '@/store/downloads.store';
import { showToast } from '@/store/toast.store';
import type { Stream } from '@/types/stremio';

import {
  DownloadError,
  handleAppStateChange,
  handlePlaybackEnded,
  isDownloadRunning,
  recoverDownloads,
  removeAllDownloadsForProfile,
  removeDownload,
  retryDownload,
  startDownload,
  startSeasonDownload,
} from '../download-manager';

jest.mock('@/api/downloads/download-fs');
jest.mock('@/constants/downloads', () => ({
  ...jest.requireActual('@/constants/downloads'),
  DOWNLOAD_AFTER_PLAYBACK_DELAY_MS: 0,
}));
jest.mock('@/db/queries/watchHistory', () => ({ getWatchHistoryItem: jest.fn() }));
jest.mock('@/api/stremio/client', () => ({ fetchStreams: jest.fn() }));
jest.mock('i18next', () => ({ t: (key: string) => key }));
jest.mock('@/store/toast.store', () => ({ showToast: jest.fn() }));
jest.mock('@/utils/debug', () => ({ createDebugLogger: () => jest.fn() }));
jest.mock('@/utils/query', () => ({
  queryClient: { invalidateQueries: jest.fn(() => Promise.resolve()) },
}));

type Transfer = {
  handlers: FileDownloadHandlers;
  resolve: (result: FileDownloadResult) => void;
  reject: (error: unknown) => void;
  task: jest.Mocked<Omit<FileDownloadTask, 'promise'>> & Pick<FileDownloadTask, 'promise'>;
};

const mockedFs = jest.mocked(downloadFs);
const mockedFetchStreams = jest.mocked(fetchStreams);
const mockedGetWatchHistoryItem = jest.mocked(getWatchHistoryItem);
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

const createTransfer = (handlers: FileDownloadHandlers): Transfer => {
  let resolve!: Transfer['resolve'];
  let reject!: Transfer['reject'];
  const promise = new Promise<FileDownloadResult>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {
    handlers,
    resolve,
    reject,
    task: {
      promise,
      cancel: jest.fn(() => Promise.resolve()),
      pause: jest.fn(() => Promise.resolve()),
      resume: jest.fn(() => Promise.resolve()),
    },
  };
};

describe('download manager', () => {
  const profileId = 'download-manager-profile';
  let started: { params: StartFileDownloadParams; transfer: Transfer }[];

  const directStream = (overrides: Record<string, unknown> = {}) =>
    ({
      addonId: 'addon-a',
      addonManifestUrl: 'https://addon.example/manifest.json',
      name: 'Addon 1080p',
      title: '1080p',
      url: 'https://cdn.example/movie.mkv',
      ...overrides,
    }) as unknown as Stream;

  const start = (overrides: Record<string, unknown> = {}, metaId = 'tt-manager-1') =>
    startDownload({
      profileId,
      metaId,
      type: 'movie',
      title: 'Manager Movie',
      stream: directStream(overrides),
    });

  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    started = [];
    await db.delete(downloads);
    useDownloadsStore.setState({ progressById: {}, watchedDownloads: [] });
    useAppSettingsStore.setState({
      backgroundDownloadsEnabled: true,
      downloadAfterWatching: 'ask',
    });
    mockedFs.getDownloadFileUri.mockImplementation((fileName) => `file:///downloads/${fileName}`);

    mockedFs.deleteDownloadFile.mockResolvedValue(undefined);
    mockedFs.getDownloadFileSize.mockResolvedValue(undefined);
    mockedFs.getExistingFileDownloads.mockResolvedValue([]);
    mockedFs.startFileDownload.mockImplementation((params) => {
      const transfer = createTransfer(params);
      started.push({ params, transfer });
      return transfer.task;
    });
  });

  afterEach(async () => {
    // Bring the app back to the foreground and drop transfers a test left
    // open, so no state leaks into the next test.
    await handleAppStateChange('active');
    for (const row of await db.select({ id: downloads.id }).from(downloads)) {
      if (isDownloadRunning(row.id)) await removeDownload(row.id);
    }
  });

  describe('startDownload', () => {
    it('starts a transfer with the stream URL, a safe file name and the addon headers', async () => {
      const download = await start({
        behaviorHints: { proxyHeaders: { request: { Referer: 'https://cdn.example/' } } },
      });

      expect(started).toHaveLength(1);
      expect(started[0].params.taskId).toBe(`download-${download.id}`);
      expect(started[0].params.url).toBe('https://cdn.example/movie.mkv');
      expect(started[0].params.headers).toEqual({ Referer: 'https://cdn.example/' });
      expect(started[0].params.fileName).toMatch(/^tt-manager-1_[a-z0-9]+\.mkv$/);
      expect(started[0].params.title).toBe('Manager Movie');
      expect(download.status).toBe('queued');
      expect(isDownloadRunning(download.id)).toBe(true);
    });

    it('rejects streams that are not direct files without touching the database', async () => {
      await expect(start({ url: 'https://cdn.example/index.m3u8' })).rejects.toMatchObject({
        code: 'not_downloadable',
      });
      await expect(start({ url: undefined, infoHash: 'hash' })).rejects.toBeInstanceOf(
        DownloadError
      );

      expect(started).toHaveLength(0);
      expect(await listDownloadsForProfile(profileId)).toHaveLength(0);
    });

    it('marks the download failed when the transfer cannot be created', async () => {
      mockedFs.startFileDownload.mockImplementationOnce(() => {
        throw new Error('No space left on device');
      });

      await expect(start()).rejects.toThrow('No space left on device');

      const [row] = await listDownloadsForProfile(profileId);
      expect(row.status).toBe('failed');
      expect(row.errorMessage).toBe('No space left on device');
      expect(isDownloadRunning(row.id)).toBe(false);
      // A failed attempt can be retried right away.
      await expect(retryDownload(row.id)).resolves.toMatchObject({ status: 'queued' });
    });

    it('refuses a second download for a video that is running or finished', async () => {
      await start();
      await expect(start()).rejects.toMatchObject({ code: 'already_exists' });

      started[0].transfer.resolve({ bytesTotal: 100 });
      await flush();
      await expect(start()).rejects.toMatchObject({ code: 'already_exists' });
      expect(started).toHaveLength(1);
    });

    it('lets several videos download at the same time', async () => {
      const first = await start({}, 'tt-parallel-1');
      const second = await start({}, 'tt-parallel-2');

      expect(started).toHaveLength(2);
      expect(isDownloadRunning(first.id)).toBe(true);
      expect(isDownloadRunning(second.id)).toBe(true);
    });

    it('replaces a failed download when a new stream is chosen for the same video', async () => {
      const first = await start();
      started[0].transfer.reject(new Error('network'));
      await flush();

      const second = await start({ url: 'https://other.example/movie.mp4' });

      expect(second.id).toBe(first.id);
      expect(second.sourceUrl).toBe('https://other.example/movie.mp4');
      expect(await listDownloadsForProfile(profileId)).toHaveLength(1);
    });
  });

  describe('transfer lifecycle', () => {
    it('moves to downloading when the transfer begins and shows live progress', async () => {
      const download = await start();

      started[0].transfer.handlers.onStart?.();
      await flush();
      started[0].transfer.handlers.onProgress?.({ bytesDownloaded: 50, bytesTotal: 100 });
      started[0].transfer.handlers.onProgress?.({ bytesDownloaded: 60, bytesTotal: 100 });

      expect((await getDownloadById(download.id))?.status).toBe('downloading');
      // The second event arrives inside the throttle window.
      expect(useDownloadsStore.getState().progressById[download.id]).toEqual({
        bytesDownloaded: 50,
        bytesTotal: 100,
      });
    });

    it('marks the download completed and tells the user', async () => {
      const download = await start();

      started[0].transfer.resolve({ bytesTotal: 100 });
      await flush();

      const stored = await getDownloadById(download.id);
      expect(stored?.status).toBe('completed');
      expect(stored?.bytesDownloaded).toBe(100);
      expect(isDownloadRunning(download.id)).toBe(false);
      expect(useDownloadsStore.getState().progressById[download.id]).toBeUndefined();
      expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ preset: 'success' }));
    });

    it('marks the download failed and removes the partial file', async () => {
      const download = await start();

      started[0].transfer.reject(new Error('HTTP 403'));
      await flush();

      const stored = await getDownloadById(download.id);
      expect(stored?.status).toBe('failed');
      expect(stored?.errorMessage).toBe('HTTP 403');
      expect(mockedFs.deleteDownloadFile).toHaveBeenCalledWith(download.fileName);
      expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ preset: 'error' }));
    });
  });

  describe('removeDownload', () => {
    it('cancels a running download: stops the transfer, removes row and file, stays silent', async () => {
      const download = await start();

      await removeDownload(download.id);
      // A stopped transfer may still report an error; that must not revive the row.
      started[0].transfer.reject(new Error('canceled'));
      await flush();

      expect(started[0].transfer.task.cancel).toHaveBeenCalledTimes(1);
      expect(await getDownloadById(download.id)).toBeNull();
      expect(mockedFs.deleteDownloadFile).toHaveBeenCalledWith(download.fileName);
      expect(isDownloadRunning(download.id)).toBe(false);
      expect(showToast).not.toHaveBeenCalled();
    });

    it('deletes a finished download including its file', async () => {
      const download = await start();
      started[0].transfer.resolve({ bytesTotal: 100 });
      await flush();
      mockedFs.deleteDownloadFile.mockClear();

      await removeDownload(download.id);

      expect(await getDownloadById(download.id)).toBeNull();
      expect(mockedFs.deleteDownloadFile).toHaveBeenCalledWith(download.fileName);
    });

    it('removes every download of a profile, including running transfers', async () => {
      const running = await start();
      const other = await startDownload({
        profileId: 'download-manager-other',
        metaId: 'tt-manager-1',
        type: 'movie',
        title: 'Other profile',
        stream: directStream(),
      });

      await removeAllDownloadsForProfile(profileId);

      expect(started[0].transfer.task.cancel).toHaveBeenCalledTimes(1);
      expect(await listDownloadsForProfile(profileId)).toHaveLength(0);
      expect(mockedFs.deleteDownloadFile).toHaveBeenCalledWith(running.fileName);
      expect(isDownloadRunning(other.id)).toBe(true);
    });
  });

  describe('retryDownload', () => {
    it('retries a failed download with the stored URL and headers', async () => {
      const download = await start({
        behaviorHints: { proxyHeaders: { request: { Referer: 'https://cdn.example/' } } },
      });
      started[0].transfer.reject(new Error('network'));
      await flush();

      const retried = await retryDownload(download.id);

      expect(retried.id).toBe(download.id);
      expect(retried.status).toBe('queued');
      expect(started).toHaveLength(2);
      expect(started[1].params.url).toBe('https://cdn.example/movie.mkv');
      expect(started[1].params.headers).toEqual({ Referer: 'https://cdn.example/' });
    });

    it('only retries failed downloads', async () => {
      const download = await start();

      await expect(retryDownload(download.id)).rejects.toMatchObject({ code: 'already_exists' });
      await expect(retryDownload(987654)).rejects.toMatchObject({ code: 'not_found' });
    });
  });

  describe('startSeasonDownload', () => {
    const reference = directStream({
      url: 'https://cdn.example/s1e1.mkv',
      behaviorHints: { bingeGroup: 'addon|1080p' },
    });
    const episodes = [
      { videoId: 'tt-show:1:2', title: 'Show S1E2' },
      { videoId: 'tt-show:1:3', title: 'Show S1E3' },
      { videoId: 'tt-show:1:4', title: 'Show S1E4' },
    ];
    const season = () =>
      startSeasonDownload({
        profileId,
        metaId: 'tt-show',
        type: 'series',
        referenceStream: reference,
        episodes,
      });

    it('downloads the corresponding stream of every episode from the same addon', async () => {
      mockedFetchStreams.mockImplementation(async (_manifestUrl, _type, id) => ({
        streams: [
          { name: 'Addon 720p', url: `https://cdn.example/${id}-720.mkv` },
          {
            name: 'Addon 1080p',
            url: `https://cdn.example/${id}-1080.mkv`,
            behaviorHints: { bingeGroup: 'addon|1080p' },
          },
        ] as unknown as Stream[],
      }));

      const result = await season();

      expect(result).toEqual({ started: 3, skipped: 0, unmatched: 0, failed: 0 });
      expect(mockedFetchStreams).toHaveBeenCalledWith(
        'https://addon.example/manifest.json',
        'series',
        'tt-show:1:2'
      );
      expect(started.map((entry) => entry.params.url)).toEqual([
        'https://cdn.example/tt-show:1:2-1080.mkv',
        'https://cdn.example/tt-show:1:3-1080.mkv',
        'https://cdn.example/tt-show:1:4-1080.mkv',
      ]);
      expect((await getDownloadForVideo(profileId, 'tt-show', 'tt-show:1:3'))?.title).toBe(
        'Show S1E3'
      );
    });

    it('skips downloaded episodes and records the ones without a stream for a manual choice', async () => {
      await startDownload({
        profileId,
        metaId: 'tt-show',
        videoId: 'tt-show:1:2',
        type: 'series',
        title: 'Show S1E2',
        stream: directStream(),
      });
      mockedFetchStreams.mockImplementation(async (_manifestUrl, _type, id) => {
        if (id === 'tt-show:1:3') throw new Error('addon down');
        return {
          streams: [
            { name: 'Addon 720p', url: `https://cdn.example/${id}-720.mkv` },
          ] as unknown as Stream[],
        };
      });

      const result = await season();

      expect(result).toEqual({ started: 0, skipped: 1, unmatched: 2, failed: 0 });
      expect(started).toHaveLength(1);
      const noMatch = await getDownloadForVideo(profileId, 'tt-show', 'tt-show:1:4');
      expect(noMatch?.status).toBe('needs_stream');
      expect(noMatch?.title).toBe('Show S1E4');
      // An unreachable addon is a missing stream too, but keeps its reason.
      const unreachable = await getDownloadForVideo(profileId, 'tt-show', 'tt-show:1:3');
      expect(unreachable?.status).toBe('needs_stream');
      expect(unreachable?.errorMessage).toBe('streams_unavailable');
      expect(noMatch?.errorMessage).toBeUndefined();

      // Picking a stream for such an episode replaces the placeholder.
      const picked = await startDownload({
        profileId,
        metaId: 'tt-show',
        videoId: 'tt-show:1:4',
        type: 'series',
        title: 'Show S1E4',
        stream: directStream({ url: 'https://cdn.example/manual.mkv' }),
      });
      expect(picked.id).toBe(noMatch?.id);
      expect(picked.status).toBe('queued');
      // A placeholder has no file, so nothing may be deleted for it.
      expect(mockedFs.deleteDownloadFile).not.toHaveBeenCalledWith('');
    });

    it('downloads the reference episode with exactly the chosen stream', async () => {
      mockedFetchStreams.mockImplementation(async (_manifestUrl, _type, id) => ({
        streams: [
          {
            name: 'Addon 1080p',
            url: `https://cdn.example/${id}-1080.mkv`,
            behaviorHints: { bingeGroup: 'addon|1080p' },
          },
        ] as unknown as Stream[],
      }));
      const referenceEpisode = { videoId: 'tt-show:1:1', title: 'Show S1E1' };

      const result = await startSeasonDownload({
        profileId,
        metaId: 'tt-show',
        type: 'series',
        referenceStream: reference,
        referenceEpisode,
        episodes: [referenceEpisode, ...episodes],
      });

      expect(result).toEqual({ started: 4, skipped: 0, unmatched: 0, failed: 0 });
      expect(started[0].params.url).toBe('https://cdn.example/s1e1.mkv');
      // No stream lookup for the episode the user picked the stream for.
      expect(mockedFetchStreams).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'tt-show:1:1'
      );
      expect(mockedFetchStreams).toHaveBeenCalledTimes(3);
    });

    it('reports an episode whose download cannot start as failed, not as missing a stream', async () => {
      mockedFetchStreams.mockImplementation(async (_manifestUrl, _type, id) => ({
        streams: [
          {
            name: 'Addon 1080p',
            url: `https://cdn.example/${id}-1080.mkv`,
            behaviorHints: { bingeGroup: 'addon|1080p' },
          },
        ] as unknown as Stream[],
      }));
      mockedFs.startFileDownload.mockImplementationOnce(() => {
        throw new Error('No space left on device');
      });

      const result = await season();

      expect(result).toEqual({ started: 2, skipped: 0, unmatched: 0, failed: 1 });
      const broken = await getDownloadForVideo(profileId, 'tt-show', 'tt-show:1:2');
      expect(broken?.status).toBe('failed');
      expect(broken?.errorMessage).toBe('No space left on device');
    });

    it('needs a direct reference stream that knows its addon', async () => {
      await expect(
        startSeasonDownload({
          profileId,
          metaId: 'tt-show',
          type: 'series',
          referenceStream: directStream({ addonManifestUrl: undefined }),
          episodes,
        })
      ).rejects.toMatchObject({ code: 'not_downloadable' });
      expect(mockedFetchStreams).not.toHaveBeenCalled();
    });
  });

  describe('handlePlaybackEnded', () => {
    const finishDownload = async () => {
      const download = await start();
      started[0].transfer.resolve({ bytesTotal: 100 });
      await flush();
      jest.mocked(showToast).mockClear();
      mockedFs.deleteDownloadFile.mockClear();
      return download;
    };
    const watched = (progressSeconds: number) =>
      mockedGetWatchHistoryItem.mockResolvedValue({
        progressSeconds,
        durationSeconds: 100,
      } as Awaited<ReturnType<typeof getWatchHistoryItem>>);
    const ended = (download: { fileName: string }, source?: string) =>
      handlePlaybackEnded({
        profileId,
        metaId: 'tt-manager-1',
        source: source ?? `file:///downloads/${download.fileName}`,
      });

    it('queues a question when a download was watched to the end', async () => {
      const download = await finishDownload();
      watched(95);

      await ended(download);

      expect(useDownloadsStore.getState().watchedDownloads.map((item) => item.id)).toEqual([
        download.id,
      ]);
      expect((await getDownloadById(download.id))?.status).toBe('completed');
    });

    it('deletes the download automatically when the setting says so', async () => {
      useAppSettingsStore.setState({ downloadAfterWatching: 'delete' });
      const download = await finishDownload();
      watched(95);

      await ended(download);

      expect(await getDownloadById(download.id)).toBeNull();
      expect(mockedFs.deleteDownloadFile).toHaveBeenCalledWith(download.fileName);
      expect(useDownloadsStore.getState().watchedDownloads).toHaveLength(0);
    });

    it('keeps a download that was not watched to the end', async () => {
      useAppSettingsStore.setState({ downloadAfterWatching: 'delete' });
      const download = await finishDownload();
      watched(40);

      await ended(download);

      expect((await getDownloadById(download.id))?.status).toBe('completed');
    });

    it('never touches a download when the title was streamed instead', async () => {
      useAppSettingsStore.setState({ downloadAfterWatching: 'delete' });
      const download = await finishDownload();
      watched(95);

      await ended(download, 'https://cdn.example/movie.mkv');
      await ended(download, 'file:///downloads/another-file.mkv');

      expect((await getDownloadById(download.id))?.status).toBe('completed');
    });

    it('does nothing when the setting is to keep downloads', async () => {
      useAppSettingsStore.setState({ downloadAfterWatching: 'keep' });
      const download = await finishDownload();
      watched(95);

      await ended(download);

      expect((await getDownloadById(download.id))?.status).toBe('completed');
      expect(useDownloadsStore.getState().watchedDownloads).toHaveLength(0);
      expect(mockedGetWatchHistoryItem).not.toHaveBeenCalled();
    });
  });

  describe('background setting', () => {
    it('keeps transfers running in the background when the setting is on', async () => {
      await start();

      await handleAppStateChange('background');

      expect(started[0].transfer.task.pause).not.toHaveBeenCalled();
    });

    it('pauses in the background and resumes in the foreground when the setting is off', async () => {
      useAppSettingsStore.setState({ backgroundDownloadsEnabled: false });
      await start();

      await handleAppStateChange('background');
      await handleAppStateChange('background');
      expect(started[0].transfer.task.pause).toHaveBeenCalledTimes(1);
      expect(started[0].transfer.task.resume).not.toHaveBeenCalled();

      await handleAppStateChange('active');
      await handleAppStateChange('active');
      expect(started[0].transfer.task.resume).toHaveBeenCalledTimes(1);
    });
  });

  describe('recoverDownloads', () => {
    const insertUnfinished = async (metaId: string, bytesTotal?: number) => {
      const download = await createDownload({
        profileId,
        metaId,
        type: 'movie',
        title: metaId,
        sourceUrl: `https://cdn.example/${metaId}.mkv`,
        fileName: `${metaId}_1.mkv`,
      });
      if (bytesTotal) {
        await markDownloadStarted(download.id);
        await updateDownloadProgress(download.id, 1, bytesTotal);
      }
      return download;
    };

    const existing = (
      id: number,
      state: ExistingFileDownload['state']
    ): { entry: ExistingFileDownload; getTransfer: () => Transfer | undefined } => {
      let transfer: Transfer | undefined;
      return {
        getTransfer: () => transfer,
        entry: {
          taskId: `download-${id}`,
          state,
          attach: (handlers) => {
            transfer = createTransfer(handlers);
            return transfer.task;
          },
        },
      };
    };

    it('follows a transfer again that kept running while the app was closed', async () => {
      const download = await insertUnfinished('tt-still-running');
      const running = existing(download.id, 'running');
      mockedFs.getExistingFileDownloads.mockResolvedValue([running.entry]);

      await recoverDownloads();

      expect(isDownloadRunning(download.id)).toBe(true);
      expect((await getDownloadById(download.id))?.status).toBe('downloading');

      running.getTransfer()?.resolve({ bytesTotal: 500 });
      await flush();
      expect((await getDownloadById(download.id))?.status).toBe('completed');
    });

    it('resumes a transfer that was left paused', async () => {
      const download = await insertUnfinished('tt-paused');
      const paused = existing(download.id, 'paused');
      mockedFs.getExistingFileDownloads.mockResolvedValue([paused.entry]);

      await recoverDownloads();

      expect(paused.getTransfer()?.task.resume).toHaveBeenCalledTimes(1);
      expect(isDownloadRunning(download.id)).toBe(true);
    });

    it('completes a download that finished while the app was closed', async () => {
      const reported = await insertUnfinished('tt-reported-done');
      const onDisk = await insertUnfinished('tt-complete-on-disk', 1000);
      mockedFs.getExistingFileDownloads.mockResolvedValue([existing(reported.id, 'done').entry]);
      mockedFs.getDownloadFileSize.mockImplementation(async (fileName) =>
        fileName === onDisk.fileName ? 1000 : 700
      );

      await recoverDownloads();

      expect((await getDownloadById(reported.id))?.status).toBe('completed');
      expect((await getDownloadById(reported.id))?.bytesTotal).toBe(700);
      expect((await getDownloadById(onDisk.id))?.status).toBe('completed');
      expect(mockedFs.deleteDownloadFile).not.toHaveBeenCalled();
    });

    it('fails a download whose transfer is gone and removes the partial file', async () => {
      const lost = await insertUnfinished('tt-lost', 1000);
      mockedFs.getDownloadFileSize.mockResolvedValue(400);

      await recoverDownloads();

      expect((await getDownloadById(lost.id))?.status).toBe('failed');
      expect(mockedFs.deleteDownloadFile).toHaveBeenCalledWith(lost.fileName);
    });

    it('leaves downloads of the current app run alone', async () => {
      const download = await start();

      await recoverDownloads();

      expect((await getDownloadById(download.id))?.status).toBe('queued');
      expect(mockedFs.getExistingFileDownloads).not.toHaveBeenCalled();
    });
  });
});
