'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { Heatmap, type DayStat } from '@/components/Heatmap';
import { useStore } from '@/hooks/useStore';
import { strings } from '@/i18n/strings';
import { bankFor, DEFAULT_LOCALE } from '@/lib/bank';
import { recentDateKeys, toDateKey } from '@/lib/date';
import { currentStreak, coverageByBand, summarize } from '@/lib/scoring';

const LOCALE = DEFAULT_LOCALE;
const bank = bankFor(LOCALE);
const s = strings(LOCALE);

export default function HistoryPage() {
  const { answers, ready } = useStore();
  const today = useMemo(() => new Date(), []);
  const todayKey = toDateKey(today);

  const overall = summarize(answers);
  const streak = currentStreak(answers, todayKey);
  // 「练习天数」按作答当天算，与 overall.daysCovered（被回忆的日子数）不是一回事
  const practiceDays = useMemo(
    () => new Set(answers.map((a) => a.answeredOn)).size,
    [answers],
  );

  const days: DayStat[] = useMemo(() => {
    return recentDateKeys(today, 30).map((date) => {
      const sum = summarize(answers.filter((a) => a.answeredOn === date));
      return { date, total: sum.total, coverage: sum.coverage };
    });
  }, [answers, today]);

  const bands = useMemo(() => coverageByBand(answers), [answers]);

  const byCategory = useMemo(() => {
    return bank.categories
      .map((category) => {
        const ids = new Set(
          bank.questions.filter((q) => q.category === category.id).map((q) => q.id),
        );
        const sum = summarize(answers.filter((a) => ids.has(a.questionId)));
        return { category, sum };
      })
      .filter((row) => row.sum.total > 0)
      .sort((a, b) => a.sum.coverage - b.sum.coverage);
  }, [answers]);

  return (
    <div className="shell">
      <div className="topbar">
        <h1 className="brand-name" style={{ margin: 0 }}>{s.historyTitle}</h1>
        <Link href="/" className="link-pill">{s.common.back}</Link>
      </div>

      <div className="card">
        <div className="stat-row">
          <div className="stat">
            <div className="stat-value">{overall.total}</div>
            <div className="stat-label">{s.totalAnswers}</div>
          </div>
          <div className="stat">
            <div className="stat-value">{practiceDays}</div>
            <div className="stat-label">{s.practiceDays}</div>
          </div>
          <div className="stat">
            <div className="stat-value">{streak}</div>
            <div className="stat-label">{s.streakDays}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">{s.recentDays}</h2>
        {ready && overall.total > 0 ? <Heatmap days={days} /> : <p className="muted">{s.noData}</p>}
      </div>

      <div className="card">
        <h2 className="section-title">{s.byDistance}</h2>
        {(
          [
            ['near', s.bandNear],
            ['mid', s.bandMid],
            ['far', s.bandFar],
          ] as const
        ).map(([band, label]) => {
          const sum = bands[band];
          return (
            <div key={band} className="bar-row">
              <span>{label}</span>
              <div className="bar-track">
                <div
                  className={`bar-fill${sum.coverage >= 0.7 ? ' bar-fill--good' : ''}`}
                  style={{ width: `${Math.round(sum.coverage * 100)}%` }}
                />
              </div>
              <span className="tiny" style={{ textAlign: 'right' }}>
                {sum.total === 0 ? '—' : `${Math.round(sum.coverage * 100)}%`}
              </span>
            </div>
          );
        })}
        <p className="tiny" style={{ marginTop: 10 }}>{s.bandHint}</p>
      </div>

      <div className="card">
        <h2 className="section-title">{s.byCategory}</h2>
        {byCategory.length === 0 && <p className="muted">{s.noData}</p>}
        {byCategory.map(({ category, sum }) => (
          <div key={category.id} className="bar-row">
            <span>{category.name}</span>
            <div className="bar-track">
              <div
                className={`bar-fill${sum.coverage >= 0.7 ? ' bar-fill--good' : ''}`}
                style={{ width: `${Math.round(sum.coverage * 100)}%` }}
              />
            </div>
            <span className="tiny" style={{ textAlign: 'right' }}>
              {Math.round(sum.coverage * 100)}%
            </span>
          </div>
        ))}
        {byCategory.length > 0 && (
          <p className="tiny" style={{ marginTop: 10 }}>
            百分比 = 记得的比例。排在前面的是你最容易忘的类别。
          </p>
        )}
      </div>
    </div>
  );
}
