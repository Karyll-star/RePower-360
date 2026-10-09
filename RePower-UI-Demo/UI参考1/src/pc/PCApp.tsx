import { useEffect, useState } from "react";
import { cn } from "../utils/cn";
import { useStore } from "../store";
import { Icon, Lamp, Logo, ToastStack } from "../ui";
import Overview from "./Overview";
import Assets from "./Assets";
import Revenue from "./Revenue";
import Orders from "./Orders";
import Plan from "./Plan";

export type PcPage = "overview" | "assets" | "revenue" | "orders" | "plan";

const NAV: { id: PcPage; label: string; sub: string; icon: string }[] = [
  { id: "overview", label: "资产总览", sub: "看得见", icon: "grid" },
  { id: "assets", label: "资产救援", sub: "找短板", icon: "bolt" },
  { id: "revenue", label: "收益测算", sub: "算得清", icon: "wallet" },
  { id: "orders", label: "工单调度", sub: "派得出", icon: "list" },
  { id: "plan", label: "订阅与残值", sub: "卖得掉", icon: "tag" },
];

function Clock() {
  const [t, setT] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  const p = (n: number) => String(n).padStart(2, "0");
  return <span className="num text-g-300">{`${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())} ${p(t.getHours())}:${p(t.getMinutes())}:${p(t.getSeconds())}`}</span>;
}

export default function PCApp() {
  const { state, dispatch, fleet, mets } = useStore();
  const [page, setPage] = useState<PcPage>("overview");
  const go = (p: PcPage, cabId?: string) => {
    if (cabId) dispatch({ type: "select", id: cabId });
    setPage(p);
  };
  const pending = state.orders.filter((o) => o.status === "pending").length;
  const active = state.orders.filter((o) => o.status !== "done" && o.status !== "pending").length;
  const title = NAV.find((n) => n.id === page)!;

  return (
    <div className="relative flex h-full w-full overflow-hidden bg-g-900 text-g-100">
      {/* 侧栏 */}
      <aside className="flex w-[196px] flex-none flex-col border-r border-g-700 bg-g-950/70">
        <div className="flex h-[54px] items-center gap-2.5 border-b border-g-700 px-4">
          <Logo size={28} />
          <div className="leading-tight">
            <div className="text-[15px] font-bold tracking-wide">Re-Ops</div>
            <div className="label-cap !text-[9px]">ASSET OPS · PC</div>
          </div>
        </div>
        <nav className="flex flex-col gap-0.5 p-2">
          {NAV.map((n) => {
            const on = page === n.id;
            const badge = n.id === "orders" ? pending : 0;
            return (
              <button
                key={n.id}
                onClick={() => setPage(n.id)}
                className={cn(
                  "group relative flex cursor-pointer items-center gap-2.5 rounded-[4px] px-3 py-2.5 text-left transition",
                  on ? "bg-g-800 text-g-100" : "text-g-400 hover:bg-g-800/60 hover:text-g-200"
                )}
              >
                {on && <span className="absolute left-0 top-2 h-[calc(100%-16px)] w-[3px] bg-amber-led" />}
                <Icon name={n.icon} size={17} className={on ? "text-amber-led" : ""} />
                <span className="flex-1">
                  <span className="block text-[13px] font-medium leading-none">{n.label}</span>
                  <span className="mt-1 block text-[10px] leading-none text-g-500">{n.sub}</span>
                </span>
                {badge > 0 && <span className="num rounded-sm bg-amber-led px-1.5 py-0.5 text-[10px] font-bold leading-none text-g-950">{badge}</span>}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3 p-3">
          <div className="panel-inset p-2.5">
            <div className="label-cap mb-2 flex items-center justify-between">
              <span>Re-Bridge 链路</span>
              <span className="num text-g-300">{fleet.online}/{fleet.total}</span>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {state.cabinets.map((c) => (
                <button key={c.id} title={`${c.id} · ${mets[c.id].display}`} onClick={() => go("assets", c.id)} className="flex cursor-pointer justify-center rounded-sm bg-g-900 py-1.5 hover:bg-g-800">
                  <Lamp d={mets[c.id].display} />
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 px-1 text-[11px] text-g-400">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-g-700 text-g-200"><Icon name="user" size={13} /></span>
            <span className="leading-tight">
              <span className="block text-g-200">能源总监 · 周总</span>
              <span className="block text-[10px] text-g-500">苏南零碳产业园</span>
            </span>
          </div>
        </div>
      </aside>

      {/* 主区 */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[54px] flex-none items-center justify-between border-b border-g-700 bg-g-900/80 px-5">
          <div className="flex items-center gap-3">
            <h1 className="text-[15px] font-semibold">{title.label}</h1>
            <span className="text-g-600">/</span>
            <span className="text-xs text-g-400">
              {page === "overview" && "我的储能柜现在健康吗？断网了吗？"}
              {page === "assets" && "哪一颗电芯在拖垮整柜？修它值不值？"}
              {page === "revenue" && "木桶效应每月白白损失多少钱？"}
              {page === "orders" && "派给谁、做到哪一步、赚回多少"}
              {page === "plan" && "订阅服务值不值？退役电池能卖多少钱？"}
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1.5 text-g-400"><Lamp d="healthy" />急停链路 正常</span>
            <span className="flex items-center gap-1.5 text-g-400"><Icon name="wrench" size={13} />在途工单 <b className="num text-amber-led">{active}</b></span>
            <Clock />
          </div>
        </header>
        <main className="scroll-thin min-h-0 flex-1 overflow-y-auto p-5">
          {page === "overview" && <Overview go={go} />}
          {page === "assets" && <Assets go={go} />}
          {page === "revenue" && <Revenue />}
          {page === "orders" && <Orders go={go} />}
          {page === "plan" && <Plan />}
        </main>
      </div>
      <ToastStack target="pc" className="right-4 top-16 w-[340px]" />
    </div>
  );
}
