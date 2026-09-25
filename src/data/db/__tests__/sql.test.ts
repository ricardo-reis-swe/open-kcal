import { openTestDatabase } from '@/shared/testing/nodeSqlite';

describe('DATA-01 / ARCH-09: SQL adapter', () => {
  it('turns foreign keys on for the connection', async () => {
    const db = await openTestDatabase();
    expect(await db.getFirst('PRAGMA foreign_keys')).toEqual({ foreign_keys: 1 });
    await db.close();
  });

  it('binds params instead of interpolating them', async () => {
    const db = await openTestDatabase();
    await db.exec('CREATE TABLE t (name TEXT)');
    const hostile = "x'); DROP TABLE t; --";
    await db.run('INSERT INTO t (name) VALUES (?)', [hostile]);
    expect(await db.getAll('SELECT name FROM t')).toEqual([{ name: hostile }]);
    await db.close();
  });

  it('commits a transaction and returns its value', async () => {
    const db = await openTestDatabase();
    await db.exec('CREATE TABLE t (n INTEGER)');
    const value = await db.transaction(async (tx) => {
      await tx.run('INSERT INTO t (n) VALUES (?)', [1]);
      await tx.run('INSERT INTO t (n) VALUES (?)', [2]);
      return 'done';
    });
    expect(value).toBe('done');
    expect(await db.getFirst('SELECT COUNT(*) AS c FROM t')).toEqual({ c: 2 });
    await db.close();
  });

  it('rolls back every row when a transaction throws', async () => {
    const db = await openTestDatabase();
    await db.exec('CREATE TABLE t (n INTEGER NOT NULL)');
    await expect(
      db.transaction(async (tx) => {
        await tx.run('INSERT INTO t (n) VALUES (?)', [1]);
        await tx.run('INSERT INTO t (n) VALUES (?)', [null]);
      }),
    ).rejects.toThrow();
    expect(await db.getFirst('SELECT COUNT(*) AS c FROM t')).toEqual({ c: 0 });
    // The connection is usable afterwards.
    await db.run('INSERT INTO t (n) VALUES (?)', [3]);
    expect(await db.getFirst('SELECT COUNT(*) AS c FROM t')).toEqual({ c: 1 });
    await db.close();
  });

  it('queues calls made during a transaction until it finishes', async () => {
    const db = await openTestDatabase();
    await db.exec('CREATE TABLE t (n INTEGER)');
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const tx = db.transaction(async (t) => {
      await t.run('INSERT INTO t (n) VALUES (1)');
      await gate;
    });
    const outside = db.getFirst<{ c: number }>('SELECT COUNT(*) AS c FROM t');
    release();
    await tx;
    expect(await outside).toEqual({ c: 1 });
    await db.close();
  });
});
