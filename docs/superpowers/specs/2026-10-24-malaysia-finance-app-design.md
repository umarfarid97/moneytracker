# Malaysia Finance & Budget Tracker: Design

Date: 2026-10-24. Status: draft for approval.

## Intent and why

The user wants one phone app for Malaysians to answer, quickly and correctly:
"How much have I spent today, and which budget categories still have room?"
Around that sit the money jobs that are painful in Malaysia: knowing which
LHDN tax reliefs can be claimed (and keeping the receipts), working out tax
owed, tracking monthly commitments, and checking whether a loan suits a
given salary. The user's pain with tax is both halves: knowing what to claim,
and calculating what is owed. The user stressed correctness ("no mistakes"),
smoothness ("super smooth") and a polished look.

## Goals

1. Runs on Android and iOS from one React codebase (React Native + Expo, TypeScript).
2. All data local on the device (SQLite) for now. No account, no server.
3. Features, all required:
   - Spending tracker (add, edit, delete, categorise, receipt photo optional)
   - Budget planning (monthly budget per category)
   - Commitment tracking (recurring bills, loans, subscriptions, due dates, reminders)
   - Tax relief tracker (checklist, running total vs each limit, receipt storage)
   - Tax calculator (several income kinds, see below)
   - Loan calculator driven by salary and tracked commitments
4. Home screen: today's total spent, then one tile per budget category showing
   amount left and a status word ("on track", "tight", "over budget").
   The user chose this tiles layout from three options.
5. Money is RM. English UI first.
6. Interaction feels instant: 60 fps animations, optimistic writes, no spinners
   for local data.

## Non-goals

- No cloud sync, login, bank linking or automatic bank import (later).
- No e-Filing submission to LHDN. The app estimates and organises only.
- No investment advice.
- Bahasa Malaysia translation is deferred, but strings must live in one place
  so it can be added without touching screens.
- Multi-currency is out of scope.

## Anti-goals (a failure even if it technically works)

- Wrong tax or relief figures presented as fact.
- Janky scrolling or delayed taps.
- A generic, template-looking UI.
- Losing user data on app update.

## Constraints

- React (React Native) for iOS and Android compatibility; user's requirement.
- Local database only. Choose expo-sqlite. Money stored as integer sen, never floats.
- Schema changes go through numbered migrations from day one.
- Tax and relief figures live in editable data files by assessment year (YA),
  not hard-coded in logic, so yearly updates need no logic changes.
- UI follows the design-taste-frontend skill (art direction, no-slop rules,
  look-and-fix loop on screenshots).

## Decisions made with the user

- Home layout: category tiles (option C).
- Tax calculator covers salary, freelance/side income and business income.
- Loan calculator gives a verdict and a borrowable range.
- Local DB for now.

## Builder's calls (mine, not agreed by the user: shown so they can be changed)

- Stack: Expo (managed), Expo Router, TypeScript, expo-sqlite,
  react-native-reanimated + gesture-handler, expo-notifications (local),
  expo-image-picker/file-system for receipts, Jest for logic tests.
- Net salary estimate: gross minus EPF employee share (default 11%), SOCSO and
  EIS (default rates, user-editable), with the option to type net pay directly.
- Loan calculator defaults (all editable):
  - Debt service ratio limit 65% of net income (typical bank range is about
    60-70%; lower for low incomes). Commitments = tracked monthly commitments.
  - Verdict: comfortable under 50% after the new loan, tight 50-65%, not suitable above.
  - Home loan: reducing balance, 4.5% p.a., up to 35 years.
  - Car loan: flat rate, 3.0% p.a., up to 9 years (Malaysian car loans are flat rate).
  - Personal loan: reducing balance, 8% p.a., up to 10 years.
  - Output: maximum affordable instalment, maximum principal, and a low-high range
    (comfortable level to maximum level).
- Tax calculator: resident individual progressive rates for the chosen YA,
  tax rebates (RM400 when chargeable income is RM35,000 or below, and spouse
  rebate rule), minus reliefs claimed, with a breakdown screen showing every
  bracket. Freelance/business income: gross income minus allowable expenses
  entered by the user. Salary: gross minus nothing special, with PCB (monthly
  tax deducted) entered to show balance payable or refund.
- Relief tracker covers the standard individual reliefs (self, spouse, children,
  parents' medical, lifestyle, education, medical, insurance, EPF, PRS, SSPN,
  SOCSO/EIS, child care, EV charging, and similar). It caps each claim at its
  limit and warns when receipts are missing.
- Categories ship with Malaysian defaults (Makan, Transport, Bil, Rumah,
  Hiburan, Kesihatan, Pendidikan, Lain-lain) and are editable.
- Reminders use local notifications only.
- Design system choices: left to the design-taste-frontend run, constrained by
  the tiles home screen and a calm, readable money-app feel.

## Correctness plan (because "no mistakes")

- Before writing tax data, the builder fetches the current figures from LHDN
  (hasil.gov.my) for the target YA and cites the source and date in the data file.
  Figures in this document are intentionally not listed, to avoid stale copies.
- Tax, loan and budget logic are pure functions with unit tests, including
  boundary cases (bracket edges, RM35,000 rebate edge, relief caps, zero income).
- Every calculator screen states that it is an estimate, not official advice.
- Data migrations are tested from an empty database and from a seeded older version.
- The app is run on at least a web/Android preview and checked for crashes and
  slow frames before it is called done.

## Left to the builder

Exact visual style, navigation structure, component library, animation details,
file layout, and test tooling, within the constraints above.

## Open items

- Which assessment year to target (default: the latest year LHDN has published).
- Whether the user wants a Bahasa Malaysia toggle sooner than "later".
