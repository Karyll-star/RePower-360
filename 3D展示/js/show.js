/* ============================================================================
   RE-ENERGY 3D 沉浸式滚动叙事（正式版）
   —— 滚动即导演：分镜表（权重 / 缓动 / 方位角增量 / 焦距 / 标注 / 尺寸线）
       驱动相机在整机周围做 360° 环绕、正前特写、侧面、背面、贴地推进、
       尺寸丈量与俯视拆解。
   复用 studio.js 的影棚环境 / 灯光 / 展台，repulse.js 与 rebridge.js 的产品模型
   ========================================================================== */
(function () {
  'use strict';
  var T = THREE;
  var RE = window.RE;
  var clamp = RE.clamp, lerp = RE.lerp;
  var TWO_PI = Math.PI * 2;

  /* ==========================================================================
     全局节奏
     ========================================================================== */
  var VH_PER_W = 0.80;          /* 每个分镜权重对应的滚动屏数（桌面） */
  var VH_PER_W_M = 0.55;        /* 移动端缩短，避免滚太久 */
  var FADE_MAX = 0.045;         /* 章节文案淡入淡出宽度（进度占比上限） */
  var LBL_FADE = 0.34;          /* 标注淡入淡出 = 章节长度的该比例 */

  var isMobile = (window.matchMedia && window.matchMedia('(max-width: 900px)').matches)
    || window.innerWidth < 900;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ==========================================================================
     分镜数据
       chap = 归属章节（文案索引）
       w    = 滚动长度权重 —— 越大这段"滚得越久"
       ease = 0 匀速推进 / 1 缓入缓出（机位在分镜末尾落定）
       dth  = 方位角增量（累加，保证 360° 环绕连续不跳变）
       phi  = 极角（≈π/2 为水平，越小越俯视）
       r    = 机位距离（m）
       ty   = 注视点高度（m）；若指定 aim 则以模型标注锚点为准
       aim  = 以第 n 条部件标注的锚点作为注视点
       lb   = 该分镜显示的部件标注索引
       dim  = 显示尺寸线
       fov  = 竖直视角，越大越广角、透视越夸张
     ========================================================================== */

  var PULSE = {
    id: 'pulse',
    name: 'RE-PULSE',
    kind: 'pulse',
    start: { theta: -0.62, phi: 1.10, r: 2.05, ty: 0.44, fov: 38 },
    chapters: [
      {
        code: 'INTRO', side: 'left', tag: 'h1',
        h: '让每一度电<br><em>持续创造价值</em>',
        desc: 'Keep every kWh creating value. 一台为后市场而生的移动式储能电芯主动活化巡检工作站 —— 向下滚动，开始检视。',
        specs: [['520', '主体宽 mm'], ['990', '总高 mm'], ['Ø84', '轮径 mm']]
      },
      {
        code: 'ORBIT', side: 'right',
        h: '360°<br>全方位环视',
        desc: '双杆拉杆、两轮两脚、保护框与细状态灯。<br>机位环绕一周，比例与姿态一目了然。'
      },
      {
        code: 'FRONT · HMI', side: 'left',
        h: '正面<br><em>人机界面</em>',
        desc: '10.1" 工业触控屏 + 实体旋钮 + 三键控制 + E-STOP。<br>数字化通过屏幕表达，关键操作仍保留实体件。',
        specs: [['10.1"', '触控屏'], ['16:10', '屏幕比例'], ['Ø40', '急停 mm']]
      },
      {
        code: 'RIGHT · CABLE', side: 'right',
        h: '右侧<br><em>线缆管理</em>',
        desc: '独立卷线仓，线缆不裸露、可侧向抽出。<br>8 处 TPU 防撞包角围绕主体外缘。'
      },
      {
        code: 'REAR · THERMAL', side: 'left',
        h: '背面<br><em>散热与接口</em>',
        desc: '横向百叶散热 —— 明确的工业设备语言，<br>而非电脑式圆孔。接口区集中布置。'
      },
      {
        code: 'LEFT · PROBE', side: 'right',
        h: '左侧<br><em>Re-Probe Dock</em>',
        desc: '探针仓 P1–P4 + Universal Probe / Adapter A·B·C。<br>模块独立可换，检修无需拆机。'
      },
      {
        code: 'LOW ANGLE', side: 'left',
        h: '地面视角<br><em>工业力量感</em>',
        desc: '镜头压至轮轴高度 —— 大轮、支撑脚与贴地重心，<br>宣示"随时可以出发"的移动性。',
        specs: [['Ø84', '大轮 mm'], ['2+2', '两轮两脚'], ['0°', '贴地机位']]
      },
      {
        code: 'DIMENSION', side: 'right',
        h: '尺寸<br><em>可搬运的边界</em>',
        desc: '520 × 320 × 400 mm 主体，含拉杆总高 990 mm。<br>一个人、一只手，即可推走整套活化能力。'
      },
      {
        code: 'EXPLODE', side: 'left',
        h: '俯视拆解<br><em>模块化层级</em>',
        desc: '上盖 / HMI / 探针仓 / 卷线仓 / 轮系 ——<br>随着镜头升上头顶，整机沿装配轴展开。'
      },
      {
        code: 'NEXT', side: 'left',
        h: '现在<br><em>自由检视</em>',
        desc: '进入工程模式，可自由旋转、切换视角、<br>拖动爆炸滑块并在 Re-Pulse / Re-Bridge 之间对照。',
        cta: '<a href="studio.html">进入工程模式<i>↗</i></a>'
      }
    ],
    shots: [
      /* 00 开场：3/4 视角缓慢漂移拉近 */
      { n: 'HERO', chap: 0, w: 1.10, ease: 1.00, dth: 0.47, phi: 1.05, r: 1.82, ty: 0.44, fov: 38 },
      /* 01 环绕一整圈 */
      { n: 'ORBIT', chap: 1, w: 2.20, ease: 0.25, dth: -TWO_PI, phi: 1.17, r: 1.90, ty: 0.42, fov: 38, lb: [0, 3, 4, 7, 8, 10] },
      /* 02 正面 HMI */
      { n: 'FRONT', chap: 2, w: 1.00, ease: 0.80, dth: 0.15, phi: 1.30, r: 1.18, fov: 40, aim: 0, lb: [0, 1, 2, 3] },
      { n: 'HMI', chap: 2, w: 0.90, ease: 0.35, dth: 0.12, phi: 1.26, r: 0.98, fov: 36, aim: 0, lb: [0, 1, 2, 3] },
      /* 03 右侧卷线仓 */
      { n: 'RIGHT', chap: 3, w: 1.10, ease: 0.75, dth: 1.57, phi: 1.12, r: 1.52, ty: 0.38, fov: 38, lb: [5, 8] },
      /* 04 背面散热 */
      { n: 'REAR', chap: 4, w: 1.00, ease: 0.75, dth: 1.57, phi: 1.10, r: 1.48, ty: 0.40, fov: 38, lb: [6] },
      { n: 'REAR-IN', chap: 4, w: 0.90, ease: 0.35, dth: 0.22, phi: 1.14, r: 1.05, fov: 40, aim: 6, lb: [6] },
      /* 05 左侧探针仓 */
      { n: 'LEFT', chap: 5, w: 1.00, ease: 0.75, dth: 1.35, phi: 1.10, r: 1.48, ty: 0.38, fov: 38, lb: [4] },
      { n: 'DOCK', chap: 5, w: 0.90, ease: 0.35, dth: 0.22, phi: 1.12, r: 1.02, fov: 38, aim: 4, lb: [4] },
      /* 06 地面视角：下沉 → 贴地慢推 → 横摇 */
      { n: 'DESCEND', chap: 6, w: 0.85, ease: 0.85, dth: 0.55, phi: 1.495, r: 1.44, ty: 0.17, fov: 44 },
      { n: 'CREEP', chap: 6, w: 2.40, ease: 0.12, dth: 0.35, phi: 1.515, r: 1.36, ty: 0.14, fov: 46 },
      { n: 'SWEEP', chap: 6, w: 0.95, ease: 0.55, dth: 0.55, phi: 1.505, r: 1.40, ty: 0.16, fov: 42, lb: [9] },
      /* 07 尺寸丈量 */
      { n: 'DIM', chap: 7, w: 1.20, ease: 0.80, dth: 0.30, phi: 1.02, r: 2.55, ty: 0.38, fov: 34, dim: 1 },
      { n: 'DIM-HOLD', chap: 7, w: 0.70, ease: 0.20, dth: 0.15, phi: 0.98, r: 2.62, ty: 0.38, fov: 34, dim: 1 },
      /* 08 俯视拆解 */
      { n: 'RISE', chap: 8, w: 1.30, ease: 0.85, dth: -0.55, phi: 0.42, r: 2.40, ty: 0.28, ex: 0.72, fov: 38 },
      { n: 'EXPLODE', chap: 8, w: 1.40, ease: 0.20, dth: -0.45, phi: 0.36, r: 2.30, ty: 0.30, ex: 1.00, fov: 36 },
      { n: 'EXP-DRIFT', chap: 8, w: 0.80, ease: 0.35, dth: -0.40, phi: 0.58, r: 2.18, ty: 0.30, ex: 1.00, fov: 36 },
      /* 09 收尾 */
      { n: 'OUTRO', chap: 9, w: 1.00, ease: 1.00, dth: 0.30, phi: 0.98, r: 2.00, ty: 0.40, ex: 0.08, fov: 38 }
    ]
  };

  var BRIDGE = {
    id: 'bridge',
    name: 'RE-BRIDGE',
    kind: 'bridge',
    start: { theta: -0.62, phi: 1.05, r: 0.58, ty: 0.09, fov: 38 },
    chapters: [
      {
        code: 'INTRO', side: 'left', tag: 'h1',
        h: '一推一扣<br><em>即刻联网</em>',
        desc: 'Re-Bridge 磁吸式多协议边缘网关。145 × 84 × 34 mm，<br>把 Re-Pulse 的每一次检测接进你的系统。',
        specs: [['145', '宽 mm'], ['84', '高 mm'], ['34', '厚 mm']]
      },
      {
        code: 'ORBIT', side: 'right',
        h: '金属端板<br><em>保护框 DNA</em>',
        desc: '阳极氧化铝端板略突出主体，四角螺钉外露。<br>与 Re-Pulse 共用同一套保护框语言。'
      },
      {
        code: 'FRONT · STATUS', side: 'left',
        h: '细状态光带<br><em>一眼判读</em>',
        desc: '1–2mm 细光带：白启动 / 蓝联网 / 绿正常 / 黄异常 / 红故障。<br>不用凑近看屏幕，也能读懂状态。'
      },
      {
        code: 'I/O', side: 'right',
        h: '两侧接口<br><em>即插即用</em>',
        desc: '左：CAN · RS485 接线端子；右：Ethernet · USB Service。<br>顶部 SMA 接口引出 4G 天线。'
      },
      {
        code: 'DEPLOY', side: 'left',
        h: '两种部署<br><em>一套硬件</em>',
        desc: 'Re-Base 磁吸底座：场景 A 快速巡检；<br>DIN Rail Adapter：场景 B 长期部署。'
      },
      {
        code: 'DIMENSION', side: 'right',
        h: '巴掌大小<br><em>工业级规格</em>',
        desc: '145 × 84 × 34 mm —— 能塞进电柜角落，<br>也能随手吸在 Re-Pulse 机身上带走。'
      },
      {
        code: 'EXPLODE', side: 'left',
        h: '拆解<br><em>端板 / 主体 / 底座</em>',
        desc: '金属端板、工程塑料主体、接口组与底座分层展开，<br>模块化到最后一颗螺钉。'
      },
      {
        code: 'NEXT', side: 'left',
        h: '现在<br><em>自由检视</em>',
        desc: '进入工程模式，可自由旋转、切换视角、<br>拖动爆炸滑块并在 Re-Pulse / Re-Bridge 之间对照。',
        cta: '<a href="studio.html">进入工程模式<i>↗</i></a>'
      }
    ],
    shots: [
      { n: 'HERO', chap: 0, w: 1.00, ease: 1.00, dth: 0.45, phi: 1.05, r: 0.52, ty: 0.09, fov: 38 },
      { n: 'ORBIT', chap: 1, w: 2.00, ease: 0.25, dth: -TWO_PI, phi: 1.15, r: 0.50, ty: 0.08, fov: 38, lb: [0, 1, 3, 5] },
      { n: 'FRONT', chap: 2, w: 1.00, ease: 0.80, dth: 0.20, phi: 1.26, r: 0.34, fov: 36, aim: 0, lb: [0, 1, 5] },
      { n: 'STATUS', chap: 2, w: 0.90, ease: 0.35, dth: 0.15, phi: 1.22, r: 0.26, fov: 34, aim: 1, lb: [1] },
      { n: 'RIGHT', chap: 3, w: 1.00, ease: 0.75, dth: 1.45, phi: 1.10, r: 0.40, ty: 0.08, fov: 36, lb: [4] },
      { n: 'LEFT', chap: 3, w: 1.10, ease: 0.75, dth: 3.00, phi: 1.08, r: 0.40, ty: 0.08, fov: 36, lb: [3, 2] },
      { n: 'BASE', chap: 4, w: 1.10, ease: 0.70, dth: 0.80, phi: 1.34, r: 0.42, ty: 0.04, fov: 38, lb: [6, 7] },
      { n: 'DIM', chap: 5, w: 1.10, ease: 0.80, dth: 0.60, phi: 1.02, r: 0.62, ty: 0.06, fov: 34, dim: 1 },
      { n: 'DIM-HOLD', chap: 5, w: 0.70, ease: 0.20, dth: 0.25, phi: 0.98, r: 0.66, ty: 0.06, fov: 34, dim: 1 },
      { n: 'EXPLODE', chap: 6, w: 1.30, ease: 0.80, dth: 0.60, phi: 0.55, r: 0.60, ty: 0.06, ex: 1.00, fov: 36 },
      { n: 'EXP-HOLD', chap: 6, w: 0.90, ease: 0.20, dth: 0.40, phi: 0.45, r: 0.66, ty: 0.07, ex: 1.00, fov: 36 },
      { n: 'OUTRO', chap: 7, w: 1.00, ease: 1.00, dth: 0.60, phi: 1.00, r: 0.52, ty: 0.09, ex: 0.06, fov: 38 }
    ]
  };

  var SHOWS = { pulse: PULSE, bridge: BRIDGE };

  /* ==========================================================================
     运行时状态
     ========================================================================== */
  var scene, camera, renderer, world, clock, labels;
  var pivot = null, prod = null, dimInfo = null, explodeList = [];
  var cur = null, KEYS = [], CHAP_RANGES = [], CHAP_FADE = [];
  var TOTAL_W = 1;

  var p = 0, pRaw = 0, pMax = 1, FORCE_P = null;
  var mouse = { x: 0, y: 0 }, mouseGoal = { x: 0, y: 0 };
  var lastSi = -1, lastChap = -1;

  var elChapters, elDots, elLabels, elRailFill, elChapIdx, elTrack, elHint;
  var elAz, elEl, elD, elF;
  var chaps = [], dots = [];

  /* ==========================================================================
     工具
     ========================================================================== */
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function disposeTree(root) {
    root.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
  }

  function collectExplode(root) {
    var list = [];
    root.traverse(function (o) {
      if (o.userData.explode) { o.userData._base = o.position.clone(); list.push(o); }
    });
    return list;
  }

  function applyExplode(list, t) {
    for (var i = 0; i < list.length; i++) {
      var o = list[i], e = o.userData.explode;
      o.position.copy(o.userData._base).addScaledVector(e.dir, e.dist * t);
    }
  }

  /* 右侧卷线仓门：拆解/展开段落时滑开露出卷线轮，其余时间保持关闭 */
  var reelDoor = null;
  function applyReelDoor(t) {
    if (!reelDoor) return;
    reelDoor.position.lerpVectors(reelDoor.userData.closed, reelDoor.userData.open, RE.clamp(t * 1.6, 0, 1));
  }

  /* 模型标注锚点 → 世界坐标（mm 模型空间） */
  function anchorWorld(mm) {
    var v = new T.Vector3(mm[0], mm[1], mm[2]);
    prod.group.updateMatrixWorld(true);
    prod.group.localToWorld(v);
    return v;
  }

  /* ==========================================================================
     场景
     ========================================================================== */
  function initScene() {
    var canvas = document.getElementById('gl');
    renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.6 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.34;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;

    scene = new T.Scene();
    scene.fog = new T.Fog(0x050608, 4.2, 13.5);

    camera = new T.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.02, 120);

    RE.buildEnvironment(renderer, scene);
    RE.buildLights(scene);
    RE.buildPodium(scene);

    world = new T.Group();
    world.scale.setScalar(RE.MM);
    scene.add(world);

    labels = new RE.Labels(document.getElementById('labels'));

    window.addEventListener('resize', onResize);
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    layoutTrack();
  }

  /* ==========================================================================
     构建一台产品的完整叙事
     ========================================================================== */
  function buildShow(id) {
    var S = SHOWS[id];
    if (!S) return;
    cur = S;

    if (pivot) { world.remove(pivot); disposeTree(pivot); pivot = null; }

    if (id === 'pulse') {
      prod = RE.buildRepulse(RE.PRESETS[0].repulse);
      pivot = new T.Group();
      pivot.position.set(0, -prod.size.floorY, 40);
    } else {
      prod = RE.buildRebridge(RE.PRESETS[0].bridge);
      pivot = new T.Group();
      pivot.position.set(0, -prod.size.floorY.magnet, 0);
    }
    pivot.add(prod.group);
    world.add(pivot);
    world.updateMatrixWorld(true);

    explodeList = collectExplode(prod.group);
    reelDoor = null;
    prod.group.traverse(function (o) { if (o.name === 'ReelDoor') reelDoor = o; });

    /* 尺寸线 */
    var sz = (id === 'pulse')
      ? { W: prod.size.W, D: prod.size.D, H: prod.size.H, floorY: prod.size.floorY, total: prod.size.total }
      : { W: prod.size.W, D: prod.size.D, H: prod.size.H, floorY: prod.size.floorY.magnet, total: prod.size.H };
    dimInfo = RE.buildDimensions(sz, { vertical: id === 'pulse' });
    dimInfo.group.visible = false;
    prod.group.add(dimInfo.group);

    buildTimeline(S);
    buildChapters(S);
    layoutTrack();

    lastSi = -1; lastChap = -1;
    p = pRaw = 0;
    window.scrollTo(0, 0);
  }

  function buildTimeline(S) {
    var i, total = 0;
    for (i = 0; i < S.shots.length; i++) total += S.shots[i].w;
    TOTAL_W = total;

    var acc = 0, th = S.start.theta;
    var ty0 = S.start.ty;
    KEYS = [{
      at: 0, ease: 0, shot: 0,
      theta: th, phi: S.start.phi, radius: S.start.r,
      tx: 0, ty: ty0, tz: 0, ex: 0, fov: S.start.fov
    }];

    for (i = 0; i < S.shots.length; i++) {
      var s = S.shots[i];
      th += s.dth;
      acc += s.w;
      s.t0 = (acc - s.w) / total;
      s.t1 = acc / total;

      var tg;
      if (s.aim != null && prod.labels[s.aim]) tg = anchorWorld(prod.labels[s.aim].p);
      else tg = new T.Vector3(0, (s.ty != null ? s.ty : ty0), 0);
      ty0 = tg.y;

      KEYS.push({
        at: s.t1, ease: (s.ease != null ? s.ease : 1), shot: i,
        theta: th, phi: s.phi, radius: s.r,
        tx: tg.x, ty: tg.y, tz: tg.z,
        ex: (s.ex || 0), fov: (s.fov || 38)
      });
    }

    /* 章节可见区间：由分镜自动推导 */
    CHAP_RANGES = []; CHAP_FADE = [];
    for (i = 0; i < S.chapters.length; i++) { CHAP_RANGES.push(null); }
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
      if (i === 0) CHAP_RANGES[i][0] = -FADE_MAX;              /* 首章一进来就满显 */
      if (i === CHAP_RANGES.length - 1) CHAP_RANGES[i][1] = 1.5; /* 末章滚到底也不消失 */
      CHAP_FADE.push(Math.min(FADE_MAX, (CHAP_RANGES[i][1] - CHAP_RANGES[i][0]) * LBL_FADE));
    }
  }

  function buildChapters(S) {
    var n = S.chapters.length, i, html = '', dotsHtml = '';
    for (i = 0; i < n; i++) {
      var c = S.chapters[i];
      html += '<section class="chap ' + (c.side === 'right' ? 'chap-right' : 'chap-left') + '">';
      html += '<p class="eyebrow">' + pad(i + 1) + ' / ' + pad(n) + ' — ' + c.code + '</p>';
      html += '<' + (c.tag || 'h2') + '>' + c.h + '</' + (c.tag || 'h2') + '>';
      if (c.desc) html += '<p class="desc">' + c.desc + '</p>';
      if (c.specs) {
        html += '<ul class="specs">';
        for (var k = 0; k < c.specs.length; k++) {
          html += '<li><b>' + c.specs[k][0] + '</b><i>' + c.specs[k][1] + '</i></li>';
        }
        html += '</ul>';
      }
      if (c.cta) html += '<div class="cta">' + c.cta + '</div>';
      html += '</section>';

      var r = CHAP_RANGES[i];
      var top = r ? Math.max(0, r[0]) * 100 : 0;
      dotsHtml += '<b data-i="' + i + '" style="top:' + top.toFixed(2) + '%" title="' + c.code + '"></b>';
    }
    elChapters.innerHTML = html;
    elDots.innerHTML = dotsHtml;
    chaps = [].slice.call(elChapters.querySelectorAll('.chap'));
    dots = [].slice.call(elDots.querySelectorAll('b'));
    dots.forEach(function (d) {
      d.addEventListener('click', function () {
        var i = parseInt(d.getAttribute('data-i'), 10);
        var r = CHAP_RANGES[i];
        window.scrollTo({ top: Math.max(0, r[0]) * pMax + 4, behavior: 'smooth' });
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
     每分镜的标注 / 尺寸线
     ========================================================================== */
  function applyShot(si) {
    var s = cur.shots[si];
    if (!s) return;
    if (dimInfo) dimInfo.group.visible = !!s.dim;
    if (s.dim) {
      labels.set(dimInfo.anchors, prod.group, 'dim');
    } else if (s.lb && s.lb.length) {
      var list = [];
      for (var i = 0; i < s.lb.length; i++) {
        if (prod.labels[s.lb[i]]) list.push(prod.labels[s.lb[i]]);
      }
      labels.set(list, prod.group, cur.kind);
    } else {
      labels.clear();
    }
  }

  /* ==========================================================================
     关键帧求值
     ========================================================================== */
  function keyAt(prog) {
    var a = KEYS[0], b = KEYS[KEYS.length - 1];
    for (var i = 0; i < KEYS.length - 1; i++) {
      if (prog >= KEYS[i].at && prog <= KEYS[i + 1].at) { a = KEYS[i]; b = KEYS[i + 1]; break; }
    }
    var raw = clamp((prog - a.at) / Math.max(1e-6, b.at - a.at), 0, 1);
    var t = raw + (smooth(raw) - raw) * b.ease;
    return {
      theta: lerp(a.theta, b.theta, t),
      phi: lerp(a.phi, b.phi, t),
      radius: lerp(a.radius, b.radius, t),
      tx: lerp(a.tx, b.tx, t),
      ty: lerp(a.ty, b.ty, t),
      tz: lerp(a.tz, b.tz, t),
      ex: lerp(a.ex, b.ex, t),
      fov: lerp(a.fov, b.fov, t),
      si: b.shot
    };
  }

  function chapOpacity(i, prog) {
    var r = CHAP_RANGES[i];
    if (!r) return 0;
    var f = CHAP_FADE[i] || FADE_MAX;
    var inV = clamp((prog - r[0]) / f, 0, 1);
    var outV = clamp((r[1] - prog) / f, 0, 1);
    return Math.min(inV, outV);
  }

  function curChapter(prog) {
    var idx = 0;
    for (var i = 0; i < CHAP_RANGES.length; i++) {
      if (CHAP_RANGES[i] && prog >= CHAP_RANGES[i][0]) idx = i;
    }
    return idx;
  }

  /* ==========================================================================
     每帧 UI 同步
     ========================================================================== */
  function syncUI(k, ci) {
    var i;
    for (i = 0; i < chaps.length; i++) {
      var op = chapOpacity(i, p);
      var el = chaps[i];
      el.style.opacity = op.toFixed(3);
      el.style.visibility = op <= 0.001 ? 'hidden' : 'visible';
      var mid = (CHAP_RANGES[i][0] + CHAP_RANGES[i][1]) / 2;
      var drift = (1 - op) * 26 * (p < mid ? 1 : -1);
      el.style.transform = 'translateY(calc(-50% + ' + drift.toFixed(1) + 'px))';
    }

    elRailFill.style.height = (p * 100).toFixed(2) + '%';

    var txt = pad(ci + 1) + '<span>/ ' + pad(chaps.length) + '</span>';
    if (elChapIdx.innerHTML !== txt) elChapIdx.innerHTML = txt;
    for (i = 0; i < dots.length; i++) {
      var on = (i === ci);
      if (dots[i].classList.contains('on') !== on) dots[i].classList.toggle('on', on);
    }

    elHint.style.opacity = p < 0.012 ? '1' : '0';

    var az = ((-k.theta * 180 / Math.PI) % 360 + 360) % 360;
    var elv = (90 - k.phi * 180 / Math.PI);
    elAz.textContent = String(Math.round(az)).padStart(3, '0');
    elEl.textContent = (elv >= 0 ? '+' : '') + Math.round(elv);
    elD.textContent = k.radius.toFixed(2);
    elF.textContent = Math.round(k.fov);

    /* 标注整体随章节淡入淡出 */
    var s = cur.shots[k.si];
    var show = !!(s && (s.lb || s.dim));
    elLabels.style.opacity = (show ? chapOpacity(ci, p) : 0).toFixed(3);
  }

  /* ==========================================================================
     主循环
     ========================================================================== */
  function loop() {
    var dt = Math.min(0.06, clock.getDelta());

    var damp = reduceMotion ? 0.55 : (1 - Math.pow(0.001, dt));
    p += (pRaw - p) * damp;
    mouse.x += (mouseGoal.x - mouse.x) * 0.05;
    mouse.y += (mouseGoal.y - mouse.y) * 0.05;

    var k = keyAt(p);

    if (k.si !== lastSi) { lastSi = k.si; applyShot(k.si); }
    applyExplode(explodeList, k.ex);
    applyReelDoor(k.ex);

    var theta = k.theta + mouse.x * 0.05;
    var phi = clamp(k.phi + mouse.y * 0.04, 0.10, 1.545);

    if (Math.abs(camera.fov - k.fov) > 0.01) {
      camera.fov = k.fov; camera.updateProjectionMatrix();
    }

    camera.position.setFromSpherical(new T.Spherical(k.radius, phi, theta));
    camera.position.x += k.tx;
    camera.position.y += k.ty;
    camera.position.z += k.tz;
    camera.lookAt(k.tx, k.ty, k.tz);
    camera.updateMatrixWorld();

    var ci = curChapter(p);
    if (ci !== lastChap) lastChap = ci;
    syncUI(k, ci);

    labels.update(camera, { w: renderer.domElement.clientWidth, h: renderer.domElement.clientHeight });

    renderer.render(scene, camera);
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
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-p');
        if (id === cur.id) return;
        [].forEach.call(btns, function (x) { x.classList.toggle('on', x === b); });
        buildShow(id);
      });
    });

    window.addEventListener('keydown', function (e) {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      if (e.key === '1') { switchTo('pulse'); }
      else if (e.key === '2') { switchTo('bridge'); }
    });
  }

  function switchTo(id) {
    var btns = document.querySelectorAll('#switch button');
    [].forEach.call(btns, function (x) { x.classList.toggle('on', x.getAttribute('data-p') === id); });
    if (cur.id !== id) buildShow(id);
  }

  /* ==========================================================================
     启动
     ========================================================================== */
  function start() {
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
    if (m) FORCE_P = clamp(parseFloat(m[1]), 0, 1);   /* #p=0.58 可直接预览指定进度 */

    initScene();
    bindInput();
    buildShow(/bridge/i.test(h) ? 'bridge' : 'pulse');
    measureScroll();
    pRaw = p = (FORCE_P != null ? FORCE_P : clamp(window.scrollY / pMax, 0, 1));

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
