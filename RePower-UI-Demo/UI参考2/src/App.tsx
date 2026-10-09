import { Fragment, useEffect } from 'react';
import { Check, Monitor, MonitorSmartphone, Smartphone, X } from 'lucide-react';
import reBridgeImg from './assets/re-bridge.jpg';
import rePulseImg from './assets/re-pulse.jpg';
import { StoreProvider, useStore, type Milestones, type MobileTab, type Mode, type Toast } from './store/store';
import { PcConsole } from './pc/PcConsole';
import { MobileApp } from './mobile/MobileApp';
import { PhoneFrame } from './mobile/PhoneFrame';
import { Led, Seg } from './components/ui';
import { useNow, useWindowSize } from './hooks';
import { cn } from './utils/cn';

const initialMode = (): Mode => {
  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w >= 1440) return 'split';
  return 'pc';
};

function Logo() {
  return (
    <div className="relative grid h-8 w-8 place-items-center rounded-md bg-g-800 ring-1 ring-g-600">
      <span className="num text-[11px] font-black tracking-tight text-g-50">RE</span>
      <span className="led led-warn absolute -right-0.5 -top-0.5 h-2 w-2" />
    </div>
  );
}

function TopBar() {
  const { state, dispatch } = useStore();
  const now = useNow(1000);
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <header className="brushed relative z-30 flex h-[52px] shrink-0 items-center gap-4 border-b border-g-800 px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <Logo />
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[13px] font-semibold tracking-wide text-g-50">
            RE/OPS <span className="text-g-500">×</span> RE·FIELD
          </div>
          <div className="hidden truncate text-[10.5px] text-g-400 sm:block">工商业储能柜后市场 · 资产运营系统</div>
        </div>
      </div>
      <div className="hidden items-center gap-1.5 text-[11px] lg:flex">
        <span className="rounded border border-g-700 px-1.5 py-0.5 text-g-500 line-through decoration-g-500">重制造 · 坏了才修</span>
        <span className="text-g-600">→</span>
        <span className="rounded border border-sig/50 bg-sig/10 px-1.5 py-0.5 text-sig">轻运维 · 资产运营</span>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <Seg
          value={state.ui.mode}
          onChange={(m) => dispatch({ type: 'NAV', patch: { mode: m } })}
          options={[
            { value: 'pc', label: (<><Monitor size={13} /><span className="hidden sm:inline">PC 中台</span></>) },
            { value: 'mobile', label: (<><Smartphone size={13} /><span className="hidden sm:inline">移动 App</span></>) },
            { value: 'split', label: (<><MonitorSmartphone size={13} /><span className="hidden sm:inline">双端联动</span></>) },
          ]}
        />
        <div className="hidden items-center gap-2 md:flex">
          <Led tone="ok" size={6} />
          <span className="num text-[12px] text-g-300">
            {d.getFullYear()}-{pad(d.getMonth() + 1)}-{pad(d.getDate())} {pad(d.getHours())}:{pad(d.getMinutes())}:{pad(d.getSeconds())}
          </span>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-sig/50 to-transparent" />
    </header>
  );
}

function DemoRoute() {
  const { state, dispatch } = useStore();
  const { w } = useWindowSize();
  const wide = w >= 1280;
  const m = state.milestones;
  const pcMode: Mode = state.ui.mode === 'mobile' ? (wide ? 'split' : 'pc') : state.ui.mode;
  const fieldMode: Mode = wide ? 'split' : 'mobile';
  const steps: { key: keyof Milestones; verb: string; text: string; go: () => void }[] = [
    { key: 'seen', verb: '可看', text: '一屏看清健康与失联', go: () => dispatch({ type: 'NAV', patch: { mode: pcMode, pcPage: 'overview' } }) },
    { key: 'calc', verb: '可算', text: '算清木桶每月白损', go: () => dispatch({ type: 'NAV', patch: { mode: pcMode, pcPage: 'diagnose', selectedCab: 'NB-02' } }) },
    { key: 'dispatched', verb: '可派单', text: '一键推送到工程师 App', go: () => dispatch({ type: 'NAV', patch: { mode: pcMode, pcPage: 'diagnose', selectedCab: 'NB-02' } }) },
    {
      key: 'field', verb: '可执行', text: '接入 · 注入 · 温控 · 急停',
      go: () => dispatch({ type: 'NAV', patch: { mode: fieldMode, mobileTab: state.ui.activeOrder ? 'ops' : 'tasks' } }),
    },
    { key: 'cash', verb: '可变现', text: '验收追回 · 电池护照挂牌', go: () => dispatch({ type: 'NAV', patch: { mode: fieldMode, pcPage: 'orders', mobileTab: 'passport' } }) },
  ];
  const current = steps.findIndex((s) => !m[s.key]);
  return (
    <div className="no-scrollbar flex h-10 shrink-0 items-center gap-1 overflow-x-auto border-b border-g-800 bg-g-925 px-4">
      <span className="label mr-2 shrink-0">演示路径</span>
      {steps.map((s, i) => {
        const done = m[s.key];
        const cur = i === current;
        return (
          <Fragment key={s.key}>
            <button
              onClick={s.go}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-md px-2.5 py-1 text-[12px] transition-colors',
                cur ? 'bg-sig/10 text-sig ring-1 ring-sig/40' : done ? 'text-g-200 hover:bg-g-850' : 'text-g-500 hover:text-g-300',
              )}
            >
              <span
                className={cn(
                  'num grid h-[18px] w-[18px] place-items-center rounded-full border text-[10px]',
                  done ? 'border-sig bg-sig text-g-1000' : cur ? 'border-sig text-sig' : 'border-g-600',
                )}
              >
                {done ? <Check size={11} strokeWidth={3} /> : i + 1}
              </span>
              <b className="font-semibold">{s.verb}</b>
              <span className={cn('hidden xl:inline', cur ? 'text-sig/80' : 'text-g-500')}>{s.text}</span>
            </button>
            {i < steps.length - 1 && <span className={cn('h-px w-5 shrink-0', done ? 'bg-sig/50' : 'bg-g-700')} />}
          </Fragment>
        );
      })}
      <span className="ml-auto hidden shrink-0 pl-4 text-[11px] text-g-500 2xl:inline">中台与 App 共享同一份资产数据 · 派单与回传实时同步</span>
    </div>
  );
}

function PhoneDock({ scale }: { scale: number }) {
  return (
    <aside className="flex shrink-0 flex-col items-center border-l border-g-800 bg-g-925/80 px-5 pt-3" style={{ width: 390 * scale + 40 }}>
      <div className="mb-2.5 flex w-full items-center justify-between">
        <span className="label">FIELD APP · 张工的手机</span>
        <span className="flex items-center gap-1.5 text-[10.5px] text-g-400">
          <Led tone="warn" size={6} blink /> 与中台实时联动
        </span>
      </div>
      <PhoneFrame scale={scale}>
        <MobileApp />
      </PhoneFrame>
    </aside>
  );
}

function HardwareCard({ img, name, role, specs }: { img: string; name: string; role: string; specs: string[] }) {
  return (
    <div className="panel overflow-hidden">
      <img src={img} alt={name} className="h-40 w-full object-cover" />
      <div className="p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[15px] font-semibold text-g-50">{name}</span>
          <span className="label text-sig">{role}</span>
        </div>
        <ul className="mt-2 space-y-1 text-[12px] text-g-400">
          {specs.map((s) => (
            <li key={s}>· {s}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function MobileShowcase({ scale }: { scale: number }) {
  const { state, dispatch } = useStore();
  const hasActive = state.orders.some((o) => o.id === state.ui.activeOrder && o.status !== 'done');
  const opsTab: MobileTab = hasActive ? 'ops' : 'tasks';
  const Q: { q: string; a: string; tab: MobileTab }[] = [
    { q: '到了柜子前，该连什么？', a: 'Re-Bridge 接 BMS 通讯口（CAN_H / CAN_L / GND），Re-Pulse 夹具接目标电芯极柱；极性自检通过才放行。', tab: opsTab },
    { q: '给哪颗电芯注入多大电流？', a: '中台按 SOC 偏差算好清单：例如 NB-02 的 P3-17 需补约 17 Ah → 10 A，约 1.7 小时；4 通道并行，现场可在安全范围内微调。', tab: opsTab },
    { q: '温度异常怎么办？', a: '≥ 45 °C 自动降流至 3 A 并弹出处置 SOP；≥ 55 °C 切断通道，一键急停并同步中台。', tab: opsTab },
    { q: '退役的电池还能卖多少钱？', a: '电池护照记录全生命周期数据，按 SOH / 一致性 / 碳酸锂价格给出梯次与回收估值，护照本身带来溢价。', tab: 'passport' },
  ];
  return (
    <div className="dotgrid flex min-h-0 flex-1 items-start justify-center gap-10 overflow-auto px-8 py-5">
      <aside className="hidden w-[300px] shrink-0 space-y-3 pt-2 xl:block">
        <div className="label text-sig">RE·FIELD · 现场作业与电池护照</div>
        <h2 className="text-[22px] font-semibold leading-snug text-g-50">
          工程师到了柜子前，
          <br />
          App 回答 4 个问题
        </h2>
        {Q.map((x, i) => (
          <button key={x.q} onClick={() => dispatch({ type: 'NAV', patch: { mobileTab: x.tab } })} className="panel-inset block w-full p-3.5 text-left transition-colors hover:border-g-600">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-g-50">
              <span className="num text-sig">0{i + 1}</span>
              {x.q}
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-g-400">{x.a}</p>
          </button>
        ))}
      </aside>
      <PhoneFrame scale={scale}>
        <MobileApp />
      </PhoneFrame>
      <aside className="hidden w-[300px] shrink-0 space-y-3 pt-2 lg:block">
        <div className="label">硬件同源 · 同一套 CMF</div>
        <HardwareCard img={rePulseImg} name="Re-Pulse" role="电芯注入均衡仪" specs={['4 通道 · 单通道 0–15 A', '极性反接锁止 · 接触电阻自检', '45 °C 降流 / 55 °C 切断（本地闭环）', '硬件急停 < 10 ms']} />
        <HardwareCard img={reBridgeImg} name="Re-Bridge" role="通讯救援网关" specs={['CAN / RS485 / Modbus · 37 种协议库', '只读旁路 · 不改原厂固件', '4G + 以太网 · 断网缓存 30 天']} />
        <div className="panel p-4">
          <div className="label mb-3">CMF · 界面与硬件同源</div>
          <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
            {[
              { n: '石墨灰', c: '#16191d', h: '#121418', ring: 'ring-g-600' },
              { n: '琥珀状态灯', c: '#ffa51f', h: '#FFA51F', ring: 'ring-sig/60' },
              { n: '急停红', c: '#e8352e', h: '#E8352E', ring: 'ring-stop/60' },
            ].map((s) => (
              <div key={s.n}>
                <div className={cn('mx-auto h-12 w-full rounded-md ring-1', s.ring)} style={{ background: s.c }} />
                <div className="mt-1.5 text-g-200">{s.n}</div>
                <div className="num text-[10px] text-g-500">{s.h}</div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function ToastItem({ t }: { t: Toast }) {
  const { state, dispatch } = useStore();
  useEffect(() => {
    const id = window.setTimeout(() => dispatch({ type: 'DISMISS', id: t.id }), 5500);
    return () => window.clearTimeout(id);
  }, [t.id, dispatch]);
  return (
    <div
      className={cn(
        'pointer-events-auto animate-rise overflow-hidden rounded-lg border bg-g-850/95 shadow-[0_18px_40px_-12px_rgba(0,0,0,.9)] backdrop-blur',
        t.tone === 'crit' ? 'border-stop/60' : t.tone === 'warn' || t.tone === 'ok' ? 'border-sig/50' : 'border-g-600',
      )}
    >
      <div className={cn('h-[3px]', t.tone === 'crit' ? 'hazard-red' : t.tone === 'warn' ? 'hazard' : t.tone === 'ok' ? 'bg-sig' : 'bg-g-600')} />
      <div className="flex gap-3 p-3">
        <Led tone={t.tone === 'off' ? 'info' : t.tone} className="mt-1" blink={t.tone === 'crit'} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] font-semibold text-g-50">{t.title}</span>
            <span className="label text-[9px]">{t.from === 'field' ? 'FROM APP' : t.from === 'console' ? 'CONSOLE' : 'SYSTEM'}</span>
          </div>
          <p className="mt-0.5 text-[12px] leading-snug text-g-300">{t.text}</p>
          {t.action === 'openApp' && state.ui.mode !== 'split' && (
            <button
              onClick={() => {
                dispatch({ type: 'NAV', patch: { mode: window.innerWidth >= 1280 ? 'split' : 'mobile', mobileTab: 'tasks' } });
                dispatch({ type: 'DISMISS', id: t.id });
              }}
              className="mt-1.5 text-[11.5px] font-semibold text-sig hover:underline"
            >
              在工程师 App 中查看 →
            </button>
          )}
        </div>
        <button onClick={() => dispatch({ type: 'DISMISS', id: t.id })} className="self-start text-g-500 hover:text-g-200" aria-label="关闭">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function Toasts() {
  const { state } = useStore();
  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-[100] flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {state.toasts.map((t) => (
        <ToastItem key={t.id} t={t} />
      ))}
    </div>
  );
}

function Shell() {
  const { state } = useStore();
  const { w, h } = useWindowSize();
  const mode = state.ui.mode;
  const dockScale = Math.max(0.6, Math.min(1, (h - 150) / 844));
  const showScale = Math.max(0.6, Math.min(1, (h - 132) / 844));
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-g-950 text-g-100">
      <TopBar />
      <DemoRoute />
      <div className="flex min-h-0 flex-1">
        {mode === 'pc' && <PcConsole />}
        {mode === 'split' && (
          <>
            <div className="min-w-0 flex-1">
              <PcConsole compact={w < 1700} />
            </div>
            <PhoneDock scale={dockScale} />
          </>
        )}
        {mode === 'mobile' &&
          (w < 640 ? (
            <div className="min-h-0 flex-1">
              <MobileApp framed={false} />
            </div>
          ) : (
            <MobileShowcase scale={showScale} />
          ))}
      </div>
      <Toasts />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider mode={initialMode()}>
      <Shell />
    </StoreProvider>
  );
}
