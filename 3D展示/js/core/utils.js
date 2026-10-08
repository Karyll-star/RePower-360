/* ============================================================================
   Re-Energy 工业产品 3D 展示 — 通用工具库
   几何 / 贴图 / 材质   (依赖 three.min.js)
   建模坐标单位：mm，根节点统一乘以 RE.MM 缩放到米
   ========================================================================== */
window.RE = window.RE || {};
(function (RE) {
  'use strict';
  var T = THREE;
  RE.T = T;
  RE.MM = 0.001;

  RE.clamp = function (v, a, b) { return Math.min(Math.max(v, a), b); };
  RE.lerp = function (a, b, t) { return a + (b - a) * t; };

  /* ==========================================================================
     1. 几何
     ========================================================================== */

  /* 圆角立方体（球扫掠圆角，单一半径，法线解析求解 → 曲面平滑、平面锐利） */
  RE.roundedBoxGeometry = function (w, h, d, r, seg) {
    var n = Math.max(1, Math.round(seg == null ? 3 : seg));
    var hx = w / 2, hy = h / 2, hz = d / 2;
    r = RE.clamp(r, 0.001, Math.min(hx, hy, hz) - 0.001);

    function axis(half) {
      var a = [], i, th;
      for (i = 0; i <= n; i++) { th = (i / n) * Math.PI / 2; a.push(-half + r * (1 - Math.cos(th))); }
      a.push(0);
      for (i = n; i >= 0; i--) { th = (i / n) * Math.PI / 2; a.push(half - r * (1 - Math.cos(th))); }
      a.sort(function (x, y) { return x - y; });
      var out = [];
      for (i = 0; i < a.length; i++) {
        if (!out.length || a[i] - out[out.length - 1] > 1e-4) out.push(a[i]);
      }
      return out;
    }
    var ax = axis(hx), ay = axis(hy), az = axis(hz);
    var AX = { x: ax, y: ay, z: az };
    var HALF = { x: hx, y: hy, z: hz };

    /* 面表：法线轴 / 符号 / 网格两个方向（满足 cross(u,v)=n，保证三角面朝外） */
    var faces = [
      { n: 'x', s: 1, u: 'y', v: 'z' },
      { n: 'x', s: -1, u: 'z', v: 'y' },
      { n: 'y', s: 1, u: 'z', v: 'x' },
      { n: 'y', s: -1, u: 'x', v: 'z' },
      { n: 'z', s: 1, u: 'x', v: 'y' },
      { n: 'z', s: -1, u: 'y', v: 'x' }
    ];

    var pos = [], nor = [], uv = [], idx = [];
    var P = new T.Vector3(), I = new T.Vector3(), N = new T.Vector3();

    faces.forEach(function (f) {
      var U = AX[f.u], V = AX[f.v], base = pos.length / 3;
      var nu = U.length, nv = V.length, i, j;
      for (j = 0; j < nv; j++) {
        for (i = 0; i < nu; i++) {
          P.set(0, 0, 0);
          P[f.n] = f.s * HALF[f.n];
          P[f.u] = U[i];
          P[f.v] = V[j];
          I.set(
            RE.clamp(P.x, -hx + r, hx - r),
            RE.clamp(P.y, -hy + r, hy - r),
            RE.clamp(P.z, -hz + r, hz - r)
          );
          N.copy(P).sub(I);
          var len = N.length();
          if (len > 1e-6) { N.multiplyScalar(1 / len); }
          else { N.set(0, 0, 0); N[f.n] = f.s; }
          pos.push(I.x + N.x * r, I.y + N.y * r, I.z + N.z * r);
          nor.push(N.x, N.y, N.z);
          uv.push(i / (nu - 1 || 1), j / (nv - 1 || 1));
        }
      }
      for (j = 0; j < nv - 1; j++) {
        for (i = 0; i < nu - 1; i++) {
          var a = base + j * nu + i, b = a + 1, c = a + nu + 1, d2 = a + nu;
          idx.push(a, b, c, a, c, d2);
        }
      }
    });

    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    return geo;
  };

  RE.rb = function (w, h, d, r, mat, seg) {
    var m = new T.Mesh(RE.roundedBoxGeometry(w, h, d, r, seg == null ? 3 : seg), mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  };

  /* 圆角矩形 Shape */
  RE.roundedRectShape = function (w, h, r) {
    var s = new T.Shape(), x = -w / 2, y = -h / 2;
    r = RE.clamp(r, 0, Math.min(w, h) / 2 - 0.01);
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  };

  /* 圆角矩形挤出板（沿 +Z 挤出，几何在 Z 方向居中） */
  RE.plateGeometry = function (w, h, r, depth, bevel) {
    var bv = bevel == null ? Math.min(1.2, depth * 0.3) : bevel;
    var geo = new T.ExtrudeGeometry(RE.roundedRectShape(w, h, r), {
      depth: Math.max(0.1, depth - bv * 2),
      bevelEnabled: bv > 0,
      bevelThickness: bv, bevelSize: bv, bevelSegments: 2,
      curveSegments: 6, steps: 1
    });
    geo.translate(0, 0, -depth / 2);
    geo.computeVertexNormals();
    return geo;
  };

  RE.plate = function (w, h, r, depth, mat, bevel) {
    var m = new T.Mesh(RE.plateGeometry(w, h, r, depth, bevel), mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  };

  /* 圆柱 / 圆环 / 螺栓 */
  RE.cyl = function (rTop, rBot, h, mat, seg) {
    var m = new T.Mesh(new T.CylinderGeometry(rTop, rBot, h, seg || 28), mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  };
  RE.bolt = function (rad, h, mat) {
    var m = new T.Mesh(new T.CylinderGeometry(rad, rad * 0.94, h, 6), mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  };

  /* 线缆：沿给定点生成管 */
  RE.tube = function (pts, rad, mat, tub) {
    var curve = new T.CatmullRomCurve3(pts.map(function (p) {
      return new T.Vector3(p[0], p[1], p[2]);
    }));
    var m = new T.Mesh(new T.TubeGeometry(curve, tub || 48, rad, 10, false), mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  };

  /* 网格细纹理（用于顶部工具槽底 / 散热格栅底） */
  RE.gridTexture = function (size, step, color, bg) {
    return RE.canvasTexture(size, size, function (ctx, w, h) {
      ctx.fillStyle = bg || '#111417'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = color || 'rgba(255,255,255,.16)';
      ctx.lineWidth = Math.max(1, size / 220);
      for (var i = 0; i <= w; i += step) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke();
      }
    }, { repeat: [1, 1] });
  };

  /* ==========================================================================
     2. Canvas 程序化贴图
     ========================================================================== */
  RE.canvasTexture = function (w, h, draw, opts) {
    opts = opts || {};
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    draw(ctx, w, h);
    var t = new T.CanvasTexture(c);
    t.colorSpace = opts.linear ? T.NoColorSpace : T.SRGBColorSpace;
    t.anisotropy = opts.aniso || 8;
    if (opts.repeat) {
      t.wrapS = t.wrapT = T.RepeatWrapping;
      t.repeat.set(opts.repeat[0], opts.repeat[1]);
    }
    t.needsUpdate = true;
    return t;
  };

  RE.FONT = '"HarmonyOS Sans SC","PingFang SC","Microsoft YaHei",Inter,Arial,sans-serif';
  RE.MONO = '"JetBrains Mono","SFMono-Regular",Consolas,monospace';

  /* 10.1" 工业触控屏 UI（对应规范 10 节效果图） */
  RE.screenUITexture = function () {
    return RE.canvasTexture(1280, 800, function (ctx, w, h) {
      var g = ctx.createLinearGradient(0, 0, w * 0.4, h);
      g.addColorStop(0, '#0e1a24'); g.addColorStop(0.5, '#0a1219'); g.addColorStop(1, '#070c11');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

      /* 顶部标题栏 */
      ctx.fillStyle = 'rgba(120,200,235,.07)'; ctx.fillRect(0, 0, w, 92);
      ctx.strokeStyle = 'rgba(120,205,240,.28)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 92); ctx.lineTo(w, 92); ctx.stroke();
      ctx.fillStyle = '#6fd8ff'; ctx.font = '700 40px ' + RE.MONO;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('RE-PULSE', 44, 47);
      ctx.fillStyle = 'rgba(150,180,200,.75)'; ctx.font = '400 26px ' + RE.FONT;
      ctx.fillText('PACK 03 · 工商业储能柜 1#柜', 280, 48);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#cfe3ef'; ctx.font = '500 34px ' + RE.MONO;
      ctx.fillText('09:42', w - 44, 47);

      /* 左侧 SOH 环 */
      var cx = 250, cy = 400, R = 132;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(90,150,180,.18)'; ctx.lineWidth = 22;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      var arc = ctx.createLinearGradient(cx - R, cy, cx + R, cy);
      arc.addColorStop(0, '#2ad6b0'); arc.addColorStop(1, '#4fd0ff');
      ctx.strokeStyle = arc; ctx.lineWidth = 22;
      ctx.beginPath();
      ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * 0.82);
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#eaf6ff'; ctx.font = '700 108px ' + RE.MONO;
      ctx.fillText('82', cx - 34, cy - 4);
      ctx.fillStyle = '#9fd8ef'; ctx.font = '600 46px ' + RE.MONO;
      ctx.fillText('%', cx + 54, cy + 2);
      ctx.fillStyle = '#7fb6cf'; ctx.font = '500 30px ' + RE.FONT;
      ctx.fillText('SOH 健康度', cx, cy + 84);

      /* 右侧数据行 */
      var rows = [
        ['PACK 编号', 'PACK 03', '#dff0fa'],
        ['单体温度', '31.4 °C', '#7fe9c8'],
        ['压差 ΔV', '18 mV', '#ffd98a'],
        ['SOC 荷电', '67 %', '#8fd8ff']
      ];
      var x0 = 520, y0 = 190, rh = 108;
      ctx.textAlign = 'left';
      rows.forEach(function (r, i) {
        var y = y0 + i * rh;
        ctx.fillStyle = 'rgba(255,255,255,.035)';
        ctx.fillRect(x0 - 24, y - 40, w - x0 - 20, 82);
        ctx.fillStyle = 'rgba(160,195,215,.85)'; ctx.font = '400 32px ' + RE.FONT;
        ctx.fillText(r[0], x0, y);
        ctx.textAlign = 'right';
        ctx.fillStyle = r[2]; ctx.font = '600 44px ' + RE.MONO;
        ctx.fillText(r[1], w - 56, y);
        ctx.textAlign = 'left';
      });

      /* 底部安全结论 */
      ctx.fillStyle = 'rgba(45,215,150,.10)';
      ctx.fillRect(44, h - 150, w - 88, 104);
      ctx.strokeStyle = 'rgba(60,230,165,.5)'; ctx.lineWidth = 2;
      ctx.strokeRect(44, h - 150, w - 88, 104);
      ctx.fillStyle = '#3ee8a8'; ctx.font = '700 48px ' + RE.FONT;
      ctx.textAlign = 'center';
      ctx.fillText('✓  绝缘 / 温升 / 压差 全部合格 — SAFE', w / 2, h - 92);
    });
  };

  /* 品牌 LOGO（RE-ENERGY 字母标 + 产品名） */
  RE.brandTexture = function (main, sub, opt) {
    opt = opt || {};
    return RE.canvasTexture(1024, opt.h || 256, function (ctx, w, h) {
      if (opt.bg) { ctx.fillStyle = opt.bg; ctx.fillRect(0, 0, w, h); }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var c = opt.color || '#c9d2d9';
      ctx.fillStyle = c;
      ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
      if (opt.size) {
        /* 自定义字号（用主字号撑满） */
      }
      ctx.font = '700 ' + (opt.mainSize || 96) + 'px ' + RE.FONT;
      ctx.fillText(main, w / 2, h * (sub ? 0.36 : 0.5));
      if (sub) {
        ctx.font = '400 ' + (opt.subSize || 40) + 'px ' + RE.FONT;
        ctx.fillStyle = opt.subColor || 'rgba(190,205,216,.85)';
        ctx.fillText(sub, w / 2, h * 0.74);
      }
    });
  };

  /* 铭牌 / 丝印标签 */
  RE.tagTexture = function (lines, opt) {
    opt = opt || {};
    var W = opt.w || 512, H = opt.h || 128;
    return RE.canvasTexture(W, H, function (ctx, w, h) {
      ctx.fillStyle = opt.bg || '#22262b';
      if (opt.round) {
        var r = opt.round;
        ctx.beginPath();
        ctx.moveTo(r, 0); ctx.lineTo(w - r, 0); ctx.quadraticCurveTo(w, 0, w, r);
        ctx.lineTo(w, h - r); ctx.quadraticCurveTo(w, h, w - r, h);
        ctx.lineTo(r, h); ctx.quadraticCurveTo(0, h, 0, h - r);
        ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0); ctx.fill();
      } else { ctx.fillRect(0, 0, w, h); }
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      var n = lines.length;
      lines.forEach(function (l, i) {
        ctx.fillStyle = l.c || '#9aa7b2';
        ctx.font = (l.w || 500) + ' ' + (l.s || 30) + 'px ' + (l.mono ? RE.MONO : RE.FONT);
        var y = h * ((i + 0.5) / n);
        ctx.textAlign = l.align || 'left';
        ctx.fillText(l.t, l.align === 'right' ? w - 16 : (l.align === 'center' ? w / 2 : 16), y);
      });
    });
  };

  /* 粗糙混凝土展台贴图 */
  RE.concreteTexture = function () {
    return RE.canvasTexture(1024, 1024, function (ctx, w, h) {
      ctx.fillStyle = '#3a4045'; ctx.fillRect(0, 0, w, h);
      var img = ctx.getImageData(0, 0, w, h), d = img.data;
      for (var i = 0; i < d.length; i += 4) {
        var n = (Math.random() - 0.5) * 26;
        d[i] += n; d[i + 1] += n; d[i + 2] += n;
      }
      ctx.putImageData(img, 0, 0);
      for (var k = 0; k < 220; k++) {
        var x = Math.random() * w, y = Math.random() * h, rr = 20 + Math.random() * 160;
        var gg = ctx.createRadialGradient(x, y, 0, x, y, rr);
        var a = Math.random() * 0.05;
        gg.addColorStop(0, 'rgba(255,255,255,' + a + ')');
        gg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.3); ctx.fill();
      }
      for (var m = 0; m < 90; m++) {
        var x2 = Math.random() * w, y2 = Math.random() * h, r2 = 10 + Math.random() * 60;
        var g2 = ctx.createRadialGradient(x2, y2, 0, x2, y2, r2);
        g2.addColorStop(0, 'rgba(0,0,0,' + (Math.random() * 0.10) + ')');
        g2.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(x2, y2, r2, 0, 6.3); ctx.fill();
      }
    }, { repeat: [3, 3] });
  };

  /* ==========================================================================
     3. 材质库（由 config.js 的 RE.CMF 构建）
     ========================================================================== */
  RE.buildMaterials = function (C) {
    var M = {};
    function std(k, o) {
      M[k] = new T.MeshStandardMaterial(Object.assign({ color: C[k] && C[k].color != null ? C[k].color : 0x808080 }, o || (C[k] || {})));
    }
    function phys(k, o) {
      M[k] = new T.MeshPhysicalMaterial(Object.assign({}, C[k] || {}, o || {}));
    }
    std('shell'); std('shellDeep'); std('shellMid'); std('shellPanel');
    std('rubber'); std('rubberSoft');
    std('alu'); std('aluDark'); std('aluBrushed');
    std('plasticDark'); std('connector'); std('green');
    std('pcb'); std('chip');
    phys('glass', { clearcoat: 1, clearcoatRoughness: 0.06 });
    std('redEStop'); std('yellow');
    std('platform');

    M.platform.map = RE.concreteTexture();
    M.platform.roughnessMap = M.platform.map;

    M.screen = new T.MeshBasicMaterial({ map: RE.screenUITexture(), toneMapped: false });
    M.ledCyan = new T.MeshBasicMaterial({ color: C.ledCyan, toneMapped: false });
    M.ledGreen = new T.MeshBasicMaterial({ color: C.ledGreen, toneMapped: false });
    M.ledAmber = new T.MeshBasicMaterial({ color: 0xffc451, toneMapped: false });
    M.ledWhite = new T.MeshBasicMaterial({ color: C.ledWhite, toneMapped: false });
    M.ledOff = new T.MeshStandardMaterial({ color: 0x2a2f35, roughness: 0.4 });

    /* 丝印 / 贴花（透明底，双面） */
    M.decal = function (tex, w, h, opacity) {
      var m = new T.MeshBasicMaterial({
        map: tex, transparent: true, depthWrite: false, toneMapped: false,
        opacity: opacity == null ? 0.95 : opacity
      });
      m.userData.isDecal = true;
      return m;
    };
    return M;
  };

})(window.RE);
