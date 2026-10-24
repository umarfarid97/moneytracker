import initSqlJs from 'sql.js';
import { createSqlJsAdapter } from '@/db/sqljsAdapter';
import type { Db } from '@/db/types';

export async function createTestDb(): Promise<Db> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  raw.run('PRAGMA foreign_keys = ON;');
  return createSqlJsAdapter(raw);
}
