import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';
import { APP_ENGINEER, DAY, HOUR, buildFleet, gauss, mulberry32, type Cabinet, type Tier } from '../data/fleet';
import { balanceCells, computeStats, planTotals, weakList, yuan, type Stats, type Tone, type WeakCell } from '../data/model';

export type OrderKind = 'balance' | 'rescue' | 'inspect' | 'retire';
export type OrderStatus = 'pending' | 'dispatched' | 'accepted' | 'onsite' | 'suspended' | 'review' | 'done';
export type PcPage = 'overview' | 'rescue' | 'diagnose' | 'revenue' | 'orders';
export type MobileTab = 'tasks' | 'ops' | 'passport';
export type Mode = 'pc' | 'mobile' | 'split';
export type Source = 'console' | 'field' | 'system';
export type Target = WeakCell;

export interface Snap {
  deltaV: number;
  lossMonthly: number;
  usableKWh: number;
  socSpread: number;
  tMax: number;
}
export interface OrderLog {
  t: number;
  text: string;
  tone?: Tone;
}
export interface WorkOrder {
  id: string;
  kind: OrderKind;
  cabinetId: string;
  title: string;
  engineer?: string;
  priority: 'P1' | 'P2' | 'P3';
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
  targets: Target[];
  log: OrderLog[];
  source: Source;
  before?: Snap;
  after?: Snap;
  recovered?: number;
  isNew?: boolean;
}
export interface FleetEvent {
  id: number;
  t: number;
  tone: Tone;
  text: string;
  cabinetId?: string;
  from: Source;
}
export interface Toast {
  id: number;
  title: string;
  text: string;
  tone: Tone;
  from: Source;
  action?: 'openApp';
}
export interface Sale {
  moduleId: string;
  buyer: string;
  price: number;
  t: number;
}
export interface Milestones {
  seen: boolean;
  calc: boolean;
  dispatched: boolean;
  field: boolean;
  cash: boolean;
}
export interface UI {
  mode: Mode;
  pcPage: PcPage;
  selectedCab: string;
  mobileTab: MobileTab;
  activeOrder?: string;
  passportId: string;
}
export interface State {
  cabinets: Cabinet[];
  orders: WorkOrder[];
  events: FleetEvent[];
  toasts: Toast[];
  sales: Sale[];
  seq: number;
  orderSeq: number;
  recovered: number;
  ui: UI;
  milestones: Milestones;
}

export type Action =
  | { type: 'NAV'; patch: Partial<UI> }
  | { type: 'DISPATCH'; kind: OrderKind; cabinetId: string; title: string; engineer?: string; priority: WorkOrder['priority']; targets: Target[]; source?: Source }
  | { type: 'ASSIGN'; id: string; engineer: string }
  | { type: 'STATUS'; id: string; status: OrderStatus; text: string; tone?: Tone; from: Source; silent?: boolean }
  | { type: 'RESCUE_DONE'; id: string; cabinetId: string }
  | { type: 'BALANCE_DONE'; id: string; cabinetId: string; idxs: number[] }
  | { type: 'APPROVE'; id: string }
  | { type: 'EVENT'; tone: Tone; text: string; cabinetId?: string; from: Source; toast?: string }
  | { type: 'SOLD'; moduleId: string; buyer: string; price: number }
  | { type: 'SEEN'; id: string }
  | { type: 'DISMISS'; id: number }
  | { type: 'SET_TIERS'; tiers: Record<string, Tier> };

export const snapOf = (st: Stats): Snap => ({ deltaV: st.deltaV, lossMonthly: st.lossMonthly, usableKWh: st.usableKWh, socSpread: st.socSpread, tMax: st.tMax });

function addEvent(s: State, e: Omit<FleetEvent, 'id' | 't'>, toast?: { title: string; text?: string; action?: 'openApp' }): State {
  const id = s.seq + 1;
  const events = [{ ...e, id, t: Date.now() }, ...s.events].slice(0, 60);
  const toasts = toast ? [...s.toasts, { id, title: toast.title, text: toast.text ?? e.text, tone: e.tone, from: e.from, action: toast.action }].slice(-4) : s.toasts;
  return { ...s, seq: id, events, toasts };
}

function updOrder(s: State, id: string, fn: (o: WorkOrder) => WorkOrder): State {
  return { ...s, orders: s.orders.map((o) => (o.id === id ? fn(o) : o)) };
}

function genTrend(cab: Cabinet, seed: number, now: number): (number | null)[] {
  const st = computeStats(cab);
  const r = mulberry32(seed);
  const end = st.deltaV;
  const start = end * (0.5 + r() * 0.15);
  const offDays = cab.offline ? Math.min(30, Math.ceil((now - cab.offline.since) / DAY)) : 0;
  const last = 29 - offDays;
  return Array.from({ length: 30 }, (_, i) => {
    if (i > last) return null;
    if (i === last) return end;
    const f = Math.pow(i / 29, 1.6);
    return Math.max(10, Math.round(start + (end - start) * f + gauss(r) * end * 0.03));
  });
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'NAV': {
      const milestones = { ...s.milestones };
      if (a.patch.pcPage === 'diagnose' || a.patch.pcPage === 'revenue') milestones.calc = true;
      return { ...s, ui: { ...s.ui, ...a.patch }, milestones };
    }
    case 'DISPATCH': {
      const now = Date.now();
      const id = `WO-${String(s.orderSeq).padStart(4, '0')}`;
      const cab = s.cabinets.find((c) => c.id === a.cabinetId)!;
      const src = a.source ?? 'console';
      const order: WorkOrder = {
        id,
        kind: a.kind,
        cabinetId: a.cabinetId,
        title: a.title,
        engineer: a.engineer,
        priority: a.priority,
        status: a.engineer ? 'dispatched' : 'pending',
        createdAt: now,
        updatedAt: now,
        targets: a.targets,
        log: [{ t: now, text: a.engineer ? `${src === 'field' ? '现场' : '中台'}创建并派发至 ${a.engineer}` : '中台创建 · 待派单', tone: 'info' }],
        source: src,
        before: snapOf(computeStats(cab)),
        isNew: true,
      };
      const next: State = {
        ...s,
        orders: [order, ...s.orders],
        orderSeq: s.orderSeq + 1,
        milestones: { ...s.milestones, dispatched: s.milestones.dispatched || !!a.engineer },
      };
      return addEvent(
        next,
        { tone: 'info', text: `${id} · ${a.cabinetId} ${a.title} → ${a.engineer ?? '待派单'}`, cabinetId: a.cabinetId, from: src },
        a.engineer
          ? {
              title: `${src === 'field' ? '现场' : '中台'}已派单 · ${id}`,
              text: `${a.cabinetId} ${a.title} → ${a.engineer}${a.engineer === APP_ENGINEER ? ' 的 RE·FIELD App' : ''}`,
              action: a.engineer === APP_ENGINEER && src !== 'field' ? 'openApp' : undefined,
            }
          : undefined,
      );
    }
    case 'ASSIGN': {
      const now = Date.now();
      let next = updOrder(s, a.id, (o) => ({
        ...o,
        engineer: a.engineer,
        status: 'dispatched',
        updatedAt: now,
        isNew: true,
        log: [...o.log, { t: now, text: `中台派发至 ${a.engineer}`, tone: 'info' }],
      }));
      const o = next.orders.find((x) => x.id === a.id)!;
      next = { ...next, milestones: { ...next.milestones, dispatched: true } };
      return addEvent(
        next,
        { tone: 'info', text: `${o.id} · ${o.cabinetId} ${o.title} → ${a.engineer}`, cabinetId: o.cabinetId, from: 'console' },
        {
          title: `中台已派单 · ${o.id}`,
          text: `${o.cabinetId} ${o.title} → ${a.engineer}${a.engineer === APP_ENGINEER ? ' 的 RE·FIELD App' : ''}`,
          action: a.engineer === APP_ENGINEER ? 'openApp' : undefined,
        },
      );
    }
    case 'STATUS': {
      const now = Date.now();
      const next = updOrder(s, a.id, (o) => ({
        ...o,
        status: a.status,
        updatedAt: now,
        isNew: false,
        log: [...o.log, { t: now, text: a.text, tone: a.tone }],
      }));
      const o = next.orders.find((x) => x.id === a.id);
      if (!o) return s;
      return addEvent(
        next,
        { tone: a.tone ?? 'info', text: `${o.id} · ${o.cabinetId} · ${a.text}`, cabinetId: o.cabinetId, from: a.from },
        a.silent ? undefined : { title: `${a.from === 'field' ? '来自 App' : '中台'} · ${o.id}`, text: `${o.cabinetId} ${a.text}` },
      );
    }
    case 'RESCUE_DONE': {
      const now = Date.now();
      const cab = s.cabinets.find((c) => c.id === a.cabinetId);
      if (!cab || cab.online) return s;
      const stale = computeStats(cab);
      const days = cab.offline ? Math.floor((now - cab.offline.since) / DAY) : 0;
      const nc: Cabinet = {
        ...cab,
        online: true,
        link: 'Re-Bridge',
        cells: cab.hidden ?? cab.cells,
        hidden: undefined,
        offline: undefined,
        rescued: { at: now, days, staleDeltaV: stale.deltaV, reason: cab.offline?.reason ?? '' },
      };
      const st = computeStats(nc);
      nc.trend = [...cab.trend.slice(1), st.deltaV];
      let next: State = { ...s, cabinets: s.cabinets.map((c) => (c.id === nc.id ? nc : c)), milestones: { ...s.milestones, field: true } };
      next = updOrder(next, a.id, (o) => ({
        ...o,
        updatedAt: now,
        after: snapOf(st),
        log: [...o.log, { t: now, text: `Re-Bridge 接入成功 · 恢复在线 · 盲区数据回传（ΔV ${stale.deltaV}→${st.deltaV} mV）`, tone: 'ok' }],
      }));
      return addEvent(
        next,
        {
          tone: st.status === 'critical' ? 'crit' : 'ok',
          text: `${nc.id} 通过 Re-Bridge 恢复在线（失联 ${days} 天）· 回传：ΔV ${st.deltaV} mV · 最高 ${st.tMax.toFixed(1)}°C`,
          cabinetId: nc.id,
          from: 'field',
        },
        { title: `App · ${nc.id} 已恢复在线`, text: `失联 ${days} 天的盲区数据已回传：ΔV ${stale.deltaV}→${st.deltaV} mV，最高 ${st.tMax.toFixed(1)}°C` },
      );
    }
    case 'BALANCE_DONE': {
      const now = Date.now();
      const cab = s.cabinets.find((c) => c.id === a.cabinetId)!;
      const before = computeStats(cab);
      const nc: Cabinet = { ...cab, cells: balanceCells(cab.cells, a.idxs), balancedAt: now };
      const after = computeStats(nc);
      nc.trend = [...cab.trend.slice(1), after.deltaV];
      const recovered = Math.max(0, before.lossMonthly - after.lossMonthly);
      let next: State = {
        ...s,
        cabinets: s.cabinets.map((c) => (c.id === nc.id ? nc : c)),
        recovered: s.recovered + recovered,
        milestones: { ...s.milestones, field: true },
      };
      next = updOrder(next, a.id, (o) => ({
        ...o,
        status: 'review',
        updatedAt: now,
        after: snapOf(after),
        recovered,
        log: [...o.log, { t: now, text: `均衡完成 ${a.idxs.length} 颗 · ΔV ${before.deltaV}→${after.deltaV} mV · 提交验收`, tone: 'ok' }],
      }));
      return addEvent(
        next,
        { tone: 'ok', text: `${a.cabinetId} 均衡完成：ΔV ${before.deltaV}→${after.deltaV} mV，每月追回 ${yuan(recovered)}`, cabinetId: a.cabinetId, from: 'field' },
        { title: 'App · 张工提交验收', text: `${a.cabinetId} 末端压差 ${before.deltaV}→${after.deltaV} mV · 每月追回 ${yuan(recovered)}` },
      );
    }
    case 'APPROVE': {
      const now = Date.now();
      let next = updOrder(s, a.id, (o) => ({ ...o, status: 'done', updatedAt: now, log: [...o.log, { t: now, text: '中台验收通过 · 归档', tone: 'ok' }] }));
      const o = next.orders.find((x) => x.id === a.id)!;
      next = { ...next, milestones: { ...next.milestones, cash: true } };
      return addEvent(
        next,
        { tone: 'ok', text: `${o.id} 验收通过${o.recovered ? ` · 每月追回 ${yuan(o.recovered)} 计入资产收益` : ''}`, cabinetId: o.cabinetId, from: 'console' },
        { title: `验收通过 · ${o.id}`, text: o.recovered ? `${o.cabinetId} 每月追回 ${yuan(o.recovered)}，已计入资产收益` : `${o.cabinetId} ${o.title} 已归档` },
      );
    }
    case 'EVENT':
      return addEvent(s, { tone: a.tone, text: a.text, cabinetId: a.cabinetId, from: a.from }, a.toast ? { title: a.toast } : undefined);
    case 'SOLD': {
      const next: State = {
        ...s,
        sales: [...s.sales, { moduleId: a.moduleId, buyer: a.buyer, price: a.price, t: Date.now() }],
        milestones: { ...s.milestones, cash: true },
      };
      return addEvent(
        next,
        { tone: 'ok', text: `电池护照 ${a.moduleId} 挂牌成交 · ${a.buyer} · ${yuan(a.price)}`, from: 'field' },
        { title: '退役模组已变现', text: `${a.moduleId} → ${a.buyer} · ${yuan(a.price)} · 护照随资产转移 · T+3 到账` },
      );
    }
    case 'SEEN':
      return updOrder(s, a.id, (o) => ({ ...o, isNew: false }));
    case 'DISMISS':
      return { ...s, toasts: s.toasts.filter((t) => t.id !== a.id) };
    case 'SET_TIERS':
      return { ...s, cabinets: s.cabinets.map((c) => (a.tiers[c.id] ? { ...c, tier: a.tiers[c.id] } : c)) };
    default:
      return s;
  }
}

export function initState(mode: Mode): State {
  const now = Date.now();
  const cabinets = buildFleet(now);
  cabinets.forEach((c, i) => {
    c.trend = genTrend(c, 77 + i * 13, now);
  });
  const get = (id: string) => cabinets.find((c) => c.id === id)!;
  const st = (id: string) => computeStats(get(id));
  const sz3 = get('SZ-03');
  const szTargets = weakList(sz3.cells, 8).filter((w) => w.dSoc < -0.9).slice(0, 4);
  const mk = (o: Omit<WorkOrder, 'updatedAt' | 'before'> & { updatedAt?: number }): WorkOrder => ({
    ...o,
    updatedAt: o.updatedAt ?? o.log[o.log.length - 1].t,
    before: snapOf(st(o.cabinetId)),
  });
  const orders: WorkOrder[] = [
    mk({
      id: 'WO-0417', kind: 'retire', cabinetId: 'HF-01', title: 'PACK 2 退役评估 · 生成电池护照', engineer: '李工', priority: 'P3', status: 'dispatched',
      createdAt: now - 20 * HOUR, targets: [], source: 'console', log: [{ t: now - 20 * HOUR, text: '中台派发至 李工 · 模组 SOH 81.6%', tone: 'info' }],
    }),
    mk({
      id: 'WO-0416', kind: 'inspect', cabinetId: 'DG-03', title: '季度风道与温感巡检', engineer: '王工', priority: 'P3', status: 'onsite',
      createdAt: now - 5 * HOUR, targets: [], source: 'console',
      log: [{ t: now - 5 * HOUR, text: '中台派发至 王工', tone: 'info' }, { t: now - 1.5 * HOUR, text: '王工到场打卡', tone: 'info' }],
    }),
    mk({
      id: 'WO-0415', kind: 'balance', cabinetId: 'SZ-03', title: `电芯均衡 · ${szTargets[0]?.label ?? 'P2-33'} 等 ${szTargets.length} 颗`, priority: 'P1', status: 'pending',
      createdAt: now - 0.5 * HOUR, targets: szTargets, source: 'system',
      log: [{ t: now - 0.5 * HOUR, text: '系统根据末端压差 ≥ 100 mV 自动生成 · 待派单', tone: 'warn' }],
    }),
    mk({
      id: 'WO-0414', kind: 'inspect', cabinetId: 'NB-04', title: 'P3-03 局部温升排查', engineer: APP_ENGINEER, priority: 'P2', status: 'dispatched',
      createdAt: now - 3 * HOUR, targets: [], source: 'console', log: [{ t: now - 3 * HOUR, text: '中台派发至 张工 · P3-03 温度高于簇均值', tone: 'info' }],
    }),
    mk({
      id: 'WO-0412', kind: 'inspect', cabinetId: 'JX-02', title: '风道与温感巡检', engineer: '李工', priority: 'P3', status: 'done',
      createdAt: now - 26 * HOUR, targets: [], source: 'console',
      log: [
        { t: now - 26 * HOUR, text: '中台派发至 李工', tone: 'info' },
        { t: now - 24 * HOUR, text: '李工到场打卡', tone: 'info' },
        { t: now - 22 * HOUR, text: '巡检完成：风道清灰 · 温感校准 2 处', tone: 'ok' },
        { t: now - 21 * HOUR, text: '中台验收通过 · 归档', tone: 'ok' },
      ],
    }),
  ];

  const nb2 = st('NB-02');
  const nb2w = weakList(get('NB-02').cells, 1)[0];
  const sz3s = st('SZ-03');
  const nb4 = st('NB-04');
  const label = (i: number) => `P${Math.floor(i / 48) + 1}-${String((i % 48) + 1).padStart(2, '0')}`;
  const raw: Omit<FleetEvent, 'id'>[] = [
    { t: now - 6 * 60_000, tone: 'crit', text: `NB-02 · ${nb2w.label} SOC 低于中位 ${Math.abs(nb2w.dSoc).toFixed(1)}%，末端压差 ${nb2.deltaV} mV（阈值 100）`, cabinetId: 'NB-02', from: 'system' },
    { t: now - 31 * 60_000, tone: 'warn', text: `系统生成 WO-0415：SZ-03 电芯均衡（压差 ${sz3s.deltaV} mV）· 待派单`, cabinetId: 'SZ-03', from: 'system' },
    { t: now - 48 * 60_000, tone: 'crit', text: `SZ-03 · 木桶短板 ${label(sz3s.minSohCell)} SOH ${(sz3s.minSoh * 100).toFixed(1)}%，月损失 ${yuan(sz3s.lossMonthly)}`, cabinetId: 'SZ-03', from: 'system' },
    { t: now - 2.2 * HOUR, tone: 'off', text: 'DG-01 · 4G 心跳丢失已 9 天（物联卡欠费停机）', cabinetId: 'DG-01', from: 'system' },
    { t: now - 3.1 * HOUR, tone: 'warn', text: `NB-04 · ${label(nb4.hotCell)} 温度 ${nb4.tMax.toFixed(1)}°C，高于簇均值 ${(nb4.tMax - nb4.tMean).toFixed(1)}°C`, cabinetId: 'NB-04', from: 'system' },
    { t: now - 9 * HOUR, tone: 'off', text: 'JX-01 · EMS 网关无响应 39 天，原厂（启明储能）已停服', cabinetId: 'JX-01', from: 'system' },
    { t: now - 21 * HOUR, tone: 'ok', text: 'WO-0412 · JX-02 风道与温感巡检完成并验收（李工）', cabinetId: 'JX-02', from: 'console' },
  ];
  const events: FleetEvent[] = raw.map((e, i) => ({ ...e, id: i + 1 }));

  return {
    cabinets,
    orders,
    events,
    toasts: [],
    sales: [],
    seq: 100,
    orderSeq: 418,
    recovered: 0,
    ui: { mode, pcPage: 'overview', selectedCab: 'NB-02', mobileTab: 'tasks', passportId: 'BP-HF01-P2' },
    milestones: { seen: true, calc: false, dispatched: false, field: false, cash: false },
  };
}

const Ctx = createContext<{ state: State; dispatch: Dispatch<Action> } | null>(null);

export function StoreProvider({ children, mode }: { children: ReactNode; mode: Mode }) {
  const [state, dispatch] = useReducer(reducer, mode, initState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('StoreProvider missing');
  return v;
}

export function useStats() {
  const { state } = useStore();
  return useMemo(() => {
    const m = new Map<string, Stats>();
    state.cabinets.forEach((c) => m.set(c.id, computeStats(c)));
    return m;
  }, [state.cabinets]);
}

export function useFleet() {
  const { state } = useStore();
  const stats = useStats();
  return useMemo(() => {
    let online = 0, offline = 0, healthy = 0, attention = 0, critical = 0;
    let bucket = 0, recoverable = 0, offlineLoss = 0, arbitrage = 0, sohSum = 0, maxDeltaV = 0, maxT = 0, maxOfflineDays = 0;
    const now = Date.now();
    for (const c of state.cabinets) {
      const st = stats.get(c.id)!;
      arbitrage += st.arbitrageMonthly;
      if (c.online) {
        online++;
        if (st.status === 'healthy') healthy++;
        else if (st.status === 'attention') attention++;
        else critical++;
        bucket += st.lossMonthly;
        recoverable += st.recoverableMonthly;
        sohSum += st.meanSoh;
        maxDeltaV = Math.max(maxDeltaV, st.deltaV);
        maxT = Math.max(maxT, st.tMax);
      } else {
        offline++;
        offlineLoss += st.offlineLossMonthly;
        if (c.offline) maxOfflineDays = Math.max(maxOfflineDays, Math.floor((now - c.offline.since) / DAY));
      }
    }
    const plan = planTotals(state.cabinets, stats, 'mix');
    return {
      total: state.cabinets.length, online, offline, healthy, attention, critical,
      bucket, recoverable, offlineLoss, arbitrage, avgSoh: online ? sohSum / online : 0,
      maxDeltaV, maxT, maxOfflineDays, plan,
    };
  }, [state.cabinets, stats]);
}
