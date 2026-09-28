'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  emptyStore,
  loadStore,
  saveStore,
  type Store,
  type Vote,
} from '@/lib/storage';
import type { Answer } from '@/lib/types';

/**
 * 应用级状态：能力开关 + 登录状态 + 本地数据 + 同步。
 *
 * 之所以做成 Provider 而不是每个页面各自 useStore：
 * 加了账号之后，「登录状态变化 → 触发同步 → 更新数据 → 页面重渲染」
 * 是一条完整链路，分散在四个页面里各写一遍必然会不一致。
 */

export interface Capabilities {
  server: boolean;
  auth: boolean;
  feedback: boolean;
  oidc: boolean;
  password: boolean;
  /** 管理员在后台下线的题目，抽题时要在本地过滤掉 */
  disabledQuestions: string[];
}

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  groups: string[];
}

export type SyncState = 'idle' | 'syncing' | 'error';

/** 还没拿到 /api/config 之前的保守默认：什么都不开 */
const DEFAULT_CAPABILITIES: Capabilities = {
  server: false,
  auth: false,
  feedback: false,
  oidc: false,
  password: false,
  disabledQuestions: [],
};

interface AppValue {
  /** 本地数据与配置是否已就绪（避免首帧闪 0） */
  ready: boolean;
  capabilities: Capabilities;
  user: AuthUser | null;
  isAdmin: boolean;
  store: Store;
  answers: Answer[];
  votes: Record<string, Vote>;
  blocked: string[];
  syncState: SyncState;
  addAnswer: (answer: Answer) => void;
  setVote: (questionId: string, vote: Vote | null) => Promise<void>;
  replaceStore: (next: Store) => void;
  sync: () => Promise<{ uploaded?: number; error?: string }>;
  refreshAuth: () => Promise<void>;
  logout: () => Promise<void>;
}

const AppContext = createContext<AppValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [capabilities, setCapabilities] = useState<Capabilities>(DEFAULT_CAPABILITIES);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [store, setStore] = useState<Store>(emptyStore);
  const [syncState, setSyncState] = useState<SyncState>('idle');

  // 同步逻辑要读「最新的」store，但不能把 store 放进 useCallback 依赖里
  // （否则每次落一条记录都会重建同步函数并再次触发同步）
  const storeRef = useRef(store);
  useEffect(() => {
    storeRef.current = store;
  }, [store]);

  const commit = useCallback((next: Store) => {
    saveStore(next);
    storeRef.current = next;
    setStore(next);
  }, []);

  // 首屏：读本地数据，再问服务端开了哪些能力
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const local = loadStore();
      if (cancelled) return;
      storeRef.current = local;
      setStore(local);

      try {
        const caps = (await fetch('/api/config').then((r) => r.json())) as Partial<Capabilities>;
        if (cancelled) return;
        setCapabilities({ ...DEFAULT_CAPABILITIES, ...caps });

        if (caps.server) {
          const me = await fetch('/api/auth/me').then((r) => r.json());
          if (cancelled) return;
          setUser(me?.user ?? null);
          setIsAdmin(Boolean(me?.admin));
        }
      } catch {
        // 拿不到配置就按纯本地模式跑：接口挂了不该让应用打不开
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sync = useCallback(async (): Promise<{ uploaded?: number; error?: string }> => {
    if (!user) return { error: '未登录' };
    setSyncState('syncing');
    try {
      const snapshot = storeRef.current;

      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answers: snapshot.answers }),
      });
      if (!response.ok) throw new Error(`同步失败（HTTP ${response.status}）`);
      const data = (await response.json()) as { answers?: Answer[]; uploaded?: number };

      let next: Store = { ...storeRef.current, answers: data.answers ?? snapshot.answers };

      if (capabilities.feedback) {
        // 未登录期间点的赞/踩只存在本地，先补推给服务端
        const first = await fetchFeedback();
        for (const [questionId, vote] of Object.entries(next.votes)) {
          if (!first?.votes?.[questionId]) {
            await postVote(questionId, vote);
          }
        }
        const merged = (await fetchFeedback()) ?? first;
        if (merged) {
          next = {
            ...next,
            votes: merged.votes ?? next.votes,
            blocked: merged.blocks ?? next.blocked,
          };
        }
      }

      commit(next);
      setSyncState('idle');
      return { uploaded: data.uploaded };
    } catch (error) {
      setSyncState('error');
      return { error: error instanceof Error ? error.message : '同步失败' };
    }
  }, [capabilities.feedback, commit, user]);

  // 登录后自动同步一次（含首次登录把本地记录带上去）
  useEffect(() => {
    if (!ready || !user) return;
    void sync();
  }, [ready, user, sync]);

  const addAnswer = useCallback(
    (answer: Answer) => {
      commit({ ...storeRef.current, answers: [...storeRef.current.answers, answer] });
    },
    [commit],
  );

  const replaceStore = useCallback(
    (next: Store) => {
      commit(next);
    },
    [commit],
  );

  const setVote = useCallback(
    async (questionId: string, vote: Vote | null) => {
      const current = storeRef.current;
      const votes = { ...current.votes };
      if (vote) votes[questionId] = vote;
      else delete votes[questionId];

      // 屏蔽名单跟着票走：点踩即屏蔽，取消或改赞就解除
      const blocked =
        vote === 'down'
          ? [...new Set([...current.blocked, questionId])]
          : current.blocked.filter((id) => id !== questionId);

      commit({ ...current, votes, blocked });

      if (user && capabilities.feedback) {
        const result = await postVote(questionId, vote);
        if (result) {
          commit({ ...storeRef.current, votes: result.votes ?? votes, blocked: result.blocks ?? blocked });
        }
      }
    },
    [capabilities.feedback, commit, user],
  );

  const refreshAuth = useCallback(async () => {
    if (!capabilities.server) return;
    try {
      const me = await fetch('/api/auth/me').then((r) => r.json());
      setUser(me?.user ?? null);
      setIsAdmin(Boolean(me?.admin));
    } catch {
      // 忽略：下次进入页面还会再问
    }
  }, [capabilities.server]);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setUser(null);
    setIsAdmin(false);
    // 刻意不清本地数据：退出登录不等于删除记录
  }, []);

  const value = useMemo<AppValue>(
    () => ({
      ready,
      capabilities,
      user,
      isAdmin,
      store,
      answers: store.answers,
      votes: store.votes,
      blocked: store.blocked,
      syncState,
      addAnswer,
      setVote,
      replaceStore,
      sync,
      refreshAuth,
      logout,
    }),
    [
      ready,
      capabilities,
      user,
      isAdmin,
      store,
      syncState,
      addAnswer,
      setVote,
      replaceStore,
      sync,
      refreshAuth,
      logout,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp 必须在 AppProvider 内部使用');
  return value;
}

async function fetchFeedback(): Promise<{ votes?: Record<string, Vote>; blocks?: string[] } | null> {
  try {
    return await fetch('/api/feedback').then((r) => (r.ok ? r.json() : null));
  } catch {
    return null;
  }
}

async function postVote(
  questionId: string,
  vote: Vote | null,
): Promise<{ votes?: Record<string, Vote>; blocks?: string[] } | null> {
  try {
    const response = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questionId, vote }),
    });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}
