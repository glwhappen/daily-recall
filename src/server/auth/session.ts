import { randomBytes, randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { query, queryOne } from '../db';

/**
 * 会话管理。会话存数据库（不是签名 cookie），
 * 这样「退出所有设备」和「管理员踢人」都是删一行的事。
 */
export const SESSION_COOKIE = 'dr_session';
const SESSION_DAYS = 30;

export interface SessionUser {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  groups: string[];
}

export function newId(): string {
  return randomUUID();
}

export async function createSession(userId: string): Promise<string> {
  const id = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  await query('insert into sessions (id, user_id, expires_at) values ($1, $2, $3)', [
    id,
    userId,
    expiresAt,
  ]);

  const jar = await cookies();
  jar.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });

  return id;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const sessionId = jar.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const row = await queryOne<{
    id: string;
    email: string | null;
    name: string | null;
    image: string | null;
    groups: string[] | null;
  }>(
    `select u.id, u.email, u.name, u.image,
            (select i.groups from identities i where i.user_id = u.id limit 1) as groups
       from sessions s
       join users u on u.id = s.user_id
      where s.id = $1 and s.expires_at > now()`,
    [sessionId],
  );

  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    image: row.image,
    groups: Array.isArray(row.groups) ? row.groups : [],
  };
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const sessionId = jar.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    await query('delete from sessions where id = $1', [sessionId]);
  }
  jar.delete(SESSION_COOKIE);
}

/** 清理过期会话，由启动钩子或定时任务调用 */
export async function purgeExpiredSessions(): Promise<void> {
  await query('delete from sessions where expires_at < now()');
}
