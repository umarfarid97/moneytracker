import { findReceiptDate, parseReceiptText } from '@/domain/receiptText';

const SAMPLE = `MR DIY TRADING SDN BHD
Lot 12, Jalan Ampang
TAX INVOICE
Date: 12/10/2026 14:22
Item A            12.00
Item B            30.50
Sub Total         42.50
SST 8%             3.40
Rounding           0.00
Grand Total       45.90
Cash              50.00
Change             4.10`;

describe('parseReceiptText', () => {
  test('reads total, SST, merchant and date from a typical Malaysian receipt', () => {
    expect(parseReceiptText(SAMPLE)).toEqual({ total: 4590, sst: 340, merchant: 'Mr Diy Trading Sdn Bhd', date: '2026-10-12' });
  });

  test('falls back to the largest amount when no total label is found, and handles thousands', () => {
    const r = parseReceiptText('Kedai Buku\n1,250.00\n99.90');
    expect(r.total).toBe(125000);
    expect(r.sst).toBeNull();
  });

  test('ignores percentages and tax-invoice headings', () => {
    const r = parseReceiptText('Cafe Ali\nTax Invoice No 123\nService Tax 6.00%  1.20\nJumlah 21.20');
    expect(r.sst).toBe(120);
    expect(r.total).toBe(2120);
  });

  test('returns nulls for empty text', () => {
    expect(parseReceiptText('')).toEqual({ total: null, sst: null, merchant: null, date: null });
  });
});

describe('findReceiptDate', () => {
  test('accepts day-first and year-first, rejects impossible dates', () => {
    expect(findReceiptDate('05-03-26')).toBe('2026-03-05');
    expect(findReceiptDate('2026/03/05')).toBe('2026-03-05');
    expect(findReceiptDate('31/02/2026')).toBeNull();
  });
});
