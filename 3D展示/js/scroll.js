/* ============================================================================
   RE-PULSE 沉浸式滚动叙事（试水版）
   —— 滚动驱动机位编舞：Hero 漂移 → 360° 环绕 → 低角度冲锋 → 俯视爆炸
   复用 studio.js 的影棚环境 / 灯光 / 展台与 repulse.js 的产品模型
   ========================================================================== */
(function () {
  'use strict';
  var T = THREE;
  var RE = window.RE;
  var clamp = RE.clamp;

  var scene, camera, renderer, world;
  var pivot, pulse, explodeList = [];
  var clock;

  /* 滚动状态 */
  var p = 0, pRaw = 0, pMax = 1;          // 平滑进度 / 原始进度 / 最大进度
  var mouse = { x: 0, y: 0 }, mouseGoal = { x: 0, y: 0 };

  var elChapter = null, elRailFill = null, elChapIdx = null;
  var elAz = null, elEl = null, elD = null, elHint = null;
  var chaps = [];

  /* ==========================================================================
     分镜表
       w    = 该镜头占用的滚动长度权重（越大越"耐看"，直接决定滚多久）
       chap = 归属的章节文案（-1 = 该段无文案）
       dth  = 本镜头内方位角增量（累加，保证 360° 环绕连续不跳变）
       ease = 0 匀速推进 / 1 缓入缓出（机位在镜头末尾"落定"）
       fov  = 焦距，广角越大透视越夸张、力量感越强
     ========================================================================== */
  var TWO_PI = Math.PI * 2;
  var THETA0 = -0.62;
  var START = { phi: 1.10, radius: 2.05, ty: 0.44, ex: 0, fov: 38 };

  var SHOTS = [
    /* 00 Hero：3/4 视角，缓慢漂移拉近 */
    { n: 'HERO', chap: 0, w: 1.10, ease: 1.00, dth: -0.75,
      phi: 1.05,  radius: 1.82, ty: 0.44,  ex: 0,    fov: 38 },
    /* 01 Orbit：完整环绕一整圈 */
    { n: 'ORBIT', chap: 1, w: 2.40, ease: 0.25, dth: -TWO_PI,
      phi: 1.17,  radius: 1.90, ty: 0.42,  ex: 0,    fov: 38 },
    /* 02-A 下沉：压到轮轴高度 */
    { n: 'DESCEND', chap: 2, w: 1.00, ease: 0.85, dth: -0.55,
      phi: 1.470, radius: 1.32, ty: 0.300, ex: 0,    fov: 44 },
    /* 02-B 贴地慢推：力量感主镜头（最长的一段） */
    { n: 'CREEP', chap: 2, w: 2.10, ease: 0.12, dth: -0.44,
      phi: 1.505, radius: 1.04, ty: 0.255, ex: 0,    fov: 46 },
    /* 02-C 横摇：扫过轮组与支撑脚 */
    { n: 'SWEEP', chap: 2, w: 1.15, ease: 0.55, dth: -0.78,
      phi: 1.455, radius: 1.24, ty: 0.285, ex: 0,    fov: 42 },
    /* 03-A 拉升：升上头顶俯视，同步展开 */
    { n: 'RISE', chap: 3, w: 1.40, ease: 0.85, dth: -0.80,
      phi: 0.420, radius: 2.40, ty: 0.28,  ex: 0.72, fov: 38 },
    /* 03-B 俯视拆解：保持并完全展开 */
    { n: 'EXPLODE', chap: 3, w: 1.50, ease: 0.20, dth: -0.34,
      phi: 0.360, radius: 2.30, ty: 0.30,  ex: 1.00, fov: 36 },
    /* 收尾：回落半环，装配复位 */
    { n: 'OUTRO', chap: -1, w: 1.00, ease: 1.00, dth: -0.50,
      phi: 0.980, radius: 2.00, ty: 0.42,  ex: 0.08, fov: 38 }
  ];

  /* 章节文案可见区间 [start, end]（由分镜自动推导） */
  var CHAP_RANGES = [null, null, null, null];
  var FADE = 0.05;
  var KEYS = [];

  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

  /* 把权重展开成 [0,1] 上的关键帧时间轴 */
  (function buildTimeline() {
    var total = 0, i;
    for (i = 0; i < SHOTS.length; i++) total += SHOTS[i].w;
    var acc = 0, th = THETA0;
    KEYS.push({ at: 0, ease: 0, theta: th, phi: START.phi, radius: START.radius,
                ty: START.ty, ex: START.ex, fov: START.fov });
    for (i = 0; i < SHOTS.length; i++) {
      var s = SHOTS[i];
      th += s.dth;
      acc += s.w;
      s.t0 = (acc - s.w) / total;
      s.t1 = acc / total;
      KEYS.push({ at: s.t1, ease: s.ease, theta: th, phi: s.phi, radius: s.radius,
                  ty: s.ty, ex: s.ex, fov: s.fov });
    }
    for (i = 0; i < SHOTS.length; i++) {
      var c = SHOTS[i].chap;
      if (c < 0) continue;
      if (!CHAP_RANGES[c]) CHAP_RANGES[c] = [SHOTS[i].t0, SHOTS[i].t1];
      else {
        CHAP_RANGES[c][0] = Math.min(CHAP_RANGES[c][0], SHOTS[i].t0);
        CHAP_RANGES[c][1] = Math.max(CHAP_RANGES[c][1], SHOTS[i].t1);
      }
    }
    /* 首章从 -FADE 起算，保证 p=0 时文案已完全显示 */
    if (CHAP_RANGES[0]) CHAP_RANGES[0][0] = -FADE;
  })();

  function keyAt(prog) {
    var a = KEYS[0], b = KEYS[KEYS.length - 1];
    for (var i = 0; i < KEYS.length - 1; i++) {
      if (prog >= KEYS[i].at && prog <= KEYS[i + 1].at) {
        a = KEYS[i]; b = KEYS[i + 1]; break;
      }
    }
    var raw = clamp((prog - a.at) / Math.max(1e-6, b.at - a.at), 0, 1);
    var t = raw + (smooth(raw) - raw) * b.ease;
    return {
      theta: RE.lerp(a.theta, b.theta, t),
      phi: RE.lerp(a.phi, b.phi, t),
      radius: RE.lerp(a.radius, b.radius, t),
      ty: RE.lerp(a.ty, b.ty, t),
      ex: RE.lerp(a.ex, b.ex, t),
      fov: RE.lerp(a.fov, b.fov, t)
    };
  }

  /* ==========================================================================
     场景
     ========================================================================== */
  function initScene() {
    var canvas = document.getElementById('gl');
    renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.34;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;

    scene = new T.Scene();
    scene.fog = new T.Fog(0x050608, 4.2, 13.5);

    camera = new T.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.03, 120);

    RE.buildEnvironment(renderer, scene);
    RE.buildLights(scene);
    RE.buildPodium(scene);

    world = new T.Group();
    world.scale.setScalar(RE.MM);
    scene.add(world);

    window.addEventListener('resize', onResize);
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    measureScroll();
  }

  /* ==========================================================================
     产品（试水版仅 Re-Pulse，方便机位编舞聚焦）
     ========================================================================== */
  function collectExplode(root) {
    var list = [];
    root.traverse(function (o) {
      if (o.userData.explode) {
        o.userData._base = o.position.clone();
        list.push(o);
      }
    });
    return list;
  }

  function applyExplode(list, t) {
    for (var i = 0; i < list.length; i++) {
      var o = list[i], e = o.userData.explode;
      o.position.copy(o.userData._base).addScaledVector(e.dir, e.dist * t);
    }
  }

  /* 右侧卷线仓门：拆解段落滑开露出卷线轮，其余时间保持关闭 */
  var reelDoor = null;
  function applyReelDoor(t) {
    if (!reelDoor) return;
    reelDoor.position.lerpVectors(reelDoor.userData.closed, reelDoor.userData.open, RE.clamp(t * 1.6, 0, 1));
  }

  function buildProduct() {
    pulse = RE.buildRepulse(RE.PRESETS[0].repulse);
    pivot = new T.Group();
    pivot.add(pulse.group);
    /* 与主展示页 layout() 的 focus=pulse 布局一致：轮子落地 + 微转 */
    pivot.position.set(0, -pulse.size.floorY, 40);
    pivot.rotation.y = -0.30;
    world.add(pivot);
    explodeList = collectExplode(pulse.group);
    pulse.group.traverse(function (o) { if (o.name === 'ReelDoor') reelDoor = o; });
  }

  /* ==========================================================================
     交互与滚动
     ========================================================================== */
  function measureScroll() {
    var track = document.getElementById('track');
    pMax = Math.max(1, track.offsetHeight - window.innerHeight);
  }

  function bindInput() {
    window.addEventListener('scroll', function () {
      pRaw = clamp(window.scrollY / pMax, 0, 1);
    }, { passive: true });

    window.addEventListener('mousemove', function (e) {
      mouseGoal.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseGoal.y = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });

    /* 触摸端：滚动即可驱动机位 */
  }

  /* ==========================================================================
     DOM 缓存 + 每帧 UI 同步
     ========================================================================== */
  function cacheDom() {
    elChapter = document.getElementById('chapters');
    elRailFill = document.getElementById('rail-fill');
    elChapIdx = document.getElementById('chap-idx');
    elAz = document.getElementById('cam-az');
    elEl = document.getElementById('cam-el');
    elD = document.getElementById('cam-d');
    elHint = document.getElementById('scroll-hint');
    chaps = Array.prototype.map.call(elChapter.querySelectorAll('.chap'), function (el) { return el; });
  }

  function chapOpacity(i, prog) {
    var r = CHAP_RANGES[i];
    var inV = clamp((prog - r[0]) / FADE, 0, 1);
    var outV = clamp((r[1] - prog) / FADE, 0, 1);
    return Math.min(inV, outV);
  }

  function syncUI(cam) {
    /* 章节文案：透明度 + 轻微上移视差 */
    for (var i = 0; i < chaps.length; i++) {
      var op = chapOpacity(i, p);
      var el = chaps[i];
      el.style.opacity = op.toFixed(3);
      el.style.visibility = op <= 0.001 ? 'hidden' : 'visible';
      var drift = (1 - op) * 26 * (p < (CHAP_RANGES[i][0] + CHAP_RANGES[i][1]) / 2 ? 1 : -1);
      el.style.transform = 'translateY(calc(-50% + ' + drift.toFixed(1) + 'px))';
    }
    /* 进度轨道 + 章节序号 */
    elRailFill.style.height = (p * 100).toFixed(2) + '%';
    var idx = 1;
    for (var c = 0; c < CHAP_RANGES.length; c++) {
      if (CHAP_RANGES[c] && p >= CHAP_RANGES[c][0]) idx = c + 1;
    }
    var txt = '0' + idx + '<span>/ 04</span>';
    if (elChapIdx.innerHTML !== txt) elChapIdx.innerHTML = txt;
    /* 滚动提示 */
    elHint.style.opacity = p < 0.02 ? '1' : '0';
    /* 机位读数 */
    var az = ((-cam.theta * 180 / Math.PI) % 360 + 360) % 360;
    var elv = (90 - cam.phi * 180 / Math.PI);
    elAz.textContent = String(Math.round(az)).padStart(3, '0');
    elEl.textContent = (elv >= 0 ? '+' : '') + Math.round(elv);
    elD.textContent = cam.radius.toFixed(2);
  }

  /* ==========================================================================
     主循环
     ========================================================================== */
  function loop() {
    var dt = Math.min(0.06, clock.getDelta());

    /* 进度与鼠标平滑 */
    p += (pRaw - p) * (1 - Math.pow(0.001, dt));          // 帧率无关的阻尼
    mouse.x += (mouseGoal.x - mouse.x) * 0.05;
    mouse.y += (mouseGoal.y - mouse.y) * 0.05;

    var k = keyAt(p);

    /* 爆炸系数 */
    applyExplode(explodeList, k.ex);
    applyReelDoor(k.ex);

    /* 相机：球坐标 + 鼠标视差 */
    var theta = k.theta + mouse.x * 0.06;
    var phi = clamp(k.phi + mouse.y * 0.045, 0.12, 1.54);

    /* 焦距随分镜变化：贴地广角 → 透视夸张，力量感更强 */
    if (Math.abs(camera.fov - k.fov) > 0.01) {
      camera.fov = k.fov;
      camera.updateProjectionMatrix();
    }

    var sph = new T.Spherical(k.radius, phi, theta);
    camera.position.setFromSpherical(sph);
    camera.position.y += k.ty;
    camera.lookAt(0, k.ty, 0);

    syncUI({ theta: theta, phi: phi, radius: k.radius });

    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  /* ==========================================================================
     启动
     ========================================================================== */
  function start() {
    initScene();
    buildProduct();
    cacheDom();
    measureScroll();
    bindInput();
    pRaw = p = clamp(window.scrollY / pMax, 0, 1);
    clock = new T.Clock();
    loop();
    requestAnimationFrame(function () {
      var l = document.getElementById('loading');
      l.classList.add('done');
      setTimeout(function () { l.style.display = 'none'; }, 700);
    });
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(start, 0);
  } else {
    document.addEventListener('DOMContentLoaded', start);
  }
})();
