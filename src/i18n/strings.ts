/**
 * UI 文案。目前只提供中文，英文题库与文案欢迎社区贡献。
 */
export type Locale = 'zh-CN' | 'en';

export interface UiStrings {
  appName: string;
  tagline: string;

  // 首页
  homeTitle: string;
  streakDays: string;
  coverage7d: string;
  answeredToday: string;
  startPractice: string;
  practiceAgain: string;
  chooseCount: string;
  questions: string;
  scopeTitle: string;
  scopeDefault: string;
  scopeRecent: string;
  scopeDeep: string;
  scopeDefaultNote: string;
  scopeRecentNote: string;
  scopeDeepNote: string;
  historyEntry: string;
  reviewEntry: string;
  dataEntry: string;
  dataEntryNote: string;
  emptyHint: string;

  // 答题
  questionOf: string;
  recorded: string;
  quit: string;

  // 结果
  resultTitle: string;
  remembered: string;
  forgotten: string;
  coverage: string;
  weightedCoverage: string;
  driftTitle: string;
  driftNone: string;
  continueChallenge: string;
  endToday: string;
  factRecords: string;
  todayDone: string;

  // 漂移类型
  driftConflict: string;
  driftConflictDesc: string;
  driftDecay: string;
  driftDecayDesc: string;
  driftUpgrade: string;
  driftUpgradeDesc: string;
  driftAgree: string;
  driftAgreeDesc: string;
  driftResolved: string;
  askedTimes: string;

  // 历史
  historyTitle: string;
  recentDays: string;
  byCategory: string;
  byDistance: string;
  bandNear: string;
  bandMid: string;
  bandFar: string;
  bandHint: string;
  totalAnswers: string;
  daysCovered: string;
  categoryForgotRate: string;
  noData: string;

  // 核对
  reviewTitle: string;
  reviewEmpty: string;
  firstAnswer: string;
  laterAnswer: string;
  markResolved: string;
  resolved: string;

  // 数据管理
  dataTitle: string;
  exportData: string;
  importData: string;
  importDone: string;
  clearAll: string;
  clearConfirm: string;
  storageNote: string;

  common: { back: string; confirm: string; cancel: string };
}

const zh: UiStrings = {
  appName: '每日回忆',
  tagline: '每天几道题，看看你还记得多少',

  homeTitle: '今天练几道？',
  streakDays: '连续练习',
  coverage7d: '近 7 天覆盖率',
  answeredToday: '今天已答',
  startPractice: '开始练习',
  practiceAgain: '再来一组',
  chooseCount: '题目数量',
  questions: '道题',
  scopeTitle: '回忆范围',
  scopeDefault: '普通',
  scopeRecent: '近一点',
  scopeDeep: '往远处想',
  scopeDefaultNote: '昨天到两周前，日常难度',
  scopeRecentNote: '只问昨天和前天，热身用',
  scopeDeepNote: '会问到一个月前，硬核模式',
  historyEntry: '历史与趋势',
  reviewEntry: '待核对的记忆',
  dataEntry: '数据管理',
  dataEntryNote: '数据只存在这台设备的浏览器里',
  emptyHint: '还没有记录。答完第一组，这里就会出现你的趋势。',

  questionOf: '第 {n} / {total} 题',
  recorded: '已记录',
  quit: '退出',

  resultTitle: '这一组答完了',
  remembered: '记得',
  forgotten: '想不起来',
  coverage: '回忆覆盖率',
  weightedCoverage: '加权覆盖率',
  driftTitle: '跨天校验',
  driftNone: '暂时没有发现不一致的地方。',
  continueChallenge: '继续挑战',
  endToday: '结束今天的练习',
  factRecords: '事实记录',
  todayDone: '今天的练习已完成',

  driftConflict: '两天的答案互相矛盾',
  driftConflictDesc: '同一天只有一种事实，说明有一次记错了。',
  driftDecay: '后来想不起来了',
  driftDecayDesc: '这是正常的遗忘——隔得越久越模糊。',
  driftUpgrade: '越久反而越清楚',
  driftUpgradeDesc: '更久以后还记得更牢，通常是把别的事记混了。',
  driftAgree: '前后一致',
  driftAgreeDesc: '这条记忆经得起复查。',
  driftResolved: '已核对',
  askedTimes: '问过 {n} 次',

  historyTitle: '历史与趋势',
  recentDays: '最近 30 天',
  byCategory: '分类表现',
  byDistance: '按回忆距离',
  bandNear: '昨天 / 前天',
  bandMid: '3–7 天前',
  bandFar: '一周以上',
  bandHint:
    '三档分开看，才能看出「是记性不行，还是只是隔得太久」。一周以上还能记住的比例低于昨天前天，是正常的。',
  totalAnswers: '累计作答',
  daysCovered: '覆盖天数',
  categoryForgotRate: '想不起来的比例',
  noData: '还没有足够的数据。',

  reviewTitle: '待核对的记忆',
  reviewEmpty: '没有需要处理的矛盾。继续保持。',
  firstAnswer: '第一次回答',
  laterAnswer: '后来的回答',
  markResolved: '已核对过',
  resolved: '已核对',

  dataTitle: '数据管理',
  exportData: '导出数据',
  importData: '导入数据',
  importDone: '导入完成：新增 {n} 条，跳过 {skipped} 条',
  clearAll: '清空全部数据',
  clearConfirm: '确定清空全部记录？此操作不可撤销。',
  storageNote: '所有记录只保存在这个浏览器的 localStorage 里，不会上传到任何服务器。',

  common: { back: '返回', confirm: '确定', cancel: '取消' },
};

const en: UiStrings = {
  appName: 'Daily Recall',
  tagline: 'A few questions a day. See how much you remember.',

  homeTitle: 'How many questions today?',
  streakDays: 'Day streak',
  coverage7d: '7-day coverage',
  answeredToday: 'Answered today',
  startPractice: 'Start',
  practiceAgain: 'One more set',
  chooseCount: 'Questions',
  questions: '',
  scopeTitle: 'How far back',
  scopeDefault: 'Normal',
  scopeRecent: 'Recent',
  scopeDeep: 'Deep',
  scopeDefaultNote: 'Yesterday to two weeks ago',
  scopeRecentNote: 'Only yesterday and the day before',
  scopeDeepNote: 'Up to a month back — hard mode',
  historyEntry: 'History & trends',
  reviewEntry: 'Memories to check',
  dataEntry: 'Data',
  dataEntryNote: 'Everything stays in this browser',
  emptyHint: 'No records yet. Finish one set and your trends show up here.',

  questionOf: 'Question {n} of {total}',
  recorded: 'Saved',
  quit: 'Quit',

  resultTitle: "That's a wrap",
  remembered: 'Remembered',
  forgotten: "Couldn't recall",
  coverage: 'Recall coverage',
  weightedCoverage: 'Weighted coverage',
  driftTitle: 'Cross-day check',
  driftNone: 'No inconsistencies found so far.',
  continueChallenge: 'Keep going',
  endToday: 'Finish for today',
  factRecords: 'Fact records',
  todayDone: "Today's practice is done",

  driftConflict: 'Conflicting answers',
  driftConflictDesc: 'Only one version of that day is true — one answer is wrong.',
  driftDecay: 'Forgotten later',
  driftDecayDesc: 'Normal decay: the further away, the fuzzier.',
  driftUpgrade: 'Sharper over time',
  driftUpgradeDesc: 'Recalling better much later often means memories got mixed up.',
  driftAgree: 'Consistent',
  driftAgreeDesc: 'This memory survives a re-check.',
  driftResolved: 'Checked',
  askedTimes: 'asked {n}×',

  historyTitle: 'History & trends',
  recentDays: 'Last 30 days',
  byCategory: 'By category',
  byDistance: 'By distance',
  bandNear: 'Yesterday / day before',
  bandMid: '3–7 days ago',
  bandFar: 'A week or more',
  bandHint:
    'Splitting by distance tells you whether it is your memory or just the gap. A lower number a week out is normal.',
  totalAnswers: 'Total answers',
  daysCovered: 'Days covered',
  categoryForgotRate: 'Forgotten rate',
  noData: 'Not enough data yet.',

  reviewTitle: 'Memories to check',
  reviewEmpty: 'Nothing to reconcile. Keep going.',

  firstAnswer: 'First answer',
  laterAnswer: 'Later answer',
  markResolved: 'Mark as checked',
  resolved: 'Checked',

  dataTitle: 'Data',
  exportData: 'Export',
  importData: 'Import',
  importDone: 'Imported {n} records, skipped {skipped}',
  clearAll: 'Erase everything',
  clearConfirm: 'Erase all records? This cannot be undone.',
  storageNote: 'All records live in this browser only — nothing is uploaded anywhere.',

  common: { back: 'Back', confirm: 'OK', cancel: 'Cancel' },
};

export const UI_STRINGS: Record<Locale, UiStrings> = { 'zh-CN': zh, en };

export function strings(locale: Locale): UiStrings {
  return UI_STRINGS[locale] ?? UI_STRINGS['zh-CN'];
}

/** 极简插值：`{n}` / `{total}` */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
