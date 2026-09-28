import { Pool, type QueryResultRow } from 'pg';

/**
 * 数据库连接池。
 *
 * 没配 DATABASE_URL 时这里返回 undefined，上层据此走纯本地模式——
 * 「不配任何东西也能跑」是硬要求，不能因为加了服务端就把开源用户挡在门外。
 */
let pool: Pool | undefined;

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getPool(): Pool | undefined {
  if (!hasDatabase()) return undefined;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
    });
  }
  return pool;
}

/** 查询。没配数据库时直接抛错，调用方应该先用 hasDatabase() 判断。 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const p = getPool();
  if (!p) throw new Error('未配置 DATABASE_URL，无法访问数据库');
  const result = await p.query<T>(sql, params);
  return result.rows;
}

/** 返回单行，没有则返回 null */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}
