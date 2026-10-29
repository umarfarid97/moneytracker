# Live cross-device sync design

Status: WebSocket approach selected by the user in chat on 29 October 2026. This document records that approved direction and implementation choices.

## Goal and approach
Changes on any signed-in device should reach other open, online devices within seconds. Use the existing per-account Durable Object as a hibernating WebSocket server. Compared with frequent polling, this avoids constant HTTP checks; compared with replacing sync transport, change hints preserve existing encryption, merging and conflict handling. Periodic three-minute checks and manual sync remain available.

## Contract
A device obtains a 30-second single-use ticket through authenticated POST /events/ticket, then upgrades GET /events?ticket=... . The long-lived device bearer token never appears in the WebSocket URL. The ticket encodes routing IDs plus random secret, is stored only as a hash, and is consumed inside account ordering. Origin checks apply to issuance and upgrade. A connection receives ready after admission and changed after successful snapshot, receipt or key mutations from other devices. Messages contain no finance data. Logout, revocation, pruning and deletion close affected sockets. Connection attachments survive hibernation. Limit eight connections per device and forty per account; reject excess without evicting existing clients.

The client keeps one foreground connection when signed in and unlocked for cloud sync; retries use jittered exponential backoff (1–60 seconds). Catch up on ready, including after reconnect. Heartbeats use server auto-response without waking the object. Coalesce changed messages for 300ms. Upload local edits after 1 second instead of 5. Suspend connections when the app is hidden/backgrounded and clean up on account change/unmount. Existing fallback handles unsupported endpoints and missed hints; messages are advisory, never authoritative data.

## Verification and release
Regression tests cover ticket replay/expiry/origin/auth boundaries, account isolation, changes only after commit, receipt hints, revocation/deletion, missed hints on reconnect, reconnect backoff, stale async tickets, heartbeat timeout and lifecycle cleanup. Run full backend/app suites, types, lint and web build/smoke. No new production migration is needed beyond the existing coordinator deployment. Ship backend before clients; old clients keep polling and new clients fall back against old servers. No production deployment is part of implementation.
