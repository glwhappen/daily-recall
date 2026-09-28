import { NextResponse } from 'next/server';
import { capabilities } from '@/server/config';
import { createSession } from '@/server/auth/session';
import { createUserWithPassword, findUserByEmail } from '@/server/auth/users';
import { validateEmail, validatePassword } from '@/server/auth/password';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const caps = capabilities();
  if (!caps.auth) {
    return NextResponse.json({ error: '这台部署没有开启注册登录' }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
    name?: string;
  } | null;

  const email = body?.email?.trim() ?? '';
  const password = body?.password ?? '';

  const emailError = validateEmail(email);
  if (emailError) return NextResponse.json({ error: emailError }, { status: 400 });

  const passwordError = validatePassword(password);
  if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });

  if (await findUserByEmail(email)) {
    return NextResponse.json({ error: '这个邮箱已经注册过了' }, { status: 409 });
  }

  const user = await createUserWithPassword(email, password, body?.name?.trim() || null);
  await createSession(user.id);

  return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
}
