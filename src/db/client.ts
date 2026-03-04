import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { createDebugLogger } from '@/utils/debug';
import migrations from '@/db/drizzle/migrations';

const debug = createDebugLogger('SQLite');

const sqlite = SQLite.openDatabaseSync('dodostream.db');
export const db = drizzle(sqlite);

let initialized = false;

export async function initializeDatabase(): Promise<void> {
    if (initialized) return;
    await migrate(db, migrations);
    initialized = true;
    debug('initialized');
}
