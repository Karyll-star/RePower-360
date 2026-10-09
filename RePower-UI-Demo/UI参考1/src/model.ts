// Re-Ops 业务模型：PC 中台与移动端共用同一套数据与口径
// 说明：所有数值均为演示用示意数据，估价与收益仅作原理演示，非真实报价。

export type Health = "healthy" | "warning" | "critical";
export type Display = Health | "offline";

export interface Cell {
  id: number; // 1-based 串联位
  soh: number; // 0-1
  v: number; // 满充末端电压 V
  t: number; // °C
  rec: number; // 可修复系数 0-1
  repairs: number;
  flag?: "replace";
}

export interface Bridge {
  online: boolean;
  offlineHours: number;
  rssi: number;
  fw: string;
  carrier: string;
  fault?: "sim" | "antenna" | "power";
}

export interface LogItem {
  t: string;
  text: string;
  kind: "info" | "repair" | "warn" | "market";
}

export interface Cabinet {
  id: string;
  siteId: string;
  kwh: number;
  cells: Cell[];
  bridge: Bridge;
  cycles: number;
  ageMonths: number;
  sn: string;
  inspected: boolean;
}

export interface Params {
  spread: number; // 峰谷价差 ¥/kWh
  cycles: number; // 日循环次数
  eff: number; // 系统效率
  visitCost: number; // 单次上门成本 ¥
}

export const DEFAULT_PARAMS: Params = { spread: 0.78, cycles: 2, eff: 0.9, visitCost: 1500 };

export const OFFLINE_PENALTY = 0.2; // 断网后退化为本地固定策略，损失约 20% 日收益
export const CELL_AH = 280;
export const T_ALLOW = 45; // 允许开始注入的最高电芯温度
export const T_WARN = 48; // 自动降流
export const T_CRIT = 56; // 自动急停

export const SITES = [
  { id: "S1", name: "苏州工业园 · 华芯电子", short: "苏州园区", ambient: 27 },
  { id: "S2", name: "无锡新吴 · 恒达纺织", short: "无锡新吴", ambient: 29 },
  { id: "S3", name: "常州武进 · 远景材料", short: "常州武进", ambient: 28 },
  { id: "S4", name: "宁波北仑 · 海港冷链", short: "宁波北仑", ambient: 25 },
];

export const ENGINEERS = ["王工", "李工", "陈工"];

/* ---------------- 工具 ---------------- */
export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
export const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export const fmtY = (n: number) => (Math.round(n) < 0 ? "-" : "") + "¥" + Math.abs(Math.round(n)).toLocaleString("en-US");
export const fmtPct = (x: number, d = 1) => (x * 100).toFixed(d) + "%";
export const fmtK = (n: number) => (Math.abs(n) >= 10000 ? (n / 10000).toFixed(1) + "万" : Math.round(n).toLocaleString("en-US"));
export const hoursText = (h: number) => (h >= 48 ? `${Math.round(h / 24)} 天` : `${h} 小时`);
export const nowHM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- 种子数据 ---------------- */
interface Profile {
  id: string;
  site: number;
  kwh: number;
  base: number;
  weak: [number, number][];
  hot?: [number, number];
  off?: number;
  fault?: Bridge["fault"];
  cycles: number;
  age: number;
  repaired?: number[];
}

const PROFILES: Profile[] = [
  { id: "ESC-101", site: 0, kwh: 215, base: 0.962, weak: [[7, 0.09]], cycles: 1120, age: 24 },
  { id: "ESC-102", site: 0, kwh: 215, base: 0.948, weak: [[12, 0.15], [13, 0.075], [40, 0.05]], cycles: 1460, age: 31 },
  { id: "ESC-103", site: 0, kwh: 261, base: 0.941, weak: [[22, 0.17], [23, 0.06]], hot: [22, 53.4], cycles: 1610, age: 34 },
  { id: "ESC-201", site: 1, kwh: 215, base: 0.958, weak: [[30, 0.09]], off: 72, fault: "power", cycles: 1290, age: 27 },
  { id: "ESC-202", site: 1, kwh: 261, base: 0.944, weak: [[3, 0.13], [4, 0.08], [19, 0.06]], cycles: 1530, age: 33 },
  { id: "ESC-203", site: 1, kwh: 215, base: 0.967, weak: [], cycles: 980, age: 21 },
  { id: "ESC-301", site: 2, kwh: 372, base: 0.936, weak: [[8, 0.16], [9, 0.09]], off: 19, fault: "sim", cycles: 1680, age: 36 },
  { id: "ESC-302", site: 2, kwh: 261, base: 0.93, weak: [[5, 0.22], [6, 0.12], [30, 0.09]], cycles: 1820, age: 38 },
  { id: "ESC-303", site: 2, kwh: 215, base: 0.965, weak: [], cycles: 940, age: 20 },
  { id: "ESC-401", site: 3, kwh: 261, base: 0.952, weak: [[18, 0.045]], cycles: 1390, age: 29, repaired: [18] },
  { id: "ESC-402", site: 3, kwh: 215, base: 0.94, weak: [[26, 0.11], [27, 0.05]], off: 150, fault: "antenna", cycles: 1510, age: 32 },
  { id: "ESC-403", site: 3, kwh: 372, base: 0.969, weak: [[44, 0.06]], cycles: 1050, age: 22 },
];

function buildCabinet(p: Profile, idx: number): Cabinet {
  const rand = mulberry32(1000 + idx * 77);
  const site = SITES[p.site];
  const cells: Cell[] = Array.from({ length: 48 }, (_, i) => {
    const id = i + 1;
    const def = p.weak.find((w) => w[0] === id)?.[1] ?? 0;
    const soh = clamp(p.base + (rand() - 0.5) * 0.022 - def, 0.55, 0.995);
    const v = 3.462 + def * 0.85 + (rand() - 0.5) * 0.012;
    let t = site.ambient + 7 + (rand() - 0.5) * 2.4 + def * 14;
    if (p.hot && p.hot[0] === id) t = p.hot[1];
    return { id, soh, v, t, rec: def > 0 ? 0.5 + rand() * 0.35 : 0.9, repairs: p.repaired?.includes(id) ? 1 : 0 };
  });
  const online = !p.off;
  return {
    id: p.id,
    siteId: site.id,
    kwh: p.kwh,
    cells,
    cycles: p.cycles,
    ageMonths: p.age,
    sn: `RE${p.kwh}-${24 - Math.floor(p.age / 12)}${String(idx + 11).padStart(2, "0")}${p.id.slice(-3)}`,
    inspected: p.id === "ESC-401" || p.id === "ESC-203",
    bridge: {
      online,
      offlineHours: p.off ?? 0,
      rssi: online ? -Math.round(62 + rand() * 14) : -110,
      fw: "RB-2.4.1",
      carrier: "中国移动 IoT",
      fault: p.fault,
    },
  };
}

export const SEED_CABINETS: Cabinet[] = PROFILES.map(buildCabinet);

/* ---------------- 指标与木桶损失 ---------------- */
export const monthK = (p: Params) => p.cycles * 30 * p.spread * p.eff;

export interface Metrics {
  mean: number;
  min: number;
  dv: number; // mV
  tmax: number;
  tmaxCell: Cell;
  weakest: Cell;
  usableKwh: number;
  potentialKwh: number;
  lostKwh: number;
  barrelLoss: number; // ¥/月
  dailyRev: number;
  offlineLoss: number; // ¥/月
  health: Health;
  display: Display;
}

export function metrics(c: Cabinet, p: Params): Metrics {
  const sohs = c.cells.map((x) => x.soh);
  const mean = avg(sohs);
  const min = Math.min(...sohs);
  const vs = c.cells.map((x) => x.v);
  const dv = (Math.max(...vs) - Math.min(...vs)) * 1000;
  const tmaxCell = c.cells.reduce((a, b) => (b.t > a.t ? b : a));
  const weakest = c.cells.reduce((a, b) => (b.soh < a.soh ? b : a));
  const lostKwh = c.kwh * (mean - min);
  const k = monthK(p);
  const dailyRev = c.kwh * mean * p.cycles * p.spread * p.eff;
  const offlineLoss = c.bridge.online ? 0 : dailyRev * OFFLINE_PENALTY * 30;
  let health: Health = "healthy";
  if (tmaxCell.t >= 52 || min < 0.74) health = "critical";
  else if (dv >= 100 || min < 0.86 || tmaxCell.t >= 45) health = "warning";
  return {
    mean,
    min,
    dv,
    tmax: tmaxCell.t,
    tmaxCell,
    weakest,
    usableKwh: c.kwh * min,
    potentialKwh: c.kwh * mean,
    lostKwh,
    barrelLoss: lostKwh * k,
    dailyRev,
    offlineLoss,
    health,
    display: c.bridge.online ? health : "offline",
  };
}

export interface RepairResult {
  per: { id: number; before: number; after: number; target: number }[];
  oldMin: number;
  newMin: number;
  gain: number; // ¥/月 增量收益
  oldUsable: number;
  newUsable: number;
}

/** 推演：用 Re-Pulse 修复指定电芯后，木桶最短板抬升多少、每月多赚多少 */
export function simulateRepair(c: Cabinet, ids: number[], p: Params): RepairResult {
  const set = new Set(ids);
  const target = avg(c.cells.filter((x) => !set.has(x.id)).map((x) => x.soh));
  const per = c.cells
    .filter((x) => set.has(x.id))
    .map((x) => ({ id: x.id, before: x.soh, target, after: Math.min(0.995, x.soh + Math.max(0, target - x.soh) * x.rec) }));
  const afterMap = new Map(per.map((x) => [x.id, x.after]));
  const newMin = Math.min(...c.cells.map((x) => afterMap.get(x.id) ?? x.soh));
  const oldMin = Math.min(...c.cells.map((x) => x.soh));
  return {
    per,
    oldMin,
    newMin,
    gain: c.kwh * (newMin - oldMin) * monthK(p),
    oldUsable: c.kwh * oldMin,
    newUsable: c.kwh * newMin,
  };
}

export const weakestIds = (c: Cabinet, n: number) =>
  [...c.cells].sort((a, b) => a.soh - b.soh).slice(0, n).map((x) => x.id);

/** 自动建议要修几颗：低于平均 3.5 个点的电芯 */
export function suggestRepairIds(c: Cabinet): number[] {
  const mean = avg(c.cells.map((x) => x.soh));
  const ids = c.cells.filter((x) => x.soh < mean - 0.035 && x.flag !== "replace").sort((a, b) => a.soh - b.soh).map((x) => x.id);
  return ids.slice(0, 8);
}

/* ---------------- Re-Pulse 电流 / 温度 ---------------- */
export const imax = (t: number) => clamp(30 - (t - 30) * 1.25, 0, 30);

export function healthyMean(c: Cabinet, ids: number[] = []) {
  return avg(c.cells.filter((x) => !ids.includes(x.id)).map((x) => x.soh));
}

export function pulsePlan(cell: Cell, target: number) {
  const deficit = Math.max(0, target - cell.soh);
  const blocked = cell.t > T_ALLOW;
  const cap = Math.floor(imax(cell.t));
  const rec = blocked ? 0 : Math.min(Math.round(clamp(6 + deficit * 100 * 0.55, 6, 20)), cap);
  const gainSoh = deficit * cell.rec;
  const ah = gainSoh * CELL_AH * 0.8;
  return { deficit, blocked, cap, rec, gainSoh, ah, after: Math.min(0.995, cell.soh + gainSoh) };
}

export const durationMin = (ah: number, i: number) => (i > 0 ? (ah / i) * 60 : 0);

/* ---------------- 残值与电池护照 ---------------- */
export type Channel = "second" | "lowspeed" | "recycle";
export const CHANNELS: Record<Channel, { name: string; desc: string; minSoh: number }> = {
  second: { name: "梯次储能", desc: "再用于工商业储能，要求 SOH ≥ 70%", minSoh: 0.7 },
  lowspeed: { name: "低速动力/备电", desc: "通信基站、低速车，要求 SOH ≥ 60%", minSoh: 0.6 },
  recycle: { name: "拆解回收", desc: "按材料计价，护照不加价", minSoh: 0 },
};

export interface ValueInput {
  kwh: number;
  soh: number;
  cycles: number;
  chem: "LFP" | "NCM";
  completeness: number;
  channel: Channel;
}

export function valueOf(v: ValueInput) {
  const cf = clamp(1 - v.cycles / 9000, 0.55, 1);
  const s = Math.min(v.soh, 1.05);
  let perKwh = 0;
  let premium = 1;
  let ok = true;
  if (v.channel === "second") {
    ok = v.soh >= 0.7;
    perKwh = 380 * Math.pow(s / 0.85, 2.2);
    premium = 0.82 + 0.28 * v.completeness;
  } else if (v.channel === "lowspeed") {
    ok = v.soh >= 0.6;
    perKwh = 300 * Math.pow(s / 0.8, 2);
    premium = 0.85 + 0.2 * v.completeness;
  } else {
    perKwh = v.chem === "LFP" ? 95 : 380;
  }
  const base = ok ? v.kwh * perKwh * cf : 0;
  return { ok, perKwh, cf, premium, base, value: base * premium };
}

export function bestChannel(v: Omit<ValueInput, "channel">): Channel {
  const order: Channel[] = ["second", "lowspeed", "recycle"];
  return order.reduce((a, b) => (valueOf({ ...v, channel: b }).value > valueOf({ ...v, channel: a }).value ? b : a), "recycle" as Channel);
}

export interface ScoreItem {
  label: string;
  pts: number;
  got: number; // 0-1
  hint: string;
}
export const completenessOf = (items: ScoreItem[]) => items.reduce((a, b) => a + b.pts * b.got, 0) / 100;

export interface Passport {
  id: string;
  kind: "cabinet" | "retired";
  name: string;
  origin: string;
  chem: "LFP" | "NCM";
  kwh: number;
  soh: number; // 木桶口径（用于估价）
  sohMean: number;
  sohMin: number;
  cycles: number;
  dv: number;
  items: ScoreItem[];
  logs: LogItem[];
  cabinetId?: string;
  date: string;
}

export const RETIRED_SEED: Passport[] = [
  {
    id: "PK-2301-A", kind: "retired", name: "退役模组簇 A", origin: "ESC-旧 · 常熟注塑厂", chem: "LFP", kwh: 52,
    soh: 0.812, sohMean: 0.834, sohMin: 0.79, cycles: 3280, dv: 62, date: "2025-11 退役",
    items: [
      { label: "身份与铭牌", pts: 20, got: 1, hint: "已绑定 SN / 出厂批次" },
      { label: "出厂参数 / BOM", pts: 15, got: 1, hint: "电芯型号、成组方式齐全" },
      { label: "连续运行数据", pts: 25, got: 0.8, hint: "BMS 历史覆盖 80%" },
      { label: "Re-Pulse 修复记录", pts: 20, got: 0, hint: "无修复记录" },
      { label: "安全事件闭环", pts: 10, got: 1, hint: "无未闭环事件" },
      { label: "第三方检测报告", pts: 10, got: 0.5, hint: "仅出厂检" },
    ],
    logs: [
      { t: "2021-06", text: "出厂 · 铭牌绑定", kind: "info" },
      { t: "2021-09", text: "投运 · 常熟注塑厂 2 号柜", kind: "info" },
      { t: "2025-11", text: "整柜退役 · 容量测试 SOH 81.2%", kind: "info" },
    ],
  },
  {
    id: "PK-2307-C", kind: "retired", name: "退役模组簇 C", origin: "ESC-旧 · 昆山电镀园", chem: "LFP", kwh: 38,
    soh: 0.684, sohMean: 0.72, sohMin: 0.648, cycles: 4510, dv: 188, date: "2025-09 退役",
    items: [
      { label: "身份与铭牌", pts: 20, got: 1, hint: "铭牌可识别" },
      { label: "出厂参数 / BOM", pts: 15, got: 0.6, hint: "缺成组 BOM" },
      { label: "连续运行数据", pts: 25, got: 0.2, hint: "断网 > 1 年，数据缺口大" },
      { label: "Re-Pulse 修复记录", pts: 20, got: 0, hint: "无修复记录" },
      { label: "安全事件闭环", pts: 10, got: 0.3, hint: "1 次温升告警未闭环" },
      { label: "第三方检测报告", pts: 10, got: 0, hint: "无" },
    ],
    logs: [
      { t: "2020-03", text: "出厂 · 铭牌绑定", kind: "info" },
      { t: "2023-02", text: "Re-Bridge 离线 · 数据中断", kind: "warn" },
      { t: "2025-09", text: "整柜退役 · 无历史曲线", kind: "info" },
    ],
  },
  {
    id: "PK-2412-B", kind: "retired", name: "UPS 备电包 B", origin: "数据机房 · 张江", chem: "NCM", kwh: 24,
    soh: 0.76, sohMean: 0.78, sohMin: 0.74, cycles: 1800, dv: 48, date: "2025-12 退役",
    items: [
      { label: "身份与铭牌", pts: 20, got: 1, hint: "已绑定" },
      { label: "出厂参数 / BOM", pts: 15, got: 1, hint: "齐全" },
      { label: "连续运行数据", pts: 25, got: 0.6, hint: "回传 60%" },
      { label: "Re-Pulse 修复记录", pts: 20, got: 0, hint: "无" },
      { label: "安全事件闭环", pts: 10, got: 1, hint: "无事件" },
      { label: "第三方检测报告", pts: 10, got: 1, hint: "已出具" },
    ],
    logs: [
      { t: "2022-04", text: "出厂 · 铭牌绑定", kind: "info" },
      { t: "2025-12", text: "UPS 更换 · 容量测试 SOH 76%", kind: "info" },
    ],
  },
  {
    id: "PK-2501-A", kind: "retired", name: "已修复模组簇", origin: "ESC-旧 · 嘉兴光伏厂", chem: "LFP", kwh: 86,
    soh: 0.863, sohMean: 0.876, sohMin: 0.85, cycles: 2100, dv: 34, date: "2026-01 退役",
    items: [
      { label: "身份与铭牌", pts: 20, got: 1, hint: "已绑定" },
      { label: "出厂参数 / BOM", pts: 15, got: 1, hint: "齐全" },
      { label: "连续运行数据", pts: 25, got: 1, hint: "Re-Bridge 全程回传" },
      { label: "Re-Pulse 修复记录", pts: 20, got: 1, hint: "2 次均衡救援，已写入" },
      { label: "安全事件闭环", pts: 10, got: 1, hint: "无事件" },
      { label: "第三方检测报告", pts: 10, got: 1, hint: "已出具" },
    ],
    logs: [
      { t: "2022-08", text: "出厂 · 铭牌绑定 · 接入 Re-Bridge", kind: "info" },
      { t: "2024-05", text: "Re-Pulse 修复 #17 SOH 79.4% → 88.0%", kind: "repair" },
      { t: "2025-02", text: "Re-Pulse 修复 #33 SOH 81.1% → 87.6%", kind: "repair" },
      { t: "2026-01", text: "整柜退役 · 容量测试 SOH 86.3%", kind: "info" },
    ],
  },
];

export function cabinetPassport(c: Cabinet, p: Params, extra: LogItem[] = []): Passport {
  const m = metrics(c, p);
  const siteName = SITES.find((s) => s.id === c.siteId)!.name;
  const repairs = c.cells.reduce((a, b) => a + b.repairs, 0);
  const hasHot = c.cells.some((x) => x.t >= 52 || x.flag === "replace");
  const gap = Math.min(1, c.bridge.offlineHours / 240);
  const items: ScoreItem[] = [
    { label: "身份与铭牌", pts: 20, got: 1, hint: `SN ${c.sn}` },
    { label: "出厂参数 / BOM", pts: 15, got: 1, hint: "电芯型号与成组方式齐全" },
    { label: "连续运行数据", pts: 25, got: 1 - gap * 0.9, hint: c.bridge.online ? "Re-Bridge 持续回传" : `离线 ${hoursText(c.bridge.offlineHours)}，出现数据缺口` },
    { label: "Re-Pulse 修复记录", pts: 20, got: repairs > 0 ? 1 : 0, hint: repairs > 0 ? `累计修复 ${repairs} 颗电芯` : "尚无修复记录" },
    { label: "安全事件闭环", pts: 10, got: hasHot ? 0.3 : 1, hint: hasHot ? "存在温度异常，待闭环" : "无未闭环事件" },
    { label: "第三方检测报告", pts: 10, got: c.inspected ? 1 : 0, hint: c.inspected ? "已出具" : "未检测" },
  ];
  const base: LogItem[] = [
    { t: `${2026 - Math.ceil(c.ageMonths / 12)}-${String(((c.ageMonths * 7) % 12) + 1).padStart(2, "0")}`, text: "出厂 · 铭牌绑定 · 接入 Re-Bridge", kind: "info" },
  ];
  if (c.id === "ESC-401") base.push({ t: "2025-10", text: "Re-Pulse 修复 #18 SOH 82.5% → 90.6%", kind: "repair" });
  if (!c.bridge.online) base.push({ t: "近期", text: `Re-Bridge 离线 ${hoursText(c.bridge.offlineHours)} · 数据缺口`, kind: "warn" });
  if (m.tmax >= 52) base.push({ t: "今日", text: `电芯 #${m.tmaxCell.id} 温度 ${m.tmax.toFixed(1)}°C 告警`, kind: "warn" });
  return {
    id: c.id,
    kind: "cabinet",
    name: `${c.id} 在役储能柜`,
    origin: siteName,
    chem: "LFP",
    kwh: c.kwh,
    soh: m.mean * 0.5 + m.min * 0.5,
    sohMean: m.mean,
    sohMin: m.min,
    cycles: c.cycles,
    dv: m.dv,
    items,
    logs: [...base, ...extra],
    cabinetId: c.id,
    date: `${Math.round(c.ageMonths / 12 * 10) / 10} 年在役`,
  };
}

/* ---------------- 工单 ---------------- */
export type OrderType = "rescue" | "reconnect" | "inspect";
export type OrderStatus = "pending" | "dispatched" | "in_progress" | "done";
export interface Order {
  id: string;
  cabinetId: string;
  type: OrderType;
  cellIds: number[];
  status: OrderStatus;
  engineer?: string;
  created: string;
  priority: "P0" | "P1" | "P2";
  gain: number;
  note?: string;
  doneAt?: string;
}

export const TYPE_NAME: Record<OrderType, string> = { rescue: "电芯救援", reconnect: "重连联网", inspect: "隐患复检" };

export function orderGain(c: Cabinet, type: OrderType, ids: number[], p: Params): number {
  if (type === "rescue") return simulateRepair(c, ids, p).gain;
  if (type === "reconnect") return metrics(c, p).dailyRev * OFFLINE_PENALTY * 30;
  return 0;
}

export function seedOrders(p: Params): Order[] {
  const cab = (id: string) => SEED_CABINETS.find((c) => c.id === id)!;
  return [
    { id: "WO-2403", cabinetId: "ESC-302", type: "rescue", cellIds: [5, 6, 30], status: "pending", created: "08:40", priority: "P0", gain: orderGain(cab("ESC-302"), "rescue", [5, 6, 30], p), note: "木桶短板 #05 仅 71%，建议优先" },
    { id: "WO-2401", cabinetId: "ESC-102", type: "rescue", cellIds: [12, 13], status: "dispatched", engineer: "王工", created: "08:12", priority: "P1", gain: orderGain(cab("ESC-102"), "rescue", [12, 13], p), note: "到场后先连 Re-Bridge 再接 Re-Pulse" },
    { id: "WO-2402", cabinetId: "ESC-201", type: "reconnect", cellIds: [], status: "dispatched", engineer: "王工", created: "08:20", priority: "P1", gain: orderGain(cab("ESC-201"), "reconnect", [], p), note: "离线 72 小时，疑似 24V 供电异常" },
    { id: "WO-2398", cabinetId: "ESC-401", type: "rescue", cellIds: [18], status: "done", engineer: "李工", created: "昨天", priority: "P2", gain: 612, doneAt: "昨天 16:40" },
    { id: "WO-2395", cabinetId: "ESC-203", type: "reconnect", cellIds: [], status: "done", engineer: "陈工", created: "前天", priority: "P2", gain: 380, doneAt: "前天 11:05" },
  ];
}

/* ---------------- 告警 ---------------- */
export interface Alert {
  id: string;
  level: "crit" | "warn" | "off";
  cabId: string;
  text: string;
  sub: string;
}

export function deriveAlerts(cabs: Cabinet[], p: Params): Alert[] {
  const out: Alert[] = [];
  for (const c of cabs) {
    const m = metrics(c, p);
    if (!c.bridge.online) out.push({ id: `${c.id}-off`, level: "off", cabId: c.id, text: `Re-Bridge 离线 ${hoursText(c.bridge.offlineHours)}`, sub: faultText(c.bridge.fault) });
    if (m.tmax >= 52) out.push({ id: `${c.id}-t`, level: "crit", cabId: c.id, text: `电芯 #${m.tmaxCell.id} 温度 ${m.tmax.toFixed(1)}°C`, sub: "超过 52°C 红线，禁止注入，建议先复检" });
    else if (m.min < 0.74) out.push({ id: `${c.id}-s`, level: "crit", cabId: c.id, text: `木桶短板 #${m.weakest.id} SOH ${fmtPct(m.min)}`, sub: `平均 ${fmtPct(m.mean)}，月损 ${fmtY(m.barrelLoss)}` });
    else if (m.health === "warning") out.push({ id: `${c.id}-w`, level: "warn", cabId: c.id, text: `压差 ${m.dv.toFixed(0)}mV · 短板 #${m.weakest.id} ${fmtPct(m.min)}`, sub: `月损 ${fmtY(m.barrelLoss)}，建议均衡救援` });
  }
  const rank = { crit: 0, warn: 1, off: 2 } as const;
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

export function faultText(f?: Bridge["fault"]) {
  if (f === "sim") return "疑似 SIM 欠费 / 信号弱";
  if (f === "antenna") return "疑似天线脱落（RSSI 过低）";
  if (f === "power") return "疑似 24V 供电保险熔断";
  return "原因待查";
}

/* ---------------- 订阅 ROI ---------------- */
export interface Plan {
  id: "basic" | "care" | "ops";
  name: string;
  tag: string;
  fee: number;
  rescue: number;
  offline: number;
  truck: number;
  opt: number;
  passport: number;
  features: string[];
}

export const PLANS: Plan[] = [
  { id: "basic", name: "基础监测", tag: "看得见", fee: 80, rescue: 0, offline: 0.5, truck: 35, opt: 0, passport: 0, features: ["Re-Bridge 联网 + 断网告警", "柜级 SOH / 温度 / 压差看板", "月度健康报告"] },
  { id: "care", name: "健康守护", tag: "算得清", fee: 260, rescue: 0.6, offline: 0.75, truck: 90, opt: 0.01, passport: 0.5, features: ["电芯级木桶诊断与损失测算", "每年 2 次 Re-Pulse 均衡救援", "智能派单 + 工程师 App"] },
  { id: "ops", name: "资产运营", tag: "卖得出", fee: 520, rescue: 0.85, offline: 0.92, truck: 140, opt: 0.025, passport: 1, features: ["不限次 Re-Pulse 救援 · 4h 到场 SLA", "电池护照托管 + 残值回购报价", "远程策略优化（峰谷 / 需量）"] },
];

export interface CabEcon {
  id: string;
  recov: number;
  offl: number;
  truck: number;
  opt: number;
  resid: number;
  benefit: number;
  fee: number;
  rank: number;
}

export function planEconomics(cabs: Cabinet[], p: Params, plan: Plan, scope: number) {
  const rows: CabEcon[] = cabs.map((c) => {
    const m = metrics(c, p);
    const ids = suggestRepairIds(c);
    const gain = ids.length ? simulateRepair(c, ids, p).gain : 0;
    const base: Omit<ValueInput, "completeness"> = { kwh: c.kwh, soh: m.mean * 0.5 + m.min * 0.5, cycles: c.cycles, chem: "LFP", channel: "second" };
    const lo = valueOf({ ...base, completeness: 0.45 }).value;
    const hi = valueOf({ ...base, completeness: 0.45 + 0.5 * plan.passport }).value;
    const recov = gain * plan.rescue;
    const offl = m.offlineLoss * plan.offline;
    const truck = plan.truck;
    const opt = m.dailyRev * 30 * plan.opt;
    const resid = Math.max(0, hi - lo) / 48;
    return { id: c.id, recov, offl, truck, opt, resid, benefit: recov + offl + truck + opt + resid, fee: plan.fee, rank: gain + m.offlineLoss };
  });
  const picked = [...rows].sort((a, b) => b.rank - a.rank).slice(0, scope);
  const sum = (k: keyof CabEcon) => picked.reduce((a, b) => a + (b[k] as number), 0);
  const benefit = sum("benefit");
  const fee = plan.fee * picked.length;
  const cumB: number[] = [0];
  const cumF: number[] = [0];
  let payback: number | null = null;
  for (let m = 1; m <= 12; m++) {
    const ramp = Math.min(1, m / 3);
    cumB.push(cumB[m - 1] + benefit * ramp);
    cumF.push(cumF[m - 1] + fee);
    if (payback === null && cumB[m] >= cumF[m]) payback = m;
  }
  return {
    picked,
    benefit,
    fee,
    net: benefit - fee,
    roi: fee ? benefit / fee : 0,
    parts: { recov: sum("recov"), offl: sum("offl"), truck: sum("truck"), opt: sum("opt"), resid: sum("resid") },
    cumB,
    cumF,
    payback,
    net12: cumB[12] - cumF[12],
  };
}
