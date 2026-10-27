/**
 * Web build only (browser previews of the app). Phones use client.ts with expo-sqlite.
 * The browser has no SQLite, so this runs sql.js and keeps the database in localStorage.
 */
import { Asset } from 'expo-asset';
import initSqlJs from 'sql.js';
import { migrate } from './migrations';
import { createSqlJsAdapter } from './sqljsAdapter';
import type { Db } from './types';

// The wasm ships with the site (same origin). Loading it from a CDN made iOS Safari's privacy protections flag the page.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WASM_URL = (): string => Asset.fromModule(require('sql.js/dist/sql-wasm.wasm')).uri;
const toBase64 = (bytes: Uint8Array) => btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''));
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

export async function openDb(name = 'duit.db'): Promise<Db> {
  const SQL = await initSqlJs({
    locateFile: (file: string) => (file.endsWith('.wasm') ? WASM_URL() : file),
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
