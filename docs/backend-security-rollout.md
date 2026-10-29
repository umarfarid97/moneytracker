# Backend security rollout

Prepared locally; no live migration or deployment has been performed.

1. Preserve a recoverable D1 backup and confirm the release targets the intended Worker, D1 database and private R2 bucket. Exercise the release against a separate staging environment with dummy accounts first.
2. Apply D1 migrations `0003_code_generation.sql` and `0004_receipt_object_key.sql` before deploying this Worker. They add code generation identity and nullable receipt object pointers; existing receipt rows retain the legacy fallback path.
3. Deploy the Worker with the `ACCOUNTS` Durable Object binding, exported `AccountCoordinator` class and `v1-account-coordinator` SQLite class migration from `wrangler.toml`. Keep compatibility date 2026-10-01 unless separately tested.
4. Check staging sign-in (including five-attempt enforcement), upload/download/replacement, quota rejection, sync, device revocation and deletion. Retry injected failures and verify alarm recovery. Then repeat non-destructive smoke checks using a designated production test account after release.
5. Monitor retry/503 responses, coordinator alarms and storage errors without logging credentials, codes, email addresses or ciphertext. Investigate persistent retries before expanding rollout.

The coordinator is created on account traffic, so its Cloudflare namespace appears after deployment; no coordinator has been provisioned by this local implementation. Each account has its own ordering boundary. A bounded queue returns retry when overloaded. Durable journals reconcile R2 versions against D1 metadata; deletion fences survive object restarts.

## Rollback constraints

Do not blindly deploy the pre-coordinator Worker after new receipt writes. It does not understand immutable R2 version pointers and would bypass deletion fences/ordering. Prefer a forward fix or a rollback build that preserves the new pointer reader, coordinator binding and recovery behavior. Any conversion back to legacy object locations needs verified copies and metadata consistency before switching readers. Preserve durable journals, fences and pending alarms; do not remove the namespace or undo schema columns during incident response. Restore from backups only through a separately reviewed recovery procedure.

Local tests restart persisted SQLite Durable Objects, D1 and R2 and inject failure between object writes, metadata changes and deletion cleanup. These provide failure-path evidence but do not replace staging and device release checks.
