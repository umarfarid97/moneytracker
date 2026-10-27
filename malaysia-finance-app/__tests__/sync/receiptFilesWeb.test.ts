// fake-indexeddb cannot clone Blobs the way a browser does, so the browser store is replaced by a map here.
const mockStore = new Map<string, Blob>();
jest.mock('@/receipts.web', () => ({
  loadReceipts: jest.fn(async () => {}),
  hasReceipt: (k: string) => mockStore.has(k),
  readReceiptBlob: jest.fn(async (k: string) => mockStore.get(k) ?? null),
  saveReceiptBlob: jest.fn(async (k: string, b: Blob) => void mockStore.set(k, b)),
}));
import { toBase64 } from '@/sync/bytes';
import { isStoredReceipt, prepareReceipts, readReceiptBase64, RECEIPT_FILES, receiptExists, writeReceiptBase64 } from '@/sync/receiptFiles.web';


test('web receipts take part in backup and sync', async () => {
  expect(RECEIPT_FILES).toBe(true);
  expect(isStoredReceipt('receipts/receipt-1.jpg')).toBe(true);
  expect(isStoredReceipt('https://x/y.jpg')).toBe(false);
  await prepareReceipts();
  expect(receiptExists('receipts/r.jpg')).toBe(false);
  expect(await readReceiptBase64('receipts/r.jpg')).toBeNull();

  const b64 = toBase64(new Uint8Array(40_000).map((_, i) => i % 251));
  await writeReceiptBase64('receipts/r.jpg', b64);
  expect(receiptExists('receipts/r.jpg')).toBe(true);
  expect(await readReceiptBase64('receipts/r.jpg')).toBe(b64);
});
