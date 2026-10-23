# Duit: a Malaysian money and budget tracker

A phone app (Android and iOS, built once with React Native and Expo) for people in Malaysia. All data stays
on the phone in a local database. There is no account and no server.

## What it does

- **Home:** what you have spent today, what is left for today, and one tile per budget category showing the
  amount left and a status (on track, tight, over budget).
- **Spending:** add, edit and delete spending in two taps from any tab, browse by month and day, attach a receipt photo.
- **Budget:** a monthly limit per category, with "copy last month".
- **Bills (commitments):** recurring bills, loans and subscriptions with due dates and a reminder at 09:00 the day before.
- **Tax reliefs:** the LHDN individual reliefs for the year of assessment with limits, running totals and receipts.
- **Tax calculator:** salary, freelance and business income, reliefs, rebates, zakat and tax already paid.
- **Loan calculator:** from your take-home pay and your tracked commitments, whether a home, car or personal loan
  suits you and the range you could borrow.

Everything on the calculator screens is an **estimate** for planning, not tax or lending advice.

## Run it

```bash
npm install
npx expo start          # then press a (Android), i (iOS simulator, macOS only) or scan the QR code
```

- Reminders need a development build, not Expo Go (Android removed notification support from Expo Go).
  Build one with `npx expo run:android` / `npx expo run:ios`, or with EAS (`npx eas-cli build --profile development`).
- `npx expo start --web` opens a browser preview. It stores data in the browser (via sql.js) and is meant for
  looking at screens, not for real use.

## Check it

```bash
npm test                # unit and screen tests (Jest)
npx tsc --noEmit        # type check
npx expo-doctor         # project health
```

## How it is built

```
src/app/            screens (Expo Router): src/app/(tabs) are the five tabs
src/domain/         pure logic with no React or database: money, dates, budget, commitments, loan, tax, reliefs
src/data/tax/       tax rates and reliefs per year of assessment (ya2025.ts) with their LHDN source
src/db/             SQLite schema (migrations.ts), repositories, adapters (expo-sqlite on phones, sql.js on web/tests)
src/hooks/          one in-memory store loaded from the database; writes update the screen first and roll back on failure
src/ui/             design system: theme tokens (light and dark), Tile, Button, Sheet, ...
src/i18n/en.ts      every user-facing string (add Bahasa Malaysia here later)
```

Rules the code keeps:

- Money is whole **sen** (RM x 100), never a decimal number. Format with `formatRM`, parse typed text with `parseRM`.
- Dates are `YYYY-MM-DD` text in Kuala Lumpur time.
- Database changes are new entries at the end of `MIGRATIONS` in `src/db/migrations.ts`. Never edit an entry that has shipped.

## Update the tax figures each year

Tax rates and relief limits are data, not code. When LHDN publishes a new year of assessment:

1. Open the two LHDN pages named at the top of `src/data/tax/ya2025.ts` (tax rates and tax reliefs).
2. Copy `ya2025.ts` to `ya20XX.ts` and change the numbers, the `ya`, the `fetchedOn` date and, if the pages moved, the URLs.
   Relief limits that apply together (a shared cap) use `group` and `groupLimit`; per-child reliefs use `perItem`.
3. Register the new file in `src/data/tax/index.ts` (the newest year is used automatically).
4. Add the same checks `__tests__/domain/tax.test.ts` makes for the new brackets (edges and rebate) and run `npm test`.

## Known limits

- Reminders are scheduled for each bill's next due date and refreshed every time the app opens. If the app is not
  opened for a month, the reminder chain pauses until it is.
- The tax calculator is for resident individuals. It does not model non-residents, capital gains, foreign income
  or other special cases.
- The loan calculator's 65% debt-service limit and default rates are reasonable planning assumptions, not any
  bank's actual rules. They can be edited on screen.
- Phone-only behaviour (camera and gallery access, notifications delivery, native animation smoothness) was
  not run on a physical device or emulator while building; see the notes in the build history.
