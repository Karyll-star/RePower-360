/* ============================================================================
   Re-Pulse 移动式储能健康诊断与维护工作站
   依据：《产品效果图.png》（主）+《物理产品设计规范》02–19 节
   建模坐标：mm，前脸朝 +Z；落地后 y=0
   ========================================================================== */
(function (RE) {
  'use strict';
  var T = THREE;

  /* 小工具 -------------------------------------------------------------- */
  function cylZ(r, h, mat, seg) {                       // 轴向 +Z
    var m = RE.cyl(r, r, h, mat, seg);
    m.rotation.x = Math.PI / 2;
    return m;
  }
  function cylX(r, h, mat, seg) {                       // 轴向 +X
    var m = RE.cyl(r, r, h, mat, seg);
    m.rotation.z = Math.PI / 2;
    return m;
  }
  function place(o, x, y, z) { o.position.set(x, y, z); return o; }

  /* 开口壳体：顶/底板 + 四面侧壁 + 四根圆角立柱（等效圆角盒轮廓，但内部中空）
     openBottom=true → 底部开口（上盖）；false → 顶部开口（下壳）
     爆炸图里能看见内部模块，而不是一个实心方块 */
  function openShell(w, h, d, rr, t, mat, openBottom) {
    var g = new T.Group();
    var hy = h / 2, wallH = h - t;
    var wy = openBottom ? -t / 2 : t / 2;
    /* 顶/底板：用圆角矩形挤出，保证四角与圆角立柱吻合 */
    var cap = RE.plate(w, d, rr, t, mat, 2.2);
    cap.rotation.x = -Math.PI / 2;
    g.add(place(cap, 0, openBottom ? hy - t / 2 : -hy + t / 2, 0));
    [1, -1].forEach(function (s) {
      g.add(place(RE.rb(w - 2 * rr, wallH, t, Math.min(4, t * 0.45), mat, 2), 0, wy, s * (d / 2 - t / 2)));
      g.add(place(RE.rb(t, wallH, d - 2 * rr, Math.min(4, t * 0.45), mat, 2), s * (w / 2 - t / 2), wy, 0));
      [1, -1].forEach(function (s2) {
        g.add(place(RE.rb(2 * rr, wallH, 2 * rr, rr, mat, 4), s * (w / 2 - rr), wy, s2 * (d / 2 - rr)));
      });
    });
    return g;
  }
  function noShadow(o) {
    o.traverse(function (n) { n.castShadow = false; n.receiveShadow = false; });
    return o;
  }

  RE.buildRepulse = function (P) {
    var M = RE.M, C = RE.CMF;
    var W = P.W, D = P.D, H = P.H;
    var hW = W / 2, hD = D / 2, hH = H / 2;
    var r = RE.clamp(Math.min(W, H, D) * 0.055, 8, 26);
    var g = new T.Group();
    g.name = 'Re-Pulse';

    /* ---------------- 关键布局（按效果图比例参数化） ---------------- */
    var seamY = -H * 0.205;                       // 上下壳分模线（位于控制件与铭牌之间）
    var beltH = H * 0.06;
    var wheelR = P.wheel / 2;
    var floorDrop = wheelR * 1.86;
    var floorY = -hH - floorDrop;

    var scrTopM = H * 0.03;
    var bezPad = RE.clamp(H * 0.055, 10, 26);
    var scrH = H * 0.34, scrW = scrH * 1.6;
    var bezW = scrW + bezPad * 2, bezH = scrH + bezPad * 2;
    var bezTop = hH - scrTopM, bezCy = bezTop - bezH / 2, bezBot = bezTop - bezH;
    var ctlY = bezBot - H * 0.135;
    var estopR = RE.clamp(W * 0.042, 14, 24);
    var btnR = RE.clamp(W * 0.023, 8, 14);
    var panW = W * 0.86, panH = H * 0.235, panCy = -hH + panH / 2 + H * 0.028;

    /* ======================================================================
       1. 壳体（规范 06 节）：下壳 / 上盖 / 分模线橡胶密封带 / 内骨架
       ====================================================================== */
    var grpShell = new T.Group();
    /* 内骨架：开放式框架（爆炸图时内部模块可见） */
    var core = new T.Group();
    core.name = 'InternalFrame';
    var fw = W * 0.90, fh = H * 0.86, fd = D * 0.90, fcy = -H * 0.04;
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (c) {
      core.add(place(RE.rb(30, fh, 30, 6, M.aluBrushed, 3), c[0] * (fw / 2 - 15), fcy, c[1] * (fd / 2 - 15)));
    });
    [1, -1].forEach(function (s) {
      core.add(place(RE.rb(fw, 26, 26, 6, M.aluBrushed, 3), 0, fcy + s * fh / 2, -(fd / 2 - 13)));
      core.add(place(RE.rb(fw * 0.62, 20, 22, 5, M.aluBrushed, 3), 0, fcy + s * fh * 0.44, fd / 2 - 11));
    });
    core.add(place(RE.rb(fw * 0.88, fh * 0.94, 8, 3, M.shellDeep, 3), 0, fcy, -(fd / 2 - 4)));
    grpShell.add(core);

    var shellT = 11;                                     // 壳壁厚（视觉表达）
    var lowerH = seamY + hH + H * 0.10;
    var lowerShell = openShell(W, lowerH, D, r, shellT, M.shell, false);   // 顶部开口
    lowerShell.name = 'LowerShell';
    place(lowerShell, 0, -hH + lowerH / 2, 0);
    grpShell.add(lowerShell);

    var upH = hH - seamY + H * 0.10;
    var upperShell = openShell(W * 0.99, upH, D * 0.99, r, shellT, M.shell, true);  // 底部开口
    upperShell.name = 'UpperShell';
    place(upperShell, 0, hH - upH / 2, 0);
    grpShell.add(upperShell);

    /* 分模线橡胶密封带：正好落在下壳上沿，遮住两壳搭接的台阶 */
    var beltY = -hH + lowerH;
    var belt = RE.rb(W * 1.014, beltH, D * 1.014, beltH * 0.36, M.rubber, 3);
    place(belt, 0, beltY, 0);
    grpShell.add(belt);
    /* 密封带上的搭扣（IP65 视觉表达） */
    [1, -1].forEach(function (s) {
      grpShell.add(place(RE.rb(46, beltH * 0.9, 10, 3, M.aluDark, 2), s * W * 0.22, beltY, hD * 1.012));
    });
    /* 内部功能模块（规范 27 / 29 节：数据采集 / 安全检测 / 维护模块） */
    var inner = new T.Group();
    inner.name = 'InternalModules';
    [1, -1].forEach(function (s) {
      inner.add(place(RE.rb(26, H * 0.66, 26, 4, M.aluBrushed, 3), s * W * 0.30, -H * 0.02, -D * 0.32));
    });
    /* ① 数据采集 / 主控板 */
    inner.add(place(RE.rb(W * 0.62, 5, D * 0.46, 2, M.pcb, 2), 0, H * 0.17, D * 0.02));
    for (var ci = 0; ci < 7; ci++) {
      inner.add(place(RE.rb(20 + (ci % 3) * 12, 7, 14, 1.4, M.chip, 1),
        -W * 0.22 + ci * W * 0.072, H * 0.17 + 6, D * 0.02 + (ci % 2 ? 26 : -22)));
    }
    inner.add(place(RE.rb(32, 13, 24, 2, M.plasticDark, 2), W * 0.25, H * 0.17 + 6, D * 0.06));
    /* ② 安全检测板（绝缘 / 温升 / 压差采集） */
    inner.add(place(RE.rb(W * 0.56, 5, D * 0.42, 2, M.pcb, 2), 0, -H * 0.15, -D * 0.02));
    for (var cj = 0; cj < 5; cj++) {
      inner.add(place(RE.rb(24, 8, 16, 1.4, M.chip, 1), -W * 0.18 + cj * W * 0.09, -H * 0.14, -D * 0.02));
    }
    /* ③ 散热器（横向翅片） */
    inner.add(place(RE.rb(W * 0.30, H * 0.13, D * 0.26, 3, M.aluBrushed, 3), -W * 0.22, H * 0.01, 0));
    for (var fi = 0; fi < 7; fi++) {
      inner.add(place(RE.rb(W * 0.28, H * 0.065, 4, 1, M.aluDark, 2),
        -W * 0.22, H * 0.01 + 7, -D * 0.10 + fi * (D * 0.20 / 6)));
    }
    /* ④ 风扇 */
    var fan = new T.Group();
    var fr2 = H * 0.075;
    fan.add(place(new T.Mesh(new T.TorusGeometry(fr2, 5, 8, 24), M.plasticDark), 0, 0, 0));
    fan.add(place(cylZ(fr2 * 0.42, 14, M.plasticDark, 16), 0, 0, 0));
    for (var bi2 = 0; bi2 < 5; bi2++) {
      var angB = (bi2 / 5) * Math.PI * 2;
      var bl = RE.rb(fr2 * 0.85, fr2 * 0.55, 3, 1, M.plasticDark, 1);
      bl.position.set(Math.cos(angB) * fr2 * 0.52, Math.sin(angB) * fr2 * 0.52, 0);
      bl.rotation.z = angB + 0.6;
      fan.add(bl);
    }
    fan.rotation.y = Math.PI / 2;
    inner.add(place(fan, W * 0.20, -H * 0.03, 0));
    /* ⑤ DC/DC 与继电器模块 */
    inner.add(place(RE.rb(W * 0.20, H * 0.13, D * 0.24, 4, M.shellDeep, 3), W * 0.15, H * 0.15, -D * 0.15));
    inner.add(place(RE.rb(W * 0.12, H * 0.10, D * 0.18, 3, M.plasticDark, 3), -W * 0.30, -H * 0.02, D * 0.16));
    /* ⑥ 内部线束 */
    inner.add(RE.tube([
      [-W * 0.28, H * 0.10, D * 0.16], [-W * 0.10, H * 0.02, D * 0.24],
      [W * 0.10, -H * 0.06, D * 0.18], [W * 0.26, -H * 0.13, D * 0.02]
    ], 5, M.connector, 44));
    inner.add(RE.tube([
      [-W * 0.22, H * 0.14, -D * 0.20], [-W * 0.02, H * 0.06, -D * 0.26],
      [W * 0.18, -H * 0.02, -D * 0.20], [W * 0.26, -H * 0.10, -D * 0.06]
    ], 4.4, M.connector, 40));
    /* 爆炸时内部模块整体向左侧抽出，避免被前脸/外壳遮挡 */
    inner.userData.explode = { dir: new T.Vector3(-1, 0.06, -0.45), dist: 340 };
    grpShell.add(inner);

    lowerShell.userData.explode = { dir: new T.Vector3(0, -1, 0), dist: H * 0.62 };
    upperShell.userData.explode = { dir: new T.Vector3(0, 1, 0), dist: H * 0.62 };
    belt.userData.explode = { dir: new T.Vector3(0, 0, 1), dist: D * 0.95 };
    g.add(grpShell);

    /* ======================================================================
       2. 防撞包角（规范 07 节）
       ====================================================================== */
    var guards = new T.Group();
    var gs = Math.min(W, H, D) * 0.145, gr = gs * 0.30;
    var gx = hW - gs * 0.30, gy = hH - gs * 0.30, gz = hD - gs * 0.30;
    [1, -1].forEach(function (sy) {
      [1, -1].forEach(function (sx) {
        [1, -1].forEach(function (sz) {
          var cg = RE.rb(gs, gs, gs, gr, M.rubber, 3);
          place(cg, sx * gx, sy * gy, sz * gz);
          guards.add(cg);
          var rib = RE.rb(gs * 0.96, gs * 0.16, gs * 1.03, gr * 0.5, M.rubberSoft, 2);
          place(rib, sx * gx, sy * gy, sz * gz);
          guards.add(rib);
        });
      });
    });
    guards.userData.explode = { dir: new T.Vector3(1, 1, 1), dist: 110 };
    g.add(guards);

    /* ======================================================================
       3. 顶部维护工作台 + 双杆伸缩拉杆（规范 08 / 16 节）
       ====================================================================== */
    var rails = new T.Group();
    [1, -1].forEach(function (s) {
      rails.add(place(RE.rb(W * 0.10, H * 0.05, D * 0.90, 8, M.shellMid, 3), s * (hW - W * 0.05), hH, 0));
      rails.add(place(RE.rb(W * 0.045, 4, D * 0.86, 2, M.aluDark, 2), s * (hW - W * 0.05), hH + H * 0.026, 0));
    });
    g.add(rails);

    var tray = new T.Group();
    var trayW = W * 0.58, trayD = D * 0.50, trayCy = hH - 1;
    var trayZ = hD - trayD / 2 - D * 0.07;
    tray.add(place(RE.rb(trayW, 4, trayD, 8, M.shellDeep, 2), 0, trayCy - 1, trayZ));
    var gridMap = RE.gridTexture(512, 44, 'rgba(170,195,215,.15)', '#15181c');
    gridMap.repeat.set(2, 2);
    var gridFloor = new T.Mesh(new T.PlaneGeometry(trayW * 0.98, trayD * 0.98),
      new T.MeshStandardMaterial({ map: gridMap, roughness: 0.88, metalness: 0.10, color: 0x8d979f }));
    gridFloor.rotation.x = -Math.PI / 2;
    place(gridFloor, 0, trayCy + 1.3, trayZ);
    tray.add(gridFloor);
    [[0, trayD / 2 + 7, trayW + 16, 12, 14], [0, -trayD / 2 - 7, trayW + 16, 12, 14],
    [-trayW / 2 - 7, 0, 14, 12, trayD + 2], [trayW / 2 + 7, 0, 14, 12, trayD + 2]]
      .forEach(function (f) {
        tray.add(place(RE.rb(f[2], f[3], f[4], 4, M.shellMid, 2), f[0], trayCy + 4, trayZ + f[1]));
      });
    var sd = new T.Group();                                     // 螺丝刀
    sd.add(place(cylZ(6.5, 42, M.alu, 16), 0, 0, 12));
    sd.add(place(RE.rb(22, 22, 92, 9, M.rubber, 3), 0, 0, 66));
    sd.add(place(RE.rb(14, 14, 18, 6, M.aluDark, 2), 0, 0, 106));
    sd.rotation.y = 0.05;
    tray.add(place(sd, -trayW * 0.30, trayCy + 12, trayZ - trayD * 0.14));
    [1, -1].forEach(function (s) {
      var pb = new T.Group();
      pb.add(place(cylZ(6, 72, M.rubber, 14), 0, 0, 0));
      pb.add(place(cylZ(4.4, 26, M.alu, 14), 0, 0, 49));
      pb.add(place(cylZ(2.6, 10, M.alu, 12), 0, 0, 67));
      pb.rotation.y = s * 0.05;
      tray.add(place(pb, trayW * 0.17 + s * 40, trayCy + 9, trayZ + s * 14));
    });
    tray.add(place(RE.rb(54, 26, 42, 7, M.plasticDark, 3), trayW * 0.33, trayCy + 14, trayZ - trayD * 0.22));
    tray.userData.explode = { dir: new T.Vector3(0, 1, 0), dist: 250 };
    g.add(tray);

    var handle = new T.Group();
    var rodR = Math.max(7.5, W * 0.017), rodX = W * 0.30, rodZ = -hD + D * 0.34;
    var gripCy = floorY + P.handleTop - 26;
    var rodTop = gripCy - 26, rodBot = hH - 46;
    [1, -1].forEach(function (s) {
      handle.add(place(RE.cyl(rodR, rodR, rodTop - rodBot, M.aluBrushed, 20),
        s * rodX, (rodTop + rodBot) / 2, rodZ));
      handle.add(place(cylZ(rodR * 1.8, 28, M.aluDark, 20), s * rodX, hH + 14, rodZ));
      handle.add(place(RE.rb(rodR * 3.8, 12, rodR * 3.8, 4, M.plasticDark, 2), s * rodX, hH - 30, rodZ));
      handle.add(place(cylZ(rodR * 1.35, 34, M.aluBrushed, 20), s * rodX, rodTop - 70, rodZ));
    });
    handle.add(place(RE.rb(W * 0.74, 26, 66, 8, M.aluDark, 3), 0, hH + 6, rodZ + 8));
    handle.add(place(RE.rb(W * 0.74 - 14, 8, 52, 4, M.shellDeep, 2), 0, hH + 18, rodZ + 8));
    handle.add(place(RE.rb(W * 0.64, 46, 52, 16, M.rubber, 4), 0, gripCy, rodZ));
    for (var gi = -3; gi <= 3; gi++) {
      handle.add(place(RE.rb(W * 0.60, 5, 56, 2.5, M.rubberSoft, 2), 0, gripCy + gi * 6, rodZ));
    }
    handle.add(place(RE.rb(W * 0.30, 20, 30, 8, M.aluBrushed, 3), 0, gripCy + 24, rodZ));
    [1, -1].forEach(function (s) {
      var rb2 = RE.rb(34, 12, 14, 5, M.alu, 2);
      rb2.rotation.x = -0.5;
      handle.add(place(rb2, s * W * 0.20, gripCy + 22, rodZ + 24));
    });
    handle.userData.explode = { dir: new T.Vector3(0, 1, 0), dist: 250 };
    g.add(handle);

    /* ======================================================================
       4. 前脸 HMI（规范 09–12 节）
       ====================================================================== */
    var face = new T.Group();
    face.add(place(RE.plate(bezW + 8, bezH + 8, 12, 4, M.aluBrushed, 0.8), 0, bezCy, hD + 0.5));
    face.add(place(RE.plate(bezW, bezH, 11, 9, M.glass, 1.4), 0, bezCy, hD + 4));
    face.add(place(new T.Mesh(new T.PlaneGeometry(scrW, scrH), M.screen), 0, bezCy, hD + 9.4));
    face.add(noShadow(place(new T.Mesh(new T.SphereGeometry(2.4, 12, 8), M.ledWhite), 0, bezCy + bezH / 2 + 3.5, hD + 2.4)));
    /* 屏幕下方细状态灯带（DNA ②） */
    face.add(place(RE.rb(W * 0.52, 2.6, 2.4, 1, M.ledCyan, 1), 0, (bezBot + ctlY) / 2 + 4, hD + 1));
    [M.ledWhite, M.ledCyan, M.ledAmber].forEach(function (mm, i) {
      face.add(noShadow(place(new T.Mesh(new T.CircleGeometry(2.6, 12), mm),
        -W * 0.315 + i * 11, (bezBot + ctlY) / 2 + 4, hD + 2.3)));
    });

    /* 实体旋钮 */
    var knob = new T.Group();
    var kr = RE.clamp(W * 0.031, 11, 17);
    knob.add(place(cylZ(kr * 1.22, 8, M.aluDark, 28), 0, 0, 4));
    knob.add(place(cylZ(kr, 18, M.aluBrushed, 32), 0, 0, 17));
    for (var ki = 0; ki < 24; ki++) {
      var ang = (ki / 24) * Math.PI * 2;
      var kn = RE.rb(2.6, 12, 3, 0.8, M.aluDark, 1);
      kn.position.set(Math.cos(ang) * kr, Math.sin(ang) * kr, 25);
      kn.rotation.z = ang;
      knob.add(kn);
    }
    knob.add(place(RE.rb(4, 12, 2, 1, M.ledWhite, 1), 0, 2, 27.2));
    face.add(place(knob, -W * 0.30, ctlY + 12, hD + 1));

    /* START / PAUSE / CONFIRM */
    [-0.115, 0.015, 0.145].forEach(function (fx) {
      var btn = new T.Group();
      btn.add(place(cylZ(btnR * 1.35, 6, M.shellDeep, 24), 0, 0, 2));
      btn.add(place(cylZ(btnR, 10, M.plasticDark, 24), 0, 0, 6));
      var dome = new T.Mesh(new T.SphereGeometry(btnR * 0.92, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.connector);
      dome.scale.z = 0.45; dome.rotation.x = Math.PI / 2; dome.castShadow = true;
      btn.add(place(dome, 0, 0, 11));
      face.add(place(btn, fx * W, ctlY, hD + 1));
    });

    /* 紧急停止（红蘑菇头 + 黄底座） */
    var estop = new T.Group();
    estop.add(place(cylZ(estopR * 1.42, 5, M.shellDeep, 28), 0, 0, 2));
    estop.add(place(cylZ(estopR * 1.30, 12, M.yellow, 32), 0, 0, 8));
    estop.add(place(cylZ(estopR * 1.15, 8, M.shellDeep, 32), 0, 0, 17));
    estop.add(place(cylZ(estopR, 10, M.redEStop, 32), 0, 0, 24));
    var cap = new T.Mesh(new T.SphereGeometry(estopR, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), M.redEStop);
    cap.scale.z = 0.62; cap.rotation.x = Math.PI / 2; cap.castShadow = true;
    estop.add(place(cap, 0, 0, 29));
    estop.add(place(new T.Mesh(new T.TorusGeometry(estopR * 0.99, 1.6, 8, 32), M.rubber), 0, 0, 30));
    face.add(place(estop, W * 0.31, ctlY, hD + 1));

    /* 下部维护面板 + 铭牌 */
    face.add(place(RE.plate(panW, panH, 14, 8, M.shellPanel, 1.4), 0, panCy, hD + 1.5));
    for (var bi = 0; bi < 4; bi++) {
      face.add(place(RE.bolt(3.6, 3, M.aluDark),
        (bi % 2 ? 1 : -1) * (panW / 2 - 14), panCy + (bi < 2 ? 1 : -1) * (panH / 2 - 14), hD + 5.6));
    }
    face.add(noShadow(place(new T.Mesh(new T.PlaneGeometry(panW * 0.62, panW * 0.62 * 0.25),
      M.decal(RE.brandTexture('RE-PULSE', 'Energy Storage Health Guardian', { mainSize: 104, subSize: 40 }), 1, 1, 0.92)),
      0, panCy + 1, hD + 6.2)));

    /* 前脸金属立柱（DNA ① 保护框） */
    [1, -1].forEach(function (s) {
      var px = s * (hW - r - W * 0.035);
      face.add(place(RE.rb(W * 0.045, H * 0.92, 12, 5, M.aluBrushed, 3), px, 0, hD - 2));
      for (var ci = 0; ci < 3; ci++) {
        face.add(place(RE.bolt(3.4, 3, M.aluDark), px, -H * 0.34 + ci * H * 0.34, hD + 5));
      }
    });
    face.add(noShadow(place(new T.Mesh(new T.PlaneGeometry(W * 0.115, W * 0.115 * 0.24),
      M.decal(RE.brandTexture('RE-PULSE', null, { color: '#98a3ac', mainSize: 92 }), 1, 1, 0.8)),
      -hW + W * 0.115, hH - H * 0.075, hD + 0.8)));
    /* 前脸总成：向右前方抽出，与左侧内部模块分层，避免互相遮挡 */
    face.userData.explode = { dir: new T.Vector3(0.95, -0.25, 1), dist: 320 };
    g.add(face);

    /* ======================================================================
       5. 左侧 Re-Probe Dock 探针仓（规范 13 / 26 节）
       ====================================================================== */
    var dock = new T.Group();
    var bayW = D * 0.60, bayH = H * 0.58, bayCy = -H * 0.06, bayCz = D * 0.03;
    var fr = 16;
    [[0, bayH / 2 + fr / 2, bayW + fr * 2, fr], [0, -bayH / 2 - fr / 2, bayW + fr * 2, fr],
    [-bayW / 2 - fr / 2, 0, fr, bayH], [bayW / 2 + fr / 2, 0, fr, bayH]].forEach(function (b) {
      dock.add(place(RE.rb(10, b[3], b[2], 3, M.shellMid, 2), -hW - 3, bayCy + b[1], bayCz + b[0]));
    });
    var bayFloor = RE.plate(bayW, bayH, 10, 3, M.shellDeep, 0.6);
    bayFloor.rotation.y = -Math.PI / 2;
    dock.add(place(bayFloor, -hW - 1.2, bayCy, bayCz));
    var cableMat = new T.MeshStandardMaterial({ color: 0x14161a, roughness: 0.9, metalness: 0.05 });
    for (var pi = 0; pi < 4; pi++) {
      var pz = bayCz + (pi - 1.5) * bayW * 0.26;
      var py = bayCy + bayH * 0.28;
      dock.add(place(cylX(8.5, 22, M.connector, 20), -hW - 9, py, pz));
      var col = new T.MeshStandardMaterial({ color: RE.PROBE_COLORS[pi], roughness: 0.42, metalness: 0.2 });
      dock.add(place(cylX(9.4, 4, col, 20), -hW - 17, py, pz));
      dock.add(place(cylX(5.2, 10, M.aluDark, 16), -hW - 24, py, pz));
      dock.add(RE.tube([
        [-hW - 28, py, pz],
        [-hW - 40, py - 26, pz + (pi - 1.5) * 3],
        [-hW - 34, py - 78, pz + (pi - 1.5) * 8],
        [-hW - 18, bayCy - bayH * 0.30, pz + (pi - 1.5) * 10],
        [-hW - 7, bayCy - bayH * 0.40, pz * 0.30]
      ], 4.6, cableMat, 40));
    }
    var dockTag = new T.Mesh(new T.PlaneGeometry(bayW * 0.86, bayW * 0.86 * 0.32),
      M.decal(RE.tagTexture([
        { t: 'RE-PROBE DOCK   P1·P2·P3·P4', s: 26, c: '#8fd6f0', mono: true },
        { t: 'Universal Probe + Adapter A/B/C', s: 24, c: '#7d8892' }
      ], { w: 512, h: 160, bg: 'rgba(0,0,0,0)' }), 1, 1, 0.9));
    dockTag.rotation.y = -Math.PI / 2;
    dock.add(noShadow(place(dockTag, -hW - 5.6, bayCy - bayH * 0.42, bayCz)));
    dock.userData.explode = { dir: new T.Vector3(-1, 0, 0), dist: 150 };
    g.add(dock);

    /* ======================================================================
       6. 右侧卷线仓（规范 14 节）
       ====================================================================== */
    var reel = new T.Group();
    var rW = D * 0.52, rH = H * 0.46, rCy = -H * 0.10, rCz = -D * 0.02;
    [[0, rH / 2 + 8, rW + 32, 16], [0, -rH / 2 - 8, rW + 32, 16],
    [-rW / 2 - 8, 0, 16, rH], [rW / 2 + 8, 0, 16, rH]].forEach(function (b) {
      reel.add(place(RE.rb(10, b[3], b[2], 3, M.shellMid, 2), hW + 3, rCy + b[1], rCz + b[0]));
    });
    var reelFloor = RE.plate(rW, rH, 10, 3, M.shellDeep, 0.6);
    reelFloor.rotation.y = Math.PI / 2;
    reel.add(place(reelFloor, hW + 1.2, rCy, rCz));
    var drum = cylX(rH * 0.30, 34, M.plasticDark, 32);
    reel.add(place(drum, hW + 10, rCy, rCz));
    for (var ri = 0; ri < 5; ri++) {
      var t2 = new T.Mesh(new T.TorusGeometry(rH * 0.33 + ri * 3.4, 3.4, 8, 40), M.rubber);
      t2.rotation.y = Math.PI / 2;
      reel.add(place(t2, hW + 10, rCy, rCz));
    }
    reel.add(RE.tube([
      [hW + 10, rCy + rH * 0.35, rCz], [hW + 20, rCy + rH * 0.28, rCz + 22],
      [hW + 14, rCy - rH * 0.34, rCz + 14], [hW + 4, rCy - rH * 0.42, rCz - 10]
    ], 4.4, M.rubber, 30));
    /* 仓门（半开，体现可抽出） */
    var door = RE.plate(rW * 0.96, rH * 0.96, 8, 4, M.shellMid, 0.8);
    door.rotation.y = Math.PI / 2;
    reel.add(place(door, hW + 26, rCy, rCz - rH * 0.5));
    reel.userData.explode = { dir: new T.Vector3(1, 0, 0), dist: 150 };
    g.add(reel);

    /* ======================================================================
       7. 后部：横向百叶散热 / 接口区（规范 15 节）
       ====================================================================== */
    var back = new T.Group();
    var vW = W * 0.66, vH = H * 0.28, vCy = H * 0.26;
    [[0, vH / 2 + 9, vW + 36, 18], [0, -vH / 2 - 9, vW + 36, 18],
    [-vW / 2 - 9, 0, 18, vH], [vW / 2 + 9, 0, 18, vH]].forEach(function (b) {
      back.add(place(RE.rb(b[2], b[3], 12, 3, M.shellMid, 2), b[0], vCy + b[1], -hD - 3));
    });
    var ventFloor = RE.plate(vW, vH, 8, 3, M.plasticDark, 0.5);
    ventFloor.rotation.y = Math.PI;
    back.add(place(ventFloor, 0, vCy, -hD - 1.2));
    var louvers = 7;
    for (var vi = 0; vi < louvers; vi++) {
      var slat = RE.rb(vW, vH / louvers * 0.74, 20, 2, M.shellMid, 2);
      slat.rotation.x = -0.42;
      back.add(place(slat, 0, vCy - vH / 2 + (vi + 0.5) * (vH / louvers), -hD - 6));
    }
    var pW = W * 0.66, pH = H * 0.19, pCy = -H * 0.19;
    var portPanel = RE.plate(pW, pH, 10, 7, M.aluBrushed, 1.2);
    portPanel.rotation.y = Math.PI;
    back.add(place(portPanel, 0, pCy, -hD - 3.5));
    function port(x, w2, h2, mat, z2) {
      var p = RE.rb(w2, h2, 9, 2, mat, 2);
      p.rotation.y = Math.PI;
      return place(p, x, pCy + 2, -hD - (z2 || 8));
    }
    back.add(port(-pW * 0.38, 26, 18, M.connector));
    back.add(port(-pW * 0.38 + 30, 20, 18, M.connector));
    back.add(port(-pW * 0.18, 32, 27, M.aluDark));
    back.add(port(pW * 0.06, 46, 24, M.green));
    back.add(port(pW * 0.24, 24, 24, M.plasticDark));
    var ac = RE.plate(58, 40, 6, 8, M.connector, 1);
    ac.rotation.y = Math.PI;
    back.add(place(ac, pW * 0.41, pCy + 2, -hD - 7));
    back.add(port(-pW * 0.46, 24, 18, M.redEStop));
    var pTag = new T.Mesh(new T.PlaneGeometry(pW * 0.55, pH * 0.30),
      M.decal(RE.tagTexture([{ t: 'USB · ETH · CAN · SERVICE · AC 100-240V', s: 30, c: '#5d666e', mono: true }],
        { w: 768, h: 96, bg: 'rgba(0,0,0,0)' }), 1, 1, 0.85));
    pTag.rotation.y = Math.PI;
    back.add(noShadow(place(pTag, 0, pCy - pH * 0.36, -hD - 7.6)));
    back.userData.explode = { dir: new T.Vector3(0, 0, -1), dist: 195 };
    g.add(back);

    /* ======================================================================
       8. 底部：大轮 + 前支撑脚 + 底板（规范 17 / 18 节）
       ====================================================================== */
    var wheels = new T.Group();
    [1, -1].forEach(function (s) {
      var wg = new T.Group();
      /* 轮胎（黑色 PU）+ 防滑胎面 */
      wg.add(place(cylX(wheelR, wheelR * 0.54, M.rubber, 40), 0, 0, 0));
      var tread = new T.Mesh(new T.TorusGeometry(wheelR - 1.5, wheelR * 0.21, 8, 40), M.rubberSoft);
      tread.rotation.y = Math.PI / 2;
      wg.add(place(tread, 0, 0, 0));
      /* 轮毂 + 5 颗轮毂螺栓 */
      wg.add(place(cylX(wheelR * 0.62, wheelR * 0.58, M.aluDark, 30), 0, 0, 0));
      wg.add(place(cylX(wheelR * 0.26, wheelR * 0.68, M.aluBrushed, 22), 0, 0, 0));
      for (var wi = 0; wi < 5; wi++) {
        var wa = (wi / 5) * Math.PI * 2;
        wg.add(place(cylX(2.8, wheelR * 0.64, M.aluDark, 10),
          0, Math.cos(wa) * wheelR * 0.36, Math.sin(wa) * wheelR * 0.36));
      }
      /* 轮罩支架 + 挡泥板 */
      wg.add(place(RE.rb(wheelR * 1.10, wheelR * 1.25, wheelR * 1.30, 11, M.shellPanel, 3), 0, wheelR * 0.70, 0));
      var mud = new T.Mesh(new T.TorusGeometry(wheelR * 1.18, 10, 8, 28, Math.PI), M.rubber);
      mud.rotation.y = Math.PI / 2; mud.rotation.z = Math.PI;
      wg.add(place(mud, 0, 0, 0));
      wheels.add(place(wg, s * (hW * 0.62), floorY + wheelR, -hD + D * 0.40));
    });
    /* 前部两个支撑脚 */
    [1, -1].forEach(function (s) {
      var fg = new T.Group();
      fg.add(place(RE.rb(62, 60, wheelR * 1.35, 9, M.shellPanel, 3), 0, 0, 0));
      fg.add(place(RE.rb(44, 26, 46, 6, M.aluDark, 2), 0, -26, 0));
      var pad = new T.Mesh(new T.CylinderGeometry(30, 27, 18, 24), M.rubber);
      pad.castShadow = pad.receiveShadow = true;
      fg.add(place(pad, 0, -37, 0));
      wheels.add(place(fg, s * (hW * 0.62), floorY + wheelR + 4, hD - D * 0.20));
    });
    var basePlate = RE.plate(W * 0.90, D * 0.86, 12, 5, M.shellDeep, 1);
    basePlate.rotation.x = Math.PI / 2;
    g.add(place(basePlate, 0, -hH - 2.5, 0));
    for (var qi = 0; qi < 6; qi++) {
      g.add(place(RE.bolt(4.2, 4, M.aluDark), (qi % 3 - 1) * W * 0.28, -hH - 5.5, (qi < 3 ? -1 : 1) * D * 0.30));
    }
    wheels.userData.explode = { dir: new T.Vector3(0, -1, 0), dist: 200 };
    g.add(wheels);

    /* ======================================================================
       9. 标注锚点
       ====================================================================== */
    var labels = [
      { p: [0, bezCy, hD + 34], t: '10.1" 工业触控屏', s: '16:10 · 黑色玻璃 + 22mm 实体边框' },
      { p: [-W * 0.30, ctlY + 12, hD + 48], t: '实体旋钮', s: '菜单 / 参数调整' },
      { p: [W * 0.015, ctlY, hD + 44], t: 'START · PAUSE · CONFIRM', s: '保留实体控制件' },
      { p: [W * 0.31, ctlY, hD + 58], t: 'E-STOP 安全停止', s: 'Ø' + Math.round(estopR * 2) + 'mm 红蘑菇头 + 黄底座' },
      { p: [-hW - 30, bayCy + bayH * 0.30, bayCz - 46], t: 'Re-Probe Dock 探针仓', s: 'P1–P4 + Universal Probe / Adapter A·B·C' },
      { p: [hW + 30, rCy, rCz - 26], t: '卷线仓 · 线缆管理', s: '线缆不裸露，可侧向抽出' },
      { p: [0, vCy + vH * 0.5, -hD - 30], t: '横向百叶散热', s: 'Air Outlet — 非电脑式圆孔' },
      { p: [W * 0.30, gripCy, rodZ + 44], t: '双杆伸缩拉杆', s: 'TPE 防滑握把 + 释放按钮' },
      { p: [gx, gy, gz], t: 'TPU 防撞包角', s: '8 处独立包角，略突出主体' },
      { p: [hW * 0.62, floorY + wheelR * 0.4, -hD + D * 0.40], t: '大轮 Ø' + P.wheel + 'mm', s: '两轮 + 前部支撑脚（规范 17 节）' },
      { p: [0, hH + 36, trayZ], t: '顶部维护工作台', s: '下沉工具槽 + 两侧保护边框' },
      { p: [0, panCy, hD + 28], t: 'RE-PULSE 铭牌', s: 'Energy Storage Health Guardian' }
    ];

    /* 全景视角下只展示核心标注，避免画面拥挤 */
    [0, 3, 4, 7, 8, 10].forEach(function (i) { labels[i].primary = true; });

    return {
      group: g, labels: labels, name: 'Re-Pulse',
      size: { W: W, D: D, H: H, floorY: floorY, total: P.handleTop, wheel: P.wheel }
    };
  };

})(window.RE);
