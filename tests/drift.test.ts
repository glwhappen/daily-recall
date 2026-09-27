import { describe, expect, it } from 'vitest';
import { detectDrift, openIssues } from '../src/lib/drift';
import type { Answer } from '../src/lib/types';

let counter = 0;
function mk(over: Partial<Answer>): Answer {
  counter += 1;
  return {
    id: `a${counter}`,
    questionId: 'move-went-out',
    targetDate: '2026-09-20',
    offset: 1,
    value: '出门了',
    kind: 'fact',
    answeredAt: `2026-09-21T09:00:0${counter}Z`,
    answeredOn: '2026-09-21',
    sessionId: 's1',
    ...over,
  };
}

describe('跨天一致性检测', () => {
  it('同一天只问过一次时不产生任何结论', () => {
    expect(detectDrift([mk({})])).toEqual([]);
  });

  it('两条不同的事实答案 = conflict', () => {
    const groups = detectDrift([
      mk({ value: '出门了', offset: 1, answeredAt: '2026-09-21T09:00:00Z' }),
      mk({ value: '没出门', offset: 2, answeredAt: '2026-09-22T09:00:00Z', answeredOn: '2026-09-22' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe('conflict');
  });

  it('记得 → 忘了 = decay（正常遗忘，不算矛盾）', () => {
    const groups = detectDrift([
      mk({ value: '记得', kind: 'recalled', offset: 1, answeredAt: '2026-09-21T09:00:00Z' }),
      mk({ value: '想不起来', kind: 'forgot', offset: 7, answeredAt: '2026-09-27T09:00:00Z', answeredOn: '2026-09-27' }),
    ]);
    expect(groups[0].kind).toBe('decay');
  });

  it('忘了 → 记得 = upgrade（越久反而越清楚，最可疑）', () => {
    const groups = detectDrift([
      mk({ value: '想不起来', kind: 'forgot', offset: 1, answeredAt: '2026-09-21T09:00:00Z' }),
      mk({ value: '记得', kind: 'recalled', offset: 7, answeredAt: '2026-09-27T09:00:00Z', answeredOn: '2026-09-27' }),
    ]);
    expect(groups[0].kind).toBe('upgrade');
  });

  it('答案一致 = agree', () => {
    const groups = detectDrift([
      mk({ value: '出门了', offset: 1, answeredAt: '2026-09-21T09:00:00Z' }),
      mk({ value: '出门了', offset: 2, answeredAt: '2026-09-22T09:00:00Z', answeredOn: '2026-09-22' }),
    ]);
    expect(groups[0].kind).toBe('agree');
  });

  it('不同目标日期互不干扰', () => {
    const groups = detectDrift([
      mk({ targetDate: '2026-09-20', value: '出门了' }),
      mk({ targetDate: '2026-09-19', value: '没出门' }),
    ]);
    expect(groups).toEqual([]);
  });

  it('复核记录标记 resolved，但不改变 kind', () => {
    const first = mk({ value: '出门了', offset: 1, answeredAt: '2026-09-21T09:00:00Z' });
    const second = mk({
      value: '没出门',
      offset: 2,
      answeredAt: '2026-09-22T09:00:00Z',
      answeredOn: '2026-09-22',
    });
    const revision = mk({
      value: '出门了',
      offset: 1,
      answeredAt: '2026-09-23T09:00:00Z',
      answeredOn: '2026-09-23',
      revisionOf: first.id,
    });

    const groups = detectDrift([first, second, revision]);
    expect(groups[0].kind).toBe('conflict');
    expect(groups[0].resolved).toBe(true);
    // 用户改过答案，但「他第一次答错了」依然被保留
    expect(groups[0].answers).toHaveLength(3);
  });

  it('用「问得最近」与「问得最远」的两次来比，而不是按作答时间取首末', () => {
    // 人为乱序（导入或合并数据时可能出现）：偏移大的反而先答
    const groups = detectDrift([
      mk({ id: 'x1', value: '出门了', offset: 7, answeredAt: '2026-09-27T09:00:00Z' }),
      mk({ id: 'x2', value: '没出门', offset: 2, answeredAt: '2026-09-22T09:00:00Z' }),
    ]);
    // 最近（offset 2）说没出门，最远（offset 7）说出门了 → 事实矛盾
    expect(groups[0].kind).toBe('conflict');
  });

  it('间隔拉远后才忘，才算正常遗忘', () => {
    const groups = detectDrift([
      mk({ id: 'y1', value: '记得', kind: 'recalled', offset: 1, answeredAt: '2026-09-21T09:00:00Z' }),
      mk({ id: 'y2', value: '想不起来', kind: 'forgot', offset: 2, answeredAt: '2026-09-22T09:00:00Z' }),
    ]);
    expect(groups[0].kind).toBe('decay');
  });

  it('偏移相同时无法比较，不入列表（记忆表现要有距离差才可比）', () => {
    const groups = detectDrift([
      mk({ id: 'z1', value: '想不起来', kind: 'forgot', offset: 1, answeredAt: '2026-09-21T09:00:00Z' }),
      mk({ id: 'z2', value: '记得', kind: 'recalled', offset: 1, answeredAt: '2026-09-22T09:00:00Z' }),
    ]);
    expect(groups).toHaveLength(0);
  });

  it('只隔一天时想起来不算可疑（1–2 天之间回忆有波动很正常）', () => {
    const groups = detectDrift([
      mk({ id: 'w1', value: '想不起来', kind: 'forgot', offset: 1, answeredAt: '2026-09-21T09:00:00Z' }),
      mk({ id: 'w2', value: '记得', kind: 'recalled', offset: 2, answeredAt: '2026-09-22T09:00:00Z' }),
    ]);
    expect(groups).toHaveLength(0);
  });

  it('距离拉开到 2 天以上时，想起来才算可疑', () => {
    const groups = detectDrift([
      mk({ id: 'v1', value: '想不起来', kind: 'forgot', offset: 1, answeredAt: '2026-09-21T09:00:00Z' }),
      mk({ id: 'v2', value: '记得', kind: 'recalled', offset: 3, answeredAt: '2026-09-23T09:00:00Z' }),
    ]);
    expect(groups[0].kind).toBe('upgrade');
  });

  it('openIssues 只挑出需要用户处理的：矛盾与「越久越清晰」', () => {
    const conflict = [
      mk({ value: '出门了', offset: 1, answeredAt: '2026-09-21T09:00:00Z' }),
      mk({ value: '没出门', offset: 2, answeredAt: '2026-09-22T09:00:00Z' }),
    ];
    const decay = [
      mk({ id: 'b1', questionId: 'food-lunch-recall', value: '记得', kind: 'recalled', answeredAt: '2026-09-21T09:00:00Z' }),
      mk({ id: 'b2', questionId: 'food-lunch-recall', value: '想不起来', kind: 'forgot', answeredAt: '2026-09-22T09:00:00Z' }),
    ];
    expect(openIssues(detectDrift([...conflict, ...decay]))).toHaveLength(1);
  });

  it('结果按「需要关注的程度」排序：upgrade 在最前', () => {
    const groups = detectDrift([
      mk({ value: '出门了', offset: 1, answeredAt: '2026-09-21T09:00:00Z' }),
      mk({ value: '没出门', offset: 2, answeredAt: '2026-09-22T09:00:00Z' }),
      mk({ id: 'c1', questionId: 'anchor-rain', value: '想不起来', kind: 'forgot', offset: 1, answeredAt: '2026-09-21T09:00:00Z' }),
      mk({ id: 'c2', questionId: 'anchor-rain', value: '记得', kind: 'recalled', offset: 7, answeredAt: '2026-09-27T09:00:00Z' }),
    ]);
    expect(groups[0].kind).toBe('upgrade');
  });
});
