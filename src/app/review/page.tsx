'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { DRIFT_CHIP_CLASS, DRIFT_ITEM_CLASS, driftDesc, driftTitle } from '@/components/driftMeta';
import { useStore } from '@/hooks/useStore';
import { format, strings } from '@/i18n/strings';
import { bankFor, DEFAULT_LOCALE } from '@/lib/bank';
import { renderWithDay, toDateKey } from '@/lib/date';
import { detectDrift, openIssues, type DriftGroup } from '@/lib/drift';
import { newId } from '@/lib/storage';
import type { Answer } from '@/lib/types';

const LOCALE = DEFAULT_LOCALE;
const bank = bankFor(LOCALE);
const s = strings(LOCALE);

/**
 * 待核对的记忆。
 *
 * 复核不会覆盖原始答案，而是追加一条带 `revisionOf` 的新记录——
 * 「他第一次答错了」这个信号必须留下来，否则漂移率就算不出来了。
 */
export default function ReviewPage() {
  const { answers, ready, addAnswer } = useStore();
  const [done, setDone] = useState<string[]>([]);

  const { open, resolved } = useMemo(() => {
    const all = detectDrift(answers);
    return { open: openIssues(all), resolved: all.filter((g) => g.resolved) };
  }, [answers]);

  const resolve = (group: DriftGroup, source: Answer) => {
    addAnswer({
      id: newId(),
      questionId: group.questionId,
      targetDate: group.targetDate,
      offset: source.offset,
      value: source.value,
      kind: source.kind,
      answeredAt: new Date().toISOString(),
      answeredOn: toDateKey(new Date()),
      sessionId: 'review',
      revisionOf: source.id,
    });
    setDone((prev) => [...prev, `${group.questionId}|${group.targetDate}`]);
  };

  const renderGroup = (group: DriftGroup, actionable: boolean) => {
    const question = bank.questions.find((q) => q.id === group.questionId);
    const text = question ? renderWithDay(question.text, group.targetDate, LOCALE) : group.questionId;
    const first = group.answers[0];
    const last = group.answers[group.answers.length - 1];
    const key = `${group.questionId}|${group.targetDate}`;
    const handled = group.resolved || done.includes(key);

    return (
      <div key={key} className={`drift-item ${DRIFT_ITEM_CLASS[group.kind]}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{text}</span>
          <span className={DRIFT_CHIP_CLASS[group.kind]}>{driftTitle(group.kind)}</span>
        </div>
        <p className="tiny" style={{ margin: '6px 0 0' }}>{driftDesc(group.kind)}</p>
        <div className="answer-line">
          <span className="tiny">{s.firstAnswer}</span>
          <b>{first.value}</b>
          <span className="tiny">{first.answeredOn}</span>
        </div>
        <div className="answer-line">
          <span className="tiny">{s.laterAnswer}</span>
          <b>{last.value}</b>
          <span className="tiny">{last.answeredOn}</span>
        </div>
        {handled ? (
          <div className="answer-line">
            <span className="chip chip--good">{s.resolved}</span>
          </div>
        ) : (
          actionable && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button type="button" className="link-pill" onClick={() => resolve(group, first)}>
                以第一次为准
              </button>
              <button type="button" className="link-pill" onClick={() => resolve(group, last)}>
                以后来的为准
              </button>
            </div>
          )
        )}
      </div>
    );
  };

  return (
    <div className="shell">
      <div className="topbar">
        <h1 className="brand-name" style={{ margin: 0 }}>{s.reviewTitle}</h1>
        <Link href="/" className="link-pill">{s.common.back}</Link>
      </div>

      {!ready && <p className="muted">…</p>}
      {ready && open.length === 0 && <div className="card"><p className="muted">{s.reviewEmpty}</p></div>}

      {open.length > 0 && (
        <div className="card">
          <p className="muted" style={{ marginBottom: 12 }}>
            同一天被问过两次，答案却对不上。点一下你更信哪一个——原始记录会保留，
            以后「我的记忆漂移率」就是靠这些算出来的。
          </p>
          {open.map((group) => renderGroup(group, true))}
        </div>
      )}

      {resolved.length > 0 && (
        <div className="card">
          <h2 className="section-title">{s.driftResolved}</h2>
          {resolved.map((group) => renderGroup(group, false))}
        </div>
      )}
    </div>
  );
}
