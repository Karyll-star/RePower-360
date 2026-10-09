import { useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { useStore } from "../store";
import { Btn, Chip, Icon, Lamp, Seg, SectionTitle, StateBadge, STATE_META } from "../ui";
import { SITES, deriveAlerts, fmtK, fmtPct, fmtY, orderGain, simulateRepair, suggestRepairIds, hoursText, type OrderType } from "../model";
import type { PcPage } from "./PCApp";

function Kpi({ label, value, unit, sub, tone = "amber", lamp, children }: { label: string; value: string; unit?: string; sub?: React.ReactNode; tone?: "amber" | "ok" | "red" | "plain"; lamp?: React.ReactNode; children?: React.ReactNode }) {
  const c = { amber: "text-amber-led", ok: "text-ok", red: "text-estop", plain: "text-g-100" }[tone];
  return (
    <div className="panel p-3.5">
      <div className="label-cap flex items-center justify-between">
        <span>{label}</span>
        {lamp}
      </div>
      <div className={cn("num mt-2 flex items-baseline gap-1 text-[26px] font-bold leading-none", c)}>
        {value}
        {unit && <span className="text-xs font-medium text-g-400">{unit}</span>}
      </div>
      <div className="mt-2 text-[11px] leading-snug text-g-400">{sub}</div>
      {children}
    </div>
  );
}

export default function Overview({ go }: { go: (p: PcPage, cabId?: string) => void }) {
  const { state, dispatch, mets, fleet } = useStore();
  const [feed, setFeed] = useState<"alert" | "event">("alert");
  const alerts = useMemo(() => deriveAlerts(state.cabinets, state.params), [state.cabinets, state.params]);

  const actions = useMemo(() => {
    const out: { cabId: string; type: OrderType; ids: number[]; gain: number }[] = [];
    for (const c of state.cabinets) {
      const ids = suggestRepairIds(c);
      if (ids.length) {
        const g = simulateRepair(c, ids, state.params).gain;
        if (g > 80) out.push({ cabId: c.id, type: "rescue", ids, gain: g });
      }
      if (!c.bridge.online) out.push({ cabId: c.id, type: "reconnect", ids: [], gain: orderGain(c, "reconnect", [], state.params) });
    }
    return out.sort((a, b) => b.gain - a.gain).slice(0, 6);
  }, [state.cabinets, state.params]);

  const losses = [...state.cabinets].map((c) => ({ c, m: mets[c.id] })).sort((a, b) => b.m.barrelLoss + b.m.offlineLoss - (a.m.barrelLoss + a.m.offlineLoss)).slice(0, 8);
  const maxLoss = Math.max(...losses.map((x) => x.m.barrelLoss + x.m.offlineLoss), 1);
  const doneN = state.orders.filter((o) => o.status === "done").length;
  const longest = Math.max(...state.cabinets.map((c) => c.bridge.offlineHours));
  const segs = [
    { k: "healthy", n: fleet.healthy, c: "bg-ok" },
    { k: "warning", n: fleet.warning, c: "bg-amber-led" },
    { k: "critical", n: fleet.critical, c: "bg-estop" },
    { k: "offline", n: fleet.offline, c: "bg-g-500" },
  ] as const;

  return (
    <div className="space-y-4">
      {/* KPI */}
      <div className="grid grid-cols-5 gap-3">
        <Kpi label="Re-Bridge 在线率" value={`${fleet.online}/${fleet.total}`} unit="台" tone={fleet.offline ? "amber" : "ok"} lamp={<Lamp d={fleet.offline ? "warning" : "healthy"} />}
          sub={fleet.offline ? <>{fleet.offline} 台断网 · 最长 <b className="text-g-200">{hoursText(longest)}</b>，数据出现缺口</> : "全部在线"} />
        <Kpi label="资产健康分布" value={`${fleet.healthy}`} unit={`/${fleet.total} 健康`} tone="plain"
          sub={<span>预警 <b className="text-amber-led">{fleet.warning}</b> · 严重 <b className="text-estop">{fleet.critical}</b> · 离线 <b className="text-g-200">{fleet.offline}</b></span>}>
          <div className="mt-2 flex h-1.5 gap-[2px] overflow-hidden rounded-full">
            {segs.map((s) => (s.n ? <i key={s.k} className={cn("block", s.c)} style={{ flex: s.n }} /> : null))}
          </div>
        </Kpi>
        <Kpi label="月度损失（按当前状态）" value={fmtK(fleet.loss)} unit="¥/月" tone="red"
          sub={<>木桶 <b className="text-g-200">{fmtY(fleet.barrelLoss)}</b> + 断网 <b className="text-g-200">{fmtY(fleet.offlineLoss)}</b><br />折合一年 <b className="text-estop">≈ {(fleet.loss * 12 / 10000).toFixed(1)} 万元</b></>} />
        <Kpi label="已挽回收益" value={fmtK(fleet.recovered)} unit="¥/月" tone="ok"
          sub={<>来自 <b className="text-g-200">{doneN}</b> 张已完工工单 · 现场完工后实时累计</>} />
        <Kpi label="待挽回潜力" value={fmtK(fleet.potential)} unit="¥/月" tone="amber"
          sub={<>按建议方案修复短板电芯可追回，<button onClick={() => go("orders")} className="cursor-pointer text-amber-led underline-offset-2 hover:underline">去派单 →</button></>} />
      </div>

      {/* 状态墙 + 事件流 */}
      <div className="grid grid-cols-[1fr_300px] gap-4">
        <div>
          <SectionTitle sub="每格 = 一台储能柜；灯色 = 健康 / 预警 / 严重 / 离线" right={<span className="num text-[11px] text-g-500">总容量 {fleet.kwh.toLocaleString()} kWh · 可用 {Math.round(fleet.usable).toLocaleString()} kWh</span>}>
            柜群状态墙
          </SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            {SITES.map((site) => {
              const cabs = state.cabinets.filter((c) => c.siteId === site.id);
              return (
                <div key={site.id} className="panel p-2.5">
                  <div className="mb-2 flex items-center justify-between px-1 text-xs">
                    <span className="flex items-center gap-1.5 text-g-200"><Icon name="pin" size={12} className="text-g-500" />{site.name}</span>
                    <span className="flex gap-1">{cabs.map((c) => <Lamp key={c.id} d={mets[c.id].display} />)}</span>
                  </div>
                  <div className="space-y-1.5">
                    {cabs.map((c) => {
                      const m = mets[c.id];
                      const sel = state.selectedCab === c.id;
                      return (
                        <button
                          key={c.id}
                          onClick={() => go("assets", c.id)}
                          className={cn(
                            "group flex w-full cursor-pointer items-center gap-3 rounded-[4px] border px-2.5 py-2 text-left transition",
                            STATE_META[m.display].ring, "bg-g-950/50 hover:bg-g-800/80", sel && "ring-1 ring-amber-led/50"
                          )}
                        >
                          <Lamp d={m.display} />
                          <span className="w-[62px]">
                            <span className="num block text-xs font-semibold text-g-100">{c.id}</span>
                            <span className="num block text-[10px] text-g-500">{c.kwh} kWh</span>
                          </span>
                          <span className="flex-1 text-[10.5px] leading-tight text-g-400">
                            <span className="block">短板 <b className="num text-g-200">{fmtPct(m.min, 0)}</b> / 均 <b className="num text-g-200">{fmtPct(m.mean, 0)}</b></span>
                            <span className="block">ΔV <b className="num text-g-200">{m.dv.toFixed(0)}</b>mV · <b className={cn("num", m.tmax >= 45 ? "text-amber-led" : "text-g-200")}>{m.tmax.toFixed(0)}°C</b></span>
                          </span>
                          <span className="text-right">
                            {!c.bridge.online ? (
                              <Chip tone="mute"><Icon name="wifiOff" size={10} />{hoursText(c.bridge.offlineHours)}</Chip>
                            ) : (
                              <Chip tone={m.barrelLoss > 1500 ? "red" : m.barrelLoss > 800 ? "amber" : "mute"}>
                                <span className="num">-{fmtY(m.barrelLoss)}</span>
                              </Chip>
                            )}
                            <span className="num mt-0.5 block text-[9.5px] text-g-500">/月</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col">
          <SectionTitle right={<Seg size="sm" value={feed} onChange={setFeed} options={[{ v: "alert", label: `告警 ${alerts.length}` }, { v: "event", label: "动态" }]} />}>
            {feed === "alert" ? "待处理告警" : "运营动态"}
          </SectionTitle>
          <div className="panel scroll-thin flex-1 space-y-1 overflow-y-auto p-2" style={{ maxHeight: 452 }}>
            {feed === "alert"
              ? alerts.map((a) => (
                  <button key={a.id} onClick={() => go("assets", a.cabId)} className="flex w-full cursor-pointer items-start gap-2.5 rounded-[4px] px-2 py-2 text-left hover:bg-g-800">
                    <Lamp d={a.level === "crit" ? "critical" : a.level === "warn" ? "warning" : "offline"} className="mt-1" />
                    <span className="flex-1">
                      <span className="flex items-center gap-1.5 text-xs text-g-100"><b className="num">{a.cabId}</b><span className="text-g-300">{a.text}</span></span>
                      <span className="mt-0.5 block text-[11px] text-g-500">{a.sub}</span>
                    </span>
                    <Icon name="chev" size={13} className="mt-1 text-g-600" />
                  </button>
                ))
              : state.events.map((e) => (
                  <div key={e.id} className="anim-slide-in flex items-start gap-2.5 px-2 py-2">
                    <span className="num mt-0.5 w-9 flex-none text-[10.5px] text-g-500">{e.ts}</span>
                    <span className={cn("flex-1 text-xs leading-relaxed", e.level === "crit" ? "text-estop" : e.level === "ok" ? "text-ok" : e.level === "warn" ? "text-amber-led" : "text-g-300")}>{e.text}</span>
                  </div>
                ))}
          </div>
        </div>
      </div>

      {/* 损失来源 + 救援优先级 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <SectionTitle sub="哪几台柜子在“漏钱”" right={<div className="flex items-center gap-3 text-[11px] text-g-400"><span className="flex items-center gap-1"><i className="inline-block h-2 w-2 bg-amber-led" />木桶</span><span className="flex items-center gap-1"><i className="inline-block h-2 w-2 bg-g-400" />断网</span></div>}>
            月度损失来源 Top 8
          </SectionTitle>
          <div className="panel space-y-2 p-3.5">
            {losses.map(({ c, m }) => (
              <button key={c.id} onClick={() => go("revenue", c.id)} className="group flex w-full cursor-pointer items-center gap-3 text-left">
                <span className="num w-[58px] text-xs text-g-300 group-hover:text-amber-led">{c.id}</span>
                <span className="flex h-3.5 flex-1 overflow-hidden rounded-[2px] bg-g-950">
                  <i className="block bg-amber-led" style={{ width: `${(m.barrelLoss / maxLoss) * 100}%` }} />
                  <i className="block bg-g-400" style={{ width: `${(m.offlineLoss / maxLoss) * 100}%` }} />
                </span>
                <span className="num w-[70px] text-right text-xs text-g-100">{fmtY(m.barrelLoss + m.offlineLoss)}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <SectionTitle sub="按月增收益从高到低；回本 = 单次上门成本 ÷ 月增收益">救援优先级 · 一键派单</SectionTitle>
          <div className="panel divide-y divide-g-800 p-1">
            {actions.map((a) => {
              const exist = state.orders.find((o) => o.cabinetId === a.cabId && o.type === a.type && o.status !== "done");
              const payback = state.params.visitCost / a.gain;
              return (
                <div key={a.cabId + a.type} className="flex items-center gap-3 px-2.5 py-2">
                  <Lamp d={mets[a.cabId].display} />
                  <div className="w-[66px]">
                    <div className="num text-xs font-semibold">{a.cabId}</div>
                    <div className="text-[10px] text-g-500">{a.type === "rescue" ? `修 ${a.ids.length} 颗电芯` : "重连 Re-Bridge"}</div>
                  </div>
                  <div className="flex-1">
                    <div className="num text-[13px] font-semibold text-ok">+{fmtY(a.gain)}<span className="text-[10px] font-normal text-g-500"> /月</span></div>
                    <div className="num text-[10px] text-g-500">回本 {payback < 0.1 ? "<0.1" : payback.toFixed(1)} 个月</div>
                  </div>
                  {exist ? (
                    <Chip tone="amber">{exist.id} · {exist.status === "pending" ? "待派单" : exist.status === "dispatched" ? "已派单" : "作业中"}</Chip>
                  ) : (
                    <Btn size="sm" variant="primary" onClick={() => dispatch({ type: "createOrder", cabinetId: a.cabId, orderType: a.type, cellIds: a.ids, note: a.type === "rescue" ? "由资产总览建议方案生成" : "Re-Bridge 离线，现场排查联网" })}>
                      生成工单
                    </Btn>
                  )}
                </div>
              );
            })}
            {actions.length === 0 && <div className="p-6 text-center text-xs text-g-500">当前没有值得派单的救援动作 🎉</div>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 pb-1 text-[11px] text-g-600">
        <StateBadge d="healthy" label="演示数据" /> 所有金额按「收益测算」页参数实时折算：价差 {state.params.spread} ¥/kWh · {state.params.cycles} 次/日 · 效率 {fmtPct(state.params.eff, 0)}
      </div>
    </div>
  );
}
