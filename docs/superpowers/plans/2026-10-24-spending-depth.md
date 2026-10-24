# Spending Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline). Tests first, watch them fail.

**Goal:** Relief tagging on spending, payment methods, bills that record spending, filters/search/recents, budget warnings, tax filing pack.

**Spec:** `docs/superpowers/specs/2026-10-24-spending-depth-design.md`

## Global Constraints

- Everything in the first plan's Global Constraints still holds (sen integers, KL dates `YYYY-MM-DD`, migrations only, strings in `src/i18n/en.ts`, estimate notice on calculators, design tokens from `src/ui/theme.ts`).
- Existing data survives migration 2. Existing tests keep passing (update fixtures only where the `Expense`/`Commitment` types grow).
- Relief totals come from ONE function, so every screen agrees.

## Review Focus

1. Migration 2 on a database with existing expenses/commitments/claims: nothing lost, new columns null/defaults.
2. A bill's due date can never create two spending rows (mark paid twice, auto-record + mark paid, two app starts).
3. Deleting a payment method or category used by spending/bills keeps the spending (moved to Cash / Lain-lain).
4. A spending entry tagged to a relief is counted once in totals; changing the date's year moves it to that year's claims; clearing the tag removes it.
5. CSV with commas, quotes, newlines and leading `= + - @` is safe.

## Tasks

### 1. Schema, types, repos
Migration 2 (append to `MIGRATIONS`): table `payment_methods(id, name UNIQUE, kind CHECK in cash|debit|credit|ewallet|transfer, sort_order)` seeded Cash, Debit card, Credit card, E-wallet, Online transfer; `expenses` + `payment_method_id INTEGER`, `relief_id TEXT`, `relief_amount INTEGER`, `commitment_id INTEGER`, `due_date TEXT`; partial unique index on `expenses(commitment_id, due_date) WHERE commitment_id IS NOT NULL`; `commitments` + `category_id INTEGER`, `payment_method_id INTEGER`, `relief_id TEXT`, `auto_record INTEGER NOT NULL DEFAULT 0`, `start_date TEXT`, `last_auto_due TEXT`; existing bills get `start_date = date('now','+8 hours')`.
Types: `PaymentMethod {id,name,kind,sortOrder}`; `Expense` adds `paymentMethodId|null, reliefId|null, reliefAmount|null, commitmentId|null, dueDate|null`; `NewExpense` = those optional; `Commitment` adds `categoryId|null, paymentMethodId|null, reliefId|null, autoRecord:boolean, startDate:string|null, lastAutoDue:string|null`.
Repos: `paymentMethods.ts` (`listPaymentMethods, addPaymentMethod, renamePaymentMethod, deletePaymentMethod` moves spending to Cash, Cash protected); update `expenses.ts` and `commitments.ts` for new fields; `expenses.addBillExpense(db, e)` returns `null` instead of inserting when the (commitment_id, due_date) row exists (use `INSERT OR IGNORE`, check `changes`).
Tests: migration from a v1 database with data (upgrade test), repo round trips, duplicate bill expense ignored, delete payment method moves spending to Cash, Cash protected.

### 2. Pure logic
- `domain/reliefSpending.ts`: `claimsFromExpenses(expenses): ReliefClaim[]` (tagged only; `reliefId`, `year` = date year, `amount` = `reliefAmount ?? amount` clamped to 0..amount, `receiptUri`, `note`, negative ids = -expenseId); `suggestRelief(categoryName): string|null`.
- `domain/spendingFilter.ts`: `filterExpenses(expenses, f: {text, categoryId, paymentMethodId, taggedOnly, missingReceipt}, ctx:{categories, reliefs})`, `totalsByMethod(expenses, methods)`, `recentTemplates(expenses, n)`.
- `domain/bills.ts`: `previousDueDate(day, today)` (latest due date <= today), `billStatus({commitment, today, paidDueDates}): {state:'upcoming'|'due'|'overdue'|'paid'|'paused', dueDate, days}`.
- `domain/csv.ts`: `toCsv(rows: (string|number)[][])` with escaping and formula-injection guard; `buildReliefCsv(...)`.
Tests for every function including edge cases above.

### 3. Store and hooks
`DataProvider` gains `paymentMethods` + ops (`usePaymentMethods`), and `useAllReliefClaims(year)` = manual claims + `claimsFromExpenses`. `BillsSync` component auto-records (`recordBillPayment` shared with Mark paid). Tests via hooks harness.

### 4. Payment methods screen (`src/app/payment-methods.tsx`) + link in More. Rename/add/delete with confirm, Cash locked.

### 5. Spending form
Method chips (default Cash), relief picker sheet (searchable, suggestion chip from category), claimable amount, missing-receipt nudge, recent chips, budget warning (`notifyBudgetStatus` in `notifications.ts`).

### 6. Relief screens
Tax tab, relief page, tax calculator use `useAllReliefClaims`; relief page lists spending-linked items (tap opens the spending), manual claims stay deletable.

### 7. Spending list
Search box + Filters sheet (category, method, tagged, missing receipt), per-method totals card, method label and relief/receipt badges on rows.

### 8. Bills
Sheet gets category, method, relief, auto switch; list shows status (upcoming/due/overdue/paid/paused) and "Mark paid" (amount editable sheet); auto-record via BillsSync.

### 9. Tax filing pack (`src/app/tax-pack.tsx`) with Share of the CSV; link from Tax tab.

### 10. Verify: full suite, tsc, browser walkthrough, README update, fresh review, fix Important findings.
