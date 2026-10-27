CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  email_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  -- Opaque JSON the app uses to unlock its encryption key. The server cannot read the key.
  key_bundle TEXT
);
CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);
CREATE INDEX devices_account ON devices(account_id);
CREATE TABLE login_codes (
  email_hash TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  tries INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  window INTEGER NOT NULL,
  count INTEGER NOT NULL
);
-- One row per account: the current encrypted snapshot is the chunks tagged with upload_id.
CREATE TABLE snapshots (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  schema INTEGER NOT NULL DEFAULT 0,
  size INTEGER NOT NULL DEFAULT 0,
  upload_id TEXT NOT NULL DEFAULT '',
  prev_upload_id TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE blob_chunks (
  account_id TEXT NOT NULL,
  upload_id TEXT NOT NULL,
  idx INTEGER NOT NULL,
  data BLOB NOT NULL,
  PRIMARY KEY (account_id, upload_id, idx)
);
CREATE TABLE receipts (
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  size INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, name)
);
