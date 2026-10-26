import { toCsv } from './csv';
import { formatRM, senToInput, type Sen } from './money';
import type { ReliefPack } from './reliefPack';

/**
 * The relief section of the LHDN e-Filing income tax return for employees (Form BE), in the order
 * and under the headings the form shows them. Each relief the app tracks is one line to key in.
 * Headings follow the form's wording; always check the figures on screen against e-Filing itself,
 * because LHDN changes the form between years.
 */
export const BE_SECTIONS: { id: string; title: string; reliefs: string[] }[] = [
  { id: 'personal', title: 'Individual and family', reliefs: ['spouse', 'spouse-disabled', 'disabled-individual', 'child-under-18', 'child-fulltime-18', 'child-higher-ed', 'child-disabled', 'child-disabled-higher-ed', 'childcare', 'breastfeeding'] },
  { id: 'medical', title: 'Medical and parents', reliefs: ['parents-medical', 'parents-medical-exam', 'disabled-equipment', 'medical-serious', 'medical-vaccination', 'medical-dental', 'medical-checkup', 'child-intervention'] },
  { id: 'education', title: 'Education', reliefs: ['education-self', 'education-upskilling'] },
  { id: 'lifestyle', title: 'Lifestyle', reliefs: ['lifestyle', 'sports'] },
  { id: 'savings', title: 'Savings, insurance and contributions', reliefs: ['epf', 'life-insurance', 'prs', 'sspn', 'insurance-edu-medical', 'socso'] },
  { id: 'other', title: 'Other', reliefs: ['ev-charging', 'housing-interest-500k', 'housing-interest-750k'] },
];

export type BeLine = {
  reliefId: string;
  name: string;
  /** The figure to key into e-Filing: what is allowed after the limits. */
  enter: Sen;
  claimed: Sen;
  limit: Sen;
  items: number;
  missingReceipts: number;
};

export type BeSection = { id: string; title: string; lines: BeLine[]; subtotal: Sen };

export type BeSummary = {
  year: number;
  sections: BeSection[];
  automatic: { name: string; amount: Sen }[];
  total: Sen;
  items: number;
  missingReceipts: number;
};

/** Groups the pack by form section so it can be keyed into e-Filing line by line. */
export function buildBeSummary(pack: ReliefPack): BeSummary {
  const byRelief = new Map(pack.sections.map((s) => [s.reliefId, s]));
  const toLine = (id: string): BeLine | null => {
    const s = byRelief.get(id);
    if (!s) return null;
    return {
      reliefId: id,
      name: s.name,
      enter: s.allowed,
      claimed: s.claimed,
      limit: s.limit,
      items: s.items.length,
      missingReceipts: s.items.filter((it) => it.receipt === 'missing').length,
    };
  };
  const sections: BeSection[] = BE_SECTIONS.map((sec) => {
    const lines = sec.reliefs.map(toLine).filter((l): l is BeLine => l !== null);
    return { id: sec.id, title: sec.title, lines, subtotal: lines.reduce((n, l) => n + l.enter, 0) };
  });
  // A relief added to the tax data but not yet placed above still has to show up.
  const leftovers = pack.sections.filter((s) => !BE_SECTIONS.some((sec) => sec.reliefs.includes(s.reliefId)));
  if (leftovers.length > 0) {
    const lines = leftovers.map((s) => toLine(s.reliefId)).filter((l): l is BeLine => l !== null);
    const other = sections.find((s) => s.id === 'other')!;
    other.lines.push(...lines);
    other.subtotal += lines.reduce((n, l) => n + l.enter, 0);
  }
  const all = sections.flatMap((s) => s.lines);
  return {
    year: pack.year,
    sections: sections.filter((s) => s.lines.length > 0),
    automatic: pack.automatic,
    total: pack.total,
    items: all.reduce((n, l) => n + l.items, 0),
    missingReceipts: all.reduce((n, l) => n + l.missingReceipts, 0),
  };
}

/** Plain text to read down while filling in e-Filing, or to send to yourself or an accountant. */
export function beSummaryText(summary: BeSummary): string {
  const out = [`LHDN e-Filing relief summary, YA ${summary.year}`, ''];
  for (const a of summary.automatic) out.push(`${a.name} (automatic): ${formatRM(a.amount)}`);
  for (const sec of summary.sections) {
    out.push('', sec.title.toUpperCase());
    for (const l of sec.lines) {
      const over = l.claimed > l.enter ? ` (spent ${formatRM(l.claimed)}, limit applied)` : '';
      const missing = l.missingReceipts > 0 ? ` [${l.missingReceipts} receipt${l.missingReceipts === 1 ? '' : 's'} missing]` : '';
      out.push(`- ${l.name}: ${formatRM(l.enter)}${over}${missing}`);
    }
  }
  out.push('', `Total relief: ${formatRM(summary.total)}`, 'Keep receipts for 7 years in case LHDN asks for them.');
  return out.join('\n');
}

/** The same summary as CSV: one row per e-Filing line. */
export function beSummaryCsv(summary: BeSummary): string {
  const rows: (string | number)[][] = [['Year of assessment', summary.year], [], ['Section', 'Relief', 'Enter in e-Filing (RM)', 'Spent (RM)', 'Limit (RM)', 'Items', 'Receipts missing']];
  for (const a of summary.automatic) rows.push(['Automatic', a.name, senToInput(a.amount), '', '', '', '']);
  for (const sec of summary.sections) {
    for (const l of sec.lines) rows.push([sec.title, l.name, senToInput(l.enter), senToInput(l.claimed), senToInput(l.limit), l.items, l.missingReceipts]);
  }
  rows.push([], ['Total relief', '', senToInput(summary.total)]);
  return toCsv(rows);
}
