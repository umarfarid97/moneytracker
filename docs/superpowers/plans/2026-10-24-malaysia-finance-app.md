# Malaysia Finance & Budget Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a React Native (Expo) app for Android and iOS that tracks spending, budgets, commitments and tax reliefs, and calculates Malaysian income tax and loan affordability, all on-device.

**Architecture:** Pure TypeScript domain modules (money, tax, loan, budget, commitments) with no React or database imports, fully unit-tested. A thin SQLite repository layer (expo-sqlite, numbered migrations) feeds React hooks. Screens use Expo Router and a shared design system produced by the design-taste-frontend skill.

**Tech Stack:** Expo (managed) + TypeScript, Expo Router, expo-sqlite, react-native-reanimated, react-native-gesture-handler, expo-notifications, expo-image-picker, expo-file-system, Jest (jest-expo).

**Spec:** `docs/superpowers/specs/2026-10-24-malaysia-finance-app-design.md`

## Global Constraints

- One React Native codebase for Android and iOS (Expo managed workflow, TypeScript strict).
- All data local in SQLite. No account, no server, no network calls at runtime.
- Money is stored and computed as integer sen. Floats are never stored. Display as `RM 1,234.50`.
- Dates and "today" use the `Asia/Kuala_Lumpur` time zone. Store dates as `YYYY-MM-DD` text.
- Tax and relief figures live in data files per assessment year (YA), each citing its LHDN source URL and fetch date. Logic files contain no tax figures.
- Schema changes go only through numbered migrations.
- Every calculator screen shows an "estimate, not official advice" notice.
- English UI; all user-facing strings come from `src/i18n/en.ts`.
- Home screen is the category-tiles layout (amount left plus status word per category under today's total).
- Animations run at 60 fps on the UI thread (Reanimated); no spinners for local data.
- UI is designed by running the design-taste-frontend skill; its no-slop rules and screenshot look-and-fix loop apply.

## Review Focus

1. Loan or tax rate of 0% and tenure of 0 or 1 month: no division by zero or NaN; instalment equals principal / months.
2. Commitments exceed net income: loan max principal is RM 0 with verdict "not suitable", never negative.
3. Chargeable income at or below 0 and exactly RM 35,000 / RM 5,000 edges: tax is RM 0 and rebate applies only at or below RM 35,000, never producing negative tax.
4. Amount entry: "1,234.5", "12.999", "", ".5" and very large numbers parse to valid sen or a clear error, never NaN.
5. Entries near midnight and month end (23:59 on the last day) land in the correct day and month in Kuala Lumpur time, and deleting a category keeps its past expenses (moved to "Lain-lain").

---

## File Structure

```
malaysia-finance-app/
  app/                         Expo Router screens
    _layout.tsx
    (tabs)/index.tsx           Home (tiles)
    (tabs)/spending.tsx
    (tabs)/commitments.tsx
    (tabs)/tax.tsx
    (tabs)/more.tsx
    add-expense.tsx
    budget.tsx
    relief/[id].tsx
    tax-calculator.tsx
    loan-calculator.tsx
  src/
    domain/                    pure logic, no React/DB
      money.ts  dates.ts  budget.ts  commitments.ts  netpay.ts  loan.ts  tax.ts  reliefs.ts
    data/tax/                  ya2025.ts (and later years), types.ts
    db/                        client.ts migrations.ts repos/*.ts
    hooks/                     useExpenses.ts useBudgets.ts useCommitments.ts useReliefs.ts
    ui/                        theme.ts and components (from design skill)
    i18n/en.ts
  __tests__/                   mirrors src/domain and src/db
```

---

### Task 1: Project scaffold and tooling

**Files:**
- Create: `malaysia-finance-app/` (Expo TypeScript template with Expo Router), `jest.config.js`, `.gitignore`
- Test: `__tests__/smoke.test.ts`

**Interfaces:**
- Produces: working `npm test`, `npx tsc --noEmit`, `npx expo start`; path alias `@/` mapping to `src/`.

- [ ] **Step 1:** Create the app with `npx create-expo-app@latest malaysia-finance-app --template default`, run `git init`, and install `expo-sqlite expo-notifications expo-image-picker expo-file-system react-native-reanimated react-native-gesture-handler` plus dev deps `jest-expo @types/jest`. Enable `"strict": true` and the `@/*` alias in `tsconfig.json`.
- [ ] **Step 2:** Write `__tests__/smoke.test.ts` asserting `1 + 1 === 2`.
- [ ] **Step 3:** Run `npx jest` and `npx tsc --noEmit`. Expected: 1 test passes, no type errors.
- [ ] **Step 4:** Commit `chore: scaffold expo app with jest`.

### Task 2: Money and date utilities

**Files:**
- Create: `src/domain/money.ts`, `src/domain/dates.ts`
- Test: `__tests__/domain/money.test.ts`, `__tests__/domain/dates.test.ts`

**Interfaces:**
- Produces:
  - `type Sen = number` (integer)
  - `parseRM(input: string): Sen | null` (accepts "1,234.5", ".5", "12"; rejects "", "abc", more than 2 decimals, negatives)
  - `formatRM(sen: Sen): string` -> `"RM 1,234.50"`
  - `rmToSen(rm: number): Sen` (rounds half up)
  - `todayKL(now?: Date): string` -> `YYYY-MM-DD` in Asia/Kuala_Lumpur
  - `monthKey(date: string): string` -> `YYYY-MM`
  - `daysLeftInMonth(date: string): number` (including that day)

- [ ] **Step 1:** Write failing tests: `parseRM("1,234.5") === 123450`, `parseRM(".5") === 50`, `parseRM("12.999") === null`, `parseRM("") === null`, `formatRM(123450) === "RM 1,234.50"`, `todayKL(new Date("2026-10-31T16:30:00Z")) === "2026-11-01"` (00:30 KL next day), `daysLeftInMonth("2026-10-31") === 1`.
- [ ] **Step 2:** Run `npx jest money dates`. Expected: FAIL (modules missing).
- [ ] **Step 3:** Implement both files; use `Intl.DateTimeFormat` with `timeZone: "Asia/Kuala_Lumpur"` for `todayKL`. Parse with string handling, not `parseFloat`.
- [ ] **Step 4:** Run `npx jest money dates`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: money and date utilities`.

### Task 3: Database client, migrations and repositories

**Files:**
- Create: `src/db/client.ts`, `src/db/migrations.ts`, `src/db/repos/{categories,expenses,budgets,commitments,reliefClaims,profile}.ts`
- Test: `__tests__/db/repos.test.ts` (uses an in-memory better-sqlite3 shim or a mocked `expo-sqlite` adapter exposing `runAsync/getAllAsync`)

**Interfaces:**
- Consumes: `Sen`, `monthKey` from Task 2.
- Produces:
  - `openDb(): Promise<Db>`; `migrate(db: Db): Promise<void>` using `PRAGMA user_version`.
  - Types: `Category {id, name, icon, sortOrder}`, `Expense {id, amount: Sen, categoryId, date, note, receiptUri?}`, `Budget {categoryId, month, limit: Sen}`, `Commitment {id, name, amount: Sen, dayOfMonth, kind: 'bill'|'loan'|'subscription', active}`, `ReliefClaim {id, reliefId, year, amount: Sen, receiptUri?, note}`, `Profile {grossMonthly: Sen, netMonthlyOverride?: Sen, epfRate, socsoMonthly, eisMonthly}`.
  - Repo functions: `addExpense`, `updateExpense`, `deleteExpense`, `listExpensesByDate(date)`, `listExpensesByMonth(month)`, `deleteCategory(id)` (moves its expenses to the "Lain-lain" category in the same transaction), plus the equivalent CRUD for the other repos. Default Malaysian categories (Makan, Transport, Bil, Rumah, Hiburan, Kesihatan, Pendidikan, Lain-lain) are seeded by migration 1.

- [ ] **Step 1:** Write failing tests: migration from empty gives `user_version = 1` and 8 default categories; re-running `migrate` is a no-op; `deleteCategory` moves expenses to Lain-lain and keeps their count; amounts round-trip as integers.
- [ ] **Step 2:** Run `npx jest db`. Expected: FAIL.
- [ ] **Step 3:** Implement client, migrations (migration array indexed by version, each run in a transaction) and repos with parameterised queries only.
- [ ] **Step 4:** Run `npx jest db`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: sqlite schema, migrations and repositories`.

### Task 4: Budget logic

**Files:**
- Create: `src/domain/budget.ts`
- Test: `__tests__/domain/budget.test.ts`

**Interfaces:**
- Consumes: `Sen`.
- Produces:
  - `type Status = 'on-track' | 'tight' | 'over'`
  - `categoryStatus(spent: Sen, limit: Sen): { left: Sen; status: Status }` where `left` may be negative; `on-track` below 80% of limit, `tight` from 80% up to and including 100%, `over` above 100%; limit 0 with any spend is `over`, limit 0 with no spend is `on-track`.
  - `dailyAllowance(totalLimitLeft: Sen, daysLeft: number): Sen` (floors at 0).

- [ ] **Step 1:** Write failing tests for: 79.99% -> on-track, exactly 80% -> tight, exactly 100% -> tight, 100.01% -> over, limit 0 cases, `dailyAllowance(-500, 5) === 0`, `daysLeft` of 0 is treated as 1.
- [ ] **Step 2:** Run `npx jest budget`. Expected: FAIL.
- [ ] **Step 3:** Implement with integer comparisons (`spent * 100` vs `limit * 80`), no division.
- [ ] **Step 4:** Run `npx jest budget`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: budget status logic`.

### Task 5: Commitment logic

**Files:**
- Create: `src/domain/commitments.ts`
- Test: `__tests__/domain/commitments.test.ts`

**Interfaces:**
- Consumes: `Commitment`, `Sen`.
- Produces:
  - `nextDueDate(dayOfMonth: number, today: string): string` (day 31 in a 30-day month falls on the last day; if the date has passed this month, return next month).
  - `daysUntil(due: string, today: string): number`
  - `monthlyCommitmentTotal(list: Commitment[]): Sen` (active only)

- [ ] **Step 1:** Write failing tests: day 31 in November -> Nov 30; day 29 in non-leap February -> Feb 28; today equal to due day returns today; December rolls to January; inactive commitments excluded from total.
- [ ] **Step 2:** Run `npx jest commitments`. Expected: FAIL.
- [ ] **Step 3:** Implement with plain date arithmetic on `YYYY-MM-DD` strings (no local-time `Date` parsing).
- [ ] **Step 4:** Run `npx jest commitments`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: commitment due-date logic`.

### Task 6: Net pay and loan calculator logic

**Files:**
- Create: `src/domain/netpay.ts`, `src/domain/loan.ts`
- Test: `__tests__/domain/netpay.test.ts`, `__tests__/domain/loan.test.ts`

**Interfaces:**
- Consumes: `Sen`, `Profile`.
- Produces:
  - `estimateNetMonthly(p: Profile): Sen` (uses `netMonthlyOverride` if set; otherwise gross minus `epfRate` share, SOCSO and EIS; never below 0)
  - `type LoanKind = 'home' | 'car' | 'personal'`
  - `LOAN_DEFAULTS: Record<LoanKind, {ratePct: number; maxYears: number; method: 'reducing'|'flat'}>` = home 4.5/35/reducing, car 3.0/9/flat, personal 8.0/10/reducing
  - `DSR_LIMIT = 0.65`, `COMFORT_LIMIT = 0.50`
  - `monthlyInstalment(principal: Sen, ratePct: number, months: number, method: 'reducing'|'flat'): Sen`
  - `maxPrincipal(instalment: Sen, ratePct: number, months: number, method): Sen`
  - `assessLoan(i: {netMonthly: Sen; commitments: Sen; kind: LoanKind; ratePct: number; months: number; method; requestedPrincipal?: Sen}): { maxInstalment: Sen; comfortableInstalment: Sen; maxPrincipal: Sen; comfortablePrincipal: Sen; verdict?: 'comfortable'|'tight'|'not-suitable' }` where `maxInstalment = max(0, net*0.65 - commitments)`, `comfortableInstalment = max(0, net*0.50 - commitments)`, and the verdict (only when `requestedPrincipal` is given) is `comfortable` if `(commitments + instalment) / net <= 0.50`, `tight` if `<= 0.65`, else `not-suitable`; net of 0 is always `not-suitable`.

- [ ] **Step 1:** Write failing tests: reducing-balance RM 300,000 at 4.5% for 30 years -> RM 1,520.06 per month; flat RM 50,000 at 3% for 5 years -> (50,000 + 50,000 × 0.03 × 5) / 60 = RM 958.33; rate 0% -> principal / months; `maxPrincipal` followed by `monthlyInstalment` returns within 1 sen per month of the input instalment; commitments above 65% of net -> all maxima 0; net 0 -> `not-suitable`; `estimateNetMonthly` with override returns override.
- [ ] **Step 2:** Run `npx jest netpay loan`. Expected: FAIL.
- [ ] **Step 3:** Implement using the standard annuity formula for `reducing`, with an explicit branch for rate 0; round to sen only at the final result.
- [ ] **Step 4:** Run `npx jest netpay loan`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: net pay and loan affordability logic`.

### Task 7: Tax data (verified against LHDN) and tax engine

**Files:**
- Create: `src/data/tax/types.ts`, `src/data/tax/ya2025.ts` (or the latest published YA), `src/domain/tax.ts`, `src/domain/reliefs.ts`
- Test: `__tests__/domain/tax.test.ts`, `__tests__/domain/reliefs.test.ts`

**Interfaces:**
- Consumes: `Sen`.
- Produces:
  - `TaxYearData {ya: number; sourceUrl: string; fetchedOn: string; brackets: {upTo: Sen | null; ratePct: number}[]; rebateThreshold: Sen; rebateAmount: Sen; spouseRebate: Sen; reliefs: ReliefDef[]}`
  - `ReliefDef {id: string; name: string; limit: Sen; group?: string; groupLimit?: Sen; requiresReceipt: boolean; note?: string}`
  - `computeTax(chargeable: Sen, data: TaxYearData, opts?: {spouseRebate?: boolean}): { tax: Sen; rebate: Sen; byBracket: {from: Sen; to: Sen | null; ratePct: number; taxed: Sen; tax: Sen}[] }`
  - `chargeableIncome(i: {salary: Sen; freelanceGross: Sen; businessGross: Sen; allowableExpenses: Sen; reliefsTotal: Sen}): Sen` (floors at 0)
  - `capReliefClaims(claims: ReliefClaim[], defs: ReliefDef[]): { perRelief: Record<string, {claimed: Sen; allowed: Sen}>; total: Sen; missingReceipts: string[] }` (applies each relief limit and each `groupLimit`).

- [ ] **Step 1:** Fetch the current resident individual tax rates, rebate and relief limits for the target YA from hasil.gov.my. Record the URL and date in the data file. Stop and ask the user if the official page cannot be read; never fill in figures from memory.
- [ ] **Step 2:** Write failing tests using the fetched figures: tax at each bracket edge (edge, edge + 1 sen), chargeable 0 -> tax 0, chargeable exactly at the rebate threshold gets the rebate and 1 sen above does not, tax never negative after rebate, a claim above its limit is capped, a grouped relief never exceeds its `groupLimit`, a relief that requires a receipt and has none appears in `missingReceipts`, `byBracket` taxed amounts sum to the chargeable income.
- [ ] **Step 3:** Run `npx jest tax reliefs`. Expected: FAIL.
- [ ] **Step 4:** Implement the engine; it reads only from `TaxYearData`. Use integer math with one rounding step per bracket (round half up to sen).
- [ ] **Step 5:** Run `npx jest tax reliefs`. Expected: PASS.
- [ ] **Step 6:** Commit `feat: tax data and engine`.

### Task 8: Design system via design-taste-frontend

**Files:**
- Create: `src/ui/theme.ts`, `src/ui/{Screen,Card,Tile,Button,AmountInput,Sheet,ProgressBar,Chip}.tsx`, `src/i18n/en.ts`
- Test: `__tests__/ui/theme.test.ts` (tokens exist, contrast of text on background >= 4.5:1)

**Interfaces:**
- Consumes: `formatRM`, `Status` (for status colours).
- Produces: `theme` (colour tokens for light and dark, spacing, radius, type scale), `<Tile title left status onPress/>`, `<AmountInput value onChange/>` (uses `parseRM`, shows validation), `<Sheet>` bottom sheet with a gesture-driven close, and `t(key)` string lookup.

- [ ] **Step 1:** Invoke the design-taste-frontend skill for a mobile finance app; record the chosen direction (type, palette, motion rules) at the top of `theme.ts` as a comment.
- [ ] **Step 2:** Write the failing theme test, run it (FAIL), build the tokens and components, run it (PASS).
- [ ] **Step 3:** Run the app in the browser or emulator, take screenshots, and fix issues the skill's inspection flags.
- [ ] **Step 4:** Commit `feat: design system`.

### Task 9: Data hooks and app shell

**Files:**
- Create: `src/hooks/{useDb,useExpenses,useBudgets,useCommitments,useReliefs,useProfile}.ts`, `app/_layout.tsx`, `app/(tabs)/_layout.tsx`
- Test: `__tests__/hooks/useExpenses.test.tsx`

**Interfaces:**
- Consumes: repos from Task 3.
- Produces: hooks returning `{data, add, update, remove}` that update in-memory state first (optimistic) and then write to SQLite; `DbProvider` opens and migrates the DB once and gates rendering of children until ready.

- [ ] **Step 1:** Write a failing test: adding an expense updates the hook's list before the repo promise resolves, and rolls back if the repo rejects.
- [ ] **Step 2:** Run `npx jest hooks`. Expected: FAIL.
- [ ] **Step 3:** Implement the hooks and provider; set up the five-tab layout.
- [ ] **Step 4:** Run `npx jest hooks`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: data hooks and app shell`.

### Task 10: Home screen and spending tracker

**Files:**
- Create: `app/(tabs)/index.tsx`, `app/(tabs)/spending.tsx`, `app/add-expense.tsx`
- Test: `__tests__/screens/home.test.tsx`

**Interfaces:**
- Consumes: `categoryStatus`, `dailyAllowance`, `todayKL`, `formatRM`, `Tile`, `AmountInput`, expense and budget hooks.
- Produces: Home shows today's total, "RM X left for today" (`dailyAllowance`), and one `Tile` per category with left amount and status word. Add-expense sheet is reachable from a floating button on every tab and saves in at most 3 taps (amount, category, save). Spending tab lists by day with swipe-to-delete and edit.

- [ ] **Step 1:** Write a failing render test: with a seeded budget of RM 600 for Makan and RM 420 spent, the Makan tile shows "RM 180.00 left" and "on track"; a category over limit shows "over budget".
- [ ] **Step 2:** Run `npx jest screens/home`. Expected: FAIL.
- [ ] **Step 3:** Implement the screens with Reanimated layout transitions for list changes.
- [ ] **Step 4:** Run `npx jest screens/home`. Expected: PASS. Then run the app and check adding, editing and deleting an expense on the device preview.
- [ ] **Step 5:** Commit `feat: home tiles and spending tracker`.

### Task 11: Budget planning screen

**Files:**
- Create: `app/budget.tsx`
- Test: `__tests__/screens/budget.test.tsx`

**Interfaces:**
- Consumes: budget hooks, `AmountInput`, `monthKey`.
- Produces: per-category monthly limit editor, a month total, and "copy last month's budget" action.

- [ ] **Step 1:** Write a failing test: setting Makan to RM 600 persists a `Budget` for the current month; "copy last month" duplicates all limits without overwriting limits already set this month.
- [ ] **Step 2:** Run `npx jest screens/budget`. Expected: FAIL.
- [ ] **Step 3:** Implement the screen.
- [ ] **Step 4:** Run `npx jest screens/budget`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: budget planning`.

### Task 12: Commitment tracker with reminders

**Files:**
- Create: `app/(tabs)/commitments.tsx`, `src/notifications.ts`
- Test: `__tests__/notifications.test.ts`

**Interfaces:**
- Consumes: `nextDueDate`, `daysUntil`, `monthlyCommitmentTotal`, commitment hooks.
- Produces: list sorted by next due date with "due in N days" labels, monthly total, add/edit sheet. `scheduleReminders(list: Commitment[], today: string): Promise<void>` cancels all previously scheduled reminders and schedules one local notification per active commitment, 1 day before due at 09:00 KL time.

- [ ] **Step 1:** Write a failing test with a mocked notifications module: rescheduling twice yields exactly one notification per active commitment; inactive ones get none.
- [ ] **Step 2:** Run `npx jest notifications`. Expected: FAIL.
- [ ] **Step 3:** Implement; request notification permission on first add and handle denial without crashing.
- [ ] **Step 4:** Run `npx jest notifications`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: commitment tracker and reminders`.

### Task 13: Tax relief tracker with receipts

**Files:**
- Create: `app/(tabs)/tax.tsx`, `app/relief/[id].tsx`
- Test: `__tests__/screens/tax.test.tsx`

**Interfaces:**
- Consumes: `capReliefClaims`, the tax year data, relief hooks, `expo-image-picker`, `expo-file-system`.
- Produces: checklist of reliefs with progress against each limit, total relief claimed, warnings for missing receipts. Receipt photos are copied into the app's document directory and the stored `receiptUri` points there (not to the picker's temporary file).

- [ ] **Step 1:** Write a failing test: adding a claim over a relief's limit shows the capped amount as allowed and the surplus as "not claimable"; a receipt-required relief without a photo shows a warning.
- [ ] **Step 2:** Run `npx jest screens/tax`. Expected: FAIL.
- [ ] **Step 3:** Implement the screens.
- [ ] **Step 4:** Run `npx jest screens/tax`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: tax relief tracker`.

### Task 14: Tax calculator screen

**Files:**
- Create: `app/tax-calculator.tsx`
- Test: `__tests__/screens/taxCalculator.test.tsx`

**Interfaces:**
- Consumes: `chargeableIncome`, `computeTax`, `capReliefClaims`, profile hook (prefills salary), tax year data.
- Produces: inputs for salary, freelance income, business income, allowable expenses, PCB already paid; relief total is pulled from the tracker. Output: chargeable income, tax payable, rebate, balance payable or refund (tax minus PCB), a per-bracket breakdown, and the estimate notice.

- [ ] **Step 1:** Write a failing test: with inputs and reliefs chosen from the tax test fixtures, the screen shows the same tax figure as `computeTax`, and a PCB larger than tax shows "refund".
- [ ] **Step 2:** Run `npx jest screens/taxCalculator`. Expected: FAIL.
- [ ] **Step 3:** Implement the screen with live recalculation as the user types.
- [ ] **Step 4:** Run `npx jest screens/taxCalculator`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: tax calculator`.

### Task 15: Loan calculator screen

**Files:**
- Create: `app/loan-calculator.tsx`, `app/(tabs)/more.tsx`
- Test: `__tests__/screens/loan.test.tsx`

**Interfaces:**
- Consumes: `assessLoan`, `LOAN_DEFAULTS`, `estimateNetMonthly`, `monthlyCommitmentTotal`, profile and commitment hooks.
- Produces: loan type picker, salary (prefilled from profile), commitments (prefilled from tracker, editable), rate and tenure (prefilled from defaults, editable), optional requested amount. Output: verdict badge, borrowable range (comfortable to maximum), maximum instalment, and the estimate notice. `more.tsx` links to profile, budget, tax calculator and loan calculator.

- [ ] **Step 1:** Write a failing test: net RM 5,000 with commitments RM 1,000 gives max instalment RM 2,250 (65% of net minus commitments) and comfortable instalment RM 1,500; commitments of RM 4,000 show "not suitable" and RM 0 range.
- [ ] **Step 2:** Run `npx jest screens/loan`. Expected: FAIL.
- [ ] **Step 3:** Implement the screens.
- [ ] **Step 4:** Run `npx jest screens/loan`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: loan calculator`.

### Task 16: Polish, performance and final verification

**Files:**
- Modify: screens as needed. Create: `README.md` (how to run, how to update tax data each year).
- Test: full suite

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1:** Run `npx jest` and `npx tsc --noEmit`. Expected: all tests pass, zero type errors.
- [ ] **Step 2:** Run the app on an Android emulator or Expo Go and, where available, an iOS simulator. Walk through every feature: add 200 sample expenses and confirm lists scroll smoothly with no dropped frames, add/edit/delete in each area, kill and reopen the app and confirm data persists.
- [ ] **Step 3:** Run the design skill's inspection and screenshot loop on every screen in light and dark mode; fix what it flags.
- [ ] **Step 4:** Test migration: install the earlier build's database file, then open the new build; data must remain.
- [ ] **Step 5:** Commit `chore: polish and docs`. Report anything that could not be verified (for example, no iOS device available).

---

## Self-Review Notes

- **Spec coverage:** spending tracker (10), budget planning (11), commitments with reminders (5, 12), tax relief with receipts (7, 13), tax calculator with several income kinds (7, 14), loan calculator with verdict and range (6, 15), local DB with migrations (3), tiles home (8, 10), correctness plan (7 step 1, tests per domain task, 16). Bahasa Malaysia is deferred; strings are centralised in Task 8.
- **Type consistency:** `Sen`, `Status`, `Commitment`, `ReliefClaim`, `Profile`, `TaxYearData` are defined once (Tasks 2-3, 4, 7) and reused by name.
- **Open items from the spec** (target tax year, Bahasa timing) are settled in Task 7 step 1 (latest published YA) and left deferred respectively.
