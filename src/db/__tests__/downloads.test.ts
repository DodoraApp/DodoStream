/**
 * Integration tests for downloads database queries
 *
 * These tests use expo-sqlite-mock to test against a real SQLite database.
 * Critical business logic tested:
 * - createDownload: one download per profile and video, retries replace the row
 * - status transitions: queued, downloading with progress, completed, failed
 * - listUnfinishedDownloads: what has to be recovered after an app restart
 * - deleteDownload / removeProfileDownloads: return rows so files can be removed
 */

import type { MetaDetail } from '@/types/stremio';

import { db, initializeDatabase } from '../client';
import {
  createDownload,
  type CreateDownloadParams,
  deleteDownload,
  getDownloadById,
  getDownloadForVideo,
  listDownloadsForProfile,
  listUnfinishedDownloads,
  markDownloadCompleted,
  markDownloadFailed,
  markDownloadStarted,
  removeProfileDownloads,
  updateDownloadProgress,
} from '../queries/downloads';
import { upsertMetaCache } from '../queries/metaCache';
import { downloads, metaCache } from '../schema';

describe('downloads queries (integration)', () => {
  const profileId = 'downloads-test-profile';
  const otherProfileId = 'downloads-test-profile-2';

  const params = (overrides: Partial<CreateDownloadParams> = {}): CreateDownloadParams => ({
    profileId,
    metaId: 'tt-dl-1',
    type: 'movie',
    title: 'Download Movie',
    sourceUrl: 'https://example.com/movie.mkv',
    fileName: 'tt-dl-1_1.mkv',
    ...overrides,
  });

  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    await db.delete(downloads);
    await db.delete(metaCache);
  });

  describe('createDownload', () => {
    it('creates a queued row and round-trips request headers', async () => {
      const created = await createDownload(
        params({
          streamId: 'addon::https://example.com/movie.mkv',
          streamTitle: '1080p',
          requestHeaders: { Referer: 'https://example.com/' },
        })
      );

      expect(created.status).toBe('queued');
      expect(created.videoId).toBeUndefined();
      expect(created.bytesDownloaded).toBe(0);
      expect(created.bytesTotal).toBeUndefined();

      const stored = await getDownloadById(created.id);
      expect(stored?.requestHeaders).toEqual({ Referer: 'https://example.com/' });
      expect(stored?.streamTitle).toBe('1080p');
    });

    it('replaces a failed attempt for the same video instead of adding a second row', async () => {
      const first = await createDownload(params());
      await markDownloadStarted(first.id);
      await updateDownloadProgress(first.id, 500, 1000);
      await markDownloadFailed(first.id, 'network');

      const retry = await createDownload(params({ fileName: 'tt-dl-1_2.mkv' }));

      const rows = await listDownloadsForProfile(profileId);
      expect(rows).toHaveLength(1);
      expect(retry.id).toBe(first.id);
      expect(rows[0].status).toBe('queued');
      expect(rows[0].fileName).toBe('tt-dl-1_2.mkv');
      expect(rows[0].bytesDownloaded).toBe(0);
      expect(rows[0].bytesTotal).toBeUndefined();
      expect(rows[0].errorMessage).toBeUndefined();
    });

    it('keeps episodes of one series and other profiles apart', async () => {
      await createDownload(params({ metaId: 'tt-show', type: 'series', videoId: 'tt-show:1:1' }));
      await createDownload(params({ metaId: 'tt-show', type: 'series', videoId: 'tt-show:1:2' }));
      await createDownload(params({ profileId: otherProfileId, metaId: 'tt-show' }));

      expect(await listDownloadsForProfile(profileId)).toHaveLength(2);
      expect(await listDownloadsForProfile(otherProfileId)).toHaveLength(1);
      expect((await getDownloadForVideo(profileId, 'tt-show', 'tt-show:1:2'))?.videoId).toBe(
        'tt-show:1:2'
      );
      expect(await getDownloadForVideo(profileId, 'tt-show')).toBeNull();
    });
  });

  describe('status transitions', () => {
    it('moves from queued to downloading and stores progress', async () => {
      const created = await createDownload(params());
      await updateDownloadProgress(created.id, 100, 1000);
      expect((await getDownloadById(created.id))?.bytesDownloaded).toBe(0);

      await markDownloadStarted(created.id);
      await updateDownloadProgress(created.id, 250, 1000);

      const stored = await getDownloadById(created.id);
      expect(stored?.status).toBe('downloading');
      expect(stored?.bytesDownloaded).toBe(250);
      expect(stored?.bytesTotal).toBe(1000);
    });

    it('marks a download completed and ignores late progress events', async () => {
      const created = await createDownload(params());
      await markDownloadCompleted(created.id, 1000);
      await markDownloadStarted(created.id);
      await updateDownloadProgress(created.id, 10, 1000);

      const stored = await getDownloadById(created.id);
      expect(stored?.status).toBe('completed');
      expect(stored?.bytesDownloaded).toBe(1000);
      expect(stored?.completedAt).toBeGreaterThan(0);
    });

    it('marks a download failed with a message', async () => {
      const created = await createDownload(params());
      await markDownloadFailed(created.id, 'HTTP 403');

      const stored = await getDownloadById(created.id);
      expect(stored?.status).toBe('failed');
      expect(stored?.errorMessage).toBe('HTTP 403');
    });
  });

  describe('listUnfinishedDownloads', () => {
    it('returns waiting and transferring downloads of all profiles, not finished ones', async () => {
      const queued = await createDownload(params({ metaId: 'tt-queued' }));
      const running = await createDownload(params({ profileId: otherProfileId }));
      await markDownloadStarted(running.id);
      const done = await createDownload(params({ metaId: 'tt-done' }));
      await markDownloadCompleted(done.id, 10);
      const failed = await createDownload(params({ metaId: 'tt-failed' }));
      await markDownloadFailed(failed.id);

      const ids = (await listUnfinishedDownloads()).map((row) => row.id).sort();

      expect(ids).toEqual([queued.id, running.id].sort());
    });
  });

  describe('listDownloadsForProfile', () => {
    it('returns newest first with artwork from the meta cache', async () => {
      await upsertMetaCache({
        id: 'tt-dl-1',
        type: 'movie',
        name: 'Download Movie',
        poster: 'https://example.com/poster.jpg',
      } as MetaDetail);

      const first = await createDownload(params());
      const second = await createDownload(params({ metaId: 'tt-dl-2' }));

      const rows = await listDownloadsForProfile(profileId);
      expect(rows.map((row) => row.id)).toEqual([second.id, first.id]);
      expect(rows[1].imageUrl).toBe('https://example.com/poster.jpg');
      expect(rows[0].imageUrl).toBeUndefined();
    });
  });

  describe('deleting', () => {
    it('deleteDownload removes the row and returns it', async () => {
      const created = await createDownload(params());

      const deleted = await deleteDownload(created.id);

      expect(deleted?.fileName).toBe('tt-dl-1_1.mkv');
      expect(await getDownloadById(created.id)).toBeNull();
      expect(await deleteDownload(created.id)).toBeNull();
    });

    it('removeProfileDownloads only removes the given profile', async () => {
      await createDownload(params());
      await createDownload(params({ metaId: 'tt-dl-2', fileName: 'tt-dl-2_1.mkv' }));
      await createDownload(params({ profileId: otherProfileId }));

      const removed = await removeProfileDownloads(profileId);

      expect(removed.map((row) => row.fileName).sort()).toEqual(['tt-dl-1_1.mkv', 'tt-dl-2_1.mkv']);
      expect(await listDownloadsForProfile(profileId)).toHaveLength(0);
      expect(await listDownloadsForProfile(otherProfileId)).toHaveLength(1);
    });
  });
});
