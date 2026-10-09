import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from "react";
import {
  DEFAULT_PARAMS,
  RETIRED_SEED,
  SEED_CABINETS,
  avg,
  cabinetPassport,
  clamp,
  fmtPct,
  fmtY,
  metrics,
  monthK,
  nowHM,
  orderGain,
  seedOrders,
  simulateRepair,
  suggestRepairIds,
  type Cabinet,
  type LogItem,
  type Metrics,
  type Order,
  type OrderType,
  type Params,
  type Passport,
} from "./model";

export type Tone = "info" | "warn" | "crit" | "ok";
export interface Toast { id: number; target: "pc" | "mobile"; tone: Tone; text: string }
export interface EventItem { id: number; ts: string; level: Tone; text: string; cabId?: string }

export interface State {
  cabinets: Cabinet[];
  orders: Order[];
  params: Params;
  planId: "basic" | "care" | "ops";
  scope: number;
  events: EventItem[];
  toasts: Toast[];
  listings: Record<string, number>;
  extraLogs: Record<string, LogItem[]>;
  selectedCab: string;
  activeOrderId: string | null;
  engineer: string;
  seq: number;
}

export type Action =
  | { type: "params"; patch: Partial<Params> }
  | { type: "plan"; planId?: State["planId"]; scope?: number }
  | { type: "select"; id: string }
  | { type: "createOrder"; cabinetId: string; orderType: OrderType; cellIds: number[]; note?: string }
  | { type: "assign"; id: string; engineer: string }
  | { type: "start"; id: string }
  | { type: "setActive"; id: string | null }
  | { type: "completeRescue"; id: string; per: { id: number; after: number }[] }
  | { type: "completeReconnect"; id: string }
  | { type: "completeInspect"; id: string; replaceCells: number[] }
  | { type: "emergency"; orderId: string; cabinetId: string; cellId: number; temp: number }
  | { type: "list"; passportId: string; price: number }
  | { type: "toast"; target: "pc" | "mobile"; tone: Tone; text: string }
  | { type: "dismiss"; id: number }
  | { type: "reset" };

function initial(): State {
  const params = DEFAULT_PARAMS;
  return {
    cabinets: SEED_CABINETS.map((c) => ({ ...c, cells: c.cells.map((x) => ({ ...x })), bridge: { ...c.bridge } })),
    orders: seedOrders(params),
    params,
    planId: "care",
    scope: 8,
    events: [
      { id: 3, ts: "08:40", level: "warn", text: "WO-2403 已创建 · ESC-302 电芯救援（待派单）", cabId: "ESC-302" },
      { id: 2, ts: "08:20", level: "info", text: "WO-2402 已派单 → 王工 · ESC-201 重连联网", cabId: "ESC-201" },
      { id: 1, ts: "08:12", level: "info", text: "WO-2401 已派单 → 王工 · ESC-102 电芯救援", cabId: "ESC-102" },
    ],
    toasts: [],
    listings: {},
    extraLogs: {},
    selectedCab: "ESC-202",
    activeOrderId: null,
    engineer: "王工",
    seq: 10,
  };
}

function withEvent(s: State, level: Tone, text: string, cabId?: string): State {
  const seq = s.seq + 1;
  return { ...s, seq, events: [{ id: seq, ts: nowHM(), level, text, cabId }, ...s.events].slice(0, 40) };
}
function withToast(s: State, target: "pc" | "mobile", tone: Tone, text: string): State {
  const seq = s.seq + 1;
  return { ...s, seq, toasts: [...s.toasts, { id: seq, target, tone, text }].slice(-3) };
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "params": {
      const params = { ...s.params, ...a.patch };
      const orders = s.orders.map((o) => {
        if (o.status === "done") return o;
        const c = s.cabinets.find((x) => x.id === o.cabinetId)!;
        return { ...o, gain: orderGain(c, o.type, o.cellIds, params) };
      });
      return { ...s, params, orders };
    }
    case "plan":
      return { ...s, planId: a.planId ?? s.planId, scope: a.scope ?? s.scope };
    case "select":
      return { ...s, selectedCab: a.id };
    case "setActive":
      return { ...s, activeOrderId: a.id };
    case "createOrder": {
      const dup = s.orders.find((o) => o.cabinetId === a.cabinetId && o.type === a.orderType && o.status !== "done");
      if (dup) return withToast(s, "pc", "info", `${a.cabinetId} 已有进行中的同类工单 ${dup.id}`);
      const c = s.cabinets.find((x) => x.id === a.cabinetId)!;
      const m = metrics(c, s.params);
      const id = `WO-${2404 + s.orders.filter((o) => Number(o.id.slice(3)) >= 2404).length}`;
      const order: Order = {
        id,
        cabinetId: a.cabinetId,
        type: a.orderType,
        cellIds: a.cellIds,
        status: "pending",
        created: nowHM(),
        priority: m.health === "critical" ? "P0" : m.health === "warning" ? "P1" : "P2",
        gain: orderGain(c, a.orderType, a.cellIds, s.params),
        note: a.note,
      };
      let n = { ...s, orders: [order, ...s.orders] };
      n = withEvent(n, "info", `${id} 已创建 · ${a.cabinetId} ${a.orderType === "rescue" ? `电芯救援 ${a.cellIds.length} 颗` : a.orderType === "reconnect" ? "重连联网" : "隐患复检"}（待派单）`, a.cabinetId);
      return withToast(n, "pc", "ok", `${id} 已生成，去「工单调度」派单`);
    }
    case "assign": {
      const o = s.orders.find((x) => x.id === a.id);
      if (!o) return s;
      let n: State = { ...s, orders: s.orders.map((x) => (x.id === a.id ? { ...x, status: "dispatched", engineer: a.engineer } : x)) };
      n = withEvent(n, "info", `${o.id} 已派单 → ${a.engineer} · ${o.cabinetId}`, o.cabinetId);
      n = withToast(n, "pc", "ok", `已派单给 ${a.engineer}`);
      if (a.engineer === s.engineer) n = withToast(n, "mobile", "warn", `新工单 ${o.id} · ${o.cabinetId} ${o.priority}`);
      return n;
    }
    case "start":
      return { ...s, activeOrderId: a.id, orders: s.orders.map((x) => (x.id === a.id && x.status === "dispatched" ? { ...x, status: "in_progress" } : x)) };
    case "completeRescue": {
      const o = s.orders.find((x) => x.id === a.id);
      if (!o) return s;
      const cab = s.cabinets.find((c) => c.id === o.cabinetId)!;
      const afterMap = new Map(a.per.map((x) => [x.id, x.after]));
      const targetIds = a.per.map((x) => x.id);
      const rest = cab.cells.filter((x) => !targetIds.includes(x.id));
      const hMean = avg(rest.map((x) => x.soh));
      const hV = avg(rest.map((x) => x.v));
      const oldMin = Math.min(...cab.cells.map((x) => x.soh));
      const logs: LogItem[] = [];
      const cells = cab.cells.map((x) => {
        const after = afterMap.get(x.id);
        if (after === undefined) return x;
        const r = clamp((after - x.soh) / Math.max(0.001, hMean - x.soh), 0, 1);
        logs.push({ t: "刚刚", text: `Re-Pulse 修复 #${String(x.id).padStart(2, "0")} SOH ${fmtPct(x.soh)} → ${fmtPct(after)}`, kind: "repair" });
        return { ...x, soh: Math.max(x.soh, after), v: hV + (x.v - hV) * (1 - r), t: Math.max(x.t - 1.4, 30), repairs: x.repairs + 1 };
      });
      const newMin = Math.min(...cells.map((x) => x.soh));
      const gain = Math.max(0, cab.kwh * (newMin - oldMin) * monthK(s.params));
      const cabinets = s.cabinets.map((c) => (c.id === cab.id ? { ...c, cells } : c));
      let n: State = {
        ...s,
        cabinets,
        activeOrderId: null,
        orders: s.orders.map((x) => (x.id === o.id ? { ...x, status: "done", gain, doneAt: `今天 ${nowHM()}` } : x)),
        extraLogs: { ...s.extraLogs, [cab.id]: [...(s.extraLogs[cab.id] ?? []), ...logs] },
      };
      n = withEvent(n, "ok", `${o.id} 完工 · ${cab.id} 修复 ${a.per.length} 颗，月增收益 +${fmtY(gain)}`, cab.id);
      return withToast(n, "pc", "ok", `${cab.id} 现场完工：月增收益 +${fmtY(gain)}，电池护照已更新`);
    }
    case "completeReconnect": {
      const o = s.orders.find((x) => x.id === a.id);
      if (!o) return s;
      const cabinets = s.cabinets.map((c) =>
        c.id === o.cabinetId ? { ...c, bridge: { ...c.bridge, online: true, offlineHours: 0, fault: undefined, rssi: -71 } } : c
      );
      let n: State = {
        ...s,
        cabinets,
        activeOrderId: null,
        orders: s.orders.map((x) => (x.id === o.id ? { ...x, status: "done", doneAt: `今天 ${nowHM()}` } : x)),
        extraLogs: { ...s.extraLogs, [o.cabinetId]: [...(s.extraLogs[o.cabinetId] ?? []), { t: "刚刚", text: "Re-Bridge 恢复联网 · 缓存数据补传完成", kind: "info" }] },
      };
      n = withEvent(n, "ok", `${o.id} 完工 · ${o.cabinetId} Re-Bridge 已重新上线`, o.cabinetId);
      return withToast(n, "pc", "ok", `${o.cabinetId} 已重新上线，避免月损失 ${fmtY(o.gain)}`);
    }
    case "completeInspect": {
      const o = s.orders.find((x) => x.id === a.id);
      if (!o) return s;
      const cabinets = s.cabinets.map((c) =>
        c.id === o.cabinetId ? { ...c, inspected: true, cells: c.cells.map((x) => (a.replaceCells.includes(x.id) ? { ...x, flag: "replace" as const } : x)) } : c
      );
      let n: State = {
        ...s,
        cabinets,
        activeOrderId: null,
        orders: s.orders.map((x) => (x.id === o.id ? { ...x, status: "done", doneAt: `今天 ${nowHM()}` } : x)),
      };
      n = withEvent(n, "ok", `${o.id} 复检完成 · ${o.cabinetId} ${a.replaceCells.length ? `标记更换 ${a.replaceCells.length} 颗` : "无异常"}`, o.cabinetId);
      return withToast(n, "pc", "ok", `${o.cabinetId} 复检已闭环，护照安全记录已更新`);
    }
    case "emergency": {
      const cabinets = s.cabinets.map((c) =>
        c.id === a.cabinetId ? { ...c, cells: c.cells.map((x) => (x.id === a.cellId ? { ...x, flag: "replace" as const, t: Math.max(x.t, a.temp) } : x)) } : c
      );
      const id = `WO-${2404 + s.orders.filter((o) => Number(o.id.slice(3)) >= 2404).length}`;
      const order: Order = {
        id,
        cabinetId: a.cabinetId,
        type: "inspect",
        cellIds: [a.cellId],
        status: "pending",
        created: nowHM(),
        priority: "P0",
        gain: 0,
        note: `现场急停：电芯 #${a.cellId} 温度 ${a.temp.toFixed(1)}°C，需复检并判定更换`,
      };
      let n: State = { ...s, cabinets, orders: [order, ...s.orders] };
      n = withEvent(n, "crit", `急停触发 · ${a.cabinetId} 电芯 #${a.cellId} ${a.temp.toFixed(1)}°C，已自动创建 ${id} 复检工单`, a.cabinetId);
      return withToast(n, "pc", "crit", `${a.cabinetId} 现场急停！电芯 #${a.cellId} ${a.temp.toFixed(1)}°C，已创建 P0 复检工单`);
    }
    case "list": {
      let n: State = { ...s, listings: { ...s.listings, [a.passportId]: a.price } };
      n = withEvent(n, "ok", `电池护照 ${a.passportId} 已挂牌 · 预估 ${fmtY(a.price)}`);
      return withToast(n, "pc", "ok", `${a.passportId} 已进入残值资产池（${fmtY(a.price)}）`);
    }
    case "toast":
      return withToast(s, a.target, a.tone, a.text);
    case "dismiss":
      return { ...s, toasts: s.toasts.filter((t) => t.id !== a.id) };
    case "reset":
      return initial();
    default:
      return s;
  }
}

interface Ctx {
  state: State;
  dispatch: Dispatch<Action>;
  mets: Record<string, Metrics>;
  passports: Passport[];
  fleet: ReturnType<typeof computeFleet>;
}

function computeFleet(s: State, mets: Record<string, Metrics>) {
  const list = s.cabinets.map((c) => ({ c, m: mets[c.id] }));
  const online = list.filter((x) => x.c.bridge.online).length;
  const count = (d: string) => list.filter((x) => x.m.display === d).length;
  const barrelLoss = list.reduce((a, x) => a + x.m.barrelLoss, 0);
  const offlineLoss = list.reduce((a, x) => a + x.m.offlineLoss, 0);
  const recovered = s.orders.filter((o) => o.status === "done").reduce((a, o) => a + o.gain, 0);
  const potential = list.reduce((a, x) => {
    const ids = suggestRepairIds(x.c);
    return a + (ids.length ? simulateRepair(x.c, ids, s.params).gain : 0);
  }, 0);
  const kwh = list.reduce((a, x) => a + x.c.kwh, 0);
  const usable = list.reduce((a, x) => a + x.m.usableKwh, 0);
  const potentialKwh = list.reduce((a, x) => a + x.m.potentialKwh, 0);
  return {
    total: list.length,
    online,
    offline: list.length - online,
    healthy: count("healthy"),
    warning: count("warning"),
    critical: count("critical"),
    barrelLoss,
    offlineLoss,
    loss: barrelLoss + offlineLoss,
    recovered,
    potential,
    kwh,
    usable,
    potentialKwh,
  };
}

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initial);
  const value = useMemo<Ctx>(() => {
    const mets: Record<string, Metrics> = {};
    state.cabinets.forEach((c) => (mets[c.id] = metrics(c, state.params)));
    const passports = [...RETIRED_SEED, ...state.cabinets.map((c) => cabinetPassport(c, state.params, state.extraLogs[c.id]))];
    return { state, dispatch, mets, passports, fleet: computeFleet(state, mets) };
  }, [state]);
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const v = useContext(StoreCtx);
  if (!v) throw new Error("StoreProvider missing");
  return v;
}
