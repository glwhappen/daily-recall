import type { Answer, Session } from './types';

/**
 * localStorage 存储层。
 *
 * 加了账号之后这里仍然保留：本地永远是第一份数据，服务器只是另一个副本。
 * 断网、没登录、数据库挂掉，都不影响继续答题。
 */
export const STORAGE_KEY = 'daily-recall/v2';

/** 旧版 key，只为把 v1 时期的数据平滑读上来 */
const LEGACY_KEY = 'daily-recall/v1';

export type Vote = 'up' | 'down';

export interface Store {
  version: 2;
  answers: Answer[];
  sessions: Session[];
  /** 我对题目的投票（未登录时只存本地） */
  votes: Record<string, Vote>;
  /** 我点踩过的题目，抽题时跳过。个人偏好，不影响别人的题库 */
  blocked: string[];
}

export function emptyStore(): Store {
  return { version: 2, answers: [], sessions: [], votes: {}, blocked: [] };
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

function isRecord(value: unknown): value is Record<string, Vote> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalize(raw: unknown): Store {
  if (!raw || typeof raw !== 'object') return emptyStore();
  const parsed = raw as Partial<Store> & { version?: number };
  if (!Array.isArray(parsed.answers)) return emptyStore();

  return {
    version: 2,
    answers: parsed.answers,
    sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    // v1 的数据里没有这两项，补默认值即可，不需要迁移脚本
    votes: isRecord(parsed.votes) ? parsed.votes : {},
    blocked: Array.isArray(parsed.blocked) ? parsed.blocked.filter((b) => typeof b === 'string') : [],
  };
}

export function loadStore(storage?: Storage): Store {
  const s = resolveStorage(storage);
  if (!s) return emptyStore();
  try {
    const raw = s.getItem(STORAGE_KEY);
    if (raw) return normalize(JSON.parse(raw));

    const legacy = s.getItem(LEGACY_KEY);
    if (legacy) {
      const migrated = normalize(JSON.parse(legacy));
      saveStore(migrated, s);
      return migrated;
    }
    return emptyStore();
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

/** 导入时按 id 去重合并，而不是直接覆盖——避免用户误操作丢掉已有记录 */
export function importStore(current: Store, json: string): ImportResult {
  const parsed = JSON.parse(json) as unknown;
  const incoming = normalize(parsed);
  if (!Array.isArray((parsed as Partial<Store>)?.answers)) {
    throw new Error('不是有效的 Daily Recall 数据文件');
  }

  const existing = new Set(current.answers.map((a) => a.id));
  const additions = incoming.answers.filter((a) => !existing.has(a.id));

  return {
    store: {
      ...current,
      answers: [...current.answers, ...additions],
      votes: { ...incoming.votes, ...current.votes },
      blocked: [...new Set([...current.blocked, ...incoming.blocked])],
    },
    imported: additions.length,
    skipped: incoming.answers.length - additions.length,
  };
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
