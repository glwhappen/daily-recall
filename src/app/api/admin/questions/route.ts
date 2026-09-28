import { NextResponse } from 'next/server';
import { capabilities } from '@/server/config';
import { currentAdmin } from '@/server/auth/guard';
import { disabledQuestionIds, questionStats, setQuestionDisabled } from '@/server/feedback';

export const dynamic = 'force-dynamic';

/** 题目反馈统计 + 已下线名单 */
export async function GET() {
  if (!capabilities().server) {
    return NextResponse.json({ error: '这台部署没有开启服务端' }, { status: 403 });
  }
  const admin = await currentAdmin();
  if (!admin) {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
  }

  const [stats, disabled] = await Promise.all([questionStats(), disabledQuestionIds()]);
  return NextResponse.json({ stats, disabled }, { headers: { 'cache-control': 'no-store' } });
}

/** 下线 / 恢复一道题 */
export async function POST(request: Request) {
  if (!capabilities().server) {
    return NextResponse.json({ error: '这台部署没有开启服务端' }, { status: 403 });
  }
  const admin = await currentAdmin();
  if (!admin) {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    questionId?: string;
    disabled?: boolean;
    reason?: string | null;
  } | null;

  const questionId = body?.questionId;
  if (typeof questionId !== 'string' || !questionId) {
    return NextResponse.json({ error: '缺少 questionId' }, { status: 400 });
  }

  await setQuestionDisabled(questionId, admin.id, body?.disabled !== false, body?.reason ?? null);

  const [stats, disabled] = await Promise.all([questionStats(), disabledQuestionIds()]);
  return NextResponse.json({ stats, disabled });
}
