import { NextResponse } from 'next/server';
import { capabilities, isAdmin } from '@/server/config';
import { getSessionUser } from '@/server/auth/session';

/** 当前登录状态 + 我是不是管理员（后台入口据此决定要不要显示） */
export const dynamic = 'force-dynamic';

export async function GET() {
  const caps = capabilities();
  if (!caps.auth) {
    return NextResponse.json({ user: null, admin: false }, { headers: { 'cache-control': 'no-store' } });
  }

  const user = await getSessionUser();
  return NextResponse.json(
    {
      user,
      admin: user ? isAdmin({ email: user.email, groups: user.groups }) : false,
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
