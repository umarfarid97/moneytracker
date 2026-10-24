import type { Database } from 'sql.js';
import type { Db, SqlParam } from './types';

/**
 * Wraps a sql.js database in the app's Db interface. Used by the web build (browser previews) and by tests.
 * `onWrite` runs after each write outside a transaction, and once after a transaction commits, e.g. to
 * save the database. It must not run mid-transaction: sql.js `export()` reopens the database, which would
 * silently discard the open transaction.
 */
export function createSqlJsAdapter(raw: Database, onWrite: () => void = () => {}): Db {
  let inTransaction = false;
  const wrote = () => {
    if (!inTransaction) onWrite();
  };
  const all = <T,>(sql: string, params: SqlParam[] = []): T[] => {
    const stmt = raw.prepare(sql);
    try {
      stmt.bind(params);
      const rows: T[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as T);
      return rows;
    } finally {
      stmt.free();
    }
  };

  return {
    async run(sql, params = []) {
      raw.run(sql, params);
      const changes = raw.getRowsModified();
      const id = all<{ id: number }>('SELECT last_insert_rowid() AS id')[0].id;
      wrote();
      return { lastInsertRowId: id, changes };
    },
    async all<T>(sql: string, params: SqlParam[] = []) {
      return all<T>(sql, params);
    },
    async get<T>(sql: string, params: SqlParam[] = []) {
      return all<T>(sql, params)[0] ?? null;
    },
    async exec(sql) {
      raw.exec(sql);
      wrote();
    },
    async transaction<T>(fn: () => Promise<T>) {
      raw.run('BEGIN');
      inTransaction = true;
      try {
        const result = await fn();
        raw.run('COMMIT');
        inTransaction = false;
        onWrite();
        return result;
      } catch (e) {
        inTransaction = false;
        raw.run('ROLLBACK');
        throw e;
      }
    },
  };
}
