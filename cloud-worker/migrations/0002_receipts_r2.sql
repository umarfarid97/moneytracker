-- Receipt ciphertext moves from D1 chunks to the R2 bucket. 0 = still in D1 (copied over on first read or list), 1 = in R2.
ALTER TABLE receipts ADD COLUMN in_r2 INTEGER NOT NULL DEFAULT 0;
