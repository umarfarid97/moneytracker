-- Distinguish two issuances even when randomly generated digits repeat.
ALTER TABLE login_codes ADD COLUMN generation TEXT NOT NULL DEFAULT '';
