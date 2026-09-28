import { query } from './db';
import type { Answer, OptionKind } from '@/lib/types';
import { mergeAnswers } from '@/lib/merge';

/**
 * 作答记录的读写。
 *
 * 写入一律 `on conflict (id) do nothing`：记录是不可变的，
 * 同一条记录重复上传（多端、重试）不应该报错，也不应该改写已有内容。
 */

interface AnswerRow {
  id: string;
  question_id: string;
  target_date: string;
  offset_days: number;
  value: string;
  kind: string;
  answered_at: string;
  answered_on: string;
  session_id: string;
  revision_of: string | null;
}

// date 用 to_char 转成字符串，避免 pg 把 DATE 解析成本地时区的 Date 对象再倒时差
const SELECT_COLUMNS = `
  id, question_id,
  to_char(target_date, 'YYYY-MM-DD') as target_date,
  offset_days, value, kind,
  to_char(answered_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as answered_at,
  to_char(answered_on, 'YYYY-MM-DD') as answered_on,
  session_id, revision_of
`;

export async function loadAnswers(userId: string): Promise<Answer[]> {
  const rows = await query<AnswerRow>(
    `select ${SELECT_COLUMNS} from answers where user_id = $1 order by answered_at asc`,
    [userId],
  );
  return rows.map(rowToAnswer);
}

const INSERT_COLUMNS = 11;

export async function insertAnswers(userId: string, answers: Answer[]): Promise<void> {
  if (answers.length === 0) return;

  const placeholders: string[] = [];
  const values: unknown[] = [];

  answers.forEach((answer, index) => {
    const base = index * INSERT_COLUMNS;
    placeholders.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6},` +
        ` $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11})`,
    );
    values.push(
      answer.id,
      userId,
      answer.questionId,
      answer.targetDate,
      answer.offset,
      answer.value,
      answer.kind,
      answer.answeredAt,
      answer.answeredOn,
      answer.sessionId,
      answer.revisionOf ?? null,
    );
  });

  await query(
    `insert into answers
       (id, user_id, question_id, target_date, offset_days, value, kind,
        answered_at, answered_on, session_id, revision_of)
     values ${placeholders.join(', ')}
     on conflict (id) do nothing`,
    values,
  );
}

export async function deleteAllAnswers(userId: string): Promise<void> {
  await query('delete from answers where user_id = $1', [userId]);
}

/**
 * 服务端合并一次上传。
 *
 * 复用与客户端同一个 mergeAnswers：两边跑的是同一段逻辑，
 * 不会出现「客户端以为传完了、服务端其实没收到」这类认知错位。
 */
export async function syncAnswers(
  userId: string,
  incoming: Answer[],
): Promise<{ answers: Answer[]; uploaded: number; conflicts: number }> {
  const existing = await loadAnswers(userId);
  const { merged, toUpload, conflicts } = mergeAnswers(incoming, existing);

  await insertAnswers(userId, toUpload);

  return { answers: merged, uploaded: toUpload.length, conflicts: conflicts.length };
}

const OPTION_KINDS = new Set<OptionKind>(['fact', 'recalled', 'forgot']);

/** 外部传来的记录必须逐字段校验，不能直接信 JSON */
export function isValidAnswer(value: unknown): value is Answer {
  if (!value || typeof value !== 'object') return false;
  const a = value as Record<string, unknown>;
  return (
    typeof a.id === 'string' &&
    a.id.length > 0 &&
    a.id.length <= 100 &&
    typeof a.questionId === 'string' &&
    a.questionId.length <= 100 &&
    typeof a.targetDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(a.targetDate) &&
    typeof a.answeredOn === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(a.answeredOn) &&
    Number.isInteger(a.offset) &&
    (a.offset as number) >= 0 &&
    typeof a.value === 'string' &&
    a.value.length <= 200 &&
    typeof a.kind === 'string' &&
    OPTION_KINDS.has(a.kind as OptionKind) &&
    typeof a.answeredAt === 'string' &&
    typeof a.sessionId === 'string' &&
    a.sessionId.length <= 100 &&
    (a.revisionOf === undefined || a.revisionOf === null || typeof a.revisionOf === 'string')
  );
}

function rowToAnswer(row: AnswerRow): Answer {
  return {
    id: row.id,
    questionId: row.question_id,
    targetDate: row.target_date,
    offset: row.offset_days,
    value: row.value,
    kind: row.kind as OptionKind,
    answeredAt: row.answered_at,
    answeredOn: row.answered_on,
    sessionId: row.session_id,
    ...(row.revision_of ? { revisionOf: row.revision_of } : {}),
  };
}
