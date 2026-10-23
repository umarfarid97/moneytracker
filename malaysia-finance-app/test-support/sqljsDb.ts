import initSqlJs from 'sql.js';
import type { Db, SqlParam } from '@/db/types';

export async function createTestDb(): Promise<Db> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  raw.run('PRAGMA foreign_keys = ON;');

  const all = <T,>(sql: string, params: SqlParam[] = []): T[] => {
    const stmt = raw.prepare(sql);
    stmt.bind(params);
    const rows: T[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as T);
    stmt.free();
    return rows;
  };

  return {
    async run(sql, params = []) {
      raw.run(sql, params);
      const changes = raw.getRowsModified();
      const id = all<{ id: number }>('SELECT last_insert_rowid() AS id')[0].id;
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
    },
    async transaction<T>(fn: () => Promise<T>) {
      raw.run('BEGIN');
      try {
        const result = await fn();
        raw.run('COMMIT');
        return result;
      } catch (e) {
        raw.run('ROLLBACK');
        throw e;
      }
    },
  };
}
