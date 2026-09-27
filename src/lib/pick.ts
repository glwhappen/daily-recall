import { targetDateForOffset, toDateKey } from './date';
import type { Answer, Question, QuestionBank, Rng } from './types';

/** 一道「可以问」的题：题目 × 目标日期 × 偏移天数 */
export interface Candidate {
  question: Question;
  targetDate: string;
  offset: number;
  /**
   * 同一个目标日期此前被问过几次。
   * 0 = 全新的一天；> 0 = 复习机会（隔几天再问同一天，才能看出记忆漂移）。
   */
  previousAsks: number;
}

/**
 * 生成候选池。
 *
 * 注意去重键是 `题目 + 目标日期 + 偏移`，而不是 `题目 + 目标日期`：
 * 「9-20 出门了吗」在 9-21 和 9-22 各问一次是**有意设计**，不是重复。
 */
export function buildCandidates(
  bank: QuestionBank,
  today: Date,
  answers: Answer[],
): Candidate[] {
  const asked = new Set<string>();
  const askCount = new Map<string, number>();
  const todayKey = toDateKey(today);

  for (const a of answers) {
    asked.add(`${a.questionId}|${a.targetDate}|${a.offset}`);
    const key = `${a.questionId}|${a.targetDate}`;
    askCount.set(key, (askCount.get(key) ?? 0) + 1);
  }

  const out: Candidate[] = [];
  for (const question of bank.questions) {
    for (const offset of question.offsets) {
      const targetDate = targetDateForOffset(today, offset);
      if (targetDate === todayKey) continue; // 不问「今天」，今天还没过完
      if (asked.has(`${question.id}|${targetDate}|${offset}`)) continue;
      out.push({
        question,
        targetDate,
        offset,
        previousAsks: askCount.get(`${question.id}|${targetDate}`) ?? 0,
      });
    }
  }
  return out;
}

export interface PickOptions {
  rng?: Rng;
  /** 复习题（同一目标日期此前问过）最多占的比例 */
  reviewRatio?: number;
  /** 至少出几道锚点题 */
  minAnchor?: number;
  anchorCategory?: string;
  /** 本次会话已出过、不要再出现的题目 id */
  exclude?: Set<string>;
}

/** 组装一次练习。默认 5 题：锚点题勾记忆 + 新鲜题为主 + 少量复习题做校验。 */
export function pickSession(
  candidates: Candidate[],
  size: number,
  options: PickOptions = {},
): Candidate[] {
  const rng = options.rng ?? Math.random;
  const reviewRatio = options.reviewRatio ?? 0.3;
  const minAnchor = options.minAnchor ?? 1;
  const anchorCategory = options.anchorCategory ?? 'anchor';
  const exclude = options.exclude ?? new Set<string>();

  const available = candidates.filter((c) => !exclude.has(c.question.id));
  const freshPool = dedupeByQuestion(
    available.filter((c) => c.previousAsks === 0),
    rng,
  );
  const reviewPool = dedupeByQuestion(
    available.filter((c) => c.previousAsks > 0),
    rng,
  );

  const picked: Candidate[] = [];
  const take = (c: Candidate | undefined) => {
    if (!c || picked.length >= size) return;
    if (picked.some((p) => p.question.id === c.question.id)) return;
    picked.push(c);
  };

  // 1) 锚点题：不评价记忆力，但能把当天的其他记忆勾出来
  if (size >= 3 && minAnchor > 0) {
    for (const c of freshPool.filter((c) => c.question.category === anchorCategory).slice(0, minAnchor)) {
      take(c);
    }
  }

  // 2) 其余按类别轮转，避免一次全砸在同一类
  const rest = freshPool.filter((c) => !picked.some((p) => p.question.id === c.question.id));
  for (const c of roundRobinByCategory(rest, size - picked.length, rng, picked)) take(c);

  // 3) 复习题：同一目标日期隔几天再问，这是记忆漂移的数据来源
  const reviewQuota = Math.max(0, Math.floor(size * reviewRatio));
  for (const c of reviewPool.slice(0, reviewQuota)) take(c);

  // 4) 还不够（题库小或答得太快）就把剩余复习题补上
  if (picked.length < size) {
    for (const c of reviewPool) {
      if (picked.length >= size) break;
      take(c);
    }
  }

  return picked.slice(0, size);
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 同一道题一次会话只出现一次；它有多个候选日期时随机挑一个 */
function dedupeByQuestion(candidates: Candidate[], rng: Rng): Candidate[] {
  const groups = new Map<string, Candidate[]>();
  for (const c of candidates) {
    const list = groups.get(c.question.id) ?? [];
    list.push(c);
    groups.set(c.question.id, list);
  }
  return shuffle(
    [...groups.values()].map((list) => list[Math.floor(rng() * list.length)]),
    rng,
  );
}

/** 按类别轮流取题，类别用得少的优先 */
function roundRobinByCategory(
  pool: Candidate[],
  limit: number,
  rng: Rng,
  alreadyPicked: Candidate[],
): Candidate[] {
  if (limit <= 0) return [];

  const counts = new Map<string, number>();
  for (const c of alreadyPicked) {
    counts.set(c.question.category, (counts.get(c.question.category) ?? 0) + 1);
  }

  const buckets = new Map<string, Candidate[]>();
  for (const c of pool) {
    const list = buckets.get(c.question.category) ?? [];
    list.push(c);
    buckets.set(c.question.category, list);
  }
  const order = shuffle([...buckets.keys()], rng);
  for (const key of order) buckets.set(key, shuffle(buckets.get(key) ?? [], rng));

  const cursor = new Map<string, number>(order.map((k) => [k, 0]));
  const out: Candidate[] = [];
  while (out.length < limit) {
    let progressed = false;
    const byLeastUsed = [...order].sort((a, b) => (counts.get(a) ?? 0) - (counts.get(b) ?? 0));
    for (const key of byLeastUsed) {
      if (out.length >= limit) break;
      const i = cursor.get(key) ?? 0;
      const list = buckets.get(key) ?? [];
      if (i >= list.length) continue;
      cursor.set(key, i + 1);
      out.push(list[i]);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      progressed = true;
    }
    if (!progressed) break;
  }
  return out;
}
