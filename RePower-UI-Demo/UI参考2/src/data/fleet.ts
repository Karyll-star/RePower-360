// ─────────────────────────────────────────────────────────────
// 资产底座：18 台 215 kWh 工商业储能柜（LFP 280Ah · 1P240S · 5×PACK 1P48S）
// 数据由固定种子生成，保证每次打开数值一致、可复现
// ─────────────────────────────────────────────────────────────
export const PACKS = 5;
export const CELLS_PER_PACK = 48;
export const CELL_COUNT = PACKS * CELLS_PER_PACK;
export const CELL_AH = 280;
export const NOMINAL_KWH = 215;
export const PACK_KWH = 43;
export const CELL_KG = 5.4;
export const BASE_SOC = 52;
export const DAY = 86_400_000;
export const HOUR = 3_600_000;
export const APP_ENGINEER = '张工';

export type Tier = 'none' | 'watch' | 'balance' | 'operate';
export type Link = '原厂云' | 'Re-Bridge' | '本地EMS' | '中断';

export interface Cell {
  idx: number;
  soc: number; // %
  soh: number; // 0..1
  t: number; // °C
  r: number; // mΩ
}

export interface OfflineInfo {
  since: number;
  reason: string;
  detail: string;
  protocol: string;
}

export interface RescueInfo {
  at: number;
  days: number;
  staleDeltaV: number;
  reason: string;
}

export interface Cabinet {
  id: string;
  site: string;
  city: string;
  province: string;
  oem: string;
  oemStatus: '在服' | '停服' | '破产重整';
  commissioned: string;
  cooling: '液冷' | '风冷';
  spread: number; // 峰谷价差 ¥/kWh
  cycles: number; // 日循环次数
  distance: number; // km（最近工程师）
  online: boolean;
  link: Link;
  offline?: OfflineInfo;
  rescued?: RescueInfo;
  cells: Cell[];
  hidden?: Cell[]; // 失联期间的真实状态（Re-Bridge 接入后才会被看见）
  trend: (number | null)[]; // 近 30 天末端压差 mV
  tier: Tier;
  balancedAt?: number;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gauss(r: () => number) {
  let u = 0;
  let v = 0;
  while (u === 0) u = r();
  while (v === 0) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function cellLabel(idx: number) {
  return `P${Math.floor(idx / CELLS_PER_PACK) + 1}-${String((idx % CELLS_PER_PACK) + 1).padStart(2, '0')}`;
}

export function cellIdx(label: string) {
  const m = /P(\d)-(\d+)/.exec(label);
  return m ? (Number(m[1]) - 1) * CELLS_PER_PACK + Number(m[2]) - 1 : 0;
}

/** 物理位置：每个 PACK 开盖后 4 排 × 12 列 */
export function cellPos(idx: number) {
  const pos = idx % CELLS_PER_PACK;
  return {
    pack: Math.floor(idx / CELLS_PER_PACK) + 1,
    row: Math.floor(pos / 12) + 1,
    col: (pos % 12) + 1,
    pos: pos + 1,
  };
}

interface Weak {
  cell: string;
  soc?: number; // 相对基准 SOC 的偏移 %
  soh?: number;
  t?: number; // 温升 °C
}

interface SiteDef {
  site: string;
  city: string;
  province: string;
  oem: string;
  oemStatus: Cabinet['oemStatus'];
  commissioned: string;
  cooling: Cabinet['cooling'];
  spread: number;
  cycles: number;
  distance: number;
}

interface Spec {
  id: string;
  s: SiteDef;
  meanSoh: number;
  sohSd?: number;
  socSd?: number;
  tBase: number;
  weak: Weak[];
  tier: Tier;
  link?: Link;
  offline?: { days: number; hours: number; reason: string; detail: string; protocol: string; weak: Weak[]; tBase?: number };
}

const S: Record<string, SiteDef> = {
  SZ: { site: '精密模具厂', city: '苏州工业园区', province: '江苏', oem: '华储能科', oemStatus: '在服', commissioned: '2022-08', cooling: '液冷', spread: 0.74, cycles: 1.6, distance: 8.8 },
  WX: { site: '半导体封测厂', city: '无锡新吴区', province: '江苏', oem: '岳峰电气', oemStatus: '在服', commissioned: '2023-03', cooling: '液冷', spread: 0.74, cycles: 1.6, distance: 15.1 },
  NB: { site: '注塑产业园', city: '宁波北仑区', province: '浙江', oem: '启明储能', oemStatus: '破产重整', commissioned: '2021-11', cooling: '风冷', spread: 0.86, cycles: 2, distance: 6.2 },
  DG: { site: '电子组装厂', city: '东莞松山湖', province: '广东', oem: '储联科技', oemStatus: '在服', commissioned: '2022-12', cooling: '风冷', spread: 0.92, cycles: 2, distance: 9.6 },
  FS: { site: '家电零部件厂', city: '佛山顺德区', province: '广东', oem: '联创储能', oemStatus: '在服', commissioned: '2023-06', cooling: '液冷', spread: 0.92, cycles: 2, distance: 18.3 },
  JX: { site: '纺织印染厂', city: '嘉兴秀洲区', province: '浙江', oem: '启明储能', oemStatus: '破产重整', commissioned: '2021-09', cooling: '风冷', spread: 0.86, cycles: 2, distance: 12.4 },
  HF: { site: '汽车零部件厂', city: '合肥经开区', province: '安徽', oem: '华储能科', oemStatus: '在服', commissioned: '2021-03', cooling: '风冷', spread: 0.66, cycles: 1.2, distance: 11.7 },
};

const SPECS: Spec[] = [
  { id: 'SZ-01', s: S.SZ, meanSoh: 0.962, tBase: 26.5, tier: 'watch', weak: [{ cell: 'P2-14', soc: -1.0 }] },
  { id: 'SZ-02', s: S.SZ, meanSoh: 0.948, tBase: 27, tier: 'none', weak: [{ cell: 'P4-21', soc: -2.5 }, { cell: 'P1-36', soc: -1.7, soh: 0.918 }] },
  {
    id: 'SZ-03', s: S.SZ, meanSoh: 0.926, sohSd: 0.007, tBase: 27.5, tier: 'none',
    weak: [{ cell: 'P2-33', soc: -6.2, soh: 0.892 }, { cell: 'P4-08', soc: -3.8 }, { cell: 'P4-09', soc: -2.6 }, { cell: 'P2-34', soc: -2.2 }, { cell: 'P1-12', soc: -1.8 }],
  },
  { id: 'WX-01', s: S.WX, meanSoh: 0.971, tBase: 26, tier: 'watch', weak: [{ cell: 'P5-02', soc: -0.9 }] },
  { id: 'WX-02', s: S.WX, meanSoh: 0.968, tBase: 26.2, tier: 'watch', weak: [] },
  { id: 'NB-01', s: S.NB, meanSoh: 0.941, tBase: 28.5, tier: 'balance', link: 'Re-Bridge', weak: [{ cell: 'P5-44', soc: -2.6 }, { cell: 'P5-45', soc: -1.8 }] },
  {
    id: 'NB-02', s: S.NB, meanSoh: 0.935, tBase: 29, tier: 'watch', link: 'Re-Bridge',
    weak: [{ cell: 'P3-17', soc: -6.8, soh: 0.905 }, { cell: 'P3-18', soc: -4.2 }, { cell: 'P5-40', soc: -3.6, soh: 0.915 }, { cell: 'P1-05', soc: -3.0 }],
  },
  {
    id: 'NB-03', s: S.NB, meanSoh: 0.938, tBase: 28.8, tier: 'none', weak: [{ cell: 'P2-11', soc: -2.6 }],
    offline: {
      days: 23, hours: 4, reason: '原厂云平台停服',
      detail: '启明储能进入破产重整，云平台与物联卡续费同步停止；BMS 为私有 CAN 协议，园区 EMS 无法解析。',
      protocol: '启明 BMS v2.3 · 私有 CAN 250 kbps',
      weak: [{ cell: 'P2-11', soc: -6.4, soh: 0.893 }, { cell: 'P2-12', soc: -3.6 }, { cell: 'P4-30', soc: -2.4 }],
    },
  },
  { id: 'NB-04', s: S.NB, meanSoh: 0.944, tBase: 28.6, tier: 'none', link: 'Re-Bridge', weak: [{ cell: 'P1-20', soc: -2.2 }, { cell: 'P3-03', t: 9.5 }] },
  {
    id: 'DG-01', s: S.DG, meanSoh: 0.952, tBase: 30, tier: 'none', weak: [{ cell: 'P4-22', soc: -1.2 }],
    offline: {
      days: 9, hours: 11, reason: '4G 物联卡欠费停机',
      detail: '原厂代缴的物联卡到期未续，柜体只能按本地旧峰谷时段表运行；分时电价调整后已无法远程更新策略。',
      protocol: '储联 BMS · Modbus-RTU 9600',
      tBase: 32.5,
      weak: [{ cell: 'P4-22', soc: -1.6, t: 12.5 }, { cell: 'P4-23', t: 9 }, { cell: 'P4-21', t: 8.2 }, { cell: 'P4-34', t: 6.5 }],
    },
  },
  { id: 'DG-02', s: S.DG, meanSoh: 0.958, tBase: 30.2, tier: 'watch', weak: [{ cell: 'P3-30', soc: -1.1 }] },
  { id: 'DG-03', s: S.DG, meanSoh: 0.947, tBase: 30.5, tier: 'balance', weak: [{ cell: 'P2-07', soc: -2.3 }, { cell: 'P3-41', soc: -1.5, soh: 0.925 }] },
  { id: 'FS-01', s: S.FS, meanSoh: 0.973, tBase: 27, tier: 'watch', weak: [] },
  { id: 'FS-02', s: S.FS, meanSoh: 0.955, tBase: 27.4, tier: 'none', weak: [{ cell: 'P5-12', soc: -2.8 }, { cell: 'P5-13', soc: -1.4 }] },
  {
    id: 'JX-01', s: S.JX, meanSoh: 0.921, tBase: 28, tier: 'none', weak: [{ cell: 'P1-30', soc: -2.0 }],
    offline: {
      days: 39, hours: 7, reason: 'EMS 网关固件崩溃',
      detail: '网关升级中断后反复重启，原厂已无人维护固件；BMS 数据完全不可见，峰谷策略处于失效状态。',
      protocol: '启明 BMS v2.1 · 私有 CAN 250 kbps',
      weak: [{ cell: 'P1-30', soc: -4.8, soh: 0.896 }, { cell: 'P1-31', soc: -2.8 }],
    },
  },
  { id: 'JX-02', s: S.JX, meanSoh: 0.905, sohSd: 0.008, tBase: 28.3, tier: 'balance', link: 'Re-Bridge', weak: [{ cell: 'P5-19', soc: -2.4, soh: 0.862 }] },
  { id: 'HF-01', s: S.HF, meanSoh: 0.884, sohSd: 0.009, tBase: 27.2, tier: 'none', weak: [{ cell: 'P2-26', soc: -2.0, soh: 0.816 }, { cell: 'P2-27', soh: 0.835 }] },
  { id: 'HF-02', s: S.HF, meanSoh: 0.931, tBase: 27, tier: 'watch', weak: [{ cell: 'P4-15', soc: -1.2 }] },
];

function genCells(sp: Spec, seed: number, weak: Weak[], tBase: number): Cell[] {
  const r = mulberry32(seed);
  const sohSd = sp.sohSd ?? 0.006;
  const socSd = sp.socSd ?? 0.3;
  const air = sp.s.cooling === '风冷';
  const cells: Cell[] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    const pack = Math.floor(i / CELLS_PER_PACK);
    const soh = clamp(sp.meanSoh + gauss(r) * sohSd, 0.6, 0.995);
    cells.push({
      idx: i,
      soc: BASE_SOC + gauss(r) * socSd,
      soh,
      t: tBase + (air ? pack * 0.6 : 0) + gauss(r) * (air ? 0.7 : 0.4),
      r: 0.21 + Math.abs(gauss(r)) * 0.012 + (1 - soh) * 0.9,
    });
  }
  for (const w of weak) {
    const c = cells[cellIdx(w.cell)];
    if (w.soc !== undefined) c.soc = BASE_SOC + w.soc;
    if (w.soh !== undefined) {
      c.soh = w.soh;
      c.r = 0.21 + (1 - w.soh) * 1.1;
    }
    if (w.t !== undefined) c.t += w.t;
  }
  return cells;
}

export function buildFleet(now: number): Cabinet[] {
  return SPECS.map((sp, i) => {
    const seed = 1000 + i * 7919;
    const { site, city, province, oem, oemStatus, commissioned, cooling, spread, cycles, distance } = sp.s;
    const cab: Cabinet = {
      id: sp.id, site, city, province, oem, oemStatus, commissioned, cooling, spread, cycles, distance,
      online: !sp.offline,
      link: sp.offline ? '中断' : sp.link ?? '原厂云',
      cells: genCells(sp, seed, sp.weak, sp.tBase),
      trend: [],
      tier: sp.tier,
    };
    if (sp.offline) {
      const o = sp.offline;
      cab.offline = { since: now - o.days * DAY - o.hours * HOUR, reason: o.reason, detail: o.detail, protocol: o.protocol };
      cab.hidden = genCells(sp, seed, o.weak, o.tBase ?? sp.tBase);
    }
    return cab;
  });
}

// ───────────── 工程师 ─────────────
export interface Engineer {
  id: string;
  name: string;
  level: string;
  cert: string;
  base: string;
}
export const ENGINEERS: Engineer[] = [
  { id: '张工', name: '张伟', level: 'L3', cert: '高压电工证 · 储能运维 L3', base: '宁波' },
  { id: '李工', name: '李娜', level: 'L2', cert: '储能运维 L2', base: '苏州' },
  { id: '王工', name: '王磊', level: 'L2', cert: '储能运维 L2', base: '东莞' },
  { id: '陈工', name: '陈晨', level: 'L1', cert: '储能运维 L1', base: '合肥' },
];

// ───────────── 电池护照（退役资产池） ─────────────
export interface PassportEvent {
  date: string;
  text: string;
  tone: 'ok' | 'warn' | 'crit' | 'info';
}
export interface PassportModule {
  id: string;
  origin: string;
  cabinetId: string;
  pack: number;
  maker: string;
  batch: string;
  mfg: string;
  commissioned: string;
  retired: string;
  cycles: number;
  throughput: number; // MWh
  soh: number;
  sigma: number; // 单体 SOH 离散度 %
  rMean: number;
  tMax: number;
  thermal: number;
  balances: number;
  carbon: number; // kgCO2e/kWh
  dataScore: number; // 数据完整度
  cellSoh: number[];
  events: PassportEvent[];
}

function genCellSoh(seed: number, soh: number, sigma: number) {
  const r = mulberry32(seed);
  const mean = soh + (sigma / 100) * 1.8;
  const arr = Array.from({ length: CELLS_PER_PACK }, () => clamp(mean + (gauss(r) * sigma) / 100, soh + 0.002, 0.99));
  arr[seed % CELLS_PER_PACK] = soh;
  return arr;
}

export const PASSPORTS: PassportModule[] = [
  {
    id: 'BP-HF01-P2', origin: '合肥经开 · 汽车零部件厂 · HF-01 PACK 2', cabinetId: 'HF-01', pack: 2,
    maker: '锂源动力 · LFP 280Ah 储能型', batch: 'LFP280-2011-B07', mfg: '2020-11', commissioned: '2021-03', retired: '2025-10 · 评估中',
    cycles: 2140, throughput: 81.6, soh: 0.816, sigma: 1.4, rMean: 0.38, tMax: 41.2, thermal: 0, balances: 2, carbon: 68, dataScore: 90,
    cellSoh: genCellSoh(25, 0.816, 1.4),
    events: [
      { date: '2020-11', text: '电芯出厂 · 批次 LFP280-2011-B07 · 出厂容量 283.1 Ah', tone: 'info' },
      { date: '2021-03', text: '投运 · 合肥经开 HF-01 · 1P240S / 215 kWh', tone: 'info' },
      { date: '2023-06', text: '原厂云平台升级失败，失联 41 天', tone: 'warn' },
      { date: '2023-07', text: 'Re-Bridge 旁路接入，恢复在线 · 补录 BMS 缓存', tone: 'ok' },
      { date: '2024-03', text: 'Re-Pulse 均衡 · P2-26 注入 11.8 Ah', tone: 'ok' },
      { date: '2025-01', text: 'Re-Pulse 均衡 · P2-26 / P2-27 注入 14.2 Ah', tone: 'ok' },
      { date: '2025-10', text: '模组 SOH 81.6%（短板 P2-26）→ 触发退役评估', tone: 'warn' },
    ],
  },
  {
    id: 'BP-SZ03-P2', origin: '苏州工业园区 · 精密模具厂 · SZ-03 原 PACK 2（更换下架）', cabinetId: 'SZ-03', pack: 2,
    maker: '锂源动力 · LFP 280Ah 储能型', batch: 'LFP280-2203-A11', mfg: '2022-03', commissioned: '2022-08', retired: '2025-09',
    cycles: 1890, throughput: 70.4, soh: 0.769, sigma: 2.6, rMean: 0.46, tMax: 44.6, thermal: 0, balances: 0, carbon: 71, dataScore: 70,
    cellSoh: genCellSoh(31, 0.769, 2.6),
    events: [
      { date: '2022-03', text: '电芯出厂 · 批次 LFP280-2203-A11', tone: 'info' },
      { date: '2022-08', text: '投运 · 苏州 SZ-03', tone: 'info' },
      { date: '2024-05', text: '末端压差持续 > 100 mV，仅有 BMS 被动均衡', tone: 'warn' },
      { date: '2025-02', text: '单体 P2-33 多次触发欠压保护，柜体降额运行', tone: 'crit' },
      { date: '2025-09', text: '整包更换下架 · 入库待评估（无主动均衡记录）', tone: 'warn' },
    ],
  },
  {
    id: 'BP-JX02-P5', origin: '嘉兴秀洲 · 纺织印染厂 · JX-02 原 PACK 5（更换下架）', cabinetId: 'JX-02', pack: 5,
    maker: '恒拓电芯 · LFP 280Ah', batch: 'HT280-2104-C02', mfg: '2021-04', commissioned: '2021-09', retired: '2025-06',
    cycles: 2960, throughput: 108.9, soh: 0.682, sigma: 3.9, rMean: 0.58, tMax: 52.4, thermal: 1, balances: 1, carbon: 74, dataScore: 80,
    cellSoh: genCellSoh(19, 0.682, 3.9),
    events: [
      { date: '2021-04', text: '电芯出厂 · 批次 HT280-2104-C02', tone: 'info' },
      { date: '2021-09', text: '投运 · 嘉兴 JX-02', tone: 'info' },
      { date: '2024-07', text: '风扇故障导致 PACK 5 过温 52.4 °C（热事件 1 次）', tone: 'crit' },
      { date: '2024-08', text: 'Re-Pulse 均衡 · P5-19 注入 9.6 Ah', tone: 'ok' },
      { date: '2025-06', text: 'SOH 68.2% < 70%，整包更换下架', tone: 'warn' },
    ],
  },
];
