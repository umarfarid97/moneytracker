import initSqlJs from 'sql.js';
import { createSqlJsAdapter } from '@/db/sqljsAdapter';

async function setup() {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  const onWrite = jest.fn();
  const db = createSqlJsAdapter(raw, onWrite);
  return { db, onWrite, raw };
}

describe('createSqlJsAdapter onWrite', () => {
  test('runs after a plain write', async () => {
    const { db, onWrite } = await setup();
    await db.exec('CREATE TABLE t (id INTEGER)');
    await db.run('INSERT INTO t VALUES (1)');
    expect(onWrite).toHaveBeenCalledTimes(2);
  });

  test('does not run inside a transaction, only once after it commits', async () => {
    const { db, onWrite } = await setup();
    await db.exec('CREATE TABLE t (id INTEGER)');
    onWrite.mockClear();
    await db.transaction(async () => {
      await db.run('INSERT INTO t VALUES (1)');
      await db.run('INSERT INTO t VALUES (2)');
      expect(onWrite).not.toHaveBeenCalled();
    });
    expect(onWrite).toHaveBeenCalledTimes(1);
    expect((await db.all('SELECT id FROM t')).length).toBe(2);
  });

  test('a rolled back transaction leaves data unchanged and does not save', async () => {
    const { db, onWrite } = await setup();
    await db.exec('CREATE TABLE t (id INTEGER)');
    onWrite.mockClear();
    await expect(
      db.transaction(async () => {
        await db.run('INSERT INTO t VALUES (1)');
        throw new Error('nope');
      }),
    ).rejects.toThrow('nope');
    expect(await db.all('SELECT id FROM t')).toEqual([]);
    expect(onWrite).not.toHaveBeenCalled();
  });
});
