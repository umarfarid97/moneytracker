import { isValidDate } from './dates';
import { parseRM, type Sen } from './money';

/** One line of a bank or e-wallet statement. `out` is money leaving the account. */
export type StatementRow = {
  /** YYYY-MM-DD */
  date: string;
  description: string;
  amount: Sen;
  direction: 'out' | 'in';
  /** Balance after the line, when the statement shows one. */
  balance: Sen | null;
};

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, mac: 3, apr: 4, may: 5, mei: 5, jun: 6, jul: 7, aug: 8, ogos: 8, ogo: 8,
  sep: 9, sept: 9, oct: 10, okt: 10, nov: 11, dec: 12, dis: 12,
};

const pad2 = (n: number) => String(n).padStart(2, '0');

function build(year: number, month: number, day: number): string | null {
  const date = `${year}-${pad2(month)}-${pad2(day)}`;
  return isValidDate(date) ? date : null;
}

/**
 * Finds a date in a cell or line: yyyy-mm-dd, dd/mm/yyyy, dd-mm-yy, dd.mm.yyyy, "01 Oct 2026", "01-OCT-26",
 * or "01 Oct" / "01/10" (the year then comes from `defaultYear`). Malaysian order: day before month.
 */
export function parseStatementDate(text: string, defaultYear: number): string | null {
  const iso = text.match(/(?<!\d)(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/);
  if (iso) return build(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const numeric = text.match(/(?<!\d)(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})(?!\d)/);
  if (numeric) {
    const year = numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3]);
    return build(year, Number(numeric[2]), Number(numeric[1]));
  }
  const named = text.match(/(?<!\d)(\d{1,2})[\s\-/]?([A-Za-z]{3,4})[\s\-/,]*(\d{4}|\d{2})?(?![\d])/);
  if (named) {
    const month = MONTHS[named[2].toLowerCase()];
    if (month) {
      const year = named[3] ? (named[3].length === 2 ? 2000 + Number(named[3]) : Number(named[3])) : defaultYear;
      return build(year, month, Number(named[1]));
    }
  }
  return null;
}

const DATE_LEAD = /^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}[\s\-/]?[A-Za-z]{3,4}(?:[\s\-/,]*\d{2,4})?(?![A-Za-z\d]))/;

/** True when the text starts with something shaped like a date, so wrapped description lines are not mistaken for one. */
export function startsWithDate(text: string, defaultYear: number): boolean {
  const lead = text.trimStart().match(DATE_LEAD);
  return lead !== null && parseStatementDate(lead[0], defaultYear) !== null;
}

export type ParsedAmount = { sen: Sen; sign: -1 | 0 | 1 };

/**
 * A money cell: "1,234.50", "RM 12.00", "(12.00)", "-12.00", "12.00-", "12.00 DR", "12.00 CR", "+12.00".
 * `sign` is -1 when the text says it left the account, 1 when it came in, 0 when it does not say.
 */
export function parseStatementAmount(text: string): ParsedAmount | null {
  let s = text.trim().replace(/^(?:RM|MYR)\s*/i, '').replace(/\s+/g, ' ');
  let sign: -1 | 0 | 1 = 0;
  const paren = s.match(/^\((.*)\)$/);
  if (paren) { s = paren[1]; sign = -1; }
  const suffix = s.match(/\s*(DR|CR|D|C)$/i);
  if (suffix) { sign = suffix[1].toUpperCase().startsWith('D') ? -1 : 1; s = s.slice(0, suffix.index); }
  if (s.startsWith('-')) { sign = -1; s = s.slice(1); }
  else if (s.startsWith('+')) { sign = 1; s = s.slice(1); }
  if (s.endsWith('-')) { sign = -1; s = s.slice(0, -1); }
  else if (s.endsWith('+')) { sign = 1; s = s.slice(0, -1); }
  s = s.replace(/^(?:RM|MYR)\s*/i, '').trim();
  const sen = parseRM(s);
  return sen === null ? null : { sen, sign };
}

/** Rows of a CSV text. Quotes may hold the delimiter and line breaks; the delimiter is the commonest of , ; tab |. */
export function parseCsvRows(text: string): string[][] {
  const body = text.replace(/^﻿/, '');
  const firstLines = body.split(/\r?\n/).slice(0, 15).join('\n');
  const delimiter = [',', ';', '\t', '|']
    .map((d) => ({ d, n: firstLines.split(d).length }))
    .sort((a, b) => b.n - a.n)[0].d;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"') {
        if (body[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && body[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else cell += ch;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

type Columns = {
  date: number;
  description: number[];
  debit: number;
  credit: number;
  amount: number;
  balance: number;
  type: number;
  /** Columns that are neither text to show nor money, e.g. "Status". */
  ignore: number[];
};

const NONE = -1;
const HEADER = {
  date: /\b(date|tarikh)\b/i,
  postingOnly: /\b(posting|value)\b/i,
  description: /(desc|particular|detail|transaction|keterangan|butiran|reference|merchant|payee|remark|narrat|rujukan)/i,
  debit: /(debit|withdraw|money\s*out|paid\s*out|keluar|\bdr\b|pengeluaran)/i,
  credit: /(credit|deposit|money\s*in|paid\s*in|masuk|\bcr\b|deposit)/i,
  amount: /(amount|amt|jumlah|value)/i,
  balance: /(balance|baki)/i,
  type: /(\btype\b|jenis|dr\s*\/\s*cr|cr\s*\/\s*dr)/i,
  status: /^(status|keadaan)$/i,
};

function readHeader(cells: string[]): Columns | null {
  const col: Columns = { date: NONE, description: [], debit: NONE, credit: NONE, amount: NONE, balance: NONE, type: NONE, ignore: [] };
  cells.forEach((raw, i) => {
    const h = raw.trim();
    if (h === '') return;
    if (HEADER.balance.test(h)) { if (col.balance === NONE) col.balance = i; return; }
    if (HEADER.date.test(h)) {
      // "Posting date" / "Value date" lose to a plain "Date" or "Transaction date".
      if (col.date === NONE || (HEADER.postingOnly.test(cells[col.date] ?? '') && !HEADER.postingOnly.test(h))) col.date = i;
      return;
    }
    if (HEADER.debit.test(h) && !HEADER.credit.test(h)) { if (col.debit === NONE) col.debit = i; return; }
    if (HEADER.credit.test(h)) { if (col.credit === NONE) col.credit = i; return; }
    if (HEADER.amount.test(h)) { if (col.amount === NONE) col.amount = i; return; }
    if (HEADER.type.test(h)) { if (col.type === NONE) col.type = i; return; }
    if (HEADER.status.test(h)) { col.ignore.push(i); return; }
    if (HEADER.description.test(h)) col.description.push(i);
  });
  const hasMoney = col.debit !== NONE || col.credit !== NONE || col.amount !== NONE;
  return col.date !== NONE && hasMoney ? col : null;
}

/** With no header row: the column full of dates, the longest text column and the money columns. */
function guessColumns(rows: string[][], year: number): Columns | null {
  const width = Math.max(...rows.map((r) => r.length));
  const sample = rows.slice(0, 40);
  const score = (test: (cell: string) => boolean) =>
    Array.from({ length: width }, (_v, i) => sample.filter((r) => r[i] !== undefined && test(r[i])).length);
  const dates = score((c) => parseStatementDate(c, year) !== null);
  const money = score((c) => /\d/.test(c) && /\./.test(c) && parseStatementAmount(c) !== null);
  const dateCol = dates.indexOf(Math.max(...dates));
  if (dates[dateCol] < 2) return null;
  const moneyCols = money.map((n, i) => ({ n, i })).filter((m) => m.n >= 2 && m.i !== dateCol).map((m) => m.i);
  if (moneyCols.length === 0) return null;
  const textScore = score((c) => /[A-Za-z]{3}/.test(c) && parseStatementDate(c, year) === null);
  const descCol = textScore.indexOf(Math.max(...textScore));
  const col: Columns = { date: dateCol, description: descCol >= 0 ? [descCol] : [], debit: NONE, credit: NONE, amount: NONE, balance: NONE, type: NONE, ignore: [] };
  if (moneyCols.length >= 3) { col.debit = moneyCols[0]; col.credit = moneyCols[1]; col.balance = moneyCols[2]; }
  else if (moneyCols.length === 2) { col.amount = moneyCols[0]; col.balance = moneyCols[1]; }
  else col.amount = moneyCols[0];
  return col;
}

const OPENING = /(opening|beginning|brought\s*forward|b\s*\/\s*f|balance\s*b|closing|ending|carried\s*forward|c\s*\/\s*f|baki\s*(?:awal|permulaan|akhir|bawa)|total|jumlah)/i;

/**
 * Works out which lines went out of the account and which came in when the amount has no sign, by checking
 * the running balance against the lines next to it. The file may list oldest or newest first.
 */
export function directionsFromBalance(rows: { amount: Sen; balance: Sen | null }[]): ('out' | 'in' | null)[] {
  return rows.map((row, i) => {
    if (row.balance === null) return null;
    // The older neighbour is the line above (oldest first) or below (newest first).
    for (const other of [rows[i - 1], rows[i + 1]]) {
      if (!other || other.balance === null) continue;
      const delta = row.balance - other.balance;
      if (delta === row.amount) return 'in';
      if (delta === -row.amount) return 'out';
    }
    return null;
  });
}

type Draft = { date: string; description: string; amount: Sen; sign: -1 | 0 | 1; balance: Sen | null; typeText: string };

const IN_WORDS = /(\bcr\b|credit|deposit|received|transfer\s*from|incoming|terima|reload|top[\s-]?up|refund|cashback|salary|gaji|interest|faedah|dividen|reversal)/i;
const OUT_WORDS = /(\bdr\b|debit|payment|purchase|withdraw|pembelian|bayaran|transfer\s*to|sent)/i;

function settle(drafts: Draft[]): StatementRow[] {
  const byBalance = directionsFromBalance(drafts.map((d) => ({ amount: d.amount, balance: d.balance })));
  return drafts.map((d, i) => {
    let direction: 'out' | 'in';
    if (d.sign !== 0) direction = d.sign < 0 ? 'out' : 'in';
    else if (byBalance[i]) direction = byBalance[i] as 'out' | 'in';
    else if (IN_WORDS.test(`${d.typeText} ${d.description}`) && !OUT_WORDS.test(d.typeText)) direction = 'in';
    else direction = 'out';
    return { date: d.date, description: d.description, amount: d.amount, direction, balance: d.balance };
  });
}

/** Wide window of years a statement can mention, used for dates written without a year. */
export function guessYear(text: string, fallback: number): number {
  const years = [...text.slice(0, 4000).matchAll(/(?<!\d)(20\d{2})(?!\d)/g)].map((m) => Number(m[1]));
  return years.length > 0 ? Math.max(...years) : fallback;
}

/** Reads the transactions of a bank or e-wallet CSV export. Returns [] when no date and amount columns are found. */
export function parseStatementCsv(text: string, fallbackYear: number): StatementRow[] {
  const rows = parseCsvRows(text);
  if (rows.length === 0) return [];
  const year = guessYear(text, fallbackYear);

  let headerAt = -1;
  let col: Columns | null = null;
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    col = readHeader(rows[i]);
    if (col) { headerAt = i; break; }
  }
  if (!col) col = guessColumns(rows, year);
  if (!col) return [];

  const cell = (r: string[], i: number) => (i === NONE ? '' : (r[i] ?? '').trim());
  const drafts: Draft[] = [];
  for (const r of rows.slice(headerAt + 1)) {
    const date = parseStatementDate(cell(r, col.date), year);
    if (!date) continue;
    const description = (col.description.length > 0 ? col.description : r.map((_c, i) => i).filter((i) => i !== col.date && i !== col.amount && i !== col.debit && i !== col.credit && i !== col.balance && i !== col.type && !col.ignore.includes(i)))
      .map((i) => cell(r, i))
      .filter((c, i, all) => c !== '' && all.indexOf(c) === i && !/^[\d.,\-+\s]+$/.test(c))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (OPENING.test(description) && description.length < 40) continue;

    const typeText = cell(r, col.type);
    const balance = col.balance === NONE ? null : parseStatementAmount(cell(r, col.balance))?.sen ?? null;
    const debit = col.debit === NONE ? null : parseStatementAmount(cell(r, col.debit));
    const credit = col.credit === NONE ? null : parseStatementAmount(cell(r, col.credit));
    let picked: ParsedAmount | null = null;
    if (debit && debit.sen > 0) picked = { sen: debit.sen, sign: -1 };
    else if (credit && credit.sen > 0) picked = { sen: credit.sen, sign: 1 };
    else if (col.amount !== NONE) {
      picked = parseStatementAmount(cell(r, col.amount));
      if (picked && picked.sign === 0 && /^(dr|debit)$/i.test(typeText)) picked = { ...picked, sign: -1 };
      else if (picked && picked.sign === 0 && /^(cr|credit)$/i.test(typeText)) picked = { ...picked, sign: 1 };
    }
    if (!picked || picked.sen <= 0) continue;
    drafts.push({ date, description, amount: picked.sen, sign: picked.sign, balance, typeText });
  }
  return settle(drafts);
}

const AMOUNT_TOKEN = /(?:RM\s*)?\(?[+-]?\d{1,3}(?:,\d{3})*\.\d{2}\)?(?:\s?(?:CR|DR))?[+-]?|(?:RM\s*)?\(?[+-]?\d+\.\d{2}\)?(?:\s?(?:CR|DR))?[+-]?/gi;
const BOILERPLATE = /(^page\b|page\s+\d+\s*(?:of|\/)|statement\s+(?:date|of)|account\s+(?:no|number)|penyata|nombor\s+akaun|continued|bersambung|^date\b|tarikh\b.*(?:butiran|description)|\bmuka\s*surat\b)/i;

/**
 * Reads transactions from the text lines of a statement PDF. A line that starts with a date and ends with one or
 * two amounts is a transaction (amount, then the balance); lines without a date are the rest of the description.
 */
export function parseStatementLines(lines: string[], fallbackYear: number): StatementRow[] {
  const year = guessYear(lines.join('\n'), fallbackYear);
  const drafts: Draft[] = [];
  let last: Draft | null = null;
  let continued = 0;

  for (const raw of lines) {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (line === '') continue;
    if (startsWithDate(line, year)) {
      const date = parseStatementDate(line, year);
      const tokens = [...line.matchAll(AMOUNT_TOKEN)];
      if (date && tokens.length > 0) {
        const parsed = tokens.map((m) => ({ m, p: parseStatementAmount(m[0]) })).filter((x) => x.p !== null) as { m: RegExpMatchArray; p: ParsedAmount }[];
        // Amount, then balance; a lone amount is the transaction.
        const txn = parsed.length >= 2 ? parsed[parsed.length - 2] : parsed[parsed.length - 1];
        const bal = parsed.length >= 2 ? parsed[parsed.length - 1] : null;
        if (txn && txn.p.sen > 0) {
          const from = line.match(DATE_LEAD)?.[0].length ?? 0;
          const description = line.slice(from, txn.m.index).replace(/\s+/g, ' ').trim();
          const draft: Draft = { date, description, amount: txn.p.sen, sign: txn.p.sign, balance: bal?.p.sen ?? null, typeText: '' };
          if (!(OPENING.test(description) && description.length < 40)) { drafts.push(draft); last = draft; continued = 0; }
          else last = null;
          continue;
        }
      }
      last = null;
      continue;
    }
    // A wrapped description: no date and no amount, right after a transaction.
    if (last && continued < 2 && !BOILERPLATE.test(line) && !/\d+\.\d{2}/.test(line) && line.length < 80) {
      last.description = `${last.description} ${line}`.trim();
      continued++;
    } else if (/\d+\.\d{2}/.test(line)) last = null;
  }
  return settle(drafts);
}
