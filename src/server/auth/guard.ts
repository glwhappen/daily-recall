import { isAdmin } from '../config';
import { getSessionUser, type SessionUser } from './session';

/** 当前用户是不是管理员（邮箱白名单或 OIDC 组） */
export async function currentAdmin(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user) return null;
  return isAdmin({ email: user.email, groups: user.groups }) ? user : null;
}
