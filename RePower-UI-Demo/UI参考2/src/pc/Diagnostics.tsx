import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, RadioTower, Send } from 'lucide-react';
import { APP_ENGINEER, ENGINEERS, NOMINAL_KWH, cellPos, type Cell } from '../data/fleet';
import { balanceCells, computeStats, fmtDate, planFor, pct, wan, weakList, yuan, type Stats } from '../data/model';
import { useStats, useStore } from '../store/store';
import { Btn, Led, ORDER_STATUS, Panel, STATUS_META, Seg, StatusTag, Toggle } from '../components/ui';
import { Bucket, type Stave } from '../components/Bucket';
import { CellGrid, METRIC_LEGEND, type Metric } from '../components/CellGrid';
import { LineChart } from '../components/charts';
import { cn } from '../utils/cn';

const SEV: Record<Stats['status'], number> = { critical: 0, attention: 1, offline: 2, healthy: 3 };

function pickStaves(cells: Cell[], n = 21): number[] {
  const bySoh = [...cells].sort((a, b) => a.soh - b.soh).slice(0, 2).map((c) => c.idx);
  const bySoc = [...cells].sort((a, b) => a.soc - b.soc).slice(0, 3).map((c) => c.idx);
  const special = Array.from(new Set([...bySoh, ...bySoc]));
  const rest: number[] = [];
  for (let i = 0; rest.length < n - special.length && i < cells.length * 2; i++) {
    const idx = (i * 37 + 11) % cells.length;
    if (!special.includes(idx) && !rest.includes(idx)) rest.push(idx);
  }
  const out = [...rest];
  const positions = [10, 4, 16, 7, 13];
  special.forEach((idx, k) => out.splice(Math.min(positions[k] ?? out.length, out.length), 0, idx));
  return out.slice(0, n);
}

const LEGEND_COLORS = ['#4b525c', 'rgba(255,165,31,.45)', '#ffa51f', '#e8352e'];

export function Diagnostics() {
  const { state, dispatch } = useStore();
  const stats = useStats();
  const cab = state.cabinets.find((c) => c.id === state.ui.selectedCab) ?? state.cabinets[0];
  const st = stats.get(cab.id)!;
  const off = !cab.online;

  const weak = useMemo(() => weakList(cab.cells, 8), [cab.cells]);
  const defaultSel = useMemo(() => weak.filter((w) => w.dSoc < -0.9).slice(0, 4).map((w) => w.idx), [weak]);
  const [sel, setSel] = useState<number[]>(defaultSel);
  useEffect(() => setSel(defaultSel), [defaultSel]);
  const [metric, setMetric] = useState<Metric>('soc');
  const [sim, setSim] = useState(false);
  const [eng, setEng] = useState(APP_ENGINEER);
  useEffect(() => setSim(false), [cab.id]);

  const after = useMemo(() => computeStats({ ...cab, cells: balanceCells(cab.cells, sel) }), [cab, sel]);
  const plan = useMemo(() => planFor(cab.cells, sel), [cab.cells, sel]);
  const staveIdx = useMemo(() => pickStaves(cab.cells), [cab.cells]);
  const cur = sim ? after : st;
  const recoverNow = Math.max(0, st.lossMonthly - after.lossMonthly);
  const openOrder = state.orders.find((o) => o.cabinetId === cab.id && (o.kind === 'balance' || o.kind === 'rescue') && o.status !== 'done');
  const sorted = useMemo(
    () => [...state.cabinets].sort((a, b) => SEV[stats.get(a.id)!.status] - SEV[stats.get(b.id)!.status] || stats.get(b.id)!.lossMonthly - stats.get(a.id)!.lossMonthly),
    [state.cabinets, stats],
  );

  const staves: Stave[] = staveIdx.map((i) => {
    const c = cab.cells[i];
    const tone: Stave['tone'] = i === st.minSohCell ? 'crit' : !sim && c.soc - st.medSoc < -1.6 ? 'warn' : 'base';
    return { h: c.soh, tone };
  });
  const minPos = cellPos(st.minSohCell);

  const toggle = (idx: number) => {
    if (off) return;
    setSel((s) => (s.includes(idx) ? s.filter((x) => x !== idx) : s.length >= 4 ? s : [...s, idx]));
  };

  const doDispatch = () => {
    if (off) {
      dispatch({ type: 'DISPATCH', kind: 'rescue', cabinetId: cab.id, title: 'Re-Bridge 断网救援', engineer: eng, priority: 'P1', targets: [] });
      return;
    }
    if (!plan.length) return;
    dispatch({
      type: 'DISPATCH',
      kind: 'balance',
      cabinetId: cab.id,
      title: `电芯均衡 · ${plan[0].label}${plan.length > 1 ? ` 等 ${plan.length} 颗` : ''}`,
      engineer: eng,
      priority: st.status === 'critical' ? 'P1' : 'P2',
      targets: plan,
    });
  };

  const trend = cab.trend;
  const firstNull = trend.findIndex((v) => v == null);
  let lastNull = -1;
  trend.forEach((v, i) => {
    if (v == null) lastNull = i;
  });
  const shade = firstNull >= 0 ? { from: Math.max(0, firstNull - 1), to: Math.min(29, cab.online ? lastNull + 1 : 29), label: cab.online ? '失联盲区（已救回）' : '失联盲区 · 无数据' } : undefined;

  return (
    <div className="space-y-4">
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {sorted.map((c) => {
          const s = stats.get(c.id)!;
          const active = c.id === cab.id;
          return (
            <button
              key={c.id}
              onClick={() => dispatch({ type: 'NAV', patch: { selectedCab: c.id } })}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-md border px-2.5 py-1.5 text-[12px] transition-colors',
                active ? 'border-sig/70 bg-sig/10 text-g-50' : 'border-g-700 bg-g-900 text-g-300 hover:border-g-500',
              )}
            >
              <Led tone={STATUS_META[s.status].tone} size={6} blink={s.status === 'critical'} />
              <span className="num font-medium">{c.id}</span>
              <span className={cn('num text-[11px]', s.status === 'offline' ? 'text-g-500' : 'text-g-400')}>{s.status === 'offline' ? '失联' : yuan(s.lossMonthly)}</span>
            </button>
          );
        })}
      </div>

      <section className="panel px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <span className="num text-[22px] font-semibold text-g-50">{cab.id}</span>
              <span className="text-[14px] text-g-200">
                {cab.city} · {cab.site}
              </span>
              <StatusTag status={st.status} />
              {!off && <span className="num text-[12px] text-g-400">健康分 {st.score}</span>}
            </div>
            <div className="mt-1.5 text-[12px] text-g-400">
              {cab.oem}
              {cab.oemStatus !== '在服' && <span className="text-stop-hi">（{cab.oemStatus}）</span>} · {cab.commissioned} 投运 · {cab.cooling} · 215 kWh / 100 kW · LFP 280Ah 1P240S · 峰谷价差 ¥
              {cab.spread.toFixed(2)} · {cab.cycles} 次/日 · 链路 {cab.link}
            </div>
          </div>
          {off && (
            <Btn variant="outline" icon={<RadioTower size={15} />} onClick={() => dispatch({ type: 'NAV', patch: { pcPage: 'rescue' } })}>
              失联 · 数据停留在 {cab.offline ? fmtDate(cab.offline.since) : '—'} → 去断网救援
            </Btn>
          )}
        </div>
      </section>

      <div className="grid gap-4 @4xl:grid-cols-2">
        <Panel
          code="D-01"
          title="木桶效应 · 一只桶能装多少水，取决于最短的木板"
          right={
            <label className="flex items-center gap-2 text-[12px] text-g-300">
              模拟 Re-Pulse 均衡后 <Toggle on={sim} onChange={setSim} size="sm" />
            </label>
          }
        >
          <div className={cn(off && 'opacity-60 grayscale')}>
            <Bucket
              staves={staves}
              water={cur.usableKWh / NOMINAL_KWH}
              shortTop={st.minCapKWh / NOMINAL_KWH}
              ideal={st.idealKWh / NOMINAL_KWH}
              leak={!sim && st.lossSocKWh > 0.5}
              shortLabel={`P${minPos.pack}-${String(minPos.pos).padStart(2, '0')} · SOH ${(st.minSoh * 100).toFixed(1)}%`}
              kwh={{ usable: cur.usableKWh, soc: cur.lossSocKWh, cap: st.lossCapKWh }}
            />
          </div>
          <div className="mt-4 grid gap-2 text-[12px] leading-relaxed text-g-400 @lg:grid-cols-2">
            <p>
              <span className="font-medium text-stop-hi">短板</span>：容量最小的电芯决定整串能充多少，只能靠持续主动均衡补偿或更换（→ 电池护照）。
            </p>
            <p>
              <span className="font-medium text-sig">漏孔</span>：电芯 SOC 错位，低电量电芯先放空、高电量电芯先充满；Re-Pulse 向低电芯注入电流即可"补孔"。
            </p>
          </div>
        </Panel>

        <Panel code="D-02" title="每个月白白损失多少钱？" right={sim ? <span className="text-[11px] text-sig">均衡后预测</span> : <span className="text-[11px] text-g-500">当前实测</span>}>
          <div className="num space-y-2 text-[13px]">
            {[
              ['理论可用（平均 SOH × 215 kWh）', `${st.idealKWh.toFixed(1)} kWh`],
              ['实际可用（木桶限制）', `− ${cur.usableKWh.toFixed(1)} kWh`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <span className="font-sans text-g-400">{k}</span>
                <span className="text-g-100">{v}</span>
              </div>
            ))}
            <div className="border-t border-dashed border-g-650" />
            <div className="flex justify-between gap-3">
              <span className="font-sans text-g-200">= 每次循环少放</span>
              <span className="text-[15px] font-semibold text-sig">{cur.lossKWh.toFixed(1)} kWh</span>
            </div>
            {[
              ['× 日循环', `${cab.cycles} 次`],
              ['× 天数', '30 天'],
              ['× 峰谷价差', `¥${cab.spread.toFixed(2)} / kWh`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <span className="font-sans text-g-400">{k}</span>
                <span className="text-g-100">{v}</span>
              </div>
            ))}
            <div className="border-t border-g-600" />
            <div className="flex items-end justify-between gap-3">
              <span className="font-sans text-g-100">= 每月白白损失</span>
              <span className={cn('text-[30px] font-semibold leading-none', sim ? 'text-sig' : 'text-stop-hi text-glow-stop')}>{yuan(cur.lossMonthly)}</span>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-1.5 flex justify-between text-[11px] text-g-400">
              <span>损失构成</span>
              <span className="num">年化 {wan(cur.lossMonthly * 12)}</span>
            </div>
            <div className="flex h-3 overflow-hidden rounded-sm bg-g-900">
              <div className="hatch-sig bg-sig/30 transition-all duration-700" style={{ width: `${(cur.lossSocKWh / Math.max(0.01, cur.lossKWh)) * 100}%` }} />
              <div className="hatch-stop bg-stop/25 transition-all duration-700" style={{ width: `${(st.lossCapKWh / Math.max(0.01, cur.lossKWh)) * 100}%` }} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3 text-[11.5px]">
              <div>
                <span className="text-sig">■</span> SOC 错位 <span className="num text-g-100">{cur.lossSocKWh.toFixed(1)} kWh</span>
                <div className="text-g-500">Re-Pulse 注入可追回约 90%</div>
              </div>
              <div>
                <span className="text-stop-hi">■</span> 容量短板 <span className="num text-g-100">{st.lossCapKWh.toFixed(1)} kWh</span>
                <div className="text-g-500">主动均衡补偿约 30% · 其余需更换短板</div>
              </div>
            </div>
          </div>

          <div className="panel-inset mt-4 flex flex-wrap items-center justify-between gap-3 p-3.5">
            <div>
              <div className="label">按当前注入清单均衡后</div>
              <div className="mt-1 text-[13px] text-g-200">
                末端压差 <span className="num">{st.deltaV}</span> → <span className="num text-sig">{after.deltaV} mV</span> · 可用 +
                <span className="num">{(after.usableKWh - st.usableKWh).toFixed(1)}</span> kWh/次
              </div>
            </div>
            <div className="text-right">
              <div className="label">每月追回</div>
              <div className="num text-[22px] font-semibold text-sig">{off ? '—' : yuan(recoverNow)}</div>
            </div>
          </div>
        </Panel>
      </div>

      <Panel
        code="D-03"
        title="电芯热力图 · 240 颗单体"
        right={
          <div className="flex flex-wrap items-center gap-3">
            <div className="hidden items-center gap-2.5 text-[10.5px] text-g-400 @3xl:flex">
              {METRIC_LEGEND[metric].map((l, i) => (
                <span key={l} className="flex items-center gap-1">
                  <i className="inline-block h-2.5 w-3.5 rounded-[2px]" style={{ background: LEGEND_COLORS[i] }} />
                  {l}
                </span>
              ))}
            </div>
            <Seg
              value={metric}
              onChange={setMetric}
              size="sm"
              options={[
                { value: 'soc', label: 'SOC 偏差' },
                { value: 'v', label: '末端电压' },
                { value: 'soh', label: 'SOH' },
                { value: 't', label: '温度' },
              ]}
            />
          </div>
        }
      >
        <CellGrid cells={cab.cells} metric={metric} selected={sel} onToggle={toggle} stale={off} />
      </Panel>

      <div className="grid gap-4 @4xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <Panel code="D-04" title="注入清单 · 给哪颗电芯注入多大电流" right={<span className="text-[11px] text-g-500">Re-Pulse 4 通道并行</span>}>
          {off ? (
            <div className="panel-inset p-4 text-[13px] text-g-300">该柜处于失联状态，没有实时单体数据，无法计算注入量。先派发 Re-Bridge 救援，恢复在线后再生成均衡工单。</div>
          ) : plan.length === 0 ? (
            <div className="panel-inset p-4 text-[13px] text-g-300">压差处于健康范围，暂不需要注入均衡。如需复测，可点击热力图手动选择电芯。</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-[12px]">
                <thead>
                  <tr className="text-g-500">
                    {['通道', '电芯', '位置', 'SOC 偏差', 'SOH', '需补电量', '建议电流', '时长'].map((h) => (
                      <th key={h} className="pb-2 font-normal">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="num">
                  {plan.map((p, i) => {
                    const ps = cellPos(p.idx);
                    return (
                      <tr key={p.idx} className="border-t border-g-800">
                        <td className="py-2 text-g-400">CH{i + 1}</td>
                        <td className="py-2 font-semibold text-g-50">{p.label}</td>
                        <td className="py-2 font-sans text-g-400">
                          {ps.row} 排 {ps.col} 列
                        </td>
                        <td className={cn('py-2', p.dSoc < -3.5 ? 'text-stop-hi' : 'text-sig')}>{p.dSoc.toFixed(1)}%</td>
                        <td className={cn('py-2', p.soh < 0.9 ? 'text-stop-hi' : 'text-g-200')}>{pct(p.soh)}</td>
                        <td className="py-2 text-g-100">{p.needAh.toFixed(1)} Ah</td>
                        <td className="py-2 text-[13px] font-semibold text-sig">{p.current} A</td>
                        <td className="py-2 text-g-300">{Math.round(p.minutes)} min</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-g-800 pt-3 text-[12px] text-g-400">
                <span>
                  共补 <b className="num text-g-100">{plan.reduce((s, p) => s + p.needAh, 0).toFixed(1)} Ah</b>
                </span>
                <span>
                  并行耗时 <b className="num text-g-100">{Math.round(Math.max(...plan.map((p) => p.minutes)))} min</b>
                </span>
                <span>电流 ≤ 0.04C · 温升 &lt; 3 °C · 高温电芯限流 6 A</span>
              </div>
            </div>
          )}

          <div className="mt-4 border-t border-g-750 pt-4">
            {openOrder ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-sig/40 bg-sig/[0.06] p-3">
                <div className="flex items-center gap-2.5 text-[12.5px] text-g-200">
                  <Led tone={ORDER_STATUS[openOrder.status].tone} blink />
                  已有工单 <span className="num font-semibold">{openOrder.id}</span> · {ORDER_STATUS[openOrder.status].label}
                  {openOrder.engineer && ` · ${openOrder.engineer}`}
                </div>
                <div className="flex gap-2">
                  {openOrder.engineer === APP_ENGINEER && state.ui.mode !== 'split' && (
                    <Btn size="sm" variant="outline" onClick={() => dispatch({ type: 'NAV', patch: { mode: window.innerWidth >= 1280 ? 'split' : 'mobile', mobileTab: 'tasks' } })}>
                      查看 App
                    </Btn>
                  )}
                  <Btn size="sm" variant="ghost" icon={<ArrowRight size={13} />} onClick={() => dispatch({ type: 'NAV', patch: { pcPage: 'orders' } })}>
                    工单中心
                  </Btn>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[12px] text-g-400">派给</span>
                <Seg value={eng} onChange={setEng} size="sm" options={ENGINEERS.map((e) => ({ value: e.id, label: e.id }))} />
                <Btn variant="primary" className="ml-auto" icon={<Send size={15} />} disabled={!off && plan.length === 0} onClick={doDispatch}>
                  {off ? '派发 Re-Bridge 救援' : '生成均衡工单 · 推送 App'}
                </Btn>
              </div>
            )}
          </div>
        </Panel>

        <Panel code="D-05" title="末端压差趋势 · 近 30 天" right={<span className="num text-[11px] text-g-400">当前 {off ? '—' : `${st.deltaV} mV`}</span>}>
          <LineChart
            series={[{ data: trend, color: '#ffa51f', area: true }]}
            yMin={0}
            yMax={Math.max(140, ...trend.filter((v): v is number => v != null).map((v) => v * 1.15))}
            thresholds={[
              { y: 60, color: '#ffa51f', label: '关注 60 mV' },
              { y: 100, color: '#ff6157', label: '告警 100 mV' },
            ]}
            xLabels={['30 天前', '20 天前', '10 天前', '今天']}
            yFormat={(v) => `${Math.round(v)}`}
            shade={shade}
            height={200}
          />
          <p className="mt-3 text-[12px] leading-relaxed text-g-400">
            {cab.balancedAt
              ? '最新一个点为 Re-Pulse 均衡后的复测值：压差回落，木桶"漏孔"已补上。'
              : off
                ? '失联后没有任何数据——压差是否继续扩大，只有接入 Re-Bridge 后才知道。'
                : '自放电差异让低电芯越来越低，压差按月扩大；不处理的话，木桶损失会跟着复利增长。'}
          </p>
        </Panel>
      </div>
    </div>
  );
}
