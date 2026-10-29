# Duit security fixes design

Status: proposed implementation design, awaiting review. Date: 29 October 2026.

## Intent and agreed scope

Implement the eight fixes discussed after the source audit, preserving the mobile/web finance workflows and encrypted cloud sync. The user authorized proceeding with all eight. The audit established source-grounded leads, not runtime-confirmed exploits; regression tests must demonstrate each defective invariant before changing production code.

Do not deploy, run production migrations, modify live accounts, read production finance data, or replace encryption keys as part of implementation. Prepare source, tests, configuration and rollout instructions for review. Do not claim native UI or provider behavior was verified by mocked tests.

## Approaches

The conversation selected incremental fixes in three batches: input safety, device privacy, backend consistency. Retain Expo 58, React Native, existing storage adapters, D1/R2 and encryption.

For backend consistency, the builder proposes a per-account Cloudflare Durable Object coordinator for account data operations. It provides a single enforced ordering point across awaited R2/D1 operations. Atomic OTP accounting remains in D1, keyed by email/code identity. This is an implementation choice proposed here, not a previously approved infrastructure change.

Alternative: implement storage reservations, deletion fencing, recovery leases and reconciliation solely in D1/R2. That avoids a new binding but introduces more distributed failure states. An in-memory Worker mutex is rejected because it cannot coordinate multiple Worker instances. Prefer the coordinator, with restart-safe state and tests; a single-threaded object alone is insufficient because requests can interleave across awaits.

## Batch 1: receipt and document input safety

### 1. Receipt references

Introduce one pure receipt-key policy shared by import, sync and presentation. New references must be canonical `receipts/<filename>` keys: a single filename, approved extension, bounded length and no separators, encoded separators, dot segments, control characters or URI schemes. Browser receipt opening resolves only validated keys to blobs produced by the app's receipt store; never pass imported strings directly to navigation or trust an imported `blob:` URI.

Inspect historical receipt names and backup fixtures before fixing exact length/filename compatibility. Legitimate app-generated names must continue to work. Reject invalid references before restoring any file/database state; also reject at read/open boundaries in case older stored data is unsafe. Invalid sync content must fail safely without silently rewriting the cloud snapshot.

Native validation is separate: construct files under the designated documents/receipts directory and check normalized containment. Historical absolute file URIs may be migrated only if they resolve inside that app directory, using documented Expo 58 APIs. Reject arbitrary absolute paths and network/executable schemes. Do not delete existing files when a reference is rejected. Keep the normal picker and receipt-opening flow free of manual approval steps.

Relevant files: `src/receiptKind.ts`, `src/receipts.ts`, `src/receipts.web.ts`, `src/sync/receiptFiles*`, `src/sync/snapshot.ts`, `src/sync/backup.ts`, `src/sync/cloudSync.ts`, `src/sync/driveSync.ts` and receipt tests.

### 2. PDF parser work limits

Enforce a 10 MiB statement-file limit before reading on both platforms, then defend again at parser entry. Bound total decoded stream output to 32 MiB, object count to 10,000, object-stream `/N` to actual validated header pairs, and aggregate parsing work to a named finite budget. Reject non-finite/unsafe counts, offsets outside stream bounds and invalid ranges. Check decompression output before unbounded allocation using supported fflate interfaces; a check only after unrestricted decompression is insufficient.

Apply shared limits to CSV statement selection where appropriate without changing valid transaction parsing. Preserve a clear import failure message. This patch guarantees bounded parser work, not preemptive cancellation of synchronous JavaScript; background parsing is deferred unless the existing runtime offers a tested cross-platform mechanism without new native modules.

Relevant files: `src/domain/pdfText.ts`, `src/statementFile.ts`, `src/statementFile.web.ts`, `src/app/import-statement.tsx` and parser/import tests.

## Batch 2: device privacy

### 3. Persistent PIN throttling

Store failure count and cooldown deadline in SecureStore on native and the existing browser lock adapter on web, separate from financial backups/sync. Load before admitting verification, serialize concurrent verification calls, and persist a failed-attempt update before another attempt is accepted. Preserve the existing five-attempt/exponential-delay policy. Reset after successful authentication or an authenticated PIN change. Storage corruption/failure must not grant a fresh unlimited attempt budget; surface a locked error with a storage retry.

Recovery policy (builder proposal): a successful biometric check may repair/reset the throttle only if biometrics were already enabled before the failure. Do not permit biometric enrollment from the locked screen. Without configured biometrics or working storage, keep financial data locked; never silently clear lock state or erase data. Explain that a deliberate OS-level app reset/reinstallation followed by restoration of an existing backup/cloud copy is the last resort and may lose unsynced local data. Do not add a destructive in-app reset flow in this patch. Distinguish first-time initialization from a corrupt record, and test failed repair writes. Device clock tampering/rooted devices remain outside the app-PIN guarantee, and web profile access remains outside its casual-visitor model.

Relevant files: `src/security/appLock.ts`, `src/security/lockStorage.ts`, `src/security/lockStorage.web.ts`, `src/features/security/LockScreen.tsx`, security settings and tests.

### 4. Lock-aware native presentation

Gate receipt preview visibility on privacy-cover state and clear preview state when locking or leaving the foreground. Defer quick-add shortcut navigation while locked and consume the pending action only after successful unlock. Dismiss router modals on cold-start locked state as well as foreground lock transitions. Ensure late biometric completion cannot incorrectly unlock a different lock lifecycle. Preserve configured lock timeout and normal unlocked navigation.

Relevant files: `src/features/security/AppLockGate.tsx`, `src/ui/ReceiptPreview.tsx`, `src/ui/useReceipt.tsx`, receipt-owning screens, `src/quickAdd/QuickAddSync.tsx` and lock tests. Real Android/iOS modal ordering and app-switcher screenshots require explicit manual validation.

### 5. Notification privacy updates

Subscribe reminder synchronization to lock-enabled/privacy changes. Cancel and rebuild pending reminders when the lock is enabled; serialize replacements so an older amount-bearing schedule cannot win after the privacy change. Keep names/dates and existing reminder behavior otherwise. Failures must be visible/retryable, not silently reported as privacy-safe. Already delivered notifications are subject to OS dismissal capabilities and must be accounted for separately from pending reminders.

Relevant files: `src/features/commitments/RemindersSync.tsx`, `src/notifications.ts`, lock enable integration and notification tests.

## Batch 3: backend consistency

### 6. Atomic OTP attempts and consumption

Atomically reserve an attempt for the current unexpired code with a guarded D1 update that returns the code identity/hash only if a slot remains. Count successful and unsuccessful comparisons within the five admitted attempts. Bind updates/consumption to that code generation so a replaced code cannot be consumed by an old request. Mint a device token only after successful conditional one-time consumption. Preserve cryptographic code generation, expiry, generic error responses and IP/email limits; do not log codes or email addresses.

### 7. Ordered receipt quota enforcement

Route receipt writes, replacements, deletes and legacy migrations through the same per-account coordinator as deletion. Recheck token/account authorization inside the coordinated operation. Explicitly serialize operations across storage awaits, with bounded request bodies/time and restart-safe recovery; do not rely on an ordinary in-memory promise chain for crash recovery.

Keep D1/R2 as data stores and the existing 150 MiB account and per-receipt limits. Include replacement size correctly. Persist an operation journal before external writes and reconcile interrupted operations before admitting new writes, so metadata failure cannot leave uncounted capacity or silently discard the existing receipt. No small-object/count-limit change is implied by this patch.

### 8. Coordinated, resumable deletion

Persist a deletion marker before cleanup and prevent all subsequent account mutations, including queued requests and migration writes. Drain previously ordered writes, remove account-prefixed R2 data, then remove D1 data and credentials. Keep deletion progress in durable coordination storage across restarts and retry cleanup with an alarm; make cleanup idempotent. Retain the deletion fence after completion. Never return successful completion while cleanup is unfinished. If an operation fails, the client may see a retryable error while cleanup continues; do not claim success or resurrect account data.

Coordinate snapshots, key updates and device mutations with deletion as well as receipt routes, so a weaker parallel path cannot recreate deleted data. New sign-in after a fully deleted account creates a different account ID and must not inherit the old fence or data.

Relevant files: `cloud-worker/src/index.ts`, a focused coordinator module, `cloud-worker/wrangler.toml`, backend test fixtures/runtime tests, and deployment documentation. Add a SQLite-backed Durable Object binding/migration; retain existing D1/R2 bindings and public API shapes where possible. Production deployment requires separate review of the new binding, compatibility, rollout and rollback.

## Verification and delivery

Create an isolated implementation branch/worktree. Use existing dependency lockfiles; install test dependencies only after design approval. Read matching Expo 58 and current Cloudflare documentation before touching those APIs. Use TDD for each fix: reproduce with a bounded dummy fixture, observe failure, implement, then run the focused tests.

Add browser coverage for malicious imported schemes and ordinary stored receipts. Add bounded PDF tests that cannot hang the test runner. Add storage reload/concurrent PIN tests, lock/shortcut/modal state tests, notification privacy transition tests, and deterministic backend race/failure/restart tests. Use the Cloudflare local runtime for coordinator semantics rather than assuming a fake object proves platform ordering.

Run app/backend test suites, lint and typecheck; run the web smoke build when local tooling supports it. Report every failure or unavailable check, including Android/iOS manual validation and any provider-specific staging check. No production audit traffic or deployment is part of local tests.

Deliver the changes and a short mapping from each audit fingerprint to its fix, regression evidence and remaining platform validation. Keep the source audit report unchanged as historical evidence; update project documentation with implementation status. Small implementation details, test organization and suitable error wording are left to the builder, provided they preserve these invariants.

## Primary documentation

- https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/
- https://developers.cloudflare.com/durable-objects/api/state/
- https://developers.cloudflare.com/durable-objects/api/alarms/
- Expo API references must match the repository's Expo 58 dependency before implementation.
