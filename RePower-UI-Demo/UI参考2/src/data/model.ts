// ─────────────────────────────────────────────────────────────
// 后市场经济模型：木桶效应 → 可用容量 → 每月白损 → 订阅回报 → 残值
// 串联电池组：可用 Ah = min(qᵢ) + min(Cᵢ − qᵢ)
//   · SOC 错位损失 = min(C) − 可用   （Re-Pulse 注入均衡可追回）
//   · 容量短板损失 = mean(C) − min(C)（主动均衡补偿 / 更换短板）
// ─────────────────────────────────────────────────────────────
import { CELL_AH, CELL_KG, CELLS_PER_PACK, DAY, NOMINAL_KWH, PACK_KWH, cellLabel, clamp } from './fleet';
import type { Cabinet, Cell, PassportModule } from './fleet';

export type Status = 'healthy' | 'attention' | 'critical' | 'offline';
export type Tone = 'ok' | 'warn' | 'crit' | 'off' | 'info';
export type TierKey = 'watch' | 'balance' | 'operate';

export const KWH_PER_AH = NOMINAL_KWH / CELL_AH;
export const RTE = 0.9; // 往返效率
export const OFFLINE_FACTOR = 0.6; // 失联期间停机或执行过期策略的时间占比
export const RISK_FACTOR = 0.02; // 风险规避期望值（占套利收入）

export function median(xs: number[]) {
  const a = [...xs].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

export interface Stats {
  status: Status;
  score: number;
  meanSoh: number;
  minSoh: number;
  minSohCell: number;
  medSoc: number;
  minSoc: number;
  maxSoc: number;
  minSocCell: number;
  socSpread: number;
  deltaV: number;
  tMax: number;
  tMean: number;
  hotCell: number;
  rMean: number;
  usableKWh: number;
  idealKWh: number;
  minCapKWh: number;
  lossKWh: number;
  lossSocKWh: number;
  lossCapKWh: number;
  monthFactor: number;
  lossMonthly: number;
  lossSocMonthly: number;
  lossCapMonthly: number;
  recoverableMonthly: number;
  arbitrageMonthly: number;
  offlineLossMonthly: number;
}

export function computeStats(cab: Cabinet): Stats {
  const cells = cab.cells;
  let minQ = Infinity;
  let minHead = Infinity;
  let sumC = 0;
  let minC = Infinity;
  let sumSoh = 0;
  let minSoh = Infinity;
  let minSohCell = 0;
  let minSoc = Infinity;
  let maxSoc = -Infinity;
  let minSocCell = 0;
  let tMax = -Infinity;
  let hotCell = 0;
  let sumT = 0;
  let sumR = 0;
  for (const c of cells) {
    const C = c.soh * CELL_AH;
    const q = (c.soc / 100) * C;
    if (q < minQ) minQ = q;
    if (C - q < minHead) minHead = C - q;
    sumC += C;
    if (C < minC) minC = C;
    sumSoh += c.soh;
    if (c.soh < minSoh) {
      minSoh = c.soh;
      minSohCell = c.idx;
    }
    if (c.soc < minSoc) {
      minSoc = c.soc;
      minSocCell = c.idx;
    }
    if (c.soc > maxSoc) maxSoc = c.soc;
    if (c.t > tMax) {
      tMax = c.t;
      hotCell = c.idx;
    }
    sumT += c.t;
    sumR += c.r;
  }
  const n = cells.length;
  const usableKWh = (minQ + minHead) * KWH_PER_AH;
  const idealKWh = (sumC / n) * KWH_PER_AH;
  const minCapKWh = minC * KWH_PER_AH;
  const lossKWh = Math.max(0, idealKWh - usableKWh);
  const lossSocKWh = Math.max(0, minCapKWh - usableKWh);
  const lossCapKWh = Math.max(0, idealKWh - minCapKWh);
  const monthFactor = cab.cycles * 30 * cab.spread;
  const socSpread = maxSoc - minSoc;
  const deltaV = Math.round(8 + socSpread * 18);
  const meanSoh = sumSoh / n;
  const arbitrageMonthly = usableKWh * RTE * monthFactor;
  const status: Status = !cab.online
    ? 'offline'
    : deltaV >= 100 || tMax >= 45 || minSoh < 0.8
      ? 'critical'
      : deltaV >= 60 || tMax >= 38 || minSoh < 0.85
        ? 'attention'
        : 'healthy';
  const score = cab.online
    ? Math.round(
        clamp(
          100 - Math.max(0, deltaV - 30) * 0.42 - Math.max(0, tMax - 33) * 1.8 - Math.max(0, 0.97 - meanSoh) * 140 - Math.max(0, 0.9 - minSoh) * 120,
          5,
          100,
        ),
      )
    : 0;
  return {
    status,
    score,
    meanSoh,
    minSoh,
    minSohCell,
    medSoc: median(cells.map((c) => c.soc)),
    minSoc,
    maxSoc,
    minSocCell,
    socSpread,
    deltaV,
    tMax,
    tMean: sumT / n,
    hotCell,
    rMean: sumR / n,
    usableKWh,
    idealKWh,
    minCapKWh,
    lossKWh,
    lossSocKWh,
    lossCapKWh,
    monthFactor,
    lossMonthly: lossKWh * monthFactor,
    lossSocMonthly: lossSocKWh * monthFactor,
    lossCapMonthly: lossCapKWh * monthFactor,
    recoverableMonthly: (lossSocKWh * 0.9 + lossCapKWh * 0.3) * monthFactor,
    arbitrageMonthly,
    offlineLossMonthly: cab.online ? 0 : arbitrageMonthly * OFFLINE_FACTOR,
  };
}

// ───────────── 注入计划：给哪颗电芯注入多大电流 ─────────────
export interface WeakCell {
  idx: number;
  label: string;
  soc: number;
  soh: number;
  t: number;
  dSoc: number;
  needAh: number;
  current: number;
  minutes: number;
}

export function recommendCurrent(needAh: number, t: number) {
  let a = Math.round(needAh / 1.3); // 目标 1.3 h 完成，≤ 0.04C
  if (t >= 36) a = Math.min(a, 6); // 高温电芯限流
  return Math.max(3, Math.min(10, a));
}

export function planCell(c: Cell, med: number): WeakCell {
  const dSoc = c.soc - med;
  const needAh = Math.max(0, (-dSoc / 100) * c.soh * CELL_AH);
  const current = recommendCurrent(needAh, c.t);
  return { idx: c.idx, label: cellLabel(c.idx), soc: c.soc, soh: c.soh, t: c.t, dSoc, needAh, current, minutes: needAh > 0 ? (needAh / current) * 60 : 0 };
}

export function weakList(cells: Cell[], n = 8): WeakCell[] {
  const med = median(cells.map((c) => c.soc));
  return [...cells].sort((a, b) => a.soc - b.soc).slice(0, n).map((c) => planCell(c, med));
}

export function planFor(cells: Cell[], idxs: number[]): WeakCell[] {
  const med = median(cells.map((c) => c.soc));
  return idxs.map((i) => planCell(cells[i], med)).sort((a, b) => a.dSoc - b.dSoc);
}

export function balanceCells(cells: Cell[], idxs: number[]): Cell[] {
  if (!idxs.length) return cells;
  const med = median(cells.map((c) => c.soc));
  const set = new Set(idxs);
  return cells.map((c) => (set.has(c.idx) ? { ...c, soc: med + ((c.idx * 7919) % 10) / 100 - 0.05 } : c));
}

// ───────────── 订阅方案 ─────────────
export interface TierDef {
  key: TierKey;
  name: string;
  en: string;
  fee: number;
  share: number;
  recSoc: number;
  recCap: number;
  uplift: number;
  sla: string;
  hardware: string;
  fit: string;
  features: string[];
}

export const TIERS: TierDef[] = [
  {
    key: 'watch', name: '守望', en: 'WATCH', fee: 99, share: 0, recSoc: 0.08, recCap: 0, uplift: 0,
    sla: '告警 15 分钟推送', hardware: 'Re-Bridge', fit: '健康柜 · 失联柜',
    features: ['Re-Bridge 旁路接入，永不失联', '7×24 健康监护 · 告警推送', '月度木桶损失报告'],
  },
  {
    key: 'balance', name: '均衡', en: 'BALANCE', fee: 299, share: 0, recSoc: 0.9, recCap: 0.3, uplift: 0,
    sla: '48 h 到场', hardware: 'Re-Bridge + Re-Pulse', fit: '压差 60–100 mV 的关注柜',
    features: ['包含守望全部能力', 'Re-Pulse 季度主动均衡（含上门）', '工单闭环 · 年度容量标定'],
  },
  {
    key: 'operate', name: '托管', en: 'OPERATE', fee: 199, share: 0.2, recSoc: 0.95, recCap: 0.6, uplift: 0.02,
    sla: '可用率 ≥ 95% 保障', hardware: '全套硬件 + 备件池', fit: '告警柜 · 大资产包',
    features: ['包含均衡全部能力 · 短板电芯更换', '峰谷策略托管 · 可用率保障', '电池护照 · 退役撮合变现', '¥199 基础费 + 追回收益 20% 分成 · 3 年合约'],
  },
];

export const tierOf = (k: TierKey) => TIERS.find((t) => t.key === k)!;

export function recommendTier(st: Stats): TierKey {
  if (st.status === 'offline') return 'watch';
  if (st.status === 'critical') return 'operate';
  if (st.status === 'attention') return 'balance';
  return 'watch';
}

export interface TierEval {
  bucketRec: number;
  uplift: number;
  direct: number;
  rescue: number;
  risk: number;
  fee: number;
  recovered: number;
  net: number;
}

export function evalTier(st: Stats, t: TierDef, k = 1): TierEval {
  const online = st.status !== 'offline';
  const bucketRec = online ? (st.lossSocKWh * t.recSoc + st.lossCapKWh * t.recCap) * st.monthFactor * k : 0;
  const uplift = t.uplift * st.arbitrageMonthly * k;
  const direct = bucketRec + uplift;
  const rescue = st.offlineLossMonthly * k;
  const risk = RISK_FACTOR * st.arbitrageMonthly * k;
  const fee = t.fee + t.share * direct;
  const recovered = direct + rescue;
  return { bucketRec, uplift, direct, rescue, risk, fee, recovered, net: recovered + risk - fee };
}

export interface PlanRow extends TierEval {
  cab: Cabinet;
  st: Stats;
  tier: TierDef;
  loss: number;
}

export function planTotals(cabs: Cabinet[], stats: Map<string, Stats>, plan: 'mix' | TierKey, k = 1) {
  let fee = 0, recovered = 0, risk = 0, bucketRec = 0, uplift = 0, rescue = 0, bucket = 0, offline = 0;
  const rows: PlanRow[] = cabs.map((cab) => {
    const st = stats.get(cab.id)!;
    const tier = tierOf(plan === 'mix' ? recommendTier(st) : plan);
    const e = evalTier(st, tier, k);
    const loss = st.status === 'offline' ? st.offlineLossMonthly * k : st.lossMonthly * k;
    fee += e.fee;
    recovered += e.recovered;
    risk += e.risk;
    bucketRec += e.bucketRec;
    uplift += e.uplift;
    rescue += e.rescue;
    if (st.status === 'offline') offline += st.offlineLossMonthly * k;
    else bucket += st.lossMonthly * k;
    return { ...e, cab, st, tier, loss };
  });
  return { rows, fee, recovered, risk, bucketRec, uplift, rescue, bucket, offline, net: recovered + risk - fee, ratio: fee > 0 ? (recovered + risk) / fee : 0 };
}

// ───────────── 36 个月：坏了才修 vs 订阅运营 ─────────────
export function project(p: { bucket: number; bucketRec: number; uplift: number; offline: number; fee: number; nCab: number; growth: number; months?: number }) {
  const months = p.months ?? 36;
  const events = [
    { m: 8, cost: 2300 * p.nCab, label: '单体过放失效 · 换 PACK + 停机' },
    { m: 19, cost: 2800 * p.nCab, label: '热告警停机 · 原厂加急' },
    { m: 31, cost: 3300 * p.nCab, label: '容量质保争议 · 停运' },
  ];
  const reactive: number[] = [];
  const sub: number[] = [];
  let cr = 0;
  let cs = 0;
  for (let m = 1; m <= months; m++) {
    const ev = events.find((e) => e.m === m);
    cr += p.bucket * Math.pow(1 + p.growth, m - 1) + p.offline + (ev ? ev.cost : 0);
    cs += Math.max(0, p.bucket - p.bucketRec) * Math.pow(1 + p.growth * 0.12, m - 1) + (m === 1 ? p.offline * 0.5 : 0) + p.fee - p.uplift;
    reactive.push(cr);
    sub.push(cs);
  }
  const idx = reactive.findIndex((v, i) => sub[i] <= v);
  return { reactive, sub, events, payback: idx < 0 ? null : idx + 1, saving: cr - cs };
}

// ───────────── 残值：退役电池还能卖多少钱 ─────────────
export interface ValuePath {
  key: 'storage' | 'backup' | 'recycle';
  name: string;
  req: string;
  ok: boolean;
  raw: number;
  withPassport: number;
}

export function residual(m: PassportModule, li: number) {
  const usable = PACK_KWH * m.soh;
  const base = 60 + Math.max(0, m.soh - 0.7) * 700; // ¥/kWh
  const cons = m.sigma <= 1.5 ? 1 : m.sigma <= 3 ? 0.88 : 0.72;
  const liF = 0.88 + 0.12 * (li / 8);
  const premium = Math.max(0, (m.dataScore - 50) / 220);
  const storageOk = m.soh >= 0.8 && m.sigma <= 2 && m.thermal === 0;
  const backupOk = m.soh >= 0.7;
  const storage = storageOk ? usable * base * cons * liF : 0;
  const backup = backupOk ? usable * base * 0.72 * cons * liF : 0;
  const mass = CELLS_PER_PACK * CELL_KG;
  const recycle = mass * (li * 10 * 0.074 * 0.9 * 0.62 + 0.7);
  const paths: ValuePath[] = [
    { key: 'storage', name: '工商业储能梯次', req: 'SOH ≥ 80% · σ ≤ 2% · 无热事件', ok: storageOk, raw: storage, withPassport: storage * (1 + premium) },
    { key: 'backup', name: '基站备电 / 低速车', req: 'SOH ≥ 70%', ok: backupOk, raw: backup, withPassport: backup * (1 + premium) },
    { key: 'recycle', name: '拆解再生（湿法回收）', req: '无门槛 · 随碳酸锂价格浮动', ok: true, raw: recycle, withPassport: recycle * 1.03 },
  ];
  const best = paths.filter((p) => p.ok).sort((a, b) => b.withPassport - a.withPassport)[0];
  return { usable, mass, premium, paths, best };
}

// ───────────── 分时电价（两充两放） ─────────────
export interface TouSeg {
  from: number;
  to: number;
  kind: '谷' | '平' | '峰' | '尖';
  act: '充电' | '放电' | '待机';
}
export const TOU: TouSeg[] = [
  { from: 0, to: 8, kind: '谷', act: '充电' },
  { from: 8, to: 11, kind: '峰', act: '放电' },
  { from: 11, to: 13, kind: '谷', act: '充电' },
  { from: 13, to: 15, kind: '平', act: '待机' },
  { from: 15, to: 17, kind: '峰', act: '待机' },
  { from: 17, to: 19, kind: '平', act: '待机' },
  { from: 19, to: 21, kind: '尖', act: '放电' },
  { from: 21, to: 22, kind: '峰', act: '待机' },
  { from: 22, to: 24, kind: '平', act: '待机' },
];
export function touAt(d: Date) {
  const h = d.getHours() + d.getMinutes() / 60;
  return TOU.find((s) => h >= s.from && h < s.to) ?? TOU[0];
}

// ───────────── 格式化 ─────────────
export const yuan = (n: number) => `${n < 0 ? '−' : ''}¥${Math.round(Math.abs(n)).toLocaleString('zh-CN')}`;
export const num = (n: number, d = 0) => n.toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });
export const pct = (f: number, d = 1) => `${(f * 100).toFixed(d)}%`;
export const wan = (n: number) => (Math.abs(n) >= 10000 ? `¥${(n / 10000).toFixed(1)} 万` : yuan(n));

export function ago(t: number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return `${s} 秒前`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} 分钟前`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} 小时前`;
  return `${Math.round(h / 24)} 天前`;
}

const pad = (n: number) => String(n).padStart(2, '0');
export function durParts(ms: number) {
  const d = Math.floor(ms / DAY);
  const h = Math.floor((ms % DAY) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return { d, hms: `${pad(h)}:${pad(m)}:${pad(s)}` };
}
export function fmtDate(t: number) {
  const d = new Date(t);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function fmtClock(t: number) {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
