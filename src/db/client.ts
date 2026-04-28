import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import * as SQLite from 'expo-sqlite';

import migrations from '@/db/drizzle/migrations';
import { createDebugLogger } from '@/utils/debug';

const debug = createDebugLogger('SQLite');

export const sqliteDb = SQLite.openDatabaseSync('dodostream.db');
sqliteDb.execSync('PRAGMA journal_mode = WAL;');
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
