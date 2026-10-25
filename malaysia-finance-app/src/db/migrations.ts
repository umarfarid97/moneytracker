import type { Db } from './types';

/**
 * Append-only list. Index i upgrades the database from user_version i to i + 1.
 * Never edit an entry that has shipped; add a new one.
 */
export const MIGRATIONS: string[] = [
  `
  CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    icon TEXT NOT NULL,
    sort_order INTEGER NOT NULL
  );
  CREATE TABLE expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount INTEGER NOT NULL CHECK (amount >= 0),
    category_id INTEGER NOT NULL REFERENCES categories(id),
    date TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    receipt_uri TEXT
  );
  CREATE INDEX idx_expenses_date ON expenses(date);
  CREATE INDEX idx_expenses_category ON expenses(category_id);
  CREATE TABLE budgets (
    category_id INTEGER NOT NULL REFERENCES categories(id),
    month TEXT NOT NULL,
    limit_sen INTEGER NOT NULL CHECK (limit_sen >= 0),
    PRIMARY KEY (category_id, month)
  );
  CREATE TABLE commitments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    amount INTEGER NOT NULL CHECK (amount >= 0),
    day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
    kind TEXT NOT NULL CHECK (kind IN ('bill', 'loan', 'subscription')),
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE relief_claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    relief_id TEXT NOT NULL,
    year INTEGER NOT NULL,
    amount INTEGER NOT NULL CHECK (amount >= 0),
    receipt_uri TEXT,
    note TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX idx_relief_year ON relief_claims(year);
  CREATE TABLE profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    gross_monthly INTEGER NOT NULL,
    net_monthly_override INTEGER,
    epf_rate REAL NOT NULL,
    socso_monthly INTEGER NOT NULL,
    eis_monthly INTEGER NOT NULL
  );
  INSERT INTO profile (id, gross_monthly, net_monthly_override, epf_rate, socso_monthly, eis_monthly)
    VALUES (1, 0, NULL, 0.11, 0, 0);
  INSERT INTO categories (name, icon, sort_order) VALUES
    ('Makan', 'utensils', 1),
    ('Transport', 'car', 2),
    ('Bil', 'receipt', 3),
    ('Rumah', 'home', 4),
    ('Hiburan', 'film', 5),
    ('Kesihatan', 'heart', 6),
    ('Pendidikan', 'book', 7),
    ('Lain-lain', 'dots', 8);
  `,
  // 2: payment methods, relief tags on spending, bills that record spending
  `
  CREATE TABLE payment_methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL CHECK (kind IN ('cash', 'debit', 'credit', 'ewallet', 'transfer')),
    sort_order INTEGER NOT NULL
  );
  INSERT INTO payment_methods (name, kind, sort_order) VALUES
    ('Cash', 'cash', 1),
    ('Debit card', 'debit', 2),
    ('Credit card', 'credit', 3),
    ('E-wallet', 'ewallet', 4),
    ('Online transfer', 'transfer', 5);
  ALTER TABLE expenses ADD COLUMN payment_method_id INTEGER;
  ALTER TABLE expenses ADD COLUMN relief_id TEXT;
  ALTER TABLE expenses ADD COLUMN relief_amount INTEGER;
  ALTER TABLE expenses ADD COLUMN commitment_id INTEGER;
  ALTER TABLE expenses ADD COLUMN due_date TEXT;
  CREATE UNIQUE INDEX idx_expenses_bill ON expenses(commitment_id, due_date) WHERE commitment_id IS NOT NULL;
  ALTER TABLE commitments ADD COLUMN category_id INTEGER;
  ALTER TABLE commitments ADD COLUMN payment_method_id INTEGER;
  ALTER TABLE commitments ADD COLUMN relief_id TEXT;
  ALTER TABLE commitments ADD COLUMN auto_record INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE commitments ADD COLUMN start_date TEXT;
  ALTER TABLE commitments ADD COLUMN last_auto_due TEXT;
  UPDATE commitments SET start_date = date('now', '+8 hours');
  `,
  // 3: bills whose amount changes every month (existing bills stay fixed)
  `
  ALTER TABLE commitments ADD COLUMN variable INTEGER NOT NULL DEFAULT 0;
  `,
];

/** Brings the database up to date. Each step runs in its own transaction. */
export async function migrate(db: Db, migrations: string[] = MIGRATIONS): Promise<void> {
  const row = await db.get<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (let i = current; i < migrations.length; i++) {
    await db.transaction(async () => {
      await db.exec(migrations[i]);
      await db.exec(`PRAGMA user_version = ${i + 1}`);
    });
  }
}
