import { useId } from "react";

export interface Series {
  name: string;
  color: string;
  data: number[];
  dashed?: boolean;
  area?: boolean;
}

export function LineChart({
  series,
  labels,
  height = 190,
  yFmt,
  mark,
}: {
  series: Series[];
  labels: string[];
  height?: number;
  yFmt: (n: number) => string;
  mark?: { x: number; label: string } | null;
}) {
  const uid = useId().replace(/:/g, "");
  const W = 560;
  const H = height;
  const padL = 46, padR = 12, padT = 12, padB = 22;
  const all = series.flatMap((s) => s.data);
  const mx = Math.max(...all, 1);
  const mn = Math.min(...all, 0);
  const n = labels.length;
  const x = (i: number) => padL + (i / (n - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - mn) / (mx - mn || 1)) * (H - padT - padB);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => mn + (mx - mn) * t);
  return (
    <div>
      <div className="mb-1 flex items-center gap-4 text-[11px] text-g-400">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5">
            <i className="inline-block h-[3px] w-4" style={{ background: s.dashed ? `repeating-linear-gradient(90deg,${s.color} 0 4px,transparent 4px 7px)` : s.color }} />
            {s.name}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <defs>
          {series.map((s, i) => (
            <linearGradient key={i} id={`${uid}-g${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={s.color} stopOpacity="0.28" />
              <stop offset="1" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#2a2f34" strokeDasharray="2 4" />
            <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize="9" fill="#7c848c" fontFamily="var(--font-mono)">{yFmt(t)}</text>
          </g>
        ))}
        {labels.map((l, i) =>
          i % 2 === 0 || i === n - 1 ? (
            <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#7c848c" fontFamily="var(--font-mono)">{l}</text>
          ) : null
        )}
        {series.map((s, si) => {
          const d = s.data.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("");
          return (
            <g key={s.name}>
              {s.area && <path d={`${d}L${x(n - 1)} ${y(mn)}L${x(0)} ${y(mn)}Z`} fill={`url(#${uid}-g${si})`} />}
              <path d={d} fill="none" stroke={s.color} strokeWidth="2" strokeDasharray={s.dashed ? "5 4" : undefined} strokeLinejoin="round" />
              <circle cx={x(n - 1)} cy={y(s.data[n - 1])} r="3" fill={s.color} />
            </g>
          );
        })}
        {mark && (
          <g>
            <line x1={x(mark.x)} x2={x(mark.x)} y1={padT} y2={H - padB} stroke="#ffb020" strokeDasharray="3 3" />
            <rect x={Math.min(x(mark.x) - 28, W - 90)} y={padT} width="64" height="15" rx="2" fill="#2a2110" stroke="#ffb020" />
            <text x={Math.min(x(mark.x) - 28, W - 90) + 32} y={padT + 10.5} textAnchor="middle" fontSize="9.5" fill="#ffb020" fontFamily="var(--font-mono)">{mark.label}</text>
          </g>
        )}
      </svg>
    </div>
  );
}
