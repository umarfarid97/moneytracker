# Live cross-device sync implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver authenticated, low-idle-usage live change hints across devices.
**Architecture:** Hibernating account WebSockets notify the existing encrypted HTTP sync. A focused client connection manager handles lifetime and reconnects.
**Tech Stack:** Cloudflare Durable Objects, Expo 58 / React Native 0.88, TypeScript, Miniflare/Vitest and Jest.
**Spec:** docs/superpowers/specs/2026-10-29-realtime-sync-design.md

## Global constraints
No production calls/deployments; no finance data in events; no bearer tokens in URLs; retain three-minute fallback and existing merge encryption. Ticket TTL 30 seconds, eight sockets/device and forty/account; backoff 1–60 seconds; local edit delay 1 second; event coalescing 300ms.

## Review focus
Ticket replay/revocation after issuance; successful receipt transfer after snapshot hints; stale pending ticket after disconnect/account switch; reconnect storms or heartbeat timeouts; missed hints at disconnection and post-commit notification failures.

### Task 1: Server admission and notifications
Files: cloud-worker/src/index.ts, accountCoordinator.ts, new liveConnections.ts; test/runtime.test.ts.
Interfaces: LiveConnections issues/consumes tickets, accepts hibernating sockets and prunes/broadcasts by device ID. Coordinator remains the ordering boundary.
- [x] Add failing real-runtime tests for ticket, upgrade, isolation, post-commit hints and revocation/deletion.
- [x] Implement ticket endpoint, guarded unauthenticated upgrade routing, hibernation and post-commit notifications. Preserve 101 response in outer Worker.
- [x] Run backend suite/types; commit.

### Task 2: Foreground client and sync integration
Files: src/sync/liveSync.ts, cloudApi.ts, SyncProvider.tsx; tests/sync/liveSync.test.ts and provider integration coverage.
Interfaces: startLiveSync(api,onChange,onAuthError) returns stop(); API exposes liveUrl(); ready/changed coalesce into existing sync run.
- [x] Add failing tests for ready/change, single retry, heartbeat, auth errors, stale requests and stop.
- [x] Implement connection manager; wire foreground lifetime and one-second edits into provider, retain fallback.
- [x] Run focused tests/types; commit.

### Task 3: Validation and rollout
- [x] Run full app/backend suites, lint/types, web export/smoke. Obtain one fresh whole-branch review; fix important findings with regression-first tests.
- [x] Document rollout/manual device gaps and verification; commit, keep reviewable local branch.
