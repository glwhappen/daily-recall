import { describe, expect, it } from 'vitest';
import {
  addDays,
  dateLabel,
  formatDay,
  offsetBetween,
  parseDateKey,
  recentDateKeys,
  renderText,
  renderWithDay,
  targetDateForOffset,
  toDateKey,
} from '../src/lib/date';

describe('日期锚定', () => {
  it('toDateKey / parseDateKey 往返一致，且不受 UTC 影响', () => {
    const d = new Date(2026, 8, 20, 23, 30); // 本地时间 2026-09-20 23:30
    expect(toDateKey(d)).toBe('2026-09-20');
    expect(toDateKey(parseDateKey('2026-09-20'))).toBe('2026-09-20');
  });

  it('当天 00:05 与 23:55 落在同一个日期键上', () => {
    expect(toDateKey(new Date(2026, 8, 20, 0, 5))).toBe('2026-09-20');
    expect(toDateKey(new Date(2026, 8, 20, 23, 55))).toBe('2026-09-20');
  });

  it('目标日期是「今天减去偏移」', () => {
    const today = new Date(2026, 8, 21);
    expect(targetDateForOffset(today, 1)).toBe('2026-09-20');
    expect(targetDateForOffset(today, 2)).toBe('2026-09-19');
    expect(targetDateForOffset(today, 30)).toBe('2026-08-22');
  });

  it('跨月、跨年都不出错', () => {
    expect(targetDateForOffset(new Date(2026, 2, 1), 1)).toBe('2026-02-28');
    expect(targetDateForOffset(new Date(2026, 0, 1), 1)).toBe('2025-12-31');
    expect(addDays(new Date(2024, 1, 28), 1)).toBeInstanceOf(Date);
  });

  it('offsetBetween 是 targetDateForOffset 的逆运算', () => {
    const today = new Date(2026, 8, 21);
    for (const offset of [1, 2, 7, 14, 30]) {
      expect(offsetBetween(today, targetDateForOffset(today, offset))).toBe(offset);
    }
  });

  it('dateLabel 使用人话', () => {
    expect(dateLabel(1)).toBe('昨天');
    expect(dateLabel(2)).toBe('前天');
    expect(dateLabel(7)).toBe('一周前');
    expect(dateLabel(5)).toBe('5天前');
    expect(dateLabel(1, 'en')).toBe('yesterday');
    expect(dateLabel(5, 'en')).toBe('5 days ago');
  });

  it('renderText 替换 {日期} 占位符', () => {
    expect(renderText('{日期}出门了吗？', 1)).toBe('昨天出门了吗？');
    expect(renderText('{日期}出门了吗？', 2)).toBe('前天出门了吗？');
    expect(renderWithDay('{日期}出门了吗？', '2026-09-20')).toBe('9月20日出门了吗？');
    expect(formatDay('2026-09-20', 'en')).toBe('9/20');
  });

  it('recentDateKeys 从最早到最近', () => {
    expect(recentDateKeys(new Date(2026, 8, 21), 3)).toEqual([
      '2026-09-19',
      '2026-09-20',
      '2026-09-21',
    ]);
  });
});
