import { useState } from 'react';
import { ArrowRight, Check, RadioTower, Send, WifiOff } from 'lucide-react';
import reBridgeImg from '../assets/re-bridge.jpg';
import { APP_ENGINEER, DAY, ENGINEERS, type Cabinet } from '../data/fleet';
import { durParts, fmtDate, pct, yuan, type Stats } from '../data/model';
import { useStats, useStore, type WorkOrder } from '../store/store';
import { Btn, Chip, Hazard, Led, Panel, Screws, Seg } from '../components/ui';
import { useNow } from '../hooks';
import { cn } from '../utils/cn';

function BridgeDiagram() {
  const nodes = [
    { x: 6, label: 'BMS · BCU', sub: '私有协议' },
    { x: 136, label: 'Re-Bridge', sub: '只读旁路', hot: true },
    { x: 266, label: 'RE/OPS 云', sub: '协议映射' },
    { x: 396, label: '中台 / App', sub: '可看 · 可派单' },
  ];
  const links = ['CAN 只读', '4G / ETH', '1 Hz'];
  return (
    <div className="panel-inset relative overflow-hidden p-4">
      <div className="flex items-center gap-4">
        <img src={reBridgeImg} alt="Re-Bridge" className="h-24 w-32 shrink-0 rounded-md object-cover ring-1 ring-g-700" />
        <div className="min-w-0">
          <div className="label text-sig">RE-BRIDGE · 通讯救援网关</div>
          <ul className="mt-1.5 space-y-1 text-[12px] leading-snug text-g-300">
            <li>· CAN / RS485 / Modbus，内置 37 种 BMS 私有协议库</li>
            <li>· 只读旁路：不写入 BMS、不改原厂固件、无需原厂授权</li>
            <li>· 4G + 以太网双链路，断网本地缓存 30 天</li>
          </ul>
        </div>
      </div>
      <svg viewBox="0 0 512 70" className="mt-4 w-full">
        {links.map((l, i) => {
          const x1 = nodes[i].x + 110;
          const x2 = nodes[i + 1].x;
          return (
            <g key={l}>
              <line x1={x1} x2={x2} y1={30} y2={30} stroke="#ffa51f" strokeWidth={2} strokeDasharray="6 4" className="animate-flow" />
              <text x={(x1 + x2) / 2} y={58} textAnchor="middle" fontSize={9.5} fill="#979ea8">
                {l}
              </text>
            </g>
          );
        })}
        {nodes.map((n) => (
          <g key={n.label}>
            <rect x={n.x} y={10} width={110} height={40} rx={6} fill={n.hot ? 'rgba(255,165,31,.12)' : '#16191d'} stroke={n.hot ? '#ffa51f' : '#3a4047'} />
            <text x={n.x + 55} y={28} textAnchor="middle" fontSize={11.5} fontWeight={600} fill={n.hot ? '#ffc566' : '#e7e4dd'}>
              {n.label}
            </text>
            <text x={n.x + 55} y={42} textAnchor="middle" fontSize={9.5} fill="#6e7682">
              {n.sub}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

const STEPS: { label: string; match: WorkOrder['status'][] }[] = [
  { label: '已派单', match: ['dispatched', 'accepted', 'onsite', 'suspended', 'review', 'done'] },
  { label: '已接单', match: ['accepted', 'onsite', 'suspended', 'review', 'done'] },
  { label: '现场接入', match: ['onsite', 'suspended', 'review', 'done'] },
  { label: '恢复在线', match: ['review', 'done'] },
];

function OrderProgress({ order }: { order: WorkOrder }) {
  return (
    <div className="rounded-md border border-sig/40 bg-sig/[0.06] p-3">
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-g-200">
          救援中 · <span className="num">{order.id}</span> · {order.engineer}
        </span>
        <Led tone="warn" blink size={7} />
      </div>
      <div className="mt-3 flex items-center">
        {STEPS.map((s, i) => {
          const done = s.match.includes(order.status);
          return (
            <div key={s.label} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <span className={cn('grid h-5 w-5 place-items-center rounded-full border text-[10px]', done ? 'border-sig bg-sig text-g-1000' : 'border-g-600 text-g-500')}>
                  {done ? <Check size={11} strokeWidth={3} /> : i + 1}
                </span>
                <span className={cn('whitespace-nowrap text-[10px]', done ? 'text-g-200' : 'text-g-500')}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <div className={cn('mx-1 mb-4 h-px flex-1', done ? 'bg-sig/70' : 'bg-g-700')} />}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[10.5px] text-g-500">在右侧 App 中接单 → 到场 → 通讯接入，柜体将实时恢复在线</p>
    </div>
  );
}

function OfflineCard({ cab, st, now, order, eng, onDispatch }: { cab: Cabinet; st: Stats; now: number; order?: WorkOrder; eng: string; onDispatch: () => void }) {
  const off = cab.offline!;
  const dur = durParts(now - off.since);
  return (
    <div className="panel overflow-hidden">
      <Screws />
      <div className="flex items-center justify-between border-b border-dashed border-g-650 px-5 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Led tone="off" size={10} />
          <span className="num text-[15px] font-semibold text-g-100">{cab.id}</span>
          <span className="truncate text-[12px] text-g-400">
            {cab.city} · {cab.site}
          </span>
        </div>
        <Chip tone="off">失联</Chip>
      </div>
      <div className="space-y-4 p-5">
        <div>
          <div className="label">已失联</div>
          <div className="num mt-1 text-[28px] font-semibold leading-none text-g-50">
            {dur.d}
            <span className="text-sm font-normal text-g-400"> 天 </span>
            {dur.hms}
          </div>
        </div>
        <div className="rounded-md border border-stop/30 bg-stop/[0.06] p-3">
          <div className="flex items-center gap-2 text-[12.5px] font-semibold text-stop-hi">
            <WifiOff size={14} /> {off.reason}
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-g-300">{off.detail}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="panel-inset p-3">
            <div className="label">盲区损失</div>
            <div className="num mt-1 text-lg font-semibold text-stop-hi">
              {yuan(st.offlineLossMonthly)}
              <span className="text-xs font-normal text-g-500">/月</span>
            </div>
            <div className="mt-0.5 text-[10.5px] text-g-500">假设 60% 时间停机或执行过期策略</div>
          </div>
          <div className="panel-inset p-3 opacity-70 grayscale">
            <div className="label">最后已知快照</div>
            <div className="num mt-1 text-[12px] leading-relaxed text-g-300">
              ΔV {st.deltaV} mV · {st.tMax.toFixed(1)}°C
              <br />
              SOH {pct(st.meanSoh)}
            </div>
            <div className="mt-0.5 text-[10.5px] text-g-500">停留在 {fmtDate(off.since)}</div>
          </div>
        </div>
        <div className="text-[12px] leading-relaxed text-g-300">
          <span className="text-g-500">救援方案：</span>Re-Bridge 旁路接入 BMS 通讯口 · 协议库已匹配 <span className="text-sig">{off.protocol}</span>
        </div>
        {order ? (
          <OrderProgress order={order} />
        ) : (
          <Btn variant="primary" className="w-full" icon={<Send size={15} />} onClick={onDispatch}>
            派发 Re-Bridge 救援工单 → {eng}
          </Btn>
        )}
      </div>
    </div>
  );
}

function RescuedCard({ cab, st, onView }: { cab: Cabinet; st: Stats; onView: () => void }) {
  const r = cab.rescued!;
  const hot = st.tMax >= 45;
  return (
    <div className="panel glow-sig overflow-hidden animate-rise">
      <Screws />
      <div className="flex items-center justify-between border-b border-g-750 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <Led tone="warn" size={10} ping />
          <span className="num text-[15px] font-semibold text-g-50">{cab.id}</span>
          <span className="text-[12px] text-g-400">{cab.city}</span>
        </div>
        <Chip tone="warn">已恢复在线 · Re-Bridge</Chip>
      </div>
      <div className="space-y-3 p-5">
        <div className="text-[12px] text-g-400">
          失联 {r.days} 天 · {r.reason} · 恢复于 {fmtDate(r.at)}
        </div>
        <div className="panel-inset p-4">
          <div className="label">盲区数据回传</div>
          {hot ? (
            <div className="mt-1.5 text-[15px] font-semibold text-stop-hi">发现高温：最高 {st.tMax.toFixed(1)} °C（风扇疑似故障）</div>
          ) : (
            <div className="mt-1.5 text-[15px] font-semibold text-g-50">
              盲区内恶化：ΔV <span className="num text-g-400">{r.staleDeltaV}</span> → <span className="num text-stop-hi">{st.deltaV} mV</span>
            </div>
          )}
          <div className="mt-1 text-[11.5px] text-g-400">
            如果没有被救回，这些变化会一直藏在盲区里；现在每月木桶损失 {yuan(st.lossMonthly)} 可见、可算、可派单
          </div>
        </div>
        <Btn variant="outline" className="w-full" icon={<ArrowRight size={15} />} onClick={onView}>
          查看木桶诊断 · 生成后续工单
        </Btn>
      </div>
    </div>
  );
}

export function OfflineRescue() {
  const { state, dispatch } = useStore();
  const stats = useStats();
  const now = useNow(1000);
  const [eng, setEng] = useState(APP_ENGINEER);
  const offline = state.cabinets.filter((c) => !c.online);
  const rescued = state.cabinets.filter((c) => c.rescued);
  const totalLoss = offline.reduce((s, c) => s + stats.get(c.id)!.offlineLossMonthly, 0);
  const totalDays = offline.reduce((s, c) => s + (c.offline ? (now - c.offline.since) / DAY : 0), 0);
  const orderFor = (id: string) => state.orders.find((o) => o.cabinetId === id && o.kind === 'rescue' && o.status !== 'done');

  const dispatchRescue = (cab: Cabinet) =>
    dispatch({ type: 'DISPATCH', kind: 'rescue', cabinetId: cab.id, title: 'Re-Bridge 断网救援', engineer: eng, priority: 'P1', targets: [] });

  return (
    <div className="space-y-4">
      <section className="panel overflow-hidden">
        <Hazard className="h-[3px] opacity-80" />
        <div className="grid gap-6 p-6 @4xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <div>
            <div className="label">失联 = 看不见 + 不赚钱 + 不安全</div>
            <h2 className="mt-2 text-[22px] font-semibold leading-snug text-g-50">
              {offline.length ? (
                <>
                  {offline.length} 台柜正在盲区里运行，<span className="text-stop-hi">每月约 {yuan(totalLoss)}</span> 不知去向
                </>
              ) : (
                <>全部储能柜已恢复在线，盲区清零</>
              )}
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-g-300">
              原厂停服、物联卡欠费、网关固件崩溃——这些"孤儿柜"的 BMS 仍在工作，但数据出不来：峰谷策略无法更新、告警无人接收、电芯在盲区里持续恶化。 Re-Bridge
              以只读旁路方式接入 BMS 通讯口，约 40 分钟把它带回来。
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="panel-inset p-3">
                <div className="label">失联柜</div>
                <div className="num mt-1 text-2xl font-semibold text-g-50">{offline.length}</div>
              </div>
              <div className="panel-inset p-3">
                <div className="label">累计失联</div>
                <div className="num mt-1 text-2xl font-semibold text-g-50">
                  {Math.floor(totalDays)}
                  <span className="text-xs text-g-500"> 天</span>
                </div>
              </div>
              <div className="panel-inset p-3">
                <div className="label">盲区损失</div>
                <div className="num mt-1 text-2xl font-semibold text-stop-hi">{yuan(totalLoss)}</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px] text-g-400">
              <span>救援工单派给</span>
              <Seg value={eng} onChange={setEng} size="sm" options={ENGINEERS.map((e) => ({ value: e.id, label: e.id }))} />
              <span className="text-[11px] text-g-500">（派给张工的工单会出现在 RE·FIELD App）</span>
            </div>
          </div>
          <BridgeDiagram />
        </div>
      </section>

      {(offline.length > 0 || rescued.length > 0) && (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {offline.map((c) => (
            <OfflineCard key={c.id} cab={c} st={stats.get(c.id)!} now={now} order={orderFor(c.id)} eng={eng} onDispatch={() => dispatchRescue(c)} />
          ))}
          {rescued.map((c) => (
            <RescuedCard key={c.id} cab={c} st={stats.get(c.id)!} onView={() => dispatch({ type: 'NAV', patch: { pcPage: 'diagnose', selectedCab: c.id } })} />
          ))}
        </div>
      )}

      <Panel code="R-03" title="全量通讯链路" right={<span className="flex items-center gap-1.5 text-[11px] text-g-400"><RadioTower size={13} /> Re-Bridge 接管 {state.cabinets.filter((c) => c.link === 'Re-Bridge').length} 台</span>} bodyClass="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-g-750 text-g-500">
                {['柜号', '站点', '原厂', '链路', '心跳', '信号', '协议 / 点位'].map((h) => (
                  <th key={h} className="px-5 py-2.5 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.cabinets.map((c) => {
                const seed = c.id.charCodeAt(3) + c.id.charCodeAt(4);
                const dbm = -(68 + (seed % 17));
                const beat = (Math.floor(now / 1000) + seed) % 3;
                return (
                  <tr key={c.id} className="border-b border-g-800/70 hover:bg-g-850/60">
                    <td className="num px-5 py-2 text-g-100">
                      <span className="flex items-center gap-2">
                        <Led tone={c.online ? (c.link === 'Re-Bridge' ? 'warn' : 'ok') : 'off'} size={6} />
                        {c.id}
                      </span>
                    </td>
                    <td className="px-5 py-2 text-g-400">{c.city}</td>
                    <td className="px-5 py-2 text-g-400">
                      {c.oem}
                      {c.oemStatus !== '在服' && <span className="text-stop-hi"> · {c.oemStatus}</span>}
                    </td>
                    <td className={cn('px-5 py-2', c.link === 'Re-Bridge' ? 'text-sig' : c.online ? 'text-g-200' : 'text-stop-hi')}>{c.link}</td>
                    <td className="num px-5 py-2 text-g-300">{c.online ? `${beat + 1} s 前` : `中断 ${c.offline ? Math.floor((now - c.offline.since) / DAY) : 0} 天`}</td>
                    <td className="num px-5 py-2 text-g-400">{c.online ? `${dbm} dBm` : '—'}</td>
                    <td className="px-5 py-2 text-g-400">{c.online ? (c.link === 'Re-Bridge' ? '协议库映射 · 312 点' : '原厂 API · 186 点') : c.offline?.protocol}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
