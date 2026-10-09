import { BatteryMedium, ClipboardList, JapaneseYen, LayoutGrid, RadioTower, type LucideIcon } from 'lucide-react';
import { useFleet, useStore, type PcPage } from '../store/store';
import { Led } from '../components/ui';
import { cn } from '../utils/cn';
import { Overview } from './Overview';
import { OfflineRescue } from './OfflineRescue';
import { Diagnostics } from './Diagnostics';
import { Revenue } from './Revenue';
import { WorkOrders } from './WorkOrders';

interface NavItem {
  key: PcPage;
  label: string;
  en: string;
  verb: string;
  icon: LucideIcon;
  q: string;
}

export const PC_NAV: NavItem[] = [
  { key: 'overview', label: '资产总览', en: 'FLEET OVERVIEW', verb: '可看', icon: LayoutGrid, q: '我的储能柜现在健康吗？在线、健康与"看不见的损失"一屏看清' },
  { key: 'rescue', label: '断网救援', en: 'OFFLINE RESCUE', verb: '可看', icon: RadioTower, q: '断网了吗？失联柜在盲区里亏多少，Re-Bridge 如何把它救回来' },
  { key: 'diagnose', label: '木桶诊断', en: 'BUCKET DIAGNOSIS', verb: '可算', icon: BatteryMedium, q: '电芯木桶效应让我每个月白白损失多少钱？短板在哪颗电芯？' },
  { key: 'revenue', label: '收益订阅', en: 'REVENUE & PLAN', verb: '可变现', icon: JapaneseYen, q: '订阅服务值不值？每 ¥1 订阅费能追回多少？退役资产值多少钱？' },
  { key: 'orders', label: '工单中心', en: 'DISPATCH CENTER', verb: '可派单', icon: ClipboardList, q: '把诊断变成派单：谁去、做什么、做完追回多少钱' },
];

function HwRow({ name, sub, value, tone }: { name: string; sub: string; value: string; tone: 'ok' | 'warn' }) {
  return (
    <div className="flex items-center gap-2.5">
      <Led tone={tone} size={7} />
      <div className="min-w-0 flex-1 leading-tight">
        <div className="text-[12px] font-medium text-g-100">{name}</div>
        <div className="text-[10.5px] text-g-500">{sub}</div>
      </div>
      <span className="num text-[11px] text-g-300">{value}</span>
    </div>
  );
}

export function PcConsole({ compact = false }: { compact?: boolean }) {
  const { state, dispatch } = useStore();
  const f = useFleet();
  const page = state.ui.pcPage;
  const pending = state.orders.filter((o) => o.status === 'pending' || o.status === 'review').length;
  const suspended = state.orders.some((o) => o.status === 'suspended');
  const badge: Partial<Record<PcPage, { n: number; tone: 'warn' | 'crit' }>> = {
    rescue: f.offline ? { n: f.offline, tone: 'crit' } : undefined,
    diagnose: f.critical ? { n: f.critical, tone: 'crit' } : undefined,
    orders: pending || suspended ? { n: pending + (suspended ? 1 : 0), tone: suspended ? 'crit' : 'warn' } : undefined,
  };
  const meta = PC_NAV.find((n) => n.key === page)!;
  const bridges = state.cabinets.filter((c) => c.link === 'Re-Bridge').length;
  const pulsesBusy = state.orders.filter((o) => o.kind === 'balance' && (o.status === 'onsite' || o.status === 'suspended')).length;

  return (
    <div className="flex h-full min-h-0 w-full">
      <aside className={cn('flex shrink-0 flex-col border-r border-g-800 bg-g-925', compact ? 'w-[68px]' : 'w-[220px]')}>
        <div className={cn('border-b border-g-800 py-3.5', compact ? 'px-2 text-center' : 'px-4')}>
          <div className="label text-g-500">{compact ? 'OPS' : 'RE/OPS CONSOLE'}</div>
          {!compact && <div className="mt-1 text-[12px] text-g-300">PC 中台 · 资产救援与收益管理</div>}
        </div>
        <nav className="flex flex-col gap-1 p-2">
          {PC_NAV.map((n) => {
            const active = n.key === page;
            const b = badge[n.key];
            const Icon = n.icon;
            return (
              <button
                key={n.key}
                onClick={() => dispatch({ type: 'NAV', patch: { pcPage: n.key } })}
                title={n.label}
                className={cn(
                  'relative flex items-center gap-3 rounded-md transition-colors',
                  compact ? 'h-12 justify-center' : 'h-11 px-3',
                  active ? 'bg-g-800 text-g-50' : 'text-g-400 hover:bg-g-850 hover:text-g-200',
                )}
              >
                {active && <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r bg-sig shadow-[0_0_10px_rgba(255,165,31,.8)]" />}
                <Icon size={17} className={active ? 'text-sig' : ''} />
                {!compact && (
                  <>
                    <span className="text-[13px] font-medium">{n.label}</span>
                    <span className="label ml-auto text-[9px]">{n.verb}</span>
                  </>
                )}
                {b && (
                  <span
                    className={cn(
                      'num absolute grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9.5px] font-bold',
                      compact ? 'right-1.5 top-1' : 'right-[52px]',
                      b.tone === 'crit' ? 'bg-stop text-white' : 'bg-sig text-g-1000',
                    )}
                  >
                    {b.n}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-g-800 p-3">
          {!compact ? (
            <div className="space-y-2.5">
              <div className="label">硬件在网 · 同源 CMF</div>
              <HwRow name="Re-Bridge" sub="通讯救援网关" value={`${bridges} 台在线`} tone="warn" />
              <HwRow name="Re-Pulse" sub="电芯注入均衡仪" value={pulsesBusy ? `${pulsesBusy} 台作业中` : '4 台待命'} tone={pulsesBusy ? 'warn' : 'ok'} />
              <div className="flex items-center gap-2.5 border-t border-g-800 pt-3">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-g-700 text-[12px] font-semibold text-g-100">刘</div>
                <div className="leading-tight">
                  <div className="text-[12px] text-g-100">刘总 · 能源总监</div>
                  <div className="text-[10.5px] text-g-500">长三角 / 珠三角 · {f.total} 台柜</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <Led tone="warn" />
              <span className="label text-[8.5px]">{bridges} RB</span>
            </div>
          )}
        </div>
      </aside>

      <main className="dotgrid min-w-0 flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 border-b border-g-800 bg-g-950/85 px-6 py-3.5 backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="label">
                {meta.en} · <span className="text-sig">{meta.verb}</span>
              </div>
              <h1 className="mt-1 text-[19px] font-semibold tracking-wide text-g-50">{meta.label}</h1>
              <p className="mt-0.5 text-[12.5px] text-g-400">{meta.q}</p>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-g-400">
              <Led tone="ok" size={6} ping /> 实时 · {f.online} 台在线柜 1 Hz 汇聚
            </div>
          </div>
        </div>
        <div className="@container p-6">
          {page === 'overview' && <Overview />}
          {page === 'rescue' && <OfflineRescue />}
          {page === 'diagnose' && <Diagnostics />}
          {page === 'revenue' && <Revenue />}
          {page === 'orders' && <WorkOrders />}
        </div>
      </main>
    </div>
  );
}
