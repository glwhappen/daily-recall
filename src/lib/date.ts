/**
 * 日期锚定。
 *
 * 核心概念：题目不写死「昨天」，而是记录**被问的是哪一天**（targetDate）。
 * 于是「9-20 出门了吗」可以在 9-21（昨天）、9-22（前天）、9-27（一周前）
 * 各被问一次，答案不一致时就有了记忆漂移的证据。
 *
 * 所有函数都显式接收 `today`，不读系统时钟，方便测试。
 */

/** 本地时区的 YYYY-MM-DD */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 按本地时区解析 YYYY-MM-DD（避免 `new Date('2026-09-20')` 被当 UTC 处理） */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** 距今 `offset` 天的那一天 */
export function targetDateForOffset(today: Date, offset: number): string {
  return toDateKey(addDays(today, -offset));
}

/** targetDate 距 today 多少天（today 当天为 0） */
export function offsetBetween(today: Date, targetDate: string): number {
  const diff =
    parseDateKey(toDateKey(today)).getTime() - parseDateKey(targetDate).getTime();
  return Math.round(diff / 86_400_000);
}

/** 近 N 天的日期键，从最早到最近 */
export function recentDateKeys(today: Date, days: number): string[] {
  return Array.from({ length: days }, (_, i) =>
    targetDateForOffset(today, days - 1 - i),
  );
}

const ZH_LABELS: Record<number, string> = {
  1: '昨天',
  2: '前天',
  3: '三天前',
  7: '一周前',
  14: '两周前',
  30: '一个月前',
};

const EN_LABELS: Record<number, string> = {
  1: 'yesterday',
  2: 'the day before yesterday',
  3: 'three days ago',
  7: 'a week ago',
  14: 'two weeks ago',
  30: 'a month ago',
};

/** 把偏移天数渲染成人话 */
export function dateLabel(offset: number, locale = 'zh-CN'): string {
  const table = locale.startsWith('en') ? EN_LABELS : ZH_LABELS;
  if (table[offset]) return table[offset];
  return locale.startsWith('en') ? `${offset} days ago` : `${offset}天前`;
}

/** 渲染题干：把 `{日期}` 换成「昨天」这类说法 */
export function renderText(text: string, offset: number, locale = 'zh-CN'): string {
  return text.replaceAll('{日期}', dateLabel(offset, locale));
}

/** 把具体日期渲染成「9月20日」/「9/20」，用于跨天校验里指认是哪一天 */
export function formatDay(dateKey: string, locale = 'zh-CN'): string {
  const [, m, d] = dateKey.split('-').map(Number);
  return locale.startsWith('en') ? `${m}/${d}` : `${m}月${d}日`;
}

/** 把 `{日期}` 换成具体日期（而非「昨天」） */
export function renderWithDay(text: string, dateKey: string, locale = 'zh-CN'): string {
  return text.replaceAll('{日期}', formatDay(dateKey, locale));
}
