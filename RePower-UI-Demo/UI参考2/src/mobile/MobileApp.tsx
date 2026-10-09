import { useEffect, useState } from 'react';
import { BatteryFull, ClipboardList, QrCode, Signal, Wifi, Wrench, type LucideIcon } from 'lucide-react';
import { APP_ENGINEER } from '../data/fleet';
import { fmtClock } from '../data/model';
import { useStore, type MobileTab, type WorkOrder } from '../store/store';
import { KIND_META, Led, Priority } from '../components/ui';
import { useNow } from '../hooks';
import { cn } from '../utils/cn';
import { Tasks } from './Tasks';
import { FieldOps } from './FieldOps';
import { Passport } from './Passport';

function StatusBar() {
  const now = useNow(10000);
  return (
    <div className="flex h-[50px] shrink-0 items-end justify-between px-8 pb-1.5 text-[14px] font-semibold text-g-50">
      <span className="num">{fmtClock(now)}</span>
      <span className="flex items-center gap-1.5">
        <Signal size={15} />
        <Wifi size={15} />
        <BatteryFull size={20} />
      </span>
    </div>
  );
}

const TITLES: Record<MobileTab, string> = { tasks: '今日工单', ops: '现场作业', passport: '电池护照' };

function AppBar() {
  const { state } = useStore();
  const tab = state.ui.mobileTab;
  const active = state.orders.find((o) => o.id === state.ui.activeOrder && (o.status === 'onsite' || o.status === 'suspended'));
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-g-800 px-4 pb-2.5 pt-1">
      <div>
        <div className="flex items-center gap-1.5">
          <span className="label text-sig">RE·FIELD</span>
          <span className="label text-g-600">现场作业与电池护照</span>
        </div>
        <div className="text-[19px] font-semibold text-g-50">{TITLES[tab]}</div>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-right leading-tight">
          <div className="text-[12px] text-g-100">张伟 · L3</div>
          <div className="flex items-center justify-end gap-1 text-[10px] text-g-400">
            <Led tone={active ? (active.status === 'suspended' ? 'crit' : 'warn') : 'ok'} size={5} blink={!!active} />
            {active ? `作业中 · ${active.cabinetId}` : '在线 · 宁波'}
          </div>
        </div>
        <div className="grid h-9 w-9 place-items-center rounded-full bg-g-700 text-[13px] font-semibold text-g-50">张</div>
      </div>
    </div>
  );
}

function TabBar() {
  const { state, dispatch } = useStore();
  const tab = state.ui.mobileTab;
  const badge = state.orders.filter((o) => o.engineer === APP_ENGINEER && o.isNew && o.status === 'dispatched').length;
  const items: { key: MobileTab; label: string; icon: LucideIcon }[] = [
    { key: 'tasks', label: '工单', icon: ClipboardList },
    { key: 'ops', label: '作业', icon: Wrench },
    { key: 'passport', label: '护照', icon: QrCode },
  ];
  return (
    <div className="relative z-20 flex h-[80px] shrink-0 items-start justify-around border-t border-g-800 bg-g-950/95 px-6 pt-2 backdrop-blur">
      {items.map((it) => {
        const on = tab === it.key;
        const Icon = it.icon;
        return (
          <button
            key={it.key}
            onClick={() => dispatch({ type: 'NAV', patch: { mobileTab: it.key } })}
            className={cn('relative flex w-20 flex-col items-center gap-1 py-1', on ? 'text-sig' : 'text-g-400')}
          >
            {on && <span className="absolute -top-2 h-[3px] w-8 rounded-b bg-sig shadow-[0_0_10px_rgba(255,165,31,.8)]" />}
            <Icon size={22} />
            <span className="text-[11px] font-medium">{it.label}</span>
            {it.key === 'tasks' && badge > 0 && (
              <span className="absolute right-4 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-stop px-1 text-[9.5px] font-bold text-white">{badge}</span>
            )}
          </button>
        );
      })}
      <span className="absolute bottom-2 left-1/2 h-[5px] w-[134px] -translate-x-1/2 rounded-full bg-g-200/80" />
    </div>
  );
}

function PushBanner({ order, top }: { order: WorkOrder; top: number }) {
  const { dispatch } = useStore();
  const [show, setShow] = useState(true);
  useEffect(() => {
    const id = window.setTimeout(() => setShow(false), 7000);
    return () => window.clearTimeout(id);
  }, []);
  if (!show) return null;
  const K = KIND_META[order.kind];
  return (
    <button
      onClick={() => {
        dispatch({ type: 'NAV', patch: { mobileTab: 'tasks' } });
        setShow(false);
      }}
      className="absolute left-2.5 right-2.5 z-[70] animate-banner rounded-[20px] border border-sig/40 bg-g-850/95 p-3 text-left shadow-[0_20px_40px_-12px_rgba(0,0,0,.9)] backdrop-blur"
      style={{ top }}
    >
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-sig text-[9.5px] font-black text-g-1000">RE</span>
        <span className="text-[11px] text-g-400">RE·FIELD · 现在</span>
        <span className="ml-auto">
          <Priority p={order.priority} />
        </span>
      </div>
      <div className="mt-1.5 text-[13.5px] font-semibold text-g-50">
        新派单 · {order.cabinetId} {K.label}
      </div>
      <div className="mt-0.5 text-[12px] leading-snug text-g-300">
        {order.title}
        {order.targets.length ? ` · 首颗建议 ${order.targets[0].current} A` : ''} · 来自 {order.source === 'field' ? '现场' : 'RE/OPS 中台'}
      </div>
    </button>
  );
}

export function MobileApp({ framed = true }: { framed?: boolean }) {
  const { state } = useStore();
  const tab = state.ui.mobileTab;
  const newest = state.orders.find((o) => o.isNew && o.engineer === APP_ENGINEER && o.status === 'dispatched');
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-g-925 text-g-100">
      {framed && <StatusBar />}
      <AppBar />
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {tab === 'tasks' && <Tasks />}
        {tab === 'ops' && <FieldOps />}
        {tab === 'passport' && <Passport />}
      </div>
      <TabBar />
      {newest && <PushBanner key={newest.id} order={newest} top={framed ? 52 : 8} />}
    </div>
  );
}
