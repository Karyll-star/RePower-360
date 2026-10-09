import * as THREE from 'three';
import { Mats } from './materials';
import { canvasTexture, chamferFrame, mk, rbox } from './helpers';
import { Anchor } from './rePulse';

export interface ReBridge {
  group: THREE.Group;
  anchors: Anchor[];
  pickables: THREE.Object3D[];
  update: (dt: number) => void;
  setOffline: (off: boolean) => void;
}

const PI = Math.PI;

function endLabels(items: { t: string; u: number; v: number; size?: number }[]) {
  return canvasTexture(512, 600, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#c3cad2';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    items.forEach((it) => {
      c.font = `600 ${it.size ?? 34}px Inter, sans-serif`;
      c.fillText(it.t, it.u * w, it.v * h);
    });
  });
}

function rj45(m: Mats, parent: THREE.Object3D, x: number, y: number, z: number, dir: 1 | -1, led: THREE.Material) {
  mk(new THREE.BoxGeometry(0.012, 0.027, 0.03), m.aluminum, { pos: [x + dir * 0.004, y, z], parent });
  mk(new THREE.BoxGeometry(0.012, 0.019, 0.024), m.cavity, { pos: [x + dir * 0.0055, y - 0.001, z], parent, cast: false });
  mk(new THREE.BoxGeometry(0.004, 0.006, 0.01), m.cavity, { pos: [x + dir * 0.0095, y - 0.012, z], parent, cast: false });
  for (let i = 0; i < 6; i++)
    mk(new THREE.BoxGeometry(0.002, 0.0015, 0.0012), m.gold, { pos: [x + dir * 0.006, y + 0.0075, z - 0.0075 + i * 0.003], parent, cast: false });
  mk(new THREE.BoxGeometry(0.003, 0.004, 0.005), led, { pos: [x + dir * 0.0105, y + 0.0105, z - 0.011], parent, cast: false });
}

export function buildReBridge(m: Mats): ReBridge {
  const root = new THREE.Group();
  root.name = 'RE-BRIDGE';
  const anchors: Anchor[] = [];
  const pickables: THREE.Object3D[] = [];

  const led = m.ledCyan.clone();
  const linkLed = m.ledGreen.clone();
  const actLed = m.ledAmber.clone();

  const Y = 0.088;
  // body
  mk(rbox(0.262, 0.15, 0.136, 0.012), m.shell, { pos: [0, Y, 0], parent: root });
  mk(rbox(0.25, 0.012, 0.122, 0.005), m.panel, { pos: [0, 0.163, -0.002], parent: root });
  for (const z of [-0.048, 0.044]) mk(new THREE.BoxGeometry(0.25, 0.002, 0.003), m.cavity, { pos: [0, 0.1692, z], parent: root, cast: false });

  // front face detailing
  mk(rbox(0.252, 0.014, 0.006, 0.003, 1), m.armor, { pos: [0, 0.149, 0.068], parent: root });
  const ledBar = mk(rbox(0.072, 0.0036, 0.004, 0.0015, 1), led, { pos: [0, 0.1365, 0.0695], parent: root, cast: false });
  mk(new THREE.BoxGeometry(0.244, 0.003, 0.002), m.cavity, { pos: [0, 0.03, 0.0685], parent: root, cast: false });
  mk(rbox(0.252, 0.012, 0.005, 0.003, 1), m.armor, { pos: [0, 0.02, 0.068], parent: root });
  const frontTex = canvasTexture(1024, 300, (c, w) => {
    c.clearRect(0, 0, w, 300);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#e4e8ed';
    c.font = '600 112px Inter, sans-serif';
    (c as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '6px';
    c.fillText('RE-BRIDGE', w / 2, 120);
    (c as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
    c.fillStyle = '#a3acb6';
    c.font = '400 52px Inter, sans-serif';
    c.fillText('Edge Gateway', w / 2, 220);
  });
  mk(
    new THREE.PlaneGeometry(0.15, 0.044),
    new THREE.MeshStandardMaterial({ map: frontTex, transparent: true, roughness: 0.4, metalness: 0.4, depthWrite: false }),
    { pos: [0, 0.084, 0.0682], parent: root, cast: false }
  );

  // anodized aluminium chamfered end-cap frames
  const capGeo = chamferFrame(0.158, 0.178, 0.03, 0.122, 0.142, 0.016, 0.042, 0.004);
  for (const s of [-1, 1]) {
    mk(capGeo, m.aluminum, { pos: [s * 0.152, Y, 0], rot: [0, PI / 2, 0], parent: root });
    mk(new THREE.BoxGeometry(0.006, 0.146, 0.126), m.panelDark, { pos: [s * 0.16, Y, 0], parent: root });
    // inner dark lip
    mk(chamferFrame(0.128, 0.148, 0.018, 0.118, 0.138, 0.014, 0.01, 0.0015), m.armor, {
      pos: [s * 0.166, Y, 0],
      rot: [0, PI / 2, 0],
      parent: root,
      cast: false,
    });
  }

  // right I/O
  const RX = 0.163;
  rj45(m, root, RX, 0.12, 0.004, 1, linkLed);
  mk(new THREE.BoxGeometry(0.01, 0.013, 0.028), m.aluminum, { pos: [RX + 0.004, 0.072, -0.012], parent: root });
  mk(new THREE.BoxGeometry(0.008, 0.009, 0.024), m.cavity, { pos: [RX + 0.006, 0.072, -0.012], parent: root, cast: false });
  mk(new THREE.BoxGeometry(0.009, 0.003, 0.019), new THREE.MeshStandardMaterial({ color: 0xe8edf2, roughness: 0.4 }), {
    pos: [RX + 0.006, 0.0745, -0.012],
    parent: root,
    cast: false,
  });
  mk(rbox(0.008, 0.0065, 0.017, 0.0032, 2), m.aluminum, { pos: [RX + 0.003, 0.044, -0.012], parent: root });
  mk(rbox(0.006, 0.0035, 0.013, 0.0017, 1), m.cavity, { pos: [RX + 0.006, 0.044, -0.012], parent: root, cast: false });
  mk(new THREE.CylinderGeometry(0.006, 0.006, 0.008, 24), m.aluminum, { pos: [RX + 0.004, 0.044, 0.034], rot: [0, 0, PI / 2], parent: root });
  mk(new THREE.CylinderGeometry(0.0028, 0.0028, 0.009, 16), m.cavity, { pos: [RX + 0.005, 0.044, 0.034], rot: [0, 0, PI / 2], parent: root, cast: false });
  mk(new THREE.BoxGeometry(0.003, 0.004, 0.005), actLed, { pos: [RX + 0.0045, 0.098, 0.04], parent: root, cast: false });
  const rTex = endLabels([
    { t: 'ETH', u: 0.47, v: 0.13 },
    { t: 'USB', u: 0.86, v: 0.6 },
    { t: 'TYPE-C', u: 0.86, v: 0.8, size: 24 },
    { t: 'ACT', u: 0.32, v: 0.43, size: 24 },
    { t: 'PWR', u: 0.22, v: 0.93, size: 24 },
  ]);
  mk(
    new THREE.PlaneGeometry(0.122, 0.142),
    new THREE.MeshBasicMaterial({ map: rTex, transparent: true, depthWrite: false, opacity: 0.85 }),
    { pos: [RX + 0.0002, Y, 0], rot: [0, PI / 2, 0], parent: root, cast: false, receive: false }
  );

  // left I/O (CAN / RS485)
  const LX = -0.163;
  rj45(m, root, LX, 0.118, 0, -1, linkLed);
  rj45(m, root, LX, 0.062, 0, -1, actLed);
  const lTex = endLabels([
    { t: 'CAN', u: 0.5, v: 0.12 },
    { t: 'RS485', u: 0.5, v: 0.94, size: 30 },
  ]);
  mk(
    new THREE.PlaneGeometry(0.122, 0.142),
    new THREE.MeshBasicMaterial({ map: lTex, transparent: true, depthWrite: false, opacity: 0.85 }),
    { pos: [LX - 0.0002, Y, 0], rot: [0, -PI / 2, 0], parent: root, cast: false, receive: false }
  );

  // SMA antenna
  const ant = new THREE.Group();
  ant.position.set(0.105, 0.169, -0.012);
  root.add(ant);
  mk(new THREE.CylinderGeometry(0.0098, 0.0098, 0.007, 6), m.gold, { pos: [0, 0.0035, 0], parent: ant });
  mk(new THREE.CylinderGeometry(0.0064, 0.0064, 0.012, 20), m.gold, { pos: [0, 0.013, 0], parent: ant });
  mk(new THREE.CylinderGeometry(0.0078, 0.0078, 0.02, 24), m.rubber, { pos: [0, 0.029, 0], parent: ant });
  const whip = new THREE.Group();
  whip.position.y = 0.039;
  whip.rotation.z = -0.05;
  ant.add(whip);
  mk(new THREE.CylinderGeometry(0.0052, 0.0072, 0.088, 24), m.rubber, { pos: [0, 0.044, 0], parent: whip });
  mk(new THREE.SphereGeometry(0.0052, 16, 10), m.rubber, { pos: [0, 0.088, 0], parent: whip });
  for (let i = 0; i < 3; i++) mk(new THREE.TorusGeometry(0.0072, 0.0009, 6, 20), m.rubber, { pos: [0, 0.004 + i * 0.005, 0], rot: [PI / 2, 0, 0], parent: whip, cast: false });
  ant.traverse((o) => (o.userData.action = 'antenna'));
  pickables.push(ant);

  // magnetic feet
  for (const x of [-0.1, 0.1]) for (const z of [-0.045, 0.045]) mk(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 24), m.rubber, { pos: [x, 0.006, z], parent: root });

  root.traverse((o) => {
    if (!o.userData.action) o.userData.action = 'bridge';
  });
  pickables.push(root);

  const anchor = (id: string, p: [number, number, number], n?: [number, number, number]) => {
    const o = new THREE.Object3D();
    o.position.set(...p);
    root.add(o);
    anchors.push({ id, obj: o, normal: n ? new THREE.Vector3(...n) : undefined });
  };
  anchor('bridge', [0, 0.14, 0.07], [0, 0, 1]);
  anchor('ports', [0.175, 0.12, 0], [1, 0, 0]);
  anchor('antenna', [0.105, 0.26, -0.012]);

  let t = 0;
  let offline = false;
  void ledBar;
  return {
    group: root,
    anchors,
    pickables,
    setOffline: (o) => (offline = o),
    update: (dt) => {
      t += dt;
      led.emissiveIntensity = offline ? 0.4 : 3.2 + Math.sin(t * 2.6) * 1.4;
      linkLed.emissiveIntensity = offline ? 0.2 : 3;
      actLed.emissiveIntensity = !offline && Math.sin(t * 17) + Math.sin(t * 7.3) > 0.6 ? 3.2 : 0.3;
      whip.rotation.x = Math.sin(t * 1.3) * 0.004;
    },
  };
}
