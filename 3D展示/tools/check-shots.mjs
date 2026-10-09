/* 机位校验：视线遮挡（相机→注视点 vs 柜体 AABB）+ 主体是否出画（NDC 投影）
   用法：node tools/check-shots.mjs
   注意：SHOTS 必须与 js/demo.js 保持一致
*/
const SHOTS = [
  { t0: 0.0, t1: 4.0, f: { th: 0.55, ph: 1.180, r: 3.20, tx: 0.00, ty: 1.05, tz: 0.46, fov: 44 }, t: { th: 0.30, ph: 1.220, r: 2.40, tx: 0.00, ty: 1.05, tz: 0.46, fov: 40 } },
  { t0: 4.0, t1: 8.0, f: { th: 0.30, ph: 1.220, r: 2.40, tx: 0.00, ty: 1.05, tz: 0.46, fov: 40 }, t: { th: 0.30, ph: 1.320, r: 1.95, tx: 2.60, ty: 0.44, tz: 1.50, fov: 34 } },
  { t0: 8.0, t1: 12.4, f: { th: 0.30, ph: 1.320, r: 1.95, tx: 2.60, ty: 0.44, tz: 1.50, fov: 34 }, t: { th: -3.19, ph: 1.050, r: 1.88, tx: 2.60, ty: 0.46, tz: 1.50, fov: 32 } },
  { t0: 12.4, t1: 16.8, eth: 'out', f: { th: -3.19, ph: 1.050, r: 1.88, tx: 2.60, ty: 0.46, tz: 1.50, fov: 32 }, t: { th: -1.00, ph: 1.160, r: 2.45, tx: 0.86, ty: 0.48, tz: 0.62, fov: 40 } },
  { t0: 16.8, t1: 21.6, f: { th: -1.00, ph: 1.160, r: 2.45, tx: 0.86, ty: 0.48, tz: 0.62, fov: 40 }, t: { th: -0.52, ph: 1.185, r: 2.42, tx: 0.05, ty: 1.02, tz: 0.36, fov: 38 } },
  { t0: 21.6, t1: 26.6, f: { th: -0.52, ph: 1.185, r: 2.42, tx: 0.05, ty: 1.02, tz: 0.36, fov: 38 }, t: { th: -0.20, ph: 1.420, r: 0.48, tx: -0.08, ty: 0.93, tz: 0.42, fov: 26 } },
  { t0: 26.6, t1: 32.0, f: { th: -0.20, ph: 1.420, r: 0.48, tx: -0.08, ty: 0.93, tz: 0.42, fov: 26 }, t: { th: 0.07, ph: 1.445, r: 0.84, tx: 0.86, ty: 0.40, tz: 0.60, fov: 28 } },
  { t0: 32.0, t1: 36.0, f: { th: 0.07, ph: 1.445, r: 0.84, tx: 0.86, ty: 0.40, tz: 0.60, fov: 28 }, t: { th: 0.64, ph: 1.215, r: 3.40, tx: 0.45, ty: 0.86, tz: 0.30, fov: 40 } },
  { t0: 36.0, t1: 42.0, f: { th: 0.64, ph: 1.215, r: 3.40, tx: 0.45, ty: 0.86, tz: 0.30, fov: 40 }, t: { th: 0.24, ph: 1.280, r: 1.95, tx: -0.05, ty: 1.00, tz: 0.40, fov: 34 } },
  { t0: 42.0, t1: 48.0, f: { th: 0.24, ph: 1.280, r: 1.95, tx: -0.05, ty: 1.00, tz: 0.40, fov: 34 }, t: { th: 1.15, ph: 1.100, r: 3.10, tx: 0.10, ty: 1.00, tz: 0.30, fov: 38 } },
  { t0: 48.0, t1: 54.0, f: { th: 1.15, ph: 1.100, r: 3.10, tx: 0.10, ty: 1.00, tz: 0.30, fov: 38 }, t: { th: 1.55, ph: 1.050, r: 4.80, tx: 0.20, ty: 1.05, tz: 0.25, fov: 42 } }
];

/* 柜体 AABB（m）：宽 1000 深 880，地面 0 → 顶 2130（含 130 底座） */
const CAB = { x0: -0.5, x1: 0.5, y0: 0, y1: 2.13, z0: -0.44, z1: 0.44 };
const CAB_BOX = [[CAB.x0, CAB.x1], [CAB.y0, CAB.y1], [CAB.z0, CAB.z1]];
/* 过热电芯（板块②）世界坐标 m */
const HOT = [0.15, 0.86, 0.262];

const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeIn = t => t * t * t;
const easeOut = t => 1 - Math.pow(1 - t, 3);

function shotAt(t) {
  let s = SHOTS[SHOTS.length - 1];
  for (const x of SHOTS) if (t >= x.t0 && t < x.t1) { s = x; break; }
  return s;
}
function state(t) {
  const s = shotAt(t), k = ease(seg(t, s.t0, s.t1));
  const kth = s.eth === 'out' ? easeOut(seg(t, s.t0, s.t1)) : (s.eth === 'in' ? easeIn(seg(t, s.t0, s.t1)) : k);
  const th = lerp(s.f.th, s.t.th, kth) + 0.013 * Math.sin(t * 0.55);
  const ph = lerp(s.f.ph, s.t.ph, k) + 0.007 * Math.sin(t * 0.37 + 1.3);
  const r = lerp(s.f.r, s.t.r, k);
  const tgt = [lerp(s.f.tx, s.t.tx, k), lerp(s.f.ty, s.t.ty, k), lerp(s.f.tz, s.t.tz, k)];
  const cam = [tgt[0] + r * Math.sin(ph) * Math.sin(th), tgt[1] + r * Math.cos(ph), tgt[2] + r * Math.sin(ph) * Math.cos(th)];
  return { cam, tgt, fov: lerp(s.f.fov, s.t.fov, k) };
}

function segHitsBox(p0, p1, b) {
  let tmin = 0, tmax = 1;
  for (let i = 0; i < 3; i++) {
    const d = p1[i] - p0[i];
    if (Math.abs(d) < 1e-9) { if (p0[i] < b[i][0] || p0[i] > b[i][1]) return false; continue; }
    let t1 = (b[i][0] - p0[i]) / d, t2 = (b[i][1] - p0[i]) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}
const inBox = (p, b) => p[0] >= b.x0 && p[0] <= b.x1 && p[1] >= b.y0 && p[1] <= b.y1 && p[2] >= b.z0 && p[2] <= b.z1;

function toNDC(cam, tgt, fov, p, aspect = 16 / 9) {
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const norm = v => { const l = Math.hypot(...v); return [v[0] / l, v[1] / l, v[2] / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const zA = norm(sub(cam, tgt));
  const xA = norm(cross([0, 1, 0], zA));
  const yA = cross(zA, xA);
  const d = sub(p, cam);
  const zc = dot(d, zA);
  if (zc >= -1e-6) return null;
  const th = Math.tan((fov * Math.PI / 180) / 2);
  return [dot(d, xA) / (-zc) / (th * aspect), dot(d, yA) / (-zc) / th];
}

function productPos(t) {
  const mk = ease(seg(t, 12.4, 16.8));
  return [lerp(2600, 860, mk) / 1000, 0.45, lerp(1500, 620, mk) / 1000];
}
/* 各阶段真正要看的主体（摇镜过程中主体本就从画外入画，不按产品判定） */
function subjectOf(t) {
  if (t >= 36.0 && t < 42.0) return HOT;      // 板块② 过热电芯
  if (t >= 7.0 && t < 16.8) return productPos(t);
  return state(t).tgt;                        // 柜体 / 注视点
}

let blocked = [], offscreen = [];
const DUR = 54;
for (let t = 0; t <= DUR; t += 0.1) {
  const st = state(t);
  const tgtIn = inBox(st.tgt, CAB);
  if (!tgtIn && segHitsBox(st.cam, st.tgt, CAB_BOX)) blocked.push(+t.toFixed(1));
  const n = toNDC(st.cam, st.tgt, st.fov, subjectOf(t));
  if (n && (Math.abs(n[0]) > 0.85 || Math.abs(n[1]) > 0.85)) offscreen.push(+t.toFixed(1));
}

console.log('遮挡时间点(视线穿过柜体):', blocked.length ? blocked.join(', ') : '无 ✅');
console.log('主体超出安全框时间点:', offscreen.length ? offscreen.join(', ') : '无 ✅');

console.log('\n各章采样：');
[0, 2, 4, 6, 8, 12.4, 14, 16.8, 19, 21.6, 24, 26.6, 29, 32, 35, 38, 42, 45, 48, 52].forEach(t => {
  const s = state(t);
  const d = Math.hypot(...s.cam.map((v, i) => v - s.tgt[i]));
  const n = toNDC(s.cam, s.tgt, s.fov, subjectOf(t));
  console.log(`t=${String(t).padStart(5)}s cam=(${s.cam.map(v => v.toFixed(2)).join(',')}) tgt=(${s.tgt.map(v => v.toFixed(2)).join(',')}) d=${d.toFixed(2)}m fov=${s.fov.toFixed(0)}° 主体NDC=${n ? n.map(v => v.toFixed(2)).join(',') : '—'}`);
});
