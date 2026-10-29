import { nativeReceiptReference } from './nativeReceiptFile';

/** Local legacy paths are never sent to another device; only provably contained files migrate. */
export function receiptReferenceForExport(value: unknown): string | null {
  if (value == null) return null;
  const reference = typeof value === 'string' ? nativeReceiptReference(value) : null;
  if (!reference) throw new Error('Invalid receipt reference');
  return reference;
}
