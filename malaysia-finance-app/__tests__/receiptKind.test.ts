import {
  checkReceiptFile, documentFileName, formatBytes, isImageReceipt, MAX_RECEIPT_BYTES, receiptDisplayName, receiptMime,
} from '@/receiptKind';

describe('receiptKind', () => {
  test('tells pictures from documents and gives each a mime type', () => {
    expect(isImageReceipt('receipts/receipt-1.jpg')).toBe(true);
    expect(isImageReceipt('receipts/receipt-1-TNB.pdf')).toBe(false);
    expect(receiptMime('receipts/receipt-1-TNB.pdf')).toBe('application/pdf');
    expect(receiptMime('receipts/a.xlsx')).toContain('spreadsheetml');
    expect(receiptMime('receipts/receipt-1.png')).toBe('image/png');
  });

  test('keeps a safe version of the original name so the receipt can show it', () => {
    const name = documentFileName('TNB bill (Oct) 2026.PDF', 1700);
    expect(name).toBe('receipt-1700-TNB_bill_Oct_2026.pdf');
    expect(/^[A-Za-z0-9._-]{1,100}$/.test(name)).toBe(true);
    expect(receiptDisplayName(`receipts/${name}`)).toBe('TNB_bill_Oct_2026.pdf');
    expect(receiptDisplayName('receipts/receipt-1700.jpg')).toBe('receipt.jpg');
    expect(documentFileName('日本語.pdf', 5)).toBe('receipt-5.pdf');
  });

  test('refuses files that are too big or of an unknown type', () => {
    expect(() => checkReceiptFile('a.pdf', 1000)).not.toThrow();
    expect(() => checkReceiptFile('a.pdf', MAX_RECEIPT_BYTES + 1)).toThrow(expect.objectContaining({ code: 'tooLarge' }));
    expect(() => checkReceiptFile('a.exe', 10)).toThrow(expect.objectContaining({ code: 'unsupported' }));
    expect(() => checkReceiptFile('constructor', 10)).toThrow(expect.objectContaining({ code: 'unsupported' }));
  });

  test('formats sizes', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});
