import { NextResponse } from 'next/server';
import { capabilities } from '@/server/config';
import { getSessionUser } from '@/server/auth/session';
import { isValidAnswer, syncAnswers } from '@/server/answers';

export const dynamic = 'force-dynamic';

/**
 * 云端同步。
 *
 * 语义是「拿我的本地记录和你那边的合一下，然后把合并结果还给我」——
 * 客户端不需要 diff，也不需要知道该传哪些，把本地全量丢过来即可：
 * 记录不可变 + UUID 主键，重复上传是安全的。
 */
export async function POST(request: Request) {
  const caps = capabilities();
  if (!caps.server) {
    return NextResponse.json({ error: '这台部署没有开启云端同步' }, { status: 403 });
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { answers?: unknown } | null;
  const incoming = Array.isArray(body?.answers) ? body.answers.filter(isValidAnswer) : [];

  const result = await syncAnswers(user.id, incoming);
  return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } });
}
