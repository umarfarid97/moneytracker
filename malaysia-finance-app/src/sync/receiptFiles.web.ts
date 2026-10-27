import { hasReceipt, loadReceipts, readReceiptBlob, saveReceiptBlob } from '../receipts.web';
import { createFile, downloadUrl, DriveAuthError, mediaUrl } from './drive';

/** The web build keeps receipt photos in the browser's IndexedDB; they go into backups and cloud sync like phone files. */
export const RECEIPT_FILES = true;

/** Receipts saved by this app version ("receipts/receipt-123.jpg"). */
export const isStoredReceipt = (stored: string | null): stored is string => !!stored && /^receipts\/[^/]+$/.test(stored);

const MIME: Record<string, string> = { png: 'image/png', heic: 'image/heic', webp: 'image/webp' };
const mimeOf = (stored: string) => MIME[stored.split('.').pop()?.toLowerCase() ?? ''] ?? 'image/jpeg';

/** Reads the browser's saved receipts first, so receiptExists can answer straight away. */
export const prepareReceipts = (): Promise<void> => loadReceipts();

export const receiptExists = (stored: string): boolean => hasReceipt(stored);

export async function readReceiptBase64(stored: string): Promise<string | null> {
  const blob = await readReceiptBlob(stored);
  if (!blob) return null;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export async function writeReceiptBase64(stored: string, base64: string): Promise<void> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  await saveReceiptBlob(stored, new Blob([bytes], { type: mimeOf(stored) }));
}

export async function uploadReceipt(token: string, stored: string, name: string): Promise<void> {
  const blob = await readReceiptBlob(stored);
  if (!blob) return;
  const id = await createFile(token, name, mimeOf(stored));
  const res = await fetch(mediaUrl(id), {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': mimeOf(stored) },
    body: blob,
  });
  if (res.status === 401) throw new DriveAuthError();
  if (res.status >= 300) throw new Error(`Receipt upload failed (${res.status})`);
}

export async function downloadReceipt(token: string, id: string, stored: string): Promise<void> {
  const res = await fetch(downloadUrl(id), { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) throw new DriveAuthError();
  if (!res.ok) throw new Error(`Receipt download failed (${res.status})`);
  await saveReceiptBlob(stored, await res.blob());
}
