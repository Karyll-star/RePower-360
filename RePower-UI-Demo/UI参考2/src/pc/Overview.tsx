import { useMemo } from 'react';
import { ArrowRight, BatteryMedium, HeartPulse, JapaneseYen, RadioTower, type LucideIcon } from 'lucide-react';
import { DAY, type Cabinet } from '../data/fleet';
import { TOU, ago, pct, touAt, wan, yuan, type Stats, type Tone } from '../data/model';
import { useFleet, useStats, useStore, type PcPage } from '../store/store';
import { Hazard, Led, Panel, STATUS_META } from '../components/ui';
import { useNow } from '../hooks';
import { cn } from '../utils/cn';

function QA({ icon: Icon, q, a, tone, onClick }: { icon: LucideIcon; q: string; a: string; tone: Tone; onClick: () => void }) {
  return (
    <button onClick={onClick} className="panel-inset group flex w-full items-start gap-3 p-3.5 text-left transition-colors hover:border-g-600">
      <span
        className={cn(
          'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md border',
          tone === 'crit' ? 'border-stop/50 text-stop-hi' : tone === 'warn' ? 'border-sig/50 text-sig' : 'border-g-600 text-g-200',
        )}
      >
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] text-g-400">{q}</span>
        <span className="mt-0.5 block text-[13.5px] font-medium leading-snug text-g-50">{a}</span>
      </span>
      <ArrowRight size={15} className="mt-2 shrink-0 text-g-500 transition-transform group-hover:translate-x-0.5 group-hover:text-sig" />
    </button>
  );
}

function LossCard({ title, value, sub, tone, onClick }: { title: string; value: number; sub: string; tone: 'warn' | 'crit'; onClick: () => void }) {
  return (
    <button onClick={onClick} className="panel-inset group p-4 text-left transition-colors hover:border-g-600">
      <div className="flex items-center justify-between">
        <span className="label">{title}</span>
        <ArrowRight size={14} className="text-g-500 group-hover:text-sig" />
      </div>
      <div className={cn('num mt-2 text-[26px] font-semibold leading-none', tone === 'crit' ? 'text-stop-hi' : 'text-sig')}>
        {yuan(value)}
        <span className="text-xs font-normal text-g-500"> /月</span>
      </div>
      <div className="mt-2 text-[11.5px] text-g-400">{sub}</div>
    </button>
  );
}

function CabTile({ cab, st, now, onClick }: { cab: Cabinet; st: Stats; now: number; onClick: () => void }) {
  const off = !cab.online;
  const tone = STATUS_META[st.status].tone;
  const tou = touAt(new Date(now));
  const jitter = (Math.floor(now / 2000) * 7 + cab.id.charCodeAt(3) * 13) % 11;
  const power = tou.act === '充电' ? `充 ${86 + jitter} kW` : tou.act === '放电' ? `放 ${89 + jitter} kW` : '待机';
  const days = cab.offline ? Math.floor((now - cab.offline.since) / DAY) : 0;
  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative flex w-[138px] flex-col rounded-md border p-2.5 text-left transition-all hover:-translate-y-0.5',
        off
          ? 'border-dashed border-g-600 bg-g-950/70 hover:border-g-400'
          : st.status === 'critical'
            ? 'border-stop/50 bg-stop-deep/40 hover:border-stop'
            : st.status === 'attention'
              ? 'border-sig/30 bg-g-850 hover:border-sig/70'
              : 'border-g-700 bg-g-850 hover:border-g-500',
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn('num text-[13px] font-semibold', off ? 'text-g-400' : 'text-g-50')}>{cab.id}</span>
        <Led tone={tone} blink={st.status === 'critical'} />
      </div>
      {off ? (
        <div className="mt-2 text-[11px] leading-snug text-g-400">
          失联 <span className="num text-g-200">{days}</span> 天
          <br />
          <span className="text-g-500">{cab.offline?.reason}</span>
        </div>
      ) : (
        <>
          <div className="mt-2 flex items-center gap-1.5">
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-g-750">
              <div
                className={cn('absolute inset-y-0 left-0 rounded-full', st.deltaV >= 100 ? 'bg-stop' : st.deltaV >= 60 ? 'bg-sig' : 'bg-g-300')}
                style={{ width: `${Math.min(100, (st.deltaV / 160) * 100)}%` }}
              />
            </div>
            <span className="num text-[10.5px] text-g-300">{st.deltaV}mV</span>
          </div>
          <div className="mt-1.5 flex justify-between text-[10.5px] text-g-400">
            <span>SOH {pct(st.meanSoh, 1)}</span>
            <span className="num">{power}</span>
          </div>
        </>
      )}
      <div className={cn('num mt-2 border-t border-g-750 pt-1.5 text-[12px]', off ? 'text-stop-hi' : st.lossMonthly > 600 ? 'text-sig' : 'text-g-300')}>
        −{yuan(off ? st.offlineLossMonthly : st.lossMonthly)}
        <span className="text-g-500">/月</span>
      </div>
    </button>
  );
}

const TOU_COLOR: Record<string, string> = { 谷: '#1d2126', 平: '#2d3238', 峰: 'rgba(255,165,31,.42)', 尖: '#ffa51f' };

export function Overview() {
  const { state, dispatch } = useStore();
  const stats = useStats();
  const f = useFleet();
  const now = useNow(2000);
  const go = (pcPage: PcPage, selectedCab?: string) => dispatch({ type: 'NAV', patch: selectedCab ? { pcPage, selectedCab } : { pcPage } });
  const invisible = f.bucket + f.offlineLoss;
  const share = f.arbitrage ? invisible / f.arbitrage : 0;

  const groups = useMemo(() => {
    const m = new Map<string, Cabinet[]>();
    state.cabinets.forEach((c) => {
      const k = c.id.slice(0, 2);
      m.set(k, [...(m.get(k) ?? []), c]);
    });
    return [...m.values()];
  }, [state.cabinets]);

  const ranking = useMemo(
    () =>
      state.cabinets
        .filter((c) => c.online)
        .map((c) => ({ c, st: stats.get(c.id)! }))
        .sort((a, b) => b.st.deltaV - a.st.deltaV),
    [state.cabinets, stats],
  );
  const worst = ranking[0];
  const d = new Date(now);
  const tou = touAt(d);
  const hour = d.getHours() + d.getMinutes() / 60;

  return (
    <div className="space-y-4">
      <section className="panel overflow-hidden">
        <Hazard className="h-[3px] opacity-80" />
        <div className="grid gap-6 p-6 @4xl:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)]">
          <div>
            <div className="label">本月 · 看不见的损失 / INVISIBLE LOSS</div>
            <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-1">
              <div className="num text-glow-stop text-[52px] font-semibold leading-none text-stop-hi">{yuan(invisible)}</div>
              <div className="pb-1.5 text-[13px] text-g-300">
                / 月 · 相当于峰谷套利收入的 <b className="num text-g-50">{(share * 100).toFixed(1)}%</b>
              </div>
            </div>
            <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-g-300">
              这笔钱不会出现在任何账单上：一部分被<b className="text-g-100">电芯木桶效应</b>吃掉——每次循环都有电"充不进、放不出"；另一部分消失在
              <b className="text-g-100">失联柜的盲区</b>里——没人知道它是否还在按峰谷策略赚钱。
            </p>
            <div className="mt-5 grid gap-3 @xl:grid-cols-2">
              <LossCard title="木桶效应 · 在线柜" value={f.bucket} sub={`其中 ${yuan(f.recoverable)} 可通过均衡追回`} tone="warn" onClick={() => go('diagnose')} />
              <LossCard title="失联盲区 · 失联柜" value={f.offlineLoss} sub={f.offline ? `${f.offline} 台柜无法确认策略执行` : '全部在线 · 盲区清零'} tone="crit" onClick={() => go('rescue')} />
            </div>
            {state.recovered > 0 && (
              <div className="mt-3 flex items-center gap-3 rounded-md border border-sig/40 bg-sig/[0.07] px-4 py-2.5 animate-rise">
                <Led tone="warn" ping />
                <span className="text-[12.5px] text-g-200">
                  本月已通过现场均衡追回 <b className="num text-sig">{yuan(state.recovered)}</b> /月 · 年化 {wan(state.recovered * 12)}
                </span>
              </div>
            )}
          </div>
          <div className="grid content-start gap-2.5">
            <div className="label mb-0.5">能源总监每天要问的 4 个问题</div>
            <QA
              icon={HeartPulse}
              q="我的储能柜现在健康吗？"
              a={`${f.online} 台在线：${f.healthy} 健康 · ${f.attention} 关注 · ${f.critical} 告警${worst ? `；最差 ${worst.c.id}（ΔV ${worst.st.deltaV} mV）` : ''}`}
              tone={f.critical ? 'crit' : f.attention ? 'warn' : 'ok'}
              onClick={() => go('diagnose', worst?.c.id)}
            />
            <QA
              icon={RadioTower}
              q="断网了吗？"
              a={f.offline ? `${f.offline} 台失联，最长 ${f.maxOfflineDays} 天；盲区损失 ${yuan(f.offlineLoss)}/月` : '全部在线 · Re-Bridge 守护中'}
              tone={f.offline ? 'crit' : 'ok'}
              onClick={() => go('rescue')}
            />
            <QA
              icon={BatteryMedium}
              q="因为木桶效应每月白白损失多少？"
              a={`${yuan(f.bucket)}/月，年化 ${wan(f.bucket * 12)}；可追回 ${yuan(f.recoverable)}`}
              tone="warn"
              onClick={() => go('diagnose')}
            />
            <QA
              icon={JapaneseYen}
              q="订阅服务值不值？"
              a={`推荐组合月费 ${yuan(f.plan.fee)}，每 ¥1 订阅费追回 ¥${f.plan.ratio.toFixed(1)}`}
              tone="ok"
              onClick={() => go('revenue')}
            />
          </div>
        </div>
      </section>

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))' }}>
        {[
          { l: '在线率', v: `${f.online}/${f.total}`, s: f.offline ? `${f.offline} 台失联` : '全部在线', tone: f.offline ? 'crit' : 'ok' },
          { l: '在线柜平均 SOH', v: pct(f.avgSoh), s: '按单体容量加权', tone: 'ok' },
          { l: '最大末端压差', v: `${f.maxDeltaV} mV`, s: '阈值：关注 60 / 告警 100', tone: f.maxDeltaV >= 100 ? 'crit' : f.maxDeltaV >= 60 ? 'warn' : 'ok' },
          { l: '最高电芯温度', v: `${f.maxT.toFixed(1)} °C`, s: '预警 45 / 切断 55', tone: f.maxT >= 45 ? 'crit' : f.maxT >= 38 ? 'warn' : 'ok' },
          { l: '本月已追回', v: yuan(state.recovered), s: '来自已完成的均衡工单', tone: state.recovered ? 'warn' : 'info' },
        ].map((k) => (
          <div key={k.l} className="panel px-4 py-3.5">
            <div className="label">{k.l}</div>
            <div
              className={cn(
                'num mt-1.5 text-[24px] font-semibold leading-none',
                k.tone === 'crit' ? 'text-stop-hi' : k.tone === 'warn' ? 'text-sig' : 'text-g-50',
              )}
            >
              {k.v}
            </div>
            <div className="mt-2 text-[11px] text-g-500">{k.s}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 @4xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel
          code="A-02"
          title={`资产矩阵 · ${f.total} 台储能柜`}
          right={
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-g-400">
              {(['healthy', 'attention', 'critical', 'offline'] as const).map((s) => (
                <span key={s} className="flex items-center gap-1.5">
                  <Led tone={STATUS_META[s].tone} size={6} />
                  {STATUS_META[s].label}
                </span>
              ))}
            </div>
          }
        >
          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g[0].id.slice(0, 2)}>
                <div className="mb-2 flex flex-wrap items-baseline gap-x-2 text-[12px]">
                  <span className="font-medium text-g-100">
                    {g[0].city} · {g[0].site}
                  </span>
                  <span className="text-g-500">
                    {g[0].oem}
                    {g[0].oemStatus !== '在服' && <span className="text-stop-hi">（{g[0].oemStatus}）</span>} · 价差 ¥{g[0].spread.toFixed(2)} · {g[0].cycles} 次/日 · {g[0].cooling}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {g.map((c) => (
                    <CabTile key={c.id} cab={c} st={stats.get(c.id)!} now={now} onClick={() => go(c.online ? 'diagnose' : 'rescue', c.id)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel code="A-03" title="告警流" right={<span className="flex items-center gap-1.5 label"><Led tone="crit" size={5} blink /> LIVE</span>} bodyClass="p-0">
          <ul className="max-h-[640px] divide-y divide-g-800 overflow-y-auto">
            {state.events.slice(0, 20).map((e) => (
              <li key={e.id} className="flex animate-rise gap-3 px-4 py-3">
                <Led tone={e.tone} className="mt-1.5" blink={e.tone === 'crit'} />
                <div className="min-w-0">
                  <p className="text-[12.5px] leading-snug text-g-200">{e.text}</p>
                  <p className="mt-1 text-[10.5px] text-g-500">
                    {ago(e.t, now)} · {e.from === 'field' ? '来自现场 App' : e.from === 'console' ? '中台' : '系统诊断'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-4 @4xl:grid-cols-2">
        <Panel code="A-04" title="末端压差排行 · 在线柜" right={<span className="text-[11px] text-g-500">点击进入木桶诊断</span>}>
          <div className="space-y-1.5">
            {ranking.slice(0, 10).map(({ c, st }) => (
              <button key={c.id} onClick={() => go('diagnose', c.id)} className="group flex w-full items-center gap-3 text-left">
                <span className="num w-12 shrink-0 text-[12px] text-g-300 group-hover:text-g-50">{c.id}</span>
                <div className="relative h-4 flex-1 rounded-sm bg-g-900">
                  <div
                    className={cn('absolute inset-y-0 left-0 rounded-sm', st.deltaV >= 100 ? 'bg-stop' : st.deltaV >= 60 ? 'bg-sig/80' : 'bg-g-500')}
                    style={{ width: `${Math.min(100, (st.deltaV / 160) * 100)}%` }}
                  />
                  <span className="absolute inset-y-0 border-l border-dashed border-sig/60" style={{ left: `${(60 / 160) * 100}%` }} />
                  <span className="absolute inset-y-0 border-l border-dashed border-stop/80" style={{ left: `${(100 / 160) * 100}%` }} />
                </div>
                <span className="num w-14 shrink-0 text-right text-[12px] text-g-200">{st.deltaV} mV</span>
                <span className="num w-16 shrink-0 text-right text-[11px] text-g-500">{yuan(st.lossMonthly)}</span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel code="A-05" title="今日分时策略 · 资产此刻在干什么">
          <div className="relative">
            <div className="flex h-9 overflow-hidden rounded-md ring-1 ring-g-700">
              {TOU.map((s) => (
                <div
                  key={s.from}
                  className="relative flex items-center justify-center border-r border-g-950/60 text-[10.5px]"
                  style={{ width: `${((s.to - s.from) / 24) * 100}%`, background: TOU_COLOR[s.kind], color: s.kind === '尖' ? '#0b0c0e' : '#c4c8cd' }}
                >
                  {s.kind}
                </div>
              ))}
            </div>
            <div className="absolute -bottom-1 -top-1 w-[2px] bg-g-50 shadow-[0_0_10px_rgba(255,255,255,.8)]" style={{ left: `${(hour / 24) * 100}%` }} />
            <div className="num mt-1.5 flex justify-between text-[10px] text-g-500">
              {[0, 4, 8, 12, 16, 20, 24].map((h) => (
                <span key={h}>{String(h).padStart(2, '0')}:00</span>
              ))}
            </div>
          </div>
          <div className="mt-4 grid gap-3 @lg:grid-cols-2">
            <div className="panel-inset p-3.5">
              <div className="label">当前时段</div>
              <div className="mt-1 text-[15px] font-semibold text-g-50">
                {tou.kind}时段 · <span className="text-sig">{tou.act}</span>
              </div>
              <div className="mt-1 text-[11.5px] text-g-400">
                {f.online} 台在线柜按两充两放策略执行；谷充 → 峰 / 尖放，赚取峰谷价差
              </div>
            </div>
            <div className="panel-inset p-3.5">
              <div className="label">策略不可确认</div>
              <div className={cn('mt-1 text-[15px] font-semibold', f.offline ? 'text-stop-hi' : 'text-g-50')}>{f.offline} 台失联柜</div>
              <div className="mt-1 text-[11.5px] text-g-400">分时电价调整后无法远程下发新时段表，可能"峰充谷放"倒亏</div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
