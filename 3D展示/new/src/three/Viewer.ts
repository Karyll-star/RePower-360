import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import backdropUrl from '../assets/backdrop.jpg';
import { createMaterials } from './materials';
import { ScreenUI, ScreenMode } from './screenUI';
import { buildRePulse, RePulse, Anchor } from './rePulse';
import { buildReBridge, ReBridge } from './reBridge';
import { canvasTexture, noiseTexture } from './helpers';

export type ViewName = 'poster' | 'repulse' | 'screen' | 'cables' | 'bridge' | 'top' | 'free';
export type LightPreset = 'studio' | 'night' | 'lab' | 'dawn';

interface Preset {
  pos: THREE.Vector3;
  target: THREE.Vector3;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

const PRESETS: Record<Exclude<ViewName, 'free'>, Preset> = {
  poster: { pos: V(0.42, 0.66, 2.75), target: V(0.16, 0.4, 0.05) },
  repulse: { pos: V(-0.62, 0.78, 1.5), target: V(-0.3, 0.42, 0.05) },
  screen: { pos: V(0.05, 0.6, 0.78), target: V(-0.2, 0.56, 0.21) },
  cables: { pos: V(-1.22, 0.42, 0.6), target: V(-0.57, 0.26, 0.11) },
  bridge: { pos: V(0.86, 0.34, 0.92), target: V(0.6, 0.1, 0.26) },
  top: { pos: V(0.15, 2.3, 1.65), target: V(0.1, 0.2, 0.05) },
};

export interface ViewerCallbacks {
  onAction?: (action: string) => void;
  onUserOrbit?: () => void;
}

export class Viewer {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  pulse: RePulse;
  bridge: ReBridge;
  screen: ScreenUI;
  private container: HTMLElement;
  private cb: ViewerCallbacks;
  private raf = 0;
  private last = performance.now();
  private camGoal: Preset | null = null;
  private view: ViewName = 'poster';
  private autoRotate = false;
  private annotationEls = new Map<string, HTMLElement>();
  private anchors: Anchor[] = [];
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private downAt = { x: 0, y: 0 };
  private bgTex: THREE.Texture | null = null;
  private lights: {
    hemi: THREE.HemisphereLight;
    key: THREE.DirectionalLight;
    rim: THREE.DirectionalLight;
    fill: THREE.DirectionalLight;
    spot: THREE.SpotLight;
    glow: THREE.PointLight;
  };
  private ro: ResizeObserver;

  constructor(container: HTMLElement, cb: ViewerCallbacks = {}) {
    this.container = container;
    this.cb = cb;
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;

    const r = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.setSize(w, h);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.9;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.setClearColor(0x161c24);
    container.appendChild(r.domElement);
    r.domElement.style.display = 'block';
    this.renderer = r;

    this.camera = new THREE.PerspectiveCamera(30, w / h, 0.05, 40);

    // environment reflections
    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.18;
    this.scene.environmentRotation.set(0, 0.6, 0);
    pmrem.dispose();

    // backdrop
    new THREE.TextureLoader().load(backdropUrl, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      this.bgTex = t;
      this.scene.background = t;
      this.scene.backgroundIntensity = 0.95;
      this.fitBackground();
    });
    this.scene.fog = new THREE.Fog(0x2a333d, 3.6, 9);

    // stage & lights
    this.buildStage();
    this.lights = this.buildLights();

    // products
    const mats = createMaterials();
    this.screen = new ScreenUI();
    this.pulse = buildRePulse(mats, this.screen);
    this.pulse.group.position.set(-0.32, 0.0015, 0);
    this.pulse.group.rotation.y = 0.42;
    this.scene.add(this.pulse.group);

    this.bridge = buildReBridge(mats);
    this.bridge.group.position.set(0.6, 0.0015, 0.26);
    this.bridge.group.rotation.y = -0.36;
    this.scene.add(this.bridge.group);

    this.anchors = [...this.pulse.anchors, ...this.bridge.anchors];

    // controls
    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 0.35;
    this.controls.maxDistance = 5;
    this.controls.maxPolarAngle = 1.48;
    this.controls.autoRotateSpeed = 0.8;
    let dragging = false;
    let notified = false;
    this.controls.addEventListener('start', () => {
      dragging = true;
      notified = false;
    });
    this.controls.addEventListener('end', () => (dragging = false));
    this.controls.addEventListener('change', () => {
      if (!dragging || notified) return;
      notified = true;
      this.camGoal = null;
      this.cb.onUserOrbit?.();
    });
    const p = this.framed(PRESETS.poster);
    this.camera.position.copy(p.pos);
    this.controls.target.copy(p.target);

    // post processing
    const pr = r.getPixelRatio();
    const rt = new THREE.WebGLRenderTarget(w * pr, h * pr, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(r, rt);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w / 2, h / 2), 0.25, 0.5, 0.98);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    // events
    r.domElement.addEventListener('pointerdown', this.onDown);
    r.domElement.addEventListener('pointerup', this.onUp);
    r.domElement.addEventListener('pointermove', this.onMove);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);

    this.loop();
  }

  // ---------------------------------------------------------------- stage
  private buildStage() {
    const s = this.scene;
    const stoneMap = noiseTexture(512, 0.55, 0.55, 3);
    stoneMap.colorSpace = THREE.SRGBColorSpace;
    stoneMap.repeat.set(16, 12);
    const stoneRough = noiseTexture(512, 0.5, 0.4, 5);
    stoneRough.repeat.set(16, 12);

    const sideMat = new THREE.MeshStandardMaterial({ color: 0x3a424c, map: stoneMap, roughness: 0.7, roughnessMap: stoneRough, metalness: 0.15 });
    const block = new THREE.Mesh(new THREE.BoxGeometry(24, 0.8, 16), sideMat);
    block.position.set(0, -0.401, -0.5);
    block.receiveShadow = true;
    s.add(block);

    // real-time mirror reflection, background suppressed so only products reflect
    const pr = Math.min(window.devicePixelRatio, 2);
    const mirror = new Reflector(new THREE.PlaneGeometry(24, 16), {
      clipBias: 0.003,
      textureWidth: Math.floor(window.innerWidth * pr * 0.6),
      textureHeight: Math.floor(window.innerHeight * pr * 0.6),
      color: 0x2f343a,
    });
    mirror.rotation.x = -Math.PI / 2;
    mirror.position.set(0, 0.0, -0.5);
    const orig = mirror.onBeforeRender.bind(mirror);
    mirror.onBeforeRender = ((...args: Parameters<THREE.Object3D['onBeforeRender']>) => {
      const sc = args[1];
      const bg = sc.background;
      const fog = sc.fog;
      sc.background = null;
      sc.fog = null;
      orig(...args);
      sc.background = bg;
      sc.fog = fog;
    }) as THREE.Object3D['onBeforeRender'];
    s.add(mirror);

    // polished stone veil over the mirror (gives satin, partially reflective finish + shadows)
    const topMat = new THREE.MeshStandardMaterial({
      color: 0x323940,
      map: stoneMap,
      roughness: 0.72,
      roughnessMap: stoneRough,
      metalness: 0.03,
      transparent: true,
      opacity: 0.95,
    });
    const top = new THREE.Mesh(new THREE.PlaneGeometry(24, 16), topMat);
    top.rotation.x = -Math.PI / 2;
    top.position.set(0, 0.0008, -0.5);
    top.receiveShadow = true;
    s.add(top);

    // bright machined front edge
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(24, 0.008, 0.008),
      new THREE.MeshStandardMaterial({ color: 0xaab3bd, metalness: 0.9, roughness: 0.25 })
    );
    edge.position.set(0, -0.004, 7.5);
    s.add(edge);

    // soft contact shadows
    const blob = canvasTexture(256, 256, (c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(0,0,0,0.9)');
      g.addColorStop(0.55, 'rgba(0,0,0,0.45)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    });
    const blobMat = new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false, opacity: 0.75 });
    const b1 = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.75), blobMat);
    b1.rotation.set(-Math.PI / 2, 0, 0.42);
    b1.position.set(-0.33, 0.0012, -0.01);
    s.add(b1);
    const b2 = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.28), blobMat);
    b2.rotation.set(-Math.PI / 2, 0, -0.36);
    b2.position.set(0.6, 0.0012, 0.26);
    s.add(b2);
  }

  private buildLights() {
    const s = this.scene;
    const hemi = new THREE.HemisphereLight(0xa9bdd4, 0x15191f, 0.5);
    s.add(hemi);

    const key = new THREE.DirectionalLight(0xeef3ff, 2.0);
    key.position.set(-2.2, 3.6, 2.6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera;
    sc.left = -1.3;
    sc.right = 1.3;
    sc.top = 1.3;
    sc.bottom = -1.3;
    sc.near = 0.5;
    sc.far = 9;
    key.shadow.bias = -0.0002;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 5;
    s.add(key);

    const rim = new THREE.DirectionalLight(0xd2e6ff, 1.2);
    rim.position.set(-2.6, 2.8, -3.2);
    s.add(rim);

    const fill = new THREE.DirectionalLight(0x8fa9c6, 0.6);
    fill.position.set(3, 1.4, 2.2);
    s.add(fill);

    const spot = new THREE.SpotLight(0xffffff, 9, 6, 0.55, 1, 1.6);
    spot.position.set(-0.4, 2.6, 0.9);
    spot.target.position.set(-0.1, 0.3, 0.05);
    s.add(spot, spot.target);

    const glow = new THREE.PointLight(0x38d6ff, 0.12, 0.8, 2);
    glow.position.set(-0.12, 0.58, 0.45);
    s.add(glow);

    return { hemi, key, rim, fill, spot, glow };
  }

  // ---------------------------------------------------------------- api
  setView(v: ViewName) {
    this.view = v;
    this.controls.autoRotate = this.autoRotate && v === 'free';
    if (v === 'free') return;
    this.camGoal = this.framed(PRESETS[v]);
  }

  setAutoRotate(on: boolean) {
    this.autoRotate = on;
    this.controls.autoRotate = on && this.view === 'free';
  }

  setLighting(p: LightPreset) {
    const L = this.lights;
    const cfg: Record<LightPreset, { env: number; exp: number; hemi: [number, number]; key: [number, number]; rim: [number, number]; fill: [number, number]; spot: number; bg: number; bloom: number }> = {
      studio: { env: 0.18, exp: 0.9, hemi: [0xa9bdd4, 0.5], key: [0xeef3ff, 2.0], rim: [0xd2e6ff, 1.2], fill: [0x8fa9c6, 0.6], spot: 9, bg: 0.95, bloom: 0.25 },
      night: { env: 0.12, exp: 0.92, hemi: [0x4a6a96, 0.25], key: [0x7aa7ff, 1.0], rim: [0x56d8ff, 2.6], fill: [0x2a4a7a, 0.4], spot: 8, bg: 0.45, bloom: 0.5 },
      lab: { env: 0.4, exp: 1.0, hemi: [0xffffff, 0.7], key: [0xffffff, 2.2], rim: [0xffffff, 1.4], fill: [0xe8eef5, 1.0], spot: 10, bg: 1.0, bloom: 0.2 },
      dawn: { env: 0.22, exp: 0.95, hemi: [0xd8c3a8, 0.5], key: [0xffd2a1, 2.2], rim: [0xff9d5c, 1.8], fill: [0x7f9cc4, 0.8], spot: 12, bg: 0.85, bloom: 0.3 },
    };
    const c = cfg[p];
    this.scene.environmentIntensity = c.env;
    this.renderer.toneMappingExposure = c.exp;
    L.hemi.color.setHex(c.hemi[0]);
    L.hemi.intensity = c.hemi[1];
    L.key.color.setHex(c.key[0]);
    L.key.intensity = c.key[1];
    L.rim.color.setHex(c.rim[0]);
    L.rim.intensity = c.rim[1];
    L.fill.color.setHex(c.fill[0]);
    L.fill.intensity = c.fill[1];
    L.spot.intensity = c.spot;
    this.scene.backgroundIntensity = c.bg;
    this.bloom.strength = c.bloom;
  }

  setScreenMode(m: ScreenMode) {
    this.screen.mode = m;
    this.screen.refresh();
  }

  registerAnnotation(id: string, el: HTMLElement | null) {
    if (el) this.annotationEls.set(id, el);
    else this.annotationEls.delete(id);
  }

  screenshot(): string {
    this.composer.render();
    return this.renderer.domElement.toDataURL('image/png');
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    const d = this.renderer.domElement;
    d.removeEventListener('pointerdown', this.onDown);
    d.removeEventListener('pointerup', this.onUp);
    d.removeEventListener('pointermove', this.onMove);
    this.controls.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    d.remove();
  }

  // ---------------------------------------------------------------- internals
  private framed(p: Preset): Preset {
    const aspect = this.camera.aspect;
    const target = p.target.clone();
    const k = aspect < 1.55 ? Math.min(2.3, 1.55 / aspect) : 1;
    if (p === PRESETS.poster && aspect < 1.2) target.x = 0.05;
    const pos = target.clone().add(p.pos.clone().sub(p.target).multiplyScalar(k));
    return { pos, target };
  }

  private fitBackground() {
    const t = this.bgTex;
    if (!t || !t.image) return;
    const img = t.image as HTMLImageElement;
    const ia = img.width / img.height;
    const ca = this.camera.aspect;
    t.matrixAutoUpdate = true;
    if (ca > ia) {
      const s = ia / ca;
      t.repeat.set(1, s);
      t.offset.set(0, (1 - s) * 0.42);
    } else {
      const s = ca / ia;
      t.repeat.set(s, 1);
      t.offset.set((1 - s) / 2, 0);
    }
    t.needsUpdate = true;
  }

  private resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w / 2, h / 2);
    this.fitBackground();
    if (this.view !== 'free') this.camGoal = this.framed(PRESETS[this.view as Exclude<ViewName, 'free'>]);
  }

  private pick(e: PointerEvent): { action: string; obj: THREE.Object3D } | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects([this.pulse.group, this.bridge.group], true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        if (o.userData.action) return { action: o.userData.action as string, obj: o };
        o = o.parent;
      }
      return null; // first opaque hit without action blocks
    }
    return null;
  }

  private onDown = (e: PointerEvent) => {
    this.downAt = { x: e.clientX, y: e.clientY };
  };

  private onUp = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y) > 5) return;
    const hit = this.pick(e);
    if (!hit) return;
    if (hit.action === 'knob') this.pulse.spinKnob(hit.obj);
    this.cb.onAction?.(hit.action);
  };

  private hoverAcc = 0;
  private onMove = (e: PointerEvent) => {
    const now = performance.now();
    if (now - this.hoverAcc < 60 || e.buttons) return;
    this.hoverAcc = now;
    const hit = this.pick(e);
    const interactive = hit && ['estop', 'trolley', 'knob', 'button', 'screen', 'antenna'].includes(hit.action);
    this.renderer.domElement.style.cursor = interactive ? 'pointer' : 'grab';
  };

  private tmpV = new THREE.Vector3();
  private tmpN = new THREE.Vector3();
  private tmpQ = new THREE.Quaternion();
  private updateAnnotations() {
    if (!this.annotationEls.size) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    for (const a of this.anchors) {
      const el = this.annotationEls.get(a.id);
      if (!el) continue;
      a.obj.getWorldPosition(this.tmpV);
      let visible = true;
      if (a.normal) {
        a.obj.getWorldQuaternion(this.tmpQ);
        this.tmpN.copy(a.normal).applyQuaternion(this.tmpQ);
        const toCam = this.camera.position.clone().sub(this.tmpV).normalize();
        visible = this.tmpN.dot(toCam) > 0.12;
      }
      const p = this.tmpV.project(this.camera);
      if (p.z > 1 || Math.abs(p.x) > 1.05 || Math.abs(p.y) > 1.05) visible = false;
      const x = (p.x * 0.5 + 0.5) * w;
      const y = (-p.y * 0.5 + 0.5) * h;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      el.style.opacity = visible ? '1' : '0';
      el.style.pointerEvents = visible ? 'auto' : 'none';
    }
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;

    if (this.camGoal) {
      const k = 1 - Math.exp(-dt * 3.2);
      this.camera.position.lerp(this.camGoal.pos, k);
      this.controls.target.lerp(this.camGoal.target, k);
      if (this.camera.position.distanceTo(this.camGoal.pos) < 0.002 && this.controls.target.distanceTo(this.camGoal.target) < 0.002) this.camGoal = null;
    }

    this.pulse.update(dt);
    this.bridge.update(dt);
    this.lights.glow.intensity = this.screen.estop ? 0.05 : 0.12;
    this.controls.update(dt);
    this.composer.render(dt);
    this.updateAnnotations();
  };
}
