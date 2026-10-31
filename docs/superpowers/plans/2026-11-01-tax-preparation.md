# Tax Preparation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** Deliver all seven tax preparation improvements and merge/push.
**Architecture:** Pure preparation/guide/savings logic; shared preparation screen; bounded receipt ZIP export using existing storage adapters; extend calculator and pack.
**Tech Stack:** Expo 58, TypeScript, React Native, SQLite, fflate, Jest.
**Spec:** docs/superpowers/specs/2026-11-01-tax-preparation-design.md

## Global Constraints
- No backend changes or invented assessment-year rules.
- Validate receipt references; 25 MiB maximum archive input; no silent receipt omissions.
- Session-only guide/review state explicitly labelled; changes invalidate confirmation.
- English/Malay, shared cross-platform UI, no automatic filing or claim mutation.

## Review Focus
- Fallback rules cannot produce confirmed current-year filing figures.
- Claim edits and year changes invalidate old confirmations.
- Shared caps and rebate thresholds affect savings correctly.
- Unavailable/unsafe receipt references never become network requests or silent success.
- Duplicate acknowledgement is scoped to unchanged records; empty data is not labelled filing-ready.

### Task 1: Preparation domain
Files: src/domain/taxPreparation.ts, src/domain/taxGuide.ts; tests under __tests__/domain/taxPreparation.test.ts.
- [x] Write and run failing tests for readiness, review fingerprints, duplicates, invalid records, guide selections and shared-cap/rebate savings.
- [x] Implement `reviewTaxPack(pack, data)`, `reviewKey(pack, section)`, `confirmedTaxPack(pack, data, confirmations, acknowledged)`, `suggestReliefs(answers, data)`, `previewTaxSaving(input, claims, reliefId, amount, data)`.
- [x] Verify targeted tests and commit.

### Task 2: Evidence and filing export
Files: src/taxEvidence.ts, src/exportFile.ts, src/exportFile.web.ts; tests __tests__/domain/taxEvidence.test.ts.
- [x] Write and run failing tests for ZIP roundtrip, unavailable files, duplicate bytes, unsafe refs and size limit.
- [x] Implement bounded `buildTaxEvidence(pack, filingText, readReceipt)` and binary sharing adapters, copy helper using Expo Clipboard.
- [x] Verify tests and commit.

### Task 3: User flows
Files: src/app/tax-preparation.tsx, src/features/tax/*, src/app/tax.tsx, src/app/tax-calculator.tsx, src/app/tax-pack.tsx, src/i18n/taxPreparation.ts and language tables.
- [x] Write and run failing screen tests for guide, confirm/copy, changed records, year fallback and savings/refund inputs.
- [x] Build preparation screen, dashboard entry and pack links, calculator projection/validation, translated copy and exports.
- [x] Verify screen tests, full suite, typecheck, lint and web export/smoke.
- [x] Fresh whole-branch review, fix important findings with reproducing tests, commit, merge main and push; verify remote SHA.
