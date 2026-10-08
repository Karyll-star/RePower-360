/* ============================================================================
   Re-Bridge 储能柜边缘数字化网关
   依据：《产品效果图.png》+《物理产品设计规范》20–25 节
   建模坐标：mm，正面 +Z，金属 ┃ 黑色主体 ┃ 金属
   ========================================================================== */
(function (RE) {
  'use strict';
  var T = THREE;

  function cylZ(r, h, mat, seg) {
    var m = RE.cyl(r, r, h, mat, seg);
    m.rotation.x = Math.PI / 2;
    return m;
  }
  function cylX(r, h, mat, seg) {
    var m = RE.cyl(r, r, h, mat, seg);
    m.rotation.z = Math.PI / 2;
    return m;
  }
  function place(o, x, y, z) { o.position.set(x, y, z); return o; }
  function noShadow(o) {
    o.traverse(function (n) { n.castShadow = false; n.receiveShadow = false; });
    return o;
  }

  RE.buildRebridge = function (B) {
    var M = RE.M;
    var W = B.W, H = B.H, D = B.D;
    var hW = W / 2, hH = H / 2, hD = D / 2;
    var g = new T.Group();
    g.name = 'Re-Bridge';

    /* ======================================================================
       1. 主体：黑色工程塑料 + 两侧阳极氧化铝端板（DNA ① 保护框）
       ====================================================================== */
    var epT = W * 0.095, bodyW = W - epT * 2;
    var body = RE.rb(bodyW, H * 0.97, D * 0.93, 4.5, M.shellDeep, 4);
    body.name = 'Body';
    g.add(place(body, 0, 0, 0));
    /* 正面下沉装饰面 */
    var front = RE.plate(bodyW * 0.80, H * 0.66, 6, 2.2, M.plasticDark, 0.5);
    g.add(place(front, 0, 4, hD * 0.93 + 0.6));

    var plates = new T.Group();
    [1, -1].forEach(function (s) {
      var ep = RE.rb(epT, H * 1.03, D * 1.15, 3.4, M.aluBrushed, 4);
      plates.add(place(ep, s * (bodyW / 2 + epT / 2), 0, 0));
      /* 端板倒角槽 + 螺钉 */
      plates.add(place(RE.rb(epT * 0.22, H * 0.72, D * 1.19, 1.6, M.aluDark, 2),
        s * (bodyW / 2 + epT / 2), 0, 0));
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (c) {
        plates.add(place(RE.bolt(2.6, 3, M.aluDark),
          s * (bodyW / 2 + epT / 2), c[0] * H * 0.36, c[1] * D * 0.34));
      });
    });
    plates.userData.explode = { dir: new T.Vector3(1, 0, 0), dist: 90 };
    g.add(plates);

    /* ======================================================================
       2. 正面：细状态光带 + 铭牌（规范 23 节）
       ====================================================================== */
    var front2 = new T.Group();
    var led = RE.rb(W * 0.46, 1.9, 2.2, 0.9, M.ledCyan, 1);
    front2.add(place(led, 0, hH - 12, hD * 0.93 + 1.5));
    front2.add(noShadow(place(new T.Mesh(new T.CircleGeometry(2.2, 12), M.ledGreen),
      -W * 0.36, hH - 12, hD * 0.93 + 1.9)));
    var logo = new T.Mesh(new T.PlaneGeometry(bodyW * 0.72, bodyW * 0.72 * 0.25),
      M.decal(RE.brandTexture('RE-BRIDGE', 'Edge Gateway', { mainSize: 96, subSize: 40 }), 1, 1, 0.92));
    front2.add(noShadow(place(logo, 0, -6, hD * 0.93 + 2.4)));
    /* 正面四角螺钉，强化工业感 */
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (c) {
      front2.add(place(RE.bolt(1.9, 2, M.aluDark),
        c[0] * bodyW * 0.42, c[1] * H * 0.40, hD * 0.93 + 1.2));
    });
    front2.userData.explode = { dir: new T.Vector3(0, 0, 1), dist: 60 };
    g.add(front2);

    /* ======================================================================
       3. 左侧 CAN / RS485，右侧 Ethernet / USB Service（规范 22 节）
       ====================================================================== */
    var ports = new T.Group();
    var lx = -bodyW / 2 - epT * 0.55, rx = bodyW / 2 + epT * 0.55;
    /* CAN */
    var can = new T.Group();
    can.add(place(cylX(5.4, epT * 1.5, M.aluDark, 20), 0, 5, 0));
    can.add(place(cylX(6.6, epT * 0.5, M.plasticDark, 20), -epT * 0.55, 5, 0));
    can.add(place(RE.rb(epT * 1.6, 12, 16, 2, M.green, 2), 0, -11, 0));
    ports.add(place(can, lx, 0, -8));
    /* RS485 */
    var rs = new T.Group();
    rs.add(place(cylX(5.4, epT * 1.5, M.aluDark, 20), 0, 5, 0));
    rs.add(place(cylX(6.6, epT * 0.5, M.plasticDark, 20), -epT * 0.55, 5, 0));
    rs.add(place(RE.rb(epT * 1.6, 12, 16, 2, M.green, 2), 0, -11, 0));
    ports.add(place(rs, lx, 0, 12));
    /* Ethernet */
    var eth = new T.Group();
    eth.add(place(RE.rb(epT * 1.6, 17, 20, 1.6, M.aluDark, 2), 0, 6, 0));
    eth.add(place(RE.rb(epT * 0.7, 11, 13, 1.2, M.plasticDark, 1), -epT * 0.6, 6, 0));
    ports.add(place(eth, rx, 0, -9));
    /* USB-C service */
    var usb = new T.Group();
    usb.add(place(RE.rb(epT * 1.5, 7, 13, 3, M.plasticDark, 2), 0, 5, 0));
    usb.add(place(RE.rb(epT * 0.6, 4, 8, 1.8, M.aluDark, 1), -epT * 0.55, 5, 0));
    ports.add(place(usb, rx, 0, 11));
    var tag = new T.Mesh(new T.PlaneGeometry(46, 14),
      M.decal(RE.tagTexture([{ t: 'CAN  RS485', s: 26, c: '#6d767e', mono: true }], { w: 384, h: 96, bg: 'rgba(0,0,0,0)' }), 1, 1, 0.85));
    tag.rotation.y = -Math.PI / 2;
    ports.add(noShadow(place(tag, lx - epT * 1.05, 0, 26)));
    var tag2 = new T.Mesh(new T.PlaneGeometry(56, 14),
      M.decal(RE.tagTexture([{ t: 'ETH  USB', s: 26, c: '#6d767e', mono: true }], { w: 384, h: 96, bg: 'rgba(0,0,0,0)' }), 1, 1, 0.85));
    tag2.rotation.y = Math.PI / 2;
    ports.add(noShadow(place(tag2, rx + epT * 1.05, 0, 26)));
    ports.userData.explode = { dir: new T.Vector3(1, 0, 1), dist: 70 };
    g.add(ports);

    /* ======================================================================
       4. 顶部：4G 天线 + 状态灯 + 铭牌（规范 22 节）
       ====================================================================== */
    var top = new T.Group();
    var antX = -W * 0.24, antZ = -D * 0.16;
    /* SMA 天线座 */
    top.add(place(new T.Mesh(new T.CylinderGeometry(5.6, 6.4, 10, 20), M.aluBrushed), antX, hH + 4, antZ));
    var ant = new T.Group();
    ant.add(place(RE.cyl(4.5, 4.5, 58, M.plasticDark, 18), 0, 33, 0));
    ant.add(place(RE.cyl(5.4, 5.4, 12, M.plasticDark, 18), 0, 12, 0));
    ant.add(place(new T.Mesh(new T.SphereGeometry(4.8, 16, 10), M.plasticDark), 0, 62, 0));
    ant.rotation.x = -0.34;
    top.add(place(ant, antX, hH + 10, antZ));
    var lb = RE.rb(W * 0.20, 3, 22, 1.4, M.aluDark, 2);
    top.add(place(lb, W * 0.24, hH + 1.6, -D * 0.10));
    top.add(place(new T.Mesh(new T.CircleGeometry(2.0, 12), M.ledGreen), W * 0.34, hH + 1.7, D * 0.10));
    var tTag = new T.Mesh(new T.PlaneGeometry(62, 16),
      M.decal(RE.tagTexture([{ t: 'RE-BRIDGE · RE-ENERGY', s: 24, c: '#79828a', mono: true }], { w: 512, h: 128, bg: 'rgba(0,0,0,0)' }), 1, 1, 0.8));
    tTag.rotation.x = -Math.PI / 2;
    top.add(noShadow(place(tTag, W * 0.16, hH + 2.3, D * 0.22)));
    top.userData.explode = { dir: new T.Vector3(0, 1, 0), dist: 80 };
    g.add(top);

    /* ======================================================================
       5. Re-Base 磁吸底座（规范 24 节）
       ====================================================================== */
    var magnet = new T.Group();
    var baseH = 11;
    magnet.add(place(RE.rb(W * 0.90, baseH, D * 0.88, 4, M.shellPanel, 3), 0, -hH - baseH / 2 + 1, 0));
    magnet.add(place(RE.rb(W * 0.86, baseH * 0.55, D * 0.84, 3, M.rubber, 2), 0, -hH - baseH + 1.4, 0));
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (c) {
      magnet.add(place(RE.cyl(8, 8, 3.4, M.connector, 24), c[0] * W * 0.32, -hH - baseH + 1.2, c[1] * D * 0.28));
      magnet.add(place(RE.bolt(3.2, 4, M.aluDark), c[0] * W * 0.36, -hH - baseH / 2 + 1, c[1] * D * 0.33));
    });
    magnet.add(place(RE.rb(W * 0.30, 8, 8, 2, M.aluDark, 2), 0, -hH - 2, D * 0.40));
    magnet.visible = true;

    /* ======================================================================
       6. DIN Rail Adapter（规范 25 节，场景 B 长期部署）
       ====================================================================== */
    var din = new T.Group();
    din.add(place(RE.rb(W * 0.86, 8, D * 0.86, 3, M.shellPanel, 3), 0, -hH - 5, 0));
    din.add(place(RE.rb(W * 0.62, 12, 5, 2, M.aluDark, 2), 0, -hH - 15, D * 0.30));
    din.add(place(RE.rb(W * 0.62, 8, 6, 2, M.aluBrushed, 2), 0, -hH - 17, -D * 0.34));
    var rail = RE.rb(W * 1.06, 7.5, 26, 1.6, M.aluBrushed, 3);
    din.add(place(rail, 0, -hH - 26, 0));
    [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(function (c) {
      din.add(place(RE.bolt(3.0, 4, M.aluDark), c[0] * W * 0.34, -hH - 3, c[1] * D * 0.32));
    });
    din.visible = false;

    var bases = new T.Group();
    bases.add(magnet, din);
    g.add(bases);

    /* ======================================================================
       7. 标注锚点
       ====================================================================== */
    var labels = [
      { p: [0, -8, hD + 34], t: 'RE-BRIDGE 边缘网关', s: '145 × 84 × 34 mm · 磁吸式多协议网关' },
      { p: [0, hH - 11, hD + 46], t: '1–2mm 细状态光带', s: '白启动 / 蓝联网 / 绿正常 / 黄异常 / 红故障' },
      { p: [-W * 0.24, hH + 74, -D * 0.16], t: '4G 天线', s: 'SMA 接口，顶部引出' },
      { p: [-hW - 34, 4, 2], t: 'CAN · RS485', s: '左侧接线端子' },
      { p: [hW + 34, 4, 2], t: 'Ethernet · USB Service', s: '右侧接口' },
      { p: [hW - 3, 0, 0], t: '金属端板 = 保护框（DNA ①）', s: '阳极氧化铝，略突出主体' },
      { p: [0, -hH - 26, 0], t: 'Re-Base 磁吸底座', s: '一推一扣，快速巡检部署' },
      { p: [0, -hH - 42, -D * 0.5], t: 'DIN Rail Adapter', s: '场景 B：长期部署（可切换）' }
    ];

    [0, 1, 3, 6].forEach(function (i) { labels[i].primary = true; });

    return {
      group: g, labels: labels, name: 'Re-Bridge',
      bases: { magnet: magnet, din: din },
      size: { W: W, D: D, H: H, floorY: { magnet: -hH - 12.6, din: -hH - 29.8 } }
    };
  };

})(window.RE);
