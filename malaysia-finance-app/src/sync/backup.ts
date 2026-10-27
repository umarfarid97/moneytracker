import { forgetDemoData } from '@/db/repos/demo';
import type { Db } from '@/db/types';
import { isStoredReceipt, readReceiptBase64, writeReceiptBase64 } from './receiptFiles';
import { exportSnapshot, isSnapshot, restoreSnapshot, schemaVersion, withAllTables, type Snapshot } from './snapshot';

/** A backup file: the snapshot plus receipt photos as base64, keyed by their stored path. */
export type Backup = Snapshot & { receipts?: Record<string, string> };

export class InvalidBackupError extends Error {
  constructor() {
    super('Not a Duit backup file');
  }
}
export class BackupTooNewError extends Error {
  constructor() {
    super('Backup is from a newer version of Duit');
  }
}

export async function createBackup(db: Db): Promise<string> {
  const snapshot = await exportSnapshot(db);
  const receipts: Record<string, string> = {};
  for (const r of [...snapshot.tables.expenses, ...snapshot.tables.relief_claims]) {
    const path = r.receipt_uri as string | null;
    if (!isStoredReceipt(path) || path in receipts) continue;
    const data = await readReceiptBase64(path);
    if (data) receipts[path] = data;
  }
  const backup: Backup = { ...snapshot, receipts };
  return JSON.stringify(backup);
}

export async function parseBackup(db: Db, text: string): Promise<Backup> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new InvalidBackupError();
  }
  if (!isSnapshot(parsed)) throw new InvalidBackupError();
  if (parsed.schema > (await schemaVersion(db))) throw new BackupTooNewError();
  return withAllTables(parsed) as Backup;
}

/** Replaces all data on this device with the backup's, receipt photos included. */
export async function restoreBackup(db: Db, backup: Backup): Promise<void> {
  for (const [path, data] of Object.entries(backup.receipts ?? {})) {
    if (isStoredReceipt(path)) await writeReceiptBase64(path, data);
  }
  const { receipts: _receipts, ...snapshot } = backup;
  await restoreSnapshot(db, snapshot);
  // The restore replaced everything, demo rows included.
  await forgetDemoData(db);
}

export const backupFileName = (now: Date = new Date()) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `duit-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
};
