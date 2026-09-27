import { strings } from '@/i18n/strings';
import type { DriftKind } from '@/lib/drift';

/**
 * 漂移类型 → 视觉与文案的映射。
 *
 * 抽出来共用是因为踩过坑：结果页（DriftList）按类型区分了颜色，
 * 但待核对页最初把样式写死成 `conflict`，于是「越久反而越清晰」也被画成红色警告。
 */
const s = strings('zh-CN');

export const DRIFT_ITEM_CLASS: Record<DriftKind, string> = {
  conflict: 'drift-item--conflict',
  upgrade: 'drift-item--upgrade',
  decay: 'drift-item--decay',
  agree: 'drift-item--agree',
};

export const DRIFT_CHIP_CLASS: Record<DriftKind, string> = {
  conflict: 'chip chip--bad',
  upgrade: 'chip chip--warn',
  decay: 'chip',
  agree: 'chip chip--good',
};

export function driftTitle(kind: DriftKind): string {
  return {
    conflict: s.driftConflict,
    decay: s.driftDecay,
    upgrade: s.driftUpgrade,
    agree: s.driftAgree,
  }[kind];
}

export function driftDesc(kind: DriftKind): string {
  return {
    conflict: s.driftConflictDesc,
    decay: s.driftDecayDesc,
    upgrade: s.driftUpgradeDesc,
    agree: s.driftAgreeDesc,
  }[kind];
}
