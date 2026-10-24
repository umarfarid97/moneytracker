import * as SQLite from 'expo-sqlite';
import { migrate } from './migrations';
import type { Db } from './types';

/** Opens the on-device database, applies pending migrations and returns the Db adapter. */
export async function openDb(name = 'duit.db'): Promise<Db> {
  const raw = await SQLite.openDatabaseAsync(name);
  await raw.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const db: Db = {
    async run(sql, params = []) {
      const r = await raw.runAsync(sql, params);
      return { lastInsertRowId: r.lastInsertRowId, changes: r.changes };
    },
    all: <T,>(sql: string, params: (string | number | null)[] = []) => raw.getAllAsync<T>(sql, params),
    async get<T>(sql: string, params: (string | number | null)[] = []) {
      return (await raw.getFirstAsync<T>(sql, params)) ?? null;
    },
    exec: (sql) => raw.execAsync(sql),
    async transaction<T>(fn: () => Promise<T>) {
      let result!: T;
      await raw.withTransactionAsync(async () => {
        result = await fn();
      });
      return result;
    },
  };

  await migrate(db);
  return db;
}
