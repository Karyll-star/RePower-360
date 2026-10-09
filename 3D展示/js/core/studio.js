/* ============================================================================
   Re-Energy 3D 展示 — 影棚环境 / 灯光 / 展台 / 相机轨道控制
   ========================================================================== */
(function (RE) {
  'use strict';
  var T = THREE;

  /* ==========================================================================
     程序化影棚环境贴图（柔光箱反射）—— 让阳极氧化铝与黑色玻璃有真实高光
     ========================================================================== */
  RE.buildEnvironment = function (renderer, scene) {
    var pmrem = new T.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    var es = new T.Scene();
    es.background = new T.Color(0x0b0f13);

    function panel(w, h, color, pos, rot) {
      var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: color, side: T.DoubleSide }));
      m.position.set(pos[0], pos[1], pos[2]);
      if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
      es.add(m);
      return m;
    }
    /* 顶部主柔光箱 */
    panel(16, 16, 0xffffff, [0, 8, 0], [Math.PI / 2, 0, 0]);
    panel(5, 16, 0xf2fbff, [0, 7, 0], [Math.PI / 2, 0, 0]);
    /* 左侧冷光板 */
    panel(12, 10, 0xcfe6f6, [-8, 3.0, 1], [0, Math.PI / 2, 0]);
    /* 右侧暖灰板 */
    panel(12, 8, 0x5f6d78, [8, 2.6, 1], [0, -Math.PI / 2, 0]);
    /* 正面补光 */
    panel(12, 7, 0x9db5c6, [0, 2.2, 9], [0, Math.PI, 0]);
    /* 背光条（勾边） */
    panel(10, 3.6, 0xd6ebfa, [0, 4.0, -8], [0, 0, 0]);
    /* 地面反弹光 */
    panel(24, 24, 0x2b343c, [0, -3.0, 0], [-Math.PI / 2, 0, 0]);

    /* sigma 过大会请求 >20 次采样而被 three 截断并告警，这里收敛到安全范围 */
    var tex = pmrem.fromScene(es, 0.02).texture;
    scene.environment = tex;
    /* 全局压低环境反射强度，避免金属/玻璃像镜子一样炫光（r163+ 生效） */
    scene.environmentIntensity = 0.34;
    pmrem.dispose();
    return tex;
  };

  /* ==========================================================================
     影棚灯光（主光 + 补光 + 勾边光 + 天地光）
     ========================================================================== */
  RE.buildLights = function (scene) {
    var key = new T.DirectionalLight(0xffffff, 1.8);
    key.position.set(2.6, 3.8, 2.4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.4;
    key.shadow.camera.far = 14;
    key.shadow.camera.left = -2.6;
    key.shadow.camera.right = 2.6;
    key.shadow.camera.top = 2.8;
    key.shadow.camera.bottom = -1.2;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.018;
    key.shadow.radius = 2.4;
    scene.add(key);

    var fill = new T.DirectionalLight(0x9fc2dd, 1.05);
    fill.position.set(-3.2, 1.9, 1.6);
    scene.add(fill);

    var rim = new T.DirectionalLight(0xcfe3f5, 1.75);
    rim.position.set(-1.6, 2.4, -3.4);
    scene.add(rim);

    var rim2 = new T.DirectionalLight(0x8fb6d6, 0.85);
    rim2.position.set(3.4, 1.2, -2.6);
    scene.add(rim2);

    /* 相机侧长明补光，保证任何视角都有细节 */
    var front = new T.DirectionalLight(0xcfe0ee, 1.15);
    front.position.set(-0.6, 1.4, 4.2);
    scene.add(front);

    scene.add(new T.HemisphereLight(0x9fb6c6, 0x1b2126, 0.75));
    return key;
  };

  /* ==========================================================================
     展台（混凝土平台 + 渐变消失 → 影棚感）
     ========================================================================== */
  RE.buildPodium = function (scene) {
    var M = RE.M;
    var slab = RE.rb(5.4, 0.30, 4.0, 0.02, M.platform, 3);
    slab.receiveShadow = true; slab.castShadow = false;
    slab.position.set(0, -0.15, 0);
    scene.add(slab);

    /* 后景台阶，增加纵深 */
    var step = RE.rb(4.0, 0.5, 1.5, 0.02, M.platform, 2);
    step.receiveShadow = true; step.castShadow = false;
    step.position.set(0, -0.40, -2.6);
    scene.add(step);
    return slab;
  };

  /* ==========================================================================
     相机轨道控制（自研，无外部依赖）
     ========================================================================== */
  RE.Orbit = function (camera, dom) {
    var self = this;
    this.camera = camera;
    this.dom = dom;
    this.target = new T.Vector3(0, 0.34, 0);
    this.sph = new T.Spherical(2.95, 1.12, 0.62);
    this.goal = this.sph.clone();
    this.goalTarget = this.target.clone();
    this.minR = 0.30; this.maxR = 9.0;
    this.minPolar = 0.13; this.maxPolar = 1.53;
    this.autoRotate = true;
    this.autoSpeed = 0.16;
    this.damp = 0.14;
    this.enabled = true;

    var drag = null;
    var pointers = {}, nDown = 0, pinch0 = 0;

    function pos(e) { return { x: e.clientX, y: e.clientY }; }

    dom.addEventListener('pointerdown', function (e) {
      if (!self.enabled) return;
      dom.setPointerCapture && dom.setPointerCapture(e.pointerId);
      pointers[e.pointerId] = pos(e); nDown++;
      drag = { x: e.clientX, y: e.clientY, pan: (e.button === 2 || e.shiftKey || e.ctrlKey) };
      if (nDown === 2) {
        var ks = Object.keys(pointers);
        pinch0 = Math.hypot(pointers[ks[0]].x - pointers[ks[1]].x, pointers[ks[0]].y - pointers[ks[1]].y);
      }
    });

    dom.addEventListener('pointermove', function (e) {
      if (!drag || !self.enabled) return;
      if (pointers[e.pointerId]) pointers[e.pointerId] = pos(e);
      if (nDown === 2) {
        var ks = Object.keys(pointers);
        if (ks.length === 2) {
          var d = Math.hypot(pointers[ks[0]].x - pointers[ks[1]].x, pointers[ks[0]].y - pointers[ks[1]].y);
          if (pinch0 > 0) self.zoom(pinch0 / Math.max(1, d));
          pinch0 = d;
        }
        return;
      }
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
      if (drag.pan) {
        var f = self.goal.radius * 0.0016;
        var right = new T.Vector3().setFromMatrixColumn(camera.matrix, 0);
        var up = new T.Vector3().setFromMatrixColumn(camera.matrix, 1);
        self.goalTarget.addScaledVector(right, -dx * f).addScaledVector(up, dy * f);
      } else {
        self.goal.theta -= dx * 0.0062;
        self.goal.phi = RE.clamp(self.goal.phi - dy * 0.0055, self.minPolar, self.maxPolar);
      }
    });

    function up(e) {
      if (pointers[e.pointerId]) { delete pointers[e.pointerId]; nDown--; }
      if (nDown <= 0) { nDown = 0; drag = null; pinch0 = 0; }
    }
    dom.addEventListener('pointerup', up);
    dom.addEventListener('pointercancel', up);
    dom.addEventListener('pointerleave', up);
    dom.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    dom.addEventListener('wheel', function (e) {
      if (!self.enabled) return;
      e.preventDefault();
      self.zoom(1 + RE.clamp(e.deltaY, -120, 120) * 0.0011);
    }, { passive: false });

    this.zoom = function (k) {
      self.goal.radius = RE.clamp(self.goal.radius * k, self.minR, self.maxR);
    };
  };

  RE.Orbit.prototype.setView = function (theta, phi, radius, target) {
    this.goal.theta = theta;
    this.goal.phi = RE.clamp(phi, this.minPolar, this.maxPolar);
    if (radius) this.goal.radius = RE.clamp(radius, this.minR, this.maxR);
    if (target) this.goalTarget.set(target[0], target[1], target[2]);
  };

  RE.Orbit.prototype.spin = function (dt) {
    if (this.autoRotate && this.enabled) this.goal.theta -= dt * this.autoSpeed;
  };

  RE.Orbit.prototype.update = function (dt) {
    var k = 1 - Math.pow(1 - this.damp, Math.max(1, dt * 60));
    this.sph.radius += (this.goal.radius - this.sph.radius) * k;
    /* 角度按最短路径插值，避免旋转预设跳变 */
    var dTheta = this.goal.theta - this.sph.theta;
    this.sph.theta += dTheta * k;
    this.sph.phi += (this.goal.phi - this.sph.phi) * k;
    this.target.lerp(this.goalTarget, k);
    var p = new T.Vector3().setFromSpherical(this.sph).add(this.target);
    this.camera.position.copy(p);
    this.camera.lookAt(this.target);
  };

})(window.RE);
