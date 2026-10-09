import { cn } from '../utils/cn';

export interface Stave {
  h: number; // 容量（铭牌比例）
  tone: 'base' | 'warn' | 'crit';
}

const LO = 0.7;
const HI = 1.0;
const H = 250;
export const bucketY = (v: number) => Math.max(2, Math.min(100, ((v - LO) / (HI - LO)) * 100));

const STAVE_BG: Record<Stave['tone'], string> = {
  base: 'linear-gradient(90deg,#24282d,#40464f 45%,#2a2e34)',
  warn: 'linear-gradient(90deg,#4a3410,#a86d14 45%,#4a3410)',
  crit: 'linear-gradient(90deg,#7a120e,#e8352e 45%,#7a120e)',
};

/**
 * 木桶：木板高度 = 单体容量（SOH），水位 = 实际可用容量。
 * 最短木板 = 容量短板；水位低于最短板的部分 = SOC 错位造成的"漏孔"。
 */
export function Bucket({
  staves, water, shortTop, ideal, leak, shortLabel, kwh,
}: {
  staves: Stave[];
  water: number;
  shortTop: number;
  ideal: number;
  leak: boolean;
  shortLabel: string;
  kwh: { usable: number; soc: number; cap: number };
}) {
  const shortIdx = staves.findIndex((s) => s.tone === 'crit');
  const warnIdx = staves.findIndex((s) => s.tone === 'warn');
  const leakIdx = warnIdx >= 0 ? warnIdx : shortIdx;
  const wy = bucketY(water);
  const sy = bucketY(shortTop);
  const iy = bucketY(ideal);

  const labels = [
    { key: 'cap', y: (sy + iy) / 2, text: `容量短板 −${kwh.cap.toFixed(1)} kWh`, cls: 'text-stop-hi', show: iy - sy > 0.4 },
    { key: 'soc', y: (wy + sy) / 2, text: leak ? `SOC 错位 −${kwh.soc.toFixed(1)} kWh` : 'SOC 已对齐 ✓', cls: leak ? 'text-sig' : 'text-g-300', show: true },
    { key: 'use', y: wy / 2, text: `实际可用 ${kwh.usable.toFixed(1)} kWh`, cls: 'text-g-100', show: true },
  ];
  let prev = Infinity;
  const placed = labels
    .filter((l) => l.show)
    .map((l) => {
      let px = (l.y / 100) * H;
      if (prev - px < 30) px = prev - 30;
      px = Math.max(10, px);
      prev = px;
      return { ...l, px };
    });

  return (
    <div>
      <div className="flex items-end gap-5">
        <div className="relative shrink-0" style={{ height: H, width: 250 }}>
          <div className="absolute -left-2 -right-4 z-30 border-t border-dashed border-g-200/70" style={{ bottom: `${iy}%` }} />
          <span className="absolute left-0 z-30 mb-0.5 rounded-[3px] bg-g-950/85 px-1 text-[10px] text-g-200 ring-1 ring-g-700" style={{ bottom: `${iy}%` }}>
            理论 · 平均 SOH
          </span>
          <div className="absolute inset-0 overflow-hidden" style={{ clipPath: 'polygon(0 0, 100% 0, 93% 100%, 7% 100%)' }}>
            <div className="absolute inset-0 bg-[#08090b]" />
            <div className="absolute inset-0 flex items-end gap-[3px]">
              {staves.map((s, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-[3px] transition-[height] duration-1000"
                  style={{
                    height: `${bucketY(s.h)}%`,
                    background: STAVE_BG[s.tone],
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.14), inset -1px 0 0 rgba(0,0,0,.45)',
                  }}
                />
              ))}
            </div>
            <div
              className="absolute inset-x-0 bottom-0 transition-[height] duration-[1400ms] ease-out"
              style={{ height: `${wy}%`, background: 'linear-gradient(180deg, rgba(255,165,31,.52), rgba(255,165,31,.14))' }}
            >
              <div className="absolute inset-x-0 top-0 h-[2px] bg-sig-hi shadow-[0_0_14px_2px_rgba(255,165,31,.85)]" />
            </div>
            {[18, 64].map((b) => (
              <div
                key={b}
                className="absolute inset-x-0 h-[7px]"
                style={{ bottom: `${b}%`, background: 'linear-gradient(180deg,#666d77,#30353c 55%,#16181b)', boxShadow: '0 2px 3px rgba(0,0,0,.6)' }}
              />
            ))}
          </div>
          {shortIdx >= 0 && (
            <div
              className="absolute z-30 -translate-x-1/2"
              style={{ left: `${((shortIdx + 0.5) / staves.length) * 100}%`, bottom: `calc(${bucketY(staves[shortIdx].h)}% + 4px)` }}
            >
              <span className="num whitespace-nowrap rounded-[3px] bg-stop px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-lg">{shortLabel}</span>
            </div>
          )}
          {leak && leakIdx >= 0 && (
            <div className="absolute z-30" style={{ left: `${((leakIdx + 0.5) / staves.length) * 100}%`, bottom: `${wy}%` }}>
              <span className="absolute -left-[6px] -top-[4px] h-[8px] w-[12px] rounded-full bg-black ring-1 ring-sig/80" />
              {[0, 0.45, 0.9].map((d) => (
                <span
                  key={d}
                  className="absolute left-[-2px] top-[2px] h-[8px] w-[4px] animate-drip rounded-full bg-sig"
                  style={{ animationDelay: `${d}s` }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="relative min-w-[150px] flex-1" style={{ height: H }}>
          <div className="absolute bottom-0 left-0 top-0 w-[10px] overflow-hidden rounded-sm bg-g-900 ring-1 ring-g-700">
            <div className="absolute inset-x-0 bottom-0 bg-sig transition-all duration-[1400ms]" style={{ height: `${wy}%` }} />
            <div className="hatch-sig absolute inset-x-0 transition-all duration-[1400ms]" style={{ bottom: `${wy}%`, height: `${Math.max(0, sy - wy)}%` }} />
            <div className="hatch-stop absolute inset-x-0" style={{ bottom: `${sy}%`, height: `${Math.max(0, iy - sy)}%` }} />
          </div>
          {placed.map((l) => (
            <div
              key={l.key}
              className={cn('num absolute left-4 translate-y-1/2 whitespace-nowrap text-[11.5px] transition-all duration-1000', l.cls)}
              style={{ bottom: l.px }}
            >
              {l.text}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-[10.5px] text-g-500">纵轴截取铭牌容量 70%–100%，差异放大显示 · 每块木板 = 一颗电芯的容量</p>
    </div>
  );
}
