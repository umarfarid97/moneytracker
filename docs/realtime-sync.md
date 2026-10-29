# Live sync across devices

The app uses the account coordinator's hibernating WebSocket channel to learn when another device changes cloud data. Finance data and receipts continue through the existing encrypted HTTP sync and conflict merge. The live channel carries only `ready`, `changed`, and heartbeat messages.

Local edits wait one second to group a burst of changes. Other foreground devices coalesce hints for 300ms and sync immediately. This aims for updates within seconds on a working network, not a guaranteed latency. A closed, hidden or backgrounded app reconnects and catches up when active again. Manual sync and the existing three-minute check remain available.

## Security and usage

- An authenticated request obtains a hashed, single-use, 30-second connection ticket. Long-lived bearer tokens never enter the WebSocket URL.
- Browser origins are checked on ticket issuance and upgrade. Upgrades also accept the Worker's own origin because Android's native WebSocket stack sends it automatically; the single-use ticket is still required. Connections are isolated by account; revoked devices and deleted accounts are disconnected.
- Eight connections per device and forty per account are allowed. Excess connections back off instead of evicting existing sessions.
- Reconnects use jittered exponential delays up to sixty seconds. Pending requests and socket handshakes time out after fifteen seconds. Cleanup cancels requests, callbacks and timers when a connection is no longer needed.
- A thirty-second ping uses Cloudflare's hibernation auto-response. A missing pong triggers reconnect after ten seconds. Heartbeat messages and reconnects still count toward applicable usage; idle connections avoid continuous duration usage only while eligible for hibernation. No zero-cost guarantee is implied.
- Missed hints are repaired on reconnect and periodic sync. Notification failure cannot undo or misreport a committed data write.

## Rollout

1. Merge/push the tested source, then run GitHub Actions **Deploy cloud server** on that branch. For installations that already deployed the security coordinator, no new D1 or Durable Object class migration is needed for live sync; the existing `ACCOUNTS` binding is reused. An installation that skipped the security release must apply its migrations through the workflow first.
2. Publish the updated web build. Build/release the updated mobile app for native clients. Older clients continue polling. New clients against an older backend retain periodic/manual sync and retry live connections with backoff.
3. With two separate test devices signed into the same account, add/edit/delete an expense and attach a receipt. Confirm the other foreground device updates; then disconnect/reconnect its network and hide/reopen it to confirm catch-up. Revoke one test device and confirm it stops receiving hints. Use a disposable account for deletion checks.

Local automated validation covers real workerd/D1/R2 ticket admission, replay/expiry, account isolation, receipt/snapshot hints, revocation/deletion and connection limits; client tests cover coalescing, reconnect, heartbeat, hung tickets, cleanup and provider scheduling. Run real Android/iOS and two-browser release checks as above; unit tests do not establish OS/network behavior. No production deployment is performed by these local checks.

Native receipt views subscribe to completed downloads so receipt-only arrival refreshes an already mounted view. Retry history resets only after a connection remains healthy for sixty seconds. Actual socket survival across provider hibernation eviction remains a staging check; the local restart test covers pending-ticket persistence only.

## Verification — 29 October 2026

- App: 102 suites / 1,021 tests passed; final focused connection tests 10/10 after test-only type annotation correction.
- Backend: 49 tests passed, including real local workerd/D1/R2 WebSocket admission and notification tests.
- App and backend TypeScript checks passed. App lint: zero errors, 28 existing warnings.
- Expo web export and Chromium browser smoke test passed.
- One independent whole-branch source review found three issues, all corrected with regression tests observed failing then passing: Android Origin, unauthorized persistent state, and flapping-connection retry reset. Native receipt-only view refresh was also reproduced and corrected.
- No production deployment or real-device validation was performed. Accepted live sockets surviving a provider hibernation eviction still need staging verification; this is distinct from the automated pending-ticket restart test.
