import type { ReceiptScan } from '@/domain/receiptText';

/** The web app has no on-device text recognition, so receipts are attached but not read. */
export async function scanReceipt(_stored: string): Promise<ReceiptScan | null> {
  return null;
}
