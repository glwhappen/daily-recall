'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { DriftList } from '@/components/DriftList';
import { useStore } from '@/hooks/useStore';
import { format, strings } from '@/i18n/strings';
import { bankFor, DEFAULT_LOCALE } from '@/lib/bank';
import { renderText, toDateKey } from '@/lib/date';
import { detectDrift } from '@/lib/drift';
import { buildCandidates, pickSession, type Candidate } from '@/lib/pick';
import { answersWithinDays, currentStreak, summarize } from '@/lib/scoring';
import { newId } from '@/lib/storage';
import type { Answer, OptionKind, QuestionInstance } from '@/lib/types';

const LOCALE = DEFAULT_LOCALE;
const bank = bankFor(LOCALE);
const s = strings(LOCALE);

/**
 * 回忆范围。它只做一件事：限制候选题的「偏移天数」。
 * 不改变题目本身，所以同一道题在不同范围下的表现仍然可以纵向对比。
 */
type Scope = 'recent' | 'default' | 'deep';

interface SessionState {
  id: string;
  items: QuestionInstance[];
  records: Answer[];
  index: number;
}

type View = 'home' | 'practice' | 'result';

export function PracticeFlow() {
  const { answers, ready, addAnswer } = useStore();
  const { capabilities, user, blocked, votes, setVote, logout, syncState, isAdmin } = useApp();
  const [view, setView] = useState<View>('home');
  const [size, setSize] = useState(5);
  const [scope, setScope] = useState<Scope>('default');
  const [session, setSession] = useState<SessionState | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);
  const todayKey = toDateKey(today);

  const stats = useMemo(() => {
    const week = answersWithinDays(answers, today, 7);
    return {
      streak: currentStreak(answers, todayKey),
      week: summarize(week),
      todayCount: answers.filter((a) => a.answeredOn === todayKey).length,
    };
  }, [answers, today, todayKey]);

  const startSession = useCallback(
    (count: number, range: Scope, excludeIds: Set<string> = new Set()) => {
      // 被管理员下线的题、以及我自己点踩屏蔽的题，都不再出现
      const excluded = new Set([
        ...capabilities.disabledQuestions,
        ...blocked,
        ...excludeIds,
      ]);
      const candidates = buildCandidates(bank, new Date(), answers).filter(
        (c) => !excluded.has(c.question.id),
      );
      const picked = pickForScope(candidates, count, range, new Set());
      if (picked.length === 0) {
        setNotice('这个范围里的题都问过了，换一个范围试试。');
        return;
      }
      setNotice(null);
      setSession({
        id: newId(),
        items: picked.map((c) => ({
          questionId: c.question.id,
          targetDate: c.targetDate,
          offset: c.offset,
          text: renderText(c.question.text, c.offset, LOCALE),
        })),
        records: [],
        index: 0,
      });
      setView('practice');
    },
    [answers, blocked, capabilities.disabledQuestions],
  );

  /** 跳过当前题（点踩后不再要求作答） */
  const skipInstance = useCallback(() => {
    if (!session) return;
    const isLast = session.index + 1 >= session.items.length;
    if (!isLast) {
      setSession((prev) => (prev ? { ...prev, index: prev.index + 1 } : prev));
    } else {
      setView('result');
    }
  }, [session]);

  const choose = useCallback(
    (instance: QuestionInstance, value: string, kind: OptionKind) => {
      if (!session || pending) return;
      setPending(value);

      const record: Answer = {
        id: newId(),
        questionId: instance.questionId,
        targetDate: instance.targetDate,
        offset: instance.offset,
        value,
        kind,
        answeredAt: new Date().toISOString(),
        answeredOn: toDateKey(new Date()),
        sessionId: session.id,
      };
      addAnswer(record);

      window.setTimeout(() => {
        setPending(null);
        const isLast = session.index + 1 >= session.items.length;
        setSession((prev) => {
          if (!prev) return prev;
          const withRecord = { ...prev, records: [...prev.records, record] };
          return isLast ? withRecord : { ...withRecord, index: withRecord.index + 1 };
        });
        if (isLast) setView('result');
      }, 200);
    },
    [addAnswer, pending, session],
  );

  // ── 答题 ─────────────────────────────────────────────
  if (view === 'practice' && session) {
    const instance = session.items[session.index];
    if (!instance) {
      return null;
    }
    const question = bank.questions.find((q) => q.id === instance.questionId);
    const progress = (session.index / session.items.length) * 100;

    return (
      <div className="shell shell--center">
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <p className="tiny" style={{ marginBottom: 10 }}>
          {format(s.questionOf, { n: session.index + 1, total: session.items.length })}
        </p>
        <h1 className="question-text">{instance.text}</h1>
        <div className="options">
          {question?.options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={[
                'option',
                option.kind === 'forgot' ? 'option--forgot' : '',
                pending === option.value ? 'option--selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => choose(instance, option.value, option.kind)}
            >
              {option.value}
            </button>
          ))}
        </div>

        {capabilities.feedback && (
          <div className="vote-row">
            <button
              type="button"
              className={`vote${votes[instance.questionId] === 'up' ? ' vote--on' : ''}`}
              aria-label="这题不错"
              title="这题不错"
              onClick={() =>
                void setVote(
                  instance.questionId,
                  votes[instance.questionId] === 'up' ? null : 'up',
                )
              }
            >
              👍
            </button>
            <button
              type="button"
              className={`vote${votes[instance.questionId] === 'down' ? ' vote--on' : ''}`}
              aria-label="别再问我这个"
              title="别再问我这个"
              onClick={() => {
                // 点踩表达的是「我不想答这个」：屏蔽掉并跳过去，不再要求作答
                void setVote(instance.questionId, 'down');
                skipInstance();
              }}
            >
              👎
            </button>
          </div>
        )}

        <div style={{ marginTop: 22, textAlign: 'center' }}>
          <button
            type="button"
            className="link-pill"
            onClick={() => {
              setView('home');
              setSession(null);
            }}
          >
            {s.quit}
          </button>
        </div>
      </div>
    );
  }

  // ── 结果 ─────────────────────────────────────────────
  if (view === 'result' && session) {
    const summary = summarize(session.records);
    const touched = new Set(session.records.map((r) => `${r.questionId}|${r.targetDate}`));
    const drifts = detectDrift(answers).filter((g) => touched.has(`${g.questionId}|${g.targetDate}`));

    return (
      <div className="shell">
        <div className="card">
          <h1 className="section-title">{s.resultTitle}</h1>
          <div className="big-number">{Math.round(summary.coverage * 100)}%</div>
          <p className="muted" style={{ marginTop: 2 }}>{s.coverage}</p>
          <div className="stat-row" style={{ marginTop: 16 }}>
            <div className="stat">
              <div className="stat-value">{summary.recalled}</div>
              <div className="stat-label">{s.remembered}</div>
            </div>
            <div className="stat">
              <div className="stat-value">{summary.forgot}</div>
              <div className="stat-label">{s.forgotten}</div>
            </div>
            <div className="stat">
              <div className="stat-value">{Math.round(summary.weightedCoverage * 100)}%</div>
              <div className="stat-label">{s.weightedCoverage}</div>
            </div>
          </div>
          <p className="tiny" style={{ marginTop: 12 }}>
            {format(s.summaryLine, { facts: summary.factRecords, days: summary.daysCovered })}
          </p>
        </div>

        <div className="card">
          <h2 className="section-title">{s.driftTitle}</h2>
          <DriftList groups={drifts} />
        </div>

        <div className="footer-actions">
          <button
            type="button"
            className="ghost"
            onClick={() => startSession(size, scope, new Set(session.items.map((i) => i.questionId)))}
          >
            {s.continueChallenge}
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => {
              setView('home');
              setSession(null);
            }}
          >
            {s.endToday}
          </button>
        </div>
      </div>
    );
  }

  // ── 首页 ─────────────────────────────────────────────
  return (
    <div className="shell">
      <div className="topbar">
        <div className="brand">
          <h1 className="brand-name" style={{ margin: 0 }}>{s.appName}</h1>
        </div>
        <div className="topbar-actions">
          {capabilities.auth &&
            (user ? (
              <button
                type="button"
                className="user-chip"
                title={`${user.name ?? user.email ?? ''} · 点击退出登录`}
                onClick={() => void logout()}
              >
                {user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="user-avatar" src={user.image} alt="" />
                ) : (
                  <span className="user-avatar user-avatar--fallback">
                    {(user.name ?? user.email ?? '?').slice(0, 1).toUpperCase()}
                  </span>
                )}
              </button>
            ) : (
              <Link href="/login" className="link-pill">
                登录
              </Link>
            ))}
          <Link href="/history" className="link-pill">
            {s.historyEntry}
          </Link>
        </div>
      </div>
      <p className="muted" style={{ marginTop: -12, marginBottom: 18 }}>{s.tagline}</p>

      <div className="card">
        <h2 className="section-title">{s.homeTitle}</h2>
        <div className="count-row">
          {[5, 10].map((n) => (
            <button
              key={n}
              type="button"
              className={`count${size === n ? ' count--active' : ''}`}
              onClick={() => setSize(n)}
            >
              {n} {s.questions}
            </button>
          ))}
        </div>

        <h2 className="section-title" style={{ marginTop: 18 }}>{s.scopeTitle}</h2>
        <div className="scope-list">
          {(
            [
              ['recent', s.scopeRecent, s.scopeRecentNote],
              ['default', s.scopeDefault, s.scopeDefaultNote],
              ['deep', s.scopeDeep, s.scopeDeepNote],
            ] as const
          ).map(([value, name, note]) => (
            <button
              key={value}
              type="button"
              className={`scope${scope === value ? ' scope--active' : ''}`}
              onClick={() => setScope(value)}
            >
              <div className="scope-name">{name}</div>
              <div className="scope-note">{note}</div>
            </button>
          ))}
        </div>

        <button
          type="button"
          className="primary"
          style={{ marginTop: 18 }}
          onClick={() => startSession(size, scope)}
          disabled={!ready}
        >
          {stats.todayCount > 0 ? s.practiceAgain : s.startPractice}
        </button>
        {notice && <p className="tiny" style={{ marginTop: 10 }}>{notice}</p>}
      </div>

      <div className="card">
        <div className="stat-row">
          <div className="stat">
            <div className="stat-value">{stats.streak}</div>
            <div className="stat-label">{s.streakDays}</div>
          </div>
          <div className="stat">
            <div className="stat-value">{Math.round(stats.week.weightedCoverage * 100)}%</div>
            <div className="stat-label">{s.coverage7d}</div>
          </div>
          <div className="stat">
            <div className="stat-value">{stats.todayCount}</div>
            <div className="stat-label">{s.answeredToday}</div>
          </div>
        </div>
        {answers.length === 0 && (
          <p className="muted" style={{ marginTop: 14 }}>{s.emptyHint}</p>
        )}
        <div className="link-row">
          <Link href="/review" className="link-pill">{s.reviewEntry}</Link>
          <Link href="/history" className="link-pill">{s.historyEntry}</Link>
          <Link href="/data" className="link-pill">{s.dataEntry}</Link>
          {isAdmin && (
            <Link href="/admin" className="link-pill">题目管理</Link>
          )}
        </div>
        {user && capabilities.server && (
          <p className="tiny" style={{ marginTop: 12 }}>
            {syncState === 'syncing'
              ? '正在同步…'
              : syncState === 'error'
                ? '同步失败，记录仍在本地，稍后会自动重试'
                : '已登录，记录会同步到你的账号'}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * 按范围挑题。
 * `deep` 先只从 3 天以外的题里挑，不够再放宽——不然「往远处想」名不副实。
 */
function pickForScope(
  candidates: Candidate[],
  size: number,
  scope: Scope,
  excludeIds: Set<string>,
): Candidate[] {
  const base = { rng: Math.random, exclude: excludeIds };

  if (scope === 'recent') {
    return pickSession(candidates.filter((c) => c.offset <= 2), size, base);
  }
  if (scope === 'default') {
    return pickSession(candidates.filter((c) => c.offset <= 14), size, base);
  }

  const far = pickSession(candidates.filter((c) => c.offset >= 3), size, base);
  if (far.length >= size) return far;

  const near = pickSession(candidates.filter((c) => c.offset < 3), size - far.length, {
    ...base,
    exclude: new Set([...excludeIds, ...far.map((c) => c.question.id)]),
    minAnchor: 0,
  });
  return [...far, ...near];
}
