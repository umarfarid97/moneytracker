import initSqlJs, { type Database, type SqlValue } from 'sql.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Just enough of D1's API, on top of sql.js, to run the Worker in tests. */
class Stmt {
  constructor(private db: Database, readonly sql: string, private params: unknown[] = []) {}
  bind(...params: unknown[]) {
    return new Stmt(this.db, this.sql, params);
  }
  private rows(): Record<string, unknown>[] {
    const s = this.db.prepare(this.sql);
    s.bind(this.params as SqlValue[]);
    const out: Record<string, unknown>[] = [];
    while (s.step()) out.push(s.getAsObject());
    s.free();
    return out;
  }
  async run() {
    const rows = this.rows();
    return { results: rows, success: true, meta: { changes: this.db.getRowsModified() } };
  }
  async all() {
    return { results: this.rows(), success: true, meta: { changes: 0 } };
  }
  async first() {
    return this.rows()[0] ?? null;
  }
}

export async function createFakeD1(migrationSql: string) {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(migrationSql);
  return {
    prepare: (sql: string) => new Stmt(db, sql),
    async batch(stmts: Stmt[]) {
      db.exec('BEGIN');
      try {
        const out = [];
        for (const s of stmts) out.push(await s.run());
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  } as unknown as D1Database;
}

export const migration = () => readFileSync(join(import.meta.dirname, '../migrations/0001_init.sql'), 'utf8');
