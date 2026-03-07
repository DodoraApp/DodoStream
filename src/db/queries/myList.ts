import { and, desc, eq, isNull } from 'drizzle-orm';
import type { ContentType } from '@/types/stremio';
import { db, initializeDatabase } from '@/db/client';
import { myList } from '@/db/schema';

export type DbMyListItem = {
  id: string;
  type: ContentType;
  addedAt: number;
};

export async function listMyListForProfile(profileId: string): Promise<DbMyListItem[]> {
  await initializeDatabase();

  const rows = await db
    .select({
      metaId: myList.metaId,
      type: myList.type,
      addedAt: myList.addedAt,
    })
    .from(myList)
    .where(and(eq(myList.profileId, profileId), isNull(myList.removedAt)))
    .orderBy(desc(myList.addedAt));

  return rows.map((row) => ({
    id: row.metaId,
    type: row.type as ContentType,
    addedAt: Number(row.addedAt),
  }));
}

export async function addToMyList(profileId: string, metaId: string, type: ContentType): Promise<void> {
  await initializeDatabase();

  const now = Date.now();
  await db
    .insert(myList)
    .values({
      profileId,
      metaId,
      type,
      addedAt: now,
      removedAt: null,
    })
    .onConflictDoUpdate({
      target: [myList.profileId, myList.metaId],
      set: {
        type,
        addedAt: now,
        removedAt: null,
      },
    });
}

export async function removeFromMyList(profileId: string, metaId: string): Promise<void> {
  await initializeDatabase();

  await db
    .update(myList)
    .set({ removedAt: Date.now() })
    .where(and(eq(myList.profileId, profileId), eq(myList.metaId, metaId)));
}

export async function removeProfileMyList(profileId: string): Promise<void> {
  await initializeDatabase();

  await db.delete(myList).where(eq(myList.profileId, profileId));
}
