import initSqlJs, { type Database, type SqlValue } from 'sql.js';
import { readdirSync, readFileSync } from 'node:fs';
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

export const migration = (upTo = 99) =>
  readdirSync(join(import.meta.dirname, '../migrations'))
    .filter((f) => f.endsWith('.sql') && Number(f.slice(0, 4)) <= upTo)
    .sort()
    .map((f) => readFileSync(join(import.meta.dirname, '../migrations', f), 'utf8'))
    .join('\n');

/** Just enough of R2's API (an in-memory map) to run the Worker in tests. */
export function createFakeR2() {
  const map = new Map<string, Uint8Array>();
  const bucket = {
    map,
    async put(key: string, value: ArrayBuffer | Uint8Array) {
      map.set(key, new Uint8Array(value as ArrayBuffer).slice());
    },
    async get(key: string) {
      const v = map.get(key);
      return v ? { body: new Blob([v]).stream() } : null;
    },
    async delete(keys: string | string[]) {
      for (const k of Array.isArray(keys) ? keys : [keys]) map.delete(k);
    },
    async list({ prefix = '' }: { prefix?: string; cursor?: string } = {}) {
      return { objects: [...map.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false };
    },
  };
  return bucket as unknown as R2Bucket & { map: Map<string, Uint8Array> };
}
