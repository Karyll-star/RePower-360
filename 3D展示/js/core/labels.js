/* ============================================================================
   3D 标注系统：DOM 投影标签 + 尺寸标注（mm 级）
   ========================================================================== */
(function (RE) {
  'use strict';
  var T = THREE;

  /* ---------------------------- DOM 投影标签 ---------------------------- */
  RE.Labels = function (host) {
    this.host = host;
    this.items = [];
    this.visible = true;
  };

  RE.Labels.prototype.clear = function () {
    while (this.host.firstChild) this.host.removeChild(this.host.firstChild);
    this.items = [];
  };

  /** list: [{p:[x,y,z](mm), t, s, n?, kind?}], group: 该标注所属模型组 */
  RE.Labels.prototype.set = function (list, group, kind) {
    this.clear();
    this.add(list, group, kind);
  };

  RE.Labels.prototype.add = function (list, group, kind) {
    var self = this;
    list.forEach(function (L) {
      var div = document.createElement('div');
      div.className = 'label' + (L.kind ? ' ' + L.kind : '') + (kind ? ' ' + kind : '');
      var dot = document.createElement('span'); dot.className = 'label-dot';
      var body = document.createElement('span'); body.className = 'label-body';
      var b = document.createElement('b'); b.textContent = L.t;
      body.appendChild(b);
      if (L.s) { var i = document.createElement('i'); i.textContent = L.s; body.appendChild(i); }
      div.appendChild(dot); div.appendChild(body);
      self.host.appendChild(div);
      var v = new T.Vector3(L.p[0], L.p[1], L.p[2]);
      var n = L.n ? new T.Vector3(L.n[0], L.n[1], L.n[2]).normalize() : v.clone().normalize();
      self.items.push({ el: div, v: v, n: n, group: group, op: 1 });
    });
  };

  RE.Labels.prototype.update = function (camera, size) {
    var w = size.w, h = size.h;
    var camPos = camera.position;
    var vis = [];
    this.items.forEach(function (it) {
      var el = it.el;
      if (!it.group || !it.group.visible) { el.style.display = 'none'; return; }
      var p = it.v.clone();
      it.group.localToWorld(p);
      var view = p.clone().applyMatrix4(camera.matrixWorldInverse);
      if (view.z > -0.02) { el.style.display = 'none'; return; }
      var nrm = it.n.clone().transformDirection(it.group.matrixWorld);
      var toCam = camPos.clone().sub(p).normalize();
      var facing = nrm.dot(toCam);
      var proj = p.clone().project(camera);
      var x = (proj.x * 0.5 + 0.5) * w;
      var y = (-proj.y * 0.5 + 0.5) * h;
      if (x < -200 || x > w + 200 || y < -100 || y > h + 100) { el.style.display = 'none'; return; }
      /* 背面标注淡出，避免“穿透”误读 */
      var target = facing > 0.12 ? 1 : (facing > -0.10 ? (facing + 0.10) / 0.22 : 0.10);
      it.op += (target - it.op) * 0.18;
      if (target <= 0.05) { el.style.display = 'none'; return; }
      el.style.opacity = it.op.toFixed(3);
      el.style.display = 'flex';
      el.style.zIndex = String(1000 - Math.round(view.z * 100));
      vis.push({ it: it, x: x, y: y });
    });

    /* 防重叠：按纵深排序，逐个向下/向上推挤到不冲突的位置 */
    vis.sort(function (a, b) { return b.it.op - a.it.op; });
    var placed = [], STEP = 34;
    vis.forEach(function (v) {
      var dy = 0, ok = false;
      for (var k = 0; k < 9 && !ok; k++) {
        dy = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * STEP;
        ok = !placed.some(function (q) {
          return Math.abs(q.x - v.x) < 268 && Math.abs(q.y + q.dy - (v.y + dy)) < 30;
        });
      }
      v.dy = dy;
      placed.push(v);
      v.it.el.style.transform = 'translate(' + v.x.toFixed(1) + 'px,' + (v.y + dy).toFixed(1) + 'px)';
    });
  };

  /* ---------------------------- 尺寸标注 ---------------------------- */
  RE.buildDimensions = function (size, opt) {
    opt = opt || {};
    var vertical = !!opt.vertical;      // Re-Pulse 需带拉杆总高
    var W = size.W, D = size.D;
    var hH = size.H / 2, hW = W / 2, hD = D / 2;
    var fy = size.floorY;
    var off = Math.max(W, size.H) * 0.16;
    var pts = [], anchors = [];

    var mat = new T.LineBasicMaterial({ color: 0x64d2ff, transparent: true, opacity: 0.75 });
    function seg(a, b) { pts.push(a[0], a[1], a[2], b[0], b[1], b[2]); }
    function tick(p, dir, len) {
      seg([p[0] - dir[0] * len, p[1] - dir[1] * len, p[2] - dir[2] * len],
        [p[0] + dir[0] * len, p[1] + dir[1] * len, p[2] + dir[2] * len]);
    }

    var zf = hD + off;
    /* 宽度 W */
    var y1 = fy - off * 0.55;
    seg([-hW, y1, zf], [hW, y1, zf]);
    tick([-hW, y1, zf], [0, 1, 0], off * 0.14);
    tick([hW, y1, zf], [0, 1, 0], off * 0.14);
    seg([-hW, fy, zf], [-hW, y1 - off * 0.14, zf]);
    seg([hW, fy, zf], [hW, y1 - off * 0.14, zf]);
    anchors.push({ p: [0, y1, zf], t: '宽 ' + W + ' mm', kind: 'dim' });

    /* 深度 D */
    var x1 = hW + off * 0.55;
    seg([x1, y1, -hD], [x1, y1, hD]);
    tick([x1, y1, -hD], [0, 1, 0], off * 0.14);
    tick([x1, y1, hD], [0, 1, 0], off * 0.14);
    anchors.push({ p: [x1, y1, hD * 0.15], t: '深 ' + D + ' mm', kind: 'dim' });

    /* 高度 */
    var x2 = -hW - off * 0.55;
    var yTop = vertical ? size.floorY + size.total : hH;
    seg([x2, fy, zf], [x2, yTop, zf]);
    tick([x2, fy, zf], [1, 0, 0], off * 0.14);
    tick([x2, yTop, zf], [1, 0, 0], off * 0.14);
    anchors.push({
      p: [x2, (fy + yTop) / 2, zf],
      t: vertical ? '总高 ' + size.total + ' mm（含拉杆）' : '高 ' + size.H + ' mm',
      kind: 'dim'
    });
    if (vertical) {
      /* 主体高度单独标注 */
      var x3 = -hW - off * 1.15;
      seg([x3, -hH, zf], [x3, hH, zf]);
      tick([x3, -hH, zf], [1, 0, 0], off * 0.10);
      tick([x3, hH, zf], [1, 0, 0], off * 0.10);
      anchors.push({ p: [x3, 0, zf], t: '主体 ' + size.W + '×' + size.D + '×' + size.H, kind: 'dim' });
    }

    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
    var lines = new T.LineSegments(geo, mat);
    lines.frustumCulled = false;
    return { group: lines, anchors: anchors };
  };

})(window.RE);
