import { isValidDate } from './dates';
import type { Sen } from './money';

export type ReceiptScan = {
  /** Amount to pay, in sen. */
  total: Sen | null;
  /** SST / service tax shown on the receipt, in sen. */
  sst: Sen | null;
  merchant: string | null;
  /** YYYY-MM-DD */
  date: string | null;
};

const MONEY = /(?<![\d.,])(\d{1,3}(?:,\d{3})+|\d+)\.(\d{2})(?![\d])/g;

function amountsIn(line: string): Sen[] {
  // Percentages such as "SST 8.00%" are rates, not money.
  const text = line.replace(/\d+(?:\.\d+)?\s*%/g, ' ');
  return [...text.matchAll(MONEY)].map((m) => Number(m[1].replace(/,/g, '')) * 100 + Number(m[2]));
}

const TOTAL_LABEL = /(grand\s*total|net\s*total|total\s*(?:due|payable|amount|rm)?|jumlah|amount\s*due|amt\s*due|bill\s*amount|balance\s*due)/i;
const NOT_TOTAL = /(sub\s*-?\s*total|total\s*(?:tax|sst|discount|saving|qty|item)|change|baki|tunai|cash\b|tender|rounding|round\s*adj|points?)/i;
const TAX_LABEL = /(\bsst\b|service\s*tax|\bs\.?s\.?t\b|\btax\b|cukai)/i;
const NOT_TAX = /(tax\s*invoice|invoice|reg(?:istration)?\s*no|id\s*no|tin\b|before\s*tax|excl|incl|exclusive|inclusive|total\s*sales)/i;

const SKIP_MERCHANT = /(tax\s*invoice|invoice|receipt|resit|cash\s*bill|bill\b|welcome|thank|tel\b|tel:|fax|www\.|http|gst|sst|reg\b|no\.|^\d|jalan|lorong|taman|^lot\b|^unit\b|^level\b)/i;

/** Finds the date on a receipt: dd/mm/yyyy, dd-mm-yy, dd.mm.yyyy or yyyy-mm-dd. */
export function findReceiptDate(text: string): string | null {
  for (const m of text.matchAll(/(?<!\d)(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/g)) {
    const d = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    if (isValidDate(d)) return d;
  }
  for (const m of text.matchAll(/(?<!\d)(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})(?!\d)/g)) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    const d = `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    if (isValidDate(d)) return d;
  }
  return null;
}

/** Pulls the total, SST, merchant and date out of text read from a receipt photo. Anything not found is null. */
export function parseReceiptText(text: string): ReceiptScan {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let total: Sen | null = null;
  for (const line of lines) {
    if (!TOTAL_LABEL.test(line) || NOT_TOTAL.test(line)) continue;
    const found = amountsIn(line);
    if (found.length > 0) total = found[found.length - 1];
  }
  if (total === null) {
    const all = lines.flatMap(amountsIn);
    if (all.length > 0) total = Math.max(...all);
  }

  let sst: Sen | null = null;
  for (const line of lines) {
    if (!TAX_LABEL.test(line) || NOT_TAX.test(line)) continue;
    const found = amountsIn(line);
    if (found.length === 0) continue;
    const value = found[found.length - 1];
    // A tax line at or above the total is a mislabelled total, not tax.
    if (total === null || value < total) sst = (sst ?? 0) + value;
  }

  const merchant =
    lines.slice(0, 6).find((l) => l.length >= 3 && /[a-zA-Z]{3}/.test(l) && !SKIP_MERCHANT.test(l) && amountsIn(l).length === 0) ?? null;

  return { total, sst, merchant: merchant ? titleCase(merchant) : null, date: findReceiptDate(text) };
}

function titleCase(s: string): string {
  const cleaned = s.replace(/\s+/g, ' ').replace(/[^\w &'.,()/-]/g, '').trim();
  // Receipts print shop names in capitals; keep acronym-like short words, soften the rest.
  if (cleaned !== cleaned.toUpperCase()) return cleaned;
  return cleaned.toLowerCase().replace(/(^|[\s(/-])([a-z])/g, (_m, p, c: string) => p + c.toUpperCase());
}
