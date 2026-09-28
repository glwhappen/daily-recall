import { NextResponse } from 'next/server';
import { publicCapabilities } from '@/server/config';
import { disabledQuestionIds } from '@/server/feedback';

/**
 * 前端启动时问一次：这台部署开了哪些能力。
 *
 * 顺便带上管理员下线的题目 id：抽题在客户端做，需要这份名单才能在本地过滤掉。
 * 这些信息都不敏感（题目本身是公开的），所以不需要登录。
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const caps = publicCapabilities();

  let disabled: string[] = [];
  if (caps.server) {
    try {
      disabled = await disabledQuestionIds();
    } catch (error) {
      // 迁移还没跑完或数据库暂时不可用：退化成「没有下线任何题」，不要让首页打不开
      console.error('[config] 读取下线题目失败：', error);
    }
  }

  return NextResponse.json(
    { ...caps, disabledQuestions: disabled },
    { headers: { 'cache-control': 'no-store' } },
  );
}
