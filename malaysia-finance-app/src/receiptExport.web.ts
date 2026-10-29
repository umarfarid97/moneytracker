import { requireReceiptReference } from './receiptReference';

export function receiptReferenceForExport(value: unknown): string | null {
  if (value == null) return null;
  requireReceiptReference(value);
  return value;
}
