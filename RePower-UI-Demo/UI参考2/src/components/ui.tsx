import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { ClipboardCheck, RadioTower, Recycle, Zap, type LucideIcon } from 'lucide-react';
import { cn } from '../utils/cn';
import type { Status, Tone } from '../data/model';
import type { OrderKind, OrderStatus } from '../store/store';

export const STATUS_META: Record<Status, { label: string; tone: Tone; en: string }> = {
  healthy: { label: '健康', tone: 'ok', en: 'NORMAL' },
  attention: { label: '关注', tone: 'warn', en: 'WATCH' },
  critical: { label: '告警', tone: 'crit', en: 'ALARM' },
  offline: { label: '失联', tone: 'off', en: 'OFFLINE' },
};

export const KIND_META: Record<OrderKind, { label: string; icon: LucideIcon }> = {
  balance: { label: '电芯均衡', icon: Zap },
  rescue: { label: '断网救援', icon: RadioTower },
  inspect: { label: '巡检排查', icon: ClipboardCheck },
  retire: { label: '退役评估', icon: Recycle },
};

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  pending: { label: '待派单', tone: 'warn' },
  dispatched: { label: '已派单', tone: 'info' },
  accepted: { label: '已接单 · 在途', tone: 'info' },
  onsite: { label: '现场作业中', tone: 'warn' },
  suspended: { label: '急停挂起', tone: 'crit' },
  review: { label: '待验收', tone: 'warn' },
  done: { label: '已完成', tone: 'ok' },
};

export const toneText: Record<Tone, string> = {
  ok: 'text-ok',
  warn: 'text-sig',
  crit: 'text-stop-hi',
  off: 'text-g-400',
  info: 'text-g-200',
};

const toneChip: Record<Tone, string> = {
  ok: 'border-g-600 text-g-100',
  warn: 'border-sig/50 text-sig bg-sig/[0.06]',
  crit: 'border-stop/60 text-stop-hi bg-stop/10',
  off: 'border-dashed border-g-500 text-g-400',
  info: 'border-g-600 text-g-200',
};

const ledCls: Record<Tone, string> = { ok: 'led-ok', warn: 'led-warn', crit: 'led-crit', off: 'led-off', info: 'led-info' };

export function Led({ tone, blink, size = 8, ping, className }: { tone: Tone; blink?: boolean; size?: number; ping?: boolean; className?: string }) {
  return (
    <span className={cn('relative inline-flex shrink-0', className)} style={{ width: size, height: size }}>
      {ping && tone !== 'off' && <span className={cn('led absolute inset-0 animate-ping-soft', ledCls[tone])} style={{ width: size, height: size }} />}
      <span className={cn('led relative', ledCls[tone], blink && 'animate-blink')} style={{ width: size, height: size }} />
    </span>
  );
}

export function Chip({ tone = 'info', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-[4px] border px-1.5 py-[1px] text-[11px] font-medium', toneChip[tone], className)}>{children}</span>;
}

export function StatusTag({ status, className }: { status: Status; className?: string }) {
  const m = STATUS_META[status];
  return (
    <Chip tone={m.tone} className={className}>
      <Led tone={m.tone} size={6} blink={status === 'critical'} />
      {m.label}
    </Chip>
  );
}

export function Screws() {
  return (
    <>
      <i className="screw left-[7px] top-[7px]" />
      <i className="screw right-[7px] top-[7px]" />
      <i className="screw bottom-[7px] left-[7px]" />
      <i className="screw bottom-[7px] right-[7px]" />
    </>
  );
}

export function Panel({
  title, code, right, children, className, bodyClass, screws = true,
}: { title?: ReactNode; code?: string; right?: ReactNode; children: ReactNode; className?: string; bodyClass?: string; screws?: boolean }) {
  return (
    <section className={cn('panel', className)}>
      {screws && <Screws />}
      {(title || right) && (
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-g-750 px-5 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {code && <span className="label text-g-500">{code}</span>}
            <h3 className="truncate text-[13px] font-semibold tracking-wide text-g-100">{title}</h3>
          </div>
          {right}
        </header>
      )}
      <div className={cn('p-5', bodyClass)}>{children}</div>
    </section>
  );
}

type BtnVariant = 'primary' | 'ghost' | 'danger' | 'outline' | 'subtle';
export function Btn({
  variant = 'ghost', size = 'md', icon, className, children, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'; icon?: ReactNode }) {
  const v: Record<BtnVariant, string> = {
    primary: 'bg-sig text-g-1000 font-semibold hover:bg-sig-hi shadow-[0_0_0_1px_rgba(255,165,31,.6),0_8px_22px_-10px_rgba(255,165,31,.8)]',
    ghost: 'border border-g-650 bg-g-800 text-g-100 hover:bg-g-750',
    outline: 'border border-sig/60 text-sig hover:bg-sig/10',
    danger: 'bg-stop font-semibold text-white hover:bg-stop-hi shadow-[0_0_0_1px_rgba(232,53,46,.7),0_8px_22px_-10px_rgba(232,53,46,.85)]',
    subtle: 'text-g-300 hover:bg-g-800 hover:text-g-100',
  };
  const s = { sm: 'h-7 gap-1.5 px-2.5 text-xs', md: 'h-9 gap-2 px-3.5 text-[13px]', lg: 'h-12 gap-2.5 px-5 text-[15px]' }[size];
  return (
    <button
      className={cn('inline-flex shrink-0 items-center justify-center rounded-md transition-colors disabled:opacity-40', v[variant], s, className)}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

export function Seg<T extends string>({
  value, options, onChange, size = 'md', className,
}: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; size?: 'sm' | 'md'; className?: string }) {
  return (
    <div className={cn('inline-flex rounded-md border border-g-700 bg-g-950 p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex items-center gap-1.5 whitespace-nowrap rounded-[5px] px-2.5 transition-colors',
            size === 'sm' ? 'h-6 text-[11px]' : 'h-7 text-xs',
            value === o.value ? 'bg-g-700 text-g-50 shadow-[inset_0_1px_0_rgba(255,255,255,.07)]' : 'text-g-400 hover:text-g-200',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Range({
  value, min, max, step = 1, onChange, className, fill,
}: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; className?: string; fill?: string }) {
  const p = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      className={cn('range', className)}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ '--p': `${p}%`, '--fill': fill ?? '#ffa51f' } as CSSProperties}
    />
  );
}

export function Toggle({ on, onChange, size = 'md' }: { on: boolean; onChange: (v: boolean) => void; size?: 'sm' | 'md' }) {
  const w = size === 'sm' ? 'h-5 w-9' : 'h-6 w-11';
  const k = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  return (
    <button
      onClick={() => onChange(!on)}
      className={cn('relative shrink-0 rounded-full border transition-colors', w, on ? 'border-sig/70 bg-sig/25' : 'border-g-600 bg-g-900')}
    >
      <span
        className={cn('absolute left-[1px] top-1/2 rounded-full transition-all', k, on ? 'bg-sig shadow-[0_0_10px_rgba(255,165,31,.8)]' : 'bg-g-500')}
        style={{ transform: `translate(${on ? (size === 'sm' ? 16 : 20) : 0}px, -50%)` }}
      />
    </button>
  );
}

export function Kv({ k, v, className }: { k: ReactNode; v: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 text-[12.5px]', className)}>
      <span className="text-g-400">{k}</span>
      <span className="num text-g-100">{v}</span>
    </div>
  );
}

export function Priority({ p }: { p: 'P1' | 'P2' | 'P3' }) {
  return (
    <span
      className={cn(
        'num rounded-[3px] px-1.5 py-[1px] text-[10px] font-bold',
        p === 'P1' ? 'bg-stop text-white' : p === 'P2' ? 'bg-sig text-g-1000' : 'bg-g-700 text-g-200',
      )}
    >
      {p}
    </span>
  );
}

export function Hazard({ className, red }: { className?: string; red?: boolean }) {
  return <div className={cn(red ? 'hazard-red' : 'hazard', className)} />;
}
