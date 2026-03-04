import { and, asc, desc, eq, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';
import { PLAYBACK_FINISHED_RATIO } from '@/constants/playback';
import type { ContentType } from '@/types/stremio';
import { db, initializeDatabase } from '@/db/client';
import { metaCache, videos, watchHistory } from '@/db/schema';
import type { StreamTargetType } from '@/db/schema';

export type DbWatchHistoryItem = {
  id: string;
  type: ContentType;
  videoId?: string;
  progressSeconds: number;
  durationSeconds: number;
  lastStreamTargetType?: StreamTargetType;
  lastStreamTargetValue?: string;
  lastWatchedAt: number;
};

export type DbWatchedMetaSummary = {
  id: string;
  type: ContentType;
  lastWatchedAt: number;
  latestItem?: DbWatchHistoryItem;
  latestVideo?: { season?: number; episode?: number };
  progressRatio: number;
  isInProgress: boolean;
  metaName?: string;
  imageUrl?: string;
};

const toRatio = (progressSeconds: number, durationSeconds: number) =>
  durationSeconds > 0 ? progressSeconds / durationSeconds : 0;

export async function listWatchHistoryForProfile(profileId: string): Promise<DbWatchHistoryItem[]> {
  await initializeDatabase();

  const rows = await db
    .select({
      metaId: watchHistory.metaId,
      type: watchHistory.type,
      videoId: watchHistory.videoId,
      progressSeconds: watchHistory.progressSeconds,
      durationSeconds: watchHistory.durationSeconds,
      lastStreamTargetType: watchHistory.lastStreamTargetType,
      lastStreamTargetValue: watchHistory.lastStreamTargetValue,
      lastWatchedAt: watchHistory.lastWatchedAt,
    })
    .from(watchHistory)
    .where(eq(watchHistory.profileId, profileId));

  return rows.map((row) => ({
    id: row.metaId,
    type: row.type,
      videoId: row.videoId || undefined,
      progressSeconds: Number(row.progressSeconds ?? 0),
      durationSeconds: Number(row.durationSeconds ?? 0),
      lastStreamTargetType: row.lastStreamTargetType ?? undefined,
      lastStreamTargetValue: row.lastStreamTargetValue ?? undefined,
      lastWatchedAt: Number(row.lastWatchedAt ?? 0),
    }));
}

/**
 * Returns watch history items for a specific meta (all episodes/videos).
 * Filters out dismissed items.
 */
export async function listWatchHistoryForMeta(
  profileId: string,
  metaId: string
): Promise<DbWatchHistoryItem[]> {
  await initializeDatabase();

  const rows = await db
    .select({
      metaId: watchHistory.metaId,
      type: watchHistory.type,
      videoId: watchHistory.videoId,
      progressSeconds: watchHistory.progressSeconds,
      durationSeconds: watchHistory.durationSeconds,
      lastStreamTargetType: watchHistory.lastStreamTargetType,
      lastStreamTargetValue: watchHistory.lastStreamTargetValue,
      lastWatchedAt: watchHistory.lastWatchedAt,
    })
    .from(watchHistory)
    .where(
      and(
        eq(watchHistory.profileId, profileId),
        eq(watchHistory.metaId, metaId),
        ne(watchHistory.status, 'dismissed')
      )
    );

  return rows.map((row) => ({
    id: row.metaId,
    type: row.type,
    videoId: row.videoId || undefined,
    progressSeconds: Number(row.progressSeconds ?? 0),
    durationSeconds: Number(row.durationSeconds ?? 0),
    lastStreamTargetType: row.lastStreamTargetType ?? undefined,
    lastStreamTargetValue: row.lastStreamTargetValue ?? undefined,
    lastWatchedAt: Number(row.lastWatchedAt ?? 0),
  }));
}

export async function upsertWatchProgress(params: {
  profileId: string;
  metaId: string;
  videoId?: string;
  type: ContentType;
  progressSeconds: number;
  durationSeconds: number;
  lastStreamTargetType?: StreamTargetType;
  lastStreamTargetValue?: string;
  lastWatchedAt?: number;
}): Promise<void> {
  await initializeDatabase();

  const now = params.lastWatchedAt ?? Date.now();
  const progressRatio = toRatio(params.progressSeconds, params.durationSeconds);
  const status = progressRatio >= PLAYBACK_FINISHED_RATIO ? 'completed' : 'watching';

  // Only include stream target fields when explicitly provided to avoid
  // overwriting previously stored targets on regular progress ticks.
  const hasStreamTarget =
    params.lastStreamTargetType !== undefined && params.lastStreamTargetValue !== undefined;

  const updateSet: Record<string, unknown> = {
    progressSeconds: params.progressSeconds,
    durationSeconds: params.durationSeconds,
    status,
    dismissedAt: null,
    lastWatchedAt: now,
    updatedAt: now,
  };
  if (hasStreamTarget) {
    updateSet.lastStreamTargetType = params.lastStreamTargetType;
    updateSet.lastStreamTargetValue = params.lastStreamTargetValue;
  }

  await db
    .insert(watchHistory)
    .values({
      profileId: params.profileId,
      metaId: params.metaId,
      videoId: params.videoId ?? '',
      type: params.type,
      progressSeconds: params.progressSeconds,
      durationSeconds: params.durationSeconds,
      lastStreamTargetType: params.lastStreamTargetType,
      lastStreamTargetValue: params.lastStreamTargetValue,
      status,
      dismissedAt: null,
      lastWatchedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [watchHistory.profileId, watchHistory.metaId, watchHistory.videoId],
      set: updateSet,
    });
}

export async function setLastStreamTarget(params: {
  profileId: string;
  metaId: string;
  videoId?: string;
  type: ContentType;
  target: { type: StreamTargetType; value: string };
}): Promise<void> {
  await initializeDatabase();

  const now = Date.now();
  await db
    .insert(watchHistory)
    .values({
      profileId: params.profileId,
      metaId: params.metaId,
      videoId: params.videoId ?? '',
      type: params.type,
      durationSeconds: 0,
      lastStreamTargetType: params.target.type,
      lastStreamTargetValue: params.target.value,
      status: 'watching',
      lastWatchedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [watchHistory.profileId, watchHistory.metaId, watchHistory.videoId],
      set: {
        lastStreamTargetType: params.target.type,
        lastStreamTargetValue: params.target.value,
        updatedAt: now,
      },
    });
}

export async function dismissFromContinueWatching(
  profileId: string,
  metaId: string
): Promise<void> {
  await initializeDatabase();

  const now = Date.now();
  await db
    .update(watchHistory)
    .set({ status: 'dismissed', dismissedAt: now, updatedAt: now })
    .where(and(eq(watchHistory.profileId, profileId), eq(watchHistory.metaId, metaId)));
}

export async function undismissFromContinueWatching(
  profileId: string,
  metaId: string
): Promise<void> {
  await initializeDatabase();

  const now = Date.now();
  await db
    .update(watchHistory)
    .set({ status: 'watching', dismissedAt: null, updatedAt: now })
    .where(and(eq(watchHistory.profileId, profileId), eq(watchHistory.metaId, metaId)));
}

export async function removeWatchHistoryItem(
  profileId: string,
  metaId: string,
  videoId?: string
): Promise<void> {
  await initializeDatabase();

  await db
    .delete(watchHistory)
    .where(
      and(
        eq(watchHistory.profileId, profileId),
        eq(watchHistory.metaId, metaId),
        videoId ? eq(watchHistory.videoId, videoId) : eq(watchHistory.videoId, '')
      )
    );
}

export async function removeWatchHistoryMeta(profileId: string, metaId: string): Promise<void> {
  await initializeDatabase();

  await db
    .delete(watchHistory)
    .where(and(eq(watchHistory.profileId, profileId), eq(watchHistory.metaId, metaId)));
}

export async function removeProfileWatchHistory(profileId: string): Promise<void> {
  await initializeDatabase();

  await db.delete(watchHistory).where(eq(watchHistory.profileId, profileId));
}

export async function getWatchHistoryItem(
  profileId: string,
  metaId: string,
  videoId?: string
): Promise<DbWatchHistoryItem | undefined> {
  await initializeDatabase();

  const row = await db
    .select({
      metaId: watchHistory.metaId,
      type: watchHistory.type,
      videoId: watchHistory.videoId,
      progressSeconds: watchHistory.progressSeconds,
      durationSeconds: watchHistory.durationSeconds,
      lastStreamTargetType: watchHistory.lastStreamTargetType,
      lastStreamTargetValue: watchHistory.lastStreamTargetValue,
      lastWatchedAt: watchHistory.lastWatchedAt,
    })
    .from(watchHistory)
    .where(
      and(
        eq(watchHistory.profileId, profileId),
        eq(watchHistory.metaId, metaId),
        videoId ? eq(watchHistory.videoId, videoId) : eq(watchHistory.videoId, '')
      )
    )
    .limit(1);

  if (!row.length) return undefined;

  return {
    id: row[0].metaId,
    type: row[0].type,
    videoId: row[0].videoId || undefined,
    progressSeconds: Number(row[0].progressSeconds ?? 0),
    durationSeconds: Number(row[0].durationSeconds ?? 0),
    lastStreamTargetType: row[0].lastStreamTargetType ?? undefined,
    lastStreamTargetValue: row[0].lastStreamTargetValue ?? undefined,
    lastWatchedAt: Number(row[0].lastWatchedAt ?? 0),
  };
}

export async function getLastStreamTarget(
  profileId: string,
  metaId: string,
  videoId?: string
): Promise<{ type: StreamTargetType; value: string } | undefined> {
  await initializeDatabase();

  const scoped = await getWatchHistoryItem(profileId, metaId, videoId);
  if (scoped?.lastStreamTargetType && scoped?.lastStreamTargetValue) {
    return {
      type: scoped.lastStreamTargetType,
      value: scoped.lastStreamTargetValue,
    };
  }

  const metaLevel = await getWatchHistoryItem(profileId, metaId);
  if (metaLevel?.lastStreamTargetType && metaLevel?.lastStreamTargetValue) {
    return {
      type: metaLevel.lastStreamTargetType,
      value: metaLevel.lastStreamTargetValue,
    };
  }

  return undefined;
}

export async function listWatchedMetaSummaries(profileId: string): Promise<DbWatchedMetaSummary[]> {
  const items = await listWatchHistoryForProfile(profileId);
  const byMeta = new Map<string, DbWatchHistoryItem[]>();

  for (const item of items) {
    const arr = byMeta.get(item.id) ?? [];
    arr.push(item);
    byMeta.set(item.id, arr);
  }

  const summaries: DbWatchedMetaSummary[] = [];
  for (const [id, metaItems] of byMeta.entries()) {
    const latest = metaItems.reduce<DbWatchHistoryItem | undefined>(
      (best, item) => (!best || item.lastWatchedAt > best.lastWatchedAt ? item : best),
      undefined
    );
    if (!latest) continue;

    const ratio = latest.durationSeconds > 0 ? latest.progressSeconds / latest.durationSeconds : 0;
    summaries.push({
      id,
      type: latest.type,
      lastWatchedAt: latest.lastWatchedAt,
      latestItem: latest.videoId ? latest : undefined,
      progressRatio: ratio,
      isInProgress: ratio > 0 && ratio < PLAYBACK_FINISHED_RATIO,
    });
  }

  // Fetch display metadata from meta_cache for all summaries in one query
  const metaIds = summaries.map((s) => s.id);
  if (metaIds.length > 0) {
    const cacheRows = await db
      .select({
        metaId: metaCache.metaId,
        name: metaCache.name,
        poster: metaCache.poster,
        background: metaCache.background,
      })
      .from(metaCache)
      .where(inArray(metaCache.metaId, metaIds));

    const cacheMap = new Map(cacheRows.map((r) => [r.metaId, r]));

    for (const summary of summaries) {
      const cached = cacheMap.get(summary.id);
      if (cached) {
        summary.metaName = cached.name ?? undefined;
        summary.imageUrl = cached.poster ?? cached.background ?? undefined;
      }
    }

    // Resolve episode data (season/episode) for series entries with a latest videoId
    const videoLookups = summaries
      .filter((s) => s.latestItem?.videoId)
      .map((s) => ({ metaId: s.id, videoId: s.latestItem!.videoId! }));

    if (videoLookups.length > 0) {
      const videoRows = await db
        .select({
          metaId: videos.metaId,
          videoId: videos.videoId,
          season: videos.season,
          episode: videos.episode,
        })
        .from(videos)
        .where(
          or(
            ...videoLookups.map((v) =>
              and(eq(videos.metaId, v.metaId), eq(videos.videoId, v.videoId))
            )
          )
        );

      const videoMap = new Map(videoRows.map((r) => [`${r.metaId}:${r.videoId}`, r]));

      for (const summary of summaries) {
        if (summary.latestItem?.videoId) {
          const vRow = videoMap.get(`${summary.id}:${summary.latestItem.videoId}`);
          if (vRow) {
            summary.latestVideo = {
              season: vRow.season ?? undefined,
              episode: vRow.episode ?? undefined,
            };
          }
        }
      }
    }
  }

  return summaries.sort((a, b) => b.lastWatchedAt - a.lastWatchedAt);
}

export type ContinueWatchingDbItem = {
  metaId: string;
  type: ContentType;
  videoId?: string;
  progressSeconds: number;
  durationSeconds: number;
  progressRatio: number;
  lastWatchedAt: number;
  isUpNext: boolean;
  metaName?: string;
  imageUrl?: string;
};

async function findNextUnwatchedEpisode(
  profileId: string,
  metaId: string,
  currentSeason: number,
  currentEpisode: number
) {
  const nextEpisodeConditions = or(
    and(eq(videos.season, currentSeason), sql`${videos.episode} > ${currentEpisode}`),
    sql`${videos.season} > ${currentSeason}`
  );

  const nextEpisode = await db
    .select({
      videoId: videos.videoId,
      season: videos.season,
      episode: videos.episode,
    })
    .from(videos)
    .leftJoin(
      watchHistory,
      and(
        eq(watchHistory.profileId, profileId),
        eq(watchHistory.metaId, videos.metaId),
        eq(watchHistory.videoId, videos.videoId)
      )
    )
    .where(
      and(
        eq(videos.metaId, metaId),
        nextEpisodeConditions,
        sql`COALESCE(${videos.season}, 0) != 0`,
        or(
          isNull(watchHistory.id),
          lt(
            sql`${watchHistory.progressSeconds} * 1.0 / NULLIF(${watchHistory.durationSeconds}, 0)`,
            PLAYBACK_FINISHED_RATIO
          )
        )
      )
    )
    .orderBy(
      asc(sql`CASE WHEN ${videos.season} = 0 THEN 999999 ELSE ${videos.season} END`),
      asc(videos.episode)
    )
    .limit(1);

  return nextEpisode[0];
}

export async function getContinueWatchingWithUpNext(
  profileId: string,
  limit = 50
): Promise<ContinueWatchingDbItem[]> {
  await initializeDatabase();

  const rows = await db
    .select({
      metaId: watchHistory.metaId,
      currentVideoId: watchHistory.videoId,
      type: watchHistory.type,
      progressSeconds: watchHistory.progressSeconds,
      durationSeconds: watchHistory.durationSeconds,
      lastWatchedAt: watchHistory.lastWatchedAt,
      metaName: metaCache.name,
      metaPoster: metaCache.poster,
      metaBackground: metaCache.background,
      currentVideoSeason: videos.season,
      currentVideoEpisode: videos.episode,
    })
    .from(watchHistory)
    .leftJoin(metaCache, eq(watchHistory.metaId, metaCache.metaId))
    .leftJoin(
      videos,
      and(eq(watchHistory.metaId, videos.metaId), eq(watchHistory.videoId, videos.videoId))
    )
    .where(
      and(
        eq(watchHistory.profileId, profileId),
        ne(watchHistory.status, 'dismissed'),
        sql`${watchHistory.progressSeconds} > 0`
      )
    )
    .orderBy(desc(watchHistory.lastWatchedAt))
    .limit(limit * 3);

  const latestPerMeta = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const existing = latestPerMeta.get(row.metaId);
    if (!existing || Number(row.lastWatchedAt) > Number(existing.lastWatchedAt)) {
      latestPerMeta.set(row.metaId, row);
    }
  }

  const latestItems = Array.from(latestPerMeta.values()).sort(
    (a, b) => Number(b.lastWatchedAt) - Number(a.lastWatchedAt)
  );

  const resolved = await Promise.all(
    latestItems.slice(0, limit).map(async (item): Promise<ContinueWatchingDbItem | null> => {
      const progressSeconds = Number(item.progressSeconds ?? 0);
      const durationSeconds = Number(item.durationSeconds ?? 0);
      const progressRatio = toRatio(progressSeconds, durationSeconds);
      const isFinished = progressRatio >= PLAYBACK_FINISHED_RATIO;

      const base: ContinueWatchingDbItem = {
        metaId: item.metaId,
        type: item.type,
        videoId: item.currentVideoId || undefined,
        progressSeconds,
        durationSeconds,
        progressRatio,
        lastWatchedAt: Number(item.lastWatchedAt),
        isUpNext: false,
        metaName: item.metaName ?? undefined,
        imageUrl: item.metaBackground ?? item.metaPoster ?? undefined,
      };

      if (isFinished) {
        // For series, try to find the next unwatched episode
        if (
          item.type === 'series' &&
          item.currentVideoSeason !== null &&
          item.currentVideoEpisode !== null
        ) {
          const nextEpisode = await findNextUnwatchedEpisode(
            profileId,
            item.metaId,
            Number(item.currentVideoSeason),
            Number(item.currentVideoEpisode)
          );

          if (nextEpisode?.videoId) {
            return {
              ...base,
              videoId: nextEpisode.videoId,
              progressSeconds: 0,
              durationSeconds: 0,
              progressRatio: 0,
              isUpNext: true,
            };
          }
        }

        // Finished with no next episode (or non-series) — nothing to continue
        return null;
      }

      return base;
    })
  );

  return resolved.filter((item): item is ContinueWatchingDbItem => item !== null);
}
