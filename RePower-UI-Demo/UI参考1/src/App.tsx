import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "./utils/cn";
import { StoreProvider, useStore } from "./store";
import { DemoProvider, useDemo } from "./demo";
import { Btn, Icon, Logo, Seg } from "./ui";
import PCApp from "./pc/PCApp";
import MobileApp from "./mobile/MobileApp";
import { bestChannel, completenessOf, fmtK, fmtY, valueOf } from "./model";

type Mode = "dual" | "pc" | "mobile";

const PC_W = 1200;
const DEV_H = 824;
const PHONE_W = 414;
const GAP = 28;

function useBox() {
  const ref = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(1440);
  const [vh, setVh] = useState(typeof window === "undefined" ? 900 : window.innerHeight);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setCw(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([e]) => setCw(e.contentRect.width));
    ro.observe(el);
    const onR = () => setVh(window.innerHeight);
    window.addEventListener("resize", onR);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onR);
    };
  }, []);
  return { ref, cw, vh };
}

function Scaled({ s, w, h, children }: { s: number; w: number; h: number; children: ReactNode }) {
  return (
    <div style={{ width: w * s, height: h * s }} className="mx-auto">
      <div style={{ width: w, height: h, transform: `scale(${s})`, transformOrigin: "top left" }}>{children}</div>
    </div>
  );
}

function PcFrame({ h }: { h: number }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-[14px] border border-g-600 bg-g-900 shadow-[0_30px_80px_rgba(0,0,0,.6)]" style={{ height: h }}>
      <div className="flex h-[30px] flex-none items-center gap-3 border-b border-g-700 bg-g-950 px-3">
        <span className="flex gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-estop/80" /><i className="h-2.5 w-2.5 rounded-full bg-amber-led/80" /><i className="h-2.5 w-2.5 rounded-full bg-g-600" /></span>
        <span className="num mx-auto flex h-5 w-[360px] items-center justify-center rounded-[4px] bg-g-900 text-[10.5px] text-g-500">ops.re-grid.cn / console</span>
        <span className="w-12" />
      </div>
      <div className="min-h-0 flex-1"><PCApp /></div>
    </div>
  );
}

function PhoneFrame() {
  return (
    <div className="relative rounded-[52px] border-[3px] border-g-600 bg-black p-[12px] shadow-[0_30px_80px_rgba(0,0,0,.65),inset_0_0_0_2px_#1d2125]" style={{ width: PHONE_W, height: DEV_H }}>
      <div className="relative h-full w-full overflow-hidden rounded-[40px] bg-g-950">
        <span className="absolute left-1/2 top-2 z-[60] h-[22px] w-[88px] -translate-x-1/2 rounded-full bg-black" />
        <MobileApp />
      </div>
      <span className="absolute -left-[5px] top-24 h-10 w-[3px] rounded-l bg-g-600" />
      <span className="absolute -right-[5px] top-32 h-16 w-[3px] rounded-r bg-g-600" />
    </div>
  );
}

function Caption({ icon, title, sub, className, right }: { icon: string; title: string; sub?: string; className?: string; right?: ReactNode }) {
  return (
    <div className={cn("mb-2.5 flex items-center gap-2.5 px-1", className)} style={{ height: 28 }}>
      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-[4px] border border-g-600 bg-g-850 text-amber-led"><Icon name={icon} size={14} /></span>
      <span className="whitespace-nowrap text-[13px] font-semibold text-g-100">{title}</span>
      {sub && <span className="whitespace-nowrap text-[11px] text-g-500">{sub}</span>}
      {right && <span className="ml-auto">{right}</span>}
    </div>
  );
}

/* 演示开关：在手机「注入」进行中点击，模拟电芯温升异常 */
function FaultToggle() {
  const { fault, setFault } = useDemo();
  return (
    <button
      onClick={() => setFault(!fault)}
      title="在手机端“注入”进行中点击，模拟电芯温升异常，体验自动降流与急停"
      className={cn("flex cursor-pointer items-center gap-2 rounded-[5px] border px-2.5 py-1 text-[11px] font-medium transition", fault ? "border-estop bg-estop/15 text-estop" : "border-g-600 text-g-300 hover:bg-g-800")}
    >
      <span className={cn("lamp", fault ? "lamp-crit" : "lamp-off")} />
      {fault ? "温升异常已注入" : "模拟温升异常"}
    </button>
  );
}

/* 价值链：看见 → 算清 → 派单 → 变现 */
function Chain() {
  const { state, fleet, passports } = useStore();
  const pool = useMemo(() => {
    let v = 0, v0 = 0;
    for (const pp of passports) {
      const b = { kwh: pp.kwh, soh: pp.soh, cycles: pp.cycles, chem: pp.chem, completeness: completenessOf(pp.items) };
      const ch = bestChannel(b);
      v += valueOf({ ...b, channel: ch }).value;
      v0 += valueOf({ ...b, completeness: 0, channel: ch }).value;
    }
    return { v, up: v - v0 };
  }, [passports]);
  const active = state.orders.filter((o) => o.status !== "done").length;
  const cells = [
    { n: "01", t: "可看", d: "资产健康 / 断网", v: `${fleet.online}/${fleet.total}`, u: "在线", sub: `${fleet.warning + fleet.critical} 台异常 · ${fleet.offline} 台离线`, c: "text-g-100" },
    { n: "02", t: "可算", d: "木桶 + 断网损失", v: fmtK(fleet.loss), u: "¥/月", sub: `木桶 ${fmtY(fleet.barrelLoss)} · 断网 ${fmtY(fleet.offlineLoss)}`, c: "text-estop" },
    { n: "03", t: "可派单", d: "Re-Pulse 现场救援", v: String(active), u: "单在途", sub: `已挽回 ${fmtY(fleet.recovered)}/月`, c: "text-amber-led" },
    { n: "04", t: "可变现", d: "电池护照 · 残值", v: fmtK(pool.v), u: "¥ 残值池", sub: `护照溢价 +${fmtY(pool.up)}`, c: "text-ok" },
  ];
  return (
    <div className="grid grid-cols-4 gap-0 overflow-hidden rounded-[8px] border border-g-700 bg-g-850">
      {cells.map((c, i) => (
        <div key={c.n} className={cn("relative flex items-center gap-3 px-4 py-2.5", i > 0 && "border-l border-g-700")}>
          <span className="num text-[11px] text-g-600">{c.n}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2"><span className="text-[13px] font-bold text-g-100">{c.t}</span><span className="truncate text-[10.5px] text-g-500">{c.d}</span></div>
            <div className="mt-0.5 flex items-baseline gap-1.5"><span className={cn("num text-[20px] font-bold leading-none", c.c)}>{c.v}</span><span className="text-[10.5px] text-g-400">{c.u}</span></div>
            <div className="num mt-0.5 truncate text-[10px] text-g-500">{c.sub}</div>
          </div>
          {i < 3 && <span className="absolute -right-[7px] top-1/2 z-10 flex h-3.5 w-3.5 -translate-y-1/2 items-center justify-center rounded-full border border-g-600 bg-g-900 text-amber-led"><Icon name="chev" size={9} stroke={3} /></span>}
        </div>
      ))}
    </div>
  );
}

function DemoBar({ onReset }: { onReset: () => void }) {
  const steps = [
    { who: "PC", t: "资产救援", d: "默认选中 ESC-202，拖动「修复最弱电芯」，看木桶水位抬升与月增收益" },
    { who: "PC", t: "生成并派单", d: "「按此方案生成工单」→ 工单调度 → 派给「王工」" },
    { who: "APP", t: "现场作业", d: "手机收到推送 → 依次连 Re-Bridge、Re-Pulse → 选电芯与电流 → 注入" },
    { who: "APP", t: "异常与变现", d: "注入中点手机上方「模拟温升异常」体验降流与急停；完工后进护照申请回购报价" },
  ];
  return (
    <div className="grid grid-cols-[1fr_auto] gap-4">
      <div className="grid grid-cols-4 gap-2.5">
        {steps.map((s, i) => (
          <div key={i} className="rounded-[8px] border border-g-800 bg-g-900/70 px-3 py-2.5">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="num flex h-4 w-4 items-center justify-center rounded-full bg-g-700 text-[9px] font-bold text-g-200">{i + 1}</span>
              <span className={cn("num rounded-[2px] px-1 text-[9px] font-bold", s.who === "PC" ? "bg-g-700 text-g-200" : "bg-amber-led text-g-950")}>{s.who}</span>
              <span className="font-semibold text-g-200">{s.t}</span>
            </div>
            <div className="mt-1.5 text-[11px] leading-snug text-g-500">{s.d}</div>
          </div>
        ))}
      </div>
      <div className="flex w-[210px] flex-col justify-between gap-2 rounded-[8px] border border-g-700 bg-g-850 p-3">
        <div className="text-[11px] leading-snug text-g-500">PC 与手机共用同一份数据：任何一端的操作都会实时影响另一端。</div>
        <Btn variant="ghost" size="sm" onClick={onReset}><Icon name="refresh" size={12} />重置演示数据</Btn>
      </div>
    </div>
  );
}

function Shell() {
  const { dispatch } = useStore();
  const { setFault } = useDemo();
  const [mode, setMode] = useState<Mode>("dual");
  const [epoch, setEpoch] = useState(0);
  const { ref, cw, vh } = useBox();

  const reset = () => {
    setFault(false);
    dispatch({ type: "reset" });
    setEpoch((e) => e + 1);
  };

  const avail = Math.max(640, vh - 250);
  let stage: ReactNode;
  if (mode === "dual") {
    const total = PC_W + GAP + PHONE_W;
    const s = Math.min(1, cw / total);
    stage = (
      <Scaled s={s} w={total} h={DEV_H + 38}>
        <div className="flex items-start" style={{ gap: GAP }}>
          <div style={{ width: PC_W }}>
            <Caption icon="monitor" title="PC 中台 · 资产救援与收益管理" sub="能源总监 / 运营经理" />
            <PcFrame h={DEV_H} />
          </div>
          <div style={{ width: PHONE_W }}>
            <Caption icon="phone" title="移动 App · 现场作业与护照" right={<FaultToggle />} />
            <PhoneFrame />
          </div>
        </div>
      </Scaled>
    );
  } else if (mode === "pc") {
    const s = Math.min(1, cw / PC_W);
    stage = (
      <Scaled s={s} w={cw / s} h={avail / s}>
        <PcFrame h={avail / s} />
      </Scaled>
    );
  } else {
    const s = Math.min(1, (avail + 40) / (DEV_H + 6), cw / PHONE_W);
    stage = (
      <div className="flex items-start justify-center gap-10">
        <div>
          <div style={{ width: PHONE_W * s }} className="mx-auto">
            <Caption icon="phone" title="移动 App · 现场作业与护照" right={<FaultToggle />} />
          </div>
          <Scaled s={s} w={PHONE_W} h={DEV_H}>
            <PhoneFrame />
          </Scaled>
        </div>
        <div className="hidden w-[340px] space-y-3 pt-10 lg:block">
          <div className="panel p-4">
            <div className="label-cap">工程师到了柜子前</div>
            <div className="mt-2 space-y-2.5 text-[12.5px] leading-relaxed text-g-300">
              <div className="flex gap-2.5"><span className="num mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-amber-led text-[11px] font-bold text-g-950">1</span><span><b className="text-g-100">先断后连</b>：切维护模式 → 接 <b className="text-amber-led">Re-Bridge</b>（BRG 口）→ 接 <b className="text-amber-led">Re-Pulse</b>（MNT 口）。</span></div>
              <div className="flex gap-2.5"><span className="num mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-amber-led text-[11px] font-bold text-g-950">2</span><span><b className="text-g-100">逐颗注入</b>：App 按电芯 SOH 与温度给出推荐电流和安全上限。</span></div>
              <div className="flex gap-2.5"><span className="num mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-estop text-[11px] font-bold text-white">!</span><span><b className="text-g-100">温度三道线</b>：45°C 禁止开始 · 48°C 自动降流 50% · 56°C 自动急停并上报。</span></div>
              <div className="flex gap-2.5"><span className="num mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-ok text-[11px] font-bold text-g-950">¥</span><span><b className="text-g-100">修复即增值</b>：完工写入护照，木桶短板抬高，残值同步上调。</span></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="panel p-3"><div className="label-cap text-amber-led">Re-Bridge</div><div className="mt-1 text-[11.5px] leading-snug text-g-400">联网网关：CAN 采集 + 4G 回传 + 双 SIM。断网 = 数据缺口 = 收益与残值双损。</div></div>
            <div className="panel p-3"><div className="label-cap text-amber-led">Re-Pulse</div><div className="mt-1 text-[11.5px] leading-snug text-g-400">脉冲修复仪：对单颗电芯定向注入电流，抬高木桶最短板。</div></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[1720px] flex-col gap-3 px-5 pb-6 pt-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Logo size={36} />
          <div className="leading-tight">
            <h1 className="text-[17px] font-bold tracking-wide">Re-Ops <span className="font-normal text-g-400">· 工商业储能后市场资产运营</span></h1>
            <p className="mt-0.5 text-[11.5px] text-g-500">把「坏了才修」变成「资产运营」：PC 中台管收益，现场 App 管作业，同一套硬件语言（Re-Pulse · Re-Bridge）</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-3 text-[11px] text-g-500 xl:flex"><span className="flex items-center gap-1.5"><i className="lamp lamp-ok" />健康</span><span className="flex items-center gap-1.5"><i className="lamp lamp-warn" />预警</span><span className="flex items-center gap-1.5"><i className="lamp lamp-crit" />急停/严重</span><span className="flex items-center gap-1.5"><i className="lamp lamp-off" />离线</span></span>
          <Seg
            value={mode}
            onChange={setMode}
            options={[
              { v: "dual", label: <span className="flex items-center gap-1.5"><Icon name="split" size={13} />双屏联动</span> },
              { v: "pc", label: <span className="flex items-center gap-1.5"><Icon name="monitor" size={13} />PC 中台</span> },
              { v: "mobile", label: <span className="flex items-center gap-1.5"><Icon name="phone" size={13} />移动 App</span> },
            ]}
          />
        </div>
      </header>

      <Chain />

      <div ref={ref} className="min-w-0">
        <div key={epoch}>{stage}</div>
      </div>

      <DemoBar onReset={reset} />
      <footer className="pb-2 text-center text-[10.5px] text-g-600">演示数据 · 收益、残值与降额曲线均为原理示意估算，不构成报价或安全作业规程</footer>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <DemoProvider>
        <Shell />
      </DemoProvider>
    </StoreProvider>
  );
}
