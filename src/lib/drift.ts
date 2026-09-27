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
    // 拿「问得最近」和「问得最远」的两次来比。
    // 记忆表现只有在间隔单调拉远时才可比：隔一天后想起来是正常的回忆恢复，
    // 不比「一周后还想得起来」更有信息量。按作答时间顺序比会把这个搞反。
    const nearest = primary.reduce((a, b) => (b.offset < a.offset ? b : a));
    const farthest = primary.reduce((a, b) => (b.offset > a.offset ? b : a));

    const kind = classify(nearest, farthest);
    if (kind === null) continue; // 没有信息量的比较不入列表

    out.push({
      questionId,
      targetDate,
      answers: sorted,
      kind,
      resolved: sorted.some((a) => a.revisionOf),
    });
  }

  // 值得注意的排前面：升级 > 矛盾 > 遗忘 > 一致
  const order: Record<DriftKind, number> = { upgrade: 0, conflict: 1, decay: 2, agree: 3 };
  return out.sort((a, b) => order[a.kind] - order[b.kind] || a.targetDate.localeCompare(b.targetDate));
}

/**
 * 判定「越久反而越清晰」所需的**距离差**。
 *
 * 看的是两次提问之间拉远了几天，而不是最远那次有多远：
 * 「昨天」和「前天」问同一天只差一天，回忆有波动很正常，
 * 把它当成「虚构」太武断，而且会拿一堆噪声去打扰用户。
 * 要报给用户的判断，门槛就高一点。
 */
const MIN_OFFSET_GAP = 2;

/**
 * 比较两次作答。
 *
 * `near` 是问得最近的那次，`far` 是问得最远的那次（偏移更大）。
 * 参数顺序不能换：换「忘了」和「记得」的方向就反了。
 *
 * 返回 `null` 表示这条比较没有信息量，不应该展示给用户。
 */
function classify(near: Answer, far: Answer): DriftKind | null {
  if (near.id === far.id) return null;

  // 事实矛盾优先：同一天只有一种事实，两个不同的值必有一错
  const bothConcrete = near.kind !== 'forgot' && far.kind !== 'forgot';
  if (bothConcrete && near.value !== far.value) return 'conflict';

  // 问得更远之后还记得 → 可疑（通常是虚构或混淆），但距离得真拉开
  if (near.kind === 'forgot' && far.kind !== 'forgot') {
    return far.offset - near.offset >= MIN_OFFSET_GAP ? 'upgrade' : null;
  }
  // 问得更远之后忘了 → 正常遗忘。
  // 这里不再加距离门槛：遗忘曲线宁可宽一点，多收数据比少收好。
  if (near.kind !== 'forgot' && far.kind === 'forgot') return 'decay';
  return 'agree';
}

/** 只挑出需要用户处理的：矛盾与可疑的「越久越清晰」 */
export function openIssues(groups: DriftGroup[]): DriftGroup[] {
  return groups.filter((g) => !g.resolved && (g.kind === 'conflict' || g.kind === 'upgrade'));
}
