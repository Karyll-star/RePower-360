/* ============================================================================
 * RePower-360 · PC 中台（两种视角：服务商中控 / 订阅企业负责人）
 * 服务商中控：资产救援大盘 / 电芯数字孪生 / 收益与分成 / 工单与订阅 / 梯次撮合
 * 企业视角：  我的储能资产 / 电芯健康 / 我的收益 / 订阅与服务 / 电池护照
 * ==========================================================================*/
(function () {
  'use strict';
  const D = window.RP;
  const $ = s => document.querySelector(s);

  const ICON = {
    dash: '<path d="M3 3h7v7H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 14h7v7H3z"/>',
    twin: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>',
    money: '<path d="M3 17l6-6 4 4 8-8"/><path d="M21 7h-6M21 7v6"/>',
    order: '<path d="M4 6h16M4 12h16M4 18h10"/><circle cx="20" cy="18" r="2"/>',
    resell: '<path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 12l9 4 9-4M3 17l9 4 9-4"/>',
    home: '<path d="M3 11.5l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    service: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5l3.2 2"/>'
  };

  /* 两种视角：服务商中控（我们）/ 订阅企业负责人（客户）
   * 救援大盘、工单派发等全量运营能力仅服务商可见；客户只看自己名下的 1 座柜。 */
  let role = 'ops';   // 'ops' 服务商中控 | 'client' 企业负责人
  const ROLES = {
    ops: {
      label: '服务商中控', badge: '运营',
      org: 'RE-ENERGY · 运营中控', ava: '林', user: '林澈', title: '运营负责人 · 全量 10 座柜',
      home: 'dash',
      menu: [
        { k: 'dash',   t: '资产救援大盘', b: 'LIVE' },
        { k: 'twin',   t: '电芯数字孪生', b: '240' },
        { k: 'money',  t: '收益与分成', b: 'ROI' },
        { k: 'order',  t: '工单与订阅', b: 'SLA' },
        { k: 'resell', t: '梯次撮合', b: 'A' }
      ]
    },
    client: {
      label: '企业视角', badge: '客户',
      org: D.CLIENT.company + ' · 用能负责人', ava: '沈', user: D.CLIENT.contact, title: '能源负责人 · 1 座柜',
      home: 'home',
      menu: [
        { k: 'home',    t: '我的储能资产', b: '1' },
        { k: 'twin',    t: '电芯健康', b: '240' },
        { k: 'money',   t: '我的收益', b: 'ROI' },
        { k: 'service', t: '订阅与服务', b: 'SLA' },
        { k: 'resell',  t: '电池护照', b: 'A' }
      ]
    }
  };

  let cur = 'dash';
  let siteCode = 'ESS-ZJ-003';
  let moneyPlan = 'base';   // 收益晴雨表当前订阅方案：base 基础版 / split 分成版
  let twinMetric = 'soh';
  let selectedCellId = 'P03-014';
  const charts = [];

  const svg = (n, c) => `<svg class="${c || ''}" viewBox="0 0 24 24" width="16" height="16" fill="none"
      stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICON[n]}</svg>`;
  const money = D.money;
  const num = D.num;
  const pill = st => `<span class="pill ${D.STATUS_META[st].cls}"><i></i>${D.STATUS_META[st].label}</span>`;

  /* ---------------- 图表工具 ---------------- */
  const AXIS = {
    axisLine: { lineStyle: { color: 'rgba(255,255,255,.14)' } },
    axisLabel: { color: '#727c8a', fontSize: 10 },
    splitLine: { lineStyle: { color: 'rgba(255,255,255,.06)' } }
  };
  const GRID = { left: 46, right: 18, top: 26, bottom: 26 };
  const TIP = {
    backgroundColor: 'rgba(35,40,47,.96)', borderColor: 'rgba(255,255,255,.16)',
    textStyle: { color: '#e9ecf1', fontSize: 12 }
  };
  function chart(dom, opt) {
    if (!dom || typeof echarts === 'undefined') return;
    const c = echarts.init(dom, null, { renderer: 'canvas' });
    c.setOption(opt);
    charts.push(c);
    return c;
  }
  function killCharts() {
    while (charts.length) { try { charts.pop().dispose(); } catch (e) {} }
    mChart = {};
  }

  /* ---------------- 菜单 / 顶栏 ---------------- */
  function renderMenu() {
    const R = ROLES[role];
    $('#pcRole').innerHTML = Object.keys(ROLES).map(k => `
      <button class="rl${k === role ? ' is-on' : ''}" data-act="role-switch" data-r="${k}">${ROLES[k].label}</button>`).join('');
    $('#pcMenu').innerHTML = R.menu.map(m => `
      <button class="mi${m.k === cur ? ' is-on' : ''}" data-act="pc-nav" data-k="${m.k}">
        ${svg(m.k, 'mi-i')}<span class="mi-t">${m.t}</span><span class="mi-b">${m.b}</span>
      </button>`).join('');
    if ($('#pcOrg')) $('#pcOrg').textContent = R.org;
    if ($('#pcUserAva')) $('#pcUserAva').textContent = R.ava;
    if ($('#pcUserName')) $('#pcUserName').textContent = R.user;
    if ($('#pcUserRole')) $('#pcUserRole').textContent = R.title;
    if ($('#pcRoleBadge')) $('#pcRoleBadge').textContent = R.badge;
  }
  const TOPS = {
    dash: ['RESCUE DASHBOARD', '资产救援大盘', '实时呈现集团旗下 10 座工商业储能柜的上云状态、健康度与收益表现，支持一键「重新上云」与工单派发。'],
    twin: ['CELL DIGITAL TWIN', '电芯数字孪生矩阵', '全柜 240 颗单体电芯级的 SOH / 电压 / 温度孪生体，云端提前 15 天预警「正在掉队的那一颗」。'],
    money: ['REVENUE BAROMETER', '经济收益晴雨表', '把「电芯木桶效应」翻译成财务语言：先给结论 —— 单柜年净收益、收益构成与回本点；测算口径与可调参数收进折叠区，按需展开。'],
    order: ['WORK ORDER & SLA', '工单与订阅', 'SLA 分级订阅驱动现场作业：异常自动建单 → 就近派工 → 作业回填 → 收益核账闭环。'],
    resell: ['BATTERY HEALTH CARD', '电池护照与梯次转卖', '把 27 个月云端数据凝成一张可核验的「电池健康卡」：SOH、等级、关键指标一屏可读；再按收益晴雨表口径给出「现在卖 / 再运营」的量化建议。'],
    home: ['MY ASSETS', '我的储能资产', '仅呈现你名下 1 座储能柜的运行、健康与收益；平台侧的救援大盘、工单派发与其他客户数据不在你的可见范围。'],
    service: ['MY SUBSCRIPTION', '订阅与服务', '查看你的订阅合同、账单与服务记录，并自助申请上门或报修。你只看到本账号名下的工单，看不到工程师调度。']
  };
  function renderTop() {
    let t = TOPS[cur];
    const isClient = role === 'client';
    if (cur === 'money' && isClient)
      t = ['MY REVENUE', '我的收益测算', '按你名下储能柜的峰谷价差与衰减参数测算：净收益、收益构成与回本点；切换方案与滑块实时重算。'];
    const act = cur === 'dash' ? `<span class="pill act"><i></i>实时口径 · 30s 刷新</span>
        <button class="btn" data-act="dummy">导出日报 PDF</button>
        <button class="btn btn-p" data-act="recloud-all">批量重新上云（2 座）</button>`
      : cur === 'twin' ? (isClient
        ? `<button class="btn" data-act="dummy">下载 SOH 体检报告</button>`
        : `<span class="pill warn"><i></i>PACK-03 落后簇</span>
        <button class="btn btn-p" data-act="make-order">生成上门活化工单</button>`)
      : cur === 'money' ? (isClient
        ? `<button class="btn" data-act="dummy">导出我的收益测算</button>`
        : `<button class="btn" data-act="dummy">导出测算表</button>
        <button class="btn btn-p" data-act="dummy">推送月度收益报告</button>`)
      : cur === 'order' ? `<button class="btn" data-act="dummy">导出工单台账</button>
        <button class="btn btn-p" data-act="dummy">新增订阅合同</button>`
      : cur === 'service' ? `<button class="btn" data-act="dummy">下载合同 PDF</button>
        <button class="btn btn-p" data-act="make-report">申请上门 / 报修</button>`
      : cur === 'home' ? `<button class="btn" data-act="dummy">导出我的年度收益报告</button>
        <button class="btn btn-p" data-act="make-report">预约上门体检</button>`
      : (isClient
        ? `<button class="btn" data-act="dummy">下载电池护照 PDF</button>
           <button class="btn btn-p" data-act="list-cabinet">确认按报价成交</button>`
        : `<button class="btn" data-act="dummy">下载 SOH 体检报告</button>
           <button class="btn btn-p" data-act="list-cabinet">出具护照并挂牌</button>`);
    $('#pcTop').innerHTML = `
      <div class="pt-l"><div class="crumb">${t[0]}</div><h1>${t[1]}</h1><p>${t[2]}</p></div>
      <div class="pt-r">${act}</div>`;
  }

  /* ---------------- 视图：资产救援大盘 ---------------- */
  function viewDash() {
    const s = D.SITES;
    const offline = s.filter(x => x.status === 'offline');
    const todayArb = 12480;
    return `
      <div class="grid g5">
        <div class="kpi"><div class="k-n">${s.length}<small>座</small></div>
          <div class="k-l">在管工商业储能柜</div><div class="k-d">分布在浙 / 苏 / 粤 6 个园区</div></div>
        <div class="kpi c"><div class="k-n">${D.onlineRate()}<small>%</small></div>
          <div class="k-l">网关在线率</div><div class="k-d up">▲ 较接入前 +60%</div></div>
        <div class="kpi d"><div class="k-n">${offline.length}<small>座</small></div>
          <div class="k-l">孤儿电站（断网盲跑）</div><div class="k-d down">月损失 ${money(offline.reduce((a, b) => a + b.loss, 0))}</div></div>
        <div class="kpi"><div class="k-n">${money(D.recovered())}</div>
          <div class="k-l">本月挽回电价收益</div><div class="k-d up">▲ 主动维护贡献 86%</div></div>
        <div class="kpi b"><div class="k-n">2<small>单</small></div>
          <div class="k-l">待派 / 进行中工单</div><div class="k-d">SLA 最迟今日 18:00</div></div>
      </div>

      <div class="grid g21 mt">
        <div class="card">
          <div class="card-hd">
            <div class="card-tt">储能柜资产台账 <span class="tag">Asset Registry</span></div>
            <div class="card-x">今天 08:00 更新 · CNESA 口径估算法</div>
          </div>
          <table class="tbl">
            <thead><tr><th>柜号 / 站点</th><th>规格</th><th>状态</th><th>整柜 SOH</th>
              <th class="r">ΔV</th><th class="r">月损失</th><th class="r">操作</th></tr></thead>
            <tbody>${s.map(x => `
              <tr>
                <td><div class="strong">${x.name}</div>
                    <div class="sm mono" style="color:var(--text-3)">${x.code} · ${x.city}</div></td>
                <td class="mono">${x.model}</td>
                <td>${pill(x.status)}</td>
                <td style="width:132px">
                  <div class="kv" style="border:none;padding:0">
                    <div class="bar"><div class="bar-f ${x.soh >= 85 ? 'ok' : x.soh >= 78 ? '' : 'bad'}"
                      style="width:${x.soh}%"></div></div>
                  </div>
                  <div class="sm mono" style="margin-top:4px">${x.soh}% ${x.plan === '未订阅' ? '' : '· ' + x.plan}</div>
                </td>
                <td class="r mono">${x.deltaV}mV</td>
                <td class="r mono" style="color:${x.loss > 2500 ? '#ff8b80' : 'var(--text-1)'}">${money(x.loss)}</td>
                <td class="r">
                  ${x.status === 'offline'
                    ? `<button class="btn btn-r btn-sm" data-act="recloud" data-c="${x.code}">重新上云</button>`
                    : `<button class="btn btn-sm" data-act="pc-nav" data-k="twin" data-c="${x.code}">查看孪生</button>`}
                </td></tr>`).join('')}
            </tbody>
          </table>
        </div>

        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="card bad">
            <div class="card-hd"><div class="card-tt">AI 预警塔</div>
              <div class="card-x">提前 15 天</div></div>
            ${D.ALERTS.map(a => `
              <div class="arow">
                <div class="at">${a.t}</div>
                <div class="atx"><span class="pill ${D.ALERT_META[a.lv].cls}"><i></i>${D.ALERT_META[a.lv].label}</span>
                  <em>${a.site}</em><br>${a.txt}</div>
              </div>`).join('')}
          </div>
          <div class="card">
            <div class="card-hd"><div class="card-tt">今日峰谷套利</div>
              <div class="card-x">单位：元</div></div>
            <div class="chart sm" id="cArb"></div>
          </div>
        </div>
      </div>

      <div class="card mt">
        <div class="card-hd"><div class="card-tt">RePower-360 全生命周期闭环 <span class="tag">Loop</span></div>
          <div class="card-x">从「坏了才修」到「资产运营」</div></div>
        <div class="flow">
          <div class="fn"><div class="ft">① 重新上云</div><div class="fd">Re-Bridge 网关破壁私有协议，孤儿电站 30 分钟重回云端</div></div>
          <div class="fn"><div class="ft">② 季度订阅</div><div class="fd">2,499 元/柜/季，或免服务费按增量收益分成</div></div>
          <div class="fn"><div class="ft">③ 主动维护</div><div class="fd">Re-Pulse 现场 5~10A 大电流均衡活化，2 小时拉平落后单体</div></div>
          <div class="fn"><div class="ft">④ 回收转卖</div><div class="fd">电池护照 + Grade A/B/C 分级挂牌，残值溢价 30%~50%</div></div>
        </div>
      </div>`;
  }
  function chartDash() {
    chart($('#cArb'), {
      grid: { ...GRID, left: 40, top: 16 }, tooltip: { ...TIP, trigger: 'axis' },
      xAxis: { type: 'category', data: ['00-04', '04-08', '08-12', '12-16', '16-20', '20-24'], ...AXIS, splitLine: { show: false } },
      yAxis: { type: 'value', ...AXIS },
      series: [{
        type: 'bar', data: [0, 1860, 5120, 2300, 4980, 520], barWidth: '46%',
        itemStyle: { color: p => ['#23282f', '#5aa9ff', '#f2a93b', '#5aa9ff', '#f2a93b', '#23282f'][p.dataIndex], borderRadius: [4, 4, 0, 0] }
      }]
    });
  }

  /* ---------------- 视图：电芯数字孪生 ---------------- */
  function viewTwin() {
    const site = D.getSite(siteCode);
    const isClient = role === 'client';
    const cells = D.buildCells(20261009);
    const st = D.cellStats(cells);
    const selected = cells.find(c => c.id === selectedCellId) || st.laggards[0] || cells[0];
    const selectedRisk = cellRisk(selected);
    const metricLabel = { soh: '健康度', v: '电压', temp: '温度' }[twinMetric];
    const stateTotals = cells.reduce((totals, c) => (totals[cellRisk(c)]++, totals), { normal: 0, warning: 0, critical: 0 });
    return `
      <div class="grid g4">
        <div class="kpi"><div class="k-n">${site.model}</div>
          <div class="k-l">${site.name} · ${site.code}</div><div class="k-d">投运 ${site.run} · ${site.vendor}</div></div>
        <div class="kpi c"><div class="k-n">${st.avg}<small>%</small></div>
          <div class="k-l">240 颗单体平均 SOH</div><div class="k-d">最高 ${st.max}% / 最低 ${st.min}%</div></div>
        <div class="kpi d"><div class="k-n">${st.range}<small>%</small></div>
          <div class="k-l">簇间健康度极差</div><div class="k-d down">木桶效应损失 ${money(site.loss)}/月</div></div>
        <div class="kpi b"><div class="k-n">${st.laggards.length}<small>颗</small></div>
          <div class="k-l">落后单体（需靶向活化）</div><div class="k-d">预计放回 ${num(site.loss * 0.86)} 元/月</div></div>
      </div>

      <div class="twin-wrap mt">
        <section class="twin-console">
          <header class="twin-console-hd">
            <div><span class="eyebrow">CELL ARRAY / 240 CHANNELS</span><div class="card-tt">电芯数字孪生矩阵 <span class="tag">${site.code}</span></div>
            <p>${site.name} · 在线采集 08:12:36 · 240/240 单体已建档</p></div>
            <div class="metric-switch" role="group" aria-label="矩阵强调指标">${[['soh','健康度'],['v','电压'],['temp','温度']].map(([k,l])=>`<button class="metric-btn ${twinMetric===k?'is-on':''}" data-act="twin-metric" data-metric="${k}">${l}</button>`).join('')}</div>
          </header>
          <div class="pack-wall">
            ${[1, 2, 3, 4, 5].map(p => {
              const cs = cells.filter(c => c.pack === p);
              const avg = cs.reduce((a,b)=>a+b.soh,0)/cs.length;
              const alerts = cs.filter(c => cellRisk(c) !== 'normal').length;
              return `<article class="pack-module ${p===3?'is-focus':''}">
                <header class="pack-module-hd"><div><b>PACK-${String(p).padStart(2,'0')}</b><span>1P48S · 43.0 kWh</span></div>
                <div><em class="pack-health">${num(avg,1)}% SOH</em><span class="pack-state ${alerts?'warning':''}">${alerts ? `${alerts} 颗待关注` : '运行稳定'}</span></div></header>
                <div class="packgrid">${cs.map(c => {
                  const tone = cellTone(c);
                  const risk = cellRisk(c);
                  return `<button class="cell-node ${risk} ${c.id===selected.id?'is-selected':''}" data-act="cell" data-id="${c.id}" data-soh="${c.soh}" data-v="${c.v}"
                    data-t="${c.temp}" data-r="${c.r}" style="--cell-tone:${tone}" aria-label="${c.id}，SOH ${c.soh}%，电压 ${c.v} 伏，温度 ${c.temp} 摄氏度">
                    <i class="node-led"></i><b>${c.id.slice(-3)}</b><span>${c.v} V</span><span>${c.temp} °C</span><em>${cellMetric(c, twinMetric)}</em></button>`;
                }).join('')}</div>
              </article>`;
            }).join('')}
          </div>
          <footer class="matrix-legend"><span><i class="led-ok"></i>稳定 ${stateTotals.normal}</span><span><i class="led-warn"></i>关注 ${stateTotals.warning}</span><span><i class="led-crit"></i>告警 ${stateTotals.critical}</span><p>当前强调：${metricLabel} · 每颗单体含电压、温度与健康度读数</p></footer>
        </section>

        <aside class="twin-inspector">
          <div class="inspector-cap"><span>SELECTED CELL</span><i class="${selectedRisk}"></i>${selectedRisk === 'critical' ? '需要活化' : selectedRisk === 'warning' ? '持续关注' : '运行稳定'}</div>
          <div class="inspector-id"><span>PACK-${String(selected.pack).padStart(2,'0')}</span><b>${selected.id}</b><small>第 ${selected.idx} 串 · LFP 280Ah</small></div>
          <div class="health-dial" style="--soh:${selected.soh}"><div><strong>${selected.soh}</strong><span>SOH / %</span></div></div>
          <div class="diagnostic-list">
            <div><span>单体电压</span><b class="${selected.v < 3.30 ? 'bad' : ''}">${selected.v}<small>V</small></b></div>
            <div><span>表面温度</span><b class="${selected.temp >= 38 ? 'warn' : ''}">${selected.temp}<small>°C</small></b></div>
            <div><span>直流内阻</span><b>${selected.r}<small>mΩ</small></b></div>
            <div><span>健康偏差</span><b class="${selected.soh < 75 ? 'bad' : ''}">${num(selected.soh - st.avg,1)}<small>%</small></b></div>
          </div>
          <div class="inspector-trace"><span>DIAGNOSTIC TRACE</span><div><i style="width:${Math.min(100, selected.soh)}%"></i></div><p>${selectedRisk==='critical' ? '低健康度短板已拉低整簇可用容量，建议进入 Re-Pulse 靶向活化队列。' : '采集数据处于阈值范围内，持续保留趋势监测。'}</p></div>
          <button class="btn btn-p btn-block" data-act="${isClient ? 'make-report' : 'make-order'}">${isClient
            ? (selectedRisk === 'normal' ? '申请周期诊断' : '申请上门靶向活化')
            : (selectedRisk === 'normal' ? '加入周期诊断计划' : '下发靶向活化作业')}</button>
        </aside>
      </div>

      <div class="grid g2 mt">
        <div class="card"><div class="card-hd"><div class="card-tt">SOH 分布直方图 <span class="tag">FLEET VIEW</span></div><div class="card-x">所有单体</div></div><div class="chart sm" id="cHist"></div></div>
        <div class="card"><div class="card-hd"><div class="card-tt">簇间压差 ΔV 15 天预测 <span class="tag">PREDICTION</span></div><div class="card-x">当前 ${site.deltaV} mV</div></div><div class="chart sm" id="cTrend"></div></div>
      </div>

      <div class="grid g21 mt">
        <div class="card accent"><div class="card-hd"><div class="card-tt">落后单体清单</div><div class="card-x">Top 8 · 木桶短板</div></div>
          <table class="tbl"><thead><tr><th>单体</th><th class="r">SOH</th><th class="r">电压</th><th class="r">温度</th><th class="r">内阻</th></tr></thead><tbody>${st.laggards.map(c => `<tr><td class="mono">${c.id}</td><td class="r mono" style="color:#ff8b80">${c.soh}%</td><td class="r mono">${c.v}V</td><td class="r mono">${c.temp}℃</td><td class="r mono">${c.r}mΩ</td></tr>`).join('')}</tbody></table>
        </div>
        <div class="card"><div class="card-hd"><div class="card-tt">修复增益测算</div></div>
          <div class="kv"><span class="k">当前可放电量</span><span class="v">${num(site.model.includes('261') ? 261 * st.min / 100 : 215 * st.min / 100, 1)} kWh</span></div>
          <div class="kv"><span class="k">活化后可放电量</span><span class="v" style="color:var(--good)">${num((site.model.includes('261') ? 261 : 215) * (st.min + 11.4) / 100, 1)} kWh</span></div>
          <div class="kv"><span class="k">预计月增收益</span><span class="v" style="color:var(--good)">+${money(site.loss * 0.86)}</span></div>
          ${isClient ? '' : `<select class="btn btn-block mt" id="twinSite" style="text-align:left">${D.SITES.map(s => `<option value="${s.code}"${s.code === siteCode ? ' selected' : ''}>${s.code} · ${s.name}</option>`).join('')}</select>`}
        </div>
      </div>`;
  }
  function cellRisk(c) {
    if (c.soh < 61 || c.temp >= 44 || c.v < 3.255) return 'critical';
    if (c.soh < 78 || c.temp >= 36.5 || c.v < 3.275) return 'warning';
    return 'normal';
  }
  function cellTone(c) {
    return { normal: '#5fc98a', warning: '#f2a93b', critical: '#e8453a' }[cellRisk(c)];
  }
  function cellMetric(c, metric) {
    if (metric === 'v') return `V ${c.v}`;
    if (metric === 'temp') return `T ${c.temp}°`;
    return `H ${c.soh}%`;
  }
  function sohColor(v) {
    const t = Math.max(0, Math.min(1, (v - 62) / (94 - 62)));
    const stops = [[0, [232, 69, 58]], [0.5, [242, 169, 59]], [1, [95, 201, 138]]];
    let a = stops[0], b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) if (t >= stops[i][0] && t <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; }
    const k = (t - a[0]) / (b[0] - a[0] || 1);
    const c = a[1].map((x, i) => Math.round(x + (b[1][i] - x) * k));
    return `rgb(${c.join(',')})`;
  }
  function chartTwin() {
    const cells = D.buildCells(20261009);
    const buckets = new Array(9).fill(0);
    cells.forEach(c => { buckets[Math.min(8, Math.floor((c.soh - 62) / 4))]++; });
    chart($('#cHist'), {
      grid: { ...GRID, left: 34, top: 16 }, tooltip: { ...TIP },
      xAxis: { type: 'category', data: buckets.map((_, i) => `${62 + i * 4}~${66 + i * 4}`), ...AXIS, splitLine: { show: false },
        axisLabel: { color: '#727c8a', fontSize: 9, rotate: 30 } },
      yAxis: { type: 'value', name: '颗', ...AXIS, nameTextStyle: { color: '#727c8a', fontSize: 10 } },
      series: [{
        type: 'bar', data: buckets, barWidth: '62%',
        itemStyle: { color: p => sohColor(64 + p.dataIndex * 4), borderRadius: [3, 3, 0, 0] }
      }]
    });
    const base = D.getSite(siteCode).deltaV;
    const days = ['D+0', 'D+3', 'D+6', 'D+9', 'D+12', 'D+15'];
    chart($('#cTrend'), {
      grid: { ...GRID, left: 34, top: 16 }, tooltip: { ...TIP, trigger: 'axis' },
      xAxis: { type: 'category', data: days, boundaryGap: false, ...AXIS, splitLine: { show: false } },
      yAxis: { type: 'value', name: 'mV', ...AXIS, nameTextStyle: { color: '#727c8a', fontSize: 10 } },
      series: [
        { name: '不干预', type: 'line', smooth: true, data: [base, base + 3, base + 7, base + 11, base + 15, base + 19],
          lineStyle: { color: '#e8453a', width: 2 }, itemStyle: { color: '#e8453a' },
          areaStyle: { color: 'rgba(232,69,58,.10)' } },
        { name: 'BMS 均衡极限', type: 'line', data: [20, 20, 20, 20, 20, 20], symbol: 'none',
          lineStyle: { color: '#727c8a', type: 'dashed', width: 1.2 } },
        { name: '主动活化后', type: 'line', smooth: true, data: [base, base - 6, 14, 12, 11, 10],
          lineStyle: { color: '#5fc98a', width: 2 }, itemStyle: { color: '#5fc98a' },
          areaStyle: { color: 'rgba(95,201,138,.10)' } }
      ],
      legend: { data: ['不干预', '主动活化后'], right: 0, top: 0, textStyle: { color: '#727c8a', fontSize: 10 }, itemWidth: 14, itemHeight: 8 }
    });
  }

  /* ---------------- 视图：经济收益晴雨表 ----------------
   * 全页统一为「单柜 / 年」口径：下方两个滑块是唯一的参数源，
   * 拖动后 KPI、明细、两张图表同步重算（详见 paintMoney）。
   */
  function viewMoney() {
    const V = D.calcRoi(20, 0.8, moneyPlan);
    const Vs = D.calcRoi(20, 0.8, 'split');
    const P = D.SUB_PLANS[moneyPlan];
    return `
      <div class="earn-hero">
        <div class="eh-left">
          <div class="eh-k">${role === 'client' ? '本柜 · 净收益 / 年' : '采用方案后 · 净收益 / 柜 / 年'}</div>
          <div class="eh-n" id="kNet">${money(V.net)}</div>
          <div class="eh-sub" id="kNetNote">挽回 ${money(V.lossYear)} ＋ 残值 ${money(V.residual)} ＋ 延寿 ${money(V.lifeExt)} － ${V.planName} ${money(V.costYear)}</div>
          <div class="eh-chips">
            <span class="chip ok">综合 ROI <b id="kRoi2">${V.roiTotal}</b>%</span>
            <span class="chip" id="kPayback">▲ 客户 ${V.payback} 个月回本</span>
            <span class="chip">直接电费 ROI <b id="kRoi">${V.roiDirect}</b>%</span>
          </div>
        </div>
        <div class="eh-right" id="mixBox">${mixHtml(V)}</div>
      </div>

      <div class="grid mt" style="grid-template-columns:1.62fr 1fr">
        <div class="card">
          <div class="card-hd"><div class="card-tt">累计净收益与回本点 <span class="tag">Payback</span></div>
            <div class="card-x">${role === 'client' ? '我的储能柜 · 单位：元' : '1 座柜 · 单位：元'}</div></div>
          <div class="chart" id="cCash" style="height:300px"></div>
          <p class="note mt">年费按年度预付（M1 / M13 各扣一次），挽回、残值、延寿按年摊平后逐月累加，曲线穿越零轴处即静态回本点。</p>
        </div>
        <div class="card">
          <div class="card-hd"><div class="card-tt">测算口径与参数 <span class="tag">Try It</span></div>
            <div class="card-x">切换方案 / 拖动滑块实时重算</div></div>
          <div class="plan-switch" id="planSwitch">
            ${Object.keys(D.SUB_PLANS).map(k => {
              const p = D.SUB_PLANS[k];
              const label = k === 'base' ? `基础版 · ${p.fixedQuarter}/季（封顶）` : `分成版 · ${p.fixedQuarter}/季 + 分成`;
              return `<button class="btn btn-sm${k === moneyPlan ? ' is-on' : ''}" data-act="money-plan" data-p="${k}">${label}</button>`;
            }).join('')}
          </div>
          <div id="calcBox">
            <div class="kv"><span class="k">每日因衰减少放电量</span><span class="v" id="c1v">20 kWh</span></div>
            <input type="range" id="c1" min="5" max="45" step="1" value="20"
              style="width:100%;accent-color:var(--accent);margin:6px 0 10px">
            <div class="kv"><span class="k">当地峰谷价差</span><span class="v" id="c2v">0.80 元/度</span></div>
            <input type="range" id="c2" min="40" max="130" step="5" value="80"
              style="width:100%;accent-color:var(--accent);margin:6px 0 10px">
            <div class="kv"><span class="k">年运行天数</span><span class="v">330 天</span></div>
            <div class="mt" style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 13px">
              <div class="k-d">单柜年损失电费</div>
              <div class="k-n" style="color:var(--bad);font-size:26px" id="cOut">${money(V.lossYear)}</div>
              <div class="note" id="cNote">按 ${V.planName}（${planCostText(V)}）计，直接 ROI
                <b id="cRoi" style="color:var(--accent)">${V.roiDirect}%</b>；叠加残值与延寿后综合 ROI
                <b id="cRoi2" style="color:var(--good)">${V.roiTotal}%</b>。</div>
            </div>
          </div>
          <div class="note mt">整页口径统一为 <b>单柜 / 年</b>；两档订阅的<b>服务内容完全相同</b>，
            只有价格构成不同：${P.shareText}。</div>
        </div>
      </div>

      <details class="fold">
        <summary>两档方案对比与测算明细　<span style="color:var(--text-3)">分成版为什么净收益更高？两档并排 + 月度明细</span></summary>
        <div class="fold-bd">
          <div class="grid g12" style="margin-top:14px">
            <div>
              <div class="card-hd"><div class="card-tt">两档方案下的客户收益</div>
                <div class="card-x">单柜 · 年化</div></div>
              <div class="kv"><span class="k">基础版 · 2,499 元/季（封顶）</span>
                <span class="v" style="color:var(--good)">${money(D.calcRoi(20, 0.8, 'base').net)}</span></div>
              <div class="bar" style="margin-top:6px"><div class="bar-f" style="width:${Math.round(D.calcRoi(20, 0.8, 'base').net / Math.max(V.net, Vs.net) * 100)}%;background:#7d8794"></div></div>
              <div class="kv" style="margin-top:14px"><span class="k">分成版 · 1,499 元/季 ＋ 分成</span>
                <span class="v" style="color:var(--good)">${money(Vs.net)}</span></div>
              <div class="bar" style="margin-top:6px"><div class="bar-f" style="width:100%;background:var(--good)"></div></div>
              <div class="note mt">两档服务内容完全相同，分成版把一部分固定费用换成「效果分成」：客户前期支出更低、净收益更高；
                服务商收入则与挽回效果绑定。右侧切换方案，上方收益与图表实时重算。</div>
            </div>
            <div>
              <div class="card-hd"><div class="card-tt">月度挽回 vs 服务支出</div>
                <div class="card-x">元 / 月</div></div>
              <div class="chart" id="cMoney" style="height:190px"></div>
              <p class="note mt">挽回电费按年化摊平到月度，与服务支出逐月对比；
                差额即月度净收益，累计后回到上方回本曲线。</p>
            </div>
          </div>
          <p class="note" style="margin-top:12px;color:var(--text-3)">组合口径补充：签约托管 150 柜后，初创团队预计
            <b>第 19~21 个月</b>整体收支平衡（基础版口径 ≈18.9 个月，全分成版 ≈20.3 个月，详见商业页盈亏平衡推演）。</p>
        </div>
      </details>`;
  }

  /* 收益构成：三条来源 + 服务支出，条宽按占毛收益比例 */
  function mixHtml(V) {
    const gross = V.lossYear + V.residual + V.lifeExt;
    const pct = v => Math.round(v / gross * 100);
    const row = (label, val, color, minus) => `
      <div class="mix-row">
        <span class="mix-l">${label}</span>
        <span class="mix-bar"><i style="width:${pct(val)}%;background:${color}"></i></span>
        <span class="mix-v" style="color:${minus ? 'var(--bad)' : 'var(--good)'}">${minus ? '−' : '+'}${money(val)}</span>
        <span class="mix-p">${pct(val)}%</span>
      </div>`;
    return `
      ${row('① 峰谷套利挽回', V.lossYear, 'var(--good)', false)}
      ${row('② 梯次残值溢价', V.residual, '#8fd6a8', false)}
      ${row('③ 延寿 / 免换包', V.lifeExt, '#cfe8d9', false)}
      ${row(`服务支出 · ${V.planName}`, V.costYear, 'var(--bad)', true)}
      <div class="mix-total"><span>净收益 / 柜 / 年</span><b id="bNet">${money(V.net)}</b></div>`;
  }

  /* 价格构成文案：基础版 = 固定年费；分成版 = 固定 + 分成 */
  function planCostText(V) {
    return V.shareRate === 0
      ? `${V.fixedQuarter} 元/季 × 4 = ${money(V.fixedYear)}`
      : `固定 ${V.fixedQuarter} 元/季 × 4 = ${money(V.fixedYear)} + 分成 ${money(V.shareYear)}（挽回 × ${Math.round(V.shareRate * 100)}%）`;
  }
  const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const LEG = { right: 0, top: 0, textStyle: { color: '#727c8a', fontSize: 10 }, itemWidth: 14, itemHeight: 8 };

  /* 单柜月度：挽回 vs 订阅（年化摊平）+ 累计净收益 */
  function optMonthly(V) {
    const rec = MONTHS.map(() => Math.round(V.monthRecover));
    const sub = MONTHS.map(() => Math.round(V.monthSub));
    const cum = MONTHS.map((_, i) => Math.round(V.monthNet * (i + 1)));
    return {
      grid: { ...GRID, left: 54 }, tooltip: { ...TIP, trigger: 'axis' },
      legend: { ...LEG, data: ['挽回电费', '服务支出', '累计净收益'] },
      xAxis: { type: 'category', data: MONTHS, ...AXIS, splitLine: { show: false } },
      yAxis: { type: 'value', ...AXIS },
      series: [
        { name: '挽回电费', type: 'bar', data: rec, barWidth: '34%',
          itemStyle: { color: '#5fc98a', borderRadius: [4, 4, 0, 0] } },
        { name: '服务支出', type: 'bar', data: sub, barWidth: '34%',
          itemStyle: { color: 'rgba(232,69,58,.55)', borderRadius: [4, 4, 0, 0] } },
        { name: '累计净收益', type: 'line', smooth: true, data: cum,
          lineStyle: { color: '#f2a93b', width: 2 }, itemStyle: { color: '#f2a93b' } }
      ]
    };
  }

  /* 单柜累计净收益与回本点（穿越零轴处 = 静态回收期）
   * 口径：年费按年度预付（M1、M13 各扣一次），收益按年摊平逐月累加，
   * 因此曲线从 −年费起步，穿越零轴处即回本点（= 年费 ÷ 年收益 × 12）。 */
  function optPayback(V) {
    const n = 24;
    const labels = Array.from({ length: n }, (_, i) => 'M' + (i + 1));
    const monthlyBenefit = (V.lossYear + V.residual + V.lifeExt) / 12;
    const cum = labels.map((_, i) => {
      const prepaid = i < 12 ? 1 : 2;          // 第 1 年 / 第 2 年年费各预付一次
      return Math.round(monthlyBenefit * (i + 1) - V.costYear * prepaid);
    });
    const mon = months => (months >= 12 ? (months / 12).toFixed(1) + ' 年' : months + ' 个月');
    return {
      grid: { ...GRID, left: 52 }, tooltip: {
        ...TIP, trigger: 'axis',
        valueFormatter: v => money(v)
      },
      legend: { ...LEG, data: ['累计净收益'] },
      xAxis: { type: 'category', data: labels, ...AXIS, splitLine: { show: false } },
      yAxis: { type: 'value', ...AXIS, axisLabel: { color: '#727c8a', fontSize: 10, formatter: v => (v / 1000) + 'k' } },
      series: [{
        name: '累计净收益', type: 'line', smooth: true, data: cum,
        lineStyle: { color: '#5aa9ff', width: 2.4 }, itemStyle: { color: '#5aa9ff' },
        areaStyle: { color: 'rgba(90,169,255,.12)' },
        markLine: {
          silent: true, symbol: 'none',
          data: [
            { yAxis: 0, lineStyle: { color: 'rgba(255,255,255,.25)', width: 1 } },
            { xAxis: V.payback - 1, lineStyle: { color: '#f2a93b', type: 'dashed' },
              label: { formatter: '回本 ≈ ' + mon(V.payback), color: '#f2a93b', fontSize: 10 } }
          ]
        }
      }]
    };
  }

  let mChart = {};   // 收益晴雨表图表实例（供滑块实时重算）

  function chartMoney() {
    const kwh = +$('#c1').value, spread = +$('#c2').value / 100;
    const V = D.calcRoi(kwh, spread, moneyPlan);
    mChart.b = chart($('#cCash'), optPayback(V));
    ensureMonthly(V);
  }

  /* 月度图在折叠区内：容器为 0 宽时先不初始化，等展开后再建，避免空白 */
  function ensureMonthly(V) {
    if (mChart.a) return;
    const el = $('#cMoney');
    if (!el || !el.offsetWidth) return;
    const v = V || D.calcRoi(+$('#c1').value, +$('#c2').value / 100, moneyPlan);
    mChart.a = chart(el, optMonthly(v));
  }

  /* 滑块 / 方案切换 → 整页重算（KPI / 明细 / 两张图） */
  function paintMoney() {
    const kwh = +$('#c1').value, spread = +$('#c2').value / 100;
    const V = D.calcRoi(kwh, spread, moneyPlan);
    const set = (id, html) => { const el = $('#' + id); if (el) el.innerHTML = html; };
    set('c1v', kwh + ' kWh');
    set('c2v', spread.toFixed(2) + ' 元/度');
    set('cOut', money(V.lossYear));
    set('cRoi', V.roiDirect + '%');
    set('cRoi2', V.roiTotal + '%');
    set('cNote', `按 ${V.planName}（${planCostText(V)}）计，直接 ROI
      <b id="cRoi" style="color:var(--accent)">${V.roiDirect}%</b>；叠加残值与延寿后综合 ROI
      <b id="cRoi2" style="color:var(--good)">${V.roiTotal}%</b>。`);
    set('kNet', money(V.net));
    set('kNetNote', `挽回 ${money(V.lossYear)} ＋ 残值 ${money(V.residual)} ＋ 延寿 ${money(V.lifeExt)} － ${V.planName} ${money(V.costYear)}`);
    set('kRoi', V.roiDirect);
    set('kRoi2', V.roiTotal);
    set('kPayback', `▲ 客户 ${V.payback} 个月回本`);
    set('mixBox', mixHtml(V));
    document.querySelectorAll('#planSwitch .btn').forEach(b =>
      b.classList.toggle('is-on', b.dataset.p === moneyPlan));
    if (mChart.a) mChart.a.setOption(optMonthly(V));
    if (mChart.b) mChart.b.setOption(optPayback(V));
  }

  /* ---------------- 视图：工单与订阅 ---------------- */
  function viewOrder() {
    return `
      <div class="grid g21">
        <div class="card">
          <div class="card-hd"><div class="card-tt">作业工单台账 <span class="tag">Work Order</span></div>
            <div class="card-x">今日待处理 2 单</div></div>
          <table class="tbl">
            <thead><tr><th>工单号</th><th>站点</th><th>作业类型</th><th>责任人</th><th>SLA</th><th class="r">操作</th></tr></thead>
            <tbody>${D.ORDERS.map(o => `
              <tr>
                <td class="mono">${o.id}</td>
                <td><div class="strong">${o.site}</div><div class="sm" style="color:var(--text-3)">${(D.getSite(o.site) || {}).name || '—'}</div></td>
                <td>${o.type}</td>
                <td>${o.engineer}</td>
                <td><span class="pill ${o.status === 'todo' ? 'bad' : o.status === 'doing' ? 'act' : o.status === 'review' ? 'warn' : 'ok'}">
                  <i></i>${D.ORDER_META[o.status]}</span>
                  <div class="sm" style="color:var(--text-3);margin-top:3px">${o.sla}</div></td>
                <td class="r">${o.status === 'todo'
                    ? `<button class="btn btn-p btn-sm" data-act="dispatch" data-id="${o.id}">立即派单</button>`
                    : o.status === 'doing'
                    ? `<button class="btn btn-sm" data-act="goto-app">查看实时作业</button>`
                    : `<button class="btn btn-sm" data-act="dummy">查看报告</button>`}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="card accent">
            <div class="card-hd"><div class="card-tt">今日作业负荷</div></div>
            <div class="kv"><span class="k">浙北组 · 李工</span><span class="v">2 单</span></div>
            <div class="kv"><span class="k">浙东组 · 王工</span><span class="v">1 单 <span class="pill act"><i></i>作业中</span></span></div>
            <div class="kv"><span class="k">广深组 · 陈工</span><span class="v">1 单 <span class="pill act"><i></i>作业中</span></span></div>
            <div class="kv"><span class="k">云端 AI 巡检</span><span class="v">10 柜 · 7×24h</span></div>
            <div class="note mt">网格化布局：以苏浙粤园区为核心，单工程师覆盖半径 ≤ 80km，单次上门成本下降 62%。</div>
          </div>
          <div class="card">
            <div class="card-hd"><div class="card-tt">SLA 承诺看板</div></div>
            <div class="kv"><span class="k">云端告警响应</span><span class="v" style="color:var(--good)">≤ 60 秒</span></div>
            <div class="kv"><span class="k">上门响应（两档一致）</span><span class="v">≤ 2 小时</span></div>
            <div class="kv"><span class="k">本季承诺未达标</span><span class="v" style="color:var(--good)">0 单</span></div>
          </div>
        </div>
      </div>

      <div class="card mt">
        <div class="card-hd"><div class="card-tt">订阅方案 · 两档 <span class="tag">Subscription</span></div>
          <div class="card-x">服务内容完全一致，差别只在价格构成</div></div>
        <div class="grid g2">
          ${D.PLANS.map(p => `
            <div class="plan${p.hot ? ' hot' : ''}">
              <div class="pill ${p.hot ? 'warn' : 'dim'}" style="align-self:flex-start"><i></i>${p.tag}</div>
              <div style="font-size:14px;font-weight:600;margin:9px 0 6px">${p.name}</div>
              <div class="pp">${p.price}<span style="font-size:12px;color:var(--text-2)"> ${p.unit}</span></div>
              <div class="pu">${p.sub}</div>
              <ul>${p.items.map(i => `<li>${i}</li>`).join('')}</ul>
              <div class="note mt" style="color:var(--accent)">${p.foot}</div>
              <button class="btn ${p.hot ? 'btn-p' : ''} btn-block mt" data-act="subscribe" data-p="${p.name}">立即开通</button>
            </div>`).join('')}
        </div>
        <div class="note mt">分成版与基础版的<b>服务包完全相同</b>（都含季度上门 5~10A 主动均衡活化、承诺放电可用容量恢复 ≥8%、
          SOH 健康报告与电池护照优先出具），业主只需在「<b>费用封顶</b>」与「<b>低固定 + 增量分成</b>」之间按财务偏好二选一。</div>
      </div>`;
  }

  /* ---------------- 视图：电池护照与梯次转卖 ----------------
   * 结构：① 电池健康卡（把护照做成一张可核验的「卡片」）
   *      ② 转卖建议（由收益晴雨表口径外推：现在卖 vs 再运营 12 个月）
   *      ③ 决策测算表 + 三情景对比图
   *      ④ 全生命周期数据链 / 梯次降级去向
   */
  function viewResell() {
    const P = D.PASSPORT;
    const R = D.calcResell('base');
    const Rs = D.calcResell('split');
    const gain = P.bid - P.scrap;
    const pos = +((P.soh - 60) / 40 * 100).toFixed(1);   // 60~100% 刻度上的位置
    return `
      <div class="grid g21">
        <div class="hp-card">
          <div class="hp-top">
            <div>
              <div class="hp-brand"><i></i>RE-ENERGY · BATTERY HEALTH CARD</div>
              <div class="hp-title">储能电池健康卡</div>
              <div class="hp-sub">${P.site} · ${P.model} · ${P.city}</div>
            </div>
            <div style="display:flex;align-items:center;gap:16px">
              <div class="hp-seal"><div><b>${P.grade}</b><span>GRADE</span></div></div>
              <div style="text-align:right">
                <span class="pill ok"><i></i>已挂牌 · ${P.buyers} 家在询</span>
                <div class="card-x" style="margin-top:6px;font-family:var(--mono)">验签 RP-JS008-76A2</div>
              </div>
            </div>
          </div>

          <div class="hp-grid">
            <div class="hp-left">
              <div class="hp-soh"><b>${P.soh}%</b>
                <span>SOH 健康度 · 剩余可用 ${P.remain} / ${P.nominal} kWh</span></div>
              <div class="hp-scale">
                <span class="seg" style="left:0;width:25%;background:rgba(232,69,58,.62)"></span>
                <span class="seg" style="left:25%;width:12.5%;background:rgba(242,169,59,.62)"></span>
                <span class="seg" style="left:37.5%;width:12.5%;background:rgba(95,201,138,.68)"></span>
                <span class="seg" style="left:50%;width:50%;background:rgba(255,255,255,.07)"></span>
                <i style="left:${pos}%"></i>
              </div>
              <div class="hp-scale-x">
                <span style="flex:25">60</span><span style="flex:12.5">70</span>
                <span style="flex:12.5">75</span><span style="flex:12.5">80</span>
                <span style="flex:37.5;text-align:right">100</span>
              </div>
              <div class="note" style="margin-top:9px">
                距 Grade B 分界（75%）还剩 <b style="color:var(--accent)">1.8 个百分点 ≈ ${R.monthsToFloor} 个月</b>，
                跌破即掉档；掉档后撮合价整体下移一档。
              </div>
            </div>
            <div class="hp-metrics">
              <div class="hp-m"><div class="k">累计循环</div><div class="v">${P.cycleCount.toLocaleString('zh-CN')}<small>次</small></div></div>
              <div class="hp-m"><div class="k">簇间 ΔV</div><div class="v">${P.deltaV}<small>mV</small></div></div>
              <div class="hp-m"><div class="k">数据溯源</div><div class="v">27<small>个月</small></div></div>
              <div class="hp-m"><div class="k">签发 / 有效期</div><div class="v" style="font-size:13px">2026-09-18<small>12 个月</small></div></div>
            </div>
          </div>

          <div class="hp-foot">
            <span>报废回收价 <b>${money(P.scrap)}</b></span>
            <span>梯次撮合价 <b style="color:var(--good)">${money(P.bid)}</b></span>
            <span>多挽回 <b style="color:var(--accent)">+${money(gain)}</b></span>
            <span>平台佣金 8% · <b>${money(P.bid * P.fee)}</b></span>
          </div>
        </div>

        <div class="card good">
          <div class="card-hd"><div class="card-tt">转卖建议 <span class="tag">Advice</span></div>
            <div class="card-x">引用收益晴雨表口径</div></div>
          <div class="verdict">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor"
              stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
              style="color:var(--good);flex:none"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.6 2.6L16 9.5"/></svg>
            <div>
              <div class="vt">建议现在转卖</div>
              <div class="vd">Grade A 窗口期约剩 ${R.monthsToFloor} 个月，越晚越亏</div>
            </div>
          </div>
          <div class="kv"><span class="k">立即转卖净得（扣 8% 佣金）</span>
            <span class="v" style="color:var(--good)">${money(R.netNow)}</span></div>
          <div class="kv"><span class="k">再运营 ${R.months} 个月再卖（等效）</span>
            <span class="v">${money(R.hold12)}</span></div>
          <div class="kv"><span class="k">早卖多拿</span>
            <span class="v" style="color:var(--accent)">+${money(R.gap)}</span></div>
          <div class="kv"><span class="k">转卖临界挂牌价</span>
            <span class="v">${money(R.critGross)}</span></div>
          <div class="note mt">临界价 ＝ ${R.months} 个月后净残值 ${money(R.netThen)}
            ＋ 期间经营净收益 ${money(R.opYear)}（挽回 ${money(R.lossYear)} ＋ 延寿 ${money(R.lifeExt)} － 服务 ${money(R.costYear)}，不含残值摊销）。
            当前报价 ${money(P.bid)} 高于临界价，<b>卖出更优</b>；换成分成版口径临界价升至 ${money(Rs.critGross)}，
            仍低于报价 → <b>结论不变</b>。</div>
          <div style="display:flex;gap:8px;margin-top:12px">
            <button class="btn btn-p" style="flex:1" data-act="list-cabinet">按 ${money(P.bid)} 成交</button>
            <button class="btn" data-act="watch">加入观察</button>
          </div>
        </div>
      </div>

      <div class="grid mt" style="grid-template-columns:1.15fr 1fr">
        <div class="card">
          <div class="card-hd"><div class="card-tt">三个时点卖，哪个最划算 <span class="tag">Sell Timing</span></div>
            <div class="card-x">净残值 ＋ 期间经营净收益 · 单柜</div></div>
          <div class="chart" id="cSell"></div>
          <p class="note mt">跨过 75% 分界，残值净得一次性少
            <b style="color:var(--bad)">${money(R.netNow - R.netThen)}</b>，而经营净收益只有
            <b>${money(R.opYear)}/年</b>，需要 <b>${( (R.netNow - R.netThen) / R.opYear ).toFixed(1)} 年</b>才能补回 ——
            继续运营抵不过掉档损失，这是不建议「再撑一年」的核心原因。</p>
        </div>
        <div class="card">
          <div class="card-hd"><div class="card-tt">决策测算 · 逐条可对账</div>
            <div class="card-x">单位：元 / 柜</div></div>
          <table class="tbl">
            <thead><tr><th>项目</th><th class="r">现在卖</th><th class="r">运营 12 个月</th></tr></thead>
            <tbody>
              <tr><td>残值净得（扣 8% 佣金）</td>
                  <td class="r mono">${money(R.netNow)}</td>
                  <td class="r mono">${money(R.netThen)}</td></tr>
              <tr><td>期间经营净收益</td>
                  <td class="r mono">—</td>
                  <td class="r mono">${money(R.opYear)}</td></tr>
              <tr><td>SOH / 第三方评级</td>
                  <td class="r">${P.soh}% · Grade ${P.grade}</td>
                  <td class="r">${R.sohThen}% · Grade ${R.nextGrade}</td></tr>
              <tr style="background:rgba(242,169,59,.07)">
                  <td class="strong">合计可支配现金</td>
                  <td class="r mono strong" style="color:var(--good)">${money(R.netNow)}</td>
                  <td class="r mono strong">${money(R.hold12)}</td></tr>
            </tbody>
          </table>
          <p class="note mt">口径：撮合价 × 92%；SOH 年衰减 4.0 个百分点（由 82% → 76.8% 反推 ≈4.2，取下限）；
            Grade B 取 26,000~34,000 中值 30,000。经营净收益不含 3,200 元残值摊销，避免与转卖价重复计算。</p>
        </div>
      </div>

      <div class="grid g2 mt">
        <div class="card">
          <div class="card-hd"><div class="card-tt">全生命周期数据链</div>
            <div class="card-x">数据沉淀即资产</div></div>
          <ul class="tl">${P.timeline.map(t => `<li><b>${t.t}</b>${t.e}</li>`).join('')}</ul>
        </div>
        <div class="card">
          <div class="card-hd"><div class="card-tt">梯次降级去向与价差</div>
            <div class="card-x">按 EIS 快速阻抗谱分选</div></div>
          ${D.GRADES.map(g => `
            <div class="grade ${g.cls}">
              <div class="gb">${g.g}</div>
              <div style="flex:1">
                <div style="font-size:13px;font-weight:600">${g.range}</div>
                <div class="m-sub">${g.to}</div>
              </div>
              <div style="text-align:right">
                <div class="mono" style="font-size:13px;color:var(--text-1)">¥${g.price}</div>
                <div class="note">${g.rate}</div>
              </div>
            </div>`).join('')}
          <p class="note mt">退役电芯经快速电化学阻抗谱（EIS）测得真实残值后分选，平台抽取 8% 撮合佣金，
            为业主多挽回 30%~50% 退役残值。</p>
        </div>
      </div>`;
  }

  /* 三时点对比：净残值（堆叠）＋ 期间经营净收益 */
  function chartResell() {
    const R = D.calcResell('base');
    const labels = ['现在转卖', '+6 个月', '+12 个月'];
    const resid = [R.netNow, R.netThen, R.netThen];
    const op = [0, Math.round(R.opYear / 2), R.opYear];
    const totals = resid.map((v, i) => v + op[i]);
    chart($('#cSell'), {
      grid: { ...GRID, left: 62, top: 34, bottom: 26 },
      tooltip: { ...TIP, trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: v => money(v) },
      legend: { ...LEG, data: ['净残值', '期间经营净收益'] },
      xAxis: { type: 'category', data: labels, ...AXIS, splitLine: { show: false },
        axisLabel: { color: '#a9b2be', fontSize: 11 } },
      yAxis: { type: 'value', ...AXIS,
        axisLabel: { color: '#727c8a', fontSize: 10, formatter: v => (v / 1000) + 'k' } },
      series: [
        { name: '净残值', type: 'bar', stack: 'v', barWidth: '42%', data: resid,
          itemStyle: { color: '#5fc98a', borderRadius: [0, 0, 4, 4] } },
        { name: '期间经营净收益', type: 'bar', stack: 'v', barWidth: '42%', data: op,
          itemStyle: { color: '#f2a93b', borderRadius: [4, 4, 0, 0] },
          label: { show: true, position: 'top', color: '#e9ecf1', fontSize: 11,
            fontFamily: 'JetBrains Mono, monospace', fontWeight: 600,
            formatter: p => money(totals[p.dataIndex]) } }
      ]
    });
  }

  /* ---------------- 视图：我的储能资产（客户视角） ---------------- */
  function viewHome() {
    const site = D.getSite(D.CLIENT.code);
    const V = D.calcRoi(20, 0.8, D.CLIENT.planKey);
    return `
      <div class="grid g4">
        <div class="kpi"><div class="k-n">1<small>座</small></div>
          <div class="k-l">我司在管储能柜</div><div class="k-d mono">${site.code}</div></div>
        <div class="kpi c"><div class="k-n">${site.soh}<small>%</small></div>
          <div class="k-l">整柜 SOH</div><div class="k-d">${site.status === 'retire' ? '已出具电池护照' : '运行平稳'}</div></div>
        <div class="kpi"><div class="k-n">${money(V.net)}</div>
          <div class="k-l">本柜年化净收益</div><div class="k-d up">▲ 综合 ROI ${V.roiTotal}%</div></div>
        <div class="kpi b"><div class="k-n">${D.CLIENT.nextVisit.slice(5)}</div>
          <div class="k-l">下次上门日</div><div class="k-d">${D.CLIENT.visitsLeft} 次上门剩余</div></div>
      </div>

      <div class="grid g21 mt">
        <div class="card">
          <div class="card-hd"><div class="card-tt">我的储能柜 <span class="tag">My Asset</span></div>
            <div class="card-x">${site.code} · ${site.city}</div></div>
          <div class="kv"><span class="k">站点 / 型号</span><span class="v">${site.name} · ${site.model}</span></div>
          <div class="kv"><span class="k">投运 / 厂商</span><span class="v">${site.run} · ${site.vendor}</span></div>
          <div class="kv"><span class="k">订阅档位</span><span class="v" style="color:var(--accent)">${site.plan}</span></div>
          <div class="bar mt" style="height:8px"><div class="bar-f ${site.soh >= 85 ? 'ok' : site.soh >= 78 ? '' : 'bad'}" style="width:${site.soh}%"></div></div>
          <div class="note mt">逐颗电芯读数、簇间压差等全量指标请见「电芯健康」。平台侧其他客户的资产与救援大盘不对你开放。</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="card">
            <div class="card-hd"><div class="card-tt">服务进度</div></div>
            <ul class="tl">
              <li><b>2026-05-01</b>「${D.CLIENT.planLabel}」订阅合同生效</li>
              <li><b>2026-09-12</b>季度主动均衡活化（可用容量 +9.6%）</li>
              <li><b>2026-09-18</b>退役电池护照出具 · 已挂牌 Grade A</li>
              <li><b>${D.CLIENT.nextVisit}</b>下次上门（季度诊断 + SOH 报告）</li>
            </ul>
          </div>
          <div class="card accent">
            <div class="card-hd"><div class="card-tt">待办与提醒</div></div>
            <div class="todo"><i></i>SOH 已跌破 80%，建议启动退役评估</div>
            <div class="todo"><i></i>电池护照已挂牌，5 家在询，建议确认成交</div>
            <div class="todo"><i></i>第三季度 SOH 报告待确认下载</div>
          </div>
        </div>
      </div>

      <div class="card mt">
        <div class="card-hd"><div class="card-tt">收益回顾 · 本柜 <span class="tag">My Revenue</span></div>
          <div class="card-x">单柜 / 年 · ${D.CLIENT.planLabel}口径</div></div>
        <div class="grid g2">
          <div class="kv"><span class="k">峰谷套利挽回</span><span class="v" style="color:var(--good)">+${money(V.lossYear)}</span></div>
          <div class="kv"><span class="k">梯次残值溢价</span><span class="v" style="color:var(--good)">+${money(V.residual)}</span></div>
          <div class="kv"><span class="k">延寿 / 免换包</span><span class="v" style="color:var(--good)">+${money(V.lifeExt)}</span></div>
          <div class="kv"><span class="k">订阅支出</span><span class="v" style="color:var(--bad)">−${money(V.costYear)}</span></div>
        </div>
        <div class="note mt">详见「我的收益」页可切换方案、拖动参数实时测算。平台中控视角可查看全部 ${D.SITES.length} 座柜的聚合收益。</div>
      </div>`;
  }

  /* ---------------- 视图：订阅与服务（客户视角） ---------------- */
  function viewService() {
    const myOrders = D.ORDERS.filter(o => o.site === D.CLIENT.code);
    const c = D.CLIENT.contract;
    const V = D.calcRoi(20, 0.8, D.CLIENT.planKey);
    return `
      <div class="grid g21">
        <div class="card">
          <div class="card-hd"><div class="card-tt">我的订阅合同 <span class="tag">Subscription</span></div>
            <div class="card-x">${c.no}</div></div>
          <div class="kv"><span class="k">档位</span><span class="v" style="color:var(--accent)">${D.CLIENT.planLabel}（${D.CLIENT.planKey === 'split' ? '固定 1,499/季 + 分成' : '固定 2,499/季封顶'}）</span></div>
          <div class="kv"><span class="k">计费周期</span><span class="v">${c.cycle}</span></div>
          <div class="kv"><span class="k">合同起止</span><span class="v">${c.start} ~ ${c.end}</span></div>
          <div class="kv"><span class="k">SLA 承诺</span><span class="v" style="color:var(--good)">${c.sla}</span></div>
          <div class="kv"><span class="k">本柜年化净收益</span><span class="v" style="color:var(--good)">${money(V.net)}</span></div>
          <div class="note mt">服务内容：季度上门 5~10A 主动均衡活化、承诺放电可用容量恢复 ≥8%、SOH 健康报告与电池护照优先出具。</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="card">
            <div class="card-hd"><div class="card-tt">本期账单</div></div>
            <div class="kv"><span class="k">订阅费（季）</span><span class="v">${money(1499)}</span></div>
            <div class="kv"><span class="k">分成预缴</span><span class="v">见季度结算单</span></div>
            <div class="kv"><span class="k">下次续费</span><span class="v">2026-08-01</span></div>
            <div class="note mt">分成版按「增量收益 × 20%~30%」季度结算，详见「我的收益」。</div>
          </div>
          <div class="card accent">
            <div class="card-hd"><div class="card-tt">快捷服务</div></div>
            <div style="display:flex;flex-direction:column;gap:9px">
              <button class="btn btn-p btn-block" data-act="make-report">申请上门 / 报修</button>
              <button class="btn btn-block" data-act="dummy">下载合同 PDF</button>
              <button class="btn btn-block" data-act="dummy">查看服务记录</button>
            </div>
          </div>
        </div>
      </div>

      <div class="card mt">
        <div class="card-hd"><div class="card-tt">我的服务记录 <span class="tag">Service Log</span></div>
          <div class="card-x">仅显示本账号名下</div></div>
        <table class="tbl">
          <thead><tr><th>工单号</th><th>作业类型</th><th>责任人</th><th>SLA</th><th>状态</th></tr></thead>
          <tbody>${myOrders.map(o => `
            <tr>
              <td class="mono">${o.id}</td>
              <td>${o.type}</td>
              <td>${o.engineer}</td>
              <td>${o.sla}</td>
              <td><span class="pill ok"><i></i>已完成</span></td>
            </tr>`).join('')}
          </tbody>
        </table>
        <div class="note mt">你只能看到本账号名下的服务记录；平台侧的工单派发、工程师调度与其他客户工单不在你的可见范围。</div>
      </div>`;
  }

  /* ---------------- 渲染调度 ---------------- */
  const VIEWS = {
    dash: { body: viewDash, chart: chartDash },
    twin: { body: viewTwin, chart: chartTwin },
    money: { body: viewMoney, chart: chartMoney },
    order: { body: viewOrder, chart: null },
    resell: { body: viewResell, chart: chartResell },
    home: { body: viewHome, chart: null },
    service: { body: viewService, chart: null }
  };
  function render(k) {
    const keys = ROLES[role].menu.map(m => m.k);
    if (!keys.includes(k)) k = ROLES[role].home;   // 视角不持有该页 → 回退首页
    cur = k;
    if (role === 'client') siteCode = D.CLIENT.code;  // 客户只看自己名下的柜
    killCharts();
    renderMenu(); renderTop();
    $('#pcBody').innerHTML = VIEWS[cur].body();
    $('#pcBody').scrollTop = 0;
    if (VIEWS[cur].chart) VIEWS[cur].chart();
    bindBody();
    window.dispatchEvent(new CustomEvent('rp:resize'));
  }

  /* ---------------- 交互 ---------------- */
  function bindBody() {
    // 用户算一算滑块 → 整页联动重算
    const r1 = $('#c1'), r2 = $('#c2');
    if (r1) { r1.oninput = paintMoney; r2.oninput = paintMoney; }
    const sel = $('#twinSite');
    if (sel) sel.onchange = e => { siteCode = e.target.value; render('twin'); };
    // 折叠区展开后再初始化/重算内部图表（隐藏时容器为 0 宽）
    document.querySelectorAll('details.fold').forEach(d => {
      d.addEventListener('toggle', () => {
        if (!d.open) return;
        setTimeout(() => {
          ensureMonthly();
          d.querySelectorAll('.chart').forEach(el => {
            const inst = window.echarts && window.echarts.getInstanceByDom(el);
            if (inst) inst.resize();
          });
        }, 40);
      });
    });
  }

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-act]');
    if (!t || !t.closest('#pcBody,#pcTop,#pcMenu,#pcRole')) return;
    const a = t.dataset.act;
    if (a === 'twin-metric') {
      twinMetric = t.dataset.metric;
      render('twin');
    } else if (a === 'pc-nav') {
      const c = t.dataset.c;
      if (c) siteCode = c;
      render(t.dataset.k);
    } else if (a === 'cell') {
      selectedCellId = t.dataset.id;
      render('twin');
    } else if (a === 'recloud') {
      const s = D.getSite(t.dataset.c);
      UI.modal('recloud', s);
    } else if (a === 'recloud-all') {
      UI.modal('recloudAll');
    } else if (a === 'dispatch') {
      UI.modal('dispatch', t.dataset.id);
    } else if (a === 'make-order') {
      UI.modal('order');
    } else if (a === 'money-plan') {
      moneyPlan = t.dataset.p || 'base';
      paintMoney();
      UI.toast(`已切换为「${D.SUB_PLANS[moneyPlan].name}」，整页口径同步重算`, 'ok');
    } else if (a === 'subscribe') {
      UI.toast(`已为 10 柜开通「${t.dataset.p}」，合同次日生效`, 'ok');
    } else if (a === 'list-cabinet') {
      UI.modal('list');
    } else if (a === 'watch') {
      UI.toast('已加入观察清单：每 30 天按最新 SOH 与报价重算一次转卖建议', 'ok');
    } else if (a === 'goto-app') {
      document.querySelector('.sb-btn[data-view="app"]').click();
      setTimeout(() => window.RP_APP.go('job'), 60);
    } else if (a === 'role-switch') {
      role = t.dataset.r || 'ops';
      if (role === 'client') { siteCode = D.CLIENT.code; moneyPlan = D.CLIENT.planKey; }
      else { moneyPlan = 'base'; }
      render(ROLES[role].home);
      UI.toast(`已切换为「${ROLES[role].label}」视角`, 'ok');
    } else if (a === 'make-report') {
      UI.toast('已提交上门 / 报修申请，专属工程师将在 2 小时内联系你', 'ok');
    } else if (a === 'dummy') {
      UI.toast('演示环境：该功能仅做界面示意');
    }
  });

  window.RP_PC = {
    render, go: k => { render(k); }, setSite: c => { siteCode = c; },
    setRole: (r, k) => {
      role = ROLES[r] ? r : 'ops';
      if (role === 'client') { siteCode = D.CLIENT.code; moneyPlan = D.CLIENT.planKey; }
      else moneyPlan = 'base';
      render(k || ROLES[role].home);
    }
  };
})();
