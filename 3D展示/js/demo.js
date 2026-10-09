/* ============================================================================
   RE-ENERGY · 产品使用演示 —— 代码驱动脚本化运镜渲染器
   时间线：INTRO → ORBIT → MOVE → GATEWAY → PROBE → ACTIVATE → RESULT → OUTRO
   渲染：three.js 离屏 WebGL → 2D 合成（HUD 字幕/数据）→ MediaRecorder → 上传
   ========================================================================== */
(function () {
  'use strict';
  var T = THREE, RE = window.RE;

  /* ---------------------------------------------------------------- 参数 */
  var Q = new URLSearchParams(location.search);
  var W = +(Q.get('w') || 1280);
  var H = +(Q.get('h') || 720);
  var FPS = +(Q.get('fps') || 30);
  var DUR = +(Q.get('dur') || 54);
  var IS_FILE = location.protocol === 'file:';      // 双击打开时改为下载而非上传
  /* http 下默认录制；file:// 下默认只预览，显式 ?rec=1 才录制 */
  var REC = Q.has('rec') ? (Q.get('rec') === '1') : !IS_FILE;
  var BR = +(Q.get('br') || 18e6);
  var NAME = Q.get('name') || 'repower-usage-demo.webm';
  var AUTO = Q.get('auto') !== '0';                 // 默认打开即播放
  var SEQ = Q.get('seq') === '1';                   // 逐帧出图模式（推荐用于出片）
  var PW = W, PH = H;                               // 物理输出尺寸（HUD 缩放前使用）

  /* ---------------------------------------------------------------- 工具 */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function seg(t, a, b) { return clamp((t - a) / (b - a), 0, 1); }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeIn(t) { return t * t * t; }
  function easeBack(t) { var c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function tc(t) { var s = Math.floor(t), f = Math.floor((t - s) * FPS); return pad2(Math.floor(s / 60)) + ':' + pad2(s % 60) + ':' + pad2(f); }

  /* ---------------------------------------------------------------- 渲染器 */
  var gl = document.createElement('canvas');
  gl.id = 'gl';
  document.body.appendChild(gl);

  var renderer = new T.WebGLRenderer({ canvas: gl, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;

  var scene = new T.Scene();
  scene.background = new T.Color(0x090d11);
  scene.fog = new T.Fog(0x090d11, 9, 30);

  var camera = new T.PerspectiveCamera(38, W / H, 0.05, 200);

  RE.buildEnvironment(renderer, scene);
  var keyLight = RE.buildLights(scene);
  keyLight.shadow.camera.left = -7; keyLight.shadow.camera.right = 7;
  keyLight.shadow.camera.top = 7; keyLight.shadow.camera.bottom = -3;
  keyLight.shadow.camera.far = 30;
  /* 高分辨率输出时提高阴影贴图，避免边缘锯齿 */
  keyLight.shadow.mapSize.set(W > 1280 ? 4096 : 2048, W > 1280 ? 4096 : 2048);
  keyLight.position.set(4.2, 6.4, 5.0);

  var world = new T.Group();
  world.scale.setScalar(RE.MM);
  scene.add(world);

  /* ---------------------------------------------------------------- 地坪 */
  (function () {
    var tex = RE.canvasTexture(1024, 1024, function (ctx, w, h) {
      ctx.fillStyle = '#333b42'; ctx.fillRect(0, 0, w, h);
      var img = ctx.getImageData(0, 0, w, h), d = img.data;
      for (var i = 0; i < d.length; i += 4) { var n = (Math.random() - 0.5) * 24; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
      ctx.putImageData(img, 0, 0);
      ctx.strokeStyle = 'rgba(255,255,255,.045)'; ctx.lineWidth = 2;
      for (var k = 0; k <= 8; k++) { var p = k * w / 8; ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, h); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(w, p); ctx.stroke(); }
      var g = ctx.createRadialGradient(w / 2, h / 2, w * 0.08, w / 2, h / 2, w * 0.60);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.9)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }, { repeat: [8, 8] });
    var m = new T.MeshStandardMaterial({ map: tex, roughness: 0.94, metalness: 0.04, color: 0xffffff });
    var gnd = new T.Mesh(new T.PlaneGeometry(70, 70), m);
    gnd.rotation.x = -Math.PI / 2; gnd.receiveShadow = true;
    scene.add(gnd);
  })();

  /* ---------------------------------------------------------------- 储能柜 */
  var CW = 1000, CH = 2000, CD = 880;          // 柜体 mm
  var matCab = new T.MeshStandardMaterial({ color: 0xd8dee3, roughness: 0.56, metalness: 0.14, envMapIntensity: 0.9 });
  var matCabD = new T.MeshStandardMaterial({ color: 0x22272c, roughness: 0.62, metalness: 0.30 });
  var matAlu = new T.MeshStandardMaterial({ color: 0xa8aeb4, roughness: 0.34, metalness: 1.0, envMapIntensity: 1.1 });
  var matModule = new T.MeshStandardMaterial({ color: 0x3b4249, roughness: 0.55, metalness: 0.35 });
  var cellBlocks = [];

  function buildCabinet(detailed) {
    var g = new T.Group();
    var hw = CW / 2, hh = CH / 2, hd = CD / 2;

    /* 背板 / 侧板 / 顶板 / 底板 */
    g.add(place(RE.rb(CW - 70, CH - 60, 40, 8, matCab, 3), 0, 0, -hd + 20));
    [1, -1].forEach(function (s) { g.add(place(RE.rb(40, CH - 60, CD - 40, 8, matCab, 3), s * (hw - 20), 0, 0)); });
    g.add(place(RE.rb(CW, 46, CD, 10, matCab, 3), 0, hh - 23, 0));
    g.add(place(RE.rb(CW, 46, CD, 10, matCab, 3), 0, -hh + 23, 0));
    /* 底座 */
    g.add(place(RE.rb(CW - 16, 130, CD - 16, 6, matCabD, 3), 0, -hh - 65, 0));
    /* 顶部指示灯 + 空调罩 */
    g.add(place(RE.rb(CW * 0.5, 60, CD * 0.4, 8, matCabD, 3), 0, hh + 30, -40));
    var beacon = new T.Mesh(new T.SphereGeometry(26, 16, 12), new T.MeshBasicMaterial({ color: 0xffc451, toneMapped: false }));
    beacon.position.set(CW * 0.34, hh + 62, -40); g.add(beacon);

    /* 内部：5 层 PACK 模组 + 电芯块 */
    if (detailed) {
      for (var i = 0; i < 5; i++) {
        var my = -620 + i * 330;
        var mod = new T.Group();
        mod.add(place(RE.rb(820, 270, 600, 10, matModule, 3), 0, my, -60));
        mod.add(place(RE.rb(830, 22, 40, 6, matAlu, 2), 0, my + 132, 235));
        for (var c = 0; c < 8; c++) {
          var cm = new T.MeshStandardMaterial({ color: 0x2b3137, roughness: 0.5, metalness: 0.4, emissive: 0x000000 });
          var cell = new T.Mesh(RE.roundedBoxGeometry(88, 150, 26, 7, 3), cm);
          cell.castShadow = true; cell.receiveShadow = true;
          cell.position.set(-350 + c * 100, my + 20, 262);
          mod.add(cell);
          cellBlocks.push({ mesh: cell, mat: cm, bad: false, fix: 0 });
        }
        /* 模组正面状态条 */
        var strip = new T.Mesh(new T.BoxGeometry(760, 8, 4), new T.MeshBasicMaterial({ color: 0x1f6f8f, toneMapped: false }));
        strip.position.set(0, my - 118, 276); mod.add(strip);
        g.add(mod);
      }

      /* 柜内 BMS 通讯端子盒：Re-Bridge 的 CAN/RS485 总线接入点 */
      var jb = new T.Group();
      jb.add(place(RE.rb(230, 155, 100, 8, matCabD, 3), 0, 0, 0));
      jb.add(place(RE.rb(210, 12, 10, 3, matAlu, 2), 0, 64, 50));
      for (var ti = 0; ti < 6; ti++) {
        var tm = new T.MeshStandardMaterial({
          color: ti % 2 ? 0x2f8f6a : 0x8a6a2a, roughness: 0.5, metalness: 0.3
        });
        jb.add(place(RE.rb(24, 36, 28, 4, tm, 2), -72 + ti * 29, 2, 52));
      }
      jb.position.set(-420, 720, 140);
      g.add(jb);
    } else {
      for (var j = 0; j < 4; j++) {
        g.add(place(RE.rb(820, 250, 560, 8, matCabD, 2), 0, -600 + j * 400, -60));
      }
    }

    /* 柜门（左侧铰链） */
    var doorPivot = new T.Group();
    doorPivot.position.set(-hw, 0, hd);
    var door = new T.Group();
    door.add(place(RE.rb(CW, CH - 36, 34, 9, matCab, 3), CW / 2, 0, 17));
    /* 门上 HMI */
    door.add(place(RE.plate(300, 200, 10, 14, matCabD, 1), CW / 2 + 150, 560, 36));
    var dscr = new T.Mesh(new T.PlaneGeometry(250, 150), new T.MeshBasicMaterial({ color: 0x0a1620, toneMapped: false }));
    dscr.position.set(CW / 2 + 150, 560, 45); door.add(dscr);
    /* 门把手 + 百叶散热 + 警示标 */
    door.add(place(RE.rb(46, 300, 40, 10, matAlu, 3), CW - 90, 60, 40));
    for (var v = 0; v < 7; v++) door.add(place(RE.rb(360, 12, 16, 4, matCabD, 2), CW / 2 + 60, -820 + v * 34, 32));
    var warn = RE.canvasTexture(512, 200, function (ctx, w, h) {
      ctx.fillStyle = '#e8b21c'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#15181b'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '700 62px ' + RE.FONT; ctx.fillText('⚡ 高压危险', w / 2, h * 0.32);
      ctx.font = '500 34px ' + RE.FONT; ctx.fillText('100kW / 215kWh 工商业储能柜', w / 2, h * 0.70);
    });
    var wm = new T.Mesh(new T.PlaneGeometry(420, 164), new T.MeshBasicMaterial({ map: warn, toneMapped: false }));
    wm.position.set(CW / 2 - 40, 200, 35); door.add(wm);
    doorPivot.add(door);
    g.add(doorPivot);

    return { group: g, doorPivot: doorPivot, beacon: beacon };
  }

  function place(o, x, y, z) { o.position.set(x, y, z); return o; }

  var cab = buildCabinet(true);
  cab.group.position.set(0, CH / 2 + 130, 0);
  world.add(cab.group);

  /* 背景柜阵列（纵深） */
  [[-3200, -4600, 0.06], [-1500, -5200, -0.04], [1900, -4900, 0.03], [3600, -4300, -0.08]].forEach(function (p) {
    var b = buildCabinet(false);
    b.group.position.set(p[0], CH / 2 + 130, p[1]);
    b.group.rotation.y = p[2];
    world.add(b.group);
  });

  /* ---------------------------------------------------------------- 产品 */
  /* 模型换成 new/src/three/{rePulse,reBridge}.ts：米制、原点在地面。
     demo 的场景是 mm，这里统一包一层换算容器，把米 → 毫米并对齐旋转中心。 */
  var RM = window.REMODEL;
  var NM = RM.createMaterials();
  var pulseUI = new RM.ScreenUI();

  var preset = RE.PRESETS[0];
  var M_TO_MM = 1000;

  /* mode: 'floor' 落地并水平居中（整机）/ 'center' 整体居中（网关，需绕自身翻滚） */
  function wrapModel(api, mode) {
    var inner = new T.Group();
    api.group.scale.setScalar(M_TO_MM);
    api.group.updateMatrixWorld(true);
    var b = new T.Box3().setFromObject(api.group);
    var c = b.getCenter(new T.Vector3());
    if (mode === 'floor') api.group.position.set(-c.x, -b.min.y, -c.z);
    else api.group.position.set(-c.x, -c.y, -c.z);
    inner.add(api.group);
    return { inner: inner, size: b.getSize(new T.Vector3()) };
  }

  /* 部件锚点 → 换算容器内的 mm 坐标 */
  function anchorMM(inner, api, id) {
    var a = null;
    for (var i = 0; i < api.anchors.length; i++) if (api.anchors[i].id === id) a = api.anchors[i];
    if (!a) return new T.Vector3();
    var v = new T.Vector3();
    a.obj.getWorldPosition(v);
    inner.updateMatrixWorld(true);
    return inner.worldToLocal(v);
  }

  var pulseApi = RM.buildRePulse(NM, pulseUI);
  /* 新模型建机时停在“拉杆收起”姿态（其 update 未被调用），这里先驱动一次让它展开，
     再据展开后的包围盒做落地 / 居中，避免拉杆顶被裁掉 */
  pulseApi.setTrolley(true);
  pulseApi.update(0.016);
  /* 拉杆节点（供调试读数） */
  var trolleyNode = (function () {
    var found = null;
    (function w(o) {
      if (o.userData && o.userData.action === 'trolley' &&
        !(o.parent && o.parent.userData && o.parent.userData.action === 'trolley')) found = o;
      for (var i = 0; i < o.children.length; i++) w(o.children[i]);
    })(pulseApi.group);
    return found;
  })();
  var pulseWrap = wrapModel(pulseApi, 'floor');
  var pulse = {
    group: pulseWrap.inner,
    size: { floorY: 0, W: pulseWrap.size.x, H: pulseWrap.size.y, D: pulseWrap.size.z, total: pulseWrap.size.y }
  };
  var pulseHolder = new T.Group();
  pulse.group.position.y = -pulse.size.floorY;
  pulse.group.rotation.y = -0.42;
  pulseHolder.add(pulse.group);
  /* 起始位放在柜体右前方（2600,1500），使环绕机位的整圈都不穿过柜体 AABB */
  pulseHolder.position.set(2600, 0, 1500);
  world.add(pulseHolder);

  /* 轮组：新模型里轮胎名为 'tire'，取其父组整体旋转（连轮辋/轮辐/胎块一起转） */
  var wheelGroups = [];
  pulseApi.group.traverse(function (o) {
    if (o.name === 'tire' && o.parent && wheelGroups.indexOf(o.parent) < 0) wheelGroups.push(o.parent);
  });

  /* 机身顶面（不含拉杆）—— 决定 Re-Bridge 的停机高度 */
  var BODY_TOP = (function () {
    var b = new T.Box3(), tb = new T.Box3();
    (function walk(o) {
      if (o.userData && o.userData.action === 'trolley') return;
      if (o.isMesh && o.geometry) { tb.setFromObject(o); b.union(tb); }
      for (var i = 0; i < o.children.length; i++) walk(o.children[i]);
    })(pulseApi.group);
    return b.isEmpty() ? pulseWrap.size.y * 0.55 : b.max.y;
  })();

  var UP = new T.Vector3(0, 1, 0);

  var bridgeApi = RM.buildReBridge(NM);
  var bridgeWrap = wrapModel(bridgeApi, 'center');
  var bridge = { group: bridgeWrap.inner };
  /* 初始姿态：平躺吸附在 Re-Pulse 顶部工作台（随机身移动），说明它的来源 */
  bridge.group.rotation.set(-Math.PI / 2, -0.30, 0);
  /* 指示光带贴着新模型的正面（锚点 bridge 就在状态光带处） */
  var brLed = anchorMM(bridgeWrap.inner, bridgeApi, 'bridge');
  var bridgeLed = new T.Mesh(
    new T.BoxGeometry(bridgeWrap.size.x * 0.60, 4, 3),
    new T.MeshBasicMaterial({ color: 0x2a3035, toneMapped: false })
  );
  bridgeLed.position.set(0, brLed.y, brLed.z + 5);
  bridge.group.add(bridgeLed);
  world.add(bridge.group);

  /* 机身停机位（世界 mm，随整机位置/朝向实时计算） */
  function bridgeDock() {
    var v = new T.Vector3(-90, BODY_TOP + 96, 20);
    v.applyAxisAngle(UP, pulse.group.rotation.y);
    v.add(pulseHolder.position);
    v.y += pulse.group.position.y;
    return v;
  }
  /* 部署点：柜内左壁，离地 1030mm（胸高，不再从柜顶飞过） */
  var BR_MOUNT = new T.Vector3(-440, 1030, 60);
  /* 用于构建静态导引弧线的停机位（MOVE 结束态） */
  var BR_DOCK0 = (function () {
    var v = new T.Vector3(-90, BODY_TOP + 96, 20);
    v.applyAxisAngle(UP, -0.30);
    v.add(new T.Vector3(860, 0, 620));
    v.y += pulse.group.position.y;
    return v;
  })();

  /* 飞行导引弧线：让"飞过去"这件事被明确读出来 */
  var guideCurve = new T.CatmullRomCurve3([
    BR_DOCK0.clone(),
    BR_DOCK0.clone().lerp(BR_MOUNT, 0.34).add(new T.Vector3(70, 200, 30)),
    BR_DOCK0.clone().lerp(BR_MOUNT, 0.72).add(new T.Vector3(-20, 130, 30)),
    BR_MOUNT.clone()
  ]);
  var guide = new T.Mesh(new T.TubeGeometry(guideCurve, 56, 2.6, 8, false),
    new T.MeshBasicMaterial({ color: 0x5fe0ff, transparent: true, opacity: 0, toneMapped: false }));
  guide.visible = false;
  world.add(guide);

  /* 冲击波：脱附点 + 吸附点 */
  function mkRing() {
    var m = new T.Mesh(new T.TorusGeometry(60, 3.2, 8, 48),
      new T.MeshBasicMaterial({ color: 0x5fe0ff, transparent: true, opacity: 0, toneMapped: false }));
    m.rotation.y = Math.PI / 2; m.visible = false; world.add(m); return m;
  }
  var ring = mkRing();        // 吸附到位
  var ringOff = mkRing();     // 从机身脱附

  /* ---------------------------------------------------------------- 屏幕 */
  /* 画布按 2× 超采样，绘制仍用 768×480 逻辑坐标，高分屏下屏幕 UI 依然锐利 */
  var scrCv = document.createElement('canvas'); scrCv.width = 1536; scrCv.height = 960;
  var scrCtx = scrCv.getContext('2d');
  scrCtx.scale(2, 2);
  var scrTex = new T.CanvasTexture(scrCv);
  scrTex.colorSpace = T.SRGBColorSpace;
  var scrMat = new T.MeshBasicMaterial({ map: scrTex, toneMapped: false });
  (function () {
    /* 新模型的屏幕走 ScreenUI 画布纹理，这里换成 demo 自己的实时绘制纹理 */
    pulse.group.traverse(function (o) {
      if (o.isMesh && o.material && o.material.map === pulseUI.texture) o.material = scrMat;
    });
  })();

  /* ---------------------------------------------------------------- 探针线 */
  var cables = [];
  (function buildCables() {
    /* 以 MOVE 结束态（机位 860/620、朝向 -0.30）计算探针仓接口世界坐标 */
    var ry = pulse.group.rotation.y;
    pulse.group.rotation.y = -0.30;
    pulse.group.updateMatrix();
    /* 探针线起点：直接取新模型的「线缆仓 / Probe Dock」锚点，换模型也不会脱节 */
    var dock = anchorMM(pulse.group, pulseApi, 'cables');
    dock.applyMatrix4(pulse.group.matrix);
    dock.add(new T.Vector3(860, 0, 620));
    pulse.group.rotation.y = ry;
    /* 端子原为柜体局部坐标，必须加上柜体原点高度（1130mm）才是世界坐标 */
    var myy = -290 + 90 + cab.group.position.y;      // 第 2 层模组正面端子 → 930mm
    for (var i = 0; i < 4; i++) {
      var a = dock.clone().add(new T.Vector3(0, -33 + i * 22, -15 + i * 10));
      var b = new T.Vector3(-240 + i * 160, myy, 300);
      var near = b.clone().add(new T.Vector3(0, -14, 78));
      var m1 = a.clone().lerp(b, 0.30); m1.y -= 190;
      var m2 = a.clone().lerp(b, 0.66); m2.y -= 230;
      var curve = new T.CatmullRomCurve3([a, m1, m2, near, b]);
      var mat = new T.MeshStandardMaterial({ color: RE.PROBE_COLORS[i], roughness: 0.52, metalness: 0.06 });
      var mesh = new T.Mesh(new T.TubeGeometry(curve, 72, 7.5, 10, false), mat);
      mesh.castShadow = true;
      mesh.geometry.setDrawRange(0, 0);
      world.add(mesh);
      /* 端子接头：从端子前方 120mm 处插入并锁止，插入到位后指示灯转绿 + 冲击环 */
      var conGrp = new T.Group();
      var conBody = new T.Mesh(RE.roundedBoxGeometry(52, 40, 46, 6, 2),
        new T.MeshStandardMaterial({ color: 0x14171a, roughness: 0.45, metalness: 0.4 }));
      conBody.castShadow = true;
      conGrp.add(conBody);
      /* 插头金属卡爪 */
      var claw = new T.Mesh(RE.roundedBoxGeometry(30, 16, 26, 4, 2),
        new T.MeshStandardMaterial({ color: 0xb6bcc2, roughness: 0.3, metalness: 1.0 }));
      claw.position.set(0, 0, -26); conGrp.add(claw);
      /* 到位指示灯 */
      var conLed = new T.Mesh(new T.SphereGeometry(6.5, 12, 10),
        new T.MeshBasicMaterial({ color: 0x2a3035, toneMapped: false }));
      conLed.position.set(0, 17, 24); conGrp.add(conLed);
      /* 插入到位冲击环 */
      var flash = new T.Mesh(new T.TorusGeometry(22, 2.4, 8, 32),
        new T.MeshBasicMaterial({ color: 0x7fe9ff, transparent: true, opacity: 0, toneMapped: false }));
      flash.position.set(0, 0, 30); conGrp.add(flash);

      var conEnd = b.clone(); conEnd.z += 22;
      var conStart = conEnd.clone(); conStart.z += 200;   // 从柜门外 200mm 处插入，行程可见
      conGrp.position.copy(conStart);
      conGrp.visible = false;
      world.add(conGrp);
      var pulses = [];
      for (var k = 0; k < 2; k++) {
        var sp = new T.Mesh(new T.SphereGeometry(15, 12, 10),
          new T.MeshBasicMaterial({ color: 0x9ff0ff, transparent: true, opacity: 0.95, toneMapped: false }));
        sp.visible = false; world.add(sp); pulses.push({ mesh: sp, off: k * 0.5 });
      }
      cables.push({
        mesh: mesh, curve: curve, total: mesh.geometry.index.count, pulses: pulses, i: i,
        con: conGrp, conStart: conStart, conEnd: conEnd, conLed: conLed, flash: flash
      });
    }
  })();

  /* ---------------------------------------------------------------- 总线接入线
     Re-Bridge 左侧 CAN/RS485 端口 → 柜内 BMS 通讯端子排
     磁吸只是固定，插上这根线才是"破壁取数"的关键动作
     ------------------------------------------------------------------ */
  var linkCable = (function () {
    var a = new T.Vector3(-440, 1030, 138);            // 网关 CAN/RS485 端口（朝柜门侧）
    var b = new T.Vector3(-424, 800, 196);             // 端子排插口
    var m1 = a.clone().lerp(b, 0.45); m1.x -= 36; m1.z += 28;
    var curve = new T.CatmullRomCurve3([a, m1, b]);
    var mesh = new T.Mesh(new T.TubeGeometry(curve, 44, 5.5, 8, false),
      new T.MeshStandardMaterial({ color: 0x2f8f6a, roughness: 0.55, metalness: 0.06 }));
    mesh.castShadow = true;
    mesh.geometry.setDrawRange(0, 0);
    world.add(mesh);

    var plug = new T.Group();
    plug.add(new T.Mesh(RE.roundedBoxGeometry(46, 34, 40, 5, 2),
      new T.MeshStandardMaterial({ color: 0x14171a, roughness: 0.45, metalness: 0.4 })));
    var pled = new T.Mesh(new T.SphereGeometry(5.5, 12, 10),
      new T.MeshBasicMaterial({ color: 0x2a3035, toneMapped: false }));
    pled.position.set(0, 13, 22); plug.add(pled);
    var pend = b.clone().add(new T.Vector3(0, 12, 20));
    var pstart = pend.clone().add(new T.Vector3(-34, 96, 66));
    plug.position.copy(pstart); plug.visible = false;
    world.add(plug);

    return { mesh: mesh, total: mesh.geometry.index.count, plug: plug, pled: pled, pstart: pstart, pend: pend };
  })();

  /* 过热电芯（板块② 安全）：第 2 层模组第 6 颗，世界坐标约 (150, 860, 262) */
  var hotCell = cellBlocks[13] || cellBlocks[0];
  var hotMat = hotCell.mat;
  var hotGlow = new T.Mesh(new T.SphereGeometry(72, 16, 12),
    new T.MeshBasicMaterial({ color: 0xff6a30, transparent: true, opacity: 0, toneMapped: false }));
  hotGlow.position.set(150, 860, 252);
  hotGlow.visible = false;
  world.add(hotGlow);

  /* ---------------------------------------------------------------- 人影
     推行阶段出现在整机斜后方（随行并摆动双腿），到位后淡出消失
     ------------------------------------------------------------------ */
  var walker = (function () {
    var g = new T.Group();
    var mat = new T.MeshStandardMaterial({
      color: 0x161b20, roughness: 0.94, metalness: 0.0, transparent: true, opacity: 1
    });
    function part(geo, x, y, z) {
      var m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; return m;
    }
    var legs = [];
    [1, -1].forEach(function (s) {
      var hip = new T.Group();
      hip.position.set(s * 105, 860, 0);
      hip.add(part(RE.roundedBoxGeometry(150, 860, 170, 58, 3), 0, -430, 0));   // 大腿+小腿
      hip.add(part(RE.roundedBoxGeometry(190, 90, 270, 28, 3), 0, -830, 45));   // 脚
      g.add(hip); legs.push(hip);
    });
    g.add(part(RE.roundedBoxGeometry(440, 640, 250, 58, 3), 0, 1180, 0));       // 躯干
    g.add(part(RE.roundedBoxGeometry(520, 150, 260, 48, 3), 0, 1500, 0));       // 肩
    g.add(part(new T.SphereGeometry(112, 20, 16), 0, 1700, 0));                 // 头
    g.add(part(new T.SphereGeometry(122, 18, 14), 0, 1730, -18));               // 安全帽
    /* 前伸握住拉杆的手臂 */
    var arm = new T.Group();
    arm.position.set(150, 1450, 0);
    arm.add(part(RE.roundedBoxGeometry(108, 520, 108, 44, 3), 0, -260, 0));
    arm.rotation.x = -0.62;
    g.add(arm);
    g.visible = false;
    world.add(g);
    return { group: g, mat: mat, legs: legs, arm: arm };
  })();

  /* 电芯落后标记（与屏幕热力图同步） */
  (function () {
    var idx = [3, 11, 14, 18, 21, 26, 29, 32, 35];
    idx.forEach(function (i, k) {
      if (!cellBlocks[i]) return;
      cellBlocks[i].bad = true;
      cellBlocks[i].fix = 26.9 + k * 0.62;
    });
  })();

  /* ---------------------------------------------------------------- 事件表 */
  var EV = {
    move: [12.6, 16.8],
    door: [17.2, 18.6],
    fly: [18.8, 20.3],      // 脱附 → 磁吸固定（仅物理安装）
    link: [20.5, 21.5],     // CAN/RS485 插头接入柜内 BMS 端子排（真正的取数动作）
    ledCyan: [21.5, 22.8],  // 联网中：白→青；之后青→绿
    cable: [22.2, 24.6],    // 线束抽出
    mate: [25.0, 26.5],     // 接头插入端子并锁止（4 路错峰）
    flow: [26.4, 35.0],
    fix: [26.9, 32.6],
    done: 33.8,
    alert: [36.4, 41.8],    // 板块② 安全：7×24h 热失控 AI 预警
    pass: [43.0, 47.8]      // 板块④ 回收：电池身份证 / SOH 评级 / 梯次转卖
  };

  /* ---------------------------------------------------------------- 机位表 */
  var SHOTS = [
    /* 01 PAIN 痛点：暗柜推近，柜体离线、压差离散 */
    { t0: 0.0, t1: 4.0, f: { th: 0.55, ph: 1.180, r: 3.20, tx: 0.00, ty: 1.05, tz: 0.46, fov: 44 }, t: { th: 0.30, ph: 1.220, r: 2.40, tx: 0.00, ty: 1.05, tz: 0.46, fov: 40 } },
    /* 02 INTRO 由柜体摇向产品并推近 */
    { t0: 4.0, t1: 8.0, f: { th: 0.30, ph: 1.220, r: 2.40, tx: 0.00, ty: 1.05, tz: 0.46, fov: 40 }, t: { th: 0.30, ph: 1.320, r: 1.95, tx: 2.60, ty: 0.44, tz: 1.50, fov: 34 } },
    /* 03 ORBIT 环绕 200°：整圈相机 x ≥ 0.66m，视线不被柜体遮挡 */
    { t0: 8.0, t1: 12.4, f: { th: 0.30, ph: 1.320, r: 1.95, tx: 2.60, ty: 0.44, tz: 1.50, fov: 34 }, t: { th: -3.19, ph: 1.050, r: 1.88, tx: 2.60, ty: 0.46, tz: 1.50, fov: 32 } },
    /* 04 MOVE 跟拍：θ 前置缓动回到 −1.00，落位时相机在柜体正前方 */
    { t0: 12.4, t1: 16.8, eth: 'out', f: { th: -3.19, ph: 1.050, r: 1.88, tx: 2.60, ty: 0.46, tz: 1.50, fov: 32 }, t: { th: -1.00, ph: 1.160, r: 2.45, tx: 0.86, ty: 0.48, tz: 0.62, fov: 40 } },
    /* 05 GATEWAY */
    { t0: 16.8, t1: 21.6, f: { th: -1.00, ph: 1.160, r: 2.45, tx: 0.86, ty: 0.48, tz: 0.62, fov: 40 }, t: { th: -0.52, ph: 1.185, r: 2.42, tx: 0.05, ty: 1.02, tz: 0.36, fov: 38 } },
    /* 06 PROBE 推进至端子微距 */
    { t0: 21.6, t1: 26.6, f: { th: -0.52, ph: 1.185, r: 2.42, tx: 0.05, ty: 1.02, tz: 0.36, fov: 38 }, t: { th: -0.20, ph: 1.420, r: 0.48, tx: -0.08, ty: 0.93, tz: 0.42, fov: 26 } },
    /* 07 ACTIVATE 摇向屏幕 */
    { t0: 26.6, t1: 32.0, f: { th: -0.20, ph: 1.420, r: 0.48, tx: -0.08, ty: 0.93, tz: 0.42, fov: 26 }, t: { th: 0.07, ph: 1.445, r: 0.84, tx: 0.86, ty: 0.40, tz: 0.60, fov: 28 } },
    /* 08 RESULT 拉远全景 */
    { t0: 32.0, t1: 36.0, f: { th: 0.07, ph: 1.445, r: 0.84, tx: 0.86, ty: 0.40, tz: 0.60, fov: 28 }, t: { th: 0.64, ph: 1.215, r: 3.40, tx: 0.45, ty: 0.86, tz: 0.30, fov: 40 } },
    /* 09 SAFETY 推近柜内过热电芯 */
    { t0: 36.0, t1: 42.0, f: { th: 0.64, ph: 1.215, r: 3.40, tx: 0.45, ty: 0.86, tz: 0.30, fov: 40 }, t: { th: 0.24, ph: 1.280, r: 1.95, tx: -0.05, ty: 1.00, tz: 0.40, fov: 34 } },
    /* 10 RESALE 绕柜缓移 */
    { t0: 42.0, t1: 48.0, f: { th: 0.24, ph: 1.280, r: 1.95, tx: -0.05, ty: 1.00, tz: 0.40, fov: 34 }, t: { th: 1.15, ph: 1.100, r: 3.10, tx: 0.10, ty: 1.00, tz: 0.30, fov: 38 } },
    /* 11 OUTRO 拉远淡出 */
    { t0: 48.0, t1: 54.0, f: { th: 1.15, ph: 1.100, r: 3.10, tx: 0.10, ty: 1.00, tz: 0.30, fov: 38 }, t: { th: 1.55, ph: 1.050, r: 4.80, tx: 0.20, ty: 1.05, tz: 0.25, fov: 42 } }
  ];

  var CHAPTERS = [
    { t0: 0.0, code: 'PAIN', h: '断网失联 · 容量悄悄流失', d: '原厂停服后云服务器断开、协议闭源，整柜沦为局域网盲盒，压差逐年拉大' },
    { t0: 4.0, code: 'INTRO', h: '让每一度电　持续创造价值', d: 'Re-Pulse 移动式储能电芯主动活化巡检工作站 · 现场作业全流程' },
    { t0: 8.0, code: 'ORBIT', h: '全景环绕检视', d: '双杆拉杆 · 两轮两脚 · 右侧卷线仓侧向开合 · 8 处 TPU 防撞包角' },
    { t0: 12.4, code: 'MOVE', h: '单人即可推走整套活化能力', d: '520 × 320 × 400 mm 主体，含拉杆总高 990 mm，整机随人走' },
    { t0: 16.8, code: 'GATEWAY', h: 'Re-Bridge 磁吸上云', d: '磁吸固定 + 接入柜内 CAN/RS485 总线，200+ 私有协议自动解析，断网储能柜重新接入云端' },
    { t0: 21.6, code: 'PROBE', h: 'Re-Probe 快插探针接入', d: '不拆电池包，4 路快插接头依次插入 PACK 采样端子并锁止到位' },
    { t0: 26.6, code: 'ACTIVATE', h: '5–10A 双向大电流主动均衡', d: '240 颗电芯逐颗拉平，掉队电芯现场 2 小时回到基准线（演示为时间压缩）' },
    { t0: 32.0, code: 'RESULT', h: '作业完成 · 整柜可用容量 +8.3%', d: '压差 ΔV 18mV → 4mV · 年化挽回电费 ¥10,560 · 客户 ROI > 150%' },
    { t0: 36.0, code: 'SAFETY', h: '7×24h 热失控 AI 预警', d: '季度订阅 · 保安全：单体温度越限即时告警，自动转待机并推送运维工单' },
    { t0: 42.0, code: 'RESALE', h: '电池身份证 · 梯次残值变现', d: '全周期数据沉淀为 SOH 评级 Grade A/B/C，溢价转卖下游，平台抽取 8% 佣金' },
    { t0: 48.0, code: 'OUTRO', h: 'Re-Energy · 储能后市场全生命周期', d: '重新上云 · 季度订阅 · 主动维护 · 回收转卖' }
  ];

  /* ---------------------------------------------------------------- 更新 */
  /* 轮组：新模型内部没有 userData.explode，改由构建时按轮胎名 'tire' 收集 */
  var wheels = wheelGroups.length ? wheelGroups : null;

  /* 右侧卷线仓门：视频中默认关闭（静态展示的"半开"状态会显得像块翘起的板） */
  var reelDoor = null;
  (function () {
    pulse.group.traverse(function (o) { if (o.name === 'ReelDoor') reelDoor = o; });
    if (reelDoor) reelDoor.position.copy(reelDoor.userData.closed);
  })();

  function updateScene(t) {
    /* 机位 */
    var s = SHOTS[SHOTS.length - 1];
    for (var i = 0; i < SHOTS.length; i++) { if (t >= SHOTS[i].t0 && t < SHOTS[i].t1) { s = SHOTS[i]; break; } }
    var k = ease(seg(t, s.t0, s.t1));
    /* 方位角可单独指定缓动（eth:'out' 前置摆位 / 'in' 后置摆位），用于绕开遮挡物 */
    var kth = k;
    if (s.eth === 'out') kth = easeOut(seg(t, s.t0, s.t1));
    else if (s.eth === 'in') kth = easeIn(seg(t, s.t0, s.t1));
    var th = lerp(s.f.th, s.t.th, kth), ph = lerp(s.f.ph, s.t.ph, k), r = lerp(s.f.r, s.t.r, k);
    var tx = lerp(s.f.tx, s.t.tx, k), ty = lerp(s.f.ty, s.t.ty, k), tz = lerp(s.f.tz, s.t.tz, k);
    var fov = lerp(s.f.fov, s.t.fov, k);
    th += 0.013 * Math.sin(t * 0.55); ph += 0.007 * Math.sin(t * 0.37 + 1.3);
    camera.fov = fov; camera.updateProjectionMatrix();
    var sp = new T.Spherical(r, ph, th);
    camera.position.setFromSpherical(sp).add(new T.Vector3(tx, ty, tz));
    camera.lookAt(tx, ty, tz);

    /* 整机移动 */
    var mk = ease(seg(t, EV.move[0], EV.move[1]));
    pulseHolder.position.set(lerp(2600, 860, mk), 0, lerp(1500, 620, mk));
    pulse.group.rotation.y = lerp(-0.42, -0.30, mk);
    pulse.group.rotation.x = -0.028 * Math.sin(mk * Math.PI);
    if (wheels) {
      /* 行程 1950mm / 新模型轮半径 82mm ≈ 23.8 rad */
      var spin = mk * 23.8;
      for (var wi = 0; wi < wheels.length; wi++) wheels[wi].rotation.x = -spin;
    }

    /* 卷线仓门：ORBIT 章滑开露出卷线轮（体现线缆管理），检视结束前合上 */
    if (reelDoor) {
      var rd = ease(seg(t, 9.7, 10.6)) * (1 - ease(seg(t, 11.9, 12.6)));
      reelDoor.position.lerpVectors(reelDoor.userData.closed, reelDoor.userData.open, rd);
    }

    /* 人影：8.4s 淡入并随行，12.6s 起淡出消失 */
    var wv = seg(t, 12.4, 13.0) * (1 - seg(t, 16.6, 17.2));
    walker.group.visible = wv > 0.01;
    walker.mat.opacity = wv;
    if (walker.group.visible) {
      /* 位于整机斜后方：沿行进反方向 820mm + 侧向 260mm */
      walker.group.position.set(
        lerp(2600, 860, mk) + 848,
        Math.abs(Math.sin(t * 5.6)) * 14,
        lerp(1500, 620, mk) + 138
      );
      walker.group.rotation.y = -2.05;                       // 面朝行进方向
      walker.legs[0].rotation.x = Math.sin(t * 5.6) * 0.42;
      walker.legs[1].rotation.x = -Math.sin(t * 5.6) * 0.42;
      walker.arm.rotation.x = -0.62 + Math.sin(t * 5.6) * 0.05;
      var cs = wv > 0.55;
      if (walker.cs !== cs) {
        walker.cs = cs;
        walker.group.traverse(function (o) { if (o.isMesh) o.castShadow = cs; });
      }
    }

    /* 柜门开启 */
    var dk = easeOut(seg(t, EV.door[0], EV.door[1]));
    cab.doorPivot.rotation.y = -dk * 1.92;

    /* Re-Bridge：从 Re-Pulse 顶部脱附 → 沿导引弧线飞入柜内左壁磁吸 */
    var fk = seg(t, EV.fly[0], EV.fly[1]);
    var fe = ease(fk);
    bridge.group.visible = true;
    bridge.group.position.lerpVectors(bridgeDock(), BR_MOUNT, fe);
    bridge.group.position.y += Math.sin(Math.PI * fe) * 170;      // 抛物线弧度
    bridge.group.rotation.x = lerp(-Math.PI / 2, 0, easeOut(fk)); // 平躺 → 竖起
    bridge.group.rotation.y = lerp(pulse.group.rotation.y, Math.PI / 2, easeOut(fk));

    /* 导引弧线：起飞前亮起，落位后淡出 */
    var gk = seg(t, EV.fly[0] - 0.4, EV.fly[0] - 0.05) * (1 - seg(t, EV.fly[1], EV.fly[1] + 0.7));
    guide.visible = gk > 0.01;
    guide.material.opacity = gk * 0.5;

    /* 状态灯：待机灭 → 起飞白 → 联网青 → 正常绿 */
    var lc = seg(t, EV.ledCyan[0], EV.ledCyan[1]);
    var ledCol = t < EV.fly[0]
      ? new T.Color(0x2a3035)
      : new T.Color(0xdce9f4).lerp(new T.Color(0x3ec6e8), lc);
    if (t > EV.ledCyan[1]) ledCol.lerp(new T.Color(0x3fe39b), seg(t, EV.ledCyan[1], EV.ledCyan[1] + 1.6));
    bridgeLed.material.color.copy(ledCol);

    /* 脱附脉冲（机身侧） */
    var ok = seg(t, EV.fly[0], EV.fly[0] + 0.7);
    if (ok > 0 && ok < 1) {
      ringOff.visible = true;
      ringOff.position.copy(BR_DOCK0);
      ringOff.scale.setScalar(0.5 + ok * 1.8);
      ringOff.material.opacity = (1 - ok) * 0.7;
    } else ringOff.visible = false;

    /* 吸附冲击波（柜内侧） */
    var rk = seg(t, EV.fly[1], EV.fly[1] + 0.9);
    if (rk > 0 && rk < 1) {
      ring.visible = true;
      ring.position.copy(BR_MOUNT); ring.position.x += 40;
      ring.scale.setScalar(0.6 + rk * 2.6);
      ring.material.opacity = (1 - rk) * 0.85;
    } else ring.visible = false;

    /* 总线接入：线束生长 + 插头插入 BMS 端子排 + 到位灯转绿 */
    var lk = seg(t, EV.link[0], EV.link[1]);
    var lp = easeOut(lk);
    linkCable.mesh.geometry.setDrawRange(0, Math.floor(linkCable.total * clamp(lp * 1.25, 0, 1) / 3) * 3);
    linkCable.plug.visible = t > EV.link[0] - 0.4;
    linkCable.plug.position.lerpVectors(linkCable.pstart, linkCable.pend, lp);
    linkCable.pled.material.color.copy(
      new T.Color(0x2a3035).lerp(new T.Color(0x3fe39b), seg(t, EV.link[0] + 0.6, EV.link[1] + 0.2))
    );

    /* 探针线生长 */
    var ck = easeOut(seg(t, EV.cable[0], EV.cable[1]));
    cables.forEach(function (c, ci) {
      var p = clamp(ck * 1.30 - ci * 0.08, 0, 1);
      var n = Math.floor(c.total * p / 3) * 3;
      c.mesh.geometry.setDrawRange(0, n);

      /* 接头插入端子：4 路错峰，每路行程 0.9s，到位后指示灯转绿 + 冲击环扩散 */
      var mStart = EV.mate[0] + ci * 0.22;
      var mk2 = easeOut(seg(t, mStart, mStart + 0.9));
      c.con.visible = t > mStart - 0.55;
      c.con.position.lerpVectors(c.conStart, c.conEnd, mk2);
      var seat = seg(t, mStart + 0.72, mStart + 1.25);
      c.conLed.material.color.copy(new T.Color(0x2a3035).lerp(new T.Color(0x3fe39b), seat));
      if (seat > 0 && seat < 1) {
        c.flash.material.opacity = (1 - seat) * 0.9;
        c.flash.scale.setScalar(0.6 + seat * 2.4);
      } else {
        c.flash.material.opacity = 0;
      }
      /* 电流脉冲 */
      var fl = seg(t, EV.flow[0], EV.flow[1]);
      c.pulses.forEach(function (ps) {
        if (p < 0.98 || fl <= 0 || fl >= 1) { ps.mesh.visible = false; return; }
        var u = (t * 0.42 + ps.off + ci * 0.17) % 1;
        ps.mesh.visible = true;
        ps.mesh.position.copy(c.curve.getPointAt(clamp(u, 0.001, 0.999)));
        var fade = 0.55 + 0.45 * Math.sin(u * Math.PI);
        ps.mesh.material.opacity = fade;
        ps.mesh.scale.setScalar(0.7 + 0.5 * fade);
      });
    });

    /* 电芯修复（柜内电芯块） */
    cellBlocks.forEach(function (c) {
      if (!c.bad) return;
      var fk2 = seg(t, c.fix - 0.5, c.fix + 0.5);
      var pulsev = 0.5 + 0.5 * Math.sin(t * 7 + c.fix);
      var bad = new T.Color(0xd8402f), good = new T.Color(0x1f8f66);
      var col = bad.clone().lerp(good, fk2);
      c.mat.emissive.copy(col).multiplyScalar(lerp(0.35 + 0.35 * pulsev, 0.55, fk2));
      c.mat.color.copy(new T.Color(0x2b3137).lerp(new T.Color(0x33544a), fk2));
    });

    /* 顶部警示灯：断网时灭 → 上电琥珀 → 作业完成转绿 → 预警期间闪红 */
    var bcol;
    if (t < 4.0) bcol = new T.Color(0x2a3035);
    else if (t < EV.done) bcol = new T.Color(0x3a2f10).lerp(new T.Color(0xffc451), seg(t, 4.0, 5.4));
    else bcol = new T.Color(0xffc451).lerp(new T.Color(0x3fe39b), seg(t, EV.done, EV.done + 1.2));
    if (t >= EV.alert[0] && t < EV.alert[1]) {
      var blink = 0.5 + 0.5 * Math.sin(t * 9);
      bcol = new T.Color(0xff3a20).multiplyScalar(0.45 + 0.55 * blink);
    }
    cab.beacon.material.color.copy(bcol);

    /* 板块② 安全：#137 电芯过热，自发光升温 + 热晕 */
    var ak = seg(t, EV.alert[0], EV.alert[0] + 2.4) * (1 - seg(t, EV.alert[1] - 0.8, EV.alert[1]));
    hotMat.emissive.copy(new T.Color(0x1f8f66).lerp(new T.Color(0xff3a10), ak));
    hotMat.emissive.multiplyScalar(0.55 + 0.65 * ak * (0.55 + 0.45 * Math.sin(t * 6)));
    hotMat.color.copy(new T.Color(0x33544a).lerp(new T.Color(0x7a2410), ak));
    hotGlow.visible = ak > 0.02;
    hotGlow.material.opacity = ak * (0.35 + 0.3 * Math.sin(t * 6));
    hotGlow.scale.setScalar(0.8 + 0.5 * ak);

    /* 板块④ 回收：全柜电芯按 Grade 分级着色 */
    var gk = seg(t, EV.pass[0], EV.pass[0] + 2.4);
    if (gk > 0) {
      cellBlocks.forEach(function (c, i) {
        var grade = (i % 7 === 0) ? new T.Color(0x8a6a2a) : new T.Color(0x1f8f66);
        c.mat.emissive.lerp(grade, gk * 0.16);
      });
    }
  }

  /* ---------------------------------------------------------------- 屏幕 UI */
  var BAD = [37, 58, 91, 92, 114, 137, 138, 158, 159, 181, 182, 203, 226, 227, 228, 229, 230, 231];
  var FIXT = BAD.map(function (_, i) { return 26.9 + i * 0.31; });

  function drawScreen(t) {
    var ctx = scrCtx, w = 768, h = 480;
    var g = ctx.createLinearGradient(0, 0, w * 0.5, h);
    g.addColorStop(0, '#0d1a24'); g.addColorStop(1, '#060b10');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(120,200,235,.06)'; ctx.fillRect(0, 0, w, 64);
    ctx.strokeStyle = 'rgba(120,205,240,.24)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 64); ctx.lineTo(w, 64); ctx.stroke();
    ctx.fillStyle = '#6fd8ff'; ctx.font = '700 30px ' + RE.MONO; ctx.fillText('RE-PULSE', 22, 33);
    ctx.fillStyle = 'rgba(150,180,200,.72)'; ctx.font = '400 18px ' + RE.FONT;
    ctx.fillText('PACK 03 · 工商业储能柜 1#柜', 148, 34);
    ctx.textAlign = 'right'; ctx.fillStyle = '#cfe3ef'; ctx.font = '500 24px ' + RE.MONO;
    ctx.fillText('09:' + pad2(Math.floor(42 + t * 0.6) % 60), w - 22, 33);

    var mode = t < 8.8 ? 'boot' : (t < 23.0 ? 'scan' : (t < EV.done ? 'cells' : 'done'));
    var prog = ease(seg(t, 26.8, 32.6));

    if (mode === 'boot') {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#7fdcff'; ctx.font = '700 62px ' + RE.FONT;
      ctx.fillText('RE-ENERGY', w / 2, h * 0.42);
      ctx.fillStyle = 'rgba(160,195,215,.8)'; ctx.font = '400 26px ' + RE.FONT;
      ctx.fillText('SYSTEM BOOT · 自检中', w / 2, h * 0.54);
      var bp = seg(t, 4.6, 8.6);
      ctx.strokeStyle = 'rgba(120,205,240,.22)'; ctx.lineWidth = 10; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(w * 0.24, h * 0.66); ctx.lineTo(w * 0.76, h * 0.66); ctx.stroke();
      ctx.strokeStyle = '#4fd0ff';
      ctx.beginPath(); ctx.moveTo(w * 0.24, h * 0.66); ctx.lineTo(w * 0.24 + w * 0.52 * bp, h * 0.66); ctx.stroke();
      return;
    }

    if (mode === 'scan') {
      ctx.textAlign = 'left';
      var rows = [
        ['BMS 协议识别', 'MODBUS-RTU / CAN2.0B', '#7fe9c8'],
        ['单体电压采样', '240 / 240 通道', '#7fe9c8'],
        ['温度探头', 'NTC × 32 在线', '#7fe9c8'],
        ['绝缘检测', '≥ 500 Ω/V  PASS', '#3ee8a8'],
        ['SOH 健康度评估', '82.4 %   ΔV 18 mV', '#ffd98a']
      ];
      var sp = Math.floor(seg(t, 8.8, 16.0) * 5.99);
      rows.forEach(function (r, i) {
        var y = 120 + i * 62;
        ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.fillRect(40, y - 26, w - 80, 50);
        ctx.fillStyle = 'rgba(165,196,215,.85)'; ctx.font = '400 24px ' + RE.FONT;
        ctx.fillText(r[0], 62, y);
        ctx.textAlign = 'right';
        if (i <= sp) { ctx.fillStyle = r[2]; ctx.font = '600 26px ' + RE.MONO; ctx.fillText(r[1], w - 62, y); }
        else { ctx.fillStyle = 'rgba(140,165,185,.4)'; ctx.font = '500 24px ' + RE.MONO; ctx.fillText('检测中…', w - 62, y); }
        ctx.textAlign = 'left';
      });
      return;
    }

    /* 电芯矩阵热力图 */
    var cols = 24, rows2 = 10, cw = 20, chh = 24, x0 = 214, y0 = 96;
    /* 左侧 SOH 环 */
    var cx = 108, cy = 200, R = 64;
    var soh = t < 26.8 ? 82.4 : lerp(82.4, 84.1, prog);   /* 活化改善一致性与可用容量，SOH 仅小幅回升 */
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(90,150,180,.16)'; ctx.lineWidth = 16;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    var ag = ctx.createLinearGradient(cx - R, cy, cx + R, cy);
    ag.addColorStop(0, '#2ad6b0'); ag.addColorStop(1, '#4fd0ff');
    ctx.strokeStyle = ag; ctx.lineWidth = 16;
    ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (soh / 100)); ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillStyle = '#eaf6ff'; ctx.font = '700 52px ' + RE.MONO;
    ctx.fillText(soh.toFixed(1), cx, cy - 6);
    ctx.fillStyle = '#7fb6cf'; ctx.font = '500 20px ' + RE.FONT; ctx.fillText('SOH %', cx, cy + 44);

    for (var i = 0; i < 240; i++) {
      var r2 = Math.floor(i / cols), c2 = i % cols;
      var x = x0 + c2 * (cw + 2), y = y0 + r2 * (chh + 2);
      var bi = BAD.indexOf(i);
      var col = '#1f8f66';
      if (bi >= 0) {
        var fk = seg(t, FIXT[bi] - 0.5, FIXT[bi] + 0.5);
        var bl = 0.5 + 0.5 * Math.sin(t * 7 + i);
        if (fk <= 0) col = bl > 0.5 ? '#f0563f' : '#c2301f';
        else if (fk < 1) col = bl > 0.5 ? '#e8a33a' : '#c07a22';
        else col = '#2ad6b0';
      } else {
        col = (i % 7 === 0) ? '#2aa87c' : '#1f8f66';
      }
      ctx.fillStyle = col;
      ctx.fillRect(x, y, cw, chh);
    }
    /* 选中框：正在活化的电芯 */
    var cur = Math.floor(prog * BAD.length);
    if (cur < BAD.length) {
      var bi2 = BAD[cur], rr = Math.floor(bi2 / cols), cc = bi2 % cols;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      ctx.strokeRect(x0 + cc * (cw + 2) - 1, y0 + rr * (chh + 2) - 1, cw + 2, chh + 2);
    }
    ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(150,185,205,.7)'; ctx.font = '400 17px ' + RE.FONT;
    ctx.fillText('240 颗电芯实时电压矩阵 · ΔV ' + (18 - 14 * prog).toFixed(0) + ' mV', x0, y0 - 24);

    /* 底部进度 */
    var pbY = h - 92;
    ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(40, pbY, w - 80, 26);
    var pg = ctx.createLinearGradient(40, 0, w - 40, 0);
    pg.addColorStop(0, '#2ad6b0'); pg.addColorStop(1, '#4fd0ff');
    ctx.fillStyle = pg; ctx.fillRect(40, pbY, (w - 80) * prog, 26);
    ctx.textAlign = 'left'; ctx.fillStyle = '#9fd8ef'; ctx.font = '500 20px ' + RE.MONO;
    ctx.fillText('主动均衡 ' + (prog * 100).toFixed(0) + '%', 40, pbY - 22);
    ctx.textAlign = 'right'; ctx.fillStyle = '#ffd98a'; ctx.font = '500 20px ' + RE.MONO;
    ctx.fillText('5–10A 双向均衡 · 脉冲除硫', w - 40, pbY - 22);
    return;
  }

  function drawScreenDone(t) {
    var ctx = scrCtx, w = 768, h = 480;
    var g = ctx.createLinearGradient(0, 0, w * 0.5, h);
    g.addColorStop(0, '#0d1a24'); g.addColorStop(1, '#060b10');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#3ee8a8'; ctx.font = '700 96px ' + RE.FONT;
    ctx.fillText('✓', w / 2, h * 0.22);
    ctx.fillStyle = '#eaf6ff'; ctx.font = '700 54px ' + RE.FONT;
    ctx.fillText('活化作业完成', w / 2, h * 0.40);
    ctx.fillStyle = 'rgba(160,195,215,.85)'; ctx.font = '400 26px ' + RE.FONT;
    ctx.fillText('绝缘 / 温升 / 压差 全部合格 — SAFE', w / 2, h * 0.50);
    var items = [
      ['压差 ΔV', '18 mV → 4 mV'],
      ['整柜可用容量', '+ 8.3 %'],
      ['SOH 一致性改善', '82.4 % → 84.1 %']
    ];
    items.forEach(function (it, i) {
      var y = h * 0.62 + i * 44;
      ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(160,195,215,.8)'; ctx.font = '400 24px ' + RE.FONT;
      ctx.fillText(it[0], w * 0.18, y);
      ctx.textAlign = 'right'; ctx.fillStyle = '#7fe9c8'; ctx.font = '600 28px ' + RE.MONO;
      ctx.fillText(it[1], w * 0.82, y);
    });
  }

  /* 板块② 安全：热失控预警屏 */
  function drawScreenAlert(t) {
    var ctx = scrCtx, w = 768, h = 480;
    var k = seg(t, EV.alert[0], EV.alert[0] + 0.8);
    var g = ctx.createLinearGradient(0, 0, w * 0.5, h);
    g.addColorStop(0, '#2a0d0a'); g.addColorStop(1, '#120607');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    /* 闪烁红框 */
    var bl = 0.45 + 0.55 * Math.abs(Math.sin(t * 4.2));
    ctx.strokeStyle = 'rgba(255,74,52,' + (0.35 + 0.5 * bl) + ')';
    ctx.lineWidth = 10; ctx.strokeRect(5, 5, w - 10, h - 10);

    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = '#ff6a4d'; ctx.font = '700 34px ' + RE.MONO;
    ctx.fillText('⚠  THERMAL  ALERT', 40, 52);
    ctx.fillStyle = 'rgba(255,190,180,.8)'; ctx.font = '400 22px ' + RE.FONT;
    ctx.fillText('PACK 03 · 单体 #137', 300, 53);

    /* 温度读数 */
    var tmp = 31.4 + (62.4 - 31.4) * ease(seg(t, EV.alert[0], EV.alert[0] + 2.4));
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd0c4'; ctx.font = '500 22px ' + RE.FONT;
    ctx.fillText('单体温度', w * 0.5, 118);
    ctx.fillStyle = '#ff5a3c'; ctx.font = '700 92px ' + RE.MONO;
    ctx.fillText(tmp.toFixed(1), w * 0.5 - 26, 190);
    ctx.fillStyle = '#ffb0a0'; ctx.font = '600 40px ' + RE.MONO;
    ctx.fillText('℃', w * 0.5 + 96, 196);

    /* 阈值条 */
    var bx = 70, bw = w - 140, by = 262;
    ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(bx, by, bw, 22);
    var p = clamp((tmp - 20) / (70 - 20), 0, 1);
    ctx.fillStyle = '#ff5a3c'; ctx.fillRect(bx, by, bw * p, 22);
    ctx.fillStyle = '#8fd8ff'; ctx.fillRect(bx + bw * ((55 - 20) / 50) - 2, by - 8, 4, 38);
    ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,200,190,.85)'; ctx.font = '500 20px ' + RE.MONO;
    ctx.fillText('阈值 55 ℃', bx + bw * 0.70 - 40, by + 52);

    /* AI 处置建议 */
    ctx.fillStyle = 'rgba(255,90,60,.12)';
    ctx.fillRect(40, 336, w - 80, 116);
    ctx.strokeStyle = 'rgba(255,120,90,.55)'; ctx.lineWidth = 2;
    ctx.strokeRect(40, 336, w - 80, 116);
    ctx.fillStyle = '#ffd9d0'; ctx.font = '600 24px ' + RE.FONT; ctx.textAlign = 'left';
    ctx.fillText('暂停充放电，转待机并现场核查', 64, 372);
    ctx.fillStyle = 'rgba(255,215,205,.85)'; ctx.font = '400 22px ' + RE.FONT;
    ctx.fillText('已自动推送运维工单 #2417 · 7×24h 值守', 64, 412);
    void k;
  }

  /* 板块④ 回收：电池身份证 */
  function drawScreenPassport(t) {
    var ctx = scrCtx, w = 768, h = 480;
    var g = ctx.createLinearGradient(0, 0, w * 0.5, h);
    g.addColorStop(0, '#0d1a24'); g.addColorStop(1, '#060b10');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(120,205,240,.35)'; ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, w - 16, h - 16);

    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = '#6fd8ff'; ctx.font = '700 30px ' + RE.MONO;
    ctx.fillText('BATTERY  PASSPORT', 44, 50);
    ctx.fillStyle = 'rgba(150,180,200,.75)'; ctx.font = '400 20px ' + RE.FONT;
    ctx.fillText('储能电池身份证 · C-01', 330, 52);

    var rows = [
      ['投运日期', '2021-06-18'],
      ['循环次数', '2,417 次'],
      ['SOH 残值', '78.6 %'],
      ['容量衰减', '均匀 · 极差 3.1 %']
    ];
    rows.forEach(function (r, i) {
      var y = 128 + i * 58;
      ctx.fillStyle = 'rgba(255,255,255,.045)'; ctx.fillRect(44, y - 24, w - 88, 44);
      ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(165,196,215,.85)'; ctx.font = '400 24px ' + RE.FONT;
      ctx.fillText(r[0], 64, y);
      ctx.textAlign = 'right'; ctx.fillStyle = '#dff0fa'; ctx.font = '600 28px ' + RE.MONO;
      ctx.fillText(r[1], w - 64, y);
    });

    /* Grade 印章 */
    var gs = easeOut(seg(t, EV.pass[0] + 1.2, EV.pass[0] + 2.0));
    ctx.save();
    ctx.globalAlpha = gs;
    ctx.translate(w - 150, 372); ctx.rotate(-0.18);
    ctx.strokeStyle = '#3ee8a8'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(0, 0, 62, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#3ee8a8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 60px ' + RE.MONO; ctx.fillText('A', 0, -4);
    ctx.font = '500 18px ' + RE.FONT; ctx.fillText('GRADE', 0, 34);
    ctx.restore();

    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#7fe9c8'; ctx.font = '600 24px ' + RE.FONT;
    ctx.fillText('建议梯次：厂区电动叉车 / 低速观光车', 44, 348);
    ctx.fillStyle = 'rgba(178,204,220,.85)'; ctx.font = '400 21px ' + RE.FONT;
    ctx.fillText('残值评估 ¥42,000 · 平台佣金 8%', 44, 392);
    ctx.fillStyle = 'rgba(178,204,220,.7)'; ctx.font = '400 19px ' + RE.FONT;
    ctx.fillText('数据来源：全周期充放电健康档案', 44, 428);
  }

  /* 屏幕总调度 */
  function renderScreen(t) {
    if (t >= EV.alert[0] && t < EV.alert[1]) drawScreenAlert(t);
    else if (t >= EV.pass[0] && t < EV.pass[1]) drawScreenPassport(t);
    else if (t >= EV.done) drawScreenDone(t);
    else drawScreen(t);
    scrTex.needsUpdate = true;
  }

  /* ---------------------------------------------------------------- HUD */
  var out = document.getElementById('out');
  out.width = W; out.height = H;
  var oc = out.getContext('2d');

  var vign = document.createElement('canvas'); vign.width = W; vign.height = H;
  (function () {
    var c = vign.getContext('2d');
    var g = c.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.95);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.72)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  })();

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }

  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  var mono = '"JetBrains Mono","SFMono-Regular",Consolas,monospace';
  var font = '"HarmonyOS Sans SC","PingFang SC","Microsoft YaHei",sans-serif';

  function chapterAt(t) {
    var c = CHAPTERS[0];
    for (var i = 0; i < CHAPTERS.length; i++) if (t >= CHAPTERS[i].t0) c = CHAPTERS[i];
    return c;
  }

  /* 文本超宽时自动降字号，保证不越出面板 */
  function fitText(ctx, s, maxW, size, weight, family, min) {
    var p = size; min = min || 9;
    for (; ;) {
      ctx.font = weight + ' ' + p + 'px ' + family;
      if (ctx.measureText(s).width <= maxW || p <= min) break;
      p -= 1;
    }
    return p;
  }

  function drawHUD(t, fi) {
    var ctx = oc;
    var LW = 1280, LH = 720;                       /* UI 设计基准（16:9） */
    var sc = Math.min(PW / LW, PH / LH);           /* 非 16:9 时等比居中，留黑边 */
    var ox = (PW - LW * sc) / 2, oy = (PH - LH * sc) / 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(gl, 0, 0, PW, PH);
    ctx.drawImage(vign, 0, 0);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(sc, sc);
    var W = LW, H = LH;                            /* 覆盖外层尺寸，后续沿用逻辑坐标 */

    /* 颗粒 */
    ctx.save(); ctx.globalAlpha = 0.045;
    for (var n = 0; n < 90; n++) {
      var gx = ((n * 7919 + fi * 131) % W), gy = ((n * 104729 + fi * 977) % H);
      ctx.fillStyle = n % 2 ? '#ffffff' : '#9fd8ff';
      ctx.fillRect(gx, gy, 1.4, 1.4);
    }
    ctx.restore();

    var chap = chapterAt(t);
    var idx = CHAPTERS.indexOf(chap) + 1;
    var fadeIn = easeOut(seg(t, chap.t0, chap.t0 + 0.55));

    /* 顶部品牌 */
    ctx.save();
    ctx.fillStyle = 'rgba(8,12,16,.55)'; rr(ctx, 34, 30, 54, 54, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(120,205,240,.45)'; ctx.lineWidth = 1.5; rr(ctx, 34, 30, 54, 54, 12); ctx.stroke();
    ctx.fillStyle = '#7fdcff'; ctx.font = '700 30px ' + mono; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('R', 61, 56);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e6f2f8'; ctx.font = '700 22px ' + font; ctx.fillText('RE-ENERGY', 104, 47);
    ctx.fillStyle = 'rgba(160,195,215,.72)'; ctx.font = '400 14px ' + font; ctx.fillText('RE-PULSE · 现场作业演示', 104, 69);
    ctx.restore();

    /* 右上章节码 */
    ctx.save();
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(8,12,16,.55)'; rr(ctx, W - 214, 32, 180, 46, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(120,205,240,.32)'; ctx.lineWidth = 1.4; rr(ctx, W - 214, 32, 180, 46, 10); ctx.stroke();
    ctx.fillStyle = '#7fdcff'; ctx.font = '600 15px ' + mono;
    ctx.fillText(chap.code, W - 46, 55);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(160,195,215,.6)'; ctx.font = '500 13px ' + mono;
    ctx.fillText(pad2(idx) + ' / ' + pad2(CHAPTERS.length), W - 206, 56);
    ctx.restore();

    /* Re-Bridge 部署提示：飞行窗口内出现，说明"飞过去的是什么" */
    var bk = seg(t, EV.fly[0] - 0.45, EV.fly[0] - 0.1) * (1 - seg(t, EV.link[1], EV.link[1] + 0.7));
    if (bk > 0.01) {
      var btxt = t < EV.link[0] ? 'Re-Bridge 磁吸部署' : '接入 RS485 · CAN 总线';
      ctx.save(); ctx.globalAlpha = bk;
      ctx.fillStyle = 'rgba(6,10,14,.70)'; rr(ctx, W - 214, 86, 180, 46, 10); ctx.fill();
      ctx.strokeStyle = 'rgba(127,233,200,.5)'; ctx.lineWidth = 1.4; rr(ctx, W - 214, 86, 180, 46, 10); ctx.stroke();
      ctx.fillStyle = '#7fe9c8'; ctx.font = '600 14px ' + mono;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(btxt, W - 124, 109);
      ctx.restore();
    }

    /* 底部字幕 */
    ctx.save();
    ctx.globalAlpha = fadeIn;
    ctx.fillStyle = 'rgba(6,10,14,.62)'; rr(ctx, 44, H - 152, 760, 108, 14); ctx.fill();
    ctx.strokeStyle = 'rgba(120,205,240,.22)'; ctx.lineWidth = 1.4; rr(ctx, 44, H - 152, 760, 108, 14); ctx.stroke();
    ctx.fillStyle = 'rgba(127,220,255,.95)'; ctx.font = '600 13px ' + mono; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('STEP ' + pad2(idx), 70, H - 118);
    ctx.fillStyle = '#f2f8fc'; ctx.font = '700 30px ' + font;
    ctx.fillText(chap.h, 70, H - 84);
    ctx.fillStyle = 'rgba(178,204,220,.88)'; ctx.font = '400 16px ' + font;
    ctx.fillText(chap.d, 70, H - 58);
    ctx.restore();

    /* 右下时间码 + 进度 */
    ctx.save();
    ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(190,215,230,.8)'; ctx.font = '500 16px ' + mono;
    ctx.fillText(tc(t), W - 44, H - 62);
    ctx.fillStyle = 'rgba(255,255,255,.14)'; rr(ctx, W - 344, H - 50, 300, 5, 2.5); ctx.fill();
    ctx.fillStyle = '#4fd0ff'; rr(ctx, W - 344, H - 50, 300 * (t / DUR), 5, 2.5); ctx.fill();
    ctx.restore();

    /* 数据面板（活化阶段） */
    var kp = easeOut(seg(t, 31.4, 32.4)) * (1 - seg(t, 35.6, 36.4));
    if (kp > 0.01) {
      ctx.save(); ctx.globalAlpha = kp;
      var px = W - 372, py = 108;
      ctx.fillStyle = 'rgba(6,10,14,.66)'; rr(ctx, px, py, 328, 208, 12); ctx.fill();
      ctx.strokeStyle = 'rgba(120,205,240,.28)'; ctx.lineWidth = 1.4; rr(ctx, px, py, 328, 208, 12); ctx.stroke();
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#7fdcff'; ctx.font = '600 13px ' + mono;
      ctx.fillText('VALUE RECOVERED', px + 22, py + 30);
      var pr = ease(seg(t, 22.8, 28.6));
      var rows = [
        ['整柜可用容量', '+' + (8.3 * pr).toFixed(1) + ' %', '#3ee8a8'],
        ['压差 ΔV', (18 - 14 * pr).toFixed(0) + ' mV', '#ffd98a'],
        ['年化挽回电费', '¥ ' + Math.round(10560 * pr).toLocaleString(), '#7fe9c8'],
        ['客户 ROI', '> ' + Math.round(60 + 90 * pr) + ' %', '#7fdcff']
      ];
      rows.forEach(function (r, i) {
        var y = py + 68 + i * 38;
        ctx.fillStyle = 'rgba(170,200,218,.82)'; ctx.font = '400 16px ' + font;
        ctx.fillText(r[0], px + 22, y);
        ctx.textAlign = 'right'; ctx.fillStyle = r[2]; ctx.font = '600 22px ' + mono;
        ctx.fillText(r[1], px + 306, y);
        ctx.textAlign = 'left';
      });
      ctx.restore();
    }

    /* ---- 板块② 安全：PC 中台 · 资产救援大盘 ---- */
    var sk = easeOut(seg(t, EV.alert[0], EV.alert[0] + 0.7)) * (1 - seg(t, EV.alert[1] - 0.4, EV.alert[1]));
    if (sk > 0.01) {
      ctx.save(); ctx.globalAlpha = sk;
      /* 面板尺寸由内容推算，杜绝文字溢出 */
      var sw = 428, sx = W - 472, sy = 108, pad = 20, innerW = sw - pad * 2;
      var sh = 278;
      ctx.fillStyle = 'rgba(6,10,14,.74)'; rr(ctx, sx, sy, sw, sh, 12); ctx.fill();
      ctx.strokeStyle = 'rgba(120,205,240,.3)'; ctx.lineWidth = 1.4; rr(ctx, sx, sy, sw, sh, 12); ctx.stroke();
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#7fdcff'; ctx.font = '600 13px ' + mono;
      ctx.fillText('RE-CLOUD 中台 · 资产救援大盘', sx + pad, sy + 32);
      ctx.fillStyle = 'rgba(170,200,218,.85)';
      fitText(ctx, '在线柜 128   断网柜 3（已救援）   今日告警 1', innerW, 15, '400', font);
      ctx.fillText('在线柜 128   断网柜 3（已救援）   今日告警 1', sx + pad, sy + 58);

      /* 告警卡：4 行分栏，左列读数、右列元信息，互不重叠 */
      var ax = sx + 18, ay = sy + 70, aw = sw - 36, ah = 146, ap = 16;
      var aInner = aw - ap * 2, aL = ax + ap, aR = ax + aw - ap;
      var bl2 = 0.5 + 0.5 * Math.abs(Math.sin(t * 4.2));
      ctx.fillStyle = 'rgba(255,60,40,' + (0.10 + 0.10 * bl2) + ')'; rr(ctx, ax, ay, aw, ah, 10); ctx.fill();
      ctx.strokeStyle = 'rgba(255,90,60,' + (0.45 + 0.45 * bl2) + ')'; ctx.lineWidth = 2; rr(ctx, ax, ay, aw, ah, 10); ctx.stroke();

      /* 行 1：标题 + 位置（右对齐） */
      ctx.fillStyle = '#ff6a4d';
      fitText(ctx, '⚠  热失控预警', aInner * 0.62, 20, '700', font);
      ctx.fillText('⚠  热失控预警', aL, ay + 34);
      ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,205,195,.9)';
      fitText(ctx, 'PACK 03 · 单体 #137', aInner * 0.38, 14, '400', font);
      ctx.fillText('PACK 03 · 单体 #137', aR, ay + 32);
      ctx.textAlign = 'left';

      /* 行 2：温度大字 + 温升速率（右对齐） */
      var tp = 31.4 + (62.4 - 31.4) * ease(seg(t, EV.alert[0], EV.alert[0] + 2.4));
      ctx.fillStyle = '#ff8a6a'; ctx.font = '700 34px ' + mono;
      ctx.fillText(tp.toFixed(1), aL, ay + 82);
      var tw = ctx.measureText(tp.toFixed(1)).width;
      ctx.font = '600 16px ' + mono; ctx.fillText('℃', aL + tw + 6, ay + 82);
      ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,200,190,.85)'; ctx.font = '400 14px ' + font;
      ctx.fillText('↑ 1.8 ℃/min', aR, ay + 78);
      ctx.textAlign = 'left';

      /* 行 3：阈值 + 进度条 */
      ctx.fillStyle = 'rgba(255,215,205,.85)'; ctx.font = '400 13px ' + font;
      ctx.fillText('阈值 55 ℃', aL, ay + 106);
      var thW = ctx.measureText('阈值 55 ℃').width;
      var bx = aL + thW + 12, bw = aR - bx;
      ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fillRect(bx, ay + 98, bw, 10);
      ctx.fillStyle = '#ff5a3c'; ctx.fillRect(bx, ay + 98, bw * clamp((tp - 20) / 50, 0, 1), 10);
      ctx.fillStyle = '#8fd8ff'; ctx.fillRect(bx + bw * 0.70 - 1, ay + 95, 3, 16);

      /* 行 4：处置动作 */
      ctx.fillStyle = 'rgba(255,225,215,.85)';
      fitText(ctx, '已推送工单 #2417 · 暂停充放电，转待机并现场核查', aInner, 13, '400', font);
      ctx.fillText('已推送工单 #2417 · 暂停充放电，转待机并现场核查', aL, ay + 128);

      /* 页脚 */
      ctx.fillStyle = 'rgba(178,204,220,.8)';
      fitText(ctx, '7×24h AI 预警 · 季度 SOH 诊断报告 · 断网重连', innerW, 14, '400', font);
      ctx.fillText('7×24h AI 预警 · 季度 SOH 诊断报告 · 断网重连', sx + pad, sy + 234);
      ctx.fillStyle = 'rgba(127,233,200,.9)'; ctx.font = '500 13px ' + mono;
      ctx.fillText('SLA 基础版 999 元 / 柜 / 季度', sx + pad, sy + 258);
      ctx.restore();
    }

    /* ---- 板块④ 回收：电池身份证 + 梯次转卖 ---- */
    var pk = easeOut(seg(t, EV.pass[0], EV.pass[0] + 0.7)) * (1 - seg(t, EV.pass[1], EV.pass[1] + 0.6));
    if (pk > 0.01) {
      ctx.save(); ctx.globalAlpha = pk;
      /* 面板尺寸由内容推算：此前 286 装不下页脚，最后两行溢到面板外 */
      var qw = 428, qx = W - 472, qy = 108, qpad = 20, qInner = qw - qpad * 2;
      var qh = 328;
      ctx.fillStyle = 'rgba(6,10,14,.74)'; rr(ctx, qx, qy, qw, qh, 12); ctx.fill();
      ctx.strokeStyle = 'rgba(120,205,240,.3)'; ctx.lineWidth = 1.4; rr(ctx, qx, qy, qw, qh, 12); ctx.stroke();
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#7fdcff'; ctx.font = '600 13px ' + mono;
      ctx.fillText('BATTERY PASSPORT · 电池身份证', qx + qpad, qy + 32);

      /* 左标签 / 右数值两栏，数值右对齐且预留标签列宽度 */
      var pr = [['柜号 / 投运', 'C-01 · 2021-06'], ['循环次数', '2,417 次'],
      ['SOH 残值', '78.6 %'], ['容量极差', '3.1 %  (Grade A)']];
      pr.forEach(function (r, i) {
        var y = qy + 68 + i * 32;
        ctx.fillStyle = 'rgba(170,200,218,.85)'; ctx.font = '400 15px ' + font;
        ctx.fillText(r[0], qx + qpad, y);
        ctx.textAlign = 'right'; ctx.fillStyle = '#dff0fa';
        fitText(ctx, r[1], qInner - 100, 17, '600', mono);
        ctx.fillText(r[1], qx + qw - qpad, y);
        ctx.textAlign = 'left';
      });

      /* 梯次去向 */
      var bx0 = qx + 18, by0 = qy + 182, bw0 = qw - 36, bh0 = 72;
      ctx.fillStyle = 'rgba(255,255,255,.05)'; rr(ctx, bx0, by0, bw0, bh0, 8); ctx.fill();
      ctx.fillStyle = '#3ee8a8';
      fitText(ctx, 'Grade A → 厂区电动叉车 · 低速观光车', bw0 - 32, 15, '600', font);
      ctx.fillText('Grade A → 厂区电动叉车 · 低速观光车', bx0 + 16, by0 + 26);
      ctx.fillStyle = '#e0b32a';
      fitText(ctx, 'Grade B → 离网光伏微网 · 农业灌溉储能', bw0 - 32, 14, '400', font);
      ctx.fillText('Grade B → 离网光伏微网 · 农业灌溉储能', bx0 + 16, by0 + 54);

      /* 页脚（收在面板内） */
      ctx.fillStyle = 'rgba(178,204,220,.85)';
      fitText(ctx, '残值评估 ¥42,000 · 多挽回 30–50% 退役残值', qInner, 15, '400', font);
      ctx.fillText('残值评估 ¥42,000 · 多挽回 30–50% 退役残值', qx + qpad, qy + 284);
      ctx.fillStyle = 'rgba(127,233,200,.9)'; ctx.font = '500 13px ' + mono;
      ctx.fillText('平台撮合佣金 8%  →  ¥3,360 / 柜', qx + qpad, qy + 308);
      ctx.restore();
    }

    /* 片头 */
    var intro = 1 - seg(t, 5.6, 7.0);
    if (intro > 0.01) {
      ctx.save(); ctx.globalAlpha = intro;
      ctx.fillStyle = 'rgba(4,7,10,.55)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#7fdcff'; ctx.font = '600 15px ' + mono;
      ctx.fillText('RE-ENERGY  /  PRODUCT DEMO', 70, H * 0.44);
      ctx.fillStyle = '#f4f9fc'; ctx.font = '700 52px ' + font;
      ctx.fillText('让每一度电  持续创造价值', 70, H * 0.53);
      ctx.fillStyle = 'rgba(178,204,220,.85)'; ctx.font = '400 18px ' + font;
      ctx.fillText('Re-Pulse 移动式储能电芯主动活化巡检工作站', 70, H * 0.585);
      ctx.restore();
    }

    /* 片尾 */
    var outro = seg(t, 49.4, 51.0);
    if (outro > 0.01) {
      ctx.save(); ctx.globalAlpha = outro * 0.92;
      ctx.fillStyle = 'rgba(4,7,10,.72)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#eaf6ff'; ctx.font = '700 46px ' + font;
      ctx.fillText('RE-ENERGY', W / 2, H * 0.47);
      ctx.fillStyle = 'rgba(178,204,220,.9)'; ctx.font = '400 20px ' + font;
      ctx.fillText('重新上云 · 季度订阅 · 主动维护 · 回收转卖', W / 2, H * 0.545);
      ctx.fillStyle = '#7fdcff'; ctx.font = '500 15px ' + mono;
      ctx.fillText('Keep Every kWh Creating Value', W / 2, H * 0.60);
      ctx.restore();
    }

    /* 收尾淡出 */
    var fo = seg(t, DUR - 0.7, DUR);
    if (fo > 0) { ctx.fillStyle = 'rgba(3,5,8,' + fo + ')'; ctx.fillRect(0, 0, W, H); }

    /* 角标 */
    ctx.save();
    ctx.strokeStyle = 'rgba(150,190,215,.35)'; ctx.lineWidth = 2;
    [[26, 22, 1, 1], [W - 26, 22, -1, 1], [26, H - 22, 1, -1], [W - 26, H - 22, -1, -1]].forEach(function (p) {
      ctx.beginPath(); ctx.moveTo(p[0] + 22 * p[2], p[1]); ctx.lineTo(p[0], p[1]); ctx.lineTo(p[0], p[1] + 22 * p[3]); ctx.stroke();
    });
    ctx.restore();

    ctx.restore();   /* 结束 UI 缩放 */
  }

  /* ---------------------------------------------------------------- 录制 */
  var chunks = [], rec = null, stream = null;

  function startRec() {
    stream = out.captureStream(FPS);
    /* 优先 MP4(H.264)，可直接交付；不支持时回退 WebM */
    var types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    var mime = types.filter(function (m) { return MediaRecorder.isTypeSupported(m); })[0];
    if (mime && mime.indexOf('mp4') >= 0) NAME = NAME.replace(/\.webm$/i, '.mp4');
    rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: BR });
    rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    rec.start(1000);
    return mime;
  }

  function upload(blob) {
    /* file:// 下无法 POST（跨源被拦截），改为浏览器直接下载 */
    if (IS_FILE) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = NAME;
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      return Promise.resolve({ ok: true, downloaded: NAME, bytes: blob.size, via: 'file-download' });
    }
    return fetch('/upload?name=' + encodeURIComponent(NAME), { method: 'POST', body: blob })
      .then(function (r) { return r.json(); });
  }

  /* ---------------------------------------------------------------- 主循环 */
  var t0 = 0, running = false, frames = 0, scrFrame = 0, lastT = 0;

  function frame() {
    if (!running) return;
    var t = (performance.now() - t0) / 1000;
    if (t >= DUR) return finish();

    var dt = Math.min(0.05, Math.max(0, t - lastT)); lastT = t;
    updateScene(t);
    pulseApi.update(dt);                 /* 驱动拉杆保持展开 + LED 呼吸 */

    if (frames % 2 === 0) {
      renderScreen(t);
      scrFrame++;
    }

    renderer.render(scene, camera);
    drawHUD(t, frames);
    frames++;
    window.__p = { t: t, frames: frames };
    requestAnimationFrame(frame);
  }

  function finish() {
    /* 预览模式（rec=0）：循环播放，方便双击页面直接观看 */
    if (!REC) {
      if (!AUTO) { running = false; window.__done = { skipped: true }; return; }
      frames = 0; t0 = performance.now();
      requestAnimationFrame(frame);
      return;
    }
    running = false;
    var done = function () {
      var blob = new Blob(chunks, { type: (rec && rec.mimeType) || 'video/webm' });
      window.__size = blob.size;
      if (!REC) { window.__done = { skipped: true }; return; }
      upload(blob).then(function (r) { window.__done = r; })
        .catch(function (e) { window.__done = { error: String(e) }; });
    };
    if (rec && rec.state !== 'inactive') { rec.onstop = done; rec.stop(); }
    else done();
  }

  window.__start = function () {
    if (running) return 'already';
    /* 预热 */
    updateScene(0); drawScreen(0); scrTex.needsUpdate = true;
    renderer.render(scene, camera); drawHUD(0, 0);
    var mime = REC ? startRec() : 'preview';
    window.__mime = mime;
    var hud = document.getElementById('hud');
    if (hud) hud.textContent = REC
      ? '录制中 ' + W + 'x' + H + ' @' + FPS + 'fps · ' + DUR + 's · ' + mime
      : '预览播放 ' + W + 'x' + H + ' · ' + DUR + 's · 循环（加 ?rec=1 开始录制）';
    running = true; frames = 0;
    t0 = performance.now();
    requestAnimationFrame(frame);
    return 'started';
  };

  /* 调试：关键状态读数 */
  window.__dbg = function (t) {
    return {
      t: t,
      door: +cab.doorPivot.rotation.y.toFixed(3),
      bridge: bridge.group.position.toArray().map(function (v) { return Math.round(v); }),
      bridgeVisible: bridge.group.visible,
      drawRange: cables.map(function (c) { return c.mesh.geometry.drawRange.count; }),
      cableTotal: cables[0] ? cables[0].total : 0,
      pulse: pulseHolder.position.toArray().map(function (v) { return Math.round(v); }),
      cam: camera.position.toArray().map(function (v) { return +v.toFixed(2); }),
      fov: +camera.fov.toFixed(1),
      tris: renderer.info.render.triangles,
      terminalY: cables[0] ? Math.round(cables[0].conEnd.y) : 0,
      reelDoor: reelDoor ? reelDoor.position.toArray().map(function (v) { return Math.round(v); }) : null,
      linkDraw: linkCable.mesh.geometry.drawRange.count + '/' + linkCable.total,
      linkPlug: linkCable.plug.position.toArray().map(function (v) { return Math.round(v); }),
      conZ: cables.map(function (c) { return Math.round(c.con.position.z); }),
      walker: { v: walker.group.visible, o: +walker.mat.opacity.toFixed(2), p: walker.group.position.toArray().map(function (v) { return Math.round(v); }) },
      cellsBad: cellBlocks.filter(function (c) { return c.bad && c.mat.emissive.r > c.mat.emissive.g; }).length,
      trolleyY: trolleyNode ? +trolleyNode.position.y.toFixed(4) : null
    };
  };

  /* 调试：两张卡片的排版自检（真实测量文字宽度，返回超宽项） */
  window.__panelCheck = function () {
    var c = document.createElement('canvas').getContext('2d');
    var rows = [];
    function chk(name, s, size, weight, fam, max) {
      c.font = weight + ' ' + size + 'px ' + fam;
      var w = +c.measureText(s).width.toFixed(1);
      rows.push({ item: name, w: w, max: max, ok: w <= max, used: w <= max ? size : fitText(c, s, max, size, weight, fam) });
    }
    chk('SAFE.stats', '在线柜 128   断网柜 3（已救援）   今日告警 1', 15, '400', font, 388);
    chk('SAFE.cardRight', 'PACK 03 · 单体 #137', 14, '400', font, 137);
    chk('SAFE.cardRow4', '已推送工单 #2417 · 暂停充放电，转待机并现场核查', 13, '400', font, 360);
    chk('SAFE.foot1', '7×24h AI 预警 · 季度 SOH 诊断报告 · 断网重连', 14, '400', font, 388);
    chk('SAFE.foot2', 'SLA 基础版 999 元 / 柜 / 季度', 13, '500', mono, 388);
    ['C-01 · 2021-06', '2,417 次', '78.6 %', '3.1 %  (Grade A)'].forEach(function (s, i) {
      chk('PASS.row' + i, s, 17, '600', mono, 288);
    });
    chk('PASS.gradeA', 'Grade A → 厂区电动叉车 · 低速观光车', 15, '600', font, 360);
    chk('PASS.gradeB', 'Grade B → 离网光伏微网 · 农业灌溉储能', 14, '400', font, 360);
    chk('PASS.foot1', '残值评估 ¥42,000 · 多挽回 30–50% 退役残值', 15, '400', font, 388);
    chk('PASS.foot2', '平台撮合佣金 8%  →  ¥3,360 / 柜', 13, '500', mono, 388);
    /* 左下角字幕：可用宽度约 714px */
    CHAPTERS.forEach(function (c, i) {
      chk('SUB' + i, c.h, 30, '700', font, 714);
      chk('DESC' + i, c.d, 16, '400', font, 714);
    });

    /* 纵向：确认内容收在面板内 */
    var v = [
      { item: 'SAFE.panel', content: 258 + 20, box: 278 },
      { item: 'SAFE.card', content: 128 + 12, box: 146 },
      { item: 'PASS.panel', content: 308 + 20, box: 328 },
      { item: 'PASS.gradeBox', content: 54 + 18, box: 72 }
    ];
    v.forEach(function (r) { rows.push({ item: r.item, w: r.content, max: r.box, ok: r.content <= r.box, used: 0 }); });
    return { rows: rows, bad: rows.filter(function (r) { return !r.ok; }) };
  };

  /* 调试：视线遮挡检测 —— 相机→注视点连线是否被柜体挡住 */
  window.__occl = function (t) {
    updateScene(t);
    var s = SHOTS[SHOTS.length - 1];
    for (var i = 0; i < SHOTS.length; i++) { if (t >= SHOTS[i].t0 && t < SHOTS[i].t1) { s = SHOTS[i]; break; } }
    var k = ease(seg(t, s.t0, s.t1));
    var tgt = new T.Vector3(lerp(s.f.tx, s.t.tx, k), lerp(s.f.ty, s.t.ty, k), lerp(s.f.tz, s.t.tz, k));
    var dir = tgt.clone().sub(camera.position);
    var dist = dir.length(); dir.normalize();
    var rc = new T.Raycaster(camera.position.clone(), dir, 0.01, dist - 0.02);
    var hits = rc.intersectObject(cab.group, true);
    return {
      t: t, dist: +dist.toFixed(2), blocked: hits.length > 0,
      hit: hits.length ? +hits[0].distance.toFixed(2) : null,
      obj: hits.length ? (hits[0].object.name || hits[0].object.type) : null
    };
  };

  /* 调试：单帧预览（不录制），用于校对各时间点的画面 */
  window.__seek = function (t) {
    updateScene(t);
    renderScreen(t);
    renderer.render(scene, camera);
    drawHUD(t, Math.round(t * FPS));
    return true;
  };

  window.__ready = true;

  /* ---------------------------------------------------------------- 逐帧出图
     MediaRecorder 的 canvas 录制是可变帧率，开头丢帧会被 CFR 转换复制成"卡住"、
     后段密集帧被抽成"闪现"。seq 模式改为按固定时间步渲染并逐帧回传，
     由 ffmpeg 以精确帧率编码，结果与实时性能无关。
     ------------------------------------------------------------------------ */
  function postFrame(i) {
    return new Promise(function (res) {
      out.toBlob(function (b) {
        if (!b) return res();
        fetch('/frame?idx=' + i, { method: 'POST', body: b })
          .then(function () { res(); }, function () { res(); });
      }, 'image/jpeg', 0.94);
    });
  }

  async function runSeq() {
    var N = Math.round(DUR * FPS);
    /* 预热两帧，确保着色器编译完成，避免首帧异常 */
    for (var w = 0; w < 2; w++) { updateScene(0); drawScreen(0); renderer.render(scene, camera); drawHUD(0, 0); }
    for (var i = 0; i < N; i++) {
      var t = i / FPS;
      updateScene(t);
      renderScreen(t);
      renderer.render(scene, camera);
      drawHUD(t, i);
      await postFrame(i);
      if (i % 10 === 0 || i === N - 1) window.__p = { t: +t.toFixed(2), frames: i + 1, total: N, seq: true };
    }
    window.__done = { ok: true, seq: N, fps: FPS, name: NAME };
  }

  /* ---------------------------------------------------------------- 自动启动
     1) 立刻渲染首帧，避免打开页面时黑屏
     2) 默认自动播放；seq=1 逐帧出图，否则 http 下录制上传、file:// 下仅预览
     ------------------------------------------------------------------------ */
  try { window.__seek(0); } catch (e) { window.__err = String(e); }
  var hud = document.getElementById('hud');
  if (hud && window.__err) hud.textContent = 'ERROR ' + window.__err;
  if (AUTO) {
    setTimeout(function () {
      if (SEQ) runSeq(); else window.__start();
    }, 150);
  }
})();
