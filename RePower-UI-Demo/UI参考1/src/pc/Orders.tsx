import { useState } from "react";
import { cn } from "../utils/cn";
import { useStore } from "../store";
import { Btn, Chip, Icon, Lamp } from "../ui";
import { ENGINEERS, SITES, TYPE_NAME, fmtY, suggestRepairIds, type Order, type OrderStatus, type OrderType } from "../model";
import type { PcPage } from "./PCApp";

const COLS: { id: OrderStatus; label: string; hint: string }[] = [
  { id: "pending", label: "待派单", hint: "PC 生成" },
  { id: "dispatched", label: "已派单", hint: "等待工程师接单" },
  { id: "in_progress", label: "现场作业中", hint: "App 实时回传" },
  { id: "done", label: "已完工", hint: "收益入账" },
];

export default function Orders({ go }: { go: (p: PcPage, cabId?: string) => void }) {
  const { state, dispatch, mets } = useStore();
  const [pick, setPick] = useState<Record<string, string>>({});
  const [newCab, setNewCab] = useState(state.cabinets[0].id);
  const [newType, setNewType] = useState<OrderType>("rescue");

  const load = (e: string) => state.orders.filter((o) => o.engineer === e && o.status !== "done").length;
  const doneGain = state.orders.filter((o) => o.status === "done").reduce((a, o) => a + o.gain, 0);

  const renderCard = (o: Order) => {
    const c = state.cabinets.find((x) => x.id === o.cabinetId)!;
    const site = SITES.find((s) => s.id === c.siteId)!;
    return (
      <div key={o.id} className={cn("rounded-[5px] border bg-g-900 p-3", o.priority === "P0" && o.status !== "done" ? "border-estop/50" : "border-g-700")}>
        <div className="flex items-center justify-between">
          <span className="num text-xs font-semibold text-g-200">{o.id}</span>
          <span className="flex items-center gap-1.5">
            <Chip tone={o.priority === "P0" ? "red" : o.priority === "P1" ? "amber" : "mute"}>{o.priority}</Chip>
            <Chip tone={o.type === "inspect" ? "red" : "mute"}>{TYPE_NAME[o.type]}</Chip>
          </span>
        </div>
        <button onClick={() => go("assets", c.id)} className="mt-2 flex w-full cursor-pointer items-center gap-2 text-left">
          <Lamp d={mets[c.id].display} />
          <span className="num text-[13px] font-semibold hover:text-amber-led">{c.id}</span>
          <span className="text-[11px] text-g-500">{site.short}</span>
        </button>
        {o.cellIds.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {o.cellIds.map((id) => <span key={id} className="num rounded-[2px] bg-g-800 px-1.5 py-0.5 text-[10.5px] text-g-200">#{String(id).padStart(2, "0")}</span>)}
          </div>
        )}
        {o.note && <div className="mt-2 text-[11px] leading-snug text-g-500">{o.note}</div>}
        <div className="mt-2.5 flex items-center justify-between border-t border-g-800 pt-2">
          <span className="text-[10.5px] text-g-500">{o.status === "done" ? "实际月增" : "预计月增"}</span>
          <span className={cn("num text-[13px] font-bold", o.gain > 0 ? "text-ok" : "text-g-500")}>{o.gain > 0 ? `+${fmtY(o.gain)}` : "—"}</span>
        </div>

        {o.status === "pending" && (
          <div className="mt-2.5 flex gap-1.5">
            <select value={pick[o.id] ?? "王工"} onChange={(e) => setPick({ ...pick, [o.id]: e.target.value })} className="h-7 flex-1 cursor-pointer rounded-[4px] border border-g-600 bg-g-950 px-1.5 text-xs text-g-100">
              {ENGINEERS.map((e) => <option key={e}>{e}</option>)}
            </select>
            <Btn size="sm" variant="primary" onClick={() => dispatch({ type: "assign", id: o.id, engineer: pick[o.id] ?? "王工" })}>派单</Btn>
          </div>
        )}
        {o.status === "dispatched" && <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-g-400"><Icon name="user" size={12} />{o.engineer} · <span className="text-amber-led">待接单</span></div>}
        {o.status === "in_progress" && <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-amber-led"><span className="lamp lamp-warn" />{o.engineer} 正在现场作业</div>}
        {o.status === "done" && <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-ok"><Icon name="check" size={12} />{o.engineer} · {o.doneAt}</div>}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_auto] gap-4">
        <div className="panel flex items-center gap-4 px-4 py-3">
          {ENGINEERS.map((e) => (
            <div key={e} className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-g-700 text-g-200"><Icon name="user" size={15} /></span>
              <div className="leading-tight">
                <div className="flex items-center gap-1.5 text-xs font-medium">{e}{e === state.engineer && <Chip tone="ok"><Icon name="phone" size={10} />App 在线</Chip>}</div>
                <div className="text-[10.5px] text-g-500">在手 <b className="num text-g-200">{load(e)}</b> 单</div>
              </div>
            </div>
          ))}
          <div className="ml-auto text-right">
            <div className="label-cap">累计挽回（月化）</div>
            <div className="num text-lg font-bold text-ok">+{fmtY(doneGain)}</div>
          </div>
        </div>
        <div className="panel flex items-center gap-2 px-3 py-3">
          <span className="text-xs text-g-400">新建</span>
          <select value={newCab} onChange={(e) => setNewCab(e.target.value)} className="num h-8 cursor-pointer rounded-[4px] border border-g-600 bg-g-950 px-2 text-xs">
            {state.cabinets.map((c) => <option key={c.id}>{c.id}</option>)}
          </select>
          <select value={newType} onChange={(e) => setNewType(e.target.value as OrderType)} className="h-8 cursor-pointer rounded-[4px] border border-g-600 bg-g-950 px-2 text-xs">
            <option value="rescue">电芯救援</option>
            <option value="reconnect">重连联网</option>
            <option value="inspect">隐患复检</option>
          </select>
          <Btn
            variant="subtle"
            onClick={() => {
              const c = state.cabinets.find((x) => x.id === newCab)!;
              dispatch({ type: "createOrder", cabinetId: newCab, orderType: newType, cellIds: newType === "rescue" ? suggestRepairIds(c) : [], note: "手动创建" });
            }}
          >
            <Icon name="list" size={13} />生成
          </Btn>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-[5px] border border-amber-led/25 bg-amber-led/5 px-3.5 py-2 text-xs text-g-300">
        <Icon name="phone" size={14} className="text-amber-led" />
        派给 <b className="text-g-100">王工</b> 的工单会<b className="text-amber-led">实时出现在工程师 App</b>（切换到「双屏联动」可同屏观看）；工程师在现场完成 Re-Pulse 注入后，这里的状态、收益与电池护照同步更新。
      </div>

      <div className="grid grid-cols-4 gap-3">
        {COLS.map((col) => {
          const items = state.orders.filter((o) => o.status === col.id);
          return (
            <div key={col.id} className="flex min-h-[320px] flex-col rounded-[6px] border border-g-800 bg-g-950/50">
              <div className="flex items-center justify-between border-b border-g-800 px-3 py-2.5">
                <span className="flex items-center gap-2 text-[13px] font-semibold">
                  <span className={cn("lamp", col.id === "pending" ? "lamp-warn" : col.id === "dispatched" ? "lamp-off" : col.id === "in_progress" ? "lamp-warn" : "lamp-ok")} />
                  {col.label}
                </span>
                <span className="num rounded-sm bg-g-800 px-1.5 text-[11px] text-g-300">{items.length}</span>
              </div>
              <div className="px-3 pt-1 text-[10px] text-g-600">{col.hint}</div>
              <div className="flex-1 space-y-2 p-2.5">
                {items.map(renderCard)}
                {items.length === 0 && <div className="py-8 text-center text-[11px] text-g-600">暂无</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
