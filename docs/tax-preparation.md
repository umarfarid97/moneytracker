# Tax preparation

Open **Tax reliefs → Tax preparation**. The dashboard shows claim and missing-receipt counts. The new screen combines the readiness checklist, circumstance-based guide, reviewed MyTax reference and evidence export. **Tax calculator** contains the refund/balance estimate and additional-expense savings preview.

## Review and filing
Choose the assessment year. All screens show the actual rules year and the date those figures were checked. This build includes YA2025; other years use those figures for planning and cannot produce confirmed filing figures. A missing year in the app does not mean LHDN has not published it.

Review each category's claims and eligibility conditions. Fill missing descriptions and receipts in its detail screen. Check possible duplicates before acknowledging them; the app never removes them automatically. Caps include shared group limits. Confirming a category means you reviewed the eligibility of its claims, not that LHDN approved them. Changes to any claim invalidate the confirmations because shared limits and duplicates can span categories.

Guide answers, confirmations, duplicate acknowledgements and calculator inputs are **session-only**. They are not saved or synced. Saved claims and receipts continue using the existing encrypted sync. Navigation can retain the mounted screen's temporary state; remounting or restarting clears it, and changing claims invalidates reviews. Normal transaction data is untouched.

Copy figures or export text/CSV from the reviewed reference. Match category names and any shared sublimits to the current MyTax form. The reference covers reliefs tracked by Duit, not every income source, rebate or field in a complete return. Automatic self-relief is shown separately. Unsupported years are explicitly provisional and omit confirmed figures.

## Calculator
Annual salary and PCB initially project the monthly profile amounts ×12. Replace them with actual totals across all employers, bonuses and payments. Recorded zakat/approved donations initialise the existing fields. Inputs remain estimates for resident individuals and do not replace a complete tax return.

The savings preview adds a hypothetical eligible expense to the selected category, applies its individual/shared caps, then compares full tax before and after, including rebate thresholds and zakat. Per-child allowances are excluded: spending does not imply an additional eligible child. It never adds a transaction. PCB changes the balance/refund but not the tax saving. A relief amount is not a refund amount.

## Evidence ZIP
Contains `YA<year>/claims.csv` (all provisional recorded claims), `filing-summary.txt` (reviewed subset and provenance), copies of the saved receipts under category folders, `manifest.json` and `README.txt`. The manifest links each claim to its receipt and explicitly identifies missing, invalid and unavailable files. Files not downloaded to this device may be unavailable; sync first and export again. Receipt references are validated before reading, and arbitrary URLs are never fetched. Total input is bounded to 25 MiB; an oversized export fails instead of silently dropping files.

Exports are unencrypted files, intended for user-controlled storage. Keep supporting records for seven years after the end of the year the return is furnished. The ZIP is a working evidence pack, not an official return or a guarantee of eligibility.

## Sources
- [LHDN resident individual reliefs](https://www.hasil.gov.my/en/individu/pelepasan-cukai/)
- [LHDN YA2025 relief flyer](https://www.hasil.gov.my/media/levea53b/flyers-pelepasan-cukai-2025_bi_mfa2312.pdf)
- [LHDN Form BE explanatory notes, record retention](https://www.hasil.gov.my/media/jici2heu/explanatorynotes_be2022_2.pdf) (retention wording; not a source for YA2025 limits)

## Release
No Worker/D1/Cloudflare changes. Web builds through the existing Pages workflow after main is pushed. Android and iOS require new binaries; Expo Clipboard is a new SDK-compatible dependency. Native clipboard, share-sheet handoff and ZIP opening need physical-device acceptance checks.
