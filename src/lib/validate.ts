import type { QuestionBank, Question } from './types';

/** YAML 校验错误：让题库 PR 的 CI 直接失败并指出行号所在的题目 */
export class QuestionBankError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuestionBankError';
  }
}

const OPTION_KINDS = new Set(['fact', 'recalled', 'forgot']);

/**
 * 校验题库。宁可构建失败，也不要把一道坏题发给用户。
 * 规则见 docs/question-guide.md。
 */
export function validateBank(raw: unknown): QuestionBank {
  if (!raw || typeof raw !== 'object') {
    throw new QuestionBankError('题库根节点必须是对象');
  }
  const bank = raw as Partial<QuestionBank>;

  if (bank.version !== 1) {
    throw new QuestionBankError(`不支持的题库版本：${String(bank.version)}（当前支持 1）`);
  }
  if (!bank.locale || typeof bank.locale !== 'string') {
    throw new QuestionBankError('缺少 locale 字段');
  }
  if (!Array.isArray(bank.categories) || bank.categories.length === 0) {
    throw new QuestionBankError('categories 不能为空');
  }
  if (!Array.isArray(bank.questions) || bank.questions.length === 0) {
    throw new QuestionBankError('questions 不能为空');
  }

  const categories = bank.categories.map((c) => {
    if (!c || typeof c.id !== 'string' || typeof c.name !== 'string') {
      throw new QuestionBankError('每个 category 必须含 id 和 name');
    }
    return { id: c.id, name: c.name, note: c.note };
  });
  const categoryIds = new Set(categories.map((c) => c.id));

  const seen = new Set<string>();
  const questions: Question[] = bank.questions.map((q, i) => {
    const where = `第 ${i + 1} 道题${q && typeof q.id === 'string' ? `（${q.id}）` : ''}`;

    if (!q || typeof q.id !== 'string' || !q.id) {
      throw new QuestionBankError(`${where}：缺少 id`);
    }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(q.id)) {
      throw new QuestionBankError(`${where}：id 必须是 kebab-case（小写字母、数字、连字符）`);
    }
    if (seen.has(q.id)) {
      throw new QuestionBankError(`${where}：id 重复`);
    }
    seen.add(q.id);

    if (!categoryIds.has(q.category)) {
      throw new QuestionBankError(`${where}：category "${q.category}" 未在 categories 中声明`);
    }
    if (q.type !== 'fact' && q.type !== 'recall') {
      throw new QuestionBankError(`${where}：type 必须是 fact 或 recall`);
    }
    if (typeof q.text !== 'string' || !q.text.includes('{日期}')) {
      throw new QuestionBankError(`${where}：text 必须包含 {日期} 占位符`);
    }
    if (!Array.isArray(q.offsets) || q.offsets.length === 0) {
      throw new QuestionBankError(`${where}：offsets 不能为空`);
    }
    for (const o of q.offsets) {
      if (!Number.isInteger(o) || o < 1) {
        throw new QuestionBankError(`${where}：offsets 必须是 >= 1 的整数，收到 ${String(o)}`);
      }
    }
    if (!Array.isArray(q.options) || q.options.length < 2) {
      throw new QuestionBankError(`${where}：至少需要 2 个选项`);
    }

    const values = new Set<string>();
    const options = q.options.map((o) => {
      if (!o || typeof o.value !== 'string' || !OPTION_KINDS.has(o.kind)) {
        throw new QuestionBankError(`${where}：选项必须是 { value, kind }，kind ∈ fact|recalled|forgot`);
      }
      if (values.has(o.value)) {
        throw new QuestionBankError(`${where}：选项 "${o.value}" 重复`);
      }
      values.add(o.value);
      return { value: o.value, kind: o.kind };
    });

    const forgotCount = options.filter((o) => o.kind === 'forgot').length;
    if (forgotCount > 1) {
      throw new QuestionBankError(`${where}：最多只能有一个 kind: forgot 的选项`);
    }
    // 事实题必须留出口：不给「不记得」的话，用户只能瞎猜，数据反而更脏。
    if (q.type === 'fact' && forgotCount === 0) {
      throw new QuestionBankError(`${where}：fact 型题目必须包含一个 kind: forgot 的选项`);
    }
    // 自评题不该塞事实选项，否则它就不是自评了。
    if (q.type === 'recall' && options.some((o) => o.kind === 'fact')) {
      throw new QuestionBankError(`${where}：recall 型题目不应包含 fact 选项`);
    }

    return {
      id: q.id,
      category: q.category,
      type: q.type,
      text: q.text,
      offsets: [...q.offsets].sort((a, b) => a - b),
      options,
    };
  });

  return { version: 1, locale: bank.locale, categories, questions };
}

/** 题库里被实际用到的最大偏移天数，用于生成候选池 */
export function maxOffset(bank: QuestionBank): number {
  return bank.questions.reduce((max, q) => Math.max(max, ...q.offsets), 1);
}

export function findQuestion(bank: QuestionBank, id: string): Question | undefined {
  return bank.questions.find((q) => q.id === id);
}
