import { useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../utils/cn";
import { useStore } from "../store";
import { useDemo } from "../demo";
import { Btn, Icon, Ring, Seg } from "../ui";
import { CellGrid } from "../viz";
import { Check, ConnectStep, MCard, OverlayCtx, StepBar, type ConnItem } from "./parts";
import {
  CELL_AH, SITES, T_ALLOW, T_CRIT, T_WARN, TYPE_NAME, avg, clamp, completenessOf, durationMin, faultText, fmtPct, fmtY, healthyMean, monthK, pulsePlan,
  type Cabinet, type Order,
} from "../model";

interface FlowProps {
  order: Order;
  cab: Cabinet;
  onExit: () => void;
  onOpenPassport: (id: string) => void;
}

export default function Job(props: FlowProps) {
  if (props.order.type === "rescue") return <RescueFlow {...props} />;
  if (props.order.type === "reconnect") return <ReconnectFlow {...props} />;
  return <InspectFlow {...props} />;
}

/* ------------------------------ 公共 ------------------------------ */
function Head({ order, cab, steps, idx, onExit }: { order: Order; cab: Cabinet; steps: string[]; idx: number; onExit: () => void }) {
  const site = SITES.find((s) => s.id === cab.siteId)!;
  return (
    <div className="sticky top-0 z-10 -mx-4 -mt-3 mb-3 border-b border-g-800 bg-g-950/95 px-4 pb-2.5 pt-3 backdrop-blur">
      <div className="mb-2.5 flex items-center justify-between">
        <button onClick={onExit} className="flex cursor-pointer items-center gap-1 text-xs text-g-400 hover:text-g-200"><Icon name="chev" size={13} className="rotate-180" />工单</button>
        <div className="text-center leading-tight">
          <div className="num text-[15px] font-bold">{cab.id} <span className="text-xs font-normal text-g-500">· {TYPE_NAME[order.type]}</span></div>
          <div className="text-[10px] text-g-500">{site.name} · {order.id}</div>
        </div>
        <span className="num rounded-[3px] bg-g-800 px-1.5 py-0.5 text-[10px] text-g-300">{order.priority}</span>
      </div>
      <StepBar steps={steps} idx={idx} />
    </div>
  );
}

const CONN_RESCUE: ConnItem[] = [
  { key: "mode", title: "切到「维护模式」", desc: "PCS 停机、DC 接触器断开。未断开前，禁止接入 Re-Pulse。", action: "已切换，扫码确认", doneText: "已确认：PCS 停机 · DC 接触器已断开", ms: 600 },
  { key: "brg", title: "连接 Re-Bridge", desc: "插入 BRG 综合口（CAN-A + 24V）。先联网，作业过程实时回传云端。", action: "连接 Re-Bridge", doneText: "Re-Bridge RB-2.4.1 已连接 · 回传延迟 38ms" },
  { key: "mnt", title: "连接 Re-Pulse", desc: "插入 MNT 维护口，并夹好 48 通道电芯采样线（红正黑负）。", action: "连接 Re-Pulse", doneText: "Re-Pulse RP-1.8 已连接 · 48 通道采样正常 · 输出级自检通过" },
];

function ResultScreen({ title, sub, gain, gainLabel, lines, cabId, before, after, onPassport, onExit }: { title: string; sub: string; gain: number; gainLabel: string; lines?: ReactNode; cabId: string; before: number; after: number; onPassport: (id: string) => void; onExit: () => void }) {
  return (
    <div className="space-y-3 pb-2 pt-2">
      <div className="flex flex-col items-center py-3 text-center">
        <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full border-2 border-ok bg-ok/10 text-ok"><Icon name="check" size={32} stroke={2.6} /></div>
        <div className="text-lg font-bold">{title}</div>
        <div className="mt-1 text-xs text-g-400">{sub}</div>
      </div>
      {gain > 0 && (
        <MCard className="border-ok/30 bg-ok/6 text-center">
          <div className="label-cap !text-ok/80">{gainLabel}</div>
          <div className="num mt-1 text-[34px] font-bold leading-none text-ok">+{fmtY(gain)}</div>
          <div className="num mt-1 text-[11px] text-g-400">年化 {fmtY(gain * 12)} · PC 中台已同步入账</div>
        </MCard>
      )}
      {lines}
      <MCard>
        <div className="flex items-center gap-3">
          <Ring value={after} size={52} stroke={5} color="#7fd1a8"><span className="num text-[11px] font-bold">{fmtPct(after, 0)}</span></Ring>
          <div className="flex-1">
            <div className="text-[13px] font-semibold">电池护照已更新</div>
            <div className="num text-[11px] text-g-400">完整度 {fmtPct(before, 0)} → <b className="text-ok">{fmtPct(after, 0)}</b></div>
          </div>
        </div>
      </MCard>
      <Btn variant="primary" size="lg" className="w-full" onClick={() => onPassport(cabId)}><Icon name="id" size={16} />查看电池护照 · 残值</Btn>
      <Btn variant="ghost" size="lg" className="w-full" onClick={onExit}>返回工单</Btn>
    </div>
  );
}

/* ------------------------------ 注入执行 ------------------------------ */
function TempGauge({ T }: { T: number }) {
  const lo = 25, hi = 62;
  const pos = (v: number) => clamp((v - lo) / (hi - lo), 0, 1) * 100;
  return (
    <div className="pb-5 pt-2">
      <div className="relative h-2.5 rounded-full" style={{ background: `linear-gradient(90deg,#2a2f34 0 ${pos(T_ALLOW)}%,#7a5410 ${pos(T_ALLOW)}% ${pos(T_WARN)}%,#ffb020 ${pos(T_WARN)}% ${pos(T_CRIT)}%,#e5342e ${pos(T_CRIT)}% 100%)` }}>
        <i className="absolute -top-1.5 block h-5 w-[3px] rounded-sm bg-white shadow-[0_0_6px_#fff]" style={{ left: `${pos(T)}%`, transition: "left .15s linear" }} />
        {[[T_ALLOW, "许可 45"], [T_WARN, "降流 48"], [T_CRIT, "急停 56"]].map(([v, l]) => (
          <span key={l as string} className="num absolute top-4 -translate-x-1/2 whitespace-nowrap text-[9px] text-g-500" style={{ left: `${pos(v as number)}%` }}>{l}</span>
        ))}
      </div>
    </div>
  );
}

interface StopInfo { reason: "auto" | "manual"; temp: number; severe: boolean }

function StopOverlay({ info, onResume, onLeave }: { info: StopInfo; onResume: () => void; onLeave: () => void }) {
  const [T, setT] = useState(info.temp);
  const [ticks, setTicks] = useState([false, false, false, false]);
  const { dispatch } = useStore();
  useEffect(() => {
    const id = setInterval(() => setT((t) => 30 + (t - 30) * Math.exp(-0.1 / 22)), 100);
    return () => clearInterval(id);
  }, []);
  const steps = [
    "撤离到 ≥ 2 m 安全距离，不要触碰电芯与汇流排",
    "观察烟雾 / 异味 / 鼓包 / 漏液——任一出现：立即疏散并拨打 119",
    "确认无烟无火后再开柜门通风，启动柜内风机或外置风扇降温",
    "每 2 分钟复测一次温度；降到 45°C 以下才允许继续，并如实上报",
  ];
  const ok = ticks.every(Boolean) && T < T_ALLOW;
  const root = useContext(OverlayCtx);
  const wrap = (node: ReactNode) => (root ? createPortal(node, root) : node);

  if (!info.severe) {
    return wrap(
      <div className="pointer-events-auto absolute inset-0 z-30 flex flex-col justify-end bg-g-950/80 p-4 backdrop-blur-[2px]">
        <MCard className="border-amber-led/50 bg-g-900">
          <div className="flex items-center gap-2 text-amber-led"><Icon name="stop" size={20} /><b className="text-[15px]">已手动急停 · 输出已切断</b></div>
          <div className="mt-1.5 text-xs leading-relaxed text-g-300">Re-Pulse 脉冲输出已断开。电芯温度 <b className="num text-g-100">{info.temp.toFixed(1)}°C</b>，未超过限值。确认现场安全后可复位继续，或放弃这颗电芯。</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Btn variant="ghost" size="lg" onClick={onLeave}>放弃这颗</Btn>
            <Btn variant="primary" size="lg" onClick={onResume}>复位并继续</Btn>
          </div>
        </MCard>
      </div>
    );
  }
  return wrap(
    <div className="pointer-events-auto absolute inset-0 z-30 flex flex-col overflow-y-auto bg-g-950/95 backdrop-blur-sm no-scrollbar">
      <div className="hazard h-2 flex-none" />
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-estop text-white shadow-[0_0_24px_rgba(229,52,46,.7)]"><Icon name="stop" size={26} /></span>
          <div>
            <div className="text-[17px] font-bold text-estop">{info.reason === "auto" ? "温度越限 · 自动急停" : "急停 · 温度异常"}</div>
            <div className="text-[11px] text-g-400">Re-Pulse 输出已切断 · DC 回路已断开</div>
          </div>
        </div>
        <MCard className="border-estop/40 bg-estop/8">
          <div className="flex items-end justify-between">
            <div>
              <div className="label-cap !text-estop/80">电芯温度（冷却中）</div>
              <div className={cn("num text-[34px] font-bold leading-none", T >= T_ALLOW ? "text-estop" : "text-ok")}>{T.toFixed(1)}<span className="text-sm">°C</span></div>
            </div>
            <div className="num text-right text-[11px] text-g-400">峰值 {info.temp.toFixed(1)}°C<br />目标 &lt; {T_ALLOW}°C</div>
          </div>
        </MCard>
        <div className="flex items-center gap-2 rounded-[8px] border border-g-700 bg-g-900 px-3 py-2 text-[11.5px] text-g-300">
          <Icon name="alert" size={14} className="text-amber-led" />已自动在 PC 中台创建 <b className="text-estop">P0 复检工单</b>，该电芯标记「待更换」。
        </div>
        <div className="space-y-1.5">
          <div className="label-cap">温度异常处置 · 逐项确认</div>
          {steps.map((s, i) => (
            <Check key={i} checked={ticks[i]} onChange={(b) => setTicks(ticks.map((t, j) => (j === i ? b : t)))}>{s}</Check>
          ))}
        </div>
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <Btn variant="danger" size="lg" onClick={() => dispatch({ type: "toast", target: "mobile", tone: "crit", text: "已模拟拨号 119 · 并通知 PC 值班" })}>119</Btn>
          <Btn variant="primary" size="lg" disabled={!ok} onClick={onLeave}>{ok ? "已处置，退出这颗" : T >= T_ALLOW ? "等待降温…" : "请完成全部确认"}</Btn>
        </div>
      </div>
    </div>
  );
}

function Injection({
  cell, amps, plan, vTarget, hasNext, onDone, onSevere, onLeave, onNext,
}: {
  cell: { id: number; soh: number; v: number; t: number };
  amps: number;
  plan: ReturnType<typeof pulsePlan>;
  vTarget: number;
  hasNext: boolean;
  onDone: (after: number) => void;
  onSevere: (temp: number) => void;
  onLeave: () => void;
  onNext: () => void;
}) {
  const { fault, setFault } = useDemo();
  const fr = useRef(fault);
  fr.current = fault;
  const totalMin = durationMin(plan.ah, amps);
  const realDur = Math.max(10, totalMin / 4);
  const s = useRef({ p: 0, T: cell.t, hist: [cell.t], derate: 1, n: 0 });
  const [phase, setPhase] = useState<"run" | "done" | "stop">("run");
  const [stop, setStop] = useState<StopInfo | null>(null);
  const [, force] = useState(0);

  useEffect(() => {
    if (phase !== "run") return;
    const dt = 0.1;
    const id = setInterval(() => {
      const st = s.current;
      const f = fr.current;
      const ieff = amps * st.derate;
      const teq = cell.t + 0.0415 * ieff * ieff + (f ? 22 : 0);
      st.T += ((teq - st.T) * dt) / (f ? 6 : 14) + (Math.random() - 0.5) * 0.05;
      if (st.T >= T_WARN) st.derate = 0.5;
      st.p = Math.min(1, st.p + (dt / realDur) * st.derate);
      st.n++;
      if (st.n % 3 === 0) {
        st.hist.push(st.T);
        if (st.hist.length > 70) st.hist.shift();
      }
      if (st.T >= T_CRIT) {
        setFault(false);
        setStop({ reason: "auto", temp: st.T, severe: true });
        onSevere(st.T);
        setPhase("stop");
        return;
      }
      if (st.p >= 1) {
        setFault(false);
        onDone(Math.min(0.995, cell.soh + plan.gainSoh));
        setPhase("done");
        return;
      }
      force((x) => x + 1);
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const st = s.current;
  const ieff = amps * st.derate;
  const volt = cell.v + (vTarget - cell.v) * st.p;
  const soh = cell.soh + plan.gainSoh * st.p;
  const remain = Math.max(0, (1 - st.p) * totalMin);
  const warn = st.T >= T_WARN - 0.001 || st.derate < 1;

  const manualStop = () => {
    setFault(false);
    const severe = st.T >= T_WARN;
    setStop({ reason: "manual", temp: st.T, severe });
    if (severe) onSevere(st.T);
    setPhase("stop");
  };

  const pts = st.hist;
  const mn = 25, mx = 62;
  const spark = pts.map((v, i) => `${i ? "L" : "M"}${(i / 69) * 100} ${28 - ((clamp(v, mn, mx) - mn) / (mx - mn)) * 26}`).join("");

  return (
    <div className="relative">
      {phase === "stop" && stop && (
        <StopOverlay
          info={stop}
          onLeave={onLeave}
          onResume={() => {
            setPhase("run");
          }}
        />
      )}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[15px] font-bold">电芯 <span className="num text-amber-led">#{String(cell.id).padStart(2, "0")}</span> · {phase === "done" ? "注入完成" : phase === "stop" ? "已急停" : "脉冲注入中"}</div>
          <span className="flex items-center gap-1.5 text-[11px] text-g-400"><span className={cn("lamp", phase === "run" ? "lamp-warn" : phase === "done" ? "lamp-ok" : "lamp-crit")} />Re-Pulse {phase === "run" ? "输出中" : phase === "done" ? "待机" : "已切断"}</span>
        </div>

        <MCard className="flex items-center gap-4">
          <Ring value={st.p} size={118} stroke={9} color={phase === "done" ? "#7fd1a8" : "#ffb020"}>
            <div className="text-center">
              <div className="num text-[26px] font-bold leading-none">{(phase === "run" ? ieff : 0).toFixed(1)}<span className="text-xs text-g-400"> A</span></div>
              <div className="num mt-1 text-[10px] text-g-500">设定 {amps} A</div>
              <div className="num text-[11px] text-amber-led">{(st.p * 100).toFixed(0)}%</div>
            </div>
          </Ring>
          <div className="flex-1 space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-g-400">电芯电压</span><span className="num text-g-100">{volt.toFixed(3)} V</span></div>
            <div className="flex justify-between"><span className="text-g-400">SOH</span><span className="num text-g-100">{fmtPct(soh)} <span className="text-ok">↑</span></span></div>
            <div className="flex justify-between"><span className="text-g-400">已注入</span><span className="num text-g-100">{(plan.ah * st.p).toFixed(1)} / {plan.ah.toFixed(1)} Ah</span></div>
            <div className="flex justify-between"><span className="text-g-400">预计剩余</span><span className="num text-g-100">{Math.ceil(remain)} min</span></div>
            <div className="text-[9.5px] text-g-600">演示加速 ×240（1 秒 ≈ 4 分钟）</div>
          </div>
        </MCard>

        <MCard>
          <div className="flex items-end justify-between">
            <div className="label-cap">电芯温度</div>
            <div className={cn("num text-[26px] font-bold leading-none", st.T >= T_CRIT - 4 ? "text-estop" : st.T >= T_WARN ? "text-amber-led" : "text-g-100")}>{st.T.toFixed(1)}<span className="text-xs text-g-400"> °C</span></div>
          </div>
          <TempGauge T={st.T} />
          <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-8 w-full">
            <line x1="0" x2="100" y1={28 - ((T_WARN - mn) / (mx - mn)) * 26} y2={28 - ((T_WARN - mn) / (mx - mn)) * 26} stroke="#ffb020" strokeDasharray="2 2" strokeWidth="0.4" opacity="0.6" vectorEffect="non-scaling-stroke" />
            <path d={spark} fill="none" stroke={st.T >= T_WARN ? "#ffb020" : "#a3abb2"} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          </svg>
        </MCard>

        {warn && phase === "run" && (
          <div className="anim-slide-in flex items-start gap-2.5 rounded-[8px] border border-amber-led/50 bg-amber-led/10 px-3 py-2.5 text-xs text-amber-led">
            <Icon name="alert" size={16} className="mt-0.5" />
            <div className="leading-snug"><b>温度 ≥ {T_WARN}°C：Re-Pulse 已自动降流至 50%</b><br /><span className="text-g-300">当前输出 {ieff.toFixed(1)} A；若继续升至 {T_CRIT}°C 将自动急停。</span></div>
          </div>
        )}

        {phase === "run" && (
          <button onClick={manualStop} className="group relative flex w-full cursor-pointer items-center justify-center gap-3 rounded-[12px] border-2 border-estop bg-estop py-4 text-white shadow-[0_0_0_4px_rgba(229,52,46,.18)] transition active:scale-[.98]">
            <span className="hazard absolute inset-x-0 top-0 h-1.5 rounded-t-[10px] opacity-60" />
            <Icon name="stop" size={26} />
            <span className="text-xl font-black tracking-[0.25em]">急 停</span>
          </button>
        )}
        {phase === "done" && (
          <div className="space-y-2">
            <MCard className="border-ok/30 bg-ok/6 text-xs leading-relaxed text-g-300">
              <b className="text-ok">#{String(cell.id).padStart(2, "0")} 已完成</b>：SOH {fmtPct(cell.soh)} → <b className="num text-ok">{fmtPct(Math.min(0.995, cell.soh + plan.gainSoh))}</b>，末端电压 {cell.v.toFixed(3)} → {vTarget.toFixed(3)} V，峰值温度 {Math.max(...st.hist).toFixed(1)}°C。
            </MCard>
            <Btn variant="primary" size="lg" className="w-full" onClick={onNext}>{hasNext ? "下一颗电芯" : "去收尾"}<Icon name="chev" size={16} /></Btn>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ 电芯救援流程 ------------------------------ */
type RStep = "connect" | "plan" | "run" | "wrap" | "ok";

function RescueFlow({ order, cab, onExit, onOpenPassport }: FlowProps) {
  const { state, dispatch, passports } = useStore();
  const [step, setStep] = useState<RStep>("connect");
  const [snap] = useState(() => cab.cells.map((c) => ({ ...c })));
  const snapCab = useMemo(() => ({ ...cab, cells: snap }), [snap]); // eslint-disable-line react-hooks/exhaustive-deps
  const targets = useMemo(() => [...order.cellIds].sort((a, b) => snap[a - 1].soh - snap[b - 1].soh), [order.cellIds, snap]);
  const hMean = useMemo(() => healthyMean(snapCab, targets), [snapCab, targets]);
  const hV = useMemo(() => avg(snap.filter((c) => !targets.includes(c.id)).map((c) => c.v)), [snap, targets]);
  const planOf = (id: number) => pulsePlan(snap[id - 1], hMean);

  const [done, setDone] = useState<{ id: number; after: number }[]>([]);
  const [flagged, setFlagged] = useState<number[]>([]);
  const [skipped, setSkipped] = useState<number[]>([]);
  const [cur, setCur] = useState(targets[0] ?? 1);
  const [amps, setAmps] = useState(() => planOf(targets[0] ?? 1).rec);
  const [mode, setMode] = useState<"soh" | "temp">("soh");
  const [ticks, setTicks] = useState([false, false, false]);
  const [result, setResult] = useState<{ gain: number } | null>(null);
  const [before] = useState(() => completenessOf(passports.find((p) => p.id === cab.id)!.items));

  const handled = (id: number) => done.some((d) => d.id === id) || flagged.includes(id) || skipped.includes(id);
  const pickCell = (id: number) => {
    setCur(id);
    setAmps(planOf(id).rec);
  };
  const nextAfter = (exclude: number) => {
    const rem = targets.filter((id) => id !== exclude && !handled(id));
    if (rem.length) {
      pickCell(rem[0]);
      setStep("plan");
    } else setStep("wrap");
  };

  const cell = snap[cur - 1];
  const plan = planOf(cur);
  const idx = step === "connect" ? 0 : step === "plan" ? 1 : step === "run" ? 2 : 3;
  const afterMap = new Map(done.map((d) => [d.id, d.after]));
  const oldMin = Math.min(...snap.map((c) => c.soh));
  const newMin = Math.min(...snap.map((c) => afterMap.get(c.id) ?? c.soh));
  const gain = Math.max(0, cab.kwh * (newMin - oldMin) * monthK(state.params));
  const nowComp = passports.find((p) => p.id === cab.id)!;
  const order_n = targets.indexOf(cur) + 1;

  if (step === "ok" && result)
    return (
      <ResultScreen title="作业完成，已回写云端" sub={`${order.id} · ${cab.id} · 修复 ${done.length} 颗电芯`} gain={result.gain} gainLabel="预计月增收益"
        cabId={cab.id} before={before} after={completenessOf(nowComp.items)} onPassport={onOpenPassport} onExit={onExit}
        lines={flagged.length > 0 ? <MCard className="border-estop/30 text-xs text-g-300"><b className="text-estop">急停电芯 {flagged.map((i) => `#${i}`).join(" ")}</b>：已标记待更换，PC 已生成 P0 复检工单。</MCard> : undefined} />
    );

  return (
    <div className="relative">
      <Head order={order} cab={cab} steps={["到场连接", "选电芯", "注入", "收尾"]} idx={idx} onExit={onExit} />

      {step === "connect" && (
        <ConnectStep cab={cab} items={CONN_RESCUE} device="rescue" nextLabel="下一步：选电芯与电流" onNext={() => setStep("plan")} />
      )}

      {step === "plan" && (
        <div className="space-y-3">
          <MCard>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[13px] font-semibold">待修复电芯 <span className="num text-g-500">{done.length + flagged.length + skipped.length}/{targets.length}</span></span>
              <Seg size="sm" value={mode} onChange={setMode} options={[{ v: "soh", label: "SOH" }, { v: "temp", label: "温度" }]} />
            </div>
            <CellGrid cells={snap} mode={mode} selected={cur} targets={targets} done={done.map((d) => d.id)} cell={21} onPick={(id) => targets.includes(id) && !handled(id) && pickCell(id)} />
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {targets.map((id) => {
                const p = planOf(id);
                const st = done.some((d) => d.id === id) ? "done" : flagged.includes(id) ? "flag" : skipped.includes(id) ? "skip" : "todo";
                return (
                  <button key={id} onClick={() => st === "todo" && pickCell(id)} className={cn("num flex cursor-pointer items-center gap-1 rounded-[5px] border px-2 py-1 text-[11px]", cur === id ? "border-amber-led bg-amber-led/10 text-amber-led" : "border-g-700 text-g-300", st === "done" && "border-ok/40 text-ok", st === "flag" && "border-estop/50 text-estop")}>
                    {st === "done" ? "✓" : st === "flag" ? "!" : "●"} #{String(id).padStart(2, "0")}
                    <span className="text-g-500">{p.blocked ? "禁止" : `${p.rec}A`}</span>
                  </button>
                );
              })}
            </div>
          </MCard>

          <MCard>
            <div className="mb-3 flex items-baseline justify-between">
              <div className="text-[15px] font-bold">电芯 <span className="num text-amber-led">#{String(cur).padStart(2, "0")}</span></div>
              <span className="num text-[11px] text-g-500">第 {order_n}/{targets.length} 颗</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5 text-center">
              {[
                { l: "SOH", v: fmtPct(cell.soh, 1), c: "text-amber-led" },
                { l: "压差", v: `+${((cell.v - hV) * 1000).toFixed(0)}mV`, c: "text-g-100" },
                { l: "温度", v: `${cell.t.toFixed(1)}°`, c: cell.t > T_ALLOW ? "text-estop" : "text-g-100" },
                { l: "可修复", v: `${(cell.rec * 100).toFixed(0)}%`, c: "text-g-100" },
              ].map((x) => (
                <div key={x.l} className="rounded-[6px] bg-g-950 px-1 py-2">
                  <div className="text-[9.5px] text-g-500">{x.l}</div>
                  <div className={cn("num mt-0.5 text-[13px] font-bold", x.c)}>{x.v}</div>
                </div>
              ))}
            </div>

            {plan.blocked ? (
              <div className="mt-3 space-y-2.5 rounded-[8px] border border-estop/50 bg-estop/8 p-3">
                <div className="flex items-center gap-2 font-bold text-estop"><Icon name="fire" size={17} />禁止注入：{cell.t.toFixed(1)}°C 超过许可 {T_ALLOW}°C</div>
                <ol className="list-decimal space-y-1 pl-4 text-[12px] leading-snug text-g-300">
                  <li>人员退到 2 m 外，不要触碰该电芯与汇流排</li>
                  <li>确认无烟无火后开柜门通风，启动风机降温</li>
                  <li>红外枪复测；持续升温或鼓包 → 判定更换</li>
                </ol>
                <Btn variant="danger" size="lg" className="w-full" onClick={() => {
                  dispatch({ type: "emergency", orderId: order.id, cabinetId: cab.id, cellId: cur, temp: cell.t });
                  setFlagged((f) => [...f, cur]);
                  nextAfter(cur);
                }}>上报异常 · 生成复检工单</Btn>
              </div>
            ) : (
              <>
                <div className="mt-4 flex items-baseline justify-between">
                  <span className="text-xs text-g-300">注入电流</span>
                  <span className={cn("num text-[28px] font-bold leading-none", amps > plan.cap ? "text-estop" : amps > plan.rec ? "text-amber-led" : "text-g-100")}>{amps}<span className="text-sm text-g-400"> A</span></span>
                </div>
                <input className="slider mt-1" type="range" min={4} max={24} step={1} value={amps} onChange={(e) => setAmps(Number(e.target.value))} />
                <div className="relative mb-6 h-3 text-[9.5px]">
                  <span className="num absolute -translate-x-1/2 text-ok" style={{ left: `${((plan.rec - 4) / 20) * 100}%` }}>▲推荐 {plan.rec}</span>
                  <span className="num absolute -translate-x-1/2 text-estop" style={{ left: `${((clamp(plan.cap, 4, 24) - 4) / 20) * 100}%`, top: 12 }}>▲上限 {plan.cap}</span>
                </div>
                <div className="space-y-1.5 rounded-[8px] bg-g-950 p-2.5 text-xs">
                  <div className="flex justify-between"><span className="text-g-400">预计时长</span><span className="num text-g-100">{Math.round(durationMin(plan.ah, amps))} min · {plan.ah.toFixed(1)} Ah</span></div>
                  <div className="flex justify-between"><span className="text-g-400">预计修复后 SOH</span><span className="num text-ok">{fmtPct(cell.soh)} → {fmtPct(plan.after)}</span></div>
                  <div className="flex justify-between"><span className="text-g-400">温度降额</span><span className="num text-g-300">{cell.t.toFixed(1)}°C → 上限 {plan.cap} A（容量 {CELL_AH} Ah）</span></div>
                </div>
                {amps > plan.cap ? (
                  <div className="mt-2 text-[11.5px] text-estop">超过当前温度下的安全上限，无法开始。</div>
                ) : amps > plan.rec ? (
                  <div className="mt-2 text-[11.5px] text-amber-led">高于推荐值：升温更快，可能触发自动降流（≥{T_WARN}°C）。</div>
                ) : (
                  <div className="mt-2 text-[11.5px] text-g-500">低于或等于推荐值：更稳，但耗时更长。</div>
                )}
                <Btn variant="primary" size="lg" className="mt-3 w-full" disabled={amps > plan.cap || amps <= 0} onClick={() => setStep("run")}>
                  <Icon name="bolt" size={16} />开始注入 {amps} A
                </Btn>
              </>
            )}
          </MCard>
          {(done.length > 0 || flagged.length > 0) && (
            <Btn variant="ghost" className="w-full" onClick={() => setStep("wrap")}>提前收尾（已完成 {done.length} 颗）</Btn>
          )}
        </div>
      )}

      {step === "run" && (
        <Injection
          key={cur}
          cell={cell}
          amps={amps}
          plan={plan}
          vTarget={hV}
          hasNext={targets.some((id) => id !== cur && !handled(id))}
          onDone={(after) => setDone((d) => [...d, { id: cur, after }])}
          onSevere={(temp) => {
            dispatch({ type: "emergency", orderId: order.id, cabinetId: cab.id, cellId: cur, temp });
            setFlagged((f) => (f.includes(cur) ? f : [...f, cur]));
          }}
          onLeave={() => {
            if (!flagged.includes(cur)) setSkipped((s) => [...s, cur]);
            nextAfter(cur);
          }}
          onNext={() => nextAfter(cur)}
        />
      )}

      {step === "wrap" && (
        <div className="space-y-3">
          <MCard>
            <div className="mb-2 text-[13px] font-semibold">本次作业结果</div>
            <div className="space-y-1.5">
              {done.map((d) => (
                <div key={d.id} className="num flex items-center justify-between rounded-[6px] bg-g-950 px-3 py-2 text-xs">
                  <span className="text-g-300">#{String(d.id).padStart(2, "0")}</span>
                  <span>{fmtPct(snap[d.id - 1].soh)} <span className="text-g-500">→</span> <b className="text-ok">{fmtPct(d.after)}</b></span>
                </div>
              ))}
              {flagged.map((id) => (
                <div key={id} className="num flex items-center justify-between rounded-[6px] border border-estop/30 bg-estop/8 px-3 py-2 text-xs">
                  <span className="text-estop">#{String(id).padStart(2, "0")} 急停</span><span className="text-estop">待更换 · 已上报</span>
                </div>
              ))}
              {done.length === 0 && flagged.length === 0 && <div className="py-3 text-center text-xs text-g-500">本次没有完成修复的电芯</div>}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-g-800 pt-3 text-xs">
              <div><div className="text-g-500">木桶水位</div><div className="num font-semibold">{fmtPct(oldMin)} <span className="text-g-500">→</span> <span className="text-ok">{fmtPct(newMin)}</span></div></div>
              <div><div className="text-g-500">预计月增收益</div><div className="num font-bold text-ok">+{fmtY(gain)}</div></div>
            </div>
          </MCard>
          <div className="space-y-1.5">
            <div className="label-cap">离场前确认</div>
            {["拆除 Re-Pulse 输出夹与 48 通道采样线", "拆除 Re-Bridge 临时线缆，恢复面板盖板", "退出维护模式，确认 PCS 恢复并网运行"].map((t, i) => (
              <Check key={t} checked={ticks[i]} onChange={(b) => setTicks(ticks.map((x, j) => (j === i ? b : x)))}>{t}</Check>
            ))}
          </div>
          <Btn variant="primary" size="lg" className="w-full" disabled={!ticks.every(Boolean)} onClick={() => {
            dispatch({ type: "completeRescue", id: order.id, per: done });
            setResult({ gain });
            setStep("ok");
          }}>
            <Icon name="shield" size={16} />提交并写入电池护照
          </Btn>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ 重连联网流程 ------------------------------ */
const CONN_RECON: ConnItem[] = [
  { key: "brg", title: "手机蓝牙连接 Re-Bridge", desc: "靠近 BRG 口 1 米内，长按 Re-Bridge 配对键 3 秒，进入本地调试。", action: "蓝牙配对", doneText: "已连接 Re-Bridge RB-2.4.1 · 本地调试通道就绪" },
  { key: "ant", title: "查看 ANT 天线口与指示灯", desc: "绿灯常亮 = 已联网；红灯闪 = SIM/信号异常；全灭 = 供电异常。", action: "已确认指示灯状态", doneText: "指示灯状态已记录，进入自动诊断", ms: 500 },
];

function ReconnectFlow({ order, cab, onExit, onOpenPassport }: FlowProps) {
  const { dispatch, passports } = useStore();
  const [step, setStep] = useState<"connect" | "diag" | "wrap" | "ok">("connect");
  const fault = cab.bridge.fault ?? "sim";
  const [rows, setRows] = useState<{ label: string; ok: boolean | null; detail: string }[]>([]);
  const [phase, setPhase] = useState<"idle" | "running" | "result" | "verifying" | "online">("idle");
  const [ticks, setTicks] = useState([false, false]);
  const [before] = useState(() => completenessOf(passports.find((p) => p.id === cab.id)!.items));
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const broken = { power: [0, 1, 2, 3], sim: [2], antenna: [3] }[fault];
  const spec = [
    { label: "24V 供电", good: "24.1 V", bad: "0.0 V · F2 熔断器开路" },
    { label: "CAN-A · BMS 通讯", good: "BMS 帧 100 Hz", bad: "无响应（供电连锁）" },
    { label: "SIM 注册", good: "已注册 · 中国移动 IoT", bad: fault === "power" ? "未上电" : "欠费停机 · CSQ 4" },
    { label: "天线信号", good: "−68 dBm", bad: fault === "power" ? "—" : "馈线脱落 · −112 dBm" },
  ];

  const play = (isFixed: boolean, after: () => void) => {
    setRows(spec.map((s) => ({ label: s.label, ok: null, detail: "检测中…" })));
    spec.forEach((s, i) => {
      timers.current.push(setTimeout(() => {
        const ok = isFixed || !broken.includes(i);
        setRows((r) => r.map((x, j) => (j === i ? { label: s.label, ok, detail: ok ? s.good : s.bad } : x)));
        if (i === spec.length - 1) after();
      }, 650 * (i + 1)));
    });
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const startDiag = () => {
    setStep("diag");
    setPhase("running");
    play(false, () => setPhase("result"));
  };
  const fix = () => {
    setPhase("verifying");
    play(true, () => setPhase("online"));
  };

  const FIX = {
    power: { title: "更换 F2 熔断器（5A）并复位", desc: "Re-Bridge 24V 输入保险开路。更换后给 Re-Bridge 重新上电。", btn: "已更换 · 重新上电" },
    sim: { title: "切换到备用 eSIM 通道", desc: "当前物联网卡欠费停机。Re-Bridge 支持双通道，一键切换并重新注册。", btn: "切换备用 eSIM" },
    antenna: { title: "重新紧固 SMA 馈线 / 更换吸盘天线", desc: "天线馈线脱落导致信号 −112 dBm。紧固后重测。", btn: "已紧固 · 重新检测" },
  }[fault];

  if (step === "ok")
    return (
      <ResultScreen title="Re-Bridge 已重新上线" sub={`${order.id} · ${cab.id} · 断网 ${cab.bridge.offlineHours} 小时 → 在线`} gain={order.gain} gainLabel="避免断网月损失"
        cabId={cab.id} before={before} after={completenessOf(passports.find((p) => p.id === cab.id)!.items)} onPassport={onOpenPassport} onExit={onExit} />
    );

  return (
    <div>
      <Head order={order} cab={cab} steps={["到场连接", "联网诊断", "收尾"]} idx={step === "connect" ? 0 : step === "diag" ? 1 : 2} onExit={onExit} />
      {step === "connect" && <ConnectStep cab={cab} items={CONN_RECON} device="reconnect" nextLabel="开始联网诊断" onNext={startDiag} />}

      {step === "diag" && (
        <div className="space-y-3">
          <MCard>
            <div className="mb-2 flex items-center justify-between"><span className="text-[13px] font-semibold">Re-Bridge 自动诊断</span><span className="text-[11px] text-g-500">{faultText(cab.bridge.fault)}</span></div>
            <div className="space-y-1.5">
              {rows.map((r) => (
                <div key={r.label} className={cn("flex items-center gap-2.5 rounded-[7px] border px-3 py-2.5", r.ok === null ? "border-g-700" : r.ok ? "border-ok/30 bg-ok/6" : "border-estop/40 bg-estop/8")}>
                  <span className="flex h-5 w-5 flex-none items-center justify-center">
                    {r.ok === null ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-led border-t-transparent" /> : r.ok ? <Icon name="check" size={15} className="text-ok" stroke={3} /> : <Icon name="x" size={15} className="text-estop" stroke={3} />}
                  </span>
                  <span className="flex-1 text-[13px]">{r.label}</span>
                  <span className={cn("num text-[11px]", r.ok === false ? "text-estop" : "text-g-400")}>{r.detail}</span>
                </div>
              ))}
            </div>
          </MCard>

          {phase === "result" && (
            <MCard className="anim-slide-in border-amber-led/50 bg-amber-led/6">
              <div className="flex items-center gap-2 text-amber-led"><Icon name="wrench" size={17} /><b className="text-[14px]">定位到故障：{FIX.title}</b></div>
              <div className="mt-1.5 text-xs leading-relaxed text-g-300">{FIX.desc}</div>
              <Btn variant="primary" size="lg" className="mt-3 w-full" onClick={fix}>{FIX.btn}</Btn>
            </MCard>
          )}
          {phase === "verifying" && <div className="text-center text-xs text-g-400">修复后重新检测中…</div>}
          {phase === "online" && (
            <div className="anim-slide-in space-y-2">
              <MCard className="border-ok/40 bg-ok/6">
                <div className="flex items-center gap-2 text-ok"><Icon name="wifi" size={18} /><b>已联网 · 云端握手成功</b></div>
                <div className="num mt-1.5 text-xs text-g-300">补传断网期间缓存数据 <b className="text-g-100">{(cab.bridge.offlineHours * 60).toLocaleString()}</b> 条（{cab.bridge.offlineHours} h × 60 点/h）</div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-g-800"><i className="block h-full w-full bg-ok" /></div>
              </MCard>
              <Btn variant="primary" size="lg" className="w-full" onClick={() => setStep("wrap")}>去收尾<Icon name="chev" size={16} /></Btn>
            </div>
          )}
        </div>
      )}

      {step === "wrap" && (
        <div className="space-y-3">
          <MCard className="text-xs leading-relaxed text-g-300"><b className="text-g-100">结果：</b>Re-Bridge 在线，信号 −68 dBm，故障原因：{faultText(cab.bridge.fault)}（已处理）。云端将自动恢复策略下发。</MCard>
          <div className="space-y-1.5">
            <div className="label-cap">离场前确认</div>
            {["盖好 Re-Bridge 防水盖与天线罩", "拍照上传：指示灯常绿 + 天线安装位"].map((t, i) => (
              <Check key={t} checked={ticks[i]} onChange={(b) => setTicks(ticks.map((x, j) => (j === i ? b : x)))}>{t}</Check>
            ))}
          </div>
          <Btn variant="primary" size="lg" className="w-full" disabled={!ticks.every(Boolean)} onClick={() => { dispatch({ type: "completeReconnect", id: order.id }); setStep("ok"); }}>
            <Icon name="shield" size={16} />提交并回写护照
          </Btn>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ 复检流程 ------------------------------ */
const CONN_INSP: ConnItem[] = [CONN_RESCUE[0], CONN_RESCUE[1]];

function InspectFlow({ order, cab, onExit, onOpenPassport }: FlowProps) {
  const { dispatch, passports } = useStore();
  const [step, setStep] = useState<"connect" | "check" | "ok">("connect");
  const [ticks, setTicks] = useState([false, false, false, false]);
  const [decision, setDecision] = useState<"replace" | "watch">("replace");
  const [before] = useState(() => completenessOf(passports.find((p) => p.id === cab.id)!.items));
  const cells = order.cellIds.map((id) => cab.cells[id - 1]);
  const items = ["红外枪复测电芯表面温度，并与 App 读数对比", "外观检查：鼓包 / 漏液 / 变色 / 异味", "汇流排与采样线紧固力矩复核", "绝缘电阻测试 ≥ 1 MΩ"];

  if (step === "ok")
    return <ResultScreen title="复检已闭环" sub={`${order.id} · ${cab.id} · ${decision === "replace" ? "判定更换" : "持续观察"}`} gain={0} gainLabel="" cabId={cab.id} before={before} after={completenessOf(passports.find((p) => p.id === cab.id)!.items)} onPassport={onOpenPassport} onExit={onExit} />;

  return (
    <div>
      <Head order={order} cab={cab} steps={["到场连接", "安全复核", "收尾"]} idx={step === "connect" ? 0 : 1} onExit={onExit} />
      {step === "connect" && <ConnectStep cab={cab} items={CONN_INSP} device="inspect" nextLabel="开始安全复核" onNext={() => setStep("check")} />}
      {step === "check" && (
        <div className="space-y-3">
          {order.note && <MCard className="border-estop/30 bg-estop/6 text-xs leading-relaxed text-g-300"><b className="text-estop">工单备注：</b>{order.note}</MCard>}
          {cells.length > 0 && (
            <MCard>
              <div className="label-cap mb-1.5">目标电芯</div>
              <div className="flex gap-2">{cells.map((c) => <span key={c.id} className="num rounded-[6px] bg-g-950 px-3 py-2 text-xs">#{String(c.id).padStart(2, "0")} · <b className={c.t >= T_ALLOW ? "text-estop" : ""}>{c.t.toFixed(1)}°C</b> · {fmtPct(c.soh)}</span>)}</div>
            </MCard>
          )}
          <div className="space-y-1.5">
            {items.map((t, i) => <Check key={t} checked={ticks[i]} onChange={(b) => setTicks(ticks.map((x, j) => (j === i ? b : x)))}>{t}</Check>)}
          </div>
          <MCard>
            <div className="mb-2 text-[13px] font-semibold">判定</div>
            <Seg value={decision} onChange={setDecision} className="w-full [&>button]:flex-1" options={[{ v: "replace", label: "更换电芯" }, { v: "watch", label: "持续观察" }]} />
          </MCard>
          <Btn variant="primary" size="lg" className="w-full" disabled={!ticks.every(Boolean)} onClick={() => { dispatch({ type: "completeInspect", id: order.id, replaceCells: decision === "replace" ? order.cellIds : [] }); setStep("ok"); }}>
            <Icon name="shield" size={16} />提交复检结论
          </Btn>
        </div>
      )}
    </div>
  );
}
