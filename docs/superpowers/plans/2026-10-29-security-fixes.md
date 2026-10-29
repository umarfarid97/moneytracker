# Eight security fixes implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Implement the eight approved security invariants and regression coverage.
**Architecture:** Preserve Expo mobile/web and encrypted D1/R2 sync. Centralize receipt validation and persistent privacy state; serialize account operations with a SQLite-backed Durable Object and restart-safe recovery.
**Tech Stack:** Expo 58, React Native, TypeScript, Jest, Vitest, Cloudflare Workers/D1/R2/Durable Objects.
**Spec:** `docs/superpowers/specs/2026-10-29-security-fixes-design.md` (approved by user in chat).

## Global Constraints

- No production deployment, live migrations, real-user data or encryption-key changes.
- Canonical receipt keys; 10 MiB statement input, 32 MiB total decoded PDF streams, at most 10,000 objects and finite aggregate parsing budget.
- Preserve existing five-attempt PIN/OTP policy and 150 MiB receipt quota.
- Read matching Expo 58/current Cloudflare docs before API changes; keep generated native folders untouched.
- Tests first; use dummy data and local services. Record unavailable platform validation honestly.

## Review Focus

- Existing valid receipt names and native historical URIs: Task 1 compatibility tests.
- Tiny compressed PDF with large expansion and malformed/non-finite object headers: Task 2 bounded tests.
- Concurrent PIN submissions, corruption and failed persistent writes: Task 3 failure-path tests.
- Shortcuts/biometric completion after privacy lifecycle changes and queued reminder replacement: Tasks 4–5 transition tests.
- OTP replacement and coordinator crash between R2 and D1/deletion: Tasks 6–8 deterministic failure/restart tests.

## Task 1: Receipt input and opening policy

Files: `src/receiptKind.ts` or focused `src/receiptReference.ts`, `src/receipts*`, `src/sync/receiptFiles*`, `src/sync/snapshot.ts`, `src/sync/backup.ts`; existing receipt/snapshot tests.
Interfaces: pure `isReceiptReference(value: unknown): value is string`; native adapter resolves only contained native paths; web resolves validated keys through its own blob map. Imports and opening both enforce the policy.
- [x] Add tests for executable/absolute/encoded traversal references, valid stored receipts and rejected restore having no writes; run focused Jest tests and observe failure.
- [x] Implement policy and wire import/sync/read/open paths; update obsolete unsafe absolute-URI expectation.
- [x] Run focused tests, then app suite; commit task with evidence in ledger.

## Task 2: Bounded statement/PDF parsing

Files: `src/domain/pdfText.ts`, `src/statementFile*`, parser/statement tests.
Interfaces: preserve `extractPdfLines(bytes: Uint8Array): string[]`; oversized/malformed work fails safely through the existing import error path.
- [x] Add bounded count/offset/decompression/input-size regressions plus a legitimate object-stream fixture; observe failures without running an unguarded infinite fixture.
- [x] Enforce named input/decoded/object/work budgets and validated header-pair counts; implement bounded decompression.
- [x] Run parser/import tests and app suite; commit evidence.

## Task 3: Persistent PIN attempts

Files: `src/security/appLock.ts`, `lockStorage*`, security screen/lock screen and mocks/tests.
Interfaces: storage adapters expose load/save throttle state; `verifyPin` remains async; successful already-enabled biometrics can repair persisted throttle, failed writes remain locked.
- [x] Add reload/concurrent/wrong PIN/corrupt storage/failed persistence/biometric recovery tests; observe failures.
- [x] Serialize verification and persist attempts/deadline; wire safe failure and recovery messaging.
- [x] Run security tests and app suite; commit evidence.

## Task 4: Lock-aware native presentation

Files: `AppLockGate.tsx`, `ReceiptPreview.tsx`, receipt-owning hooks/screens and `QuickAddSync.tsx`; lock/shortcut tests.
Interfaces: lock privacy state controls receipt visibility and deferred shortcut consumption; existing lock timeout retained.
- [x] Add cold-start shortcut/preview background/late biometric transition tests; observe failures.
- [x] Gate and clear native presentation, close router modals on initial lock, defer shortcuts until unlock, reject stale biometric completions.
- [x] Run lock/shortcut tests and app suite; record required Android/iOS manual checks; commit.

## Task 5: Refresh notification privacy

Files: `RemindersSync.tsx`, `notifications.ts`, lock enable integration and notification tests.
Interfaces: existing `scheduleReminders` observes current privacy, serializes replacements and reports privacy failure to caller/UI.
- [x] Test lock enable after scheduling, overlapping old/new replacements and cancellation failure; observe failures.
- [x] Subscribe to lock state; rebuild pending notifications, handle delivered notifications separately and surface failure.
- [x] Run notification/privacy tests and app suite; commit.

## Task 6: Atomic OTP admission/consumption

Files: `cloud-worker/src/index.ts`, backend worker tests/fixtures, migration only if code-generation identity needs it.
Interfaces: unchanged public auth endpoints; one atomic admission consumes one of five slots; conditional success consumption binds exact current code generation.
- [x] Add deterministic parallel guesses, duplicate success and code replacement tests; observe failures.
- [x] Implement guarded D1 admission/consume; preserve IP/email limits and generic responses.
- [x] Run backend suite/typecheck; commit.

## Task 7: Coordinated receipt mutations and recovery

Files: coordinator module, worker route integration, Wrangler binding/migration, backend local-runtime test configuration and tests.
Interfaces: one coordinator per token-derived account ID; all account routes are forwarded through coordinator; reauthorization happens inside ordering boundary. Durable journal reconciles R2/D1 before new mutations.
- [x] Add near-cap concurrency/replacement and interrupted-upload recovery tests using local Cloudflare runtime; observe failures.
- [x] Implement explicitly ordered operations and durable journal with temporary R2 objects/compensation as needed, retain quotas and response shapes.
- [x] Run backend tests/typecheck and runtime integration tests; document binding rollout; commit.

## Task 8: Resumable account deletion and final verification

Files: coordinator lifecycle/alarm handling, delete route, backend tests, `docs/security-fixes.md`.
Interfaces: persistent deletion fence blocks queued/future writes; deletion only returns success once cleanup completes; retry alarm resumes failed cleanup.
- [x] Add upload/delete ordering, restart/cleanup failure, legacy migration, key/snapshot/device mutation and fresh account-ID tests; observe failures.
- [x] Implement idempotent deletion journal/fence and alarm retry; document safe rollout/rollback and all eight audit mappings.
- [x] Run complete app/backend tests, lint/typecheck, web export/smoke where supported; obtain fresh whole-branch review and resolve important findings with regressions.
- [x] Commit final changes; deliver branch and exact validation/platform gaps without production deployment.
