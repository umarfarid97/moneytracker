import { brandFor, BRANDS } from './banks';
import { addDays } from './dates';
import type { Sen } from './money';
import type { StatementRow } from './statementParse';
import type { Category, Expense, NewExpense, PaymentMethod } from './types';

/** A statement line on the preview screen: what will be saved, whether it is ticked, and why it may be a repeat. */
export type ImportItem = {
  key: string;
  date: string;
  note: string;
  amount: Sen;
  categoryId: number;
  paymentMethodId: number | null;
  selected: boolean;
  /** An existing spending (or an earlier line in the same file) on the same day for the same amount. */
  duplicate: boolean;
  /** Looks like moving money to an e-wallet (a reload or top-up), not spending; left unticked. */
  topUp: boolean;
};

/** An e-wallet reload or top-up: the money is spent later from the wallet, so counting it too would double up. */
const TOP_UP = /((reload|top\s*-?\s*up).*(tng|touch\s*n\s*go|grabpay|boost|shopeepay|e-?wallet)|(tng|touch\s*n\s*go|grabpay|boost|shopeepay|e-?wallet).*(reload|top\s*-?\s*up))/i;

/** Short names that should stay in capitals when a bank line is softened. */
const ACRONYMS = /\b(klcc|kl|tng|pj|jb|usj|sdn|bhd|atm|tnb|iwk|mrt|lrt|ktm|kfc|my|qr|uob|cimb|rhb|ocbc|hsbc|bsn|mae|sst|ssm|dbkl|mbpj|mbsa|ptptn|kwsp|epf|socso|jompay|duitnow)\b/gi;

/** Words in a statement line and the default category that usually fits (names as in the default categories). */
const KEYWORDS: { category: string; words: RegExp }[] = [
  { category: 'Transport', words: /(petron|shell|petronas|caltex|bhpetrol|petrol|touch\s*n\s*go|tng\b|rfid|plus\s*(?:toll|highway)|toll|grab\s*(?!food|mart)|grabcar|mrt|lrt|ktm|rapid\s*(?:kl|rail|bus)|parking|parkir|mbpj|dbkl|mbsa|aeroline|airasia|malaysia\s*airlines|mas\b|firefly|bus\s*online|easybook)/i },
  { category: 'Makan', words: /(grabfood|foodpanda|shopeefood|mcdonald|kfc|domino|pizza\s*hut|starbucks|zus\s*coffee|texas\s*chicken|marrybrown|subway|sushi|nasi|mamak|restoran|restaurant|kopitiam|cafe|coffee|bakery|kenny\s*rogers|secret\s*recipe|burger|tealive|chagee|gong\s*cha|ayam|7-?eleven)/i },
  { category: 'Rumah', words: /(tesco|lotus|giant|aeon|mydin|jaya\s*grocer|99\s*speedmart|village\s*grocer|econsave|nsk|mr\.?\s*diy|ikea|rent|sewa|maintenance|sinking\s*fund|management\s*fee|ace\s*hardware|grocer|hypermarket|supermarket)/i },
  { category: 'Bil', words: /(tnb|tenaga|syabas|air\s*selangor|pba|sain|sesco|unifi|time\s*dotcom|maxis|celcom|digi|u\s*mobile|umobile|yes\s*4g|astro|indah\s*water|iwk|telekom|tm\s*net|hotlink|xpax|redone|bill\s*payment|jompay|bayaran\s*bil)/i },
  { category: 'Hiburan', words: /(netflix|spotify|disney|viu|youtube|steam|playstation|nintendo|tgv|gsc|golden\s*screen|cinema|wayang|genting|app\s*store|google\s*play|apple\.com|tiktok|karaoke|bowling|concert|ticket2u)/i },
  { category: 'Kesihatan', words: /(clinic|klinik|hospital|pharmacy|farmasi|guardian|watsons|caring|poliklinik|dental|pergigian|medic|health|optical|vision|kpj|pantai|sunway\s*medical|columbia)/i },
  { category: 'Pendidikan', words: /(school|sekolah|univers|college|kolej|tuition|tuisyen|yuran|ptptn|mph|popular\s*book|kinokuniya|udemy|coursera|exam|peperiksaan)/i },
];

/** The words in a bank line that identify the merchant, for comparing with notes you typed before. */
function merchantKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/\b(pos|debit|purchase|pembelian|card|kad|dbt|crd|duitnow|qr|ibg|ibft|instant|transfer|payment|bayaran|to|from|ref|no|my|kl|selangor|petaling\s*jaya|malaysia|sdn|bhd)\b/g, ' ')
    .replace(/[^a-z]+/g, ' ')
    .trim();
}

/** A better-looking note than the raw bank line: no card/reference codes, capitals softened. */
export function tidyDescription(text: string): string {
  const cleaned = text
    .replace(/\b(?:POS\s*)?(?:DEBIT|PURCHASE|PEMBELIAN)\b/gi, ' ')
    .replace(/\b\d{6,}\b/g, ' ')
    .replace(/\b[A-Z]{0,3}\d{5,}[A-Z\d]*\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const base = cleaned === '' ? text.trim() : cleaned;
  const shown = base === base.toUpperCase()
    ? base.toLowerCase().replace(/(^|[\s(/-])([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase())
    : base;
  return shown.replace(ACRONYMS, (w) => w.toUpperCase()).slice(0, 80);
}

/**
 * The category for a statement line: what you chose for the same merchant before, then the keyword table, then
 * the catch-all. `fallback` is used when none of those match (the last category, normally "Lain-lain").
 */
export function suggestCategory(description: string, categories: Category[], history: Expense[]): number {
  const fallback = categories.find((c) => c.name === 'Lain-lain')?.id ?? categories[categories.length - 1]?.id ?? 1;
  const key = merchantKey(description);
  if (key.length >= 3) {
    const seen = history.find((e) => {
      const past = merchantKey(e.note);
      return past.length >= 3 && (past === key || key.includes(past) || past.includes(key));
    });
    if (seen && categories.some((c) => c.id === seen.categoryId)) return seen.categoryId;
  }
  for (const rule of KEYWORDS) {
    if (!rule.words.test(description)) continue;
    const match = categories.find((c) => c.name === rule.category);
    if (match) return match.id;
  }
  return fallback;
}

/** The payment method a statement was probably from: the one named like the bank or wallet, else the first of that kind. */
export function suggestPaymentMethod(sourceName: string, text: string, methods: PaymentMethod[]): number | null {
  const wanted = brandFor(sourceName) ?? BRANDS.find((b) => b.aliases.concat(b.name).some((n) => text.toLowerCase().includes(n.toLowerCase())));
  if (wanted) {
    const exact = methods.find((m) => brandFor(m.name)?.id === wanted.id);
    if (exact) return exact.id;
    const sameKind = methods.find((m) => m.kind === wanted.kind && brandFor(m.name) === null);
    if (sameKind) return sameKind.id;
  }
  return methods.find((m) => m.kind === 'transfer')?.id ?? methods.find((m) => m.kind === 'debit')?.id ?? methods[0]?.id ?? null;
}

/** Spending already saved that this line probably repeats: same amount within a day of the date. */
export function isDuplicate(row: { date: string; amount: Sen }, existing: Expense[]): boolean {
  const near = [addDays(row.date, -1), row.date, addDays(row.date, 1)];
  return existing.some((e) => e.amount === row.amount && near.includes(e.date));
}

type Context = {
  categories: Category[];
  methods: PaymentMethod[];
  existing: Expense[];
  /** File name and a snippet of the statement, to tell which bank it came from. */
  source: string;
  sourceText: string;
};

/** Only money that went out becomes spending. Lines also come with their category, method and repeat check. */
export function buildImportItems(rows: StatementRow[], ctx: Context): { items: ImportItem[]; skippedIn: number } {
  const methodId = suggestPaymentMethod(ctx.source, ctx.sourceText, ctx.methods);
  const items: ImportItem[] = [];
  const seenInFile = new Set<string>();
  let skippedIn = 0;
  rows.forEach((row, i) => {
    if (row.direction === 'in') { skippedIn++; return; }
    const note = tidyDescription(row.description);
    const fileKey = `${row.date}|${row.amount}|${merchantKey(row.description)}`;
    const repeatInFile = seenInFile.has(fileKey);
    seenInFile.add(fileKey);
    const duplicate = repeatInFile || isDuplicate(row, ctx.existing);
    const topUp = TOP_UP.test(row.description);
    items.push({
      key: `r${i}`,
      date: row.date,
      note,
      amount: row.amount,
      categoryId: suggestCategory(row.description, ctx.categories, ctx.existing),
      paymentMethodId: methodId,
      selected: !duplicate && !topUp,
      duplicate,
      topUp,
    });
  });
  return { items, skippedIn };
}

/** Joins an item into the one above it: amounts add up, notes are combined, the earlier date is kept. */
export function mergeIntoPrevious(items: ImportItem[], key: string): ImportItem[] {
  const at = items.findIndex((i) => i.key === key);
  if (at <= 0) return items;
  const above = items[at - 1];
  const item = items[at];
  const note = above.note === item.note || item.note === '' ? above.note : `${above.note} + ${item.note}`.slice(0, 80);
  const merged: ImportItem = {
    ...above,
    note,
    amount: above.amount + item.amount,
    date: above.date < item.date ? above.date : item.date,
    selected: above.selected || item.selected,
    duplicate: above.duplicate && item.duplicate,
    topUp: above.topUp && item.topUp,
  };
  return [...items.slice(0, at - 1), merged, ...items.slice(at + 1)];
}

/** The spending to save for the ticked items. */
export function toNewExpenses(items: ImportItem[]): NewExpense[] {
  return items
    .filter((i) => i.selected && i.amount > 0)
    .map((i) => ({
      amount: i.amount, categoryId: i.categoryId, date: i.date, note: i.note, receiptUri: null,
      paymentMethodId: i.paymentMethodId,
    }));
}
