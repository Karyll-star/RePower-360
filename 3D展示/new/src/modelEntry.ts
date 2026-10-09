/* ============================================================================
   把 TS 版新模型 + 影棚环境打包成浏览器可直接 <script> 引入的 IIFE 库
   输出： ../js/lib/remodel.js
   暴露： window.THREE（同一份 three 实例，避免双实例冲突）
          window.REMODEL = { 模型工厂 / 材质 / 屏幕 UI / 影棚 / 后处理 }
   ========================================================================== */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createMaterials } from './three/materials';
import { ScreenUI } from './three/screenUI';
import { buildRePulse } from './three/rePulse';
import { buildReBridge } from './three/reBridge';
import { canvasTexture, noiseTexture } from './three/helpers';
import backdropUrl from './assets/backdrop.jpg';

/* ---------------------------------------------------------------------------
   影棚：环境反射 + 背景 + 地面（真实镜面 + 抛光石材 + 接触阴影）+ 灯光
   与 Viewer.buildStage / buildLights 保持一致，保证新模型的观感一致
   --------------------------------------------------------------------------- */
function installStage(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.38;
  scene.environmentRotation.set(0, 0.6, 0);
  pmrem.dispose();

  let bgTex: THREE.Texture | null = null;
  new THREE.TextureLoader().load(backdropUrl, (t: THREE.Texture) => {
    t.colorSpace = THREE.SRGBColorSpace;
    bgTex = t;
    scene.background = t;
    scene.backgroundIntensity = 0.95;
  });
  scene.fog = new THREE.Fog(0x2a333d, 3.6, 9);

  const stoneMap = noiseTexture(512, 0.55, 0.55, 3);
  stoneMap.colorSpace = THREE.SRGBColorSpace;
  stoneMap.repeat.set(3, 2);
  const stoneRough = noiseTexture(512, 0.5, 0.4, 5);
  stoneRough.repeat.set(3, 2);

  const block = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 0.8, 2.6),
    new THREE.MeshStandardMaterial({
      color: 0x3a424c, map: stoneMap, roughness: 0.7, roughnessMap: stoneRough, metalness: 0.15,
    })
  );
  block.position.set(0, -0.401, -0.5);
  block.receiveShadow = true;
  scene.add(block);

  const pr = Math.min(window.devicePixelRatio, 2);
  const mirror = new Reflector(new THREE.PlaneGeometry(4.4, 2.6), {
    clipBias: 0.003,
    textureWidth: Math.floor(window.innerWidth * pr * 0.6),
    textureHeight: Math.floor(window.innerHeight * pr * 0.6),
    color: 0x8c9198,
  });
  mirror.rotation.x = -Math.PI / 2;
  mirror.position.set(0, 0, -0.5);
  const orig = mirror.onBeforeRender.bind(mirror);
  mirror.onBeforeRender = ((...args: any[]) => {
    const sc = args[1] as THREE.Scene;
    const bg = sc.background;
    const fog = sc.fog;
    sc.background = null;
    sc.fog = null;
    (orig as any)(...args);
    sc.background = bg;
    sc.fog = fog;
  }) as any;
  scene.add(mirror);

  const top = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 2.6),
    new THREE.MeshStandardMaterial({
      color: 0x323940, map: stoneMap, roughness: 0.38, roughnessMap: stoneRough,
      metalness: 0.2, transparent: true, opacity: 0.84,
    })
  );
  top.rotation.x = -Math.PI / 2;
  top.position.set(0, 0.0008, -0.5);
  top.receiveShadow = true;
  scene.add(top);

  const edge = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 0.008, 0.008),
    new THREE.MeshStandardMaterial({ color: 0xaab3bd, metalness: 0.9, roughness: 0.25 })
  );
  edge.position.set(0, -0.004, 0.8);
  scene.add(edge);

  const blob = canvasTexture(256, 256, (c: any, w: number, h: number) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.9)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.45)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });
  const blobMat = new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false, opacity: 0.75 });
  const contact = new THREE.Group();
  scene.add(contact);
  const b1 = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.75), blobMat);
  b1.rotation.set(-Math.PI / 2, 0, 0.42);
  b1.position.set(-0.33, 0.0012, -0.01);
  contact.add(b1);
  const b2 = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.28), blobMat);
  b2.rotation.set(-Math.PI / 2, 0, -0.36);
  b2.position.set(0.6, 0.0012, 0.26);
  contact.add(b2);

  const hemi = new THREE.HemisphereLight(0xa9bdd4, 0x15191f, 0.55);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xeef3ff, 2.4);
  key.position.set(-2.2, 3.6, 2.6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera;
  sc.left = -1.3; sc.right = 1.3; sc.top = 1.3; sc.bottom = -1.3; sc.near = 0.5; sc.far = 9;
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 5;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0xd2e6ff, 3.2);
  rim.position.set(-2.6, 2.8, -3.2);
  scene.add(rim);

  const fill = new THREE.DirectionalLight(0x8fa9c6, 0.7);
  fill.position.set(3, 1.4, 2.2);
  scene.add(fill);

  const spot = new THREE.SpotLight(0xffffff, 18, 6, 0.55, 1, 1.6);
  spot.position.set(-0.4, 2.6, 0.9);
  spot.target.position.set(-0.1, 0.3, 0.05);
  scene.add(spot, spot.target);

  const glow = new THREE.PointLight(0x38d6ff, 0.12, 0.8, 2);
  glow.position.set(-0.12, 0.58, 0.45);
  scene.add(glow);

  return {
    /** 单件模式：把接触阴影（一个即可）与灯位挪到产品所在位置 */
    solo(x: number, z: number) {
      contact.position.set(x, 0, z);
      key.target.position.set(x, 0.3, z);
      scene.add(key.target);
      spot.target.position.set(x, 0.3, z + 0.05);
      glow.position.set(x + 0.05, 0.58, z + 0.45);
    },
    fit(aspect: number) {
      const t = bgTex;
      if (!t || !(t as any).image) return;
      const img = (t as any).image as HTMLImageElement;
      const ia = img.width / img.height;
      t.matrixAutoUpdate = true;
      if (aspect > ia) {
        const s = ia / aspect;
        t.repeat.set(1, s);
        t.offset.set(0, (1 - s) * 0.42);
      } else {
        const s = aspect / ia;
        t.repeat.set(s, 1);
        t.offset.set((1 - s) / 2, 0);
      }
      t.needsUpdate = true;
    },
    contact,
  };
}

/* ---------------------------------------------------------------------------
   后处理：Bloom（LED 发光是新模型的标志性观感）
   --------------------------------------------------------------------------- */
function makeComposer(
  renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, w: number, h: number
) {
  const pr = renderer.getPixelRatio();
  const rt = new THREE.WebGLRenderTarget(w * pr, h * pr, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(pr);
  composer.setSize(w, h);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(w / 2, h / 2), 0.55, 0.55, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  return { composer, bloom };
}

const api = {
  THREE,
  OrbitControls,
  createMaterials,
  ScreenUI,
  buildRePulse,
  buildReBridge,
  canvasTexture,
  noiseTexture,
  backdropUrl,
  installStage,
  makeComposer,
};

(window as any).THREE = THREE;
(window as any).REMODEL = api;

export default api;
