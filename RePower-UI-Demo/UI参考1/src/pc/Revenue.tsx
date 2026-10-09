import { useMemo } from "react";
import { cn } from "../utils/cn";
import { useStore } from "../store";
import { Btn, Icon, SectionTitle, SliderField } from "../ui";
import { DEFAULT_PARAMS, avg, fmtK, fmtPct, fmtY, monthK, suggestRepairIds } from "../model";
import { LineChart } from "./charts";

function Waterfall({ steps }: { steps: { label: string; sub: string; value: number; kind: "total" | "loss"; color: string }[] }) {
  const W = 640, H = 210, padT = 22, padB = 44, padL = 8;
  const max = steps[0].value;
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const bw = 74;
  const gap = (W - padL * 2 - bw * steps.length) / (steps.length - 1);
  let run = max;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {steps.map((s, i) => {
        const x = padL + i * (bw + gap);
        let top: number, bot: number;
        if (s.kind === "total") {
          top = s.value;
          bot = 0;
          if (i > 0) run = s.value;
        } else {
          top = run;
          bot = run - s.value;
          run = bot;
        }
        const next = steps[i + 1];
        return (
          <g key={s.label}>
            <rect x={x} y={y(top)} width={bw} height={Math.max(2, y(bot) - y(top))} rx="2" fill={s.color} opacity={s.kind === "loss" ? 0.92 : 1} />
            {s.kind === "loss" && <rect x={x} y={y(top)} width={bw} height={Math.max(2, y(bot) - y(top))} fill="url(#wf-hatch)" />}
            <text x={x + bw / 2} y={y(top) - 6} textAnchor="middle" fontSize="11" fontWeight="700" fill="#e8ebee" fontFamily="var(--font-mono)">
              {s.kind === "loss" ? "−" : ""}{fmtK(s.value)}
            </text>
            <text x={x + bw / 2} y={H - 26} textAnchor="middle" fontSize="11" fill="#c9ced3">{s.label}</text>
            <text x={x + bw / 2} y={H - 11} textAnchor="middle" fontSize="9" fill="#7c848c">{s.sub}</text>
            {next && <line x1={x + bw} x2={x + bw + gap} y1={y(run)} y2={y(run)} stroke="#565d65" strokeDasharray="2 3" />}
          </g>
        );
      })}
      <defs>
        <pattern id="wf-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(0,0,0,.35)" strokeWidth="2" />
        </pattern>
      </defs>
    </svg>
  );
}

export default function Revenue() {
  const { state, dispatch, mets, fleet } = useStore();
  const p = state.params;
  const k = monthK(p);
  const cab = state.cabinets.find((c) => c.id === state.selectedCab) ?? state.cabinets[0];
  const m = mets[cab.id];

  const theory = fleet.kwh * k;
  const aging = state.cabinets.reduce((a, c) => a + c.kwh * (1 - mets[c.id].mean) * k, 0);
  const actual = theory - aging - fleet.barrelLoss - fleet.offlineLoss;

  const trend = useMemo(() => {
    const L = fleet.loss;
    const visits = state.cabinets.filter((c) => suggestRepairIds(c).length > 0 || !c.bridge.online).length;
    const R = Math.min(L, fleet.potential + fleet.offlineLoss * 0.9);
    const wait: number[] = [0];
    const act: number[] = [0];
    for (let i = 1; i <= 12; i++) {
      wait.push(wait[i - 1] + L * Math.pow(1.04, i));
      act.push(act[i - 1] + (L - R) * Math.pow(1.01, i) + (i === 1 ? visits * p.visitCost : 0));
    }
    return { wait, act, visits, saved: wait[12] - act[12] };
  }, [fleet, state.cabinets, p.visitCost]);

  const rows: [string, string, string, boolean?][] = [
    ["① 名义容量", `${cab.kwh}`, "kWh"],
    ["② 均值SOH→潜力", `${fmtPct(m.mean)}→${m.potentialKwh.toFixed(1)}`, "kWh"],
    ["③ 短板SOH→实际", `${fmtPct(m.min)}→${m.usableKwh.toFixed(1)}`, "kWh"],
    ["④ 每循环锁死", `${m.lostKwh.toFixed(1)}`, "kWh", true],
    ["⑤ × 日循环×30天", `${p.cycles}×30`, `=${p.cycles * 30}次`],
    ["⑥ × 价差×效率", `${p.spread.toFixed(2)}×${fmtPct(p.eff, 0)}`, `=${(p.spread * p.eff).toFixed(2)}`],
  ];

  return (
    <div className="grid grid-cols-[1fr_292px] gap-4">
      <div className="min-w-0 space-y-4">
        {/* Hero */}
        <div className="panel relative overflow-hidden p-5">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-[0.07]" style={{ background: "repeating-linear-gradient(-45deg,#ffb020 0 14px,transparent 14px 28px)" }} />
          <div className="label-cap">木桶效应 + 断网 · 每月白白损失</div>
          <div className="mt-2 flex items-end gap-4">
            <div className="num text-[56px] font-bold leading-none text-estop">{fmtY(fleet.loss)}</div>
            <div className="pb-1.5 text-sm text-g-400">/ 月<span className="mx-2 text-g-600">·</span>一年 <b className="num text-g-100">≈ {(fleet.loss * 12 / 10000).toFixed(1)} 万元</b></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-g-400">
            <span>木桶损失 <b className="num text-amber-led">{fmtY(fleet.barrelLoss)}</b></span>
            <span>断网损失 <b className="num text-g-200">{fmtY(fleet.offlineLoss)}</b></span>
            <span>占理论收益 <b className="num text-g-200">{fmtPct(fleet.loss / theory)}</b></span>
            <span>其中可挽回 <b className="num text-ok">{fmtY(Math.min(fleet.loss, fleet.potential + fleet.offlineLoss))}</b></span>
          </div>
        </div>

        {/* 瀑布 */}
        <div className="panel p-4">
          <SectionTitle sub="只有“木桶”和“断网”两块是可以被运维挽回的；自然衰减不可避免">12 柜月收益瀑布</SectionTitle>
          <Waterfall
            steps={[
              { label: "理论收益", sub: "100% SOH 满额", value: theory, kind: "total", color: "#565d65" },
              { label: "自然衰减", sub: "不可避免", value: aging, kind: "loss", color: "#7c848c" },
              { label: "木桶损失", sub: "可挽回 · Re-Pulse", value: fleet.barrelLoss, kind: "loss", color: "#ffb020" },
              { label: "断网损失", sub: "可避免 · Re-Bridge", value: fleet.offlineLoss, kind: "loss", color: "#e5342e" },
              { label: "实际收益", sub: "当前每月到手", value: actual, kind: "total", color: "#7fd1a8" },
            ]}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* 单柜算账 */}
          <div className="panel p-4">
            <SectionTitle
              sub="把一台柜子的损失算到小数点"
              right={
                <select value={cab.id} onChange={(e) => dispatch({ type: "select", id: e.target.value })} className="num cursor-pointer rounded-[4px] border border-g-600 bg-g-950 px-2 py-1 text-xs text-g-100">
                  {state.cabinets.map((c) => <option key={c.id} value={c.id}>{c.id}</option>)}
                </select>
              }
            >
              单柜算账小票
            </SectionTitle>
            <div className="panel-inset divide-y divide-dashed divide-g-700 p-1 font-mono text-xs">
              {rows.map(([a, b, c, hl]) => (
                <div key={a} className={cn("flex items-center justify-between px-2.5 py-1.5", hl && "bg-amber-led/8 text-amber-led")}>
                  <span className={hl ? "" : "text-g-400"}>{a}</span>
                  <span><b className={hl ? "" : "text-g-100"}>{b}</b> <span className="text-[10.5px] text-g-500">{c}</span></span>
                </div>
              ))}
              <div className="flex items-center justify-between bg-estop/10 px-2.5 py-2.5">
                <span className="font-sans text-[13px] font-semibold text-g-100">= 本柜月损（木桶）</span>
                <span className="text-lg font-bold text-estop">{fmtY(m.barrelLoss)}</span>
              </div>
            </div>
            {!cab.bridge.online && <div className="mt-2 flex items-center gap-1.5 text-[11px] text-g-400"><Icon name="wifiOff" size={12} className="text-amber-led" />另有断网损失 <b className="num text-g-200">{fmtY(m.offlineLoss)}</b>/月（日收益 × {fmtPct(0.2, 0)} × 30）</div>}
          </div>

          {/* 观望 vs 救援 */}
          <div className="panel p-4">
            <SectionTitle sub={`假设弱电芯每月多衰减 4%；救援需 ${trend.visits} 次上门`}>12 个月：继续观望 vs 立即救援</SectionTitle>
            <LineChart
              height={178}
              labels={Array.from({ length: 13 }, (_, i) => `${i}月`)}
              yFmt={(n) => fmtK(n)}
              series={[
                { name: "继续观望 · 累计损失", color: "#e5342e", data: trend.wait, dashed: true },
                { name: "立即救援 · 累计损失+上门费", color: "#7fd1a8", data: trend.act, area: true },
              ]}
            />
            <div className="mt-1 flex items-center justify-between rounded-[4px] bg-ok/8 px-3 py-2 text-xs">
              <span className="text-g-300">12 个月可多留住</span>
              <span className="num text-lg font-bold text-ok">+{fmtY(trend.saved)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 参数 */}
      <div className="space-y-4">
        <div className="panel sticky top-0 space-y-4 p-4">
          <SectionTitle sub="改动后 PC 全页面与移动端估值同步">收益参数</SectionTitle>
          <SliderField label="峰谷价差" value={p.spread} min={0.3} max={1.3} step={0.01} unit=" ¥/kWh" fmt={(v) => v.toFixed(2)} onChange={(v) => dispatch({ type: "params", patch: { spread: v } })} hint="江浙工商业一般 0.6–1.0" />
          <SliderField label="日循环次数" value={p.cycles} min={1} max={3} step={0.5} unit=" 次/日" onChange={(v) => dispatch({ type: "params", patch: { cycles: v } })} hint="两充两放 = 2" />
          <SliderField label="系统效率" value={Math.round(p.eff * 100)} min={80} max={96} step={1} unit="%" onChange={(v) => dispatch({ type: "params", patch: { eff: v / 100 } })} />
          <SliderField label="单次上门成本" value={p.visitCost} min={500} max={3000} step={100} unit=" ¥" onChange={(v) => dispatch({ type: "params", patch: { visitCost: v } })} hint="差旅 + 工时 + Re-Pulse 摊销" />
          <div className="panel-inset p-3 text-[11px] leading-relaxed text-g-400">
            <div className="label-cap mb-1">口径</div>
            月损 = Σ 柜容量 × (平均 SOH − 最短板 SOH) × 日循环 × 30 × 价差 × 效率
            <div className="num mt-1.5 text-g-300">k = {k.toFixed(2)} ¥/kWh·月 · 平均 SOH {fmtPct(avg(state.cabinets.map((c) => mets[c.id].mean)))}</div>
          </div>
          <Btn variant="ghost" className="w-full" onClick={() => dispatch({ type: "params", patch: DEFAULT_PARAMS })}><Icon name="refresh" size={13} />恢复默认参数</Btn>
        </div>
      </div>
    </div>
  );
}
