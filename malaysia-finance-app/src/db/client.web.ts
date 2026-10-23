/**
 * Web build only (browser previews of the app). Phones use client.ts with expo-sqlite.
 * The browser has no SQLite, so this runs sql.js and keeps the database in localStorage.
 */
import initSqlJs from 'sql.js';
import { migrate } from './migrations';
import { createSqlJsAdapter } from './sqljsAdapter';
import type { Db } from './types';

const SQL_JS_VERSION = '1.15.1';
const toBase64 = (bytes: Uint8Array) => btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''));
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

export async function openDb(name = 'duit.db'): Promise<Db> {
  const SQL = await initSqlJs({
    locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/sql.js@${SQL_JS_VERSION}/dist/${file}`,
  });
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(name);
  } catch {
    // Storage blocked: the preview simply starts empty and is not saved.
  }
  const raw = saved ? new SQL.Database(fromBase64(saved)) : new SQL.Database();
  const db = createSqlJsAdapter(raw, () => {
    try {
      localStorage.setItem(name, toBase64(raw.export()));
    } catch {
      // Ignore: quota or blocked storage.
    }
  });
  await migrate(db);
  return db;
}
