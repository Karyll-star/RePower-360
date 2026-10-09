import * as THREE from 'three';
import { Mats } from './materials';
import { ScreenUI } from './screenUI';
import { canvasTexture, chamferSlab, hexBolt, mk, rbox } from './helpers';

export interface Anchor {
  id: string;
  obj: THREE.Object3D;
  normal?: THREE.Vector3; // local-space facing direction for occlusion test
}

export interface RePulse {
  group: THREE.Group;
  anchors: Anchor[];
  pickables: THREE.Object3D[];
  setTrolley: (ext: boolean) => void;
  setEStop: (on: boolean) => void;
  setExploded: (on: boolean) => void;
  spinKnob: (obj: THREE.Object3D) => void;
  update: (dt: number) => void;
}

const PI = Math.PI;

function printedLabel(lines: { text: string; font: string; color: string; y: number; spacing?: number }[], w: number, h: number) {
  return canvasTexture(w, h, (c) => {
    c.clearRect(0, 0, w, h);
    lines.forEach((l) => {
      c.font = l.font;
      c.fillStyle = l.color;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      if (l.spacing) (c as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${l.spacing}px`;
      c.fillText(l.text, w / 2, l.y);
      (c as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
    });
  });
}

function labelMat(tex: THREE.Texture) {
  return new THREE.MeshStandardMaterial({
    map: tex,
    transparent: true,
    roughness: 0.45,
    metalness: 0.4,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
}

function buildWheel(m: Mats): THREE.Group {
  const g = new THREE.Group();
  const prof = [
    [0.05, -0.028],
    [0.07, -0.028],
    [0.078, -0.024],
    [0.082, -0.012],
    [0.082, 0.012],
    [0.078, 0.024],
    [0.07, 0.028],
    [0.05, 0.028],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const tire = mk(new THREE.LatheGeometry(prof, 48), m.tire, { rot: [0, 0, PI / 2], parent: g });
  tire.name = 'tire';
  // tread lugs
  const lugGeo = rbox(0.048, 0.006, 0.014, 0.002, 1);
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * PI * 2;
    const lug = mk(lugGeo, m.tire, { parent: g, cast: false });
    lug.position.set(0, Math.cos(a) * 0.0825, Math.sin(a) * 0.0825);
    lug.rotation.x = a;
  }
  // rim
  mk(new THREE.CylinderGeometry(0.051, 0.051, 0.046, 40), m.gunmetal, { rot: [0, 0, PI / 2], parent: g });
  mk(new THREE.CylinderGeometry(0.043, 0.043, 0.0475, 40), m.cavity, { rot: [0, 0, PI / 2], parent: g, cast: false });
  const spokeGeo = rbox(0.008, 0.04, 0.011, 0.003, 1);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * PI * 2;
    const s = mk(spokeGeo, m.gunmetal, { parent: g, cast: false });
    s.position.set(0.021, Math.cos(a) * 0.022, Math.sin(a) * 0.022);
    s.rotation.x = a;
  }
  mk(new THREE.CylinderGeometry(0.015, 0.017, 0.054, 24), m.chrome, { rot: [0, 0, PI / 2], parent: g });
  mk(new THREE.CylinderGeometry(0.006, 0.006, 0.058, 6), m.gunmetal, { rot: [0, 0, PI / 2], parent: g });
  return g;
}

export function buildRePulse(m: Mats, screen: ScreenUI): RePulse {
  const root = new THREE.Group();
  root.name = 'RE-PULSE';
  const body = new THREE.Group();
  root.add(body);
  const pickables: THREE.Object3D[] = [];
  const anchors: Anchor[] = [];

  // ---------------- core shell ----------------
  mk(rbox(0.56, 0.31, 0.4, 0.02), m.shell, { pos: [0, 0.555, 0], parent: body });
  mk(rbox(0.48, 0.32, 0.4, 0.02), m.shell, { pos: [0.04, 0.245, 0], parent: body });
  mk(chamferSlab(0.58, 0.42, 0.025, 0.05), m.armor, { pos: [0, 0.082, 0], rot: [-PI / 2, 0, 0], parent: body });

  // ---------------- lid (explodes upward) ----------------
  const lid = new THREE.Group();
  body.add(lid);
  mk(chamferSlab(0.6, 0.44, 0.03, 0.06), m.armor, { pos: [0, 0.72, 0], rot: [-PI / 2, 0, 0], parent: lid });
  mk(chamferSlab(0.38, 0.24, 0.012, 0.03), m.panel, { pos: [0.02, 0.739, 0.04], rot: [-PI / 2, 0, 0], parent: lid });
  // top carry handle (left)
  mk(rbox(0.03, 0.04, 0.03, 0.008), m.armor, { pos: [-0.21, 0.755, 0.1], parent: lid });
  mk(rbox(0.03, 0.04, 0.03, 0.008), m.armor, { pos: [-0.21, 0.755, -0.06], parent: lid });
  mk(rbox(0.034, 0.026, 0.2, 0.011), m.rubber, { pos: [-0.21, 0.783, 0.02], parent: lid });
  // trolley sleeves
  for (const sx of [-0.15, 0.15]) {
    mk(rbox(0.06, 0.026, 0.055, 0.01), m.armor, { pos: [sx, 0.745, -0.17], parent: lid });
    mk(new THREE.TorusGeometry(0.016, 0.003, 8, 24), m.rubber, { pos: [sx, 0.759, -0.17], rot: [PI / 2, 0, 0], parent: lid });
  }

  // corner guards (top row on lid)
  const guardGeo = chamferSlab(0.13, 0.125, 0.13, 0.038, 0.006);
  const addGuard = (parent: THREE.Object3D, x: number, y: number, z: number) => {
    const gm = mk(guardGeo, m.armor, { pos: [x, y, z], parent });
    // raised chamfer cap
    mk(chamferSlab(0.09, 0.085, 0.012, 0.025, 0.003), m.shell, { pos: [0, 0, Math.sign(z) * 0.068], parent: gm });
    const b1 = hexBolt(m.gunmetal);
    b1.rotation.x = PI / 2;
    b1.position.set(0, 0, Math.sign(z) * 0.075);
    gm.add(b1);
    const b2 = hexBolt(m.gunmetal);
    b2.rotation.z = PI / 2;
    b2.position.set(Math.sign(x) * 0.066, 0, 0);
    gm.add(b2);
    return gm;
  };
  for (const x of [-0.285, 0.285]) for (const z of [-0.205, 0.205]) addGuard(lid, x, 0.7, z);
  for (const x of [-0.285, 0.285]) addGuard(body, x, 0.12, 0.205);

  // vertical corner posts
  const postGeo = rbox(0.06, 0.47, 0.07, 0.012);
  for (const x of [-0.29, 0.29]) for (const z of [-0.195, 0.195]) mk(postGeo, m.armor, { pos: [x, 0.41, z], parent: body });

  // rib slots on front posts
  const slotGeo = rbox(0.034, 0.007, 0.006, 0.002, 1);
  for (let i = 0; i < 5; i++) {
    mk(slotGeo, m.cavity, { pos: [0.29, 0.25 + i * 0.024, 0.229], parent: body, cast: false });
    if (i < 3) mk(slotGeo, m.cavity, { pos: [-0.29, 0.25 + i * 0.024, 0.229], parent: body, cast: false });
  }

  // rear axle housings
  for (const x of [-0.28, 0.28]) mk(rbox(0.07, 0.1, 0.13, 0.015), m.armor, { pos: [x, 0.12, -0.17], parent: body });

  // ---------------- front console (explodes forward) ----------------
  const consoleG = new THREE.Group();
  body.add(consoleG);
  mk(chamferSlab(0.5, 0.36, 0.035, 0.035), m.armor, { pos: [0.025, 0.535, 0.2175], parent: consoleG });
  mk(chamferSlab(0.458, 0.335, 0.008, 0.024, 0.002), m.glossBlack, { pos: [0.025, 0.535, 0.239], parent: consoleG });

  const screenMat = new THREE.MeshBasicMaterial({ map: screen.texture });
  screenMat.color.setScalar(1.12);
  const screenMesh = mk(new THREE.PlaneGeometry(0.4, 0.2125), screenMat, {
    pos: [0.025, 0.58, 0.2436],
    parent: consoleG,
    cast: false,
    receive: false,
    name: 'screen',
  });
  screenMesh.userData.action = 'screen';
  pickables.push(screenMesh);
  mk(new THREE.PlaneGeometry(0.43, 0.24), m.glass, { pos: [0.025, 0.575, 0.2446], parent: consoleG, cast: false, receive: false });

  const bezelLabel = printedLabel(
    [{ text: 'RE-PULSE', font: '700 44px Inter, sans-serif', color: '#e5e9ee', y: 32, spacing: 4 }],
    300,
    64
  );
  mk(new THREE.PlaneGeometry(0.07, 0.015), labelMat(bezelLabel), { pos: [-0.135, 0.6945, 0.2437], parent: consoleG, cast: false });

  // three round function buttons
  const buttons: THREE.Object3D[] = [];
  [-0.125, -0.055, 0.015].forEach((bx) => {
    const g = new THREE.Group();
    g.position.set(bx, 0.43, 0.243);
    consoleG.add(g);
    mk(new THREE.TorusGeometry(0.0165, 0.0028, 10, 40), m.chrome, { parent: g, cast: false });
    const cap = mk(new THREE.CylinderGeometry(0.0145, 0.0152, 0.009, 40), m.glossBlack, { pos: [0, 0, 0.0045], rot: [PI / 2, 0, 0], parent: g });
    mk(new THREE.TorusGeometry(0.0055, 0.0011, 8, 24), m.aluminum, { pos: [0, 0, 0.0092], parent: g, cast: false });
    cap.userData.action = 'button';
    pickables.push(cap);
    buttons.push(cap);
  });

  // emergency stop
  const estop = new THREE.Group();
  estop.position.set(0.16, 0.426, 0.243);
  consoleG.add(estop);
  mk(new THREE.CylinderGeometry(0.037, 0.041, 0.012, 56), m.yellow, { pos: [0, 0, 0.006], rot: [PI / 2, 0, 0], parent: estop });
  const estopCap = new THREE.Group();
  estop.add(estopCap);
  mk(new THREE.CylinderGeometry(0.019, 0.019, 0.016, 32), m.eStopRed, { pos: [0, 0, 0.018], rot: [PI / 2, 0, 0], parent: estopCap });
  mk(new THREE.CylinderGeometry(0.03, 0.03, 0.009, 48), m.eStopRed, { pos: [0, 0, 0.028], rot: [PI / 2, 0, 0], parent: estopCap });
  const dome = mk(new THREE.SphereGeometry(0.03, 48, 16, 0, PI * 2, 0, PI / 2), m.eStopRed, {
    pos: [0, 0, 0.0325],
    rot: [PI / 2, 0, 0],
    scale: [1, 0.42, 1],
    parent: estopCap,
  });
  // knurled grip ridges around mushroom rim
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * PI * 2;
    mk(new THREE.BoxGeometry(0.003, 0.003, 0.008), m.eStopRed, {
      pos: [Math.cos(a) * 0.0302, Math.sin(a) * 0.0302, 0.028],
      rot: [0, 0, a],
      parent: estopCap,
      cast: false,
    });
  }
  estopCap.traverse((o) => {
    o.userData.action = 'estop';
  });
  estop.children[0].userData.action = 'estop';
  pickables.push(estop);
  void dome;

  // slot lip under console
  mk(chamferSlab(0.26, 0.032, 0.03, 0.012), m.armor, { pos: [0.025, 0.336, 0.218], parent: consoleG });
  mk(rbox(0.21, 0.01, 0.01, 0.003, 1), m.cavity, { pos: [0.025, 0.336, 0.231], parent: consoleG, cast: false });

  // knob on front-left post + cyan LED strip
  const knobG = new THREE.Group();
  knobG.position.set(-0.29, 0.53, 0.23);
  body.add(knobG);
  mk(new THREE.CylinderGeometry(0.025, 0.026, 0.008, 40), m.gunmetal, { pos: [0, 0, 0.004], rot: [PI / 2, 0, 0], parent: knobG });
  const knob = new THREE.Group();
  knob.position.z = 0.008;
  knobG.add(knob);
  const knurl = new THREE.MeshStandardMaterial({ color: 0x23272d, metalness: 0.85, roughness: 0.35, flatShading: true });
  mk(new THREE.CylinderGeometry(0.02, 0.021, 0.026, 30), knurl, { pos: [0, 0, 0.013], rot: [PI / 2, 0, 0], parent: knob });
  mk(new THREE.CylinderGeometry(0.0175, 0.0175, 0.002, 40), m.aluminum, { pos: [0, 0, 0.0265], rot: [PI / 2, 0, 0], parent: knob });
  mk(new THREE.BoxGeometry(0.0025, 0.012, 0.002), m.ledCyan, { pos: [0, 0.008, 0.028], parent: knob, cast: false });
  knob.traverse((o) => (o.userData.action = 'knob'));
  knob.userData.isKnob = true;
  pickables.push(knob);
  mk(rbox(0.007, 0.075, 0.005, 0.002, 1), m.ledCyan, { pos: [-0.29, 0.43, 0.2305], parent: body, cast: false });

  // ---------------- lower front panel ----------------
  const lowerG = new THREE.Group();
  body.add(lowerG);
  mk(chamferSlab(0.5, 0.235, 0.03, 0.03), m.panel, { pos: [0.025, 0.2, 0.215], parent: lowerG });
  mk(rbox(0.44, 0.006, 0.004, 0.002, 1), m.cavity, { pos: [0.025, 0.105, 0.2305], parent: lowerG, cast: false });
  const frontLabel = printedLabel(
    [
      { text: 'RE-PULSE', font: '600 110px Inter, sans-serif', color: '#dfe4ea', y: 80, spacing: 10 },
      { text: 'Energy Storage Health Guardian', font: '400 40px Inter, sans-serif', color: '#aab3bd', y: 170 },
    ],
    1024,
    220
  );
  mk(new THREE.PlaneGeometry(0.27, 0.058), labelMat(frontLabel), { pos: [0.025, 0.213, 0.2302], parent: lowerG, cast: false });

  // ---------------- left side ----------------
  const sideG = new THREE.Group();
  body.add(sideG);
  mk(chamferSlab(0.34, 0.215, 0.016, 0.03), m.panel, { pos: [-0.285, 0.555, 0], rot: [0, -PI / 2, 0], parent: sideG });
  const sideLabel = printedLabel(
    [
      { text: 'RE-PULSE', font: '600 96px Inter, sans-serif', color: '#d5dbe2', y: 70, spacing: 6 },
      { text: 'Energy Storage Health Guardian', font: '400 34px Inter, sans-serif', color: '#99a3ae', y: 150 },
    ],
    900,
    200
  );
  mk(new THREE.PlaneGeometry(0.2, 0.044), labelMat(sideLabel), { pos: [-0.2935, 0.585, -0.03], rot: [0, -PI / 2, 0], parent: sideG, cast: false });

  // cable bay
  mk(rbox(0.065, 0.035, 0.36, 0.008), m.armor, { pos: [-0.29, 0.415, 0], parent: body });
  mk(rbox(0.065, 0.03, 0.36, 0.008), m.armor, { pos: [-0.29, 0.1, 0], parent: body });
  mk(new THREE.BoxGeometry(0.01, 0.3, 0.33), m.cavity, { pos: [-0.205, 0.255, 0], parent: body });
  mk(new THREE.BoxGeometry(0.08, 0.008, 0.33), m.cavity, { pos: [-0.25, 0.118, 0], parent: body });
  mk(rbox(0.085, 0.012, 0.33, 0.004), m.gunmetal, { pos: [-0.25, 0.392, 0], parent: body });
  // grille texture on bay back wall
  for (let i = 0; i < 7; i++) mk(new THREE.BoxGeometry(0.004, 0.006, 0.3), m.panelDark, { pos: [-0.199, 0.16 + i * 0.03, 0], parent: body, cast: false });

  const cableG = new THREE.Group();
  body.add(cableG);
  const cableCols = [m.boots.orange, m.boots.red, m.boots.yellow, m.boots.blue, m.boots.grey];
  const zs = [-0.12, -0.065, -0.01, 0.045, 0.1];
  const x0 = -0.255;
  zs.forEach((z, i) => {
    mk(new THREE.CylinderGeometry(0.0125, 0.0125, 0.012, 6), m.aluminum, { pos: [x0, 0.381, z], parent: cableG });
    mk(new THREE.CylinderGeometry(0.0118, 0.0118, 0.006, 32), m.aluminum, { pos: [x0, 0.372, z], parent: cableG });
    mk(new THREE.CylinderGeometry(0.0112, 0.0108, 0.03, 32), m.rubber, { pos: [x0, 0.354, z], parent: cableG });
    mk(new THREE.CylinderGeometry(0.0106, 0.0074, 0.032, 32), cableCols[i], { pos: [x0, 0.323, z], parent: cableG });
    mk(new THREE.CylinderGeometry(0.0062, 0.0052, 0.02, 16), m.rubber, { pos: [x0, 0.297, z], parent: cableG });
    const bottom = 0.135 + (i % 2) * 0.018;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x0, 0.288, z),
      new THREE.Vector3(x0 - 0.004, 0.22, z + 0.003),
      new THREE.Vector3(x0 - 0.008, bottom + 0.03, z + 0.008),
      new THREE.Vector3(x0 + 0.004, bottom, z + 0.016),
      new THREE.Vector3(x0 + 0.024, bottom + 0.025, z + 0.022),
      new THREE.Vector3(x0 + 0.03, 0.23, z + 0.02),
      new THREE.Vector3(x0 + 0.036, 0.3, z + 0.016),
    ]);
    mk(new THREE.TubeGeometry(curve, 80, 0.0046, 10, false), m.cable, { parent: cableG });
    mk(rbox(0.012, 0.022, 0.018, 0.004, 1), m.rubber, { pos: [-0.214, 0.302, z + 0.016], parent: cableG });
  });

  // ---------------- right side vents ----------------
  mk(chamferSlab(0.3, 0.22, 0.014, 0.03), m.panel, { pos: [0.286, 0.47, 0], rot: [0, PI / 2, 0], parent: body });
  for (let i = 0; i < 9; i++) mk(rbox(0.004, 0.008, 0.22, 0.002, 1), m.cavity, { pos: [0.2935, 0.4 + i * 0.018, 0], parent: body, cast: false });
  mk(rbox(0.014, 0.04, 0.16, 0.007), m.armor, { pos: [0.3, 0.24, 0], parent: body });
  mk(rbox(0.006, 0.014, 0.12, 0.003), m.cavity, { pos: [0.306, 0.24, 0], parent: body, cast: false });

  // back panel
  mk(chamferSlab(0.44, 0.46, 0.012, 0.04), m.panel, { pos: [0, 0.41, -0.204], rot: [0, PI, 0], parent: body });
  const backLabel = printedLabel(
    [
      { text: 'RE-ENERGY  ·  RE-PULSE  RP-2000', font: '600 34px Inter, sans-serif', color: '#9aa4ae', y: 40 },
      { text: 'INPUT 100-240V~  50/60Hz   IP54   S/N RP24-001283', font: '24px "JetBrains Mono", monospace', color: '#7d8791', y: 90 },
    ],
    900,
    130
  );
  mk(new THREE.PlaneGeometry(0.2, 0.029), labelMat(backLabel), { pos: [0, 0.3, -0.2105], rot: [0, PI, 0], parent: body, cast: false });

  // ---------------- wheels & feet ----------------
  for (const side of [-1, 1]) {
    const w = buildWheel(m);
    w.position.set(side * 0.335, 0.082, -0.17);
    if (side < 0) w.rotation.y = PI;
    body.add(w);
    const fender = mk(new THREE.TorusGeometry(0.098, 0.012, 10, 32, PI), m.armor, { parent: body });
    fender.scale.set(1, 1, 2.6);
    fender.rotation.y = PI / 2;
    fender.position.set(side * 0.33, 0.082, -0.17);
  }
  for (const x of [-0.24, 0.24]) {
    mk(new THREE.CylinderGeometry(0.026, 0.032, 0.058, 28), m.rubber, { pos: [x, 0.029, 0.17], parent: body });
    mk(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 28), m.gunmetal, { pos: [x, 0.064, 0.17], parent: body });
  }

  // ---------------- trolley handle ----------------
  const trolley = new THREE.Group();
  trolley.position.y = 0.75;
  body.add(trolley);
  for (const sx of [-0.15, 0.15]) {
    mk(new THREE.CylinderGeometry(0.0115, 0.0115, 0.46, 32), m.chrome, { pos: [sx, -0.2, -0.17], parent: trolley });
    mk(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 32), m.rubber, { pos: [sx, -0.02, -0.17], parent: trolley });
    mk(rbox(0.06, 0.075, 0.06, 0.014), m.armor, { pos: [sx, 0.06, -0.17], parent: trolley });
  }
  mk(chamferSlab(0.37, 0.05, 0.062, 0.018, 0.006), m.rubber, { pos: [0, 0.098, -0.17], parent: trolley });
  mk(chamferSlab(0.34, 0.02, 0.064, 0.008, 0.003), m.armor, { pos: [0, 0.07, -0.17], parent: trolley });
  mk(rbox(0.1, 0.005, 0.014, 0.002, 1), m.ledCyan, { pos: [0, 0.1235, -0.17], parent: trolley, cast: false });
  trolley.traverse((o) => (o.userData.action = 'trolley'));
  pickables.push(trolley);

  // ---------------- internals (exploded view) ----------------
  const internals = new THREE.Group();
  internals.visible = false;
  body.add(internals);
  // battery pack
  const cellGeo = new THREE.CylinderGeometry(0.017, 0.017, 0.07, 20);
  for (let ix = 0; ix < 6; ix++)
    for (let iz = 0; iz < 4; iz++) mk(cellGeo, m.cellBlue, { pos: [-0.2 + ix * 0.036, 0.035, -0.09 + iz * 0.036], parent: internals });
  mk(new THREE.BoxGeometry(0.22, 0.003, 0.15), m.copper, { pos: [-0.11, 0.072, -0.036], parent: internals });
  // heat sink pulse module
  mk(new THREE.BoxGeometry(0.2, 0.014, 0.16), m.aluminum, { pos: [0.13, 0.007, -0.02], parent: internals });
  for (let i = 0; i < 12; i++) mk(new THREE.BoxGeometry(0.004, 0.055, 0.16), m.aluminum, { pos: [0.04 + i * 0.0165, 0.04, -0.02], parent: internals });
  // control PCB
  mk(new THREE.BoxGeometry(0.26, 0.004, 0.17), m.pcb, { pos: [0.02, 0.11, 0.06], parent: internals });
  for (let i = 0; i < 6; i++) mk(new THREE.BoxGeometry(0.028, 0.006, 0.028), m.panelDark, { pos: [-0.08 + i * 0.04, 0.116, 0.04], parent: internals });
  for (let i = 0; i < 4; i++) mk(new THREE.CylinderGeometry(0.009, 0.009, 0.03, 16), m.gunmetal, { pos: [-0.06 + i * 0.03, 0.128, 0.11], parent: internals });
  mk(new THREE.TorusGeometry(0.022, 0.009, 12, 24), m.copper, { pos: [0.1, 0.128, 0.11], rot: [PI / 2, 0, 0], parent: internals });
  // fan
  const fan = new THREE.Group();
  fan.position.set(0.13, 0.11, -0.14);
  internals.add(fan);
  mk(new THREE.TorusGeometry(0.035, 0.005, 8, 32), m.rubber, { parent: fan });
  const blades = new THREE.Group();
  fan.add(blades);
  for (let i = 0; i < 7; i++) {
    const b = mk(new THREE.BoxGeometry(0.004, 0.028, 0.012), m.rubber, { parent: blades });
    const a = (i / 7) * PI * 2;
    b.position.set(Math.cos(a) * 0.017, Math.sin(a) * 0.017, 0);
    b.rotation.set(0.5, 0, a + PI / 2);
  }

  // ---------------- anchors for annotations ----------------
  const anchor = (id: string, parent: THREE.Object3D, p: [number, number, number], n?: [number, number, number]) => {
    const o = new THREE.Object3D();
    o.position.set(...p);
    parent.add(o);
    anchors.push({ id, obj: o, normal: n ? new THREE.Vector3(...n) : undefined });
  };
  anchor('screen', consoleG, [0.025, 0.66, 0.25], [0, 0, 1]);
  anchor('estop', estop, [0, 0, 0.04], [0, 0, 1]);
  anchor('cables', body, [-0.31, 0.22, 0], [-1, 0, 0]);
  anchor('trolley', trolley, [0, 0.13, -0.17]);
  anchor('wheel', body, [-0.37, 0.09, -0.17], [-1, 0, 0]);

  // ---------------- animation state ----------------
  let trolleyT = 1, trolleyTarget = 1;
  let estopT = 0, estopTarget = 0;
  let exT = 0, exTarget = 0;
  let knobSpin = 0;
  const knobRot = { v: 0 };
  let time = 0;

  const ease = (x: number) => x * x * (3 - 2 * x);

  return {
    group: root,
    anchors,
    pickables,
    setTrolley: (e) => { trolleyTarget = e ? 1 : 0; },
    setEStop: (on) => {
      estopTarget = on ? 1 : 0;
      screen.estop = on;
      screen.refresh();
    },
    setExploded: (on) => { exTarget = on ? 1 : 0; },
    spinKnob: () => (knobSpin += PI / 3),
    update: (dt) => {
      time += dt;
      const k = 1 - Math.exp(-dt * 6);
      trolleyT += (trolleyTarget - trolleyT) * k;
      estopT += (estopTarget - estopT) * (1 - Math.exp(-dt * 18));
      exT += (exTarget - exT) * (1 - Math.exp(-dt * 4));
      knobRot.v += (knobSpin - knobRot.v) * k;
      knob.rotation.z = -knobRot.v;

      const e = ease(Math.min(1, Math.max(0, exT)));
      lid.position.y = e * 0.52;
      consoleG.position.z = e * 0.22;
      lowerG.position.z = e * 0.11;
      sideG.position.x = -e * 0.12;
      cableG.position.x = -e * 0.06;
      internals.visible = e > 0.01;
      internals.position.y = 0.36 + e * 0.46;
      internals.scale.setScalar(0.85 + e * 0.15);
      blades.rotation.z += dt * 18 * e;

      trolley.position.y = 0.75 + ease(trolleyT) * 0.3 + e * 0.52;
      estopCap.position.z = -estopT * 0.009;
      estopCap.rotation.z = estopT * 0.25;

      // emissive pulse on LED strips
      m.ledCyan.emissiveIntensity = estopTarget ? 0.6 : 1.5 + Math.sin(time * 2.2) * 0.35;
      screen.update(dt);
    },
  };
}
