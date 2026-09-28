import { NextResponse } from 'next/server';
import { capabilities } from '@/server/config';
import { createSession } from '@/server/auth/session';
import { verifyCredentials } from '@/server/auth/users';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const caps = capabilities();
  if (!caps.auth) {
    return NextResponse.json({ error: '这台部署没有开启注册登录' }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
  } | null;

  const email = body?.email?.trim() ?? '';
  const password = body?.password ?? '';

  if (!email || !password) {
    return NextResponse.json({ error: '请填写邮箱和密码' }, { status: 400 });
  }

  const user = await verifyCredentials(email, password);
  if (!user) {
    // 刻意不区分「邮箱不存在」和「密码错误」，避免探测已注册邮箱
    return NextResponse.json({ error: '邮箱或密码不正确' }, { status: 401 });
  }

  await createSession(user.id);
  return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
}
