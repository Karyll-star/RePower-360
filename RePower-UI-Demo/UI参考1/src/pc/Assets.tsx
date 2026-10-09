import { useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { useStore } from "../store";
import { Btn, Chip, Icon, Lamp, Seg, SectionTitle, StateBadge, STATE_META } from "../ui";
import { BarrelChart } from "../viz";
import { SITES, faultText, fmtPct, fmtY, healthyMean, hoursText, pulsePlan, simulateRepair, suggestRepairIds, T_ALLOW } from "../model";
import type { PcPage } from "./PCApp";

function Stat({ label, value, unit, sub, tone = "plain" }: { label: string; value: string; unit?: string; sub?: string; tone?: "plain" | "amber" | "red" | "ok" }) {
  const c = { plain: "text-g-100", amber: "text-amber-led", red: "text-estop", ok: "text-ok" }[tone];
  return (
    <div className="panel px-3.5 py-3">
      <div className="label-cap">{label}</div>
      <div className={cn("num mt-1.5 text-[22px] font-bold leading-none", c)}>
        {value}
        {unit && <span className="ml-1 text-[11px] font-medium text-g-400">{unit}</span>}
      </div>
      {sub && <div className="mt-1.5 text-[10.5px] text-g-500">{sub}</div>}
    </div>
  );
}

function Bars({ rssi, online }: { rssi: number; online: boolean }) {
  const lvl = !online ? 0 : rssi > -70 ? 4 : rssi > -80 ? 3 : rssi > -90 ? 2 : 1;
  return (
    <span className="flex items-end gap-[2px]">
      {[1, 2, 3, 4].map((i) => (
        <i key={i} className={cn("block w-[3px] rounded-[1px]", i <= lvl ? "bg-ok" : "bg-g-700")} style={{ height: 3 + i * 3 }} />
      ))}
    </span>
  );
}

export default function Assets({ go }: { go: (p: PcPage, cabId?: string) => void }) {
  const { state, dispatch, mets } = useStore();
  const [filter, setFilter] = useState<"all" | "bad" | "off" | "fix">("all");
  const [ns, setNs] = useState<Record<string, number>>({});

  const list = useMemo(
    () =>
      state.cabinets.filter((c) => {
        const m = mets[c.id];
        if (filter === "bad") return m.health !== "healthy";
        if (filter === "off") return !c.bridge.online;
        if (filter === "fix") return suggestRepairIds(c).length > 0;
        return true;
      }),
    [state.cabinets, mets, filter]
  );

  const cab = state.cabinets.find((c) => c.id === state.selectedCab) ?? state.cabinets[0];
  const m = mets[cab.id];
  const site = SITES.find((s) => s.id === cab.siteId)!;
  const cands = useMemo(() => [...cab.cells].filter((x) => x.flag !== "replace").sort((a, b) => a.soh - b.soh), [cab]);
  const n = Math.min(ns[cab.id] ?? suggestRepairIds(cab).length, cands.length);
  const ids = cands.slice(0, n).map((x) => x.id);
  const sim = useMemo(() => simulateRepair(cab, ids, state.params), [cab, ids.join(","), state.params]); // eslint-disable-line react-hooks/exhaustive-deps
  const afterMap = useMemo(() => (n > 0 ? new Map(sim.per.map((x) => [x.id, x.after])) : undefined), [sim, n]);
  const hMean = healthyMean(cab, ids);
  const payback = sim.gain > 0 ? state.params.visitCost / sim.gain : null;
  const existRescue = state.orders.find((o) => o.cabinetId === cab.id && o.type === "rescue" && o.status !== "done");
  const existRecon = state.orders.find((o) => o.cabinetId === cab.id && o.type === "reconnect" && o.status !== "done");
  const top = cands.slice(0, 8);

  return (
    <div className="grid grid-cols-[236px_1fr] gap-4">
      {/* 左：资产列表 */}
      <div>
        <Seg
          className="mb-3 w-full [&>button]:flex-1"
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[{ v: "all", label: "全部" }, { v: "bad", label: "异常" }, { v: "off", label: "离线" }, { v: "fix", label: "可救援" }]}
        />
        <div className="space-y-1.5">
          {list.map((c) => {
            const mm = mets[c.id];
            const sel = c.id === cab.id;
            return (
              <button
                key={c.id}
                onClick={() => dispatch({ type: "select", id: c.id })}
                className={cn("flex w-full cursor-pointer items-center gap-3 rounded-[5px] border px-3 py-2.5 text-left transition", sel ? "border-amber-led/60 bg-g-800" : "border-g-700 bg-g-850 hover:bg-g-800")}
              >
                <Lamp d={mm.display} />
                <span className="flex-1">
                  <span className="num block text-[13px] font-semibold">{c.id}</span>
                  <span className="block text-[10.5px] text-g-500">{SITES.find((s) => s.id === c.siteId)!.short} · {c.kwh}kWh</span>
                </span>
                <span className="text-right">
                  <span className="num block text-xs text-g-200">{fmtPct(mm.min, 0)}<span className="text-g-600"> / {fmtPct(mm.mean, 0)}</span></span>
                  <span className={cn("num block text-[10.5px]", mm.barrelLoss > 1500 ? "text-estop" : "text-g-500")}>-{fmtY(mm.barrelLoss)}</span>
                </span>
              </button>
            );
          })}
          {list.length === 0 && <div className="panel p-6 text-center text-xs text-g-500">没有符合条件的资产</div>}
        </div>
      </div>

      {/* 右：详情 */}
      <div className="min-w-0 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lamp d={m.display} className="!h-3 !w-3" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="num text-xl font-bold">{cab.id}</h2>
                <StateBadge d={m.display} />
                {!cab.bridge.online && <Chip tone="mute">末次状态：{STATE_META[m.health].label}</Chip>}
              </div>
              <div className="mt-0.5 text-[11px] text-g-500">{site.name} · {cab.kwh} kWh · 在役 {Math.round(cab.ageMonths / 12 * 10) / 10} 年 · 循环 {cab.cycles} 次 · SN <span className="num">{cab.sn}</span></div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!cab.bridge.online && (existRecon ? <Chip tone="amber">{existRecon.id} · 重连中</Chip> : <Btn onClick={() => dispatch({ type: "createOrder", cabinetId: cab.id, orderType: "reconnect", cellIds: [], note: faultText(cab.bridge.fault) })}><Icon name="wifiOff" size={14} />生成重连工单</Btn>)}
            <Btn variant="ghost" onClick={() => go("revenue", cab.id)}><Icon name="wallet" size={14} />算这台的账</Btn>
          </div>
        </div>

        {!cab.bridge.online && (
          <div className="flex items-center gap-3 rounded-[5px] border border-g-600 bg-g-800/60 px-3.5 py-2.5 text-xs text-g-300">
            <span className="hazard-amber h-8 w-1.5 rounded-sm" />
            <Icon name="wifiOff" size={16} className="text-amber-led" />
            <span>
              Re-Bridge 已离线 <b className="num text-amber-led">{hoursText(cab.bridge.offlineHours)}</b>，下方为<b>最后一次上报</b>的数据；断网期间柜体退化为本地固定策略，每月约损失 <b className="num text-estop">{fmtY(m.offlineLoss)}</b>，护照“连续运行数据”出现缺口。
            </span>
          </div>
        )}

        <div className="grid grid-cols-[repeat(4,1fr)_1.35fr] gap-3">
          <Stat label="最短板 SOH" value={fmtPct(m.min)} sub={`电芯 #${String(m.weakest.id).padStart(2, "0")} · 平均 ${fmtPct(m.mean)}`} tone={m.min < 0.74 ? "red" : m.min < 0.86 ? "amber" : "plain"} />
          <Stat label="末端压差 ΔV" value={m.dv.toFixed(0)} unit="mV" sub="≥100mV 触发均衡建议" tone={m.dv >= 160 ? "red" : m.dv >= 100 ? "amber" : "plain"} />
          <Stat label="最高温度" value={m.tmax.toFixed(1)} unit="°C" sub={`电芯 #${String(m.tmaxCell.id).padStart(2, "0")} · ${m.tmax >= T_ALLOW ? "超出注入许可" : "正常"}`} tone={m.tmax >= 52 ? "red" : m.tmax >= T_ALLOW ? "amber" : "plain"} />
          <Stat label="木桶月损" value={fmtY(m.barrelLoss)} sub={`锁死 ${m.lostKwh.toFixed(1)} kWh / 次循环`} tone="amber" />
          <div className="panel flex flex-col justify-between px-3.5 py-3">
            <div className="label-cap flex items-center justify-between"><span>Re-Bridge</span><span className={cn("flex items-center gap-1 normal-case tracking-normal", cab.bridge.online ? "text-ok" : "text-g-300")}><Bars rssi={cab.bridge.rssi} online={cab.bridge.online} />{cab.bridge.online ? "在线" : "离线"}</span></div>
            <div className="mt-1.5 space-y-0.5 text-[10.5px] text-g-400">
              <div className="flex justify-between"><span>信号</span><span className="num text-g-200">{cab.bridge.online ? `${cab.bridge.rssi} dBm` : "—"}</span></div>
              <div className="flex justify-between"><span>固件 / 运营商</span><span className="num text-g-200">{cab.bridge.fw}</span></div>
              <div className="flex justify-between"><span>{cab.bridge.online ? "最后上报" : "推测原因"}</span><span className={cn("num", cab.bridge.online ? "text-g-200" : "text-amber-led")}>{cab.bridge.online ? "刚刚" : faultText(cab.bridge.fault).replace("疑似 ", "")}</span></div>
            </div>
          </div>
        </div>

        {/* 木桶 + 救援推演 */}
        <div className="space-y-4">
          <div className="panel p-4">
            <SectionTitle sub="48 串电芯逐颗 SOH · 点击任意一块木板 = 修复到这块为止" right={<Chip tone="mute"><Icon name="cpu" size={11} />按串联位排列</Chip>}>
              电芯木桶图
            </SectionTitle>
            <BarrelChart
              cells={cab.cells}
              after={afterMap}
              targets={ids}
              height={240}
              onPick={(id) => {
                const r = cands.findIndex((x) => x.id === id);
                if (r >= 0) setNs({ ...ns, [cab.id]: Math.min(r + 1, 10) });
              }}
            />
            <div className="mt-2 rounded-[4px] bg-g-950/70 px-3 py-2 text-[11.5px] leading-relaxed text-g-400">
              <b className="text-g-200">怎么读：</b>整柜可放出的电量只由<b className="text-amber-led">最短那块木板</b>决定。当前 {cab.kwh} kWh 的柜子，名义可用 <span className="num text-g-200">{m.potentialKwh.toFixed(0)}</span> kWh，实际只能用 <span className="num text-amber-led">{m.usableKwh.toFixed(0)}</span> kWh——每个循环白白锁死 <span className="num text-estop">{m.lostKwh.toFixed(1)}</span> kWh。
            </div>
          </div>

          <div className="panel grid grid-cols-[1.25fr_1fr_1fr_170px] gap-5 p-4">
            <div>
            <SectionTitle>Re-Pulse 救援推演</SectionTitle>
            <div className="mb-0.5 flex items-baseline justify-between text-xs"><span className="text-g-300">修复最弱电芯</span><span className="num text-lg font-bold text-amber-led">{n}<span className="ml-0.5 text-[11px] font-normal text-g-400">颗</span></span></div>
            <input className="slider" type="range" min={0} max={Math.min(10, cands.length)} value={n} onChange={(e) => setNs({ ...ns, [cab.id]: Number(e.target.value) })} />
            <div className="mt-1 text-[10.5px] text-g-500">系统建议 {suggestRepairIds(cab).length} 颗（低于均值 3.5 个点）</div>
            </div>

            <div className="space-y-2 self-center border-l border-g-800 pl-5 text-xs">
              <div className="flex justify-between"><span className="text-g-400">木桶水位</span><span className="num text-g-100">{fmtPct(sim.oldMin)} <span className="text-g-500">→</span> <b className="text-ok">{fmtPct(sim.newMin)}</b></span></div>
              <div className="flex justify-between"><span className="text-g-400">可用容量</span><span className="num text-g-100">{sim.oldUsable.toFixed(0)} <span className="text-g-500">→</span> <b className="text-ok">{sim.newUsable.toFixed(0)}</b> kWh</span></div>
              <div className="flex justify-between"><span className="text-g-400">单次上门成本</span><span className="num text-g-100">{fmtY(state.params.visitCost)}</span></div>
            </div>

            <div className="self-center rounded-[4px] border border-ok/25 bg-ok/5 p-3">
              <div className="label-cap !text-ok/80">预计月增收益</div>
              <div className="num text-[26px] font-bold leading-tight text-ok">+{fmtY(sim.gain)}</div>
              <div className="num text-[11px] text-g-400">{payback ? `回本 ${payback < 0.1 ? "<0.1" : payback.toFixed(1)} 个月 · 年化 ${fmtY(sim.gain * 12)}` : "—"}</div>
            </div>

            <div className="flex items-center">
              {existRescue ? (
                <Btn className="w-full" disabled variant="ghost">已有工单 {existRescue.id}</Btn>
              ) : (
                <Btn className="w-full" variant="primary" size="lg" disabled={n === 0 || sim.gain <= 0} onClick={() => dispatch({ type: "createOrder", cabinetId: cab.id, orderType: "rescue", cellIds: ids, note: `木桶短板 #${String(m.weakest.id).padStart(2, "0")}，修复 ${n} 颗` })}>
                  <Icon name="wrench" size={15} />按此方案生成工单
                </Btn>
              )}
            </div>
          </div>
        </div>

        {/* 电芯清单 */}
        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-g-800 px-4 py-2.5">
            <span className="text-[13px] font-semibold">最弱 8 颗电芯 · Re-Pulse 建议注入参数</span>
            <span className="text-[11px] text-g-500">这些参数会随工单下发到工程师 App</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="label-cap text-left [&>th]:px-4 [&>th]:py-2 [&>th]:font-normal">
                <th>电芯</th><th>SOH</th><th>末端电压</th><th>温度</th><th>可修复系数</th><th>建议电流</th><th>预计修复后</th>
              </tr>
            </thead>
            <tbody>
              {top.map((c) => {
                const pp = pulsePlan(c, hMean);
                const inPlan = ids.includes(c.id);
                return (
                  <tr key={c.id} className={cn("border-t border-g-800 [&>td]:px-4 [&>td]:py-2", inPlan && "bg-amber-led/5")}>
                    <td className="num font-semibold">{inPlan && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-led align-middle" />}#{String(c.id).padStart(2, "0")}{c.repairs > 0 && <Chip tone="ok" className="ml-2">已修复 {c.repairs} 次</Chip>}</td>
                    <td className="num">{fmtPct(c.soh)}</td>
                    <td className="num">{c.v.toFixed(3)} V</td>
                    <td className={cn("num", c.t >= T_ALLOW ? "text-estop" : "")}>{c.t.toFixed(1)}°C</td>
                    <td className="num">{(c.rec * 100).toFixed(0)}%</td>
                    <td className="num">{pp.blocked ? <span className="text-estop">禁止 · 先降温</span> : <b className="text-amber-led">{pp.rec} A</b>}</td>
                    <td className="num text-ok">{fmtPct(pp.after)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
