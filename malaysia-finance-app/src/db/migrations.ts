import type { Db } from './types';

/** Milliseconds since 1970 in SQL, the same clock as Date.now(). */
const NOW_MS = `CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)`;
/** Triggers stay quiet while a sync writes merged data (it sets its own times and deletions). */
const NOT_APPLYING = `NOT EXISTS (SELECT 1 FROM sync_state WHERE key = 'applying')`;

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
  // 4: sync and backup (see src/sync): stable ids, edit times and deletions, kept up to date by triggers
  syncMigration(),
  // 5: SST (service tax) read from a scanned receipt, in sen; null when not known
  `
  ALTER TABLE expenses ADD COLUMN sst INTEGER;
  `,
  // 6: loans with a remaining balance, and a budget period that can start on payday
  `
  ALTER TABLE commitments ADD COLUMN loan_type TEXT;
  ALTER TABLE commitments ADD COLUMN loan_balance INTEGER;
  ALTER TABLE commitments ADD COLUMN loan_balance_date TEXT;
  ALTER TABLE commitments ADD COLUMN loan_original INTEGER;
  ALTER TABLE commitments ADD COLUMN loan_rate_pct REAL;
  ALTER TABLE profile ADD COLUMN budget_start_day INTEGER NOT NULL DEFAULT 1 CHECK (budget_start_day BETWEEN 1 AND 31);
  `,
  // 7: EPF / SOCSO / EIS records, zakat and giving, savings and investments (all synced like other entities)
  wealthMigration(),
  // 8: spending in a foreign currency, money lent to or borrowed from people, extra recurring income
  extrasMigration(),
  // 9: how many days before a bill or loan is due its reminder fires (0 = on the day), synced with the profile
  `
  ALTER TABLE profile ADD COLUMN reminder_days INTEGER NOT NULL DEFAULT 1 CHECK (reminder_days BETWEEN 0 AND 7);
  `,
  // 10: the event (trip, dinner, ...) a lent or split amount belongs to
  `
  ALTER TABLE owed_entries ADD COLUMN event TEXT NOT NULL DEFAULT '';
  `,
];

/** New tables that sync: each gets a uid and edit time from the start, and the same triggers as the older ones. */
function trackedTable(name: string, columns: string): string {
  return `
  CREATE TABLE ${name} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ${columns},
    uid TEXT,
    updated_at INTEGER NOT NULL DEFAULT 0
  );
  CREATE UNIQUE INDEX idx_${name}_uid ON ${name}(uid);
  CREATE TRIGGER ${name}_sync_insert AFTER INSERT ON ${name} WHEN NEW.uid IS NULL
  BEGIN UPDATE ${name} SET uid = lower(hex(randomblob(16))), updated_at = ${NOW_MS} WHERE id = NEW.id; END;
  CREATE TRIGGER ${name}_sync_update AFTER UPDATE ON ${name} WHEN NEW.updated_at = OLD.updated_at AND ${NOT_APPLYING}
  BEGIN UPDATE ${name} SET updated_at = ${NOW_MS} WHERE id = NEW.id; END;
  CREATE TRIGGER ${name}_sync_delete AFTER DELETE ON ${name} WHEN OLD.uid IS NOT NULL AND ${NOT_APPLYING}
  BEGIN INSERT OR REPLACE INTO sync_deleted (tbl, uid, deleted_at) VALUES ('${name}', OLD.uid, ${NOW_MS}); END;`;
}

function wealthMigration(): string {
  return [
    trackedTable('retirement_entries', `
    scheme TEXT NOT NULL CHECK (scheme IN ('epf', 'socso', 'eis')),
    kind TEXT NOT NULL CHECK (kind IN ('contribution', 'dividend', 'withdrawal', 'opening')),
    date TEXT NOT NULL,
    amount INTEGER NOT NULL CHECK (amount >= 0),
    employer_share INTEGER NOT NULL DEFAULT 0 CHECK (employer_share >= 0 AND employer_share <= amount),
    note TEXT NOT NULL DEFAULT ''`),
    `CREATE INDEX idx_retirement_scheme_date ON retirement_entries(scheme, date);`,
    trackedTable('giving_records', `
    kind TEXT NOT NULL CHECK (kind IN ('zakat', 'fitrah', 'sedekah', 'waqf')),
    date TEXT NOT NULL,
    amount INTEGER NOT NULL CHECK (amount >= 0),
    recipient TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    counts_for_tax INTEGER NOT NULL DEFAULT 1`),
    `CREATE INDEX idx_giving_date ON giving_records(date);`,
    trackedTable('savings_accounts', `
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('tabung_haji', 'asb', 'hajj', 'prs', 'unit_trust', 'other')),
    balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
    invested INTEGER NOT NULL DEFAULT 0 CHECK (invested >= 0),
    target INTEGER CHECK (target IS NULL OR target > 0),
    monthly INTEGER CHECK (monthly IS NULL OR monthly >= 0),
    note TEXT NOT NULL DEFAULT ''`),
  ].join('\n');
}

function extrasMigration(): string {
  return [
    `
  ALTER TABLE expenses ADD COLUMN currency TEXT NOT NULL DEFAULT 'MYR';
  ALTER TABLE expenses ADD COLUMN foreign_amount INTEGER;
  ALTER TABLE expenses ADD COLUMN fx_rate REAL;`,
    trackedTable('owed_entries', `
    person TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('lent', 'repaid', 'borrowed', 'paidBack')),
    amount INTEGER NOT NULL CHECK (amount > 0),
    date TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT ''`),
    `CREATE INDEX idx_owed_person ON owed_entries(person);`,
    trackedTable('income_rules', `
    name TEXT NOT NULL,
    amount INTEGER NOT NULL CHECK (amount >= 0),
    day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
    active INTEGER NOT NULL DEFAULT 1,
    start_date TEXT NOT NULL,
    last_run TEXT`),
    trackedTable('income_entries', `
    name TEXT NOT NULL,
    amount INTEGER NOT NULL CHECK (amount >= 0),
    date TEXT NOT NULL`),
    `CREATE INDEX idx_income_date ON income_entries(date);`,
  ].join('\n');
}

function syncMigration(): string {
  const entities = ['categories', 'payment_methods', 'commitments', 'expenses', 'relief_claims'];
  const columns = entities.map((t) => `
  ALTER TABLE ${t} ADD COLUMN uid TEXT;
  ALTER TABLE ${t} ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;`).join('');
  // Created after the backfill below, so filling in the new columns does not count as an edit.
  const triggers = entities.map((t) => `
  CREATE UNIQUE INDEX idx_${t}_uid ON ${t}(uid);
  CREATE TRIGGER ${t}_sync_insert AFTER INSERT ON ${t} WHEN NEW.uid IS NULL
  BEGIN UPDATE ${t} SET uid = lower(hex(randomblob(16))), updated_at = ${NOW_MS} WHERE id = NEW.id; END;
  CREATE TRIGGER ${t}_sync_update AFTER UPDATE ON ${t} WHEN NEW.updated_at = OLD.updated_at AND ${NOT_APPLYING}
  BEGIN UPDATE ${t} SET updated_at = ${NOW_MS} WHERE id = NEW.id; END;
  CREATE TRIGGER ${t}_sync_delete AFTER DELETE ON ${t} WHEN OLD.uid IS NOT NULL AND ${NOT_APPLYING}
  BEGIN INSERT OR REPLACE INTO sync_deleted (tbl, uid, deleted_at) VALUES ('${t}', OLD.uid, ${NOW_MS}); END;`).join('');
  return `
  CREATE TABLE sync_state (key TEXT PRIMARY KEY, value TEXT);
  CREATE TABLE sync_deleted (
    tbl TEXT NOT NULL,
    uid TEXT NOT NULL,
    deleted_at INTEGER NOT NULL,
    merged_into TEXT,
    PRIMARY KEY (tbl, uid)
  );
  ${columns}
  ALTER TABLE budgets ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE profile ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;

  -- Categories and payment methods get ids from their names and edit time 0, so the same defaults on
  -- two phones match up and any real edit wins.
  UPDATE categories SET uid = 'cat-' || name;
  UPDATE payment_methods SET uid = 'pm-' || name;
  UPDATE commitments SET uid = lower(hex(randomblob(16))), updated_at = ${NOW_MS};
  UPDATE expenses SET uid = lower(hex(randomblob(16))), updated_at = ${NOW_MS};
  UPDATE relief_claims SET uid = lower(hex(randomblob(16))), updated_at = ${NOW_MS};
  UPDATE budgets SET updated_at = ${NOW_MS};
  -- A profile still at its defaults stays at 0, so it never wins over a filled-in one.
  UPDATE profile SET updated_at = ${NOW_MS} WHERE gross_monthly <> 0 OR net_monthly_override IS NOT NULL;
  ${triggers}
  CREATE TRIGGER budgets_sync_insert AFTER INSERT ON budgets WHEN NEW.updated_at = 0 AND ${NOT_APPLYING}
  BEGIN UPDATE budgets SET updated_at = ${NOW_MS} WHERE category_id = NEW.category_id AND month = NEW.month; END;
  CREATE TRIGGER budgets_sync_update AFTER UPDATE ON budgets WHEN NEW.updated_at = OLD.updated_at AND ${NOT_APPLYING}
  BEGIN UPDATE budgets SET updated_at = ${NOW_MS} WHERE category_id = NEW.category_id AND month = NEW.month; END;
  CREATE TRIGGER budgets_sync_delete AFTER DELETE ON budgets WHEN ${NOT_APPLYING}
  BEGIN
    INSERT OR REPLACE INTO sync_deleted (tbl, uid, deleted_at)
      SELECT 'budgets', uid || '|' || OLD.month, ${NOW_MS} FROM categories WHERE id = OLD.category_id;
  END;
  CREATE TRIGGER profile_sync_update AFTER UPDATE ON profile WHEN NEW.updated_at = OLD.updated_at AND ${NOT_APPLYING}
  BEGIN UPDATE profile SET updated_at = ${NOW_MS} WHERE id = NEW.id; END;
  `;
}

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
