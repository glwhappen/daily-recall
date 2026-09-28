import { NextResponse } from 'next/server';
import { capabilities } from '@/server/config';
import { getSessionUser } from '@/server/auth/session';
import { myBlocks, myVotes, setVote, type Vote } from '@/server/feedback';

export const dynamic = 'force-dynamic';

function parseVote(value: unknown): Vote | null | undefined {
  if (value === 'up' || value === 'down') return value;
  if (value === null) return null;
  return undefined;
}

/** 投票：up / down / null（删除投票） */
export async function POST(request: Request) {
  const caps = capabilities();
  if (!caps.feedback) {
    return NextResponse.json({ error: '这台部署没有开启题目反馈' }, { status: 403 });
  }
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    questionId?: string;
    vote?: unknown;
  } | null;

  const questionId = body?.questionId;
  const vote = parseVote(body?.vote);
  if (typeof questionId !== 'string' || !questionId || vote === undefined) {
    return NextResponse.json({ error: '参数不正确' }, { status: 400 });
  }

  await setVote(user.id, questionId, vote);

  // 把最新状态回给客户端，省一次往返；客户端会把它存到本地供离线抽题使用
  const [votes, blocks] = await Promise.all([myVotes(user.id), myBlocks(user.id)]);
  return NextResponse.json({ votes, blocks }, { headers: { 'cache-control': 'no-store' } });
}

/** 我的投票与屏蔽名单 */
export async function GET() {
  const caps = capabilities();
  if (!caps.feedback) {
    return NextResponse.json({ votes: {}, blocks: [] }, { headers: { 'cache-control': 'no-store' } });
  }
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const [votes, blocks] = await Promise.all([myVotes(user.id), myBlocks(user.id)]);
  return NextResponse.json({ votes, blocks }, { headers: { 'cache-control': 'no-store' } });
}
