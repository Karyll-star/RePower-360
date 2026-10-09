/* ============================================================================
 * RePower-360 · PC 中台（企业能源总监 / 财务看板）
 * 五个模块：资产救援大盘 / 电芯数字孪生 / 经济收益晴雨表 / 工单与订阅 / 梯次转卖
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
    resell: '<path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 12l9 4 9-4M3 17l9 4 9-4"/>'
  };
  const MENU = [
    { k: 'dash',   t: '资产救援大盘', b: 'LIVE' },
    { k: 'twin',   t: '电芯数字孪生', b: '240' },
    { k: 'money',  t: '经济收益晴雨表', b: 'ROI' },
    { k: 'order',  t: '工单与订阅', b: 'SLA' },
    { k: 'resell', b: 'A', t: '电池护照与转卖' }
  ];

  let cur = 'dash';
  let siteCode = 'ESS-ZJ-003';
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
  function killCharts() { while (charts.length) { try { charts.pop().dispose(); } catch (e) {} } }

  /* ---------------- 菜单 / 顶栏 ---------------- */
  function renderMenu() {
    $('#pcMenu').innerHTML = MENU.map(m => `
      <button class="mi${m.k === cur ? ' is-on' : ''}" data-act="pc-nav" data-k="${m.k}">
        ${svg(m.k, 'mi-i')}<span class="mi-t">${m.t}</span><span class="mi-b">${m.b}</span>
      </button>`).join('');
  }
  const TOPS = {
    dash: ['RESCUE DASHBOARD', '资产救援大盘', '实时呈现集团旗下 10 座工商业储能柜的上云状态、健康度与收益表现，支持一键「重新上云」与工单派发。'],
    twin: ['CELL DIGITAL TWIN', '电芯数字孪生矩阵', '全柜 240 颗单体电芯级的 SOH / 电压 / 温度孪生体，云端提前 15 天预警「正在掉队的那一颗」。'],
    money: ['REVENUE BAROMETER', '经济收益晴雨表', '把「电芯木桶效应」翻译成财务语言：损失金额可视、订阅投入产出比可算、挽回曲线可追。'],
    order: ['WORK ORDER & SLA', '工单与订阅', 'SLA 分级订阅驱动现场作业：异常自动建单 → 就近派工 → 作业回填 → 收益核账闭环。'],
    resell: ['BATTERY PASSPORT', '电池护照与梯次转卖', '全生命周期数据沉淀为第三方 SOH 体检报告，退役电芯按健康等级挂牌撮合，榨出最后一程残值。']
  };
  function renderTop() {
    const t = TOPS[cur];
    const act = cur === 'dash' ? `<span class="pill act"><i></i>实时口径 · 30s 刷新</span>
        <button class="btn" data-act="dummy">导出日报 PDF</button>
        <button class="btn btn-p" data-act="recloud-all">批量重新上云（2 座）</button>`
      : cur === 'twin' ? `<span class="pill warn"><i></i>PACK-03 落后簇</span>
        <button class="btn btn-p" data-act="make-order">生成上门活化工单</button>`
      : cur === 'money' ? `<button class="btn" data-act="dummy">导出测算表</button>
        <button class="btn btn-p" data-act="dummy">推送月度收益报告</button>`
      : cur === 'order' ? `<button class="btn" data-act="dummy">导出工单台账</button>
        <button class="btn btn-p" data-act="dummy">新增订阅合同</button>`
      : `<button class="btn" data-act="dummy">下载 SOH 体检报告</button>
        <button class="btn btn-p" data-act="list-cabinet">出具护照并挂牌</button>`;
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
          <button class="btn btn-p btn-block" data-act="make-order">${selectedRisk==='normal' ? '加入周期诊断计划' : '下发靶向活化作业'}</button>
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
          <select class="btn btn-block mt" id="twinSite" style="text-align:left">${D.SITES.map(s => `<option value="${s.code}"${s.code === siteCode ? ' selected' : ''}>${s.code} · ${s.name}</option>`).join('')}</select>
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

  /* ---------------- 视图：经济收益晴雨表 ---------------- */
  function viewMoney() {
    const R = D.ROI;
    const totalSub = D.PORTFOLIO.cabinets * R.subsYear;
    return `
      <div class="grid g4">
        <div class="kpi c"><div class="k-n">${money(D.FINANCE.recover.at(-1))}</div>
          <div class="k-l">9 月单月挽回电费</div><div class="k-d up">▲ 环比 +4.4%</div></div>
        <div class="kpi"><div class="k-n">${money(D.FINANCE.subs.at(-1))}</div>
          <div class="k-l">当月订阅投入（10 柜）</div><div class="k-d">增效版 2,499 元/柜/季</div></div>
        <div class="kpi b"><div class="k-n">${R.roiDirect}<small>%</small></div>
          <div class="k-l">直接电费 ROI</div><div class="k-d">仅计峰谷套利挽回部分</div></div>
        <div class="kpi"><div class="k-n">${R.roiTotal}<small>%</small></div>
          <div class="k-l">综合 ROI（含残值与延寿）</div><div class="k-d up">▲ 客户 ${num(R.payback, 1)} 个月即可回本</div></div>
      </div>

      <div class="grid g12 mt">
        <div class="card">
          <div class="card-hd"><div class="card-tt">客户算一算 <span class="tag">Try It</span></div>
            <div class="card-x">拖动滑块实时测算</div></div>
          <div id="calcBox">
            <div class="kv"><span class="k">每日因衰减少放电量</span><span class="v" id="c1v">20 kWh</span></div>
            <input type="range" id="c1" min="5" max="45" step="1" value="20"
              style="width:100%;accent-color:var(--accent);margin:6px 0 12px">
            <div class="kv"><span class="k">当地峰谷价差</span><span class="v" id="c2v">0.80 元/度</span></div>
            <input type="range" id="c2" min="40" max="130" step="5" value="80"
              style="width:100%;accent-color:var(--accent);margin:6px 0 12px">
            <div class="kv"><span class="k">年运行天数</span><span class="v">330 天</span></div>
            <div class="mt" style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px 14px">
              <div class="k-d">单柜年损失电费</div>
              <div class="k-n" style="color:var(--bad)" id="cOut">${money(R.lossYear)}</div>
              <div class="note mt">订阅增效版 ${money(R.subsYear)}/年，直接 ROI
                <b id="cRoi" style="color:var(--accent)">${R.roiDirect}%</b>；叠加残值与延寿后综合 ROI
                <b id="cRoi2" style="color:var(--good)">${R.roiTotal}%</b>。</div>
            </div>
          </div>
          <div class="mt">
            <div class="kv"><span class="k">① 峰谷套利挽回</span><span class="v" style="color:var(--good)">+${money(R.direct)}</span></div>
            <div class="kv"><span class="k">② 梯次残值溢价</span><span class="v" style="color:var(--good)">+${money(R.residual)}</span></div>
            <div class="kv"><span class="k">③ 延寿 / 免提前换包</span><span class="v" style="color:var(--good)">+${money(R.lifeExt)}</span></div>
            <div class="kv"><span class="k">年度订阅成本</span><span class="v" style="color:var(--bad)">-${money(R.subsYear)}</span></div>
            <div class="kv"><span class="k"><b>净收益 / 柜 / 年</b></span><span class="v" style="color:var(--accent)">${money(R.total - R.subsYear)}</span></div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="card">
            <div class="card-hd"><div class="card-tt">挽回电费 vs 订阅投入 <span class="tag">Portfolio</span></div>
              <div class="card-x">10 座柜 · 单位：元 / 月</div></div>
            <div class="chart" id="cMoney"></div>
          </div>
          <div class="card">
            <div class="card-hd"><div class="card-tt">初创团队累计现金流与盈亏平衡点 <span class="tag">BEP</span></div>
              <div class="card-x">单位：万元</div></div>
            <div class="chart" id="cCash"></div>
            <p class="note mt">前期投入模具研发、首批打样与 SaaS 平台约 80~120 万；以苏浙粤工业园区为核心签
              约托管 150 柜后，预计第 <b style="color:var(--accent)">14~18 个月</b> 实现收支平衡。</p>
          </div>
        </div>
      </div>`;
  }
  function chartMoney() {
    const F = D.FINANCE;
    chart($('#cMoney'), {
      grid: { ...GRID, left: 52 }, tooltip: { ...TIP, trigger: 'axis' },
      legend: { right: 0, top: 0, textStyle: { color: '#727c8a', fontSize: 10 }, itemWidth: 14, itemHeight: 8 },
      xAxis: { type: 'category', data: F.months, ...AXIS, splitLine: { show: false } },
      yAxis: { type: 'value', ...AXIS },
      series: [
        { name: '挽回电费', type: 'bar', data: F.recover, barWidth: '42%',
          itemStyle: { color: '#5fc98a', borderRadius: [4, 4, 0, 0] } },
        { name: '订阅投入', type: 'bar', data: F.subs.map(v => Math.round(v)), barWidth: '42%',
          itemStyle: { color: '#23282f', borderRadius: [4, 4, 0, 0] } },
        { name: '累计净收益', type: 'line', smooth: true,
          data: F.recover.reduce((a, v, i) => (a.push(+((a[i - 1] || 0) + v - F.subs[i]).toFixed(0)), a), []),
          lineStyle: { color: '#f2a93b', width: 2 }, itemStyle: { color: '#f2a93b' } }
      ]
    });
    const C = D.CASHFLOW;
    chart($('#cCash'), {
      grid: { ...GRID, left: 46 }, tooltip: { ...TIP, trigger: 'axis' },
      xAxis: { type: 'category', data: C.labels, ...AXIS, splitLine: { show: false } },
      yAxis: { type: 'value', ...AXIS },
      series: [
        { name: '累计现金流', type: 'line', smooth: true, data: C.cum,
          lineStyle: { color: '#5aa9ff', width: 2.4 }, itemStyle: { color: '#5aa9ff' },
          areaStyle: { color: 'rgba(90,169,255,.12)' },
          markLine: { silent: true, symbol: 'none',
            data: [{ xAxis: 9, lineStyle: { color: '#f2a93b', type: 'dashed' },
              label: { formatter: 'BEP M14~18', color: '#f2a93b', fontSize: 10 } }] } },
        { name: '月度投入', type: 'bar', data: C.cost, barWidth: '30%',
          itemStyle: { color: 'rgba(232,69,58,.45)', borderRadius: [3, 3, 0, 0] } },
        { name: '月度收入', type: 'bar', data: C.rev, barWidth: '30%',
          itemStyle: { color: 'rgba(95,201,138,.55)', borderRadius: [3, 3, 0, 0] } }
      ],
      legend: { right: 0, top: 0, textStyle: { color: '#727c8a', fontSize: 10 }, itemWidth: 14, itemHeight: 8 }
    });
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
            <div class="kv"><span class="k">基础版上门</span><span class="v">≤ 4 小时</span></div>
            <div class="kv"><span class="k">增效版上门</span><span class="v">≤ 2 小时</span></div>
            <div class="kv"><span class="k">本季承诺未达标</span><span class="v" style="color:var(--good)">0 单</span></div>
          </div>
        </div>
      </div>

      <div class="card mt">
        <div class="card-hd"><div class="card-tt">订阅方案 <span class="tag">Subscription</span></div>
          <div class="card-x">重资产买断 → 确定性服务</div></div>
        <div class="grid g3">
          ${D.PLANS.map(p => `
            <div class="plan${p.hot ? ' hot' : ''}">
              <div class="pill ${p.hot ? 'warn' : 'dim'}" style="align-self:flex-start"><i></i>${p.tag}</div>
              <div style="font-size:14px;font-weight:600;margin:8px 0 6px">${p.name}</div>
              <div class="pp">${p.price}<span style="font-size:12px;color:var(--text-2)"> ${p.unit}</span></div>
              <div class="pu">${p.hot ? '折算年费约 1 万元 / 柜' : '现金流友好，业主零门槛'}</div>
              <ul>${p.items.map(i => `<li>${i}</li>`).join('')}</ul>
              <button class="btn ${p.hot ? 'btn-p' : ''} btn-block mt" data-act="subscribe" data-p="${p.name}">立即开通</button>
            </div>`).join('')}
        </div>
      </div>`;
  }

  /* ---------------- 视图：电池护照与梯次转卖 ---------------- */
  function viewResell() {
    const P = D.PASSPORT;
    const gain = P.bid - P.scrap;
    return `
      <div class="grid g21">
        <div class="card">
          <div class="card-hd"><div class="card-tt">储能电池身份证 <span class="tag">Battery Passport</span></div>
            <div class="card-x">签发日期 2026-09-18 · 有效期 12 个月</div></div>
          <div style="display:flex;gap:22px;align-items:center">
            <div style="width:170px;height:170px;flex:none" id="cGauge"></div>
            <div style="flex:1">
              <table class="tbl">
                <tbody>
                  <tr><td style="width:34%">资产编号</td><td class="mono strong">${P.site}</td>
                      <td style="width:24%">机型</td><td class="mono">${P.model}</td></tr>
                  <tr><td>所在园区</td><td>${P.city}</td><td>标定容量</td><td class="mono">${P.nominal} kWh</td></tr>
                  <tr><td>累计循环</td><td class="mono">${P.cycleCount} 次</td><td>剩余可用</td><td class="mono">${P.remain} kWh</td></tr>
                  <tr><td>第三方评级</td><td><span class="pill ok"><i></i>Grade ${P.grade}</span></td>
                      <td>簇间 ΔV</td><td class="mono">${P.deltaV} mV</td></tr>
                  <tr><td>数据溯源</td><td colspan="3">Re-Bridge 自 2024-05 起连续 27 个月云端采集，报告可在线验签</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="card good">
          <div class="card-hd"><div class="card-tt">残值对比</div><div class="card-x">单柜</div></div>
          <div class="kv"><span class="k">黑粉 / 废铁回收价</span><span class="v" style="color:var(--bad)">${money(P.scrap)}</span></div>
          <div class="kv"><span class="k">梯次撮合成交价</span><span class="v" style="color:var(--good)">${money(P.bid)}</span></div>
          <div class="kv"><span class="k">业主多挽回</span><span class="v" style="color:var(--accent)">+${money(gain)}</span></div>
          <div class="kv"><span class="k">平台佣金（8%）</span><span class="v">${money(P.bid * P.fee)}</span></div>
          <div class="mt">
            <div class="bar"><div class="bar-f bad" style="width:${P.scrap / P.bid * 100}%"></div></div>
            <div class="note mt">当前报价区间 ${money(P.quoteLow)} ~ ${money(P.quoteHigh)}，${P.buyers} 家下游厂在询。</div>
          </div>
        </div>
      </div>

      <div class="grid g12 mt">
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
  function chartResell() {
    const P = D.PASSPORT;
    chart($('#cGauge'), {
      series: [
        { type: 'gauge', startAngle: 210, endAngle: -30, min: 40, max: 100, radius: '92%', center: ['50%', '58%'],
          axisLine: { lineStyle: { width: 12, color: [[0.35, '#e8453a'], [0.72, '#f2a93b'], [1, '#5fc98a']] } },
          pointer: { width: 5, length: '58%', itemStyle: { color: '#e9ecf1' } },
          axisTick: { distance: -12, length: 4, lineStyle: { color: 'rgba(255,255,255,.25)' } },
          splitLine: { distance: -14, length: 8, lineStyle: { color: 'rgba(255,255,255,.35)' } },
          axisLabel: { distance: -6, color: '#727c8a', fontSize: 9 },
          anchor: { show: true, size: 8, itemStyle: { color: '#e9ecf1' } },
          detail: { valueAnimation: true, offsetCenter: [0, '2%'], fontSize: 30, fontWeight: 700,
            color: '#e9ecf1', formatter: '{value}%' },
          title: { offsetCenter: [0, '32%'], color: '#727c8a', fontSize: 11 },
          data: [{ value: P.soh, name: 'SOH · Grade ' + P.grade }] }
      ]
    });
  }

  /* ---------------- 渲染调度 ---------------- */
  const VIEWS = {
    dash: { body: viewDash, chart: chartDash },
    twin: { body: viewTwin, chart: chartTwin },
    money: { body: viewMoney, chart: chartMoney },
    order: { body: viewOrder, chart: null },
    resell: { body: viewResell, chart: chartResell }
  };
  function render(k, keepSite) {
    if (keepSite !== true) { /* keep siteCode */ }
    cur = k || cur;
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
    // 用户算一算滑块
    const r1 = $('#c1'), r2 = $('#c2');
    if (r1) {
      const upd = () => {
        const kwh = +r1.value, spread = +r2.value / 100;
        const loss = kwh * 2 * spread * 330;
        $('#c1v').textContent = kwh + ' kWh';
        $('#c2v').textContent = (spread).toFixed(2) + ' 元/度';
        $('#cOut').textContent = money(loss);
        const direct = Math.round(loss / D.ROI.subsYear * 100);
        const total = Math.round((loss + D.ROI.residual + D.ROI.lifeExt) / D.ROI.subsYear * 100);
        $('#cRoi').textContent = direct + '%';
        $('#cRoi2').textContent = total + '%';
      };
      r1.oninput = upd; r2.oninput = upd;
    }
    const sel = $('#twinSite');
    if (sel) sel.onchange = e => { siteCode = e.target.value; render('twin'); };
  }

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-act]');
    if (!t || !t.closest('#pcBody,#pcTop,#pcMenu')) return;
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
    } else if (a === 'subscribe') {
      UI.toast(`已为 10 柜开通「${t.dataset.p}」，合同次日生效`, 'ok');
    } else if (a === 'list-cabinet') {
      UI.modal('list');
    } else if (a === 'goto-app') {
      document.querySelector('.sb-btn[data-view="app"]').click();
      setTimeout(() => window.RP_APP.go('job'), 60);
    } else if (a === 'dummy') {
      UI.toast('演示环境：该功能仅做界面示意');
    }
  });

  window.RP_PC = { render, go: k => { render(k); }, setSite: c => { siteCode = c; } };
})();
