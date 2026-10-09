import { useId } from 'react';
import { useMeasure } from '../hooks';

export interface Series {
  data: (number | null)[];
  color: string;
  width?: number;
  dash?: string;
  area?: boolean;
  dot?: boolean;
}
export interface Threshold {
  y: number;
  color: string;
  label: string;
}
export interface Marker {
  i: number;
  label: string;
  color: string;
}

export function LineChart({
  series, height = 180, yMin, yMax, thresholds = [], xLabels = [], yFormat = (v: number) => String(Math.round(v)), markers = [], shade,
}: {
  series: Series[];
  height?: number;
  yMin?: number;
  yMax?: number;
  thresholds?: Threshold[];
  xLabels?: string[];
  yFormat?: (v: number) => string;
  markers?: Marker[];
  shade?: { from: number; to: number; label: string };
}) {
  const [ref, size] = useMeasure<HTMLDivElement>();
  const gid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const W = Math.max(160, size.width || 560);
  const H = height;
  const padL = 50;
  const padR = 14;
  const padT = 16;
  const padB = xLabels.length ? 24 : 10;
  const n = Math.max(2, ...series.map((s) => s.data.length));
  const vals: number[] = [];
  series.forEach((s) => s.data.forEach((v) => v != null && vals.push(v)));
  thresholds.forEach((t) => vals.push(t.y));
  const lo = yMin ?? Math.min(0, ...vals);
  let hi = yMax ?? Math.max(1, ...vals) * 1.1;
  if (hi <= lo) hi = lo + 1;
  const x = (i: number) => padL + (i / (n - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => lo + (hi - lo) * f);

  const line = (d: (number | null)[]) => {
    let p = '';
    let pen = false;
    d.forEach((v, i) => {
      if (v == null) {
        pen = false;
        return;
      }
      p += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
      pen = true;
    });
    return p;
  };
  const area = (d: (number | null)[]) => {
    const segs: string[] = [];
    let cur: number[] = [];
    const flush = () => {
      if (cur.length > 1) {
        segs.push(
          `M${x(cur[0]).toFixed(1)} ${y(lo).toFixed(1)} ` +
            cur.map((i) => `L${x(i).toFixed(1)} ${y(d[i] as number).toFixed(1)}`).join(' ') +
            ` L${x(cur[cur.length - 1]).toFixed(1)} ${y(lo).toFixed(1)} Z`,
        );
      }
      cur = [];
    };
    d.forEach((v, i) => (v == null ? flush() : cur.push(i)));
    flush();
    return segs.join(' ');
  };

  return (
    <div ref={ref} className="w-full select-none">
      <svg width={W} height={H} className="block overflow-visible">
        <defs>
          {series.map((s, k) =>
            s.area ? (
              <linearGradient key={k} id={`${gid}g${k}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ) : null,
          )}
          <pattern id={`${gid}hatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="2" height="6" fill="rgba(151,158,168,0.18)" />
          </pattern>
        </defs>
        {ticks.map((t, k) => (
          <g key={k}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#262a30" strokeDasharray={k === 0 ? undefined : '2 4'} />
            <text x={padL - 8} y={y(t) + 3.5} textAnchor="end" fontSize={10} fill="#6e7682" fontFamily="JetBrains Mono, monospace">
              {yFormat(t)}
            </text>
          </g>
        ))}
        {shade && shade.to > shade.from && (
          <g>
            <rect x={x(shade.from)} y={padT} width={Math.max(2, x(shade.to) - x(shade.from))} height={H - padT - padB} fill={`url(#${gid}hatch)`} />
            <text x={(x(shade.from) + x(shade.to)) / 2} y={padT + 14} textAnchor="middle" fontSize={10} fill="#979ea8">
              {shade.label}
            </text>
          </g>
        )}
        {thresholds.map((t, k) => (
          <g key={k}>
            <line x1={padL} x2={W - padR} y1={y(t.y)} y2={y(t.y)} stroke={t.color} strokeDasharray="5 4" strokeOpacity={0.8} />
            <text x={W - padR} y={y(t.y) - 5} textAnchor="end" fontSize={10} fill={t.color}>
              {t.label}
            </text>
          </g>
        ))}
        {markers.map((m, k) => (
          <g key={k}>
            <line x1={x(m.i)} x2={x(m.i)} y1={padT} y2={H - padB} stroke={m.color} strokeOpacity={0.45} strokeDasharray="2 3" />
            <circle cx={x(m.i)} cy={padT + 2} r={3} fill={m.color} />
            <text x={x(m.i) + 5} y={padT + 6} fontSize={10} fill={m.color}>
              {m.label}
            </text>
          </g>
        ))}
        {series.map((s, k) => (
          <g key={k}>
            {s.area && <path d={area(s.data)} fill={`url(#${gid}g${k})`} />}
            <path
              d={line(s.data)}
              fill="none"
              stroke={s.color}
              strokeWidth={s.width ?? 2}
              strokeDasharray={s.dash}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {s.dot !== false &&
              (() => {
                let li = -1;
                s.data.forEach((v, i) => v != null && (li = i));
                if (li < 0) return null;
                return <circle cx={x(li)} cy={y(s.data[li] as number)} r={3.5} fill={s.color} stroke="#0b0c0e" strokeWidth={2} />;
              })()}
          </g>
        ))}
        {xLabels.map((l, k) => {
          const i = xLabels.length === 1 ? 0 : (k / (xLabels.length - 1)) * (n - 1);
          return (
            <text key={k} x={x(i)} y={H - 6} textAnchor={k === 0 ? 'start' : k === xLabels.length - 1 ? 'end' : 'middle'} fontSize={10} fill="#6e7682">
              {l}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export function Spark({
  data, width = 120, height = 32, color = '#ffa51f', min, max, thresholds = [],
}: { data: number[]; width?: number; height?: number; color?: string; min?: number; max?: number; thresholds?: { y: number; color: string }[] }) {
  const lo = min ?? Math.min(...data);
  const hi = max ?? Math.max(...data);
  const sy = (v: number) => height - ((v - lo) / (hi - lo || 1)) * height;
  const pts = data.map((v, i) => `${((i / Math.max(1, data.length - 1)) * width).toFixed(1)},${sy(v).toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} className="block overflow-visible">
      {thresholds.map((t, k) => (
        <line key={k} x1={0} x2={width} y1={sy(t.y)} y2={sy(t.y)} stroke={t.color} strokeDasharray="3 3" strokeOpacity={0.7} />
      ))}
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    </svg>
  );
}
