# Duit: a Malaysian money and budget tracker

A phone app (Android and iOS, built once with React Native and Expo) for people in Malaysia. All data stays
on the phone in a local database. There is no account and no server.

## What it does

- **Home:** what you have spent today, what is left for today, and one tile per budget category showing the
  amount left and a status (on track, tight, over budget).
- **Spending:** add, edit and delete spending from any tab. Each entry has a category, a payment method (Cash, debit or credit card, e-wallet, online transfer, or your own such as "Maybank Visa"), an optional tax relief tag, a note and a receipt photo. Recent entries re-add in one tap. The list has search, filters (category, method, tax relief, missing receipt) and per-method totals for the month, so you can see what is on the credit card.
- **Budget:** a monthly limit per category, with "copy last month". You get a notification when a category reaches 80% of its limit or goes over.
- **Bills (commitments):** recurring bills, loans and subscriptions with a reminder at 09:00 the day before. Each bill knows its category, payment method and tax relief. When it is due or overdue, tap **Mark paid** and the spending is recorded for you (amount editable); or switch on "record automatically" and it is added on the due date. A due date can only be recorded once.
- **Tax reliefs:** the LHDN individual reliefs for the year of assessment with limits and running totals. Spending tagged to a relief counts automatically (all of it, or just the part you say qualifies); claims can still be typed in for things not recorded as spending. A **tax filing pack** lists every relief with its items and receipt status and shares them as CSV.
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

- Bills are recorded automatically only when the app is opened (it catches up on every missed due date, up to a year). Deleting an auto-recorded spending does not bring it back.
- Old spending from before payment methods existed shows "No method" until you edit it.
- Receipts are exported as a list of file names, not the photos themselves.
- Two sheets open on top of each other (adding a bill, then choosing its tax relief) were checked in tests and the browser preview only, not on a phone.
- Reminders are scheduled for each bill's next due date and refreshed every time the app opens. If the app is not
  opened for a month, the reminder chain pauses until it is.
- The tax calculator is for resident individuals. It does not model non-residents, capital gains, foreign income
  or other special cases.
- The loan calculator's 65% debt-service limit and default rates are reasonable planning assumptions, not any
  bank's actual rules. They can be edited on screen.
- Phone-only behaviour (camera and gallery access, notifications delivery, native animation smoothness) was
  not run on a physical device or emulator while building; see the notes in the build history.
