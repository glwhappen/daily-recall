import type { Answer } from './types';

/**
 * 跨天一致性检测 —— 这是本项目区别于普通刷题 App 的地方。
 *
 * 同一个目标日期（比如 9-20）会在不同时间被问到多次，
 * 时间一长，「第一次答什么、后来答什么」本身就是数据。
 */
export type DriftKind =
  /** 两条事实答案互相矛盾：事实只有一个，必有一错 */
  | 'conflict'
  /** 之前记得、后来忘了：正常遗忘，画进遗忘曲线而不是报警 */
  | 'decay'
  /** 之前忘了、后来反而记得：最可疑，通常是虚构或混淆（把别的事记成了那天） */
  | 'upgrade'
  /** 答案一致，这条记忆经得起复查 */
  | 'agree';

export interface DriftGroup {
  questionId: string;
  targetDate: string;
  /** 按作答时间升序 */
  answers: Answer[];
  /** 只看原始作答（不含复核记录）得出的结论 */
  kind: DriftKind;
  /** 用户已做过一次复核 */
  resolved: boolean;
}

/**
 * 按 (题目, 目标日期) 聚合，找出所有被问过多次的记忆。
 *
 * 设计约定：`kind` 只从**原始作答**（没有 revisionOf 的记录）推导，
 * 复核记录代表用户的最终裁定，不参与记忆表现的统计，
 * 这样「用户改答案」不会抹掉「他第一次答错了」这个最有价值的信号。
 */
export function detectDrift(answers: Answer[]): DriftGroup[] {
  const groups = new Map<string, Answer[]>();
  for (const a of answers) {
    const key = `${a.questionId}|${a.targetDate}`;
    const list = groups.get(key) ?? [];
    list.push(a);
    groups.set(key, list);
  }

  const out: DriftGroup[] = [];
  for (const [key, list] of groups) {
    const sorted = [...list].sort((a, b) => a.answeredAt.localeCompare(b.answeredAt));
    const primary = sorted.filter((a) => !a.revisionOf);
    if (primary.length < 2) continue;

    const [questionId, targetDate] = key.split('|');
    out.push({
      questionId,
      targetDate,
      answers: sorted,
      kind: classify(primary[0], primary[primary.length - 1]),
      resolved: sorted.some((a) => a.revisionOf),
    });
  }

  // 值得注意的排前面：升级 > 矛盾 > 遗忘 > 一致
  const order: Record<DriftKind, number> = { upgrade: 0, conflict: 1, decay: 2, agree: 3 };
  return out.sort((a, b) => order[a.kind] - order[b.kind] || a.targetDate.localeCompare(b.targetDate));
}

function classify(first: Answer, last: Answer): DriftKind {
  if (first.kind === 'forgot' && last.kind !== 'forgot') return 'upgrade';
  if (first.kind !== 'forgot' && last.kind === 'forgot') return 'decay';
  if (first.kind !== 'forgot' && last.kind !== 'forgot' && first.value !== last.value) {
    return 'conflict';
  }
  return 'agree';
}

/** 只挑出需要用户处理的：矛盾与可疑的「越久越清晰」 */
export function openIssues(groups: DriftGroup[]): DriftGroup[] {
  return groups.filter((g) => !g.resolved && (g.kind === 'conflict' || g.kind === 'upgrade'));
}
