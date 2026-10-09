import { useEffect, useState } from "react";
import { cn } from "../utils/cn";
import { useStore } from "../store";
import { Btn, Icon, ToastStack } from "../ui";
import { nowHM } from "../model";
import { OverlayCtx } from "./parts";
import MOrders from "./Orders";
import MPassport from "./Passport";
import Job from "./Job";

type Tab = "orders" | "job" | "passport";

export default function MobileApp() {
  const { state, dispatch } = useStore();
  const [tab, setTab] = useState<Tab>("orders");
  const [jobId, setJobId] = useState<string | null>(null);
  const [passId, setPassId] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<HTMLElement | null>(null);
  const [time, setTime] = useState(nowHM());

  useEffect(() => {
    const i = setInterval(() => setTime(nowHM()), 15000);
    return () => clearInterval(i);
  }, []);

  const order = jobId ? state.orders.find((o) => o.id === jobId) : null;
  const cab = order ? state.cabinets.find((c) => c.id === order.cabinetId) : null;
  const pendingN = state.orders.filter((o) => o.engineer === state.engineer && (o.status === "dispatched" || o.status === "in_progress")).length;

  const start = (id: string) => {
    dispatch({ type: "start", id });
    setJobId(id);
    setTab("job");
  };

  const TABS: { id: Tab; label: string; icon: string; badge?: number; dot?: boolean }[] = [
    { id: "orders", label: "工单", icon: "list", badge: pendingN },
    { id: "job", label: "现场", icon: "bolt", dot: !!order && order.status !== "done" },
    { id: "passport", label: "电池护照", icon: "id" },
  ];

  return (
    <OverlayCtx.Provider value={overlay}>
      <div className="relative flex h-full w-full select-none flex-col overflow-hidden bg-g-950 text-g-100">
        {/* 状态栏 */}
        <div className="flex h-[34px] flex-none items-center justify-between px-6 pt-1.5 text-[11px] font-semibold">
          <span className="num">{time}</span>
          <span className="flex items-center gap-1.5 text-g-300">
            <Icon name="wifi" size={13} />
            <span className="num text-[10px]">5G</span>
            <span className="flex h-[10px] w-[20px] items-center rounded-[3px] border border-g-400 p-[1px]"><i className="block h-full w-[70%] rounded-[1px] bg-g-200" /></span>
          </span>
        </div>
        {/* 应用头 */}
        <div className="flex h-10 flex-none items-center justify-between border-b border-g-800 px-4">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-[4px] bg-amber-led text-[11px] font-black text-g-950">R</span>
            <span className="text-[13px] font-bold tracking-wide">Re-Ops <span className="font-normal text-g-500">Field</span></span>
          </div>
          <span className="flex items-center gap-1.5 text-[10.5px] text-g-400"><span className="lamp lamp-ok" />{state.engineer} · 在线</span>
        </div>

        {/* 内容区：三个页签常驻，保证作业进度不丢 */}
        <div className="relative min-h-0 flex-1">
          <div className={cn("no-scrollbar absolute inset-0 overflow-y-auto px-4 pb-6 pt-3", tab !== "orders" && "hidden")}>
            <MOrders onStart={start} />
          </div>
          <div className={cn("no-scrollbar absolute inset-0 overflow-y-auto px-4 pb-8 pt-3", tab !== "job" && "hidden")}>
            {order && cab ? (
              <Job
                key={order.id}
                order={order}
                cab={cab}
                onExit={() => {
                  setJobId(null);
                  setTab("orders");
                }}
                onOpenPassport={(id) => {
                  setPassId(id);
                  setJobId(null);
                  setTab("passport");
                }}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-g-700 bg-g-850 text-g-500"><Icon name="bolt" size={26} /></span>
                <div className="text-[15px] font-semibold">还没有进行中的作业</div>
                <div className="mt-1 text-xs leading-relaxed text-g-500">到场后先在这里连接设备：Re-Bridge 联网 → Re-Pulse 注入。请先在「工单」里选择一张工单。</div>
                <Btn variant="primary" size="lg" className="mt-4" onClick={() => setTab("orders")}>去选工单</Btn>
              </div>
            )}
          </div>
          <div className={cn("no-scrollbar absolute inset-0 overflow-y-auto px-4 pb-6 pt-3", tab !== "passport" && "hidden")}>
            <MPassport openId={passId} onOpen={setPassId} />
          </div>
        </div>

        {/* 底部导航 */}
        <nav className="relative z-40 grid h-[62px] flex-none grid-cols-3 border-t border-g-800 bg-g-900 pb-2">
          {TABS.map((t) => {
            const on = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className={cn("relative flex cursor-pointer flex-col items-center justify-center gap-1 transition", on ? "text-amber-led" : "text-g-500")}>
                {on && <span className="absolute left-1/2 top-0 h-[2px] w-8 -translate-x-1/2 bg-amber-led" />}
                <span className="relative">
                  <Icon name={t.icon} size={21} />
                  {!!t.badge && <span className="num absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-led px-1 text-[9px] font-bold text-g-950">{t.badge}</span>}
                  {t.dot && <span className="lamp lamp-warn absolute -right-1.5 -top-0.5 !h-2 !w-2" />}
                </span>
                <span className="text-[10.5px] font-medium">{t.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="pointer-events-none absolute bottom-1 left-1/2 h-1 w-28 -translate-x-1/2 rounded-full bg-g-600" />

        {/* 浮层挂载点（急停遮罩，盖住底部导航） */}
        <div ref={setOverlay} className="pointer-events-none absolute inset-x-0 bottom-0 top-[34px] z-[45]" />
        <ToastStack target="mobile" className="left-3 right-3 top-9" />
      </div>
    </OverlayCtx.Provider>
  );
}
