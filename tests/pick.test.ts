import { describe, expect, it } from 'vitest';
import { buildCandidates, pickSession } from '../src/lib/pick';
import type { Answer, Question, QuestionBank } from '../src/lib/types';

const TODAY = new Date(2026, 8, 21); // 2026-09-21

function q(id: string, category: string, offsets: number[]): Question {
  return {
    id,
    category,
    type: 'fact',
    text: `{日期}${id}？`,
    offsets,
    options: [
      { value: '是', kind: 'fact' },
      { value: '不记得', kind: 'forgot' },
    ],
  };
}

function makeBank(): QuestionBank {
  return {
    version: 1,
    locale: 'zh-CN',
    categories: [
      { id: 'food', name: '吃' },
      { id: 'move', name: '行' },
      { id: 'anchor', name: '锚点' },
    ],
    questions: [
      q('food-1', 'food', [1, 2]),
      q('food-2', 'food', [1, 7]),
      q('move-1', 'move', [1, 2, 7]),
      q('move-2', 'move', [1]),
      q('anchor-1', 'anchor', [1, 7]),
    ],
  };
}

function answer(over: Partial<Answer>): Answer {
  return {
    id: over.id ?? 'a1',
    questionId: 'food-1',
    targetDate: '2026-09-20',
    offset: 1,
    value: '是',
    kind: 'fact',
    answeredAt: '2026-09-21T09:00:00Z',
    answeredOn: '2026-09-21',
    sessionId: 's1',
    ...over,
  };
}

/** 可复现的随机数发生器 */
function seededRng(seed: number) {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('候选池', () => {
  it('题目 × 它的每个偏移天数 = 一个候选', () => {
    const candidates = buildCandidates(makeBank(), TODAY, []);
    expect(candidates).toHaveLength(2 + 2 + 3 + 1 + 2);
  });

  it('候选的目标日期按偏移正确回推', () => {
    const candidates = buildCandidates(makeBank(), TODAY, []);
    const c = candidates.find((x) => x.question.id === 'move-1' && x.offset === 7);
    expect(c?.targetDate).toBe('2026-09-14');
  });

  it('完全相同的问法会被排除，不重复问', () => {
    const answers = [answer({ questionId: 'food-1', targetDate: '2026-09-20', offset: 1 })];
    const candidates = buildCandidates(makeBank(), TODAY, answers);
    expect(
      candidates.some(
        (c) => c.question.id === 'food-1' && c.targetDate === '2026-09-20' && c.offset === 1,
      ),
    ).toBe(false);
  });

  it('同一目标日期换一个偏移天数，仍然可以再问——这是漂移数据的来源', () => {
    // 9-21 问「昨天」= 9-20
    const day1 = new Date(2026, 8, 21);
    const first = buildCandidates(makeBank(), day1, []);
    expect(
      first.some(
        (c) => c.question.id === 'food-1' && c.targetDate === '2026-09-20' && c.offset === 1,
      ),
    ).toBe(true);

    // 答过之后，9-22 问「前天」——问的仍然是 9-20，只是隔得更远了
    const day2 = new Date(2026, 8, 22);
    const answers = [answer({ questionId: 'food-1', targetDate: '2026-09-20', offset: 1 })];
    const second = buildCandidates(makeBank(), day2, answers);
    const repeat = second.find(
      (c) => c.question.id === 'food-1' && c.targetDate === '2026-09-20' && c.offset === 2,
    );
    expect(repeat).toBeDefined();
    expect(repeat?.previousAsks).toBe(1);
  });

  it('同一天之内不会把同一个目标日期问两遍（偏移是绑在提问日上的）', () => {
    const candidates = buildCandidates(makeBank(), TODAY, []);
    const duplicates = candidates.filter(
      (c) => c.question.id === 'food-1' && c.targetDate === '2026-09-20',
    );
    expect(duplicates).toHaveLength(1);
  });

  it('不问「今天」——今天还没过完', () => {
    const bank = makeBank();
    bank.questions.push(q('food-today', 'food', [1]));
    const candidates = buildCandidates(bank, TODAY, []);
    expect(candidates.every((c) => c.targetDate !== '2026-09-21')).toBe(true);
  });
});

describe('组题', () => {
  it('返回请求的数量', () => {
    const candidates = buildCandidates(makeBank(), TODAY, []);
    expect(pickSession(candidates, 3, { rng: seededRng(1) })).toHaveLength(3);
  });

  it('一次会话里同一道题不会出现两次', () => {
    const candidates = buildCandidates(makeBank(), TODAY, []);
    const picked = pickSession(candidates, 5, { rng: seededRng(2) });
    const ids = picked.map((c) => c.question.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('候选不够时返回全部，不硬凑', () => {
    const candidates = buildCandidates(makeBank(), TODAY, []);
    expect(pickSession(candidates, 99, { rng: seededRng(3) }).length).toBeLessThanOrEqual(5);
  });

  it('优先包含锚点题', () => {
    const candidates = buildCandidates(makeBank(), TODAY, []);
    const picked = pickSession(candidates, 4, { rng: seededRng(4) });
    expect(picked.some((c) => c.question.category === 'anchor')).toBe(true);
  });

  it('不会全部来自同一类别', () => {
    const bank = makeBank();
    // 给 food 灌一批题，模拟类别不均衡
    for (let i = 0; i < 12; i += 1) bank.questions.push(q(`food-extra-${i}`, 'food', [1]));
    const candidates = buildCandidates(bank, TODAY, []);
    const picked = pickSession(candidates, 5, { rng: seededRng(5) });
    const categories = new Set(picked.map((c) => c.question.category));
    expect(categories.size).toBeGreaterThan(1);
  });

  it('复习题占比受 reviewRatio 限制', () => {
    const bank = makeBank();
    for (let i = 0; i < 8; i += 1) bank.questions.push(q(`food-extra-${i}`, 'food', [1, 2, 7]));
    const candidates = buildCandidates(bank, TODAY, []);

    // 把「昨天」那一批全部标记为已问过 → 它们变成复习题
    const repeated = candidates.map((c) =>
      c.offset === 1 ? { ...c, previousAsks: 2 } : { ...c, previousAsks: 0 },
    );
    const picked = pickSession(repeated, 10, { rng: seededRng(6), reviewRatio: 0.3 });
    const reviews = picked.filter((c) => c.previousAsks > 0);
    expect(reviews.length).toBeLessThanOrEqual(3);
  });

  it('exclude 里的题目不会再被选中', () => {
    const candidates = buildCandidates(makeBank(), TODAY, []);
    const picked = pickSession(candidates, 3, {
      rng: seededRng(7),
      exclude: new Set(['anchor-1', 'food-1']),
    });
    expect(picked.some((c) => ['anchor-1', 'food-1'].includes(c.question.id))).toBe(false);
  });
});
