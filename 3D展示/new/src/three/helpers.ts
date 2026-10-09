import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/** Chamfered (octagonal-corner) rectangle shape centered at origin. */
export function chamferShape(w: number, h: number, c: number): THREE.Shape {
  const x = w / 2;
  const y = h / 2;
  const s = new THREE.Shape();
  s.moveTo(-x + c, -y);
  s.lineTo(x - c, -y);
  s.lineTo(x, -y + c);
  s.lineTo(x, y - c);
  s.lineTo(x - c, y);
  s.lineTo(-x + c, y);
  s.lineTo(-x, y - c);
  s.lineTo(-x, -y + c);
  s.closePath();
  return s;
}

export function chamferPath(w: number, h: number, c: number): THREE.Path {
  const x = w / 2;
  const y = h / 2;
  const p = new THREE.Path();
  p.moveTo(-x + c, -y);
  p.lineTo(-x, -y + c);
  p.lineTo(-x, y - c);
  p.lineTo(-x + c, y);
  p.lineTo(x - c, y);
  p.lineTo(x, y - c);
  p.lineTo(x, -y + c);
  p.lineTo(x - c, -y);
  p.closePath();
  return p;
}

/**
 * Solid chamfered slab: shape in XY, thickness along Z, centered.
 * Small bevel gives the soft machined highlight on every edge.
 */
export function chamferSlab(
  w: number,
  h: number,
  depth: number,
  c: number,
  bevel = 0.004
): THREE.BufferGeometry {
  const b = Math.min(bevel, depth * 0.3, w * 0.2, h * 0.2);
  const g = new THREE.ExtrudeGeometry(chamferShape(w - 2 * b, h - 2 * b, Math.max(0.001, c - b * 0.6)), {
    depth: Math.max(0.0005, depth - 2 * b),
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 2,
    curveSegments: 4,
  });
  g.translate(0, 0, -(depth - 2 * b) / 2);
  return g;
}

/** Chamfered ring / frame (outer shape with chamfered hole). */
export function chamferFrame(
  w: number,
  h: number,
  c: number,
  iw: number,
  ih: number,
  ic: number,
  depth: number,
  bevel = 0.003
): THREE.BufferGeometry {
  const shape = chamferShape(w, h, c);
  shape.holes.push(chamferPath(iw, ih, ic));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: depth - 2 * bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 4,
  });
  g.translate(0, 0, -(depth - 2 * bevel) / 2);
  return g;
}

export function rbox(w: number, h: number, d: number, r: number, seg = 3): THREE.BufferGeometry {
  return new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
}

interface MeshOpts {
  pos?: [number, number, number];
  rot?: [number, number, number];
  scale?: [number, number, number];
  cast?: boolean;
  receive?: boolean;
  name?: string;
  parent?: THREE.Object3D;
}

export function mk(geo: THREE.BufferGeometry, mat: THREE.Material, o: MeshOpts = {}): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  if (o.pos) m.position.set(...o.pos);
  if (o.rot) m.rotation.set(...o.rot);
  if (o.scale) m.scale.set(...o.scale);
  m.castShadow = o.cast ?? true;
  m.receiveShadow = o.receive ?? true;
  if (o.name) m.name = o.name;
  if (o.parent) o.parent.add(m);
  return m;
}

export function canvasTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Procedural value-noise texture used for powder-coat / stone micro variation. */
export function noiseTexture(size: number, base: number, amp: number, scale = 1, streak = 0): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  // seeded pseudo random
  let seed = 1337;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const grid = 64;
  const g: number[] = [];
  for (let i = 0; i < grid * grid; i++) g.push(rnd());
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const sample = (x: number, y: number) => {
    const xi = Math.floor(x) % grid;
    const yi = Math.floor(y) % grid;
    const xf = smooth(x - Math.floor(x));
    const yf = smooth(y - Math.floor(y));
    const a = g[yi * grid + xi];
    const b = g[yi * grid + ((xi + 1) % grid)];
    const cc = g[((yi + 1) % grid) * grid + xi];
    const d = g[((yi + 1) % grid) * grid + ((xi + 1) % grid)];
    return a + (b - a) * xf + (cc - a) * yf + (a - b - cc + d) * xf * yf;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * grid;
      const v = (y / size) * grid;
      let n =
        sample(u * 0.125 * scale, v * 0.125 * scale) * 0.5 +
        sample(u * 0.5 * scale, v * 0.5 * scale) * 0.3 +
        rnd() * 0.2;
      if (streak > 0) n = n * (1 - streak) + sample(u * 0.05, v * 2.0) * streak;
      const val = Math.max(0, Math.min(255, (base + (n - 0.5) * amp) * 255));
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = val;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** Path helper that always starts a fresh path (fixes accumulated roundRect fills). */
export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function hexBolt(mat: THREE.Material, r = 0.006, h = 0.004): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, h, 6), mat);
  m.castShadow = false;
  return m;
}
