'use client';

import { useApp } from '@/components/AppProvider';

/**
 * 兼容层：老页面用 useStore() 拿本地数据。
 * 真正的状态在 AppProvider 里（登录、能力开关、同步都在那边统一处理）。
 */
export function useStore() {
  const app = useApp();
  return {
    store: app.store,
    answers: app.answers,
    ready: app.ready,
    addAnswer: app.addAnswer,
    replaceStore: app.replaceStore,
  };
}
