import { useState } from "react";
import { cn } from "./utils/cn";
import { T_ALLOW, avg, clamp, fmtPct, type Cell } from "./model";

/* =====================================================================
   木桶效应图：每根“木板”是一颗电芯的 SOH，水位 = 最短板 = 整柜可用容量
   ===================================================================== */
export function BarrelChart({
  cells,
  after,
  targets = [],
  onPick,
  height = 230,
}: {
  cells: Cell[];
  after?: Map<number, number>;
  targets?: number[];
  onPick?: (id: number) => void;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = height;
  const padL = 38, padR = 10, padT = 16, padB = 26;
  const lo = 0.6, hi = 1.0;
  const y = (s: number) => padT + (1 - (clamp(s, lo, hi) - lo) / (hi - lo)) * (H - padT - padB);
  const base = y(lo);
  const n = cells.length;
  const gw = (W - padL - padR) / n;
  const bw = gw * 0.74;
  const sohOf = (c: Cell) => after?.get(c.id) ?? c.soh;
  const mean = avg(cells.map((c) => c.soh));
  const min0 = Math.min(...cells.map((c) => c.soh));
  const min1 = Math.min(...cells.map(sohOf));
  const lifted = min1 - min0 > 0.0005;
  const hc = hover != null ? cells.find((c) => c.id === hover) : null;

  return (
    <div>
      <div className="mb-1 flex h-5 items-center justify-between text-[11px]">
        <div className="flex items-center gap-3 text-g-400">
          <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 bg-[#6a737c]" />可用容量</span>
          <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5" style={{ background: "repeating-linear-gradient(-45deg,#ffb020 0 2px,transparent 2px 4px)" }} />被最短板锁死的容量</span>
          {after && <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 bg-ok/70" />Re-Pulse 修复增量</span>}
        </div>
        <div className="num text-g-300">
          {hc ? (
            <>
              #{String(hc.id).padStart(2, "0")} · SOH <b className="text-g-100">{fmtPct(hc.soh)}</b> · {hc.v.toFixed(3)}V · {hc.t.toFixed(1)}°C
              {hc.flag === "replace" && <span className="ml-2 text-estop">待更换</span>}
            </>
          ) : (
            <span className="text-g-500">悬停查看单颗电芯 · 点击选择</span>
          )}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none" role="img" aria-label="电芯木桶效应图">
        <defs>
          <pattern id="barrel-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="5" height="5" fill="rgba(255,176,32,0.10)" />
            <line x1="0" y1="0" x2="0" y2="5" stroke="#ffb020" strokeWidth="2" opacity="0.75" />
          </pattern>
        </defs>
        {[0.6, 0.7, 0.8, 0.9, 1.0].map((g) => (
          <g key={g}>
            <line x1={padL} x2={W - padR} y1={y(g)} y2={y(g)} stroke="#2a2f34" strokeDasharray="2 4" />
            <text x={padL - 6} y={y(g) + 3.5} textAnchor="end" fontSize="10" fill="#7c848c" fontFamily="var(--font-mono)">{Math.round(g * 100)}%</text>
          </g>
        ))}
        {cells.map((c, i) => {
          const x = padL + i * gw + (gw - bw) / 2;
          const s0 = c.soh;
          const s1 = sohOf(c);
          const gained = s1 - s0 > 0.0005;
          const isMin = s0 === min0;
          const isTarget = targets.includes(c.id);
          return (
            <g key={c.id} onMouseEnter={() => setHover(c.id)} onMouseLeave={() => setHover(null)} onClick={() => onPick?.(c.id)} className={onPick ? "cursor-pointer" : ""}>
              <rect x={x} y={y(hi)} width={bw} height={base - y(hi)} fill="#121517" />
              <rect x={x} y={y(min1)} width={bw} height={base - y(min1)} fill={hover === c.id ? "#8a939c" : "#6a737c"} />
              {s1 > min1 && <rect x={x} y={y(s1)} width={bw} height={y(min1) - y(s1)} fill="url(#barrel-hatch)" />}
              {gained && <rect x={x} y={y(s1)} width={bw} height={y(s0) - y(s1)} fill="rgba(127,209,168,0.55)" stroke="#7fd1a8" strokeWidth="0.8" />}
              {c.flag === "replace" && <rect x={x - 0.5} y={y(s0) - 0.5} width={bw + 1} height={base - y(s0) + 1} fill="none" stroke="#e5342e" strokeWidth="1.5" strokeDasharray="2 2" />}
              {isMin && !lifted && <rect x={x - 0.5} y={y(s0) - 0.5} width={bw + 1} height={base - y(s0) + 1} fill="none" stroke="#e5342e" strokeWidth="1.4" />}
              {isTarget && <path d={`M${x + bw / 2 - 3} ${base + 9}h6l-3 -6z`} fill="#ffb020" />}
              {hover === c.id && <rect x={x - 1} y={y(hi)} width={bw + 2} height={base - y(hi)} fill="none" stroke="#e8ebee" strokeWidth="0.8" opacity="0.6" />}
              {(i % 6 === 0 || i === n - 1) && <text x={x + bw / 2} y={H - 4} textAnchor="middle" fontSize="8.5" fill="#7c848c" fontFamily="var(--font-mono)">#{String(c.id).padStart(2, "0")}</text>}
            </g>
          );
        })}
        {/* 平均线 */}
        <line x1={padL} x2={W - padR} y1={y(mean)} y2={y(mean)} stroke="#a3abb2" strokeDasharray="5 4" strokeWidth="1" />
        <text x={W - padR - 2} y={y(mean) - 4} textAnchor="end" fontSize="10.5" fill="#a3abb2" fontFamily="var(--font-mono)">平均 {fmtPct(mean)}</text>
        {/* 水位 */}
        {lifted && (
          <>
            <line x1={padL} x2={W - padR} y1={y(min0)} y2={y(min0)} stroke="#e5342e" strokeDasharray="3 3" strokeWidth="1" opacity="0.7" />
            <text x={padL + 4} y={y(min0) + 11} fontSize="9" fill="#e5342e" fontFamily="var(--font-mono)">修复前 {fmtPct(min0)}</text>
          </>
        )}
        <g style={{ transform: `translateY(${y(min1)}px)`, transition: "transform .5s cubic-bezier(.2,.8,.2,1)" }}>
          <line x1={padL} x2={W - padR} y1={0} y2={0} stroke={lifted ? "#7fd1a8" : "#ffb020"} strokeWidth="2" />
          <rect x={padL + 4} y={-18} width={174} height={15} rx="2" fill="#0b0d0e" opacity="0.9" />
          <text x={padL + 8} y={-7} fontSize="10.5" fontWeight="700" fill={lifted ? "#7fd1a8" : "#ffb020"} fontFamily="var(--font-mono)">
            木桶水位 = 最短板 {fmtPct(min1)}
          </text>
        </g>
      </svg>
    </div>
  );
}

/* =====================================================================
   电芯热力网格（4 × 12）
   ===================================================================== */
export function CellGrid({
  cells,
  mode = "soh",
  selected,
  targets = [],
  done = [],
  onPick,
  cell = 22,
}: {
  cells: Cell[];
  mode?: "soh" | "temp";
  selected?: number | null;
  targets?: number[];
  done?: number[];
  onPick?: (id: number) => void;
  cell?: number;
}) {
  const mean = avg(cells.map((c) => c.soh));
  const color = (c: Cell) => {
    if (mode === "temp") {
      if (c.t >= 52) return "#e5342e";
      if (c.t >= T_ALLOW) return "#ffb020";
      const k = clamp((c.t - 30) / 15, 0, 1);
      return `rgba(255,176,32,${0.12 + k * 0.4})`;
    }
    const d = mean - c.soh;
    if (d > 0.1) return "#e5342e";
    if (d > 0.035) return `rgba(255,176,32,${clamp(0.45 + d * 3, 0.5, 0.95)})`;
    return "#3a4046";
  };
  return (
    <div className="grid gap-[3px]" style={{ gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }}>
      {cells.map((c) => {
        const sel = selected === c.id;
        const tgt = targets.includes(c.id);
        const dn = done.includes(c.id);
        return (
          <button
            key={c.id}
            onClick={() => onPick?.(c.id)}
            title={`#${c.id} SOH ${fmtPct(c.soh)} ${c.t.toFixed(1)}°C`}
            style={{ background: dn ? "#1f4a37" : color(c), height: cell }}
            className={cn(
              "num relative flex cursor-pointer items-center justify-center rounded-[2px] text-[8.5px] leading-none text-g-100/80 transition",
              sel ? "outline-2 outline-offset-1 outline-g-100" : tgt ? "outline-1 outline-offset-0 outline-amber-led" : ""
            )}
          >
            {dn ? <span className="text-ok">✓</span> : String(c.id).padStart(2, "0")}
            {c.flag === "replace" && <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-estop" />}
          </button>
        );
      })}
    </div>
  );
}

/* =====================================================================
   柜体前面板接线图：告诉工程师“该连什么、连哪个口”
   ===================================================================== */
export type PortKey = "mode" | "brg" | "ant" | "mnt";
export type PortState = "todo" | "active" | "done" | "dim";

const PORTS: Record<PortKey, { x: number; y: number; w: number; h: number; label: string; sub: string }> = {
  brg: { x: 98, y: 82, w: 58, h: 24, label: "BRG", sub: "CAN-A + 24V" },
  ant: { x: 170, y: 82, w: 50, h: 24, label: "ANT", sub: "4G 天线" },
  mnt: { x: 98, y: 132, w: 58, h: 24, label: "MNT", sub: "维护口" },
  mode: { x: 170, y: 128, w: 50, h: 30, label: "MAINT", sub: "维护模式" },
};

export function CabinetFront({
  ports,
  bridge,
  pulse,
  lamp = "warn",
}: {
  ports: Partial<Record<PortKey, PortState>>;
  bridge?: "idle" | "linked" | "off";
  pulse?: "idle" | "linked" | "off";
  lamp?: "ok" | "warn" | "crit" | "off";
}) {
  const stateOf = (k: PortKey): PortState => ports[k] ?? "dim";
  const lampColor = { ok: "#7fd1a8", warn: "#ffb020", crit: "#e5342e", off: "#3a4046" }[lamp];
  return (
    <svg viewBox="0 0 320 214" className="w-full" role="img" aria-label="柜体前面板接线示意">
      {/* 柜体 */}
      <rect x="76" y="8" width="156" height="198" rx="8" fill="#171a1d" stroke="#3a4046" />
      <rect x="82" y="14" width="144" height="186" rx="5" fill="none" stroke="#2a2f34" />
      {/* 状态灯 */}
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={98 + i * 14} cy={30} r="3.5" fill={i === 0 ? lampColor : "#2a2f34"} />
      ))}
      <text x="98" y="46" fontSize="7" fill="#565d65" fontFamily="var(--font-mono)">RUN · FLT · COM</text>
      {/* 急停 */}
      <circle cx="200" cy="34" r="15" fill="#2a1210" stroke="#ffb020" strokeWidth="2" strokeDasharray="3 2" />
      <circle cx="200" cy="34" r="10" fill="#e5342e" />
      <circle cx="197" cy="31" r="3" fill="#ff8a85" opacity="0.7" />
      <text x="200" y="58" textAnchor="middle" fontSize="7.5" fill="#e5342e" fontFamily="var(--font-mono)" fontWeight="700">E-STOP</text>
      {/* 面板 */}
      <rect x="88" y="68" width="132" height="106" rx="4" fill="#0b0d0e" stroke="#2a2f34" />
      {/* 铭牌 */}
      <text x="154" y="190" textAnchor="middle" fontSize="7" fill="#565d65" fontFamily="var(--font-mono)">RE-ESC · 前维护面板</text>

      {/* 设备 */}
      <g opacity={bridge === "off" ? 0.35 : 1}>
        <rect x="4" y="76" width="56" height="34" rx="4" fill="#1d2125" stroke={bridge === "linked" ? "#7fd1a8" : "#565d65"} />
        <text x="32" y="91" textAnchor="middle" fontSize="8.5" fill="#e8ebee" fontWeight="700" fontFamily="var(--font-mono)">Re-Bridge</text>
        <text x="32" y="102" textAnchor="middle" fontSize="7" fill="#7c848c">联网网关</text>
        <circle cx="53" cy="82" r="2" fill={bridge === "linked" ? "#7fd1a8" : "#ffb020"} />
      </g>
      <g opacity={pulse === "off" ? 0.35 : 1}>
        <rect x="4" y="136" width="56" height="40" rx="4" fill="#1d2125" stroke={pulse === "linked" ? "#7fd1a8" : "#565d65"} />
        <text x="32" y="152" textAnchor="middle" fontSize="8.5" fill="#e8ebee" fontWeight="700" fontFamily="var(--font-mono)">Re-Pulse</text>
        <text x="32" y="163" textAnchor="middle" fontSize="7" fill="#7c848c">脉冲修复仪</text>
        <circle cx="53" cy="142" r="2" fill={pulse === "linked" ? "#7fd1a8" : "#ffb020"} />
      </g>
      {/* 线缆 */}
      <path d="M60 94 C80 94 84 94 98 94" fill="none" stroke={bridge === "linked" ? "#7fd1a8" : "#3a4046"} strokeWidth="2.4" strokeDasharray={bridge === "linked" ? "6 4" : "2 4"} className={bridge === "linked" ? "anim-flow" : ""} />
      <path d="M60 156 C80 156 84 144 98 144" fill="none" stroke={pulse === "linked" ? "#7fd1a8" : "#3a4046"} strokeWidth="2.4" strokeDasharray={pulse === "linked" ? "6 4" : "2 4"} className={pulse === "linked" ? "anim-flow" : ""} />

      {/* 端口 */}
      {(Object.keys(PORTS) as PortKey[]).map((k) => {
        const p = PORTS[k];
        const st = stateOf(k);
        const stroke = st === "done" ? "#7fd1a8" : st === "active" ? "#ffb020" : "#3a4046";
        const fill = st === "done" ? "#1f4a37" : st === "active" ? "#2a2110" : "#171a1d";
        return (
          <g key={k} opacity={st === "dim" ? 0.4 : 1}>
            {st === "active" && (
              <rect x={p.x - 3} y={p.y - 3} width={p.w + 6} height={p.h + 6} rx="5" fill="none" stroke="#ffb020" strokeWidth="1.4" style={{ transformOrigin: `${p.x + p.w / 2}px ${p.y + p.h / 2}px`, animation: "pulse-ring 1.4s ease-out infinite" }} />
            )}
            <rect x={p.x} y={p.y} width={p.w} height={p.h} rx="3" fill={fill} stroke={stroke} strokeWidth={st === "dim" ? 1 : 1.6} />
            {k === "mode" ? (
              <rect x={p.x + p.w / 2 - 5} y={p.y + (st === "done" ? 15 : 5)} width="10" height="10" rx="1.5" fill={st === "done" ? "#7fd1a8" : "#7c848c"} />
            ) : (
              <>
                <circle cx={p.x + 11} cy={p.y + p.h / 2} r="4.5" fill="#0b0d0e" stroke={stroke} />
                <circle cx={p.x + 11} cy={p.y + p.h / 2} r="1.5" fill={stroke} />
                <text x={p.x + 21} y={p.y + p.h / 2 + 3} fontSize="9" fill="#e8ebee" fontWeight="700" fontFamily="var(--font-mono)">{p.label}</text>
              </>
            )}
            <text x={p.x + p.w / 2} y={p.y + p.h + 11} textAnchor="middle" fontSize="7.5" fill={st === "active" ? "#ffb020" : "#7c848c"}>
              {k === "mode" ? "" : p.sub}
            </text>
            {k === "mode" && (
              <text x={p.x + p.w / 2} y={p.y + p.h + 11} textAnchor="middle" fontSize="7.5" fill={st === "active" ? "#ffb020" : "#7c848c"}>
                {p.sub}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
