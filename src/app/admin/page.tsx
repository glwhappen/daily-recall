'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { bankFor, DEFAULT_LOCALE } from '@/lib/bank';

interface QuestionStats {
  questionId: string;
  up: number;
  down: number;
  blocks: number;
}

const bank = bankFor(DEFAULT_LOCALE);

export default function AdminPage() {
  const { isAdmin, ready, capabilities } = useApp();
  const [stats, setStats] = useState<QuestionStats[]>([]);
  const [disabled, setDisabled] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/questions');
      if (!response.ok) return;
      const data = (await response.json()) as { stats?: QuestionStats[]; disabled?: string[] };
      setStats(data.stats ?? []);
      setDisabled(data.disabled ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    void load();
  }, [ready, isAdmin, load]);

  const toggle = async (questionId: string, next: boolean) => {
    setBusy(questionId);
    try {
      const response = await fetch('/api/admin/questions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ questionId, disabled: next, reason: next ? '后台下线' : null }),
      });
      if (response.ok) {
        const data = (await response.json()) as { stats?: QuestionStats[]; disabled?: string[] };
        setStats(data.stats ?? []);
        setDisabled(data.disabled ?? []);
      }
    } finally {
      setBusy(null);
    }
  };

  const statsById = useMemo(() => new Map(stats.map((s) => [s.questionId, s])), [stats]);
  const disabledSet = useMemo(() => new Set(disabled), [disabled]);

  /** 全是没票的题时看不过来，让有反馈的浮上来，按点踩率排 */
  const rows = useMemo(() => {
    return [...bank.questions]
      .map((question) => {
        const stat = statsById.get(question.id) ?? {
          questionId: question.id,
          up: 0,
          down: 0,
          blocks: 0,
        };
        const total = stat.up + stat.down;
        return { question, stat, total, downRate: total === 0 ? -1 : stat.down / total };
      })
      .sort((a, b) => b.downRate - a.downRate || b.total - a.total);
  }, [statsById]);

  const patch = useMemo(() => {
    if (disabled.length === 0) return '';
    const lines = disabled.map((id) => {
      const question = bank.questions.find((q) => q.id === id);
      const text = question ? question.text.replace('{日期}', '某天') : '';
      return `  - ${id}${text ? `    # ${text}` : ''}`;
    });
    return [
      `# 后台下线的题目（共 ${disabled.length} 道）`,
      '# 想让仓库也同步这个决定，就从 questions/zh-CN.yaml 里删掉对应条目；',
      '# 只删这里不会影响仓库，下次部署仍然以 YAML 为准。',
      ...lines,
    ].join('\n');
  }, [disabled]);

  if (!ready || loading) {
    return (
      <div className="shell">
        <p className="muted">…</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="shell">
        <div className="topbar">
          <h1 className="brand-name" style={{ margin: 0 }}>
            题目管理
          </h1>
          <Link href="/" className="link-pill">
            返回
          </Link>
        </div>
        <div className="card">
          <p className="muted">
            {capabilities.server
              ? '需要管理员权限。部署者可以通过 ADMIN_EMAILS 或 ADMIN_GROUPS 指定管理员。'
              : '这台部署没有开启服务端。'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <div className="topbar">
        <h1 className="brand-name" style={{ margin: 0 }}>
          题目管理
        </h1>
        <Link href="/" className="link-pill">
          返回
        </Link>
      </div>

      <div className="card">
        <h2 className="section-title">反馈概览</h2>
        {stats.length === 0 ? (
          <p className="muted">还没有人反馈过。答题界面每道题下面的 👍👎 会汇总到这里。</p>
        ) : (
          <p className="muted">
            共 {stats.length} 道题收到反馈，其中 {disabled.length} 道已下线。
            列表按点踩率排序，最上面的是最可能「有问题」的题。
          </p>
        )}
      </div>

      <div className="card">
        <h2 className="section-title">全部题目（{bank.questions.length}）</h2>
        {rows.map(({ question, stat, total, downRate }) => {
          const isOff = disabledSet.has(question.id);
          return (
            <div key={question.id} className={`q-row${isOff ? ' q-row--disabled' : ''}`}>
              <div style={{ minWidth: 0 }}>
                <div className="q-text">{question.text.replace('{日期}', '某天')}</div>
                <div className="q-meta">
                  {question.id}
                  {total > 0
                    ? ` · 👍 ${stat.up} · 👎 ${stat.down} · 拉黑 ${stat.blocks} · 点踩率 ${Math.round(
                        downRate * 100,
                      )}%`
                    : ' · 暂无反馈'}
                </div>
              </div>
              <div className="q-actions">
                <button
                  type="button"
                  className="link-pill"
                  disabled={busy === question.id}
                  onClick={() => void toggle(question.id, !isOff)}
                >
                  {isOff ? '恢复' : '下线'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {patch && (
        <div className="card">
          <h2 className="section-title">同步回仓库</h2>
          <p className="muted">
            下线的题目记在数据库里，不动题库文件——那是 Git 管理的唯一事实源，
            容器里也只读。想让仓库也删掉这些题，用下面的清单改 `questions/zh-CN.yaml`。
          </p>
          <textarea className="patch" readOnly value={patch} />
        </div>
      )}
    </div>
  );
}
