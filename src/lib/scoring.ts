import { addDays, parseDateKey, toDateKey } from './date';
import type { Answer } from './types';

/**
 * 偏移权重：越久远还记得，说明记忆越牢，得分越高。
 * 这是「回忆覆盖率」不能简单等同于正确率的原因——10 题全对不该和 5 题全对同分。
 */
export function offsetWeight(offset: number): number {
  if (offset <= 1) return 1;
  if (offset <= 2) return 1.2;
  if (offset <= 6) return 1.5;
  if (offset <= 13) return 1.8;
  return 2.2;
}

export interface ScoreSummary {
  /** 作答总数 */
  total: number;
  /** 记得的题数（选了任何非 forgot 的选项） */
  recalled: number;
  /** 想不起来的题数 */
  forgot: number;
  /** 回忆覆盖率 = recalled / total */
  coverage: number;
  /**
   * 加权覆盖率：远期记得权重更高。
   *
   * 注意它是**比例**，所以「全部记得」在任何偏移下都是 100%。
   * 只有在不同偏移混在一起时才有区分度（记住远期、忘了近期 → 分数更高）。
   * 想看「近期 vs 远期」的真实差异，用 `coverageByBand()`。
   */
  weightedCoverage: number;
  /** fact 型作答数 —— 这部分数据积累久了就是一份自动日记 */
  factRecords: number;
  /** recall 型作答数 */
  recallChecks: number;
  /** 有作答的不同目标日期数 */
  daysCovered: number;
}

const EMPTY: ScoreSummary = {
  total: 0,
  recalled: 0,
  forgot: 0,
  coverage: 0,
  weightedCoverage: 0,
  factRecords: 0,
  recallChecks: 0,
  daysCovered: 0,
};

export function summarize(answers: Answer[]): ScoreSummary {
  if (answers.length === 0) return { ...EMPTY };

  let recalled = 0;
  let forgot = 0;
  let weightSum = 0;
  let weightedRecalled = 0;
  const days = new Set<string>();

  for (const a of answers) {
    days.add(a.targetDate);
    const w = offsetWeight(a.offset);
    weightSum += w;
    if (a.kind === 'forgot') {
      forgot += 1;
    } else {
      recalled += 1;
      weightedRecalled += w;
    }
  }

  return {
    total: answers.length,
    recalled,
    forgot,
    coverage: recalled / answers.length,
    weightedCoverage: weightSum === 0 ? 0 : weightedRecalled / weightSum,
    factRecords: answers.filter((a) => a.kind === 'fact').length,
    recallChecks: answers.filter((a) => a.kind === 'recalled').length,
    daysCovered: days.size,
  };
}

export type OffsetBand = 'near' | 'mid' | 'far';

/** 把偏移天数分成三档。近期与远期混在一起平均，会掩盖真正的差别。 */
export function bandOf(offset: number): OffsetBand {
  if (offset <= 2) return 'near';
  if (offset <= 7) return 'mid';
  return 'far';
}

/**
 * 按回忆距离分档统计。
 *
 * 这是比总覆盖率更有诊断价值的指标：一个人可能「昨天的事几乎全记得、
 * 一周以上的事几乎全忘」——只看总数会把这个特征完全抹平。
 */
export function coverageByBand(answers: Answer[]): Record<OffsetBand, ScoreSummary> {
  const buckets: Record<OffsetBand, Answer[]> = { near: [], mid: [], far: [] };
  for (const answer of answers) buckets[bandOf(answer.offset)].push(answer);
  return {
    near: summarize(buckets.near),
    mid: summarize(buckets.mid),
    far: summarize(buckets.far),
  };
}

/** 只统计某一天（本地时区键）的作答 */
export function answersOnDate(answers: Answer[], dateKey: string): Answer[] {
  return answers.filter((a) => a.answeredOn === dateKey);
}

/** 作答落在某一天，且该天距今不超过 `days` 天 */
export function answersWithinDays(answers: Answer[], today: Date, days: number): Answer[] {
  const todayKey = toDateKey(today);
  const from = toDateKey(addDays(today, -(days - 1)));
  return answers.filter((a) => a.answeredOn >= from && a.answeredOn <= todayKey);
}

/** 连续练习的天数（含今天） */
export function currentStreak(answers: Answer[], todayKey: string): number {
  const days = new Set(answers.map((a) => a.answeredOn));
  let streak = 0;
  let cursor = parseDateKey(todayKey);
  while (days.has(toDateKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
