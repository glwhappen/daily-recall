'use client';

import { bankFor, DEFAULT_LOCALE } from '@/lib/bank';
import { renderWithDay } from '@/lib/date';
import type { DriftGroup, DriftKind } from '@/lib/drift';
import { format, strings } from '@/i18n/strings';

const LOCALE = DEFAULT_LOCALE;
const bank = bankFor(LOCALE);
const s = strings(LOCALE);

const KIND_CLASS: Record<DriftKind, string> = {
  conflict: 'drift-item--conflict',
  upgrade: 'drift-item--upgrade',
  decay: 'drift-item--decay',
  agree: 'drift-item--agree',
};

const CHIP_CLASS: Record<DriftKind, string> = {
  conflict: 'chip chip--bad',
  upgrade: 'chip chip--warn',
  decay: 'chip',
  agree: 'chip chip--good',
};

function titleOf(kind: DriftKind): string {
  return { conflict: s.driftConflict, decay: s.driftDecay, upgrade: s.driftUpgrade, agree: s.driftAgree }[kind];
}

function descOf(kind: DriftKind): string {
  return {
    conflict: s.driftConflictDesc,
    decay: s.driftDecayDesc,
    upgrade: s.driftUpgradeDesc,
    agree: s.driftAgreeDesc,
  }[kind];
}

export function DriftList({ groups }: { groups: DriftGroup[] }) {
  if (groups.length === 0) {
    return <p className="muted">{s.driftNone}</p>;
  }

  return (
    <div>
      {groups.map((group) => {
        const question = bank.questions.find((q) => q.id === group.questionId);
        const text = question
          ? renderWithDay(question.text, group.targetDate, LOCALE)
          : group.questionId;
        // 只显示首末两次：中间的复核记录不改变结论
        const first = group.answers[0];
        const last = group.answers[group.answers.length - 1];

        return (
          <div key={`${group.questionId}|${group.targetDate}`} className={`drift-item ${KIND_CLASS[group.kind]}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{text}</span>
              <span className={CHIP_CLASS[group.kind]}>{titleOf(group.kind)}</span>
            </div>
            <p className="tiny" style={{ margin: '6px 0 0' }}>{descOf(group.kind)}</p>
            <div className="answer-line">
              <span className="tiny">{s.firstAnswer}</span>
              <b>{first.value}</b>
              <span className="tiny">{first.answeredOn}</span>
            </div>
            {last.id !== first.id && (
              <div className="answer-line">
                <span className="tiny">{s.laterAnswer}</span>
                <b>{last.value}</b>
                <span className="tiny">{last.answeredOn}</span>
              </div>
            )}
            <div className="answer-line">
              <span className="tiny">
                {format(s.askedTimes, { n: group.answers.filter((a) => !a.revisionOf).length })}
              </span>
              {group.resolved && <span className="chip chip--good">{s.driftResolved}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
