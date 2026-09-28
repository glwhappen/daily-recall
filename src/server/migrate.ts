import type { PoolClient } from 'pg';
import { getPool, hasDatabase, query } from './db';
import { MIGRATIONS } from './migrations';

/** 在一个连接上跑事务 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const pool = getPool();
  if (!pool) throw new Error('未配置 DATABASE_URL');
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 启动时执行未应用的迁移。幂等，可以每次启动都跑。
 * 由 src/instrumentation.ts 调用。
 */
export async function runMigrations(): Promise<void> {
  if (!hasDatabase()) return;

  await query(`
    create table if not exists schema_migrations (
      id         text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const applied = new Set(
    (await query<{ id: string }>('select id from schema_migrations')).map((r) => r.id),
  );

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    await withTransaction(async (client) => {
      await client.query(migration.sql);
      await client.query('insert into schema_migrations (id) values ($1)', [migration.id]);
    });
    console.log(`[db] 已应用迁移 ${migration.id}`);
  }
}
