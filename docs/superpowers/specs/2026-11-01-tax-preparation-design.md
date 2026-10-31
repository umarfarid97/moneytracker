# Malaysian tax preparation

User authorised all seven proposed features and merge/push. Extend existing resident-individual tax screens, calculator and relief pack; keep existing transactions unchanged.

## Approach
Use one preparation screen backed by pure domain functions, rather than seven disconnected tools or an external AI service. Reuse the existing calculator, local receipts and tax-year data. No Cloudflare changes. Personal answers and review confirmations are session-only and explicitly labelled; existing financial records continue to sync normally. Confirmation keys include year, rule version and all claim details so edits invalidate reviews.

## Deliverables
1. Readiness counts and actionable missing evidence, incomplete notes, unknown categories, invalid dates/amounts, potential duplicate receipts/entries, capped/shared-limit and eligibility review warnings.
2. Personal guide using selected circumstances (children, parents, education, insurance, disability, home), with conditions, source and assessment year. Suggestions never create claims automatically.
3. Extend existing refund/balance estimate with PCB from profile as a clearly labelled annual projection, invalid-input feedback and year provenance.
4. Confirmed-only filing reference with grouped relief amounts, copy buttons and downloadable text/CSV. It is a reference to compare with MyTax, not an official return or automatic submission. Earlier-year fallback must never be presented as confirmed current-year filing figures.
5. ZIP evidence pack with per-year/category receipt copies, CSV ledger, confirmed filing summary, source/readiness information and manifest listing unavailable receipts. Validate every receipt reference, deduplicate bytes, bound total input to 25 MiB and refuse an oversized archive.
6. Duplicate and eligibility warnings. Existing caps remain authoritative; potential duplicates require correction or explicit acknowledgement. No automatic deletion or modification.
7. What-if eligible spending preview: apply existing individual/shared limits before computing before/after annual tax, including rebates; zero remaining room or tax means zero saving. No claim is added.

## Rules and limits
Keep existing YA2025 data; do not invent YA2026 rules. Display actual rule year and source/check date. Sources: LHDN resident relief page https://www.hasil.gov.my/en/individu/pelepasan-cukai/ and YA2025 flyer https://www.hasil.gov.my/media/levea53b/flyers-pelepasan-cukai-2025_bi_mfa2312.pdf . Guidance is a shortlist, not a complete eligibility decision. Keep existing shared caps. Record retention guidance refers to seven years after the end of the year the return is furnished, not the spending date.

## Platforms and verification
Shared Expo UI for web/Android/iOS, responsive wrapping actions, English/Malay strings, existing motion and privacy boundaries. Domain and screen tests, archive roundtrip/failure tests, full app suite, typecheck, lint, web export and browser smoke. Native share/clipboard require a new binary and physical-device verification.
