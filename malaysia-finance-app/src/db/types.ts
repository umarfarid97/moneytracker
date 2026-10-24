export type SqlParam = string | number | null;

/** Minimal async SQLite surface. expo-sqlite implements it in the app, sql.js in tests. */
export interface Db {
  run(sql: string, params?: SqlParam[]): Promise<{ lastInsertRowId: number; changes: number }>;
  all<T>(sql: string, params?: SqlParam[]): Promise<T[]>;
  get<T>(sql: string, params?: SqlParam[]): Promise<T | null>;
  exec(sql: string): Promise<void>;
  /** Runs fn inside one transaction; rolls back and rethrows if fn throws. */
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}
