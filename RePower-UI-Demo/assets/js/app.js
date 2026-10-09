/* ============================================================================
 * RePower-360 · 移动端 App（运维工程师现场作业 + 厂长小程序）
 * 四个主屏：首页 / 扫码连接 / 活化作业流 / 电池护照
 * 叠加层：温度异常安全指引（按《活化作业安全规范》模拟）
 * ==========================================================================*/
(function () {
  'use strict';
  const D = window.RP;
  const M = D.MOBILE;
  const $ = s => document.querySelector(s);

  const ICON = {
    home: '<path d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1z"/>',
    scan: '<path d="M4 8V5a1 1 0 011-1h3M20 8V5a1 1 0 00-1-1h-3M4 16v3a1 1 0 001 1h3M20 16v3a1 1 0 01-1 1h-3"/><path d="M4 12h16"/>',
    job: '<path d="M13 3L5 13h6l-1 8 8-10h-6z"/>',
    pass: '<path d="M6 3h9l4 4v14a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>'
  };
  const TABS = [
    { k: 'home', t: '首页' }, { k: 'scan', t: '扫码连接' },
    { k: 'job', t: '活化作业' }, { k: 'pass', t: '电池护照' }
  ];
  const BARS = {
    home: ['今日作业', ''], scan: ['设备扫码连接', ''],
    job: ['一键活化作业流', ''], pass: ['电池护照与转卖', '']
  };

  let tab = 'home';
  let connected = false;
  let timer = null;
  let progress = 0;      // 0~100
  let stage = 0;         // 作业步骤 0~3
  let listed = false;

  const money = D.money;
  const svg = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round">${ICON[n]}</svg>`;

  function clearTimer() { if (timer) { clearInterval(timer); timer = null; } }

  /* ---------------- 状态栏 / 导航栏 ---------------- */
  function chrome() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
    $('#appStatus').innerHTML = `<span>${hh}:${mm}</span>
      <span class="sr">▍▍▍ <span style="margin-left:4px">4G</span> 🔋</span>`;
    const b = BARS[tab];
    $('#appBar').innerHTML = b[0]
      ? `<div class="ab-t">${b[0]}</div><div class="ab-b">⋯</div>`
      : `<div class="ab-b" data-act="app-back">‹</div><div class="ab-t">${b[0]}</div>`;
    $('#appTab').innerHTML = TABS.map(t => `
      <button class="ti${t.k === tab ? ' is-on' : ''}" data-act="app-nav" data-k="${t.k}">
        ${svg(t.k)}<span>${t.t}</span>
        ${t.k === 'home' && !listed ? '<span class="tbadge">1</span>' : ''}
      </button>`).join('');
  }

  /* ---------------- 屏幕：首页 ---------------- */
  function viewHome() {
    return `
      <div class="m-card accent">
        <div class="m-h">
          <div class="m-t">今日主任务</div>
          <span class="m-chip on">● 作业中</span>
        </div>
        <div style="font-size:15px;font-weight:600">${M.task.name}</div>
        <div class="m-sub">${M.task.site} · ${M.task.addr}</div>
        <div class="m-row"><span class="m-sub">作业类型</span><span class="m-kv" style="margin:0;padding:0">
          <span class="v">电芯主动均衡活化</span></span></div>
        <div class="m-row"><span class="m-sub">落后单体</span>
          <span class="mono" style="font-size:12.5px;color:#ff8b80">${M.target.worst} · SOH ${M.target.soh}%</span></div>
        <div class="m-row"><span class="m-sub">工时预算</span><span class="mono">${M.task.eta}</span></div>
        <button class="m-btn mt" data-act="app-nav" data-k="job">进入作业流</button>
      </div>

      <div class="m-card">
        <div class="m-h"><div class="m-t">我的装备</div>
          <span class="m-chip ${connected ? 'on' : ''}">${connected ? '已连接' : '未连接'}</span></div>
        ${M.devices.map(dv => `
          <div class="m-row">
            <div class="m-dev">${dv.name === 'Re-Pulse' ? '⚡' : '☁'}</div>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:600">${dv.name}</div>
              <div class="m-sub">${dv.model} · ${dv.sn}</div>
            </div>
            <div style="text-align:right">
              <div class="mono" style="font-size:12px">${dv.battery}%</div>
              <div class="m-sub">${dv.signal}</div>
            </div>
          </div>`).join('')}
        <button class="m-btn ghost mt" data-act="app-nav" data-k="scan">${connected ? '重新扫码 / 更换网关' : '扫码连接设备'}</button>
      </div>

      <div class="m-card bad">
        <div class="m-h"><div class="m-t">云端 AI 预警</div><span class="m-chip">提前 15 天</span></div>
        <div class="m-sub">${M.task.site} · PACK-03 第 7、14、21、28、35、42、48 号单体出现趋势性落后，
          若不干预，预计 10 月 24 日触发整簇限流，月损失约 <b style="color:var(--accent)">¥3,040</b>。</div>
      </div>

      <div class="m-card">
        <div class="m-h"><div class="m-t">今日收益播报</div><span class="m-sub">10-09</span></div>
        <div style="display:flex;gap:12px;text-align:center">
          <div style="flex:1"><div class="m-bignum" style="color:var(--good)">11.4<small>%</small></div>
            <div class="m-sub">昨日活化挽回容量</div></div>
          <div style="flex:1"><div class="m-bignum" style="color:var(--accent)">2,614</div>
            <div class="m-sub">预计月增收益（元）</div></div>
        </div>
      </div>`;
  }

  /* ---------------- 屏幕：扫码连接 ---------------- */
  function viewScan() {
    if (!connected) {
      return `
        <div class="m-card">
          <div class="m-h"><div class="m-t">扫码 · 重新上云</div><span class="m-chip">Step 1 / 2</span></div>
          <div class="scan">
            <svg viewBox="0 0 340 230" preserveAspectRatio="none">
              <defs><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M20 0H0v20" fill="none" stroke="rgba(255,255,255,.05)"/></pattern></defs>
              <rect width="340" height="230" fill="url(#grid)"/>
              <path d="M34 34h26M34 34v26M306 34h-26M306 34v26M34 196h26M34 196v-26M306 196h-26M306 196v-26"
                stroke="#f2a93b" stroke-width="2.4" fill="none" stroke-linecap="round"/>
            </svg>
            <div class="scan-line"></div>
            <div class="scan-tip">对准储能柜铭牌 或 Re-Bridge 网关二维码</div>
          </div>
          <div class="m-sub mt">支持千余款机型扫描识别：自动读取 Brand / BMS 版本 / 串数，
            并匹配内置 200+ 集成商私有协议解析库。</div>
          <button class="m-btn mt" data-act="app-scan">模拟扫码成功</button>
        </div>
        <div class="m-card">
          <div class="m-h"><div class="m-t">扫码可完成的事</div></div>
          <div class="m-kv"><span>① 破壁私有协议</span><span class="v">CAN / RS485 → MQTT</span></div>
          <div class="m-kv"><span>② 建立数字孪生</span><span class="v">240 颗单体建档</span></div>
          <div class="m-kv"><span>③ 下发作业参数</span><span class="v">电流 5~10A 自适应</span></div>
        </div>`;
    }
    return `
      <div class="m-card good">
        <div class="m-h"><div class="m-t">连接成功</div><span class="m-chip on">● Online</span></div>
        <div class="m-kv"><span>站点</span><span class="v">${M.task.site}</span></div>
        <div class="m-kv"><span>原厂 BMS 协议</span><span class="v">私有 CAN 250kbps</span></div>
        <div class="m-kv"><span>解析结果</span><span class="v" style="color:var(--good)">已破解 → 标准模型</span></div>
        <div class="m-kv"><span>回传链路</span><span class="v">4G Cat-1 · RSSI -78dBm</span></div>
        <div class="m-kv"><span>同步单体数</span><span class="v">240 / 240</span></div>
        <div class="m-sub mt">断档 71 天的历史数据已从本地缓存补传，电站不再是「局域网盲盒」。</div>
      </div>
      <div class="m-card">
        <div class="m-h"><div class="m-t">拟作业对象</div></div>
        <div class="m-row">
          <div class="m-dev">▤</div>
          <div style="flex:1"><div style="font-size:13px;font-weight:600">PACK-03</div>
            <div class="m-sub">${M.target.cells} 颗落后单体 · 最弱 ${M.target.worst}</div></div>
          <div class="mono" style="color:#ff8b80">ΔV ${M.target.dv}mV</div>
        </div>
        <button class="m-btn mt" data-act="app-nav" data-k="job">开始靶向活化</button>
        <button class="m-btn ghost mt" data-act="app-reset">断开连接</button>
      </div>`;
  }

  /* ---------------- 屏幕：活化作业流 ---------------- */
  const STAGES = [
    ['打开 Re-Pulse 取样仓，接入 PACK 采样端子', '免拆线直连，30 秒完成'],
    ['定位 PACK-03 落后单体（7 颗）', '作业指引：从上往下第 3 簇'],
    ['注入 5~10A 双向电流均衡与脉冲活化', '系统自动限温，随时可急停'],
    ['复核 ΔV < 12mV 并回填工单', '出具电子作业报告']
  ];
  const dvNow = () => Math.round(M.target.dv - (M.target.dv - M.target.targetDv) * progress / 100);
  const recoveredNow = () => (11.4 * progress / 100).toFixed(1);

  function viewJob() {
    if (progress >= 100) {
      return `
        <div class="m-card good">
          <div class="m-h"><div class="m-t">作业完成</div><span class="m-chip on">已回填工单</span></div>
          <div style="display:flex;gap:10px;text-align:center;margin:6px 0 10px">
            <div style="flex:1"><div class="m-bignum" style="color:var(--good)">${recoveredNow()}<small>%</small></div>
              <div class="m-sub">挽回可用容量</div></div>
            <div style="flex:1"><div class="m-bignum" style="color:var(--accent)">${dvNow()}<small>mV</small></div>
              <div class="m-sub">修复后簇间压差</div></div>
          </div>
          <div class="m-kv"><span>最高单体温度</span><span class="v">38.6 ℃</span></div>
          <div class="m-kv"><span>注入总电量</span><span class="v">42.7 Ah</span></div>
          <div class="m-kv"><span>作业耗时</span><span class="v">116 min</span></div>
          <div class="m-kv"><span>预计月增收益</span><span class="v" style="color:var(--good)">+¥2,614</span></div>
        </div>
        <div class="m-card">
          <div class="m-h"><div class="m-t">报告已推送</div></div>
          <div class="m-sub">SOH 体检报告已同步至 PC 中台与业主小程序，队长与厂长可实时查看收益变化。</div>
          <button class="m-btn mt" data-act="app-reset">返回今日任务</button>
          <button class="m-btn ghost mt" data-act="app-nav" data-k="pass">查看电池护照</button>
        </div>`;
    }
    const running = timer !== null;
    return `
      <div class="m-card accent">
        <div class="m-h"><div class="m-t">作业进度</div>
          <span class="m-chip ${running ? 'on' : ''}">${running ? '注入中' : progress > 0 ? '已暂停' : '待开始'}</span></div>
        <div style="display:flex;align-items:flex-end;gap:10px">
          <div class="m-bignum">${dvNow()}<small>mV</small></div>
          <div class="m-sub" style="padding-bottom:4px">簇间压差 ΔV ↓</div>
        </div>
        <div class="m-prog"><div class="m-fill" style="width:${progress}%"></div></div>
        <div style="display:flex;justify-content:space-between" class="m-sub">
          <span>目标 ${M.target.targetDv}mV</span><span>${progress}%</span></div>
        <div class="mt" style="display:flex;gap:12px">
          <div style="flex:1"><div class="m-sub">注入电流</div>
            <div class="mono" style="font-size:15px;color:var(--accent)">${running ? '8.4' : '0.0'} A</div></div>
          <div style="flex:1"><div class="m-sub">最高单体温度</div>
            <div class="mono" style="font-size:15px">${running ? 41.2 : 29.4} ℃</div></div>
          <div style="flex:1"><div class="m-sub">已挽回容量</div>
            <div class="mono" style="font-size:15px;color:var(--good)">${recoveredNow()}%</div></div>
        </div>
      </div>

      <div class="m-card">
        <div class="m-h"><div class="m-t">作业指引</div><span class="m-chip">Step ${stage + 1} / 4</span></div>
        <div class="ladder">
          ${STAGES.map((s, i) => `
            <div class="st ${i === stage ? 'cur' : i < stage ? 'done' : ''}">
              <span class="sn">${i + 1}</span>
              <span class="sx"><div style="font-weight:600">${s[0]}</div><div class="m-sub">${s[1]}</div></span>
              <span class="sv">${i < stage ? '✓' : i === stage && progress > 0 ? Math.min(99, Math.round(progress / 25 * 100)) + '%' : ''}</span>
            </div>${i < STAGES.length - 1 ? '<div class="arw">↓</div>' : ''}`).join('')}
        </div>
      </div>

      <div class="m-card bad">
        <div class="m-h"><div class="m-t">落后单体定位导航</div></div>
        <div class="m-sub">PACK-03 · 从上往下第 3 簇，自左向右：</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
          ${[7, 14, 21, 28, 35, 42, 48].map((n, i) => `
            <span class="m-chip ${i === 0 ? 'on' : ''}">#${String(n).padStart(3, '0')}</span>`).join('')}
        </div>
        <div class="m-sub mt">探针顺序：Universal Probe → Adapter B（适配该品牌采样端子），红接正、黑接负，听到「咔」声即锁止。</div>
      </div>

      ${running
        ? `<button class="m-btn danger" data-act="app-pause">暂停注入</button>`
        : `<button class="m-btn" data-act="app-start">${progress > 0 ? '继续活化作业' : '开始活化作业'}</button>`}
      <button class="m-btn ghost mt" data-act="app-alarm">模拟温度异常告警</button>
      <div class="m-card mt" style="margin-bottom:0">
        <div class="m-sub">安全须知：作业全程佩戴绝缘手套，柜门保持开启通风；单体温度 ≥ 45℃ 或 ΔV 反跳时，
          立即按下 Re-Pulse 机身红色急停蘑菇头。</div>
      </div>`;
  }

  function runJob() {
    clearTimer();
    timer = setInterval(() => {
      progress = Math.min(100, progress + 2);
      if (progress % 25 === 0) stage = Math.min(3, Math.floor(progress / 25));
      render();
      if (progress >= 100) { clearTimer(); stage = 3; UI.toast('作业完成，工单已自动回填', 'ok'); }
    }, 160);
  }

  /* ---------------- 屏幕：电池护照 / 转卖 ---------------- */
  function viewPass() {
    const P = D.PASSPORT;
    if (listed) {
      return `
        <div class="m-card good">
          <div class="m-h"><div class="m-t">挂牌成功</div><span class="m-chip on">撮合中</span></div>
          <div class="m-sub">${P.site} 已向 5 家认证下游厂商发布，报价有效周期 7 天。</div>
          <div class="m-kv"><span>最高报价</span><span class="v" style="color:var(--good)">${money(P.quoteHigh)}</span></div>
          <div class="m-kv"><span>最低报价</span><span class="v">${money(P.quoteLow)}</span></div>
          <div class="m-kv"><span>平台佣金 8%</span><span class="v">${money(P.bid * P.fee)}</span></div>
          <div class="m-kv"><span>业主预计到账</span><span class="v" style="color:var(--accent)">${money(P.bid)}</span></div>
          <button class="m-btn ghost mt" data-act="app-reset">返回</button>
        </div>`;
    }
    return `
      <div class="m-card">
        <div class="m-h"><div class="m-t">SOH 残值评估</div><span class="m-chip">自动出具</span></div>
        <div style="display:flex;align-items:center;gap:14px">
          <div class="m-bignum" style="color:var(--accent)">${P.soh}<small>%</small></div>
          <div style="flex:1">
            <div class="pill ok" style="margin-bottom:6px"><i></i>Grade ${P.grade}</div>
            <div class="m-sub">${P.site} · ${P.model}<br>剩余可用 ${P.remain} kWh / 标定 ${P.nominal} kWh</div>
          </div>
        </div>
        <div class="m-kv mt"><span>建议去向</span><span class="v" style="font-size:11.5px">叉车 / 低速车电池</span></div>
        <div class="m-kv"><span>评估价区间</span><span class="v">${money(P.quoteLow)} ~ ${money(P.quoteHigh)}</span></div>
        <div class="m-kv"><span>废铁回收价</span><span class="v" style="color:var(--bad)">${money(P.scrap)}</span></div>
        <div class="m-kv"><span>残值溢价</span><span class="v" style="color:var(--good)">+${money(P.bid - P.scrap)}</span></div>
      </div>

      <div class="m-card">
        <div class="m-h"><div class="m-t">数据溯源</div><span class="m-sub">27 个月</span></div>
        <div class="m-kv"><span>累计循环</span><span class="v">${P.cycleCount} 次</span></div>
        <div class="m-kv"><span>年均衰减率</span><span class="v">3.6%</span></div>
        <div class="m-kv"><span>关键干预</span><span class="v">主动均衡 6 次</span></div>
        <div class="m-sub mt">报告由 Third-party SOH 体检算法签发，可在线验签，作为下游厂商定价依据。</div>
      </div>

      <div class="m-card">
        <div class="m-h"><div class="m-t">转卖发布</div></div>
        <label class="m-row" style="cursor:pointer">
          <input type="checkbox" id="ck1" checked style="accent-color:var(--accent)">
          <span style="flex:1;font-size:12.5px">申请退役评估并出具电池护照</span>
        </label>
        <label class="m-row" style="cursor:pointer">
          <input type="checkbox" id="ck2" checked style="accent-color:var(--accent)">
          <span style="flex:1;font-size:12.5px">同意平台撮合并抽取 8% 流转佣金</span>
        </label>
        <button class="m-btn mt" data-act="app-list">一键挂牌 →</button>
        <div class="m-sub mt">挂牌后报价将在 24h 内汇总，业主可随时撤回。</div>
      </div>`;
  }

  /* ---------------- 安全报警浮层 ---------------- */
  function showAlarm() {
    const host = document.querySelector('.phone-screen');
    const old = document.querySelector('.alarm');
    if (old) old.remove();
    const div = document.createElement('div');
    div.className = 'alarm';
    div.innerHTML = `
      <div class="alarm-badge">⚠</div>
      <h3>单体温度异常</h3>
      <div class="m-sub" style="text-align:center">PACK-03 #014 温度 52.4℃，已超阈值 45℃<br>
        系统已自动降流至 2.0A 并启动风冷</div>
      <div class="asteps">
        <ul>
          <li>立即停止大电流注入，保持探针连接以便继续监测</li>
          <li>检查单体极柱是否氧化、夹具是否接触不良</li>
          <li>开启柜门通风，使用红外测温枪复核温度</li>
          <li>若 60 秒内温度未回落，按下 <b style="color:#ff8b80">Re-Pulse 红色急停蘑菇头</b></li>
          <li>温度异常将同步写入工作日志与 SOH 报告</li>
        </ul>
      </div>
      <div class="mtop">
        <button class="m-btn danger" data-act="app-alarm-close">已处置 · 降流继续作业</button>
        <button class="m-btn ghost mt" data-act="app-estop">按下急停并中止作业</button>
      </div>`;
    host.appendChild(div);
    clearTimer();
  }
  function closeAlarm() {
    const old = document.querySelector('.alarm');
    if (old) old.remove();
    if (tab === 'job' && progress < 100) { runJob(); }
  }

  /* ---------------- 右侧解说 ---------------- */
  const NOTES = [
    ['01', '扫码连接', '连接 Re-Bridge 网关与 Re-Pulse 活化箱：扫描柜体铭牌即可破壁私有协议，断网站点 30 分钟重回云端。'],
    ['02', '一键活化作业流', '落后单体自动定位引导 → 大电流注入进度条 → 完成后自动回填工单，现场 2 小时拉平整柜木桶短板。'],
    ['03', '安全闭环', '温度异常自动降流并弹出处置指引，硬件侧对应 Re-Pulse 机身上的红色急停蘑菇头（Ø35~45mm）。'],
    ['04', '电池护照与转卖发布', '自动生成第三方 SOH 体检报告并一键挂牌，Grade A/B/C 分级流转到叉车、低速车、离网微网等场景。']
  ];
  function notes() {
    const map = { home: -1, scan: 0, job: 1, pass: 3 };
    const cur = map[tab] ?? -1;
    $('#appNotes').innerHTML = `<div class="an-title">Delivery · 交付物 2 / 移动端</div>` +
      NOTES.map((n, i) => `
        <div class="an-item${i === cur ? ' on' : ''}">
          <h4><span>${n[0]}</span>${n[1]}</h4><p>${n[2]}</p></div>`).join('') +
      `<div class="an-item"><h4><span>∞</span>录屏建议</h4>
        <p>建议按 首页 → 扫码 → 作业（含告警）→ 护照挂牌 顺序录制，时长控制在 60 秒内，
          导出 MP4 随作业包提交。</p></div>`;
  }

  /* ---------------- 渲染调度 ---------------- */
  function render() {
    chrome();
    const body = { home: viewHome, scan: viewScan, job: viewJob, pass: viewPass }[tab]();
    $('#appBody').innerHTML = body;
    notes();
  }
  function go(k) {
    clearTimer();
    tab = k;
    const a = document.querySelector('.alarm'); if (a) a.remove();
    render();
  }

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    if (!t.closest('#appBody,#appTab,#appBar,.alarm')) return;
    switch (t.dataset.act) {
      case 'app-nav': go(t.dataset.k); break;
      case 'app-scan':
        connected = true; UI.toast('Re-Bridge 握手成功，正在破解私有协议…', 'ok'); render(); break;
      case 'app-reset':
        connected = false; progress = 0; stage = 0; listed = false; clearTimer(); go('home'); break;
      case 'app-start': runJob(); render(); break;
      case 'app-pause': clearTimer(); render(); break;
      case 'app-alarm': showAlarm(); break;
      case 'app-alarm-close': closeAlarm(); break;
      case 'app-estop':
        progress = 0; stage = 0; closeAlarm(); UI.toast('急停触发，作业已中止并上报中台', 'bad'); break;
      case 'app-list':
        if (!$('#ck1').checked || !$('#ck2').checked) { UI.toast('请先勾选评估与佣金协议', 'bad'); return; }
        listed = true; UI.toast('挂牌成功，5 家厂商已收到报价邀请', 'ok'); go('pass'); break;
    }
  });

  window.RP_APP = { go, render, reset: () => { connected = false; progress = 0; stage = 0; listed = false; go('home'); } };
})();
