import { and, asc, desc, eq, isNull, lt, ne, or, sql } from 'drizzle-orm';
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
    .where(eq(watchHistory.profileId, profileId))
    .orderBy(desc(watchHistory.lastWatchedAt));

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

  // Avoid overwriting stored stream targets on regular progress ticks.
  const hasStreamTarget =
    params.lastStreamTargetType !== undefined && params.lastStreamTargetValue !== undefined;

  const updateSet: Partial<typeof watchHistory.$inferInsert> = {
    progressSeconds: params.progressSeconds,
    durationSeconds: params.durationSeconds,
    status,
    dismissedAt: null,
    lastWatchedAt: now,
    updatedAt: now,
    ...(hasStreamTarget && {
      lastStreamTargetType: params.lastStreamTargetType,
      lastStreamTargetValue: params.lastStreamTargetValue,
    }),
  };

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
  // Recalculate status from progress ratio so completed items stay completed.
  await db
    .update(watchHistory)
    .set({
      status: sql`CASE WHEN ${watchHistory.durationSeconds} > 0
        AND (${watchHistory.progressSeconds} * 1.0 / ${watchHistory.durationSeconds}) >= ${PLAYBACK_FINISHED_RATIO}
        THEN 'completed' ELSE 'watching' END`,
      dismissedAt: null,
      updatedAt: now,
    })
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

  // Fetch both video-level and meta-level rows, preferring the exact video match.
  const resolvedVideoId = videoId ?? '';
  const rows = await db
    .select({
      lastStreamTargetType: watchHistory.lastStreamTargetType,
      lastStreamTargetValue: watchHistory.lastStreamTargetValue,
    })
    .from(watchHistory)
    .where(
      and(
        eq(watchHistory.profileId, profileId),
        eq(watchHistory.metaId, metaId),
        or(eq(watchHistory.videoId, resolvedVideoId), eq(watchHistory.videoId, '')),
        sql`${watchHistory.lastStreamTargetType} IS NOT NULL`,
        sql`${watchHistory.lastStreamTargetValue} IS NOT NULL`
      )
    )
    .orderBy(
      // Prefer video-scoped row over meta-level fallback
      sql`CASE WHEN ${watchHistory.videoId} = ${resolvedVideoId} THEN 0 ELSE 1 END`
    )
    .limit(1);

  if (!rows.length) return undefined;

  return {
    type: rows[0].lastStreamTargetType!,
    value: rows[0].lastStreamTargetValue!,
  };
}

export async function listWatchedMetaSummaries(profileId: string): Promise<DbWatchedMetaSummary[]> {
  await initializeDatabase();

  const rankedWatchHistory = db.$with('ranked_watch_history').as(
    db
      .select({
        id: watchHistory.metaId,
        type: watchHistory.type,
        videoId: watchHistory.videoId,
        progressSeconds: watchHistory.progressSeconds,
        durationSeconds: watchHistory.durationSeconds,
        lastStreamTargetType: watchHistory.lastStreamTargetType,
        lastStreamTargetValue: watchHistory.lastStreamTargetValue,
        lastWatchedAt: watchHistory.lastWatchedAt,
        rank: sql<number>`row_number() over (
          partition by ${watchHistory.metaId}
          order by ${watchHistory.lastWatchedAt} desc, ${watchHistory.id} desc
        )`.as('rank'),
      })
      .from(watchHistory)
      .where(eq(watchHistory.profileId, profileId))
  );

  const rows = await db
    .with(rankedWatchHistory)
    .select({
      id: rankedWatchHistory.id,
      type: rankedWatchHistory.type,
      videoId: rankedWatchHistory.videoId,
      progressSeconds: rankedWatchHistory.progressSeconds,
      durationSeconds: rankedWatchHistory.durationSeconds,
      lastStreamTargetType: rankedWatchHistory.lastStreamTargetType,
      lastStreamTargetValue: rankedWatchHistory.lastStreamTargetValue,
      lastWatchedAt: rankedWatchHistory.lastWatchedAt,
      metaName: metaCache.name,
      poster: metaCache.poster,
      background: metaCache.background,
      season: videos.season,
      episode: videos.episode,
    })
    .from(rankedWatchHistory)
    .leftJoin(metaCache, eq(metaCache.metaId, rankedWatchHistory.id))
    .leftJoin(
      videos,
      and(eq(videos.metaId, rankedWatchHistory.id), eq(videos.videoId, rankedWatchHistory.videoId))
    )
    .where(eq(rankedWatchHistory.rank, 1))
    .orderBy(desc(rankedWatchHistory.lastWatchedAt));

  return rows.map((row) => {
    const videoId = row.videoId || undefined;
    const progressSeconds = Number(row.progressSeconds ?? 0);
    const durationSeconds = Number(row.durationSeconds ?? 0);
    const progressRatio = durationSeconds > 0 ? progressSeconds / durationSeconds : 0;

    const latestItem: DbWatchHistoryItem | undefined = videoId
      ? {
        id: row.id,
        type: row.type,
        videoId,
        progressSeconds,
        durationSeconds,
        lastStreamTargetType: row.lastStreamTargetType ?? undefined,
        lastStreamTargetValue: row.lastStreamTargetValue ?? undefined,
        lastWatchedAt: Number(row.lastWatchedAt ?? 0),
      }
      : undefined;

    return {
      id: row.id,
      type: row.type,
      lastWatchedAt: Number(row.lastWatchedAt ?? 0),
      latestItem,
      latestVideo:
        row.season != null || row.episode != null
          ? {
            season: row.season ?? undefined,
            episode: row.episode ?? undefined,
          }
          : undefined,
      progressRatio,
      isInProgress: progressRatio > 0 && progressRatio < PLAYBACK_FINISHED_RATIO,
      metaName: row.metaName ?? undefined,
      imageUrl: row.poster ?? row.background ?? undefined,
    };
  });
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

  // CTE deduplicates to one row per metaId (most recent episode) in SQL.
  const ranked = db.$with('ranked').as(
    db
      .select({
        metaId: watchHistory.metaId,
        currentVideoId: watchHistory.videoId,
        type: watchHistory.type,
        progressSeconds: watchHistory.progressSeconds,
        durationSeconds: watchHistory.durationSeconds,
        lastWatchedAt: watchHistory.lastWatchedAt,
        rank: sql<number>`row_number() over (
          partition by ${watchHistory.metaId}
          order by ${watchHistory.lastWatchedAt} desc, ${watchHistory.id} desc
        )`.as('rank'),
      })
      .from(watchHistory)
      .where(
        and(
          eq(watchHistory.profileId, profileId),
          ne(watchHistory.status, 'dismissed'),
          sql`${watchHistory.progressSeconds} > 0`
        )
      )
  );

  const rows = await db
    .with(ranked)
    .select({
      metaId: ranked.metaId,
      currentVideoId: ranked.currentVideoId,
      type: ranked.type,
      progressSeconds: ranked.progressSeconds,
      durationSeconds: ranked.durationSeconds,
      lastWatchedAt: ranked.lastWatchedAt,
      metaName: metaCache.name,
      metaPoster: metaCache.poster,
      metaBackground: metaCache.background,
      currentVideoSeason: videos.season,
      currentVideoEpisode: videos.episode,
    })
    .from(ranked)
    .leftJoin(metaCache, eq(ranked.metaId, metaCache.metaId))
    .leftJoin(
      videos,
      and(eq(ranked.metaId, videos.metaId), eq(ranked.currentVideoId, videos.videoId))
    )
    .where(eq(ranked.rank, 1))
    .orderBy(desc(ranked.lastWatchedAt))
    .limit(limit);

  const resolved = await Promise.all(
    rows.map(async (item): Promise<ContinueWatchingDbItem | null> => {
      try {
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
      } catch (error) {
        // Log but don't crash the whole continue-watching list for a single bad item
        if (__DEV__) {
          console.warn('[ContinueWatching] Failed to resolve item', item.metaId, error);
        }
        return null;
      }
    })
  );

  return resolved.filter((item): item is ContinueWatchingDbItem => item !== null);
}
