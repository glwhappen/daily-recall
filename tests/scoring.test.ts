import { describe, expect, it } from 'vitest';
import {
  answersOnDate,
  answersWithinDays,
  bandOf,
  coverageByBand,
  currentStreak,
  offsetWeight,
  summarize,
} from '../src/lib/scoring';
import type { Answer, OptionKind } from '../src/lib/types';

let n = 0;
function mk(kind: OptionKind, offset: number, answeredOn = '2026-09-21'): Answer {
  n += 1;
  return {
    id: `a${n}`,
    questionId: `q${n}`,
    targetDate: '2026-09-20',
    offset,
    value: kind === 'forgot' ? '不记得' : '是',
    kind,
    answeredAt: `${answeredOn}T09:00:00Z`,
    answeredOn,
    sessionId: 's1',
  };
}

describe('评分', () => {
  it('偏移越远，权重越高', () => {
    expect(offsetWeight(1)).toBeLessThan(offsetWeight(2));
    expect(offsetWeight(2)).toBeLessThan(offsetWeight(5));
    expect(offsetWeight(5)).toBeLessThan(offsetWeight(10));
    expect(offsetWeight(10)).toBeLessThan(offsetWeight(30));
  });

  it('空输入不炸', () => {
    const sum = summarize([]);
    expect(sum.total).toBe(0);
    expect(sum.coverage).toBe(0);
    expect(sum.weightedCoverage).toBe(0);
  });

  it('覆盖率 = 记得的题数 / 总题数', () => {
    const sum = summarize([mk('fact', 1), mk('fact', 1), mk('forgot', 1), mk('forgot', 1)]);
    expect(sum.total).toBe(4);
    expect(sum.recalled).toBe(2);
    expect(sum.forgot).toBe(2);
    expect(sum.coverage).toBe(0.5);
  });

  it('远期记得比近期记得更值钱（加权只在混合偏移时才有区分度）', () => {
    // 记住远期、忘了近期
    const keptFar = summarize([mk('fact', 30), mk('forgot', 1)]);
    // 记住近期、忘了远期
    const keptNear = summarize([mk('forgot', 30), mk('fact', 1)]);
    expect(keptFar.coverage).toBe(keptNear.coverage);
    expect(keptFar.weightedCoverage).toBeGreaterThan(keptNear.weightedCoverage);
  });

  it('全都记得时，任何偏移都是 100%——覆盖率是比例而不是分数', () => {
    expect(summarize([mk('fact', 1)]).weightedCoverage).toBe(1);
    expect(summarize([mk('fact', 30)]).weightedCoverage).toBe(1);
  });

  it('分档覆盖率把近期与远期分开看', () => {
    const bands = coverageByBand([mk('fact', 1), mk('forgot', 1), mk('fact', 30)]);
    expect(bands.near.total).toBe(2);
    expect(bands.near.coverage).toBe(0.5);
    expect(bands.mid.total).toBe(0);
    expect(bands.far.total).toBe(1);
    expect(bands.far.coverage).toBe(1);
  });

  it('分档边界：≤2 天为近，≤7 天为中，更久为远', () => {
    expect(bandOf(1)).toBe('near');
    expect(bandOf(2)).toBe('near');
    expect(bandOf(3)).toBe('mid');
    expect(bandOf(7)).toBe('mid');
    expect(bandOf(14)).toBe('far');
  });

  it('区分事实记录与自评检查', () => {
    const sum = summarize([mk('fact', 1), mk('recalled', 1), mk('forgot', 1)]);
    expect(sum.factRecords).toBe(1);
    expect(sum.recallChecks).toBe(1);
    expect(sum.daysCovered).toBe(1);
  });

  it('按作答当天筛选', () => {
    const answers = [mk('fact', 1, '2026-09-21'), mk('fact', 1, '2026-09-20')];
    expect(answersOnDate(answers, '2026-09-21')).toHaveLength(1);
    expect(answersWithinDays(answers, new Date(2026, 8, 21), 2)).toHaveLength(2);
    expect(answersWithinDays(answers, new Date(2026, 8, 21), 1)).toHaveLength(1);
  });

  it('连续天数从今天往回数', () => {
    const answers = [mk('fact', 1, '2026-09-21'), mk('fact', 2, '2026-09-20'), mk('fact', 3, '2026-09-18')];
    expect(currentStreak(answers, '2026-09-21')).toBe(2);
    expect(currentStreak(answers, '2026-09-20')).toBe(1);
    expect(currentStreak(answers, '2026-09-19')).toBe(0);
    expect(currentStreak(answers, '2026-09-18')).toBe(1);
  });
});
