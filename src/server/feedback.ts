import { query } from './db';
import { withTransaction } from './migrate';

/**
 * 题目反馈：一人一题一票（赞或踩）。
 *
 * 点踩会同时把这道题加进个人屏蔽名单——用户表达的是「别再问我这个」，
 * 而不是「这个题对所有人都不好」。两者是分开的：
 * 屏蔽只影响他自己，下线题目要管理员在后台做。
 */

export type Vote = 'up' | 'down';

export interface QuestionStats {
  questionId: string;
  up: number;
  down: number;
  /** 有多少人把这道题拉黑了 */
  blocks: number;
}

export async function setVote(
  userId: string,
  questionId: string,
  vote: Vote | null,
): Promise<void> {
  await withTransaction(async (client) => {
    if (vote === null) {
      await client.query(
        'delete from question_feedback where user_id = $1 and question_id = $2',
        [userId, questionId],
      );
    } else {
      await client.query(
        `insert into question_feedback (user_id, question_id, vote)
         values ($1, $2, $3)
         on conflict (user_id, question_id)
         do update set vote = excluded.vote, created_at = now()`,
        [userId, questionId, vote],
      );
    }

    // 屏蔽名单跟着票走：点踩即屏蔽，取消或改成点赞就解除
    if (vote === 'down') {
      await client.query(
        `insert into question_blocks (user_id, question_id) values ($1, $2)
         on conflict (user_id, question_id) do nothing`,
        [userId, questionId],
      );
    } else {
      await client.query('delete from question_blocks where user_id = $1 and question_id = $2', [
        userId,
        questionId,
      ]);
    }
  });
}

export async function myVotes(userId: string): Promise<Record<string, Vote>> {
  const rows = await query<{ question_id: string; vote: Vote }>(
    'select question_id, vote from question_feedback where user_id = $1',
    [userId],
  );
  return Object.fromEntries(rows.map((r) => [r.question_id, r.vote]));
}

export async function myBlocks(userId: string): Promise<string[]> {
  const rows = await query<{ question_id: string }>(
    'select question_id from question_blocks where user_id = $1 order by created_at asc',
    [userId],
  );
  return rows.map((r) => r.question_id);
}

/** 每道题的票数。后台按点踩率排序用 */
export async function questionStats(): Promise<QuestionStats[]> {
  const votes = await query<{ question_id: string; up: string; down: string }>(
    `select question_id,
            count(*) filter (where vote = 'up')   as up,
            count(*) filter (where vote = 'down') as down
       from question_feedback
      group by question_id`,
  );

  const blocks = await query<{ question_id: string; blocks: string }>(
    'select question_id, count(*) as blocks from question_blocks group by question_id',
  );
  const blocksById = new Map(blocks.map((b) => [b.question_id, Number(b.blocks)]));

  return votes.map((v) => ({
    questionId: v.question_id,
    up: Number(v.up),
    down: Number(v.down),
    blocks: blocksById.get(v.question_id) ?? 0,
  }));
}

export async function disabledQuestionIds(): Promise<string[]> {
  const rows = await query<{ question_id: string }>(
    'select question_id from disabled_questions order by created_at asc',
  );
  return rows.map((r) => r.question_id);
}

/**
 * 管理员下线/恢复题目。
 *
 * 记在数据库而不是改 questions/*.yaml：那是 Git 管理的唯一事实源，
 * 容器里也只读；改了会在下次部署时丢掉，而且和仓库版本对不上。
 * 后台另有「导出补丁」，方便把这里的决定同步回仓库。
 */
export async function setQuestionDisabled(
  questionId: string,
  adminUserId: string | null,
  disabled: boolean,
  reason?: string | null,
): Promise<void> {
  if (disabled) {
    await query(
      `insert into disabled_questions (question_id, disabled_by, reason)
       values ($1, $2, $3)
       on conflict (question_id) do update set disabled_by = excluded.disabled_by,
                                              reason = excluded.reason`,
      [questionId, adminUserId, reason ?? null],
    );
  } else {
    await query('delete from disabled_questions where question_id = $1', [questionId]);
  }
}
