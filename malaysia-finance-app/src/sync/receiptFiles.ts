import { Directory, File, Paths } from 'expo-file-system';
import { nativeReceiptFile } from '../nativeReceiptFile';
import { isReceiptReference } from '../receiptReference';
import { receiptMime } from '../receiptKind';
import { receiptFilesChanged } from '../receiptVersion';
import { createFile, downloadUrl, DriveAuthError, mediaUrl } from './drive';

/** Phones keep receipt photos as files, so they go into backups and Drive sync. */
export const RECEIPT_FILES = true;

/** Receipts saved by this app version ("receipts/receipt-123.jpg"); older absolute paths are left alone. */
export const isStoredReceipt = isReceiptReference;

const fileFor = nativeReceiptFile;
function ensureDir() {
  const dir = new Directory(Paths.document, 'receipts');
  if (!dir.exists) dir.create({ idempotent: true, intermediates: true });
}
const mimeOf = receiptMime;

/** Nothing to load first: phone receipts are plain files. */
export const prepareReceipts = async (): Promise<void> => {};

export function receiptExists(stored: string): boolean {
  return fileFor(stored).exists;
}

export async function readReceiptBase64(stored: string): Promise<string | null> {
  const file = fileFor(stored);
  return file.exists ? file.base64() : null;
}

export async function writeReceiptBase64(stored: string, base64: string): Promise<void> {
  ensureDir();
  const file = fileFor(stored);
  if (!file.exists) file.create();
  await file.write(base64, { encoding: 'base64' });
  receiptFilesChanged();
}

export async function uploadReceipt(token: string, stored: string, name: string): Promise<void> {
  const id = await createFile(token, name, mimeOf(stored));
  const res = await fileFor(stored).upload(mediaUrl(id), {
    httpMethod: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    mimeType: mimeOf(stored),
  });
  if (res.status === 401) throw new DriveAuthError();
  if (res.status >= 300) throw new Error(`Receipt upload failed (${res.status})`);
}

export async function downloadReceipt(token: string, id: string, stored: string): Promise<void> {
  ensureDir();
  await File.downloadFileAsync(downloadUrl(id), fileFor(stored), {
    headers: { Authorization: `Bearer ${token}` },
    idempotent: true,
  });
  receiptFilesChanged();
}
