-- Immutable object versions preserve an existing receipt until its metadata commits.
ALTER TABLE receipts ADD COLUMN object_key TEXT;
