import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

/**
 * 邮箱密码哈希。
 *
 * 用 Node 内置的 scrypt，不引第三方库：加账号系统已经够重了，
 * 密码哈希这种标准能力没必要再塞一个依赖进来。
 */
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;

  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  const expected = Buffer.from(hash, 'hex');
  if (expected.length !== derived.length) return false;
  // 定长比较，避免通过响应时间推断密码
  return timingSafeEqual(derived, expected);
}

/** 最低要求：够长就行。不强制大小写数字符号那套，反而逼人用烂密码。 */
export function validatePassword(password: string): string | null {
  if (password.length < 8) return '密码至少 8 位';
  if (password.length > 200) return '密码过长';
  return null;
}

export function validateEmail(email: string): string | null {
  // 刻意宽松：只拦明显不是邮箱的输入，不做 RFC 全量校验
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '邮箱格式不正确';
  return null;
}
