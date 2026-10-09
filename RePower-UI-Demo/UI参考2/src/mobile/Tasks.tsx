import { CheckCircle2, MapPin, Navigation, Send } from 'lucide-react';
import { APP_ENGINEER } from '../data/fleet';
import { planFor, weakList, yuan } from '../data/model';
import { useStore, type WorkOrder } from '../store/store';
import { Btn, KIND_META, Led, ORDER_STATUS, Priority } from '../components/ui';
import { cn } from '../utils/cn';

const RANK: Record<WorkOrder['status'], number> = { suspended: 0, onsite: 1, accepted: 2, dispatched: 3, pending: 4, review: 5, done: 6 };
const PRANK = { P1: 0, P2: 1, P3: 2 };

function TaskCard({ o }: { o: WorkOrder }) {
  const { state, dispatch } = useStore();
  const cab = state.cabinets.find((c) => c.id === o.cabinetId)!;
  const K = KIND_META[o.kind];
  const Icon = K.icon;
  const eta = Math.max(8, Math.round((cab.distance / 40) * 60));
  const fresh = o.isNew && o.status === 'dispatched';

  const accept = () =>
    dispatch({ type: 'STATUS', id: o.id, status: 'accepted', text: `张工已接单 · 距离 ${cab.distance} km · 预计 ${eta} 分钟到场`, tone: 'info', from: 'field' });
  const arrive = () => {
    dispatch({ type: 'STATUS', id: o.id, status: 'onsite', text: '张工到场打卡（GPS 偏差 12 m）· 开始作业', tone: 'warn', from: 'field' });
    dispatch({ type: 'NAV', patch: { mobileTab: 'ops', activeOrder: o.id } });
  };
  const open = () => dispatch({ type: 'NAV', patch: { mobileTab: 'ops', activeOrder: o.id } });

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border bg-g-850 p-3.5 animate-rise',
        fresh ? 'glow-sig border-sig/60' : o.status === 'suspended' ? 'border-stop/60' : 'border-g-700',
      )}
    >
      <span className={cn('absolute bottom-0 left-0 top-0 w-1', o.priority === 'P1' ? 'bg-stop' : o.priority === 'P2' ? 'bg-sig' : 'bg-g-600')} />
      <div className="flex items-center justify-between pl-1">
        <div className="flex items-center gap-2">
          <Priority p={o.priority} />
          <span className="num text-[11px] text-g-400">{o.id}</span>
          {fresh && <span className="rounded bg-sig px-1 text-[9.5px] font-bold text-g-1000">NEW</span>}
        </div>
        <span className="flex items-center gap-1.5 text-[11px] text-g-400">
          <Led tone={ORDER_STATUS[o.status].tone} size={6} blink={o.status === 'suspended'} />
          {ORDER_STATUS[o.status].label}
        </span>
      </div>
      <div className="mt-2 flex items-start gap-2.5 pl-1">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-g-900 text-sig ring-1 ring-g-700">
          <Icon size={17} />
        </span>
        <div className="min-w-0">
          <div className="text-[14.5px] font-semibold text-g-50">
            {o.cabinetId} · {K.label}
          </div>
          <div className="text-[12px] leading-snug text-g-300">{o.title}</div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-g-500">
            <MapPin size={11} />
            {cab.city} · {cab.site} · {cab.distance} km
          </div>
        </div>
      </div>
      {o.targets.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1 pl-1">
          {o.targets.map((t) => (
            <span key={t.idx} className="num rounded-md bg-g-950 px-1.5 py-0.5 text-[10.5px] text-sig ring-1 ring-g-700">
              {t.label} · {t.current}A · {Math.round(t.minutes)}′
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center gap-2 pl-1">
        {o.status === 'dispatched' && (
          <Btn variant="primary" className="flex-1" onClick={accept}>
            接单
          </Btn>
        )}
        {o.status === 'accepted' && (
          <>
            <Btn variant="ghost" icon={<Navigation size={14} />}>
              导航 {eta}′
            </Btn>
            <Btn variant="primary" className="flex-1" icon={<MapPin size={14} />} onClick={arrive}>
              到场打卡
            </Btn>
          </>
        )}
        {(o.status === 'onsite' || o.status === 'suspended') && (
          <Btn variant={o.status === 'suspended' ? 'danger' : 'primary'} className="flex-1" onClick={open}>
            {o.status === 'suspended' ? '急停挂起 · 返回现场' : '继续作业'}
          </Btn>
        )}
        {o.status === 'review' && (
          <div className="text-[12px] text-g-300">
            已提交 · 待中台验收
            {o.recovered ? (
              <>
                {' '}
                · 每月追回 <span className="num text-sig">{yuan(o.recovered)}</span>
              </>
            ) : null}
          </div>
        )}
        {o.status === 'done' && (
          <div className="flex items-center gap-1.5 text-[12px] text-g-300">
            <CheckCircle2 size={14} className="text-sig" />
            已验收归档{o.recovered ? ` · 每月追回 ${yuan(o.recovered)}` : ''}
          </div>
        )}
      </div>
    </div>
  );
}

export function Tasks() {
  const { state, dispatch } = useStore();
  const mine = state.orders
    .filter((o) => o.engineer === APP_ENGINEER)
    .sort((a, b) => RANK[a.status] - RANK[b.status] || PRANK[a.priority] - PRANK[b.priority] || b.createdAt - a.createdAt);
  const hasHero = state.orders.some((o) => o.cabinetId === 'NB-02' && o.kind === 'balance');
  const waiting = mine.filter((o) => o.status === 'dispatched').length;
  const running = mine.filter((o) => ['accepted', 'onsite', 'suspended'].includes(o.status)).length;
  const finished = mine.filter((o) => o.status === 'review' || o.status === 'done').length;
  const recovered = mine.reduce((s, o) => s + (o.recovered ?? 0), 0);

  const simulate = () => {
    const cab = state.cabinets.find((c) => c.id === 'NB-02')!;
    const plan = planFor(
      cab.cells,
      weakList(cab.cells, 8)
        .filter((w) => w.dSoc < -0.9)
        .slice(0, 4)
        .map((w) => w.idx),
    );
    if (!plan.length) return;
    dispatch({ type: 'DISPATCH', kind: 'balance', cabinetId: 'NB-02', title: `电芯均衡 · ${plan[0].label} 等 ${plan.length} 颗`, engineer: APP_ENGINEER, priority: 'P1', targets: plan });
  };

  return (
    <div className="space-y-3 px-4 pb-6 pt-3">
      <div className="panel p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[12px] text-g-400">早上好，张工</div>
            <div className="mt-0.5 text-[15px] font-semibold text-g-50">今天 {waiting + running} 单待处理</div>
          </div>
          <div className="text-right">
            <div className="label">我追回的收益</div>
            <div className="num text-[18px] font-semibold text-sig">
              {yuan(recovered)}
              <span className="text-[11px] font-normal text-g-500">/月</span>
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            { l: '待接单', v: waiting },
            { l: '进行中', v: running },
            { l: '已完成', v: finished },
          ].map((x) => (
            <div key={x.l} className="rounded-lg bg-g-950 py-2 ring-1 ring-g-750">
              <div className="num text-[17px] font-semibold text-g-50">{x.v}</div>
              <div className="text-[10.5px] text-g-500">{x.l}</div>
            </div>
          ))}
        </div>
      </div>

      {!hasHero && (
        <div className="rounded-xl border border-dashed border-sig/40 bg-sig/[0.05] p-3.5">
          <div className="text-[12.5px] leading-relaxed text-g-200">
            中台还没有派新单。在 PC 中台「木桶诊断」里为 <b className="num">NB-02</b> 生成均衡工单，会实时推送到这里。
          </div>
          <Btn size="sm" variant="outline" className="mt-2.5" icon={<Send size={13} />} onClick={simulate}>
            模拟中台派单 · NB-02
          </Btn>
        </div>
      )}

      {mine.map((o) => (
        <TaskCard key={o.id} o={o} />
      ))}
    </div>
  );
}
