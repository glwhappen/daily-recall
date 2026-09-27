'use client';

export interface DayStat {
  date: string;
  total: number;
  coverage: number;
}

/** 最近 30 天的练习热力图。空白格 = 没练，颜色越深 = 回忆覆盖率越高。 */
export function Heatmap({ days }: { days: DayStat[] }) {
  return (
    <div className="heatmap">
      {days.map((day) => {
        const level = levelOf(day);
        return (
          <div
            key={day.date}
            className={`heatmap-cell${level ? ` heatmap-cell--l${level}` : ''}`}
            title={`${day.date}：${day.total} 题，记得 ${Math.round(day.coverage * 100)}%`}
          />
        );
      })}
    </div>
  );
}

function levelOf(day: DayStat): 0 | 1 | 2 | 3 | 4 {
  if (day.total === 0) return 0;
  if (day.coverage < 0.4) return 1;
  if (day.coverage < 0.6) return 2;
  if (day.coverage < 0.8) return 3;
  return 4;
}
