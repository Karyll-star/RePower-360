import { Cloud, CalendarCheck, Wrench, Recycle } from 'lucide-react';
import type { ViewName } from '../three/Viewer';

interface Props {
  visible: boolean;
  onFocus: (v: ViewName) => void;
  onOpenSpecs: () => void;
}

const services = [
  { icon: Cloud, zh: '重新上云', en: 'Re-Cloud' },
  { icon: CalendarCheck, zh: '季度订阅', en: 'Quarterly Subscription' },
  { icon: Wrench, zh: '主动维护', en: 'Active Maintenance' },
  { icon: Recycle, zh: '回收转卖', en: 'Recycle & Resell' },
];

export function Logo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg viewBox="0 0 48 40" className="h-9 w-11 drop-shadow" aria-hidden>
        <path d="M2 2h24c8 0 13 5 13 12 0 5.5-3.2 9.4-8 11l11 13H30l-9.5-11.5H13V38H2z M13 11v8h12c2.4 0 4-1.6 4-4s-1.6-4-4-4z" fill="#fff" fillRule="evenodd" />
        <path d="M2 2l11 9v27H2z" fill="#cfd6de" />
      </svg>
      <div className="leading-tight">
        <div className="text-[22px] font-medium tracking-[0.28em] text-white">RE-ENERGY</div>
        <div className="text-[11px] tracking-wide text-slate-300">Re-energize a Sustainable Future</div>
      </div>
    </div>
  );
}

export function PosterOverlay({ visible, onFocus, onOpenSpecs }: Props) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 z-10 transition-opacity duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      {/* readability gradient on the right */}
      <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-gradient-to-l from-slate-950/45 via-slate-950/15 to-transparent lg:block" />

      <div className="absolute right-[4.5%] top-[11%] hidden w-[min(40vw,560px)] text-white lg:block">
        <h1 className="text-right font-bold tracking-wide text-white drop-shadow-lg" style={{ fontSize: 'clamp(28px,2.9vw,46px)' }}>
          让每一度电<span className="ml-[0.9em]">持续创造价值</span>
        </h1>
        <p className="mt-2 text-right font-light tracking-[0.12em] text-slate-200" style={{ fontSize: 'clamp(14px,1.25vw,20px)' }}>
          Keep Every kWh Creating Value
        </p>

        <div className="mt-[6%] text-[clamp(15px,1.3vw,21px)] tracking-wide text-slate-100">
          后市场<span className="mx-4 text-slate-400">·</span>储能设备全生命周期服务
        </div>

        <div className="pointer-events-auto mt-6 grid grid-cols-4 divide-x divide-slate-500/50">
          {services.map(({ icon: Icon, zh, en }) => (
            <button
              key={zh}
              onClick={onOpenSpecs}
              className="group flex cursor-pointer flex-col items-center px-2 py-1 text-center transition"
            >
              <Icon className="mb-3 h-8 w-8 stroke-[1.3] text-slate-100 transition group-hover:scale-110 group-hover:text-cyan-300" />
              <span className="text-[clamp(12px,1vw,15px)] font-medium text-white">{zh}</span>
              <span className="mt-1 text-[clamp(10px,0.78vw,12px)] text-slate-300">{en}</span>
            </button>
          ))}
        </div>

        <div className="pointer-events-auto mt-[9%] grid grid-cols-2 divide-x divide-slate-500/50">
          <button onClick={() => onFocus('repulse')} className="group cursor-pointer pr-6 text-left">
            <div className="text-[clamp(15px,1.25vw,20px)] font-semibold tracking-[0.12em] text-white group-hover:text-cyan-300">RE-PULSE</div>
            <div className="mt-1.5 text-[clamp(12px,0.95vw,15px)] font-medium text-slate-100">移动式储能电芯主动活化巡检工作站</div>
            <div className="mt-1 text-[clamp(10px,0.72vw,11.5px)] text-slate-300">Mobile Energy Cell Activation &amp; Diagnostic Station</div>
          </button>
          <button onClick={() => onFocus('bridge')} className="group cursor-pointer pl-6 text-left">
            <div className="text-[clamp(15px,1.25vw,20px)] font-semibold tracking-[0.12em] text-white group-hover:text-cyan-300">RE-BRIDGE</div>
            <div className="mt-1.5 text-[clamp(12px,0.95vw,15px)] font-medium text-slate-100">磁吸式多协议边缘网关</div>
            <div className="mt-1 text-[clamp(10px,0.72vw,11.5px)] text-slate-300">Magnetic Multi-Protocol Edge Gateway</div>
          </button>
        </div>
      </div>

      {/* compact headline for small screens */}
      <div className="absolute left-5 right-5 top-20 text-white lg:hidden">
        <h1 className="text-2xl font-bold">让每一度电 持续创造价值</h1>
        <p className="mt-1 text-xs tracking-widest text-slate-300">Keep Every kWh Creating Value</p>
      </div>

      <div className="absolute bottom-6 left-[4.3%] hidden text-[13px] tracking-wide text-slate-300 xl:block">
        Smarter Maintenance <span className="mx-3 text-slate-500">|</span> Greener Energy <span className="mx-3 text-slate-500">|</span> Longer Value
      </div>
      <div className="absolute bottom-6 right-[4.3%] hidden text-[12px] tracking-wide text-slate-300 xl:block">
        RE-ENERGY <span className="mx-2 text-slate-500">·</span> Product Series
      </div>
    </div>
  );
}
