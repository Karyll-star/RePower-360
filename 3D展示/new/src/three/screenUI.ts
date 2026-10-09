import * as THREE from 'three';
import { rr } from './helpers';

export type ScreenMode = 'activation' | 'impedance' | 'diagnostic' | 'cloud';

const CY = '#22d3ee';
const GR = '#34d399';
const DIM = '#5b6b7e';
const TXT = '#e6edf5';

export class ScreenUI {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  mode: ScreenMode = 'activation';
  estop = false;
  t = 0;
  private acc = 0;

  constructor(w = 1280, h = 680) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
    this.draw();
  }

  update(dt: number) {
    this.t += dt;
    this.acc += dt;
    if (this.acc > 1 / 30) {
      this.acc = 0;
      this.draw();
      this.texture.needsUpdate = true;
    }
  }

  refresh() {
    this.draw();
    this.texture.needsUpdate = true;
  }

  private panel(x: number, y: number, w: number, h: number, title: string, sub?: string) {
    const c = this.ctx;
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(22,36,52,0.92)');
    g.addColorStop(1, 'rgba(10,18,28,0.92)');
    rr(c, x, y, w, h, 14);
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = 'rgba(80,140,180,0.22)';
    c.lineWidth = 1.5;
    c.stroke();
    c.fillStyle = TXT;
    c.font = '600 20px Inter, sans-serif';
    c.textAlign = 'left';
    c.fillText(title, x + 20, y + 36);
    if (sub) {
      c.fillStyle = DIM;
      c.font = '14px Inter, sans-serif';
      c.fillText(sub, x + 20, y + 56);
    }
  }

  private draw() {
    const c = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const t = this.t;

    const bg = c.createRadialGradient(W * 0.3, H * 0.2, 50, W * 0.5, H * 0.5, W * 0.8);
    bg.addColorStop(0, '#0f2233');
    bg.addColorStop(1, '#050a10');
    c.fillStyle = bg;
    c.fillRect(0, 0, W, H);

    // top bar
    c.fillStyle = CY;
    c.font = '700 18px Inter, sans-serif';
    c.textAlign = 'left';
    rr(c, 24, 18, 28, 28, 6);
    c.fillStyle = 'rgba(34,211,238,0.15)';
    c.fill();
    c.fillStyle = CY;
    c.fillText('R', 32, 39);
    c.fillStyle = TXT;
    c.font = '600 17px Inter, sans-serif';
    c.fillText('RE-PULSE  ·  电芯活化巡检', 64, 38);
    c.textAlign = 'right';
    c.fillStyle = DIM;
    c.font = '15px "JetBrains Mono", monospace';
    const secs = Math.floor(t) % 60;
    c.fillText(`5G ▂▄▆█   RE-BRIDGE ●   14:${String(32 + Math.floor(t / 60) % 20).padStart(2, '0')}:${String(secs).padStart(2, '0')}`, W - 28, 38);
    c.fillStyle = GR;
    c.beginPath();
    c.arc(W - 248, 33, 5, 0, Math.PI * 2);
    c.fill();

    if (this.estop) {
      this.drawEStop(W, H);
      return;
    }

    // LEFT: SOH gauge
    const lx = 24, ly = 64, lw = 360, lh = H - 88;
    this.panel(lx, ly, lw, lh, '健康总览', 'State of Health');
    const gx = lx + lw / 2, gy = ly + 250, R = 112;
    c.lineCap = 'round';
    c.lineWidth = 18;
    c.strokeStyle = 'rgba(60,90,120,0.35)';
    c.beginPath();
    c.arc(gx, gy, R, Math.PI * 0.75, Math.PI * 2.25);
    c.stroke();
    const p = 0.82;
    const ag = c.createLinearGradient(gx - R, gy + R, gx + R, gy - R);
    ag.addColorStop(0, '#0ea5e9');
    ag.addColorStop(1, '#34d399');
    c.strokeStyle = ag;
    c.beginPath();
    c.arc(gx, gy, R, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5 * p);
    c.stroke();
    // sweeping glint
    const sweep = Math.PI * 0.75 + Math.PI * 1.5 * p * ((t * 0.35) % 1);
    c.strokeStyle = 'rgba(255,255,255,0.55)';
    c.lineWidth = 6;
    c.beginPath();
    c.arc(gx, gy, R, sweep - 0.05, sweep);
    c.stroke();
    // ticks
    c.lineCap = 'butt';
    for (let i = 0; i <= 30; i++) {
      const a = Math.PI * 0.75 + (Math.PI * 1.5 * i) / 30;
      c.strokeStyle = i / 30 <= p ? 'rgba(52,211,153,0.6)' : 'rgba(120,140,160,0.25)';
      c.lineWidth = i % 5 === 0 ? 3 : 1.5;
      c.beginPath();
      c.moveTo(gx + Math.cos(a) * (R - 26), gy + Math.sin(a) * (R - 26));
      c.lineTo(gx + Math.cos(a) * (R - (i % 5 === 0 ? 38 : 33)), gy + Math.sin(a) * (R - (i % 5 === 0 ? 38 : 33)));
      c.stroke();
    }
    c.textAlign = 'center';
    c.fillStyle = DIM;
    c.font = '15px Inter, sans-serif';
    c.fillText('SOH', gx, gy - 34);
    c.fillStyle = '#ffffff';
    c.font = '700 64px Inter, sans-serif';
    c.fillText('82', gx - 14, gy + 22);
    c.font = '600 28px Inter, sans-serif';
    c.fillText('%', gx + 50, gy + 22);
    c.fillStyle = GR;
    c.font = '15px Inter, sans-serif';
    c.fillText('良好 · Healthy', gx, gy + 52);

    // mini stats
    const stats = [
      ['3.287V', '平均电压'],
      ['280Ah', '额定容量'],
      ['1,284', '循环次数'],
    ];
    stats.forEach(([v, k], i) => {
      const sx = lx + 20 + i * 110;
      const sy = ly + lh - 92;
      rr(c, sx, sy, 100, 70, 10);
      c.fillStyle = 'rgba(34,211,238,0.07)';
      c.fill();
      c.fillStyle = TXT;
      c.font = '600 19px "JetBrains Mono", monospace';
      c.textAlign = 'center';
      c.fillText(v, sx + 50, sy + 32);
      c.fillStyle = DIM;
      c.font = '13px Inter, sans-serif';
      c.fillText(k, sx + 50, sy + 54);
    });

    // MIDDLE
    const mx = 400, my = 64, mw = 470, mh = H - 88;
    const titles: Record<ScreenMode, [string, string]> = {
      activation: ['实时诊断', 'Diagnostics · Pulse Response'],
      impedance: ['阻抗谱 EIS', 'Nyquist Plot · 0.1Hz – 10kHz'],
      diagnostic: ['单体一致性', 'Cell Voltage Distribution'],
      cloud: ['云端协同', 'RE-CLOUD · Edge Twin Sync'],
    };
    this.panel(mx, my, mw, mh, titles[this.mode][0], titles[this.mode][1]);

    // metric chips
    const chips: [string, string, string][] = [
      ['电芯温度', '31.4', '°C'],
      ['最大压差', '18', 'mV'],
      ['内阻', '0.21', 'mΩ'],
    ];
    chips.forEach(([k, v, u], i) => {
      const cx = mx + 20 + i * 148;
      const cy = my + 76;
      rr(c, cx, cy, 136, 84, 10);
      c.fillStyle = 'rgba(255,255,255,0.03)';
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.06)';
      c.stroke();
      c.textAlign = 'left';
      c.fillStyle = DIM;
      c.font = '13px Inter, sans-serif';
      c.fillText(k, cx + 14, cy + 24);
      c.fillStyle = '#ffffff';
      c.font = '700 32px Inter, sans-serif';
      c.fillText(v, cx + 14, cy + 64);
      const vw = c.measureText(v).width;
      c.fillStyle = i === 1 ? GR : CY;
      c.font = '600 16px Inter, sans-serif';
      c.fillText(u, cx + 18 + vw, cy + 64);
    });

    const chX = mx + 20, chY = my + 180, chW = mw - 40, chH = mh - 200;
    c.strokeStyle = 'rgba(255,255,255,0.05)';
    c.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = chY + (chH * i) / 5;
      c.beginPath();
      c.moveTo(chX, y);
      c.lineTo(chX + chW, y);
      c.stroke();
    }
    for (let i = 0; i <= 8; i++) {
      const x = chX + (chW * i) / 8;
      c.beginPath();
      c.moveTo(x, chY);
      c.lineTo(x, chY + chH);
      c.stroke();
    }

    if (this.mode === 'activation') this.drawWave(chX, chY, chW, chH);
    else if (this.mode === 'impedance') this.drawNyquist(chX, chY, chW, chH);
    else if (this.mode === 'diagnostic') this.drawCells(chX, chY, chW, chH);
    else this.drawCloud(chX, chY, chW, chH);

    // RIGHT: activation
    const rx = 886, ry = 64, rw = W - rx - 24, rh = H - 88;
    this.panel(rx, ry, rw, rh, '主动活化', 'Activation');
    c.textAlign = 'left';
    c.fillStyle = '#ffffff';
    c.font = '700 58px Inter, sans-serif';
    c.fillText('67', rx + 20, ry + 136);
    c.fillStyle = CY;
    c.font = '600 26px Inter, sans-serif';
    c.fillText('%', rx + 92, ry + 136);
    c.fillStyle = DIM;
    c.font = '14px Inter, sans-serif';
    c.fillText('剩余 12 min', rx + 140, ry + 134);
    rr(c, rx + 20, ry + 156, rw - 40, 10, 5);
    c.fillStyle = 'rgba(255,255,255,0.08)';
    c.fill();
    const pg = c.createLinearGradient(rx + 20, 0, rx + rw - 20, 0);
    pg.addColorStop(0, '#0ea5e9');
    pg.addColorStop(1, '#34d399');
    rr(c, rx + 20, ry + 156, (rw - 40) * 0.67, 10, 5);
    c.fillStyle = pg;
    c.fill();
    const shimmer = rx + 20 + ((t * 120) % ((rw - 40) * 0.67));
    c.fillStyle = 'rgba(255,255,255,0.5)';
    c.fillRect(shimmer, ry + 157, 18, 8);

    const items: [string, string, string][] = [
      ['极化层消除', '完成', GR],
      ['析锂抑制脉冲', '完成', GR],
      ['容量恢复校准', '进行中', CY],
      ['SEI 膜修复', '等待', '#f59e0b'],
    ];
    items.forEach(([k, s, col], i) => {
      const iy = ry + 200 + i * 66;
      rr(c, rx + 20, iy, rw - 40, 54, 10);
      c.fillStyle = 'rgba(255,255,255,0.03)';
      c.fill();
      c.beginPath();
      c.arc(rx + 44, iy + 27, 11, 0, Math.PI * 2);
      c.fillStyle = col + '33';
      c.fill();
      c.beginPath();
      c.arc(rx + 44, iy + 27, 5 + (s === '进行中' ? Math.sin(t * 6) * 1.5 : 0), 0, Math.PI * 2);
      c.fillStyle = col;
      c.fill();
      c.textAlign = 'left';
      c.fillStyle = TXT;
      c.font = '15px Inter, sans-serif';
      c.fillText(k, rx + 66, iy + 32);
      c.textAlign = 'right';
      c.fillStyle = col;
      c.font = '600 13px Inter, sans-serif';
      c.fillText(s, rx + rw - 34, iy + 32);
    });
  }

  private drawWave(x: number, y: number, w: number, h: number) {
    const c = this.ctx;
    const t = this.t;
    const f = (u: number) => {
      const base = 0.55 - 0.32 * Math.exp(-Math.pow((u - 0.62) * 3.2, 2));
      return base + Math.sin(u * 40 - t * 4) * 0.025 + Math.sin(u * 11 + t) * 0.03;
    };
    const grad = c.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, 'rgba(52,211,153,0.45)');
    grad.addColorStop(1, 'rgba(14,165,233,0)');
    c.beginPath();
    c.moveTo(x, y + h);
    for (let i = 0; i <= 160; i++) {
      const u = i / 160;
      c.lineTo(x + u * w, y + f(u) * h);
    }
    c.lineTo(x + w, y + h);
    c.closePath();
    c.fillStyle = grad;
    c.fill();
    c.beginPath();
    for (let i = 0; i <= 160; i++) {
      const u = i / 160;
      const px = x + u * w;
      const py = y + f(u) * h;
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.strokeStyle = GR;
    c.lineWidth = 3;
    c.stroke();
    // secondary pulse trace
    c.beginPath();
    for (let i = 0; i <= 200; i++) {
      const u = i / 200;
      const sq = Math.sign(Math.sin(u * 50 - t * 6)) * 0.04;
      const py = y + (0.82 + sq) * h;
      if (i === 0) c.moveTo(x + u * w, py);
      else c.lineTo(x + u * w, py);
    }
    c.strokeStyle = 'rgba(34,211,238,0.7)';
    c.lineWidth = 1.5;
    c.stroke();
    c.fillStyle = DIM;
    c.font = '12px "JetBrains Mono", monospace';
    c.textAlign = 'center';
    ['0s', '10s', '20s', '30s', '40s'].forEach((l, i) => c.fillText(l, x + (w * i) / 4, y + h + 16));
  }

  private drawNyquist(x: number, y: number, w: number, h: number) {
    const c = this.ctx;
    const prog = (this.t * 0.25) % 1;
    c.beginPath();
    const N = 120;
    for (let i = 0; i <= N * prog; i++) {
      const u = i / N;
      const re = u < 0.7 ? 0.12 + 0.5 * (1 - Math.cos((u / 0.7) * Math.PI)) / 2 : 0.62 + (u - 0.7) * 1.1;
      const im = u < 0.7 ? Math.sin((u / 0.7) * Math.PI) * 0.4 : (u - 0.7) * 1.2;
      const px = x + re * w;
      const py = y + h - 20 - im * h;
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.strokeStyle = CY;
    c.lineWidth = 3;
    c.stroke();
    c.fillStyle = DIM;
    c.font = '12px "JetBrains Mono", monospace';
    c.textAlign = 'left';
    c.fillText("Z' (mΩ)", x + w - 60, y + h + 16);
    c.fillText("-Z''", x + 4, y + 14);
  }

  private drawCells(x: number, y: number, w: number, h: number) {
    const c = this.ctx;
    const n = 16;
    const bw = w / n - 6;
    for (let i = 0; i < n; i++) {
      const v = 0.72 + Math.sin(i * 1.7) * 0.06 + Math.sin(this.t * 2 + i) * 0.008 - (i === 11 ? 0.12 : 0);
      const bh = v * h;
      const bx = x + i * (bw + 6) + 3;
      const g = c.createLinearGradient(0, y + h - bh, 0, y + h);
      const col = i === 11 ? '#f59e0b' : GR;
      g.addColorStop(0, col);
      g.addColorStop(1, 'rgba(14,165,233,0.15)');
      rr(c, bx, y + h - bh, bw, bh, 4);
      c.fillStyle = g;
      c.fill();
    }
    c.fillStyle = DIM;
    c.font = '12px "JetBrains Mono", monospace';
    c.textAlign = 'center';
    c.fillText('#01 – #16   ΔV max 18mV (#12)', x + w / 2, y + h + 16);
  }

  private drawCloud(x: number, y: number, w: number, h: number) {
    const c = this.ctx;
    const nodes = [
      [0.15, 0.7, 'RE-PULSE'],
      [0.5, 0.75, 'RE-BRIDGE'],
      [0.85, 0.6, 'BMS'],
      [0.5, 0.2, 'RE-CLOUD'],
    ] as const;
    const links = [
      [0, 1],
      [1, 2],
      [1, 3],
      [0, 3],
    ];
    links.forEach(([a, b], i) => {
      const A = nodes[a], B = nodes[b];
      c.strokeStyle = 'rgba(34,211,238,0.3)';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x + A[0] * w, y + A[1] * h);
      c.lineTo(x + B[0] * w, y + B[1] * h);
      c.stroke();
      const k = (this.t * 0.6 + i * 0.25) % 1;
      c.fillStyle = GR;
      c.beginPath();
      c.arc(x + (A[0] + (B[0] - A[0]) * k) * w, y + (A[1] + (B[1] - A[1]) * k) * h, 5, 0, Math.PI * 2);
      c.fill();
    });
    nodes.forEach(([nx, ny, l]) => {
      c.beginPath();
      c.arc(x + nx * w, y + ny * h, 20, 0, Math.PI * 2);
      c.fillStyle = 'rgba(34,211,238,0.15)';
      c.fill();
      c.strokeStyle = CY;
      c.stroke();
      c.fillStyle = TXT;
      c.font = '600 13px Inter, sans-serif';
      c.textAlign = 'center';
      c.fillText(l, x + nx * w, y + ny * h + 40);
    });
  }

  private drawEStop(W: number, H: number) {
    const c = this.ctx;
    const on = Math.sin(this.t * 8) > 0;
    c.fillStyle = on ? 'rgba(220,38,38,0.28)' : 'rgba(220,38,38,0.12)';
    c.fillRect(0, 60, W, H - 60);
    c.strokeStyle = '#ef4444';
    c.lineWidth = 8;
    rr(c, 30, 76, W - 60, H - 100, 18);
    c.stroke();
    c.textAlign = 'center';
    c.fillStyle = '#fecaca';
    c.font = '700 64px Inter, sans-serif';
    c.fillText('⚠ EMERGENCY STOP', W / 2, H / 2 - 10);
    c.font = '26px Inter, sans-serif';
    c.fillStyle = '#fca5a5';
    c.fillText('急停已触发 · 输出继电器已物理断开', W / 2, H / 2 + 44);
    c.font = '18px "JetBrains Mono", monospace';
    c.fillText('ROTATE TO RELEASE', W / 2, H / 2 + 90);
  }
}
