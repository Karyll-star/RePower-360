/* ============================================================================
   Re-Energy 工业产品 3D 展示 — 主程序
   ========================================================================== */
(function (RE) {
  'use strict';
  var T = THREE;

  var state = {
    preset: 0, focus: 'all', view: 'iso', mount: 'magnet',
    explode: 0, labels: true, dims: false, wire: false, auto: true
  };

  var scene, camera, renderer, orbit, world;
  var pulsePivot, bridgePivot, pulse, bridge;
  var pulseList = [], bridgeList = [];
  var parts = null, dims = null;             // 标注实例
  var allMats = [];

  var VIEWS = {
    iso:   { t: -0.62, p: 1.10, r: 1.00 },
    front: { t: 0.00,  p: 1.34, r: 0.94 },
    side:  { t: -Math.PI / 2, p: 1.30, r: 0.86 },
    top:   { t: -0.62, p: 0.30, r: 1.06 },
    back:  { t: Math.PI, p: 1.28, r: 0.94 }
  };
  var FOCUS = {
    all:    { target: [-0.44, 0.43, 0.00], r: 2.05 },
    pulse:  { target: [-0.14, 0.44, 0.00], r: 1.85 },
    bridge: { target: [-0.02, 0.10, 0.00], r: 0.42 }
  };

  /* ------------------------------------------------------------------ 工具 */
  function disposeTree(root) {
    root.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
    });
  }
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

  /* 右侧卷线仓门：随爆炸程度滑开，便于检视卷线轮（平时保持关闭） */
  var reelDoor = null;
  function applyReelDoor(t) {
    if (!reelDoor) return;
    reelDoor.position.lerpVectors(reelDoor.userData.closed, reelDoor.userData.open, RE.clamp(t * 1.6, 0, 1));
  }

  /* ------------------------------------------------------------------ 场景 */
  function initScene() {
    var canvas = document.getElementById('gl');
    renderer = new T.WebGLRenderer({
      canvas: canvas, antialias: true, alpha: true, preserveDrawingBuffer: true
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.34;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;

    scene = new T.Scene();
    scene.fog = new T.Fog(0x0b0f14, 4.2, 13.5);

    camera = new T.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.03, 120);
    orbit = new RE.Orbit(camera, renderer.domElement);
    orbit.autoRotate = state.auto;

    RE.buildEnvironment(renderer, scene);
    RE.buildLights(scene);
    RE.buildPodium(scene);

    world = new T.Group();
    world.scale.setScalar(RE.MM);          // mm → m
    scene.add(world);

    parts = new RE.Labels(document.getElementById('labels'));
    dims = new RE.Labels(document.getElementById('dims'));

    window.addEventListener('resize', onResize);
    setView(state.view, true);
  }

  function onResize() {
    var w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  /* ------------------------------------------------------------------ 建模 */
  function build() {
    if (pulsePivot) { world.remove(pulsePivot); disposeTree(pulsePivot); }
    if (bridgePivot) { world.remove(bridgePivot); disposeTree(bridgePivot); }

    var preset = RE.PRESETS[state.preset];
    pulse = RE.buildRepulse(preset.repulse);
    bridge = RE.buildRebridge(preset.bridge);

    pulsePivot = new T.Group();
    pulsePivot.add(pulse.group);
    world.add(pulsePivot);

    bridgePivot = new T.Group();
    bridgePivot.add(bridge.group);
    world.add(bridgePivot);

    pulseList = collectExplode(pulse.group);
    bridgeList = collectExplode(bridge.group);
    pulse.group.traverse(function (o) { if (o.name === 'ReelDoor') reelDoor = o; });

    allMats = [];
    world.traverse(function (o) {
      if (o.material) {
        var ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach(function (m) {
          if (!(m && m.isMaterial)) throw new Error('bad material: ' + o.type + '/' + o.name + ' -> ' + m);
          if (allMats.indexOf(m) < 0) allMats.push(m);
        });
      }
    });
    allMats.forEach(function (m) { m.wireframe = state.wire; });

    layout();
    applyExplode(pulseList, state.explode);
    applyExplode(bridgeList, state.explode);
    applyReelDoor(state.explode);
    refreshLabels();
  }

  function pulseFloor() { return -pulse.size.floorY; }
  function bridgeFloor() {
    return -bridge.size.floorY[state.mount === 'din' ? 'din' : 'magnet'];
  }

  function layout() {
    var f = state.focus;
    pulsePivot.visible = f !== 'bridge';
    bridgePivot.visible = f !== 'pulse';
    bridge.bases.magnet.visible = state.mount === 'magnet';
    bridge.bases.din.visible = state.mount === 'din';

    var pf = pulseFloor(), bf = bridgeFloor();
    if (f === 'pulse') {
      pulsePivot.position.set(0, pf, 40);
      pulsePivot.rotation.y = -0.30;
      bridgePivot.position.set(1600, bf, -200);
    } else if (f === 'bridge') {
      bridgePivot.position.set(0, bf, 30);
      bridgePivot.rotation.y = -0.34;
      pulsePivot.position.set(-2600, pf, 0);
    } else {
      pulsePivot.position.set(-310, pf, 30);
      bridgePivot.position.set(430, bf, 120);
      pulsePivot.rotation.y = -0.30;
      bridgePivot.rotation.y = -0.26;
    }
    orbit.goalTarget.set(FOCUS[f].target[0], FOCUS[f].target[1], FOCUS[f].target[2]);
  }

  /* ------------------------------------------------------------------ 标注 */
  function refreshLabels() {
    clearDims();                                  /* 先清掉旧的尺寸线，避免重复叠加 */
    var show = state.labels && state.explode < 0.04;
    parts.host.style.display = show ? 'block' : 'none';
    if (show) {
      function pri(list) { return list.filter(function (l) { return l.primary; }); }
      if (state.focus === 'bridge') parts.set(bridge.labels, bridge.group, 'bridge');
      else if (state.focus === 'pulse') parts.set(pulse.labels, pulse.group, 'pulse');
      else {
        parts.set(pri(pulse.labels), pulse.group, 'pulse');
        parts.add(pri(bridge.labels), bridge.group, 'bridge');
      }
    }
    /* 尺寸标注 */
    if (state.dims) {
      var f2 = state.focus;
      var grp = (f2 === 'bridge') ? bridge : pulse;
      var dim = RE.buildDimensions(grp.size, { vertical: grp === pulse });
      grp.group.add(dim.group);
      dims.host.style.display = 'block';
      dims.set(dim.anchors, grp.group, 'dim');
    } else {
      dims.host.style.display = 'none';
      dims.clear();
    }
  }

  function clearDims() {
    /* 移除已挂载的尺寸线 */
    [pulse, bridge].forEach(function (p) {
      if (!p) return;
      var rm = [];
      p.group.traverse(function (o) { if (o.isLineSegments) rm.push(o); });
      rm.forEach(function (o) { o.parent.remove(o); o.geometry.dispose(); });
    });
  }

  function setDims(on) {
    state.dims = on;
    clearDims();
    refreshLabels();
  }

  /* ------------------------------------------------------------------ 视角 */
  function setView(name, instant) {
    state.view = name;
    var v = VIEWS[name] || VIEWS.iso;
    var f = FOCUS[state.focus];
    var ex = state.explode || 0;
    /* 爆炸时自动拉远 + 抬高机位，让拆件层级从上方读得清楚 */
    orbit.setView(
      v.t, RE.clamp(v.p - 0.34 * ex, 0.26, 1.55),
      f.r * v.r * (state.zoom || 1) * (1 + 0.80 * ex),
      [f.target[0], f.target[1] + 0.12 * ex, f.target[2]]
    );
    if (instant) {
      orbit.sph.theta = orbit.goal.theta;
      orbit.sph.phi = orbit.goal.phi;
      orbit.sph.radius = orbit.goal.radius;
      orbit.target.copy(orbit.goalTarget);
    }
    syncButtons('[data-key="view"]', name);
  }

  function setFocus(name) {
    state.focus = name;
    clearDims();
    layout();
    refreshLabels();
    setView(state.view, false);
    syncButtons('[data-key="focus"]', name);
  }

  /* ------------------------------------------------------------------ UI */
  function syncButtons(sel, val) {
    var box = document.querySelector(sel);
    if (!box) return;
    Array.prototype.forEach.call(box.children, function (b) {
      b.classList.toggle('on', b.getAttribute('data-v') === val);
    });
  }

  function initUI() {
    /* 分段按钮 */
    document.querySelectorAll('.seg').forEach(function (box) {
      box.addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        var key = box.getAttribute('data-key');
        var v = b.getAttribute('data-v');
        if (key === 'view') setView(v);
        else if (key === 'focus') setFocus(v);
        else if (key === 'mount') {
          state.mount = v;
          syncButtons('[data-key="mount"]', v);
          layout();
          setView(state.view, false);
        }
      });
    });
    /* 爆炸滑块 */
    var ex = document.getElementById('explode');
    ex.style.setProperty('--p', '0%');
    ex.addEventListener('input', function () {
      state.explode = parseInt(ex.value, 10) / 100;
      ex.style.setProperty('--p', ex.value + '%');
      applyExplode(pulseList, state.explode);
      applyExplode(bridgeList, state.explode);
      applyReelDoor(state.explode);
      document.getElementById('explode-val').textContent =
        (state.explode > 0.02 ? Math.round(state.explode * 100) + '%' : '装配态');
      setView(state.view, false);
      if (state.explode > 0.04 && state.labels) {
        parts.host.style.display = 'none';
      } else refreshLabels();
    });
    /* 开关 */
    function sw(id, fn) {
      var el = document.getElementById(id);
      el.addEventListener('change', function () { fn(el.checked); });
    }
    sw('sw-labels', function (v) { state.labels = v; refreshLabels(); });
    sw('sw-dims', function (v) { setDims(v); });
    sw('sw-wire', function (v) {
      state.wire = v;
      allMats.forEach(function (m) { m.wireframe = v; });
    });
    sw('sw-auto', function (v) { state.auto = v; orbit.autoRotate = v; });

    /* 尺寸方案 */
    var sel = document.getElementById('preset');
    RE.PRESETS.forEach(function (p, i) {
      var o = document.createElement('option');
      o.value = String(i); o.textContent = p.name;
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () {
      state.preset = parseInt(sel.value, 10) || 0;
      document.getElementById('preset-note').textContent = RE.PRESETS[state.preset].note;
      clearDims();
      build();
      setView(state.view, false);
    });
    document.getElementById('preset-note').textContent = RE.PRESETS[0].note;

    /* 导出 */
    document.getElementById('shot').addEventListener('click', shot);

    /* 快捷键 */
    window.addEventListener('keydown', function (e) {
      if (e.code === 'Space') {
        e.preventDefault();
        state.auto = !state.auto;
        orbit.autoRotate = state.auto;
        document.getElementById('sw-auto').checked = state.auto;
      } else if (e.key === '1') setView('iso');
      else if (e.key === '2') setView('front');
      else if (e.key === '3') setView('side');
      else if (e.key === '4') setView('top');
      else if (e.key === 'e' || e.key === 'E') {
        ex.value = state.explode > 0.02 ? '0' : '70';
        ex.dispatchEvent(new Event('input'));
      }
    });
  }

  /* 导出 PNG（带影棚背景合成） */
  function shot() {
    var w = renderer.domElement.width, h = renderer.domElement.height;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    var g = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.78);
    g.addColorStop(0, '#28323a');
    g.addColorStop(0.38, '#151b21');
    g.addColorStop(0.72, '#0a0e12');
    g.addColorStop(1, '#05070a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    renderer.render(scene, camera);
    ctx.drawImage(renderer.domElement, 0, 0);
    var a = document.createElement('a');
    a.download = 'RE-Energy_Re-Pulse_Re-Bridge_3D_' + Date.now() + '.png';
    a.href = c.toDataURL('image/png');
    a.click();
  }

  /* ------------------------------------------------------------------ 主循环 */
  var clock;
  function loop() {
    var dt = Math.min(0.06, clock.getDelta());
    orbit.spin(dt);
    orbit.update(dt);
    var size = { w: renderer.domElement.clientWidth, h: renderer.domElement.clientHeight };
    if (state.labels && state.explode < 0.04) parts.update(camera, size);
    if (state.dims) dims.update(camera, size);
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  /* ------------------------------------------------------------------ 启动 */
  /* 支持 URL 参数，便于批量出图 / 嵌入展示：
     ?focus=pulse|bridge|all&view=iso|front|side|top|back&preset=0|1
     &mount=magnet|din&explode=0..1&labels=0|1&dims=0|1&wire=0|1&auto=0|1&ui=0  */
  function parseQuery() {
    var q = {};
    location.search.replace(/^\?/, '').split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('=');
      q[decodeURIComponent(i < 0 ? kv : kv.slice(0, i))] = i < 0 ? '1' : decodeURIComponent(kv.slice(i + 1));
    });
    if (q.focus && FOCUS[q.focus]) state.focus = q.focus;
    if (q.view && VIEWS[q.view]) state.view = q.view;
    if (q.preset != null) state.preset = RE.clamp(parseInt(q.preset, 10) || 0, 0, RE.PRESETS.length - 1);
    if (q.mount === 'din' || q.mount === 'magnet') state.mount = q.mount;
    if (q.explode != null) state.explode = RE.clamp(parseFloat(q.explode) || 0, 0, 1);
    if (q.labels === '0') state.labels = false;
    if (q.dims === '1') state.dims = true;
    if (q.wire === '1') state.wire = true;
    if (q.auto === '0') state.auto = false;
    if (q.zoom) state.zoom = RE.clamp(parseFloat(q.zoom) || 1, 0.15, 3);
    if (q.ty) FOCUS[state.focus].target[1] = parseFloat(q.ty);
    if (q.ui === '0') {
      ['panel', 'specs', 'topbar', 'hint'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });
    }
    return q;
  }

  function syncUI() {
    syncButtons('[data-key="focus"]', state.focus);
    syncButtons('[data-key="view"]', state.view);
    syncButtons('[data-key="mount"]', state.mount);
    document.getElementById('sw-labels').checked = state.labels;
    document.getElementById('sw-dims').checked = state.dims;
    document.getElementById('sw-wire').checked = state.wire;
    document.getElementById('sw-auto').checked = state.auto;
    var ex = document.getElementById('explode');
    ex.value = String(Math.round(state.explode * 100));
    ex.style.setProperty('--p', ex.value + '%');
    document.getElementById('explode-val').textContent =
      (state.explode > 0.02 ? Math.round(state.explode * 100) + '%' : '装配态');
    document.getElementById('preset').value = String(state.preset);
    document.getElementById('preset-note').textContent = RE.PRESETS[state.preset].note;
  }

  function start() {
    initScene();
    parseQuery();
    build();
    initUI();
    syncUI();
    setView(state.view, true);
    orbit.autoRotate = state.auto;
    if (state.dims) setDims(true);
    else refreshLabels();
    clock = new T.Clock();
    loop();
    requestAnimationFrame(function () {
      var l = document.getElementById('loading');
      l.classList.add('done');
      setTimeout(function () { l.style.display = 'none'; }, 600);
    });
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(start, 0);
  } else {
    document.addEventListener('DOMContentLoaded', start);
  }

})(window.RE);
