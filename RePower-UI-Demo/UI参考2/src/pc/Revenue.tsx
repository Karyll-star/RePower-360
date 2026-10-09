import { useMemo, useState } from 'react';
import { Check, QrCode, ShieldCheck, Sparkles } from 'lucide-react';
import { PASSPORTS } from '../data/fleet';
import { TIERS, planTotals, project, residual, wan, yuan, type TierKey } from '../data/model';
import { useStats, useStore } from '../store/store';
import { Btn, Chip, Hazard, Panel, Range, StatusTag } from '../components/ui';
import { LineChart } from '../components/charts';
import { cn } from '../utils/cn';

type Plan = 'mix' | TierKey;

function Param({ label, value, children, hint }: { label: string; value: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[12px] text-g-300">{label}</span>
        <span className="num text-[13px] font-semibold text-g-50">{value}</span>
      </div>
      {children}
      {hint && <div className="mt-1.5 text-[10.5px] text-g-500">{hint}</div>}
    </div>
  );
}

export function Revenue() {
  const { state, dispatch } = useStore();
  const stats = useStats();
  const n0 = state.cabinets.length;
  const avgSpread = state.cabinets.reduce((s, c) => s + c.spread, 0) / n0;
  const avgCycles = state.cabinets.reduce((s, c) => s + c.cycles, 0) / n0;
  const [plan, setPlan] = useState<Plan>('mix');
  const [spreadF, setSpreadF] = useState(1);
  const [cycles, setCycles] = useState(Math.round(avgCycles * 10) / 10);
  const [scale, setScale] = useState(n0);
  const [growth, setGrowth] = useState(0.05);
  const k = spreadF * (cycles / avgCycles);
  const sF = scale / n0;

  const all = useMemo(() => {
    const r = {} as Record<Plan, ReturnType<typeof planTotals>>;
    (['mix', 'watch', 'balance', 'operate'] as Plan[]).forEach((p) => (r[p] = planTotals(state.cabinets, stats, p, k)));
    return r;
  }, [state.cabinets, stats, k]);
  const t = all[plan];
  const proj = useMemo(
    () => project({ bucket: t.bucket * sF, bucketRec: t.bucketRec * sF, uplift: t.uplift * sF, offline: t.offline * sF, fee: t.fee * sF, nCab: scale, growth }),
    [t, sF, scale, growth],
  );
  const ratio = t.ratio;
  const verdict = ratio >= 1.5 ? '值' : ratio >= 1 ? '勉强值' : '不值';
  const mixCount = TIERS.map((tier) => all.mix.rows.filter((r) => r.tier.key === tier.key).length);
  const planName = plan === 'mix' ? '智能推荐组合' : `统一「${TIERS.find((x) => x.key === plan)!.name}」方案`;
  const rows = [...t.rows].sort((a, b) => b.net - a.net);
  const bestPlan = (['mix', 'watch', 'balance', 'operate'] as Plan[]).reduce<Plan>((b, p) => (all[p].net > all[b].net ? p : b), 'mix');
  const BestBadge = () => <span className="rounded bg-sig/15 px-1.5 py-[1px] text-[10px] font-semibold text-sig ring-1 ring-sig/40">收益最高</span>;

  const sign = () => {
    const tiers: Record<string, TierKey> = {};
    t.rows.forEach((r) => (tiers[r.cab.id] = r.tier.key));
    dispatch({ type: 'SET_TIERS', tiers });
    dispatch({ type: 'EVENT', tone: 'ok', from: 'console', text: `按${planName}签约 ${n0} 台柜 · 月费 ${yuan(t.fee)} · 预计净增收 ${yuan(t.net)}/月`, toast: '订阅方案已生效' });
  };

  return (
    <div className="space-y-4">
      <section className="panel overflow-hidden">
        <Hazard className="h-[3px] opacity-80" />
        <div className="grid gap-6 p-6 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div>
            <div className="label">订阅服务值不值？ / VERDICT</div>
            <div className="mt-3 flex flex-wrap items-end gap-5">
              <span className={cn('text-[64px] font-bold leading-none', verdict === '不值' ? 'text-stop-hi' : 'text-glow-sig text-sig')}>{verdict}</span>
              <div className="pb-2 text-[14px] leading-snug text-g-200">
                每投入 <b className="num">¥1</b> 订阅费
                <br />
                追回 <b className="num text-[24px] text-sig">¥{ratio.toFixed(1)}</b>
              </div>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-g-300">
              {planName} · {scale} 台柜：月订阅费 <b className="num text-g-100">{yuan(t.fee * sF)}</b>，月追回 <b className="num text-g-100">{yuan(t.recovered * sF)}</b>，叠加风险规避{' '}
              <b className="num text-g-100">{yuan(t.risk * sF)}</b>，净增收 <b className="num text-sig">{yuan(t.net * sF)}/月</b>。
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Btn variant="primary" icon={<ShieldCheck size={15} />} onClick={sign}>
                按此方案签约
              </Btn>
              <span className="self-center text-[11px] text-g-500">风险规避按套利收入 2% 估算（未被发现的故障停机期望值）</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-3">
            {[
              { l: '木桶追回', v: t.bucketRec * sF, s: 'Re-Pulse 均衡' },
              { l: '失联救回', v: t.rescue * sF, s: 'Re-Bridge 接入' },
              { l: '策略增益', v: t.uplift * sF, s: '托管柜峰谷优化' },
              { l: '订阅费', v: -t.fee * sF, s: '含分成' },
              { l: '36 个月少损失', v: proj.saving, s: '对比「坏了才修」', hi: true },
              { l: '回本', v: NaN, s: proj.payback ? `第 ${proj.payback} 个月` : '36 个月内未回本', hi: true },
            ].map((x) => (
              <div key={x.l} className={cn('panel-inset p-3.5', x.hi && 'border-sig/30')}>
                <div className="label">{x.l}</div>
                <div className={cn('num mt-1.5 text-[19px] font-semibold leading-none', x.hi ? 'text-sig' : x.v < 0 ? 'text-g-300' : 'text-g-50')}>
                  {Number.isNaN(x.v) ? (proj.payback ? `${proj.payback} 月` : '—') : x.l === '36 个月少损失' ? wan(x.v) : yuan(x.v)}
                </div>
                <div className="mt-1.5 text-[10.5px] text-g-500">{x.s}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
        <button
          onClick={() => setPlan('mix')}
          className={cn('panel p-4 text-left transition-all', plan === 'mix' ? 'glow-sig' : 'hover:border-g-500')}
        >
          <div className="flex items-center justify-between">
            <span className="label text-sig">RECOMMENDED</span>
            <span className="flex items-center gap-1.5">
              {bestPlan === 'mix' && <BestBadge />}
              {plan === 'mix' && <Check size={15} className="text-sig" />}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-[17px] font-semibold text-g-50">
            <Sparkles size={16} className="text-sig" /> 智能推荐组合
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-g-400">失联先救援 · 健康配守望 · 关注配均衡 · 告警配托管</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {TIERS.map((tier, i) => (
              <Chip key={tier.key} tone="info">
                {tier.name} ×{mixCount[i]}
              </Chip>
            ))}
          </div>
          <div className="num mt-3 border-t border-g-750 pt-2.5 text-[12px] text-g-300">
            净增收 <span className="text-sig">{yuan(all.mix.net * sF)}</span>/月 · ROI {all.mix.ratio.toFixed(1)}×
          </div>
        </button>
        {TIERS.map((tier) => {
          const u = all[tier.key];
          return (
            <button
              key={tier.key}
              onClick={() => setPlan(tier.key)}
              className={cn('panel p-4 text-left transition-all', plan === tier.key ? 'glow-sig' : 'hover:border-g-500')}
            >
              <div className="flex items-center justify-between">
                <span className="label">{tier.en}</span>
                <span className="flex items-center gap-1.5">
                  {bestPlan === tier.key && <BestBadge />}
                  {plan === tier.key && <Check size={15} className="text-sig" />}
                </span>
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-[17px] font-semibold text-g-50">{tier.name}</span>
                <span className="num text-[13px] text-sig">¥{tier.fee}</span>
                <span className="text-[11px] text-g-500">/柜/月{tier.share ? ' + 分成' : ''}</span>
              </div>
              <ul className="mt-2 space-y-1 text-[11.5px] text-g-400">
                {tier.features.map((f) => (
                  <li key={f}>· {f}</li>
                ))}
              </ul>
              <div className="mt-2 text-[10.5px] text-g-500">
                {tier.hardware} · {tier.sla} · 适合{tier.fit}
              </div>
              <div className="num mt-3 border-t border-g-750 pt-2.5 text-[12px] text-g-300">
                全量签约净增收 <span className={u.net >= 0 ? 'text-sig' : 'text-stop-hi'}>{yuan(u.net * sF)}</span>/月
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 @4xl:grid-cols-[300px_minmax(0,1fr)]">
        <Panel code="V-02" title="测算参数">
          <div className="space-y-5">
            <Param label="平均峰谷价差" value={`¥${(avgSpread * spreadF).toFixed(2)}/kWh`} hint="各柜按所在省份分时电价等比例缩放">
              <Range value={spreadF} min={0.6} max={1.4} step={0.05} onChange={setSpreadF} />
            </Param>
            <Param label="日循环次数" value={`${cycles.toFixed(1)} 次`} hint="两充两放 = 2 次">
              <Range value={cycles} min={1} max={2} step={0.1} onChange={setCycles} />
            </Param>
            <Param label="资产规模" value={`${scale} 台`} hint={`按当前 ${n0} 台的结构线性外推`}>
              <Range value={scale} min={n0} max={500} step={1} onChange={setScale} />
            </Param>
            <Param label="坏了才修 · 失衡月恶化" value={`${(growth * 100).toFixed(1)}%`} hint="自放电差异导致的压差月度扩大速度">
              <Range value={growth} min={0.02} max={0.1} step={0.005} onChange={setGrowth} fill="#e8352e" />
            </Param>
          </div>
        </Panel>

        <Panel
          code="V-03"
          title="36 个月累计后市场成本 · 坏了才修 vs 资产运营"
          right={
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1.5 text-stop-hi">
                <i className="inline-block h-[2px] w-4 bg-stop-hi" /> 坏了才修
              </span>
              <span className="flex items-center gap-1.5 text-sig">
                <i className="inline-block h-[2px] w-4 bg-sig" /> {planName}
              </span>
            </div>
          }
        >
          <LineChart
            series={[
              { data: proj.reactive, color: '#ff6157', dash: '6 4' },
              { data: proj.sub, color: '#ffa51f', area: true },
            ]}
            yMin={Math.min(0, ...proj.sub)}
            markers={proj.events.map((e) => ({ i: e.m - 1, label: e.label, color: '#ff6157' }))}
            xLabels={['第 1 月', '第 12 月', '第 24 月', '第 36 月']}
            yFormat={(v) => `${(v / 10000).toFixed(0)}万`}
            height={250}
          />
          <p className="mt-3 text-[12px] leading-relaxed text-g-400">
            成本 = 木桶损失 + 失联盲区 + 突发维修 + 订阅费。"坏了才修"的曲线会因压差复利扩大而加速，并在失效事件处跳升；资产运营把损失压平——36 个月少损失{' '}
            <b className="num text-sig">{wan(proj.saving)}</b>。
          </p>
        </Panel>
      </div>

      <Panel code="V-04" title="逐柜推荐 · 每台柜到底值不值" bodyClass="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-g-750 text-g-500">
                {['柜号', '状态', '月损失', '方案', '月费', '月追回', '风险规避', '净值 / 月'].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="num">
              {rows.map((r) => (
                <tr key={r.cab.id} className="border-b border-g-800/70 hover:bg-g-850/60">
                  <td className="px-4 py-2 font-semibold text-g-100">{r.cab.id}</td>
                  <td className="px-4 py-2">
                    <StatusTag status={r.st.status} />
                  </td>
                  <td className="px-4 py-2 text-g-300">{yuan(r.loss)}</td>
                  <td className="px-4 py-2 font-sans text-g-100">
                    {r.tier.name}
                    {r.st.status === 'offline' && <span className="text-[11px] text-sig"> · 先救援</span>}
                  </td>
                  <td className="px-4 py-2 text-g-400">{yuan(r.fee)}</td>
                  <td className="px-4 py-2 text-g-100">{yuan(r.recovered)}</td>
                  <td className="px-4 py-2 text-g-400">{yuan(r.risk)}</td>
                  <td className={cn('px-4 py-2 font-semibold', r.net >= 0 ? 'text-sig' : 'text-stop-hi')}>{yuan(r.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel code="V-05" title="退役资产池 · 电池护照让残值可变现" right={<span className="text-[11px] text-g-500">碳酸锂 7.6 万元/吨 时估值</span>}>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          {PASSPORTS.map((m) => {
            const rv = residual(m, 7.6);
            const sold = state.sales.find((s) => s.moduleId === m.id);
            return (
              <div key={m.id} className="panel-inset p-4">
                <div className="flex items-center justify-between">
                  <span className="num text-[13px] font-semibold text-g-50">{m.id}</span>
                  {sold ? <Chip tone="warn">已成交</Chip> : <Chip tone="info">SOH {(m.soh * 100).toFixed(1)}%</Chip>}
                </div>
                <div className="mt-1 text-[11px] text-g-500">{m.origin}</div>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <div className="label">{sold ? `成交 · ${sold.buyer}` : `最优：${rv.best.name}`}</div>
                    <div className="num mt-1 text-[20px] font-semibold text-sig">{yuan(sold ? sold.price : rv.best.withPassport)}</div>
                  </div>
                  <div className="text-right text-[11px] text-g-400">
                    无护照 <span className="num">{yuan(rv.best.raw)}</span>
                    <br />
                    数据溢价 <span className="num text-sig">+{yuan(rv.best.withPassport - rv.best.raw)}</span>
                  </div>
                </div>
                <Btn
                  size="sm"
                  variant="ghost"
                  className="mt-3 w-full"
                  icon={<QrCode size={13} />}
                  onClick={() => dispatch({ type: 'NAV', patch: { mode: window.innerWidth >= 1280 ? 'split' : 'mobile', mobileTab: 'passport', passportId: m.id } })}
                >
                  在 App 打开电池护照
                </Btn>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
