# Spending depth: relief tagging, payment methods, bills that record themselves

Date: 2026-10-24. Status: approved in chat ("proceed") after the feature list was shown. Builds on
`2026-10-24-malaysia-finance-app-design.md`.

## Intent

Recording spending was "enter and save". The user wants spending to be the one place things are recorded, so tax reliefs
and bills draw on it and nothing is typed twice, and wants the screens to be complete enough to use every day.

## Goals

1. **Tag spending to a tax relief.** Optional relief field on a spending entry. A tagged entry counts toward that relief
   automatically (no separate claim). Year of assessment = year of the spending date. An optional "claimable amount"
   covers receipts where only part qualifies. Relief pages list the linked spending with its receipt status. Picking a
   category suggests a matching relief (Kesihatan -> medical, Pendidikan -> education), never forced.
2. **Payment method.** Cash, Debit card, Credit card, E-wallet, Online transfer by default; the user can add, rename and
   delete their own (e.g. "Maybank Visa"). Spending can be filtered by method and the month shows totals per method
   (so the credit-card total is visible).
3. **Bills feed spending.** A bill carries category, payment method, optional relief tag and an "record automatically"
   switch (off by default). A bill that is due or overdue shows "Mark paid": one tap records the spending (amount
   editable), copying category, method and relief. Paid state is per due date.
4. **Everyday completeness.** Search and filters on the spending list (category, method, relief-tagged, missing receipt);
   one-tap re-add of recent spending; a notification when a category reaches 80% or goes over its budget; a tax filing
   pack screen listing every relief with its linked items and receipts, exportable as CSV through the share sheet.

## Non-goals

Income tracking, splitting one receipt across categories, bank import, and sending receipt photos in the export.

## Anti-goals

- A bill or spending entry recorded twice (the same due date must never produce two spending rows).
- Relief totals that differ between screens, or tagged spending that is also counted as a manual claim.
- Data loss when upgrading from the first version (existing expenses, claims and bills must survive migration 2).
- Auto-recording a bill the user never agreed to, or re-recording one the user deleted.

## Decisions (from the conversation)

All four feature groups above, including the everyday items; the leave-outs above.

## Builder's calls (mine, not agreed)

- Payment methods are a table the user can edit; "Cash" is the protected fallback (cannot be deleted or renamed);
  deleting another method moves its spending to Cash. Existing expenses keep no method (shown as "No method")
  until edited. New spending defaults to Cash.
- Relief-tagged spending is stored on the expense (`relief_id`, optional `relief_amount`); relief totals combine manual
  claims and tagged spending in one place. Manual claims stay for things not recorded as spending.
- Bills: `start_date` (when the bill was created) stops old months showing as overdue. A bill's current occurrence is the
  most recent due date up to today if unpaid and not before `start_date`; otherwise the next one. Paid state is a spending
  row with `commitment_id` + `due_date` (unique together), so it cannot be recorded twice. Auto-record remembers the last
  due date it handled (`last_auto_due`), so deleting its spending does not bring it back.
- Mark paid dates the spending today; auto-record dates it on the due date.
- Budget warning is a local notification fired when saving spending moves a category from on-track to tight or from
  tight/on-track to over (not on every save).
- CSV cells that start with `=`, `+`, `-` or `@` are prefixed with `'` so spreadsheets do not run them.
- Recent re-add shows the latest six distinct entries that have a note.

## Left to the builder

Layout of the new fields, picker design, file layout, test structure.
