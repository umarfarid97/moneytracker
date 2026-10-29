# Security fixes — 29 October 2026

All eight approved fixes are implemented on `codex/security-fixes-implementation`. This records implementation evidence; it does not replace the historical audit or claim production validation.

| Audit area | Change | Regression coverage |
| --- | --- | --- |
| 1. Receipt references | Canonical app receipt keys validated during import and immediately before access. Web opens only app-owned blobs. Native legacy paths must be contained in the current document receipt directory and are normalized on export. | Unsafe schemes, traversal, restore without writes, genuine legacy backup roundtrip, legitimate PDF opening. |
| 2. PDF resource exhaustion | 10 MiB input, 32 MiB decoded streams, 10,000 objects and 64 MiB aggregate work budget; validated object-stream offsets and bounded streaming decompression. | Expansion bombs, malformed headers, long digit scans with VM deadlines, valid object streams. |
| 3. PIN guessing | Persisted attempt/deadline state, serialized admission and fail-closed storage errors. PIN changes reset throttle before replacing credentials. | Restart/corruption/write refusal, concurrent attempts, failed PIN change and stale lifecycle completion. |
| 4. Lock presentation | Locked routes dismiss modals; inactive screens hide content in place to preserve drafts. Receipt previews clear and shortcuts wait for unlock. | Cold start, background/foreground, draft retention, late biometrics and PIN completion, deferred shortcuts. |
| 5. Notification privacy | Lock changes rebuild reminders, remove delivered finance notifications and serialize budget alerts with cleanup. Privacy failures are surfaced with retry. | Pending/delivered cleanup, overlapping schedules, cancellation failure and pinned shortcut preservation. |
| 6. OTP races | D1 guarded atomic admission enforces five attempts; conditional consumption binds the exact code generation. | Parallel guesses, duplicate success and same-digit replacement generation. |
| 7. Receipt mutation races | Per-account Durable Object orders operations and reauthenticates queued requests. Immutable R2 versions and durable journals reconcile metadata failures/restarts. | Real local workerd/D1/R2 quota, replacement, crash recovery and revoked queued token tests. |
| 8. Account deletion races | Durable deletion fence blocks further operations; idempotent cleanup retries through alarms and survives restarts. | Held upload/delete ordering, R2/D1 failures, legacy migration, restart and fresh account ID tests. |

## Verification

- App: 99 Jest suites, 1,006 tests passed; TypeScript passed.
- App lint: zero errors, 28 existing warnings (configured threshold 30).
- Backend: 41 tests passed, including persisted Miniflare/workerd integration tests at compatibility date 2026-10-01; TypeScript passed.
- Backend dependency audit: zero reported vulnerabilities after test-tool upgrades. Miniflare 5 beta is a development-only dependency used to match the configured runtime date.
- Four important whole-branch review findings were reproduced and corrected with regressions: quadratic PDF header scans, failed PIN-change ordering, modal draft loss, and legacy receipt backup compatibility. Additional late-PIN and budget-alert race regressions were also fixed.

## Remaining release checks

Run Android and iOS checks on real devices: modal layering and app switcher privacy; document picker size handling; SecureStore refusal/restart; biometric lifecycle; delivered OS notification cleanup; shortcut behavior. Mocked lifecycle tests cannot establish these platform behaviors. Web localStorage is a casual privacy boundary, not protection from a same-origin attacker or coordinated multi-tab tampering. Existing lock-settings read-error defaults remain outside these eight fixes.

The synchronous PDF parser has finite resource budgets but does not offer preemptive wall-clock interruption of JavaScript regex execution.

No production deployment, migrations or real account operations were performed. See [backend rollout](backend-security-rollout.md) before release.

Final web validation: Expo web export and the Chromium browser smoke test passed against the exported build.
