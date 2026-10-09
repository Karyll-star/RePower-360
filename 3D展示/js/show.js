/* ============================================================================
   RE-ENERGY 沉浸式滚动叙事（适配 TS 高保真新模型）
   —— 模型来自 new/src/three/{rePulse,reBridge}.ts，经 js/lib/remodel.js 打包引入
       米制单位、自带 ScreenUI / 爆炸动画 / LED 与风扇动效
   —— 滚动即导演：分镜表（权重 / 缓动 / 方位角增量 / 焦距 / 标注 / 尺寸线）
   ========================================================================== */
(function () {
  'use strict';

  var RM = window.REMODEL;
  var T = null;                                  /* start() 里取，保证与 bundle 同源 */
  var clamp, lerp;
  var TWO_PI = Math.PI * 2;

  /* ==========================================================================
     全局节奏
     ========================================================================== */
  var VH_PER_W = 0.80;          /* 每个分镜权重对应的滚动屏数（桌面） */
  var VH_PER_W_M = 0.55;        /* 移动端缩短 */
  var FADE_MAX = 0.045;         /* 章节文案淡入淡出宽度 */
  var LBL_FADE = 0.34;          /* 标注淡入淡出 = 章节长度的该比例 */

  var isMobile = (window.matchMedia && window.matchMedia('(max-width: 900px)').matches)
    || window.innerWidth < 900;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ==========================================================================
     部件标注文案（对应新模型的 anchors id）
     ========================================================================== */
  var LABELS = {
    pulse: {
      screen: ['10.1" 工业触控屏', '四种工作模式 · 实时曲线'],
      estop: ['E-STOP 急停', '红蘑菇头 + 黄底座 · 断开输出继电器'],
      cables: ['线缆仓 · Probe Dock', '侧面抽出式线缆管理'],
      trolley: ['双杆伸缩拉杆', 'TPE 防滑握把 + 释放按钮'],
      wheel: ['重载轮组', '两轮 + 前部支撑脚']
    },
    bridge: {
      bridge: ['RE-BRIDGE 边缘网关', '磁吸式多协议 · CAN / RS485 / ETH'],
      ports: ['侧部接口区', 'Ethernet · USB Service · 接线端子'],
      antenna: ['SMA 全向天线', '5G / 4G 全网通上行']
    }
  };

  /* ==========================================================================
     分镜表
       chap = 章节索引      w = 滚动长度权重     ease = 0 匀速 / 1 缓入缓出
       dth  = 方位角增量    phi = 极角（≈π/2 水平，越小越俯视）
       rf   = 机位距离 / 机身总高（自动按模型实测高度换算）
       hf   = 注视高度 / 机身总高；指定 aim 时以模型锚点为准
       aim  = 以某个部件锚点为注视中心
       lb   = 该分镜点亮的部件标注
       dim  = 显示尺寸线      boom = 触发爆炸展示
       fov  = 竖直视角
     ========================================================================== */

  var PULSE = {
    id: 'pulse', name: 'RE-PULSE', kind: 'pulse',
    start: { theta: -0.62, phi: 1.10, rf: 2.34, hf: 0.46, fov: 38 },
    chapters: [
      {
        code: 'INTRO', side: 'left', tag: 'h1',
        h: '让每一度电<br><em>持续创造价值</em>',
        desc: 'Keep every kWh creating value. 一台为后市场而生的移动式储能电芯主动活化巡检工作站 —— 向下滚动，开始检视。',
        specs: [['主动', '电芯活化'], ['便携', '拉杆 + 两轮'], ['在线', '网关互联']]
      },
      { code: 'ORBIT', side: 'right', h: '360°<br>全方位环视', desc: '机位环绕一周 —— 比例、姿态与每一处结构细节一览无余。' },
      {
        code: 'FRONT · HMI', side: 'left', h: '正面<br><em>人机界面</em>',
        desc: '大尺寸工业触控屏 + 实体旋钮 + 功能按键 + E-STOP。<br>数字化通过屏幕表达，关键操作仍保留实体件。'
      },
      {
        code: 'SIDE · CABLE', side: 'right', h: '侧部<br><em>线缆管理</em>',
        desc: '独立的线缆仓与探针收纳区，<br>线缆不裸露，抽拉即走。'
      },
      {
        code: 'BACK · TROLLEY', side: 'left', h: '背面<br><em>移动性</em>',
        desc: '双杆伸缩拉杆 + 散热风道集中布置在背面，<br>推行姿态是一个人也能完成的重量。'
      },
      {
        code: 'LOW ANGLE', side: 'right', h: '地面视角<br><em>工业力量感</em>',
        desc: '镜头压到轮轴高度 —— 轮组、支撑脚与贴地重心，<br>宣示"随时可以出发"。'
      },
      {
        code: 'DIMENSION', side: 'left', h: '尺寸<br><em>可搬运的边界</em>', dyn: 'dims',
        desc: '整机轮廓按实测数据标注 ——<br>能进电梯、能上车的尺寸，才谈得上移动巡检。'
      },
      {
        code: 'EXPLODE', side: 'right', h: '拆解<br><em>模块化层级</em>',
        desc: '上盖、控制台、下壳体、内部模组与风扇沿装配轴分离，<br>维护只换模块，不换整机。'
      },
      {
        code: 'NEXT', side: 'left', h: '现在<br><em>自由检视</em>',
        desc: '进入工程模式，可自由旋转、切换视角、<br>触发急停 / 拉杆 / 屏幕交互并导出效果图。',
        cta: '<a href="new/dist/index.html">进入交互模式<i>↗</i></a>'
      }
    ],
    shots: [
      { n: 'HERO', chap: 0, w: 1.10, ease: 1.00, dth: 0.62, phi: 1.05, rf: 2.07, hf: 0.46, fov: 38 },
      { n: 'ORBIT', chap: 1, w: 2.20, ease: 0.25, dth: -TWO_PI, phi: 1.17, rf: 1.96, hf: 0.44, fov: 38, lb: ['screen', 'estop', 'cables', 'trolley', 'wheel'] },
      { n: 'FRONT', chap: 2, w: 1.00, ease: 0.80, dth: 0.00, phi: 1.30, rf: 1.45, fov: 40, aim: 'screen', lb: ['screen', 'estop'] },
      { n: 'HMI', chap: 2, w: 0.90, ease: 0.35, dth: 0.12, phi: 1.26, rf: 1.36, fov: 36, aim: 'screen', lb: ['screen', 'estop'] },
      { n: 'CABLE', chap: 3, w: 1.10, ease: 0.75, dth: -1.57, phi: 1.12, rf: 1.77, hf: 0.42, fov: 38, lb: ['cables'] },
      { n: 'TROLLEY', chap: 4, w: 1.10, ease: 0.75, dth: -1.57, phi: 1.10, rf: 1.77, hf: 0.46, fov: 38, lb: ['trolley'] },
      { n: 'BACK-IN', chap: 4, w: 0.80, ease: 0.35, dth: -0.22, phi: 1.14, rf: 1.31, fov: 40, aim: 'trolley', lb: ['trolley'] },
      { n: 'DESCEND', chap: 5, w: 0.85, ease: 0.85, dth: -1.15, phi: 1.495, rf: 1.24, hf: 0.19, fov: 44 },
      { n: 'CREEP', chap: 5, w: 2.40, ease: 0.12, dth: -0.35, phi: 1.515, rf: 1.18, hf: 0.15, fov: 46 },
      { n: 'SWEEP', chap: 5, w: 0.95, ease: 0.55, dth: -1.20, phi: 1.505, rf: 1.30, hf: 0.17, fov: 42, lb: ['wheel'] },
      { n: 'DIM', chap: 6, w: 1.20, ease: 0.80, dth: -0.30, phi: 1.02, rf: 2.82, hf: 0.44, fov: 34, dim: 1 },
      { n: 'DIM-HOLD', chap: 6, w: 0.70, ease: 0.20, dth: -0.15, phi: 0.98, rf: 2.92, hf: 0.44, fov: 34, dim: 1 },
      { n: 'RISE', chap: 7, w: 1.30, ease: 0.85, dth: 0.55, phi: 0.46, rf: 3.15, hf: 0.60, fov: 38, boom: 1 },
      { n: 'EXPLODE', chap: 7, w: 1.40, ease: 0.20, dth: -0.45, phi: 0.40, rf: 3.35, hf: 0.62, fov: 36, boom: 1 },
      { n: 'EXP-DRIFT', chap: 7, w: 0.80, ease: 0.35, dth: -0.40, phi: 0.58, rf: 3.25, hf: 0.62, fov: 36, boom: 1 },
      { n: 'OUTRO', chap: 8, w: 1.00, ease: 1.00, dth: 0.30, phi: 0.98, rf: 2.07, hf: 0.45, fov: 38 }
    ]
  };

  var BRIDGE = {
    id: 'bridge', name: 'RE-BRIDGE', kind: 'bridge',
    start: { theta: -0.62, phi: 1.05, rf: 2.42, hf: 0.46, fov: 38 },
    chapters: [
      {
        code: 'INTRO', side: 'left', tag: 'h1',
        h: '一推一扣<br><em>即刻联网</em>',
        desc: 'Re-Bridge 磁吸式多协议边缘网关。<br>把 Re-Pulse 的每一次检测，接进你的系统。',
        specs: [['便携', '巴掌大小'], ['多协议', 'CAN / RS485'], ['上行', '5G / 4G']]
      },
      { code: 'ORBIT', side: 'right', h: '金属机加工感<br><em>工业级外壳</em>', desc: '压铸外壳 + 端板螺钉 + 细状态光带，<br>与 Re-Pulse 共用同一套设计 DNA。' },
      { code: 'FRONT · STATUS', side: 'left', h: '细状态光带<br><em>一眼判读</em>', desc: '蓝牙联网 / 正常 / 异常 / 故障通过光带与 LED 表达，<br>不用凑近看屏幕也能读懂状态。' },
      { code: 'I/O', side: 'right', h: '接口区<br><em>即插即用</em>', desc: '侧部 Ethernet · USB Service · 接线端子，<br>顶部 SMA 天线接口引出到机柜外。' },
      { code: 'DEPLOY', side: 'left', h: '贴地部署<br><em>随手即放</em>', desc: '磁吸底座一推一扣即可固定，<br>小体积意味着它能出现在任何巡检动线上。' },
      { code: 'DIMENSION', side: 'right', h: '尺寸<br><em>工业级规格</em>', dyn: 'dims', desc: '实测外廓尺寸在此标注 ——<br>能塞进电柜角落，也能随手吸在 Re-Pulse 上带走。' },
      {
        code: 'NEXT', side: 'left', h: '现在<br><em>自由检视</em>',
        desc: '进入工程模式，可自由旋转、切换视角与灯光，<br>并导出高保真渲染图。',
        cta: '<a href="new/dist/index.html">进入交互模式<i>↗</i></a>'
      }
    ],
    shots: [
      { n: 'HERO', chap: 0, w: 1.00, ease: 1.00, dth: 0.45, phi: 1.05, rf: 2.20, hf: 0.46, fov: 38 },
      { n: 'ORBIT', chap: 1, w: 2.00, ease: 0.25, dth: -TWO_PI, phi: 1.15, rf: 2.07, hf: 0.44, fov: 38, lb: ['bridge', 'ports', 'antenna'] },
      { n: 'FRONT', chap: 2, w: 1.00, ease: 0.80, dth: 0.20, phi: 1.26, rf: 1.67, fov: 36, aim: 'bridge', lb: ['bridge'] },
      { n: 'STATUS', chap: 2, w: 0.90, ease: 0.35, dth: 0.15, phi: 1.22, rf: 1.42, fov: 34, aim: 'bridge', lb: ['bridge'] },
      { n: 'PORTS', chap: 3, w: 1.00, ease: 0.75, dth: 1.45, phi: 1.10, rf: 1.88, hf: 0.40, fov: 36, lb: ['ports', 'antenna'] },
      { n: 'ANTENNA', chap: 3, w: 0.90, ease: 0.35, dth: 0.22, phi: 1.05, rf: 1.56, fov: 34, aim: 'antenna', lb: ['antenna'] },
      { n: 'DEPLOY', chap: 4, w: 1.20, ease: 0.80, dth: -2.60, phi: 1.42, rf: 1.25, hf: 0.18, fov: 44, lb: ['ports'] },
      { n: 'DEPLOY-HOLD', chap: 4, w: 0.80, ease: 0.20, dth: -0.55, phi: 1.46, rf: 1.15, hf: 0.16, fov: 46 },
      { n: 'DIM', chap: 5, w: 1.20, ease: 0.80, dth: -0.60, phi: 1.02, rf: 2.82, hf: 0.44, fov: 34, dim: 1 },
      { n: 'DIM-HOLD', chap: 5, w: 0.70, ease: 0.20, dth: -0.25, phi: 0.98, rf: 2.92, hf: 0.44, fov: 34, dim: 1 },
      { n: 'OUTRO', chap: 6, w: 1.00, ease: 1.00, dth: 0.60, phi: 1.00, rf: 2.14, hf: 0.46, fov: 38 }
    ]
  };

  var SHOWS = { pulse: PULSE, bridge: BRIDGE };

  /* ==========================================================================
     运行时状态
     ========================================================================== */
  var scene, camera, renderer, composer, bloom, stageApi, clock, labels;
  var pulseModel = null, bridgeModel = null;
  var MODELS = {};                       /* id -> { api, group, H, k, size, anchors } */
  var cur = null, KEYS = [], CHAP_RANGES = [], CHAP_FADE = [];
  var TOTAL_W = 1;

  var p = 0, pRaw = 0, pMax = 1, FORCE_P = null;
  var mouse = { x: 0, y: 0 }, mouseGoal = { x: 0, y: 0 };
  var lastSi = -1, lastChap = -1, boomState = false;

  var elChapters, elDots, elLabels, elRailFill, elChapIdx, elTrack, elHint;
  var elAz, elEl, elD, elF;
  var chaps = [], dots = [];

  /* ==========================================================================
     工具
     ========================================================================== */
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function groundProduct(group) {
    group.position.set(0, 0, 0);
    group.updateMatrixWorld(true);
    var b = new T.Box3().setFromObject(group);
    var c = b.getCenter(new T.Vector3());
    group.position.x -= c.x;
    group.position.z -= c.z;
    group.position.y -= b.min.y;
    group.updateMatrixWorld(true);
    return new T.Box3().setFromObject(group);
  }

  /* ==========================================================================
     场景
     ========================================================================== */
  function initScene() {
    var canvas = document.getElementById('gl');
    renderer = new T.WebGLRenderer({ canvas: canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.85;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFShadowMap;

    scene = new T.Scene();
    camera = new T.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.02, 60);

    stageApi = RM.installStage(scene, renderer);
    stageApi.fit(camera.aspect);

    var fx = RM.makeComposer(renderer, scene, camera, window.innerWidth, window.innerHeight);
    composer = fx.composer; bloom = fx.bloom;

    labels = new window.RE.Labels(document.getElementById('labels'));

    window.addEventListener('resize', onResize);
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    composer.setSize(window.innerWidth, window.innerHeight);
    bloom.resolution.set(window.innerWidth / 2, window.innerHeight / 2);
    stageApi.fit(camera.aspect);
    layoutTrack();
  }

  /* ==========================================================================
     构建产品（只建一次，之后切可见性）
     ========================================================================== */
  function buildModels() {
    var mats = RM.createMaterials();
    var screenUI = new RM.ScreenUI();

    pulseModel = RM.buildRePulse(mats, screenUI);
    bridgeModel = RM.buildReBridge(mats);

    registerModel('pulse', pulseModel);
    registerModel('bridge', bridgeModel);

    scene.add(pulseModel.group, bridgeModel.group);
  }

  function registerModel(id, api) {
    /* 先让模型自身动画收敛（拉杆伸出 ~0.3m），否则实测高度偏小、机位全部过近 */
    if (api.update) { for (var i = 0; i < 180; i++) api.update(1 / 60); }
    var box = groundProduct(api.group);
    var size = box.getSize(new T.Vector3());
    var H = Math.max(0.05, size.y);

    /* 锚点：局部坐标 + 世界坐标 */
    var local = {}, world = {};
    api.anchors.forEach(function (a) {
      var wv = new T.Vector3();
      a.obj.updateMatrixWorld(true);
      a.obj.getWorldPosition(wv);
      var lv = api.group.worldToLocal(wv.clone());
      local[a.id] = lv;
      world[a.id] = wv;
    });

    MODELS[id] = { api: api, group: api.group, H: H, size: size, local: local, world: world, dimInfo: null };
  }

  function sizeOf(id) {
    var m = MODELS[id];
    return { W: m.size.x, H: m.size.y, D: m.size.z };
  }

  /* 米制尺寸线 */
  function buildDimLines(S) {
    var W = S.W, H = S.H, D = S.D;
    var off = Math.max(W, D) * 0.22 + 0.06;
    var pts = [], anchors = [];
    function seg(a, b) { pts.push(a[0], a[1], a[2], b[0], b[1], b[2]); }
    function tick(p, d, l) {
      seg([p[0] - d[0] * l, p[1] - d[1] * l, p[2] - d[2] * l], [p[0] + d[0] * l, p[1] + d[1] * l, p[2] + d[2] * l]);
    }
    var zf = D / 2 + off, yb = -off * 0.5;

    /* 宽 */
    seg([-W / 2, yb, zf], [W / 2, yb, zf]);
    tick([-W / 2, yb, zf], [0, 1, 0], off * 0.16);
    tick([W / 2, yb, zf], [0, 1, 0], off * 0.16);
    seg([-W / 2, 0, zf], [-W / 2, yb - off * 0.16, zf]);
    seg([W / 2, 0, zf], [W / 2, yb - off * 0.16, zf]);
    anchors.push({ p: [0, yb, zf], t: '宽 ' + Math.round(W * 1000) + ' mm', kind: 'dim' });

    /* 深 */
    var x1 = W / 2 + off * 0.6;
    seg([x1, yb, -D / 2], [x1, yb, D / 2]);
    tick([x1, yb, -D / 2], [0, 1, 0], off * 0.16);
    tick([x1, yb, D / 2], [0, 1, 0], off * 0.16);
    anchors.push({ p: [x1, yb, D * 0.1], t: '深 ' + Math.round(D * 1000) + ' mm', kind: 'dim' });

    /* 高 */
    var x2 = -W / 2 - off * 0.6;
    seg([x2, 0, zf], [x2, H, zf]);
    tick([x2, 0, zf], [1, 0, 0], off * 0.16);
    tick([x2, H, zf], [1, 0, 0], off * 0.16);
    seg([x2, 0, D / 2], [x2, 0, zf]);
    seg([x2, H, D / 2], [x2, H, zf]);
    anchors.push({ p: [x2, H / 2, zf], t: '高 ' + Math.round(H * 1000) + ' mm', kind: 'dim' });

    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
    var lines = new T.LineSegments(geo, new T.LineBasicMaterial({ color: 0x64d2ff, transparent: true, opacity: 0.8 }));
    lines.frustumCulled = false;
    return { group: lines, anchors: anchors };
  }

  /* ==========================================================================
     切换产品
     ========================================================================== */
  function selectProduct(id) {
    var m = MODELS[id];
    var S = SHOWS[id];
    cur = S;

    pulseModel.group.visible = (id === 'pulse');
    bridgeModel.group.visible = (id === 'bridge');
    if (MODELS.pulse.dimInfo) MODELS.pulse.dimInfo.group.visible = false;
    if (MODELS.bridge.dimInfo) MODELS.bridge.dimInfo.group.visible = false;
    if (pulseModel.setExploded) pulseModel.setExploded(false);
    boomState = false;

    if (!m.dimInfo) {
      m.dimInfo = buildDimLines(sizeOf(id));
      m.group.add(m.dimInfo.group);
    }
    stageApi.solo(0, 0);

    buildTimeline(S);
    buildChapters(S);
    layoutTrack();

    lastSi = -1; lastChap = -1;
    p = pRaw = 0;
    window.scrollTo(0, 0);
  }

  /* ==========================================================================
     时间轴
     ========================================================================== */
  function buildTimeline(S) {
    var i, total = 0;
    for (i = 0; i < S.shots.length; i++) total += S.shots[i].w;
    TOTAL_W = total;

    var m = MODELS[S.id], H = m.H;
    var acc = 0, th = S.start.theta, hfPrev = S.start.hf;

    KEYS = [{
      at: 0, ease: 0, shot: 0,
      theta: th, phi: S.start.phi, radius: S.start.rf * H,
      tx: 0, ty: S.start.hf * H, tz: 0, fov: S.start.fov
    }];

    for (i = 0; i < S.shots.length; i++) {
      var s = S.shots[i];
      th += s.dth;
      acc += s.w;
      s.t0 = (acc - s.w) / total;
      s.t1 = acc / total;

      var tx = 0, ty, tz = 0;
      if (s.aim && m.world[s.aim]) {
        tx = m.world[s.aim].x; ty = m.world[s.aim].y; tz = m.world[s.aim].z;
      } else {
        ty = (s.hf != null ? s.hf : hfPrev) * H;
      }
      hfPrev = ty / H;

      KEYS.push({
        at: s.t1, ease: (s.ease != null ? s.ease : 1), shot: i,
        theta: th, phi: s.phi, radius: s.rf * H,
        tx: tx, ty: ty, tz: tz, fov: (s.fov || 38)
      });
    }

    CHAP_RANGES = []; CHAP_FADE = [];
    for (i = 0; i < S.chapters.length; i++) CHAP_RANGES.push(null);
    for (i = 0; i < S.shots.length; i++) {
      var c = S.shots[i].chap;
      if (c == null || c < 0) continue;
      if (!CHAP_RANGES[c]) CHAP_RANGES[c] = [S.shots[i].t0, S.shots[i].t1];
      else {
        CHAP_RANGES[c][0] = Math.min(CHAP_RANGES[c][0], S.shots[i].t0);
        CHAP_RANGES[c][1] = Math.max(CHAP_RANGES[c][1], S.shots[i].t1);
      }
    }
    for (i = 0; i < CHAP_RANGES.length; i++) {
      if (!CHAP_RANGES[i]) { CHAP_RANGES[i] = [0, 0]; CHAP_FADE.push(FADE_MAX); continue; }
      if (i === 0) CHAP_RANGES[i][0] = -FADE_MAX;
      if (i === CHAP_RANGES.length - 1) CHAP_RANGES[i][1] = 1.5;
      CHAP_FADE.push(Math.min(FADE_MAX, (CHAP_RANGES[i][1] - CHAP_RANGES[i][0]) * LBL_FADE));
    }
  }

  /* ==========================================================================
     章节文案（尺寸章节的数值由实测模型生成）
     ========================================================================== */
  function chapterSpecs(c, id) {
    if (c.dyn === 'dims') {
      var s = sizeOf(id);
      return [
        [String(Math.round(s.W * 1000)), '宽 mm'],
        [String(Math.round(s.H * 1000)), '高 mm'],
        [String(Math.round(s.D * 1000)), '深 mm']
      ];
    }
    return c.specs || null;
  }

  function buildChapters(S) {
    var n = S.chapters.length, i, html = '', dotsHtml = '';
    for (i = 0; i < n; i++) {
      var c = S.chapters[i];
      html += '<section class="chap ' + (c.side === 'right' ? 'chap-right' : 'chap-left') + '">';
      html += '<p class="eyebrow">' + pad(i + 1) + ' / ' + pad(n) + ' — ' + c.code + '</p>';
      html += '<' + (c.tag || 'h2') + '>' + c.h + '</' + (c.tag || 'h2') + '>';
      if (c.desc) html += '<p class="desc">' + c.desc + '</p>';
      var sp = chapterSpecs(c, S.id);
      if (sp) {
        html += '<ul class="specs">';
        for (var k = 0; k < sp.length; k++) html += '<li><b>' + sp[k][0] + '</b><i>' + sp[k][1] + '</i></li>';
        html += '</ul>';
      }
      if (c.cta) html += '<div class="cta">' + c.cta + '</div>';
      html += '</section>';

      var r = CHAP_RANGES[i];
      dotsHtml += '<b data-i="' + i + '" style="top:' + (r ? Math.max(0, r[0]) * 100 : 0).toFixed(2) + '%" title="' + c.code + '"></b>';
    }
    elChapters.innerHTML = html;
    elDots.innerHTML = dotsHtml;
    chaps = [].slice.call(elChapters.querySelectorAll('.chap'));
    dots = [].slice.call(elDots.querySelectorAll('b'));
    dots.forEach(function (d) {
      d.addEventListener('click', function () {
        var i = parseInt(d.getAttribute('data-i'), 10);
        window.scrollTo({ top: Math.max(0, CHAP_RANGES[i][0]) * pMax + 4, behavior: 'smooth' });
      });
    });
  }

  function layoutTrack() {
    var per = isMobile ? VH_PER_W_M : VH_PER_W;
    elTrack.style.height = (100 + TOTAL_W * per * 100).toFixed(0) + 'vh';
    measureScroll();
  }

  function measureScroll() {
    pMax = Math.max(1, elTrack.offsetHeight - window.innerHeight);
  }

  /* ==========================================================================
     每分镜：标注 / 尺寸线 / 爆炸
     ========================================================================== */
  function applyShot(si) {
    var s = cur.shots[si];
    if (!s) return;
    var m = MODELS[cur.id];

    if (m.dimInfo) m.dimInfo.group.visible = !!s.dim;

    if (s.dim) {
      labels.set(m.dimInfo.anchors, m.group, 'dim');
    } else if (s.lb && s.lb.length) {
      var dict = LABELS[cur.id], list = [];
      for (var i = 0; i < s.lb.length; i++) {
        var id = s.lb[i], lp = m.local[id];
        if (!lp) continue;
        list.push({ p: [lp.x, lp.y, lp.z], t: dict[id][0], s: dict[id][1] });
      }
      labels.set(list, m.group, cur.kind);
    } else {
      labels.clear();
    }

    /* 爆炸：新模型是布尔触发 + 内部缓动 */
    if (cur.id === 'pulse' && pulseModel.setExploded) {
      var want = !!s.boom;
      if (want !== boomState) { boomState = want; pulseModel.setExploded(want); }
    }
  }

  /* ==========================================================================
     求值
     ========================================================================== */
  function keyAt(prog) {
    var a = KEYS[0], b = KEYS[KEYS.length - 1];
    for (var i = 0; i < KEYS.length - 1; i++) {
      if (prog >= KEYS[i].at && prog <= KEYS[i + 1].at) { a = KEYS[i]; b = KEYS[i + 1]; break; }
    }
    var raw = clamp((prog - a.at) / Math.max(1e-6, b.at - a.at), 0, 1);
    var t = raw + (smooth(raw) - raw) * b.ease;
    return {
      theta: lerp(a.theta, b.theta, t), phi: lerp(a.phi, b.phi, t),
      radius: lerp(a.radius, b.radius, t),
      tx: lerp(a.tx, b.tx, t), ty: lerp(a.ty, b.ty, t), tz: lerp(a.tz, b.tz, t),
      fov: lerp(a.fov, b.fov, t), si: b.shot
    };
  }

  function chapOpacity(i, prog) {
    var r = CHAP_RANGES[i];
    if (!r) return 0;
    var f = CHAP_FADE[i] || FADE_MAX;
    return Math.min(clamp((prog - r[0]) / f, 0, 1), clamp((r[1] - prog) / f, 0, 1));
  }

  function curChapter(prog) {
    var idx = 0;
    for (var i = 0; i < CHAP_RANGES.length; i++) {
      if (CHAP_RANGES[i] && prog >= CHAP_RANGES[i][0]) idx = i;
    }
    return idx;
  }

  function syncUI(k, ci) {
    var i;
    for (i = 0; i < chaps.length; i++) {
      var op = chapOpacity(i, p), el = chaps[i];
      el.style.opacity = op.toFixed(3);
      el.style.visibility = op <= 0.001 ? 'hidden' : 'visible';
      var mid = (CHAP_RANGES[i][0] + CHAP_RANGES[i][1]) / 2;
      el.style.transform = 'translateY(calc(-50% + ' + ((1 - op) * 26 * (p < mid ? 1 : -1)).toFixed(1) + 'px))';
    }

    elRailFill.style.height = (p * 100).toFixed(2) + '%';
    var txt = pad(ci + 1) + '<span>/ ' + pad(chaps.length) + '</span>';
    if (elChapIdx.innerHTML !== txt) elChapIdx.innerHTML = txt;
    for (i = 0; i < dots.length; i++) dots[i].classList.toggle('on', i === ci);

    elHint.style.opacity = p < 0.012 ? '1' : '0';

    var az = ((-k.theta * 180 / Math.PI) % 360 + 360) % 360;
    var elv = (90 - k.phi * 180 / Math.PI);
    elAz.textContent = String(Math.round(az)).padStart(3, '0');
    elEl.textContent = (elv >= 0 ? '+' : '') + Math.round(elv);
    elD.textContent = k.radius.toFixed(2);
    elF.textContent = Math.round(k.fov);

    var s = cur.shots[k.si];
    elLabels.style.opacity = ((s && (s.lb || s.dim)) ? chapOpacity(ci, p) : 0).toFixed(3);
  }

  /* ==========================================================================
     主循环
     ========================================================================== */
  function loop() {
    var dt = Math.min(0.06, clock.getDelta());

    p += (pRaw - p) * (reduceMotion ? 0.55 : (1 - Math.pow(0.001, dt)));
    mouse.x += (mouseGoal.x - mouse.x) * 0.05;
    mouse.y += (mouseGoal.y - mouse.y) * 0.05;

    var k = keyAt(p);
    if (k.si !== lastSi) { lastSi = k.si; applyShot(k.si); }

    /* 新模型自身动效（LED / 风扇 / 爆炸缓动） */
    if (pulseModel.update) pulseModel.update(dt);
    if (bridgeModel.update) bridgeModel.update(dt);

    var theta = k.theta + mouse.x * 0.05;
    var phi = clamp(k.phi + mouse.y * 0.04, 0.10, 1.545);

    if (Math.abs(camera.fov - k.fov) > 0.01) { camera.fov = k.fov; camera.updateProjectionMatrix(); }

    camera.position.setFromSpherical(new T.Spherical(k.radius, phi, theta));
    camera.position.x += k.tx; camera.position.y += k.ty; camera.position.z += k.tz;
    camera.lookAt(k.tx, k.ty, k.tz);
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();

    var ci = curChapter(p);
    lastChap = ci;
    syncUI(k, ci);
    labels.update(camera, { w: renderer.domElement.clientWidth, h: renderer.domElement.clientHeight });

    composer.render(dt);
    requestAnimationFrame(loop);
  }

  /* ==========================================================================
     交互
     ========================================================================== */
  function bindInput() {
    window.addEventListener('scroll', function () {
      pRaw = (FORCE_P != null ? FORCE_P : clamp(window.scrollY / pMax, 0, 1));
    }, { passive: true });

    window.addEventListener('mousemove', function (e) {
      mouseGoal.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseGoal.y = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });

    var btns = document.querySelectorAll('#switch button');
    [].forEach.call(btns, function (b) {
      b.addEventListener('click', function () { switchTo(b.getAttribute('data-p')); });
    });

    window.addEventListener('keydown', function (e) {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      if (e.key === '1') switchTo('pulse');
      else if (e.key === '2') switchTo('bridge');
    });
  }

  function switchTo(id) {
    if (!SHOWS[id]) return;
    var btns = document.querySelectorAll('#switch button');
    [].forEach.call(btns, function (x) { x.classList.toggle('on', x.getAttribute('data-p') === id); });
    if (!cur || cur.id !== id) selectProduct(id);
  }

  /* ==========================================================================
     启动
     ========================================================================== */
  function start() {
    if (!RM) throw new Error('未找到 REMODEL，请确认 js/lib/remodel.js 已加载');
    T = window.THREE;
    clamp = window.RE.clamp; lerp = window.RE.lerp;

    elChapters = document.getElementById('chapters');
    elDots = document.getElementById('rail-dots');
    elLabels = document.getElementById('labels');
    elRailFill = document.getElementById('rail-fill');
    elChapIdx = document.getElementById('chap-idx');
    elTrack = document.getElementById('track');
    elHint = document.getElementById('scroll-hint');
    elAz = document.getElementById('cam-az');
    elEl = document.getElementById('cam-el');
    elD = document.getElementById('cam-d');
    elF = document.getElementById('cam-f');

    var h = location.hash || '';
    var m = /p=([\d.]+)/.exec(h);
    if (m) FORCE_P = clamp(parseFloat(m[1]), 0, 1);

    initScene();
    buildModels();
    bindInput();
    selectProduct(/bridge/i.test(h) ? 'bridge' : 'pulse');
    pRaw = p = (FORCE_P != null ? FORCE_P : clamp(window.scrollY / pMax, 0, 1));

    clock = new T.Clock();
    loop();
    window.__SHOWCAM = camera;   /* 供构图校验脚本读取 */

    /* 调试信息：便于核对机位与实测尺寸 */
    window.__SHOW = {
      get p() { return p; },
      sizes: { pulse: sizeOf('pulse'), bridge: sizeOf('bridge') },
      info: function () { return renderer.info.render; },
      scene: function () { return scene; },
      model: function () { return cur ? MODELS[cur.id].group : null; },
      camera: function () { return camera.position.toArray().map(function (v) { return +v.toFixed(3); }); },
      keys: function () { return KEYS; },
      chapters: function () { return CHAP_RANGES; }
    };

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
