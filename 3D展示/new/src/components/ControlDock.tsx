import { useState } from 'react';
import {
  Image as ImageIcon,
  Box,
  Monitor,
  Cable,
  Router,
  ArrowDownToLine,
  Move3d,
  ChevronsUpDown,
  OctagonAlert,
  Layers,
  RotateCw,
  Sun,
  Activity,
  FileText,
  Camera,
  Tag,
} from 'lucide-react';
import type { LightPreset, ViewName } from '../three/Viewer';
import type { ScreenMode } from '../three/screenUI';

interface Props {
  view: ViewName;
  setView: (v: ViewName) => void;
  trolley: boolean;
  toggleTrolley: () => void;
  estop: boolean;
  toggleEStop: () => void;
  exploded: boolean;
  toggleExploded: () => void;
  autoRotate: boolean;
  toggleAutoRotate: () => void;
  light: LightPreset;
  setLight: (l: LightPreset) => void;
  screenMode: ScreenMode;
  setScreenMode: (m: ScreenMode) => void;
  labels: boolean;
  toggleLabels: () => void;
  openSpecs: () => void;
  screenshot: () => void;
}

const views: { id: ViewName; label: string; icon: typeof Box }[] = [
  { id: 'poster', label: '海报', icon: ImageIcon },
  { id: 'repulse', label: '工作站', icon: Box },
  { id: 'screen', label: '屏幕', icon: Monitor },
  { id: 'cables', label: '线缆舱', icon: Cable },
  { id: 'bridge', label: '网关', icon: Router },
  { id: 'top', label: '俯视', icon: ArrowDownToLine },
  { id: 'free', label: '自由', icon: Move3d },
];

const lights: { id: LightPreset; label: string }[] = [
  { id: 'studio', label: '海报影棚' },
  { id: 'night', label: '夜间巡检' },
  { id: 'lab', label: '实验室白光' },
  { id: 'dawn', label: '晨曦暖光' },
];

const modes: { id: ScreenMode; label: string }[] = [
  { id: 'activation', label: '脉冲活化' },
  { id: 'impedance', label: 'EIS 阻抗谱' },
  { id: 'diagnostic', label: '单体一致性' },
  { id: 'cloud', label: 'RE-CLOUD' },
];

function Tgl({ on, onClick, icon: Icon, label, danger }: { on: boolean; onClick: () => void; icon: typeof Box; label: string; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition ${
        on
          ? danger
            ? 'bg-red-500/25 text-red-200 ring-1 ring-red-400/60'
            : 'bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-300/50'
          : 'text-slate-300 hover:bg-white/5 hover:text-white'
      }`}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

export function ControlDock(p: Props) {
  const [menu, setMenu] = useState<'light' | 'screen' | null>(null);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex flex-col items-center gap-2 px-3 sm:bottom-14 xl:bottom-6">
      {menu && (
        <div className="pointer-events-auto flex flex-wrap justify-center gap-1 rounded-xl border border-white/10 bg-slate-950/75 p-1.5 backdrop-blur-xl">
          {(menu === 'light' ? lights : modes).map((o) => {
            const active = menu === 'light' ? p.light === o.id : p.screenMode === o.id;
            return (
              <button
                key={o.id}
                onClick={() => {
                  if (menu === 'light') p.setLight(o.id as LightPreset);
                  else p.setScreenMode(o.id as ScreenMode);
                }}
                className={`cursor-pointer rounded-lg px-3 py-1.5 text-[12px] transition ${
                  active ? 'bg-white text-slate-900' : 'text-slate-300 hover:bg-white/10'
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1 rounded-2xl border border-white/10 bg-slate-950/65 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <div className="flex items-center gap-0.5 rounded-xl bg-white/[0.04] p-0.5">
          {views.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => p.setView(id)}
              title={label}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition ${
                p.view === id ? 'bg-white text-slate-900 shadow' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden lg:inline">{label}</span>
            </button>
          ))}
        </div>

        <div className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />

        <Tgl on={p.trolley} onClick={p.toggleTrolley} icon={ChevronsUpDown} label="拉杆" />
        <Tgl on={p.estop} onClick={p.toggleEStop} icon={OctagonAlert} label="急停" danger />
        <Tgl on={p.exploded} onClick={p.toggleExploded} icon={Layers} label="爆炸图" />
        <Tgl on={p.autoRotate} onClick={p.toggleAutoRotate} icon={RotateCw} label="自转" />
        <Tgl on={p.labels} onClick={p.toggleLabels} icon={Tag} label="标注" />
        <Tgl on={menu === 'screen'} onClick={() => setMenu(menu === 'screen' ? null : 'screen')} icon={Activity} label="屏幕模式" />
        <Tgl on={menu === 'light'} onClick={() => setMenu(menu === 'light' ? null : 'light')} icon={Sun} label="灯光" />

        <div className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />

        <Tgl on={false} onClick={p.openSpecs} icon={FileText} label="规格" />
        <Tgl on={false} onClick={p.screenshot} icon={Camera} label="截图" />
      </div>
    </div>
  );
}
