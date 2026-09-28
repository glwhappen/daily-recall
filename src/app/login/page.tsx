'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useApp } from '@/components/AppProvider';

export default function LoginPage() {
  const { capabilities, user, ready, refreshAuth, logout } = useApp();
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/auth/${mode === 'login' ? 'login' : 'register'}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? '操作失败，请稍后再试');
        return;
      }
      await refreshAuth();
      router.push('/');
    } catch {
      setError('网络异常，请稍后再试');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="shell shell--center">
      <div className="topbar">
        <h1 className="brand-name" style={{ margin: 0 }}>
          {user ? '账号' : mode === 'login' ? '登录' : '注册'}
        </h1>
        <Link href="/" className="link-pill">
          返回
        </Link>
      </div>

      {!ready && <p className="muted">…</p>}

      {ready && !capabilities.auth && (
        <div className="card">
          <p className="muted">
            这台部署没有开启账号系统，所有记录都只存在你自己的浏览器里，功能完全可用。
          </p>
          <p className="tiny" style={{ marginTop: 10 }}>
            部署者配置 <code>DATABASE_URL</code> 并设置 <code>AUTH_ENABLED=true</code> 之后，
            这里会出现登录入口。
          </p>
        </div>
      )}

      {ready && capabilities.auth && user && (
        <div className="card">
          <p className="muted">你已登录为</p>
          <p style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>
            {user.name ?? user.email ?? user.id}
          </p>
          <p className="tiny" style={{ marginTop: 6 }}>
            记录会同步到这个账号，换设备登录也能看到。
          </p>
          <div className="footer-actions">
            <button type="button" className="ghost" onClick={() => void logout()}>
              退出登录
            </button>
            <Link href="/" className="primary" style={{ textAlign: 'center', textDecoration: 'none' }}>
              去答题
            </Link>
          </div>
        </div>
      )}

      {ready && capabilities.auth && !user && (
        <div className="card">
          {capabilities.oidc && (
            <>
              <a
                href="/api/auth/oidc"
                className="primary"
                style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
              >
                用统一登录继续
              </a>
              {capabilities.password && <div className="divider">或</div>}
            </>
          )}

          {capabilities.password && (
            <form onSubmit={submit}>
              <label className="field">
                <span className="field-label">邮箱</span>
                <input
                  className="input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">密码</span>
                <input
                  className="input"
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </label>

              {error && <p className="form-error">{error}</p>}

              <button type="submit" className="primary" style={{ marginTop: 14 }} disabled={busy}>
                {busy ? '处理中…' : mode === 'login' ? '登录' : '注册'}
              </button>
            </form>
          )}

          {capabilities.password && (
            <p className="tiny" style={{ marginTop: 14, textAlign: 'center' }}>
              {mode === 'login' ? (
                <button
                  type="button"
                  className="link-pill"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                  }}
                >
                  还没有账号？注册
                </button>
              ) : (
                <button
                  type="button"
                  className="link-pill"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                >
                  已有账号？登录
                </button>
              )}
            </p>
          )}

          <p className="tiny" style={{ marginTop: 16 }}>
            不登录也能正常用：记录存在这台设备的浏览器里。
          </p>
        </div>
      )}
    </div>
  );
}
