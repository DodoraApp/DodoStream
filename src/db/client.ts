import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { createDebugLogger } from '@/utils/debug';
import migrations from '@/db/drizzle/migrations';

const debug = createDebugLogger('SQLite');

export const sqliteDb = SQLite.openDatabaseSync('dodostream.db');
export const db = drizzle(sqliteDb);

let initializationPromise: Promise<void> | null = null;

export function initializeDatabase(): Promise<void> {
    if (!initializationPromise) {
        initializationPromise = migrate(db, migrations).then(() => {
            debug('initialized');
        });
    }
    return initializationPromise;
}
