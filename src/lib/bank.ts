import banksJson from '@/generated/questions.json';
import type { QuestionBank } from './types';

/**
 * 构建期由 scripts/build-questions.mjs 从 questions/*.yaml 生成。
 * YAML 是唯一事实源；这个 JSON 不入库。
 */
export const BANKS = banksJson as unknown as Record<string, QuestionBank>;

export const DEFAULT_LOCALE = 'zh-CN';

export function bankFor(locale: string): QuestionBank {
  return BANKS[locale] ?? BANKS[DEFAULT_LOCALE];
}

export const AVAILABLE_LOCALES = Object.keys(BANKS);
