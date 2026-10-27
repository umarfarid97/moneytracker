/** What a receipt file may be, how big, and how to name and describe it. Shared by the phone and web builds. */

/** Largest receipt file kept, in bytes. Pictures are shrunk first; documents (PDF bills and the like) are stored as they are. */
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

export const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'heic', 'webp']);

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  webp: 'image/webp',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  txt: 'text/plain',
};

/** Extensions the file picker accepts for a receipt. */
export const RECEIPT_EXTENSIONS: readonly string[] = Object.keys(MIME);

/** Lets the web file chooser offer pictures and the documents above. */
export const RECEIPT_ACCEPT = `image/*,${Object.keys(MIME).filter((e) => !IMAGE_EXTENSIONS.has(e)).map((e) => `.${e}`).join(',')}`;

export type ReceiptErrorCode = 'tooLarge' | 'unsupported';

/** A picked file that cannot be a receipt; the screen shows a message for its code. */
export class ReceiptError extends Error {
  constructor(readonly code: ReceiptErrorCode) {
    super(code === 'tooLarge' ? 'Receipt file is too large' : 'Receipt file type is not supported');
    this.name = 'ReceiptError';
  }
}

/** Lower-case extension of a file name or uri (query strings ignored), or ''. */
export function extensionOf(nameOrUri: string): string {
  const match = /\.([a-zA-Z0-9]+)(?:\?.*)?$/.exec(nameOrUri);
  return match ? match[1].toLowerCase() : '';
}

/** True for a stored receipt that is a picture; anything else is a document. */
export const isImageReceipt = (stored: string): boolean => IMAGE_EXTENSIONS.has(extensionOf(stored));

const known = (ext: string): boolean => Object.prototype.hasOwnProperty.call(MIME, ext);

export const receiptMime = (stored: string): string => {
  const ext = extensionOf(stored);
  return known(ext) ? MIME[ext] : 'image/jpeg';
};

/**
 * File name for a picked document: "receipt-<time>-<original name>.<ext>". Keeping the original name (cut to safe
 * characters, so cloud and Drive accept it) means the receipt can show what it is without a new database field.
 */
export function documentFileName(originalName: string, now: number): string {
  const ext = extensionOf(originalName);
  const base = originalName.replace(/\.[a-zA-Z0-9]+$/, '').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^[._-]+|[._-]+$/g, '').slice(0, 40);
  return `receipt-${now}${base ? `-${base}` : ''}.${ext}`;
}

/** Name to show for a stored receipt ("TNB_bill.pdf"); plain pictures just say what they are. */
export function receiptDisplayName(stored: string): string {
  const file = stored.split('/').pop() ?? stored;
  const ext = extensionOf(file);
  const match = /^receipt-\d+-(.+)\.[a-zA-Z0-9]+$/.exec(file);
  if (match) return `${match[1]}.${ext}`;
  return `receipt.${ext || 'jpg'}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Throws ReceiptError when a picked file is too big or not a type receipts allow. Pass size when known. */
export function checkReceiptFile(name: string, size: number | null | undefined): void {
  if (!known(extensionOf(name))) throw new ReceiptError('unsupported');
  if (size != null && size > MAX_RECEIPT_BYTES) throw new ReceiptError('tooLarge');
}
