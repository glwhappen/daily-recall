/**
 * 领域模型。这里刻意不依赖任何框架，方便单独测试与复用。
 */

/** 选项语义。`forgot` 是唯一的「记忆失败」信号。 */
export type OptionKind = 'fact' | 'recalled' | 'forgot';

/**
 * fact  —— 有客观答案的选择题，既能当记忆测试，也能当天的事实记录
 * recall —— 只能自评的题（「你还记得……吗」）
 */
export type QuestionType = 'fact' | 'recall';

export interface QuestionOption {
  value: string;
  kind: OptionKind;
}

export interface Question {
  /** 与语言无关的稳定标识，翻译题库时保持不变 */
  id: string;
  category: string;
  type: QuestionType;
  /** 含 `{日期}` 占位符的题干模板 */
  text: string;
  /** 该题适合在「距今多少天」时提问 */
  offsets: number[];
  options: QuestionOption[];
}

export interface Category {
  id: string;
  name: string;
  note?: string;
}

export interface QuestionBank {
  version: number;
  locale: string;
  categories: Category[];
  questions: Question[];
}

/** 一条作答记录。**不可变**：复核不会覆盖它，而是追加一条带 revisionOf 的记录。 */
export interface Answer {
  id: string;
  questionId: string;
  /** 被问的是哪一天（本地时区 YYYY-MM-DD） */
  targetDate: string;
  /** 提问时距 targetDate 多少天 */
  offset: number;
  value: string;
  kind: OptionKind;
  /** 作答时刻（ISO 8601，含时区） */
  answeredAt: string;
  /**
   * 作答当天的本地日期键（YYYY-MM-DD）。
   * 统计一律用它，而不是从 answeredAt 切字符串——那样会掉进 UTC 时区的坑。
   */
  answeredOn: string;
  sessionId: string;
  /** 复核记录指向被核对的原记录 */
  revisionOf?: string;
}

/** 一次练习会话里的一道题（题干已按日期渲染） */
export interface QuestionInstance {
  questionId: string;
  targetDate: string;
  offset: number;
  /** 渲染后的题干 */
  text: string;
}

export interface Session {
  id: string;
  startedAt: string;
  finishedAt?: string;
  size: number;
}

/** [0, 1) 的随机数发生器，可注入以便测试复现 */
export type Rng = () => number;
