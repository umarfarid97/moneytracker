import { addDays, daysInMonth, monthKey, shiftMonth } from './dates';
import { missedRuns } from './income';
import type { Sen } from './money';
import { encodeBill, splitBill, type SplitBill } from './owed';
import { periodKey } from './budgetPeriod';
import type { PaymentKind, LoanType } from './types';

/**
 * Made-up data for trying out every feature, for a salaried person in Kuala Lumpur. It is only a plan: nothing
 * here touches the database (see db/repos/demo.ts, which loads it and tags every row so it can be cleared).
 * Everything is placed relative to today, so the current and the previous month are always filled in.
 */
export type CategoryKey = 'food' | 'transport' | 'bills' | 'home' | 'fun' | 'health' | 'edu' | 'other';

/** The built-in category each key stands for. */
export const DEMO_CATEGORY_NAMES: Record<CategoryKey, string> = {
  food: 'Makan', transport: 'Transport', bills: 'Bil', home: 'Rumah', fun: 'Hiburan', health: 'Kesihatan', edu: 'Pendidikan', other: 'Lain-lain',
};

/** Profile fields the demo fills in when the profile is still empty. Column names, as in the database. */
export const DEMO_PROFILE = {
  gross_monthly: 650_000,
  socso_monthly: 3_000,
  eis_monthly: 1_200,
  pcb_monthly: 32_000,
  budget_start_day: 25,
} as const;

export type DemoExpense = {
  key: string; amount: Sen; category: CategoryKey; pay: PaymentKind | null; date: string; note: string;
  reliefId?: string; reliefAmount?: Sen; currency?: string; foreignAmount?: number; fxRate?: number;
  /** Set for a payment of a bill or loan. */
  bill?: { key: string; dueDate: string };
};
export type DemoBill = {
  key: string; name: string; amount: Sen; dayOfMonth: number; kind: 'bill' | 'loan' | 'subscription'; category: CategoryKey;
  pay: PaymentKind; variable: boolean; reliefId: string | null; startDate: string;
  loan?: { type: LoanType; original: Sen; balance: Sen; balanceDate: string; ratePct: number | null };
};
export type DemoOwedEntry = { key: string; person: string; kind: 'lent' | 'repaid' | 'borrowed' | 'paidBack'; amount: Sen; date: string; note: string; bill: string };
export type DemoPlan = {
  today: string;
  bills: DemoBill[];
  expenses: DemoExpense[];
  budgets: { category: CategoryKey; month: string; limit: Sen }[];
  reliefClaims: { key: string; reliefId: string; year: number; amount: Sen; note: string }[];
  retirement: { key: string; scheme: 'epf' | 'socso' | 'eis'; kind: 'contribution' | 'dividend' | 'opening'; date: string; amount: Sen; employerShare: Sen; note: string }[];
  giving: { key: string; kind: 'zakat' | 'fitrah' | 'sedekah' | 'waqf'; date: string; amount: Sen; recipient: string; note: string; countsForTax: boolean }[];
  savings: { key: string; name: string; kind: 'tabung_haji' | 'asb' | 'hajj' | 'prs' | 'unit_trust' | 'other'; balance: Sen; invested: Sen; target: Sen | null; monthly: Sen | null; note: string }[];
  projects: { key: string; name: string; startDate: string; endDate: string | null; members: string[]; entries: DemoOwedEntry[] }[];
  incomeRule: { key: string; name: string; amount: Sen; dayOfMonth: number; startDate: string; lastRun: string | null };
  incomeEntries: { key: string; name: string; amount: Sen; date: string }[];
};

const RM = (n: number): Sen => Math.round(n * 100);
const pad = (n: number) => String(n).padStart(2, '0');

/** Day `day` of `month`, held back to the month's last day. */
function dayOf(month: string, day: number): string {
  const [y, m] = month.split('-').map(Number);
  return `${month}-${pad(Math.min(day, daysInMonth(y, m)))}`;
}

type Spend = {
  day: number; category: CategoryKey; pay: PaymentKind; rm: number; note: string; reliefId?: string; reliefRm?: number;
};
// A typical month of spending. Relief-tagged items feed the tax pages.
const MONTH_SPENDING: Spend[] = [
  { day: 1, category: 'food', pay: 'debit', rm: 18.5, note: 'Nasi lemak & teh tarik' },
  { day: 2, category: 'transport', pay: 'ewallet', rm: 25, note: "Touch 'n Go reload" },
  { day: 3, category: 'food', pay: 'credit', rm: 62.4, note: 'Jaya Grocer' },
  { day: 4, category: 'fun', pay: 'ewallet', rm: 32, note: 'GSC movie tickets' },
  { day: 6, category: 'food', pay: 'cash', rm: 14.9, note: 'Mamak dinner' },
  { day: 7, category: 'transport', pay: 'credit', rm: 80, note: 'Petrol RON95' },
  { day: 8, category: 'health', pay: 'debit', rm: 45, note: 'Guardian vitamins' },
  { day: 9, category: 'food', pay: 'ewallet', rm: 38, note: 'GrabFood' },
  { day: 10, category: 'edu', pay: 'credit', rm: 129, note: 'Online course', reliefId: 'lifestyle', reliefRm: 129 },
  { day: 11, category: 'food', pay: 'debit', rm: 21, note: 'Lunch near office' },
  { day: 13, category: 'other', pay: 'cash', rm: 50, note: 'Gift for colleague' },
  { day: 14, category: 'food', pay: 'credit', rm: 154.2, note: 'Village Grocer weekly shop' },
  { day: 15, category: 'transport', pay: 'ewallet', rm: 12, note: 'Parking KLCC' },
  { day: 16, category: 'home', pay: 'debit', rm: 89, note: 'IKEA organiser' },
  { day: 17, category: 'fun', pay: 'credit', rm: 120, note: 'Dinner in Bangsar' },
  { day: 19, category: 'health', pay: 'debit', rm: 180, note: 'Dental scaling', reliefId: 'medical-dental', reliefRm: 180 },
  { day: 20, category: 'food', pay: 'cash', rm: 9.5, note: 'Roti canai' },
  { day: 21, category: 'transport', pay: 'ewallet', rm: 30, note: 'Tol PLUS' },
  { day: 22, category: 'edu', pay: 'debit', rm: 85, note: 'Books at Kinokuniya', reliefId: 'lifestyle', reliefRm: 85 },
  { day: 23, category: 'fun', pay: 'ewallet', rm: 40, note: 'Badminton court', reliefId: 'sports', reliefRm: 40 },
  { day: 24, category: 'food', pay: 'debit', rm: 27, note: 'Lunch with the team' },
  { day: 26, category: 'food', pay: 'credit', rm: 96, note: 'Weekend brunch' },
  { day: 27, category: 'transport', pay: 'credit', rm: 85, note: 'Petrol RON95' },
  { day: 28, category: 'other', pay: 'transfer', rm: 200, note: 'Allowance for parents' },
];

/** Same plan on a given day, so loading it twice on one day gives the same data. */
export function buildDemoPlan(today: string): DemoPlan {
  const thisMonth = monthKey(today);
  const lastMonth = shiftMonth(thisMonth, -1);
  const year = Number(today.slice(0, 4));
  const todayDay = Number(today.slice(8, 10));
  const startDate = `${lastMonth}-01`;

  const bills: DemoBill[] = [
    { key: 'rent', name: 'Rent (room in Mont Kiara)', amount: RM(1100), dayOfMonth: 1, kind: 'bill', category: 'home', pay: 'transfer', variable: false, reliefId: null, startDate },
    { key: 'tnb', name: 'TNB electricity', amount: RM(160), dayOfMonth: 12, kind: 'bill', category: 'bills', pay: 'debit', variable: true, reliefId: null, startDate },
    { key: 'unifi', name: 'Unifi Home 100Mbps', amount: RM(129), dayOfMonth: 5, kind: 'bill', category: 'bills', pay: 'credit', variable: false, reliefId: 'lifestyle', startDate },
    { key: 'maxis', name: 'Maxis postpaid', amount: RM(98), dayOfMonth: 20, kind: 'bill', category: 'bills', pay: 'credit', variable: false, reliefId: null, startDate },
    { key: 'netflix', name: 'Netflix', amount: RM(55), dayOfMonth: 18, kind: 'subscription', category: 'fun', pay: 'credit', variable: false, reliefId: null, startDate },
    { key: 'spotify', name: 'Spotify', amount: RM(17.9), dayOfMonth: 22, kind: 'subscription', category: 'fun', pay: 'ewallet', variable: false, reliefId: null, startDate },
    { key: 'insurance', name: 'AIA life insurance', amount: RM(220), dayOfMonth: 28, kind: 'bill', category: 'health', pay: 'debit', variable: false, reliefId: 'life-insurance', startDate },
    {
      key: 'car', name: 'Car loan (Myvi)', amount: RM(780), dayOfMonth: 10, kind: 'loan', category: 'transport', pay: 'transfer', variable: false, reliefId: null, startDate,
      loan: { type: 'car', original: RM(52_000), balance: RM(38_400), balanceDate: startDate, ratePct: 3.2 },
    },
    {
      key: 'ptptn', name: 'PTPTN', amount: RM(250), dayOfMonth: 25, kind: 'loan', category: 'edu', pay: 'transfer', variable: false, reliefId: null, startDate,
      loan: { type: 'ptptn', original: RM(40_000), balance: RM(22_500), balanceDate: startDate, ratePct: null },
    },
  ];

  const expenses: DemoExpense[] = [];
  for (const [mi, month] of [lastMonth, thisMonth].entries()) {
    MONTH_SPENDING.forEach((s, i) => {
      // The previous month differs a little, so the reports have something to compare.
      const factor = mi === 0 ? 1 + (((i * 7) % 9) - 4) / 40 : 1;
      const rm = Math.round(s.rm * factor * 10) / 10;
      const day = month === thisMonth ? Math.min(s.day, todayDay) : s.day;
      expenses.push({
        key: `${month}-${i}`, amount: RM(rm), category: s.category, pay: s.pay, date: dayOf(month, day), note: s.note,
        reliefId: s.reliefId, reliefAmount: s.reliefRm !== undefined ? RM(Math.round(s.reliefRm * factor * 10) / 10) : undefined,
      });
    });
    for (const b of bills) {
      const dueDate = dayOf(month, b.dayOfMonth);
      if (dueDate > today) continue;
      const amount = b.key === 'tnb' ? RM(mi === 0 ? 152.3 : 171.8) : b.amount;
      expenses.push({
        key: `${month}-bill-${b.key}`, amount, category: b.category, pay: b.pay, date: dueDate, note: b.name,
        reliefId: b.reliefId ?? undefined, reliefAmount: b.reliefId ? amount : undefined, bill: { key: b.key, dueDate },
      });
    }
  }
  expenses.push({
    key: 'sgd-trip', amount: RM(153), category: 'food', pay: 'credit', date: dayOf(lastMonth, 8), note: 'Hawker centre in Singapore',
    currency: 'SGD', foreignAmount: 4500, fxRate: 3.4,
  });

  // Budgets run from payday (the 25th) in the demo, for the period we are in and the one before.
  const thisPeriod = periodKey(today, DEMO_PROFILE.budget_start_day);
  const limits: Record<CategoryKey, number> = { food: 900, transport: 350, bills: 450, home: 200, fun: 250, health: 200, edu: 150, other: 250 };
  const budgets = [shiftMonth(thisPeriod, -1), thisPeriod].flatMap((month) =>
    (Object.keys(limits) as CategoryKey[]).map((category) => ({ category, month, limit: RM(limits[category]) })),
  );

  const reliefClaims = [
    { key: 'life', reliefId: 'life-insurance', year, amount: RM(2_400), note: 'AIA premiums' },
    { key: 'sspn', reliefId: 'sspn', year, amount: RM(3_000), note: 'SSPN-i Plus top-up' },
    { key: 'prs', reliefId: 'prs', year, amount: RM(3_000), note: 'PRS contribution' },
    { key: 'parents', reliefId: 'parents-medical', year, amount: RM(1_500), note: "Father's health screening" },
  ];

  const retirement: DemoPlan['retirement'] = [
    { key: 'epf-open', scheme: 'epf', kind: 'opening', date: `${year - 1}-12-31`, amount: RM(58_000), employerShare: 0, note: 'Balance from i-Akaun' },
    { key: 'epf-div', scheme: 'epf', kind: 'dividend', date: `${year - 1}-12-31`, amount: RM(3_400), employerShare: 0, note: 'Dividend' },
  ];
  for (const k of [-2, -1, 0]) {
    const month = shiftMonth(thisMonth, k);
    const date = dayOf(month, 15);
    if (date > today) continue;
    retirement.push(
      { key: `epf-${month}`, scheme: 'epf', kind: 'contribution', date, amount: RM(1_560), employerShare: RM(845), note: 'Salary contribution' },
      { key: `socso-${month}`, scheme: 'socso', kind: 'contribution', date, amount: RM(135), employerShare: RM(105), note: '' },
      { key: `eis-${month}`, scheme: 'eis', kind: 'contribution', date, amount: RM(24), employerShare: RM(12), note: '' },
    );
  }

  const giving: DemoPlan['giving'] = [
    { key: 'zakat-1', kind: 'zakat', date: dayOf(lastMonth, 28), amount: RM(180), recipient: 'Lembaga Zakat Selangor', note: 'Zakat pendapatan', countsForTax: true },
    { key: 'zakat-2', kind: 'zakat', date: dayOf(thisMonth, Math.min(28, todayDay)), amount: RM(180), recipient: 'Lembaga Zakat Selangor', note: 'Zakat pendapatan', countsForTax: true },
    { key: 'sedekah-1', kind: 'sedekah', date: dayOf(lastMonth, 14), amount: RM(100), recipient: 'Yayasan Hasanah', note: 'Approved charity', countsForTax: true },
    { key: 'sedekah-2', kind: 'sedekah', date: dayOf(thisMonth, Math.min(9, todayDay)), amount: RM(30), recipient: 'Masjid tabung', note: 'Friday donation', countsForTax: false },
    { key: 'waqf-1', kind: 'waqf', date: dayOf(lastMonth, 20), amount: RM(50), recipient: 'Waqaf An-Nur', note: '', countsForTax: false },
  ];

  const savings: DemoPlan['savings'] = [
    { key: 'th', name: 'Tabung Haji', kind: 'tabung_haji', balance: RM(12_500), invested: 0, target: null, monthly: RM(100), note: '' },
    { key: 'asb', name: 'ASB', kind: 'asb', balance: RM(15_000), invested: RM(15_000), target: null, monthly: null, note: 'Loan-free units' },
    { key: 'emergency', name: 'Emergency fund', kind: 'other', balance: RM(8_000), invested: 0, target: RM(20_000), monthly: RM(500), note: 'Three months of spending' },
    { key: 'prs', name: 'PRS', kind: 'prs', balance: RM(5_200), invested: RM(5_000), target: null, monthly: RM(250), note: '' },
    { key: 'japan', name: 'Holiday in Japan', kind: 'other', balance: RM(2_300), invested: 0, target: RM(8_000), monthly: RM(400), note: '' },
  ];

  const trip = splitBill({ total: RM(840), mode: 'equal', others: ['Aiman', 'Siti', 'Wei Jie'].map((name) => ({ name, value: 1 })) });
  const hotel: SplitBill = {
    id: 'demo-bill-hotel', total: RM(840), paid: [{ name: '', amount: RM(840) }], parts: trip.parts, mine: trip.mine,
    mode: 'equal', typed: trip.parts.map(() => '1'), myShares: '1',
  };
  const tripDate = dayOf(lastMonth, 12);
  const projects: DemoPlan['projects'] = [
    {
      key: 'langkawi', name: 'Langkawi trip', startDate: tripDate, endDate: dayOf(lastMonth, 14), members: ['Aiman', 'Siti', 'Wei Jie'],
      entries: [
        ...trip.parts.map((p, i) => ({
          key: `hotel-${i}`, person: p.name, kind: 'lent' as const, amount: p.amount, date: tripDate, note: 'Hotel for 2 nights', bill: encodeBill(hotel),
        })),
        { key: 'fuel', person: 'Aiman', kind: 'lent', amount: RM(60), date: dayOf(lastMonth, 13), note: 'Car rental fuel', bill: '' },
        { key: 'siti-back', person: 'Siti', kind: 'repaid', amount: trip.parts[1].amount, date: dayOf(lastMonth, 20), note: 'Paid back by Siti', bill: '' },
      ],
    },
    {
      key: 'office', name: 'Office lunches', startDate: dayOf(thisMonth, 1), endDate: null, members: ['Farah', 'Ravi'],
      entries: [
        { key: 'parking', person: 'Farah', kind: 'borrowed', amount: RM(35), date: dayOf(thisMonth, Math.min(5, todayDay)), note: 'Parking money', bill: '' },
        { key: 'lunch', person: 'Ravi', kind: 'lent', amount: RM(24), date: dayOf(thisMonth, Math.min(8, todayDay)), note: 'Lunch', bill: '' },
        { key: 'lunch-back', person: 'Ravi', kind: 'repaid', amount: RM(24), date: dayOf(thisMonth, Math.min(10, todayDay)), note: 'Ravi paid back', bill: '' },
      ],
    },
  ];

  const rule = { key: 'freelance', name: 'Freelance design', amount: RM(800), dayOfMonth: 20, startDate };
  const runs = missedRuns({ id: 0, ...rule, active: true, lastRun: null }, today);
  const incomeEntries = [
    ...runs.map((date) => ({ key: `run-${date}`, name: rule.name, amount: rule.amount, date })),
    { key: 'phone', name: 'Sold old phone', amount: RM(350), date: addDays(startDate, 6) },
  ];

  return {
    today, bills, expenses, budgets, reliefClaims, retirement, giving, savings, projects,
    incomeRule: { ...rule, lastRun: runs.length > 0 ? runs[runs.length - 1] : null },
    incomeEntries,
  };
}
