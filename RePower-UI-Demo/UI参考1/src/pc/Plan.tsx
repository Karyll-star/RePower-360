import { useMemo } from "react";
import { cn } from "../utils/cn";
import { useStore } from "../store";
import { Btn, Chip, Icon, Ring, SectionTitle } from "../ui";
import { CHANNELS, PLANS, bestChannel, completenessOf, fmtK, fmtPct, fmtY, planEconomics, valueOf } from "../model";
import { LineChart } from "./charts";

const PART_META = [
  { k: "recov", label: "挽回木桶损失", color: "#ffb020" },
  { k: "offl", label: "避免断网损失", color: "#e5342e" },
  { k: "truck", label: "精准派单省跑腿", color: "#7c848c" },
  { k: "opt", label: "策略优化增收", color: "#c9ced3" },
  { k: "resid", label: "残值溢价（折月）", color: "#7fd1a8" },
] as const;

export default function Plan() {
  const { state, dispatch, passports } = useStore();
  const plan = PLANS.find((p) => p.id === state.planId)!;
  const total = state.cabinets.length;

  const eco = useMemo(() => planEconomics(state.cabinets, state.params, plan, state.scope), [state.cabinets, state.params, plan, state.scope]);
  const allEco = useMemo(() => PLANS.map((p) => ({ p, e: planEconomics(state.cabinets, state.params, p, state.scope) })), [state.cabinets, state.params, state.scope]);

  const recommend = () => {
    let best = { net: -Infinity, planId: plan.id as typeof plan.id, scope: state.scope };
    for (const p of PLANS) for (let s = 1; s <= total; s++) {
      const e = planEconomics(state.cabinets, state.params, p, s);
      if (e.net12 > best.net) best = { net: e.net12, planId: p.id, scope: s };
    }
    dispatch({ type: "plan", planId: best.planId, scope: best.scope });
  };

  const verdict =
    eco.net12 <= 0
      ? { tone: "red", title: "当前方案不划算", text: "收益覆盖不了订阅费。收窄到高损失的柜子，或换更轻的套餐。" }
      : eco.roi >= 2
      ? { tone: "ok", title: "值得订阅", text: `每 1 元订阅费换回约 ${eco.roi.toFixed(1)} 元收益${eco.payback ? `，第 ${eco.payback} 个月回本` : ""}。` }
      : { tone: "amber", title: "能赚，但不算很划算", text: `ROI ${eco.roi.toFixed(1)}x。可点「智能推荐」找到更优的覆盖范围。` };

  const vc = { red: "border-estop/50 bg-estop/8 text-estop", ok: "border-ok/40 bg-ok/8 text-ok", amber: "border-amber-led/40 bg-amber-led/8 text-amber-led" }[verdict.tone as "red" | "ok" | "amber"];

  const pool = useMemo(
    () =>
      passports
        .map((pp) => {
          const comp = completenessOf(pp.items);
          const base = { kwh: pp.kwh, soh: pp.soh, cycles: pp.cycles, chem: pp.chem, completeness: comp };
          const ch = bestChannel(base);
          const v = valueOf({ ...base, channel: ch });
          const v0 = valueOf({ ...base, completeness: 0, channel: ch });
          return { pp, comp, ch, v: v.value, v0: v0.value };
        })
        .sort((a, b) => b.v - a.v),
    [passports]
  );
  const poolV = pool.reduce((a, x) => a + x.v, 0);
  const poolV0 = pool.reduce((a, x) => a + x.v0, 0);
  const listed = Object.keys(state.listings).length;
  const sumParts = Object.values(eco.parts).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="space-y-6">
      {/* A. 订阅 ROI */}
      <section>
        <SectionTitle
          sub="用你自己的 12 台柜子的真实损失来算，而不是行业平均数"
          right={<Btn variant="subtle" onClick={recommend}><Icon name="bolt" size={13} />智能推荐最优方案</Btn>}
        >
          订阅服务值不值？
        </SectionTitle>

        <div className="grid grid-cols-3 gap-3">
          {allEco.map(({ p, e }) => {
            const on = p.id === plan.id;
            return (
              <button key={p.id} onClick={() => dispatch({ type: "plan", planId: p.id })} className={cn("panel relative cursor-pointer p-4 text-left transition", on ? "!border-amber-led/70 bg-g-800" : "hover:bg-g-800/60")}>
                {on && <span className="absolute right-3 top-3"><Chip tone="amber">当前选择</Chip></span>}
                <div className="flex items-baseline gap-2">
                  <span className="text-[15px] font-bold">{p.name}</span>
                  <span className="text-[11px] text-amber-led">{p.tag}</span>
                </div>
                <div className="num mt-1 text-2xl font-bold">¥{p.fee}<span className="text-xs font-normal text-g-500"> /柜/月</span></div>
                <ul className="mt-2 space-y-1 text-[11.5px] text-g-400">
                  {p.features.map((f) => <li key={f} className="flex gap-1.5"><Icon name="check" size={12} className="mt-0.5 text-ok" />{f}</li>)}
                </ul>
                <div className="mt-3 flex items-center justify-between border-t border-g-700 pt-2 text-xs">
                  <span className="text-g-500">{state.scope} 台 · 月净回报</span>
                  <span className={cn("num font-bold", e.net > 0 ? "text-ok" : "text-estop")}>{e.net > 0 ? "+" : ""}{fmtY(e.net)}</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-3 grid grid-cols-[1fr_1fr] gap-4">
          <div className="panel p-4">
            <div className="mb-3 flex items-center gap-4">
              <div className="flex-1">
                <div className="mb-0.5 flex items-baseline justify-between"><span className="text-xs text-g-300">纳入订阅的柜数（按可挽回金额从高到低）</span><span className="num text-sm font-bold text-amber-led">{state.scope}<span className="text-[11px] font-normal text-g-400"> / {total} 台</span></span></div>
                <input className="slider" type="range" min={1} max={total} value={state.scope} onChange={(e) => dispatch({ type: "plan", scope: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {eco.picked.map((r) => <span key={r.id} className="num rounded-[2px] bg-g-800 px-1.5 py-0.5 text-[10.5px] text-g-300">{r.id}</span>)}
            </div>

            <div className={cn("mt-4 flex items-start gap-3 rounded-[5px] border p-3", vc)}>
              <Icon name={verdict.tone === "ok" ? "check" : "alert"} size={20} className="mt-0.5" />
              <div>
                <div className="text-sm font-bold">{verdict.title}</div>
                <div className="mt-0.5 text-xs text-g-300">{verdict.text}</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                { l: "月订阅费", v: fmtY(eco.fee), c: "text-g-100" },
                { l: "月收益", v: fmtY(eco.benefit), c: "text-amber-led" },
                { l: "月净回报", v: (eco.net >= 0 ? "+" : "") + fmtY(eco.net), c: eco.net >= 0 ? "text-ok" : "text-estop" },
                { l: "12 个月净收益", v: (eco.net12 >= 0 ? "+" : "") + fmtK(eco.net12), c: eco.net12 >= 0 ? "text-ok" : "text-estop" },
              ].map((x) => (
                <div key={x.l} className="panel-inset px-2.5 py-2">
                  <div className="label-cap !text-[9px]">{x.l}</div>
                  <div className={cn("num mt-1 text-[15px] font-bold", x.c)}>{x.v}</div>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <div className="mb-1.5 text-xs text-g-300">月收益构成</div>
              <div className="flex h-3 overflow-hidden rounded-[2px] bg-g-950">
                {PART_META.map((m) => <i key={m.k} className="block" style={{ width: `${(eco.parts[m.k] / sumParts) * 100}%`, background: m.color }} />)}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                {PART_META.map((m) => (
                  <div key={m.k} className="flex items-center justify-between text-g-400">
                    <span className="flex items-center gap-1.5"><i className="inline-block h-2 w-2" style={{ background: m.color }} />{m.label}</span>
                    <span className="num text-g-200">{fmtY(eco.parts[m.k])}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="panel p-4">
            <SectionTitle sub="收益 3 个月爬坡到位（需要先救援、再见效）">累计收益 vs 累计订阅费</SectionTitle>
            <LineChart
              height={230}
              labels={Array.from({ length: 13 }, (_, i) => `${i}月`)}
              yFmt={fmtK}
              mark={eco.payback ? { x: eco.payback, label: `第${eco.payback}月回本` } : null}
              series={[
                { name: "累计订阅费", color: "#7c848c", data: eco.cumF, dashed: true },
                { name: "累计收益", color: "#ffb020", data: eco.cumB, area: true },
              ]}
            />
            <div className="mt-2 text-[11px] leading-relaxed text-g-500">
              收益 = 挽回的木桶损失 × 套餐救援覆盖率 + 避免的断网损失 + 精准派单省下的冤枉跑腿 + 策略优化增收 + 护照带来的残值溢价摊销。基础监测只“看见”不“修复”，所以救援收益为 0 ——这正是“光监控不运维”的天花板。
            </div>
          </div>
        </div>
      </section>

      {/* B. 残值资产池 */}
      <section>
        <SectionTitle sub="电池护照完整度越高，梯次渠道的报价越高；移动端点击“申请报价”即会出现在这里">退役电池能卖多少钱 · 残值资产池</SectionTitle>
        <div className="mb-3 grid grid-cols-4 gap-3">
          <div className="panel p-3.5"><div className="label-cap">资产池预估残值（带护照）</div><div className="num mt-1.5 text-2xl font-bold text-ok">{fmtY(poolV)}</div></div>
          <div className="panel p-3.5"><div className="label-cap">若全部无护照</div><div className="num mt-1.5 text-2xl font-bold text-g-300">{fmtY(poolV0)}</div></div>
          <div className="panel p-3.5"><div className="label-cap">护照带来的溢价</div><div className="num mt-1.5 text-2xl font-bold text-amber-led">+{fmtY(poolV - poolV0)}</div></div>
          <div className="panel p-3.5"><div className="label-cap">已挂牌 / 资产总数</div><div className="num mt-1.5 text-2xl font-bold">{listed}<span className="text-sm font-normal text-g-500"> / {pool.length}</span></div></div>
        </div>
        <div className="panel overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="label-cap border-b border-g-800 text-left [&>th]:px-3.5 [&>th]:py-2.5 [&>th]:font-normal">
                <th>资产</th><th>容量</th><th>木桶口径 SOH</th><th>护照完整度</th><th>最优渠道</th><th className="text-right">现估值</th><th className="text-right">无护照</th><th className="text-right">差额</th><th>状态</th>
              </tr>
            </thead>
            <tbody>
              {pool.map(({ pp, comp, ch, v, v0 }) => (
                <tr key={pp.id} className="border-t border-g-800 hover:bg-g-800/40 [&>td]:px-3.5 [&>td]:py-2">
                  <td>
                    <div className="num font-semibold">{pp.id}</div>
                    <div className="text-[10.5px] text-g-500">{pp.kind === "retired" ? `已退役 · ${pp.chem}` : `在役 · ${pp.origin.split(" · ")[1] ?? pp.origin}`}</div>
                  </td>
                  <td className="num">{pp.kwh} kWh</td>
                  <td className={cn("num", pp.soh < 0.7 ? "text-estop" : pp.soh < 0.8 ? "text-amber-led" : "")}>{fmtPct(pp.soh)}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Ring value={comp} size={26} stroke={3} color={comp > 0.75 ? "#7fd1a8" : comp > 0.5 ? "#ffb020" : "#e5342e"} />
                      <span className="num text-g-300">{fmtPct(comp, 0)}</span>
                    </div>
                  </td>
                  <td><Chip tone={ch === "second" ? "ok" : ch === "lowspeed" ? "amber" : "mute"}>{CHANNELS[ch].name}</Chip></td>
                  <td className="num text-right font-semibold text-g-100">{fmtY(v)}</td>
                  <td className="num text-right text-g-500">{fmtY(v0)}</td>
                  <td className={cn("num text-right", v - v0 > 0 ? "text-ok" : "text-g-600")}>{v - v0 > 0 ? "+" : ""}{fmtY(v - v0)}</td>
                  <td>{state.listings[pp.id] ? <Chip tone="ok">已挂牌 {fmtY(state.listings[pp.id])}</Chip> : <span className="text-g-600">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
