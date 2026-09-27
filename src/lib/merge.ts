import type { Answer } from './types';

/**
 * 多端合并。
 *
 * 这是整个同步机制的地基，也是 v1 把作答记录设计成「不可变 + UUID 主键」
 * 的回报：既然记录永远不会被改写，合并就只是**集合并集**，
 * 不需要处理字段级冲突，也不需要向量时钟那一套。
 *
 * 同一份数据可能在三个地方各存一份：浏览器 localStorage、账号数据库、
 * 从别处导出的 JSON。任何两份合并都用这个函数。
 */
export interface MergeResult {
  /** 合并后的完整集合，按作答时间升序 */
  merged: Answer[];
  /** 只有本地有，需要上传 */
  toUpload: Answer[];
  /** 只有远端有，需要下载 */
  toDownload: Answer[];
  /**
   * 同一个 id 但内容不同。
   *
   * 理论上不该出现（UUID + 不可变）。真出现了说明数据被外部改动过，
   * 这时宁可报出来让人看见，也不要静默挑一个。
   */
  conflicts: Answer[];
}

export function mergeAnswers(local: Answer[], remote: Answer[]): MergeResult {
  const localById = new Map(local.map((a) => [a.id, a]));
  const remoteById = new Map(remote.map((a) => [a.id, a]));

  const toUpload: Answer[] = [];
  const toDownload: Answer[] = [];
  const conflicts: Answer[] = [];

  for (const [id, answer] of localById) {
    const other = remoteById.get(id);
    if (!other) {
      toUpload.push(answer);
    } else if (fingerprint(answer) !== fingerprint(other)) {
      conflicts.push(answer);
    }
  }

  for (const [id, answer] of remoteById) {
    if (!localById.has(id)) toDownload.push(answer);
  }

  // 同 id 且内容一致时取本地那份；有冲突时保留本地版本，冲突单独上报
  const merged = [...remoteById.values()];
  for (const [id, answer] of localById) {
    const index = merged.findIndex((a) => a.id === id);
    if (index >= 0) merged[index] = answer;
    else merged.push(answer);
  }

  merged.sort((a, b) => a.answeredAt.localeCompare(b.answeredAt));

  return { merged, toUpload, toDownload, conflicts };
}

/**
 * 用于判断两条同 id 记录是否真的是同一件事。
 * 刻意不含 `id`（它是比较的前提），也不含 `sessionId`（重装后可能被重算）。
 */
function fingerprint(answer: Answer): string {
  return [
    answer.questionId,
    answer.targetDate,
    answer.offset,
    answer.value,
    answer.kind,
    answer.answeredOn,
    answer.revisionOf ?? '',
  ].join('|');
}
