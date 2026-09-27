'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  appendAnswer,
  emptyStore,
  loadStore,
  saveStore,
  type Store,
} from '@/lib/storage';
import type { Answer } from '@/lib/types';

/**
 * localStorage 的 React 绑定。
 *
 * SSR / 静态导出时没有 localStorage，所以首帧用空 store，挂载后再读，
 * 并用 `ready` 标记避免「先显示 0 再跳成真实值」的闪烁。
 */
export function useStore() {
  const [store, setStore] = useState<Store>(() => emptyStore());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setStore(loadStore());
    setReady(true);
  }, []);

  const addAnswer = useCallback((answer: Answer) => {
    setStore((prev) => appendAnswer(prev, answer));
  }, []);

  const replaceStore = useCallback((next: Store) => {
    saveStore(next);
    setStore(next);
  }, []);

  const answers = useMemo(() => store.answers, [store.answers]);

  return { store, answers, ready, addAnswer, replaceStore };
}
