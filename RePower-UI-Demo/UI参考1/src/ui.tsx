import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "./utils/cn";
import { useStore, type Tone } from "./store";
import type { Display } from "./model";

/* ---------------- 图标 ---------------- */
const P: Record<string, ReactNode> = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  wrench: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" />,
  wallet: <><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M3 10h18M16 15h2" /></>,
  list: <><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>,
  wifi: <><path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0" /><circle cx="12" cy="19" r="1" /></>,
  wifiOff: <><path d="M2 9a15 15 0 0 1 5-3M22 9a15 15 0 0 0-6-3.4M5 12.5a10 10 0 0 1 3-2M19 12.5a10 10 0 0 0-3.5-2.3M8.5 16a5 5 0 0 1 3.5-1.4M15.5 16A5 5 0 0 0 14 15" /><circle cx="12" cy="19" r="1" /><path d="m3 3 18 18" /></>,
  thermo: <path d="M10 4a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z" />,
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  phone: <><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M11 18h2" /></>,
  monitor: <><rect x="2" y="4" width="20" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>,
  split: <><rect x="2" y="5" width="13" height="10" rx="1.5" /><rect x="17" y="7" width="5" height="10" rx="1.5" /><path d="M6 19h5" /></>,
  chev: <path d="m9 6 6 6-6 6" />,
  check: <path d="m5 12 5 5 9-10" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  qr: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20h1" /></>,
  alert: <><path d="M12 3 22 21H2z" /><path d="M12 10v5M12 18v.01" /></>,
  stop: <path d="M8 2h8l6 6v8l-6 6H8l-6-6V8z" />,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  pin: <><path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.5 3.6-7 8-7s8 2.5 8 7" /></>,
  id: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M6 16c.6-1.6 1.7-2.2 3-2.2s2.4.6 3 2.2M15 10h3M15 14h3" /></>,
  cpu: <><rect x="6" y="6" width="12" height="12" rx="1.5" /><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" /></>,
  play: <path d="M7 4v16l13-8z" />,
  refresh: <><path d="M20 11a8 8 0 0 0-14-4L4 9M4 4v5h5M4 13a8 8 0 0 0 14 4l2-2M20 20v-5h-5" /></>,
  tag: <><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="8.5" r="1.2" /></>,
  down: <path d="m6 9 6 6 6-6" />,
  plug: <><path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0z" /><path d="M12 18v4" /></>,
  fire: <path d="M12 22c4 0 7-2.8 7-7 0-3-1.8-5-3.5-7-.5 2-1.5 3-3 3 0-3-1-6-3.5-8C8.5 8 5 10 5 15c0 4.2 3 7 7 7z" />,
};

export function Icon({ name, size = 16, className, stroke = 1.7 }: { name: keyof typeof P | string; size?: number; className?: string; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" className={cn("flex-none", className)} aria-hidden>
      {P[name]}
    </svg>
  );
}

/* ---------------- 状态灯 / 徽标 ---------------- */
export const STATE_META: Record<Display, { label: string; lamp: string; text: string; ring: string; bg: string }> = {
  healthy: { label: "健康", lamp: "lamp-ok", text: "text-ok", ring: "border-ok/30", bg: "bg-ok/10" },
  warning: { label: "预警", lamp: "lamp-warn", text: "text-amber-led", ring: "border-amber-led/40", bg: "bg-amber-led/10" },
  critical: { label: "严重", lamp: "lamp-crit", text: "text-estop", ring: "border-estop/50", bg: "bg-estop/10" },
  offline: { label: "离线", lamp: "lamp-off", text: "text-g-300", ring: "border-g-600", bg: "bg-g-700/40" },
};

export function Lamp({ d, className }: { d: Display; className?: string }) {
  return <span className={cn("lamp", STATE_META[d].lamp, className)} />;
}

export function StateBadge({ d, label }: { d: Display; label?: string }) {
  const m = STATE_META[d];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-[11px] font-medium", m.ring, m.bg, m.text)}>
      <Lamp d={d} className="!h-1.5 !w-1.5" />
      {label ?? m.label}
    </span>
  );
}

export function Chip({ children, tone = "mute", className }: { children: ReactNode; tone?: "mute" | "amber" | "red" | "ok"; className?: string }) {
  const t = {
    mute: "border-g-600 text-g-300 bg-g-800/60",
    amber: "border-amber-led/40 text-amber-led bg-amber-led/10",
    red: "border-estop/50 text-estop bg-estop/10",
    ok: "border-ok/30 text-ok bg-ok/10",
  }[tone];
  return <span className={cn("inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10.5px] font-medium leading-none", t, className)}>{children}</span>;
}

/* ---------------- 按钮 / 分段 / 滑杆 ---------------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "subtle"; size?: "sm" | "md" | "lg" };
export function Btn({ variant = "ghost", size = "md", className, ...rest }: BtnProps) {
  const v = {
    primary: "bg-amber-led text-g-950 hover:brightness-110 font-semibold shadow-[0_0_0_1px_rgba(0,0,0,.4)_inset]",
    ghost: "border border-g-600 text-g-200 hover:bg-g-800 hover:border-g-500",
    subtle: "bg-g-800 text-g-200 hover:bg-g-700",
    danger: "bg-estop text-white hover:brightness-110 font-semibold",
  }[variant];
  const s = { sm: "h-7 px-2.5 text-xs gap-1", md: "h-9 px-3.5 text-[13px] gap-1.5", lg: "h-11 px-5 text-sm gap-2" }[size];
  return (
    <button
      {...rest}
      className={cn("inline-flex cursor-pointer items-center justify-center rounded-[4px] transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100", v, s, className)}
    />
  );
}

export function Seg<T extends string>({ options, value, onChange, className, size = "md" }: { options: { v: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; className?: string; size?: "sm" | "md" }) {
  return (
    <div className={cn("inline-flex rounded-[5px] border border-g-700 bg-g-950 p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={cn(
            "cursor-pointer rounded-[3px] font-medium transition",
            size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3.5 py-1.5 text-xs",
            value === o.v ? "bg-g-700 text-amber-led shadow-[inset_0_-2px_0_var(--color-amber-led)]" : "text-g-400 hover:text-g-200"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SliderField({ label, value, min, max, step, unit, onChange, hint, fmt }: { label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (v: number) => void; hint?: string; fmt?: (v: number) => string }) {
  return (
    <div>
      <div className="mb-0.5 flex items-baseline justify-between">
        <span className="text-xs text-g-300">{label}</span>
        <span className="num text-sm font-medium text-amber-led">
          {fmt ? fmt(value) : value}
          <span className="ml-0.5 text-[11px] text-g-400">{unit}</span>
        </span>
      </div>
      <input className="slider" type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      {hint && <div className="mt-0.5 text-[10.5px] text-g-500">{hint}</div>}
    </div>
  );
}

/* ---------------- 小图表 ---------------- */
export function Spark({ data, w = 80, h = 24, color = "var(--color-amber-led)", fill = true }: { data: number[]; w?: number; h?: number; color?: string; fill?: boolean }) {
  if (data.length < 2) return <svg width={w} height={h} />;
  const mn = Math.min(...data);
  const mx = Math.max(...data);
  const sx = w / (data.length - 1);
  const pts = data.map((d, i) => [i * sx, h - 2 - ((d - mn) / (mx - mn || 1)) * (h - 4)] as const);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("");
  return (
    <svg width={w} height={h} className="flex-none overflow-visible">
      {fill && <path d={`${line}L${w} ${h}L0 ${h}Z`} fill={color} opacity={0.12} />}
      <path d={line} fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
    </svg>
  );
}

export function Ring({ value, size = 56, stroke = 5, color = "var(--color-amber-led)", children }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-g-700)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="butt" strokeDasharray={`${c * Math.min(1, Math.max(0, value))} ${c}`} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

/* ---------------- Toast ---------------- */
const TONE: Record<Tone, string> = {
  info: "border-g-500 text-g-100",
  ok: "border-ok/50 text-ok",
  warn: "border-amber-led/60 text-amber-led",
  crit: "border-estop/70 text-estop",
};
export function ToastStack({ target, className }: { target: "pc" | "mobile"; className?: string }) {
  const { state, dispatch } = useStore();
  const mine = state.toasts.filter((t) => t.target === target);
  useEffect(() => {
    const timers = mine.map((t) => setTimeout(() => dispatch({ type: "dismiss", id: t.id }), 5200));
    return () => timers.forEach(clearTimeout);
  }, [mine.map((t) => t.id).join(","), dispatch]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={cn("pointer-events-none absolute z-50 flex flex-col gap-2", className)}>
      {mine.map((t) => (
        <div key={t.id} className={cn("anim-slide-in pointer-events-auto flex items-start gap-2 rounded-[5px] border bg-g-900/95 px-3 py-2 text-xs shadow-[0_8px_30px_rgba(0,0,0,.6)] backdrop-blur", TONE[t.tone])}>
          <span className={cn("lamp mt-1", t.tone === "crit" ? "lamp-crit" : t.tone === "warn" ? "lamp-warn" : t.tone === "ok" ? "lamp-ok" : "lamp-off")} />
          <span className="flex-1 leading-relaxed text-g-100">{t.text}</span>
          <button onClick={() => dispatch({ type: "dismiss", id: t.id })} className="cursor-pointer text-g-500 hover:text-g-200">
            <Icon name="x" size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ---------------- 其他 ---------------- */
export function SectionTitle({ children, right, sub }: { children: ReactNode; right?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <div className="flex items-center gap-2 text-[13px] font-semibold tracking-wide text-g-100">
          <span className="h-3.5 w-[3px] bg-amber-led" />
          {children}
        </div>
        {sub && <div className="mt-0.5 pl-[11px] text-[11px] text-g-500">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
        <rect x="1" y="1" width="30" height="30" rx="6" fill="#1d2125" stroke="#3a4046" />
        <path d="M9 22V10h7a4 4 0 0 1 0 8h-7M16 18l6 4" fill="none" stroke="#ffb020" strokeWidth="2.4" strokeLinecap="square" />
        <circle cx="25" cy="7" r="2" fill="#ffb020" />
      </svg>
    </div>
  );
}
