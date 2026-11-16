import { and, desc, eq, inArray } from 'drizzle-orm';

import { db, initializeDatabase } from '@/db/client';
import type { DownloadStatus } from '@/db/schema';
import { downloads, metaCache } from '@/db/schema';
import type { ContentType } from '@/types/stremio';

export type DbDownload = {
  id: number;
  profileId: string;
  metaId: string;
  videoId?: string;
  type: ContentType;
  title: string;
  streamId?: string;
  streamTitle?: string;
  sourceUrl: string;
  requestHeaders?: Record<string, string>;
  fileName: string;
  status: DownloadStatus;
  bytesDownloaded: number;
  bytesTotal?: number;
  errorMessage?: string;
  createdAt: number;
  completedAt?: number;
  imageUrl?: string;
};

export type CreateDownloadParams = {
  profileId: string;
  metaId: string;
  videoId?: string;
  type: ContentType;
  title: string;
  streamId?: string;
  streamTitle?: string;
  sourceUrl: string;
  requestHeaders?: Record<string, string>;
  fileName: string;
};

const downloadColumns = {
  id: downloads.id,
  profileId: downloads.profileId,
  metaId: downloads.metaId,
  videoId: downloads.videoId,
  type: downloads.type,
  title: downloads.title,
  streamId: downloads.streamId,
  streamTitle: downloads.streamTitle,
  sourceUrl: downloads.sourceUrl,
  requestHeaders: downloads.requestHeaders,
  fileName: downloads.fileName,
  status: downloads.status,
  bytesDownloaded: downloads.bytesDownloaded,
  bytesTotal: downloads.bytesTotal,
  errorMessage: downloads.errorMessage,
  createdAt: downloads.createdAt,
  completedAt: downloads.completedAt,
};

type DownloadRow = {
  [K in keyof typeof downloadColumns]: (typeof downloadColumns)[K]['_']['data'] | null;
} & { metaPoster?: string | null; metaBackground?: string | null };

const parseHeaders = (raw: string | null): Record<string, string> | undefined => {
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
    return parsed as Record<string, string>;
  } catch {
    return undefined;
  }
};

const toDbDownload = (row: DownloadRow): DbDownload => ({
  id: Number(row.id),
  profileId: row.profileId as string,
  metaId: row.metaId as string,
  videoId: row.videoId || undefined,
  type: row.type as ContentType,
  title: row.title as string,
  streamId: row.streamId ?? undefined,
  streamTitle: row.streamTitle ?? undefined,
  sourceUrl: row.sourceUrl as string,
  requestHeaders: parseHeaders(row.requestHeaders),
  fileName: row.fileName as string,
  status: row.status as DownloadStatus,
  bytesDownloaded: Number(row.bytesDownloaded ?? 0),
  bytesTotal: row.bytesTotal == null ? undefined : Number(row.bytesTotal),
  errorMessage: row.errorMessage ?? undefined,
  createdAt: Number(row.createdAt),
  completedAt: row.completedAt == null ? undefined : Number(row.completedAt),
  imageUrl: row.metaPoster ?? row.metaBackground ?? undefined,
});

/**
 * Creates the queued download row for a video, replacing any previous attempt.
 * A profile holds at most one download per video.
 */
export async function createDownload(params: CreateDownloadParams): Promise<DbDownload> {
  await initializeDatabase();

  const now = Date.now();
  const values = {
    type: params.type,
    title: params.title,
    streamId: params.streamId ?? null,
    streamTitle: params.streamTitle ?? null,
    sourceUrl: params.sourceUrl,
    requestHeaders: params.requestHeaders ? JSON.stringify(params.requestHeaders) : null,
    fileName: params.fileName,
    status: 'queued' as const,
    bytesDownloaded: 0,
    bytesTotal: null,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };

  const rows = await db
    .insert(downloads)
    .values({
      profileId: params.profileId,
      metaId: params.metaId,
      videoId: params.videoId ?? '',
      ...values,
    })
    .onConflictDoUpdate({
      target: [downloads.profileId, downloads.metaId, downloads.videoId],
      set: values,
    })
    .returning(downloadColumns);

  return toDbDownload(rows[0]);
}

/**
 * Records an episode a season download could not find a stream for, so it
 * shows up in the downloads and the user can pick a stream for it.
 */
export async function createUnmatchedDownload(
  params: Pick<CreateDownloadParams, 'profileId' | 'metaId' | 'videoId' | 'type' | 'title'>
): Promise<void> {
  await initializeDatabase();

  const now = Date.now();
  const values = {
    type: params.type,
    title: params.title,
    streamId: null,
    streamTitle: null,
    sourceUrl: '',
    requestHeaders: null,
    fileName: '',
    status: 'needs_stream' as const,
    bytesDownloaded: 0,
    bytesTotal: null,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };

  await db
    .insert(downloads)
    .values({
      profileId: params.profileId,
      metaId: params.metaId,
      videoId: params.videoId ?? '',
      ...values,
    })
    .onConflictDoUpdate({
      target: [downloads.profileId, downloads.metaId, downloads.videoId],
      set: values,
    });
}

export async function getDownloadById(id: number): Promise<DbDownload | null> {
  await initializeDatabase();

  const rows = await db.select(downloadColumns).from(downloads).where(eq(downloads.id, id));
  return rows[0] ? toDbDownload(rows[0]) : null;
}

export async function getDownloadForVideo(
  profileId: string,
  metaId: string,
  videoId?: string
): Promise<DbDownload | null> {
  await initializeDatabase();

  const rows = await db
    .select(downloadColumns)
    .from(downloads)
    .where(
      and(
        eq(downloads.profileId, profileId),
        eq(downloads.metaId, metaId),
        eq(downloads.videoId, videoId ?? '')
      )
    )
    .limit(1);

  return rows[0] ? toDbDownload(rows[0]) : null;
}

export async function listDownloadsForProfile(profileId: string): Promise<DbDownload[]> {
  await initializeDatabase();

  const rows = await db
    .select({
      ...downloadColumns,
      metaPoster: metaCache.poster,
      metaBackground: metaCache.background,
    })
    .from(downloads)
    .leftJoin(metaCache, eq(downloads.metaId, metaCache.metaId))
    .where(eq(downloads.profileId, profileId))
    .orderBy(desc(downloads.createdAt), desc(downloads.id));

  return rows.map(toDbDownload);
}

/** Moves a queued download to downloading once its transfer starts. */
export async function markDownloadStarted(id: number): Promise<void> {
  await initializeDatabase();

  await db
    .update(downloads)
    .set({ status: 'downloading', updatedAt: Date.now() })
    .where(and(eq(downloads.id, id), eq(downloads.status, 'queued')));
}

export async function updateDownloadProgress(
  id: number,
  bytesDownloaded: number,
  bytesTotal?: number
): Promise<void> {
  await initializeDatabase();

  await db
    .update(downloads)
    .set({
      bytesDownloaded,
      ...(bytesTotal !== undefined ? { bytesTotal } : {}),
      updatedAt: Date.now(),
    })
    .where(and(eq(downloads.id, id), eq(downloads.status, 'downloading')));
}

export async function markDownloadCompleted(id: number, bytesTotal?: number): Promise<void> {
  await initializeDatabase();

  const now = Date.now();
  await db
    .update(downloads)
    .set({
      status: 'completed',
      errorMessage: null,
      ...(bytesTotal !== undefined ? { bytesTotal, bytesDownloaded: bytesTotal } : {}),
      updatedAt: now,
      completedAt: now,
    })
    .where(eq(downloads.id, id));
}

export async function markDownloadFailed(id: number, errorMessage?: string): Promise<void> {
  await initializeDatabase();

  await db
    .update(downloads)
    .set({ status: 'failed', errorMessage: errorMessage ?? null, updatedAt: Date.now() })
    .where(eq(downloads.id, id));
}

/** Downloads that have not reached a final state: waiting or transferring. */
export async function listUnfinishedDownloads(): Promise<DbDownload[]> {
  await initializeDatabase();

  const rows = await db
    .select(downloadColumns)
    .from(downloads)
    .where(inArray(downloads.status, ['queued', 'downloading']));
  return rows.map(toDbDownload);
}

/** Deletes the row and returns it so the caller can remove the file. */
export async function deleteDownload(id: number): Promise<DbDownload | null> {
  const existing = await getDownloadById(id);
  if (!existing) return null;

  await db.delete(downloads).where(eq(downloads.id, id));
  return existing;
}

/** Deletes all rows of a profile and returns them so the caller can remove the files. */
export async function removeProfileDownloads(profileId: string): Promise<DbDownload[]> {
  await initializeDatabase();

  const rows = await db
    .select(downloadColumns)
    .from(downloads)
    .where(eq(downloads.profileId, profileId));
  if (rows.length === 0) return [];

  await db.delete(downloads).where(eq(downloads.profileId, profileId));
  return rows.map(toDbDownload);
}
