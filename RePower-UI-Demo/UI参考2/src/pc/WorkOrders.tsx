import { useState } from 'react';
import { CheckCircle2, ChevronDown, Send } from 'lucide-react';
import { APP_ENGINEER, ENGINEERS } from '../data/fleet';
import { ago, yuan } from '../data/model';
import { useStore, type OrderStatus, type WorkOrder } from '../store/store';
import { Btn, KIND_META, Led, ORDER_STATUS, Panel, Priority, Seg } from '../components/ui';
import { useNow } from '../hooks';
import { cn } from '../utils/cn';

const COLS: { key: string; label: string; statuses: OrderStatus[] }[] = [
  { key: 'pending', label: '待派单', statuses: ['pending'] },
  { key: 'dispatched', label: '已派单 · 在途', statuses: ['dispatched', 'accepted'] },
  { key: 'onsite', label: '现场作业', statuses: ['onsite', 'suspended'] },
  { key: 'review', label: '待验收', statuses: ['review'] },
  { key: 'done', label: '已完成', statuses: ['done'] },
];

function OrderCard({ o, now }: { o: WorkOrder; now: number }) {
  const { dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [eng, setEng] = useState(APP_ENGINEER);
  const K = KIND_META[o.kind];
  const Icon = K.icon;
  return (
    <div
      className={cn(
        'animate-rise rounded-md border bg-g-850 p-3 transition-colors',
        o.status === 'suspended' ? 'glow-stop border-stop/60' : o.status === 'review' ? 'border-sig/50' : o.isNew ? 'border-sig/40' : 'border-g-700',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="num text-[11px] text-g-400">{o.id}</span>
        <div className="flex items-center gap-1.5">
          {o.isNew && o.status === 'dispatched' && <span className="label text-[9px] text-sig">NEW</span>}
          <Priority p={o.priority} />
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium text-g-50">
        <Icon size={14} className={o.kind === 'balance' ? 'text-sig' : 'text-g-300'} />
        <span className="num">{o.cabinetId}</span> · {K.label}
      </div>
      <p className="mt-1 text-[12px] leading-snug text-g-300">{o.title}</p>
      {o.targets.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {o.targets.map((t) => (
            <span key={t.idx} className="num rounded bg-g-950 px-1.5 py-0.5 text-[10.5px] text-sig">
              {t.label} · {t.current}A
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between text-[11px] text-g-400">
        <span className="flex items-center gap-1.5">
          <Led tone={ORDER_STATUS[o.status].tone} size={6} blink={o.status === 'suspended'} />
          {o.engineer ?? '未指派'} · {ORDER_STATUS[o.status].label}
        </span>
        <span>{ago(o.updatedAt, now)}</span>
      </div>

      {o.status === 'suspended' && <div className="mt-2 rounded bg-stop/15 px-2 py-1.5 text-[11px] text-stop-hi">现场急停 · Re-Pulse 输出已切断 · 等待复位</div>}

      {o.status === 'pending' && (
        <div className="mt-3 space-y-2 border-t border-g-750 pt-3">
          <Seg value={eng} onChange={setEng} size="sm" options={ENGINEERS.map((e) => ({ value: e.id, label: e.id }))} />
          <Btn size="sm" variant="primary" className="w-full" icon={<Send size={13} />} onClick={() => dispatch({ type: 'ASSIGN', id: o.id, engineer: eng })}>
            派单给 {eng}
          </Btn>
        </div>
      )}

      {(o.status === 'review' || o.status === 'done') && o.before && o.after && (
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-g-750 pt-3 text-[11px]">
          <div>
            <div className="text-g-500">末端压差</div>
            <div className="num text-g-100">
              {o.before.deltaV} → <span className="text-sig">{o.after.deltaV} mV</span>
            </div>
          </div>
          <div>
            <div className="text-g-500">{o.kind === 'rescue' ? '最高温度' : '每月追回'}</div>
            <div className="num text-sig">{o.kind === 'rescue' ? `${o.after.tMax.toFixed(1)} °C` : yuan(o.recovered ?? 0)}</div>
          </div>
        </div>
      )}

      {o.status === 'review' && (
        <Btn size="sm" variant="primary" className="mt-3 w-full" icon={<CheckCircle2 size={13} />} onClick={() => dispatch({ type: 'APPROVE', id: o.id })}>
          验收通过 · 计入收益
        </Btn>
      )}

      <button onClick={() => setOpen((v) => !v)} className="mt-2 flex w-full items-center justify-center gap-1 text-[10.5px] text-g-500 hover:text-g-300">
        作业日志 {o.log.length} 条 <ChevronDown size={12} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <ol className="mt-2 space-y-1.5 border-l border-g-700 pl-3">
          {o.log.map((l, i) => (
            <li key={i} className="relative text-[11px] leading-snug text-g-300">
              <span className={cn('absolute -left-[16px] top-[5px] h-[7px] w-[7px] rounded-full', l.tone === 'crit' ? 'bg-stop' : l.tone === 'ok' ? 'bg-sig' : l.tone === 'warn' ? 'bg-sig/60' : 'bg-g-500')} />
              <span className="num text-g-500">{ago(l.t, now)}</span> · {l.text}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function WorkOrders() {
  const { state } = useStore();
  const now = useNow(5000);
  const cols = COLS.map((c) => ({ ...c, items: state.orders.filter((o) => c.statuses.includes(o.status)) }));
  const doneCount = state.orders.filter((o) => o.status === 'done').length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        {[
          { l: '进行中工单', v: state.orders.filter((o) => o.status !== 'done').length, s: '含待派单' },
          { l: '平均响应', v: '18 min', s: '告警 → 派单' },
          { l: '平均到场', v: '2.4 h', s: 'SLA 48 h' },
          { l: '首次修复率', v: '94%', s: '近 90 天' },
          { l: '本月已完成', v: 37 + doneCount, s: '含历史工单' },
          { l: '本月追回', v: yuan(state.recovered), s: '来自均衡工单', hi: true },
        ].map((k) => (
          <div key={k.l} className="panel px-4 py-3.5">
            <div className="label">{k.l}</div>
            <div className={cn('num mt-1.5 text-[22px] font-semibold leading-none', k.hi ? 'text-sig' : 'text-g-50')}>{k.v}</div>
            <div className="mt-2 text-[11px] text-g-500">{k.s}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[1000px] grid-cols-5 gap-3">
          {cols.map((c) => (
            <div key={c.key} className="panel-inset flex min-h-[420px] flex-col p-2.5">
              <div className="mb-2.5 flex items-center justify-between px-1">
                <span className="text-[12.5px] font-semibold text-g-200">{c.label}</span>
                <span className="num rounded bg-g-800 px-1.5 text-[11px] text-g-300">{c.items.length}</span>
              </div>
              <div className="flex flex-col gap-2.5">
                {c.items.map((o) => (
                  <OrderCard key={o.id} o={o} now={now} />
                ))}
                {c.items.length === 0 && <div className="rounded-md border border-dashed border-g-700 p-4 text-center text-[11px] text-g-500">暂无</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Panel code="W-02" title="工程师 · 实时状态">
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {ENGINEERS.map((e) => {
            const mine = state.orders.filter((o) => o.engineer === e.id);
            const active = mine.find((o) => o.status === 'onsite' || o.status === 'suspended');
            const enroute = mine.find((o) => o.status === 'accepted' || o.status === 'dispatched');
            const status = active ? (active.status === 'suspended' ? '急停挂起' : `现场作业 · ${active.cabinetId}`) : enroute ? (enroute.status === 'accepted' ? `在途 · ${enroute.cabinetId}` : '待接单') : '空闲';
            const tone = active ? (active.status === 'suspended' ? 'crit' : 'warn') : enroute ? 'info' : 'ok';
            return (
              <div key={e.id} className="panel-inset flex items-center gap-3 p-3.5">
                <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-g-700 text-[13px] font-semibold text-g-50">
                  {e.name[0]}
                  <Led tone={tone} size={9} className="absolute -bottom-0.5 -right-0.5" blink={tone === 'crit'} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[13px] text-g-50">
                    {e.name}
                    <span className="label text-[9px]">{e.level}</span>
                    {e.id === APP_ENGINEER && <span className="rounded bg-sig/15 px-1 text-[10px] text-sig">App 演示</span>}
                  </div>
                  <div className="truncate text-[11.5px] text-g-400">
                    {status} · 驻点 {e.base}
                  </div>
                </div>
                <span className="num text-[11px] text-g-500">{mine.length} 单</span>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
