import { useEffect, useState } from 'react';

export type ReceiptSource = 'camera' | 'library';

/** Longest side kept for a stored receipt, so photos from a phone camera stay small in the browser's storage. */
const MAX_SIDE = 1600;
const DB_NAME = 'duit-receipts';
const STORE = 'receipts';

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'heic', 'webp']);

/** Extension of a picked picture; anything unrecognised is stored as jpg. */
export function receiptExtension(uri: string): string {
  const match = /\.([a-zA-Z0-9]+)(?:\?.*)?$/.exec(uri);
  const ext = match?.[1].toLowerCase();
  return ext && IMAGE_EXTENSIONS.has(ext) ? ext : 'jpg';
}

// The browser has no file system, so receipt pictures live in IndexedDB (the database itself sits in localStorage,
// which is too small for photos) and are shown through object URLs created from the saved blobs.
const urls = new Map<string, string>();
const listeners = new Set<() => void>();
let version = 0;
let loaded: Promise<void> | null = null;

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
        for (const [key, blob] of entries) if (!urls.has(key)) urls.set(key, URL.createObjectURL(blob));
      } catch {
        // No IndexedDB (private mode): receipts attached this visit still show; saved ones just don't.
      }
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
    const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    return out && out.size > 0 ? out : file;
  } catch {
    return file;
  }
}

/** Saves a picture in the browser and returns the key to store with the claim or expense. */
export async function storeReceipt(source: Blob, now: number = Date.now()): Promise<string> {
  const blob = await prepare(source);
  const ext = receiptExtension(`.${blob.type.replace('image/', '')}`);
  const key = `receipts/receipt-${now}.${ext}`;
  await withStore('readwrite', (s) => s.put(blob, key));
  urls.set(key, URL.createObjectURL(blob));
  bump();
  return key;
}

/** Picture uri for a stored receipt key; empty until saved receipts have loaded (see useReceiptVersion). */
export function resolveReceiptUri(stored: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(stored)) return stored;
  void loadReceipts();
  return urls.get(stored) ?? '';
}

/** Opens the browser's file chooser (camera on phones for 'camera'). Must run straight from a tap, before any await. */
function chooseFile(source: ReceiptSource): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
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
  if (file.type && !file.type.startsWith('image/')) throw new Error('Not a picture');
  return storeReceipt(file, now);
}
