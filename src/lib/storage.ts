import type { Answer, Session } from './types';

/**
 * localStorage 存储层。v1 不需要任何后端：数据只在用户自己的浏览器里。
 *
 * 这里刻意把 `Storage` 作为参数传入，方便单测用内存实现替代。
 */
export const STORAGE_KEY = 'daily-recall/v1';

export interface Store {
  version: 1;
  answers: Answer[];
  sessions: Session[];
}

export function emptyStore(): Store {
  return { version: 1, answers: [], sessions: [] };
}

function resolveStorage(storage?: Storage): Storage | undefined {
  if (storage) return storage;
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage;
  } catch {
    // 隐私模式下访问 localStorage 会抛异常
    return undefined;
  }
}

export function loadStore(storage?: Storage): Store {
  const s = resolveStorage(storage);
  if (!s) return emptyStore();
  try {
    const raw = s.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<Store>;
    if (parsed.version !== 1 || !Array.isArray(parsed.answers)) return emptyStore();
    return {
      version: 1,
      answers: parsed.answers,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    };
  } catch {
    // 数据损坏时宁可从头开始，也不要让整个应用打不开
    return emptyStore();
  }
}

export function saveStore(store: Store, storage?: Storage): void {
  const s = resolveStorage(storage);
  if (!s) return;
  try {
    s.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // 配额满或隐私模式：静默失败，不打断答题
  }
}

export function appendAnswer(store: Store, answer: Answer): Store {
  const next: Store = { ...store, answers: [...store.answers, answer] };
  saveStore(next);
  return next;
}

/** 导出为 JSON 字符串，让用户能把数据带走或换设备导入 */
export function exportStore(store: Store): string {
  return JSON.stringify({ ...store, exportedAt: new Date().toISOString() }, null, 2);
}

export interface ImportResult {
  store: Store;
  imported: number;
  skipped: number;
}

/**
 * 导入时按 id 去重合并，而不是直接覆盖——避免用户误操作丢掉已有记录。
 */
export function importStore(current: Store, json: string): ImportResult {
  const parsed = JSON.parse(json) as Partial<Store>;
  if (parsed.version !== 1 || !Array.isArray(parsed.answers)) {
    throw new Error('不是有效的 Daily Recall 数据文件');
  }
  const existing = new Set(current.answers.map((a) => a.id));
  const additions = parsed.answers.filter((a) => a && typeof a.id === 'string' && !existing.has(a.id));
  return {
    store: { ...current, answers: [...current.answers, ...additions] },
    imported: additions.length,
    skipped: parsed.answers.length - additions.length,
  };
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
