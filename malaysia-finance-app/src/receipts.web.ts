import { useEffect, useState } from 'react';
import { isReceiptReference, requireReceiptReference } from './receiptReference';
import {
  checkReceiptFile, documentFileName, extensionOf, IMAGE_EXTENSIONS, isImageReceipt, MAX_RECEIPT_BYTES, RECEIPT_ACCEPT,
  ReceiptError, receiptMime,
} from './receiptKind';

export type ReceiptSource = 'camera' | 'library' | 'file';

/** Longest side kept for a stored receipt, so photos from a phone camera stay small in the browser's storage. */
const MAX_SIDE = 1280;
const JPEG_QUALITY = 0.7;
const DB_NAME = 'duit-receipts';
const STORE = 'receipts';

/** Extension of a picked picture; anything unrecognised is stored as jpg. */
export function receiptExtension(uri: string): string {
  const ext = extensionOf(uri);
  return IMAGE_EXTENSIONS.has(ext) ? ext : 'jpg';
}

// The browser has no file system, so receipt pictures live in IndexedDB (the database itself sits in localStorage,
// which is too small for photos) and are shown through object URLs created from the saved blobs.
const urls = new Map<string, string>();
const sizes = new Map<string, number>();
const listeners = new Set<() => void>();
let version = 0;
let loaded: Promise<void> | null = null;
let loadDone = false;

function bump() {
  version += 1;
  listeners.forEach((l) => l());
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB unavailable'));
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error ?? new Error('Could not save the receipt'));
      tx.onabort = () => reject(tx.error ?? new Error('Could not save the receipt'));
    });
  } finally {
    db.close();
  }
}

/** Reads every saved receipt into object URLs, once. Safe to call repeatedly. */
export function loadReceipts(): Promise<void> {
  if (!loaded) {
    loaded = (async () => {
      try {
        const db = await openDb();
        const entries = await new Promise<[string, Blob][]>((resolve, reject) => {
          const out: [string, Blob][] = [];
          const req = db.transaction(STORE, 'readonly').objectStore(STORE).openCursor();
          req.onsuccess = () => {
            const cur = req.result;
            if (cur) {
              out.push([String(cur.key), cur.value as Blob]);
              cur.continue();
            } else resolve(out);
          };
          req.onerror = () => reject(req.error);
        });
        db.close();
        for (const [key, blob] of entries) if (isReceiptReference(key) && !urls.has(key)) {
          urls.set(key, URL.createObjectURL(blob));
          sizes.set(key, blob.size);
        }
      } catch {
        // No IndexedDB (private mode): receipts attached this visit still show; saved ones just don't.
      }
      loadDone = true;
      bump();
    })();
  }
  return loaded;
}

/** Re-renders the caller once saved receipts have been read or a new one is added. */
export function useReceiptVersion(): number {
  const [v, setV] = useState(version);
  useEffect(() => {
    const l = () => setV(version);
    listeners.add(l);
    void loadReceipts();
    return () => {
      listeners.delete(l);
    };
  }, []);
  return v;
}

/** Shrinks a picture to a JPEG no bigger than MAX_SIDE; a file the browser cannot decode (e.g. HEIC on Chrome) is kept as is. */
async function prepare(file: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    return out && out.size > 0 ? out : file;
  } catch {
    return file;
  }
}

/**
 * Saves a receipt in the browser and returns the key to store with the claim or expense. Pictures are shrunk;
 * documents (PDF and the like) are kept as they are under their own name. Throws ReceiptError when the file is
 * too big or not a type receipts allow.
 */
export async function storeReceipt(source: Blob, now: number = Date.now()): Promise<string> {
  const name = (source as File).name ?? '';
  const isDocument = name !== '' && !isImageReceipt(name) && !source.type.startsWith('image/');
  let blob: Blob;
  let key: string;
  if (isDocument) {
    checkReceiptFile(name, source.size);
    key = `receipts/${documentFileName(name, now)}`;
    blob = new Blob([source], { type: receiptMime(key) });
  } else {
    blob = await prepare(source);
    if (blob.size > MAX_RECEIPT_BYTES) throw new ReceiptError('tooLarge');
    key = `receipts/receipt-${now}.${receiptExtension(`.${blob.type.replace('image/', '')}`)}`;
  }
  await withStore('readwrite', (s) => s.put(blob, key));
  urls.set(key, URL.createObjectURL(blob));
  sizes.set(key, blob.size);
  bump();
  return key;
}

/** True until the saved receipts have been read, so a screen can wait instead of claiming a photo is missing. */
export function receiptPending(stored: string): boolean {
  return !loadDone && !urls.has(stored);
}

/** Whether the picture for this key is in this browser. Call after loadReceipts. */
export const hasReceipt = (key: string): boolean => isReceiptReference(key) && urls.has(key);

/** The saved picture for a key, or null. */
export async function readReceiptBlob(key: string): Promise<Blob | null> {
  if (!isReceiptReference(key)) return null;
  await loadReceipts();
  try {
    const blob = await withStore<Blob | undefined>('readonly', (s) => s.get(key));
    return blob ?? null;
  } catch {
    return null;
  }
}

/** Saves a receipt exactly as given (it came from a backup or another device, already shrunk). */
export async function saveReceiptBlob(key: string, given: Blob): Promise<void> {
  requireReceiptReference(key);
  await loadReceipts();
  // A download may arrive untyped; the type is what lets the browser show a PDF instead of saving it as a blob.
  const blob = given.type === receiptMime(key) ? given : new Blob([given], { type: receiptMime(key) });
  await withStore('readwrite', (s) => s.put(blob, key));
  const old = urls.get(key);
  urls.set(key, URL.createObjectURL(blob));
  sizes.set(key, blob.size);
  if (old) URL.revokeObjectURL(old);
  bump();
}

/** Picture uri for a stored receipt key; empty until saved receipts have loaded (see useReceiptVersion). */
export function resolveReceiptUri(stored: string): string {
  if (!isReceiptReference(stored)) return '';
  void loadReceipts();
  return urls.get(stored) ?? '';
}

/** Size in bytes of a receipt saved in this browser, or null. */
export const receiptSize = (stored: string): number | null => isReceiptReference(stored) ? sizes.get(stored) ?? null : null;

/** Shows a receipt in a new tab when the browser can display it (PDF, text), otherwise saves it. Call straight from a tap. */
export async function openReceipt(stored: string, _dialogTitle: string): Promise<void> {
  if (!isReceiptReference(stored)) return;
  const url = resolveReceiptUri(stored);
  if (!url) return;
  const mime = receiptMime(stored);
  if (mime === 'application/pdf' || mime === 'text/plain') {
    window.open(url, '_blank', 'noopener');
    return;
  }
  const link = document.createElement('a');
  link.href = url;
  link.download = stored.split('/').pop() ?? 'receipt';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** Opens the browser's file chooser (camera on phones for 'camera'). Must run straight from a tap, before any await. */
function chooseFile(source: ReceiptSource): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = source === 'file' ? RECEIPT_ACCEPT : 'image/*';
    if (source === 'camera') input.setAttribute('capture', 'environment');
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    document.body.appendChild(input);
    const done = (file: File | null) => {
      input.remove();
      resolve(file);
    };
    input.addEventListener('change', () => done(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => done(null));
    input.click();
  });
}

/** Takes a photo or chooses one, stores it, and returns its key. Null when cancelled; throws when it cannot be saved. */
export async function pickReceipt(source: ReceiptSource, now: number = Date.now()): Promise<string | null> {
  const file = await chooseFile(source);
  if (!file) return null;
  if (source !== 'file' && file.type && !file.type.startsWith('image/')) throw new ReceiptError('unsupported');
  return storeReceipt(file, now);
}
