import type { Db } from '../types';

export async function getSetting(db: Db, key: string): Promise<string | null> {
  const row = await db.get<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', [key]);
  return row?.value ?? null;
}

export async function setSetting(db: Db, key: string, value: string): Promise<void> {
  await db.run('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
}

export async function deleteSetting(db: Db, key: string): Promise<void> {
  await db.run('DELETE FROM app_settings WHERE key = ?', [key]);
}
