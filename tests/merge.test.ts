import { describe, expect, it } from 'vitest';
import { mergeAnswers } from '../src/lib/merge';
import type { Answer } from '../src/lib/types';

let n = 0;
function mk(over: Partial<Answer> = {}): Answer {
  n += 1;
  return {
    id: over.id ?? `a${n}`,
    questionId: 'move-went-out',
    targetDate: '2026-09-20',
    offset: 1,
    value: '出门了',
    kind: 'fact',
    answeredAt: `2026-09-21T09:00:${String(n).padStart(2, '0')}Z`,
    answeredOn: '2026-09-21',
    sessionId: 's1',
    ...over,
  };
}

describe('多端合并', () => {
  it('两边都空时结果为空', () => {
    const result = mergeAnswers([], []);
    expect(result.merged).toHaveLength(0);
    expect(result.toUpload).toHaveLength(0);
    expect(result.toDownload).toHaveLength(0);
  });

  it('首次登录：本地记录全部需要上传', () => {
    const local = [mk({ id: 'x1' }), mk({ id: 'x2' })];
    const result = mergeAnswers(local, []);
    expect(result.toUpload.map((a) => a.id).sort()).toEqual(['x1', 'x2']);
    expect(result.merged).toHaveLength(2);
  });

  it('换设备登录：服务器记录全部需要下载', () => {
    const remote = [mk({ id: 'r1' })];
    const result = mergeAnswers([], remote);
    expect(result.toDownload.map((a) => a.id)).toEqual(['r1']);
    expect(result.merged).toHaveLength(1);
  });

  it('两边各有一部分时，只传差集，不重复传已有的', () => {
    const shared = mk({ id: 'same' });
    const result = mergeAnswers([shared, mk({ id: 'only-local' })], [shared, mk({ id: 'only-remote' })]);
    expect(result.toUpload.map((a) => a.id)).toEqual(['only-local']);
    expect(result.toDownload.map((a) => a.id)).toEqual(['only-remote']);
    expect(result.merged).toHaveLength(3);
  });

  it('同 id 同内容不算冲突，也不会重复', () => {
    const a = mk({ id: 'dup' });
    const result = mergeAnswers([a], [{ ...a }]);
    expect(result.conflicts).toHaveLength(0);
    expect(result.merged).toHaveLength(1);
  });

  it('同 id 但内容不同会被报出来，而不是静默挑一个', () => {
    const result = mergeAnswers(
      [mk({ id: 'clash', value: '出门了' })],
      [mk({ id: 'clash', value: '没出门' })],
    );
    expect(result.conflicts).toHaveLength(1);
    // 保留本地版本，冲突另行上报
    expect(result.merged[0].value).toBe('出门了');
  });

  it('复核记录（revisionOf）参与比较，不会被当成同一条', () => {
    const base = mk({ id: 'rev' });
    const revision = mk({ id: 'rev', revisionOf: 'other' });
    expect(mergeAnswers([base], [revision]).conflicts).toHaveLength(1);
  });

  it('合并结果按作答时间升序', () => {
    const early = mk({ id: 'e', answeredAt: '2026-09-01T00:00:00Z' });
    const late = mk({ id: 'l', answeredAt: '2026-09-30T00:00:00Z' });
    const result = mergeAnswers([late], [early]);
    expect(result.merged.map((a) => a.id)).toEqual(['e', 'l']);
  });

  it('合并是幂等的：拿结果再合并一次不会变', () => {
    const local = [mk({ id: 'a' }), mk({ id: 'b' })];
    const remote = [mk({ id: 'b' }), mk({ id: 'c' })];
    const once = mergeAnswers(local, remote).merged;
    const twice = mergeAnswers(once, once).merged;
    expect(twice.map((a) => a.id).sort()).toEqual(once.map((a) => a.id).sort());
    expect(twice).toHaveLength(3);
  });

  it('顺序无关：交换两边结果一致', () => {
    const left = [mk({ id: 'a' }), mk({ id: 'b' })];
    const right = [mk({ id: 'b' }), mk({ id: 'c' })];
    const forward = mergeAnswers(left, right).merged.map((a) => a.id).sort();
    const backward = mergeAnswers(right, left).merged.map((a) => a.id).sort();
    expect(forward).toEqual(backward);
  });
});
