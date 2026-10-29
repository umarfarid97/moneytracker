import { RECEIPT_EXTENSIONS } from './receiptKind';

/** Portable database keys, never browser URLs or platform file paths. */
export function isReceiptReference(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^receipts\/([A-Za-z0-9_-][A-Za-z0-9._-]{0,99})$/.exec(value);
  if (!match) return false;
  const extension = match[1].slice(match[1].lastIndexOf('.') + 1).toLowerCase();
  return match[1].includes('.') && RECEIPT_EXTENSIONS.includes(extension);
}

export function requireReceiptReference(value: unknown): asserts value is string {
  if (!isReceiptReference(value)) throw new Error('Invalid receipt reference');
}
