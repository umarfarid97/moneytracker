import { isDemoLoaded } from '@/db/repos/demo';
import type { Db } from '@/db/types';
import { fromBase64, toBase64 } from './bytes';
import { CloudAuthError, CloudConflictError, type CloudApi } from './cloudApi';
import { BadBlobError, openReceipt, openSnapshot, sealReceipt, sealSnapshot } from './cryptoBox';
import { mergeSnapshots } from './merge';
import { isStoredReceipt, readReceiptBase64, RECEIPT_FILES, receiptExists, writeReceiptBase64 } from './receiptFiles';
import { applySnapshot, canonical, exportSnapshot, isSnapshot, schemaVersion, withAllTables, type Snapshot } from './snapshot';
import { DemoLoadedError, SyncTooNewError } from './syncErrors';

const NAME = /^[A-Za-z0-9._-]{1,100}$/;
/** Merge-and-upload tries before giving up; each retry means another phone uploaded in between. */
const ATTEMPTS = 4;

export type CloudSyncResult = { changedLocal: boolean; version: number };

/**
 * One sync round, the same shape as the old Drive sync: download the cloud copy, merge it with this phone's
 * data, write the result here and upload it if the cloud was behind, then exchange receipt photos.
 *
 * With `knownVersion` (the version this phone last saw) the round ends early when the cloud has not moved,
 * which is what the periodic check does; pass null after a local change so the upload happens.
 */
export async function syncWithCloud(
  db: Db, api: CloudApi, dataKey: Uint8Array, knownVersion: number | null = null,
): Promise<CloudSyncResult> {
  if (await isDemoLoaded(db)) throw new DemoLoadedError();
  if (knownVersion !== null && (await api.version()) === knownVersion) return { changedLocal: false, version: knownVersion };

  let changedLocal = false;
  let version = 0;
  let result: Snapshot | null = null;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const remote = await api.getSnapshot();
    let remoteSnap: Snapshot | null = null;
    if (remote) {
      const parsed: unknown = JSON.parse(openSnapshot(dataKey, remote.bytes));
      if (!isSnapshot(parsed)) throw new BadBlobError();
      remoteSnap = withAllTables(parsed);
      if (remote.schema > (await schemaVersion(db)) || remoteSnap.schema > (await schemaVersion(db))) throw new SyncTooNewError();
    }

    const local = await exportSnapshot(db);
    result = local;
    if (remoteSnap) {
      const merged = mergeSnapshots(local, remoteSnap);
      if (canonical(merged) !== canonical(local)) {
        await applySnapshot(db, merged);
        result = await exportSnapshot(db);
        changedLocal = true;
      }
    }
    version = remote?.version ?? 0;
    if (!remoteSnap || canonical(result) !== canonical(remoteSnap)) {
      try {
        version = await api.putSnapshot(version, result.schema, sealSnapshot(dataKey, JSON.stringify(result)));
      } catch (e) {
        if (e instanceof CloudConflictError && attempt < ATTEMPTS - 1) continue;
        throw e;
      }
    }
    break;
  }
  if (RECEIPT_FILES && result) await syncReceipts(api, dataKey, result);
  return { changedLocal, version };
}

/** Uploads receipt photos the cloud lacks and downloads the ones this phone lacks. One failure skips that photo. */
async function syncReceipts(api: CloudApi, dataKey: Uint8Array, data: Snapshot) {
  const inCloud = new Set(await api.listReceipts());
  const stored = new Set(
    [...data.tables.expenses, ...data.tables.relief_claims].map((r) => r.receipt_uri as string | null).filter(isStoredReceipt),
  );
  for (const path of stored) {
    const name = path.slice('receipts/'.length);
    if (!NAME.test(name)) continue;
    try {
      const here = receiptExists(path);
      if (here && !inCloud.has(name)) {
        const base64 = await readReceiptBase64(path);
        if (base64) await api.putReceipt(name, sealReceipt(dataKey, fromBase64(base64)));
      } else if (!here && inCloud.has(name)) {
        await writeReceiptBase64(path, toBase64(openReceipt(dataKey, await api.getReceipt(name))));
      }
    } catch (e) {
      if (e instanceof CloudAuthError) throw e;
    }
  }
}
