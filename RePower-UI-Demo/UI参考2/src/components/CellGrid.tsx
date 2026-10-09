import { useMemo, useState } from 'react';
import { CELLS_PER_PACK, PACKS, cellLabel, cellPos, type Cell } from '../data/fleet';
import { median } from '../data/model';
import { cn } from '../utils/cn';

export type Metric = 'soc' | 'v' | 'soh' | 't';

const normal = (f: number) => {
  const a = [36, 40, 46];
  const b = [86, 94, 104];
  const k = Math.max(0, Math.min(1, f));
  return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * k)).join(',')})`;
};

export function cellColor(c: Cell, metric: Metric, med: number) {
  if (metric === 'soc' || metric === 'v') {
    const d = c.soc - med;
    if (d <= -3.5) return '#e8352e';
    if (d <= -1.6) return '#ffa51f';
    if (d <= -0.9) return 'rgba(255,165,31,.45)';
    return normal((d + 0.9) / 2);
  }
  if (metric === 'soh') {
    if (c.soh < 0.86) return '#e8352e';
    if (c.soh < 0.9) return '#ffa51f';
    if (c.soh < 0.92) return 'rgba(255,165,31,.45)';
    return normal((c.soh - 0.92) / 0.06);
  }
  if (c.t >= 45) return '#e8352e';
  if (c.t >= 38) return '#ffa51f';
  if (c.t >= 35) return 'rgba(255,165,31,.45)';
  return normal((c.t - 24) / 11);
}

/** 充电末端单体电压（最高单体触及 3.60 V 截止） */
export const eocVoltage = (c: Cell, maxSoc: number) => 3.6 - (maxSoc - c.soc) * 0.018;

export const METRIC_LEGEND: Record<Metric, string[]> = {
  soc: ['偏差 > −0.9%', '−0.9 ~ −1.6%', '−1.6 ~ −3.5%', '< −3.5%'],
  v: ['正常', '偏低 15 mV+', '偏低 30 mV+', '偏低 60 mV+'],
  soh: ['≥ 92%', '90–92%', '86–90%', '< 86%'],
  t: ['< 35 °C', '35–38 °C', '38–45 °C', '≥ 45 °C'],
};

export function CellGrid({
  cells, metric, selected, onToggle, stale,
}: { cells: Cell[]; metric: Metric; selected: number[]; onToggle?: (idx: number) => void; stale?: boolean }) {
  const med = useMemo(() => median(cells.map((c) => c.soc)), [cells]);
  const maxSoc = useMemo(() => Math.max(...cells.map((c) => c.soc)), [cells]);
  const [hover, setHover] = useState<number | null>(null);
  const h = hover != null ? cells[hover] : null;
  const pos = h ? cellPos(h.idx) : null;

  return (
    <div className={cn(stale && 'opacity-60 grayscale')}>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
        {Array.from({ length: PACKS }, (_, p) => (
          <div key={p} className="panel-inset p-2.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="label text-g-300">PACK {p + 1}</span>
              <span className="label">1P48S · 43 kWh</span>
            </div>
            <div className="grid grid-cols-12 gap-[3px]">
              {cells.slice(p * CELLS_PER_PACK, (p + 1) * CELLS_PER_PACK).map((c) => {
                const sel = selected.includes(c.idx);
                return (
                  <button
                    key={c.idx}
                    onMouseEnter={() => setHover(c.idx)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => onToggle?.(c.idx)}
                    aria-label={cellLabel(c.idx)}
                    className={cn(
                      'relative h-[15px] rounded-[2px] transition-transform hover:z-10 hover:scale-125',
                      sel && 'z-10 ring-2 ring-sig ring-offset-1 ring-offset-g-1000',
                    )}
                    style={{ background: cellColor(c, metric, med) }}
                  />
                );
              })}
            </div>
          </div>
        ))}
        <div className="panel-inset flex flex-col justify-center p-3 text-[12px]">
          {h && pos ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="num text-[15px] font-semibold text-g-50">{cellLabel(h.idx)}</span>
                <span className="text-[11px] text-g-400">
                  第 {pos.row} 排 · 第 {pos.col} 列
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 num text-[11.5px]">
                <span className="text-g-400">SOC</span>
                <span className={cn('text-right', h.soc - med < -1.6 ? 'text-sig' : 'text-g-100')}>
                  {h.soc.toFixed(1)}% ({(h.soc - med).toFixed(1)})
                </span>
                <span className="text-g-400">末端电压</span>
                <span className="text-right text-g-100">{eocVoltage(h, maxSoc).toFixed(3)} V</span>
                <span className="text-g-400">SOH</span>
                <span className={cn('text-right', h.soh < 0.9 ? 'text-stop-hi' : 'text-g-100')}>{(h.soh * 100).toFixed(1)}%</span>
                <span className="text-g-400">温度</span>
                <span className={cn('text-right', h.t >= 38 ? 'text-sig' : 'text-g-100')}>{h.t.toFixed(1)} °C</span>
                <span className="text-g-400">内阻</span>
                <span className="text-right text-g-100">{h.r.toFixed(2)} mΩ</span>
              </div>
            </div>
          ) : (
            <p className="leading-relaxed text-g-400">
              悬停查看单体详情
              <br />
              <span className="text-g-300">点击电芯</span> 加入 / 移出注入清单
              <br />
              <span className="text-[11px] text-g-500">最多 4 颗 · 对应 Re-Pulse 4 个通道</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
