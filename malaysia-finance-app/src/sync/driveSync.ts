import { isDemoLoaded } from '@/db/repos/demo';
import type { Db } from '@/db/types';
import { DriveAuthError, listFiles, readText, writeJson, type DriveFile } from './drive';
import { mergeSnapshots } from './merge';
import {
  downloadReceipt, isStoredReceipt, RECEIPT_FILES, receiptExists, uploadReceipt,
} from './receiptFiles';
import { applySnapshot, canonical, exportSnapshot, isSnapshot, schemaVersion, withAllTables, type Snapshot } from './snapshot';

/** The one data file in the user's hidden Duit folder on Drive. Receipt photos sit beside it. */
export const SYNC_FILE = 'duit-sync.json';

/** The Drive copy was written by a newer app version; syncing could drop data this version doesn't know. */
export class SyncTooNewError extends Error {
  constructor() {
    super('Drive data is from a newer version of Duit');
  }
}

/** Demo data is loaded (More > Demo data); syncing waits until it is cleared so it can never pass as real data. */
export class DemoLoadedError extends Error {
  constructor() {
    super('Demo data is loaded');
  }
}

/**
 * One sync round: download the Drive copy, merge it with this phone's data, write the result here and
 * upload it if Drive was behind, then exchange receipt photos. Returns whether this phone's data changed.
 */
export async function syncWithDrive(db: Db, token: string): Promise<{ changedLocal: boolean }> {
  if (await isDemoLoaded(db)) throw new DemoLoadedError();
  const files = await listFiles(token);
  const dataFile = files.find((f) => f.name === SYNC_FILE);
  let remote: Snapshot | null = null;
  if (dataFile) {
    const parsed: unknown = JSON.parse(await readText(token, dataFile.id));
    if (isSnapshot(parsed)) remote = withAllTables(parsed);
  }
  if (remote && remote.schema > (await schemaVersion(db))) throw new SyncTooNewError();

  const local = await exportSnapshot(db);
  let result = local;
  let changedLocal = false;
  if (remote) {
    const merged = mergeSnapshots(local, remote);
    if (canonical(merged) !== canonical(local)) {
      await applySnapshot(db, merged);
      result = await exportSnapshot(db);
      changedLocal = true;
    }
  }
  if (!remote || canonical(result) !== canonical(remote)) {
    await writeJson(token, SYNC_FILE, JSON.stringify(result), dataFile?.id);
  }
  if (RECEIPT_FILES) await syncReceipts(token, result, files);
  return { changedLocal };
}

/** Uploads receipt photos Drive lacks and downloads the ones this phone lacks. One failure skips that photo. */
async function syncReceipts(token: string, data: Snapshot, files: DriveFile[]) {
  const onDrive = new Map(files.map((f) => [f.name, f.id]));
  const stored = new Set(
    [...data.tables.expenses, ...data.tables.relief_claims].map((r) => r.receipt_uri as string | null).filter(isStoredReceipt),
  );
  for (const path of stored) {
    const name = path.slice('receipts/'.length);
    try {
      const id = onDrive.get(name);
      const here = receiptExists(path);
      if (here && !id) await uploadReceipt(token, path, name);
      else if (!here && id) await downloadReceipt(token, id, path);
    } catch (e) {
      if (e instanceof DriveAuthError) throw e;
    }
  }
}
