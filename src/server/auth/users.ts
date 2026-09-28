import { query, queryOne } from '../db';
import { withTransaction } from '../migrate';
import { hashPassword, verifyPassword } from './password';
import { newId } from './session';

export interface UserRow {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  password_hash: string | null;
}

const USER_COLUMNS = 'id, email, name, image, password_hash';

export async function findUserById(id: string): Promise<UserRow | null> {
  return queryOne<UserRow>(`select ${USER_COLUMNS} from users where id = $1`, [id]);
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  return queryOne<UserRow>(`select ${USER_COLUMNS} from users where email = $1`, [
    email.toLowerCase(),
  ]);
}

export async function createUserWithPassword(
  email: string,
  password: string,
  name?: string | null,
): Promise<UserRow> {
  const hash = await hashPassword(password);
  return queryOne<UserRow>(
    `insert into users (id, email, password_hash, name)
     values ($1, $2, $3, $4)
     returning ${USER_COLUMNS}`,
    [newId(), email.toLowerCase(), hash, name ?? email.split('@')[0]],
  ) as Promise<UserRow>;
}

export async function verifyCredentials(
  email: string,
  password: string,
): Promise<UserRow | null> {
  const user = await findUserByEmail(email);
  if (!user) {
    // 用户不存在时也走一遍哈希，避免响应时间泄露「这个邮箱是否注册过」
    await verifyPassword(password, 'scrypt$0000$0000');
    return null;
  }
  const ok = await verifyPassword(password, user.password_hash);
  return ok ? user : null;
}

export interface OidcProfile {
  provider: string;
  subject: string;
  email?: string | null;
  emailVerified?: boolean;
  name?: string | null;
  image?: string | null;
  groups: string[];
}

/**
 * OIDC 登录时把身份落到本地用户表。
 *
 * 三种情况：
 * 1. 这个 provider+sub 已经绑过 → 刷新资料与组
 * 2. 邮箱已存在且已验证 → 绑到同一个用户（同一个人用两种方式登录，不该有两个账号）
 * 3. 都没有 → 建新用户
 */
export async function upsertOidcUser(profile: OidcProfile): Promise<UserRow> {
  const email = profile.email?.toLowerCase() ?? null;

  return withTransaction(async (client) => {
    const bound = await client.query<{ user_id: string }>(
      'select user_id from identities where provider = $1 and subject = $2',
      [profile.provider, profile.subject],
    );

    let userId: string;

    if (bound.rows[0]) {
      userId = bound.rows[0].user_id;
      await client.query('update identities set groups = $3 where provider = $1 and subject = $2', [
        profile.provider,
        profile.subject,
        JSON.stringify(profile.groups),
      ]);
      await client.query('update users set name = coalesce($2, name), image = coalesce($3, image) where id = $1', [
        userId,
        profile.name ?? null,
        profile.image ?? null,
      ]);
    } else {
      let existingUserId: string | null = null;

      if (email && profile.emailVerified !== false) {
        const existing = await client.query<{ id: string }>(
          'select id from users where email = $1',
          [email],
        );
        existingUserId = existing.rows[0]?.id ?? null;
      }

      if (existingUserId) {
        userId = existingUserId;
      } else {
        const created = await client.query<{ id: string }>(
          `insert into users (id, email, name, image, email_verified)
           values ($1, $2, $3, $4, $5)
           returning id`,
          [
            newId(),
            email,
            profile.name ?? (email ? email.split('@')[0] : null),
            profile.image ?? null,
            profile.emailVerified === false ? null : new Date(),
          ],
        );
        userId = created.rows[0].id;
      }

      await client.query(
        `insert into identities (id, user_id, provider, subject, groups)
         values ($1, $2, $3, $4, $5)
         on conflict (provider, subject) do update set groups = excluded.groups`,
        [newId(), userId, profile.provider, profile.subject, JSON.stringify(profile.groups)],
      );
    }

    const result = await client.query<UserRow>(
      `select ${USER_COLUMNS} from users where id = $1`,
      [userId],
    );
    return result.rows[0];
  });
}

/** 用户的个人偏好（例如被屏蔽的题目 id，本地也存一份，这里只是副本） */
export async function getUserPreferences(userId: string): Promise<Record<string, unknown>> {
  const row = await queryOne<{ preferences: Record<string, unknown> }>(
    'select preferences from users where id = $1',
    [userId],
  );
  return row?.preferences ?? {};
}

export async function getUserGroups(userId: string): Promise<string[]> {
  const rows = await query<{ groups: string[] }>(
    'select groups from identities where user_id = $1',
    [userId],
  );
  return rows.flatMap((r) => (Array.isArray(r.groups) ? r.groups : []));
}
