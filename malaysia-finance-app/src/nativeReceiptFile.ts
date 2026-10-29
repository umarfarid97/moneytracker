import { File, Paths } from 'expo-file-system';
import { isReceiptReference, requireReceiptReference } from './receiptReference';

/** Old absolute saves are usable only inside this app's current receipt directory. */
export function nativeReceiptReference(stored: string): string | null {
  if (isReceiptReference(stored)) return stored;
  const prefix = `${Paths.document.uri.replace(/\/+$/, '')}/receipts/`;
  if (!stored.startsWith(prefix)) return null;
  const relative = `receipts/${stored.slice(prefix.length)}`;
  return isReceiptReference(relative) ? relative : null;
}

export function nativeReceiptFile(stored: string): File {
  requireReceiptReference(stored);
  const expected = `${Paths.document.uri.replace(/\/+$/, '')}/${stored}`;
  const file = new File(Paths.document, stored);
  if (file.uri !== expected) throw new Error('Receipt outside app directory');
  return file;
}
