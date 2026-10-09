/* ============================================================================
 * RePower-360 · UI Demo 数据层
 * 全部为演示用 Mock 数据，数值口径与《【设计任务书 2-1】工商业储能柜后市场潜力
 * 调研简报》《"智储重生（RePower-360）"方案全景框架》保持一致：
 *   · 单机柜：100kW/215kWh ~ 125kW/261kWh，全柜 240 颗电芯
 *   · 每日损失 20kWh × 2 充放 × 峰谷价差 0.8 元 × 330 天 ≈ 10,560 元/年
 *   · 订阅：基础版 999 元/柜/季，增效版 2,499 元/柜/季（≈ 1 万元/柜/年）
 *   · 梯次撮合佣金 8%，退役柜残值 3~5 万元
 * 采用固定种子伪随机，保证每次刷新画面一致（便于录屏交付 MP4）
 * ==========================================================================*/
window.RP = (function () {
  'use strict';

  /* ---------- 工具 ---------- */
  function seedRand(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  const money = n => '¥' + Math.round(n).toLocaleString('zh-CN');
  const num = (n, d = 1) => Number(n).toFixed(d);

  /* ---------- 站点 / 储能柜台账 ---------- */
  const SITES = [
    { code: 'ESS-ZJ-003', name: '杭州湾精细化工 B1 柜', city: '浙江 · 宁波', model: '125kW/261kWh',
      vendor: '中科某能（集成商已转产）', status: 'alarm', soh: 82.1, deltaV: 41, loss: 3040, plan: '增效版', link: '在线', run: '2 年 7 个月' },
    { code: 'ESS-ZJ-014', name: '绍兴柯桥印染产业园 A 区', city: '浙江 · 绍兴', model: '100kW/215kWh',
      vendor: '未名集成商（已破产）', status: 'offline', soh: 76.4, deltaV: 52, loss: 3520, plan: '未订阅', link: '4G 卡停机', run: '3 年 4 个月' },
    { code: 'ESS-JS-008', name: '苏州吴江纺织厂 3 号柜', city: '江苏 · 苏州', model: '100kW/215kWh',
      vendor: '苏储集成', status: 'retire', soh: 76.8, deltaV: 36, loss: 0, plan: '增效版', link: '在线', run: '6 年 2 个月' },
    { code: 'ESS-GD-021', name: '东莞长安五金厂北柜', city: '广东 · 东莞', model: '125kW/261kWh',
      vendor: '南方储能', status: 'working', soh: 88.3, deltaV: 24, loss: 1260, plan: '增效版', link: '在线', run: '1 年 11 个月' },
    { code: 'ESS-ZJ-027', name: '台州温岭水泵厂 C 柜', city: '浙江 · 台州', model: '100kW/215kWh',
      vendor: '未名集成商（服务器已关停）', status: 'offline', soh: 74.9, deltaV: 58, loss: 3860, plan: '基础版', link: '云端离线', run: '3 年 9 个月' },
    { code: 'ESS-JS-015', name: '无锡惠山电子厂 1 号柜', city: '江苏 · 无锡', model: '100kW/215kWh',
      vendor: '恒电能源', status: 'online', soh: 91.2, deltaV: 17, loss: 720, plan: '增效版', link: '在线', run: '1 年 3 个月' },
    { code: 'ESS-GD-006', name: '佛山顺德陶瓷厂西区', city: '广东 · 佛山', model: '125kW/261kWh',
      vendor: '粤储科技', status: 'online', soh: 89.6, deltaV: 21, loss: 980, plan: '增效版', link: '在线', run: '2 年 1 个月' },
    { code: 'ESS-ZJ-041', name: '嘉兴平湖新材料园南柜', city: '浙江 · 嘉兴', model: '100kW/215kWh',
      vendor: '禾储集成', status: 'alarm', soh: 80.5, deltaV: 44, loss: 2980, plan: '增效版', link: '在线', run: '3 年 1 个月' },
    { code: 'ESS-JS-023', name: '常州武进机械厂主柜', city: '江苏 · 常州', model: '100kW/215kWh',
      vendor: '天合某系', status: 'online', soh: 92.4, deltaV: 15, loss: 610, plan: '基础版', link: '在线', run: '11 个月' },
    { code: 'ESS-GD-033', name: '中山古镇照明基地 2 柜', city: '广东 · 中山', model: '125kW/261kWh',
      vendor: '珠江储能', status: 'working', soh: 86.7, deltaV: 29, loss: 1640, plan: '增效版', link: '在线', run: '2 年 5 个月' }
  ];

  const STATUS_META = {
    online:  { label: '在线',      cls: 'ok',   dot: '#5fc98a' },
    alarm:   { label: '健康告警',  cls: 'warn', dot: '#f2a93b' },
    offline: { label: '孤儿电站',  cls: 'bad',  dot: '#e8453a' },
    working: { label: '活化作业中', cls: 'act',  dot: '#5aa9ff' },
    retire:  { label: '待退役评估', cls: 'dim',  dot: '#727c8a' }
  };

  /* ---------- 单柜 240 颗电芯数字孪生 ---------- */
  // 结构：5 个 PACK × 48 颗单体；PACK-03 为落后簇（SOH 极差 ≈ 13.8%）
  function buildCells(seed) {
    const rnd = seedRand(seed);
    const cells = [];
    for (let p = 1; p <= 5; p++) {
      const packBase = p === 3 ? 74.5 : 86.5;
      for (let i = 1; i <= 48; i++) {
        const drag = p === 3 ? (i % 7 === 0 ? 8.5 : 1.6) : 1.2;   // 簇内偶发掉队单体
        const soh = Math.max(58, Math.min(96, packBase - Math.abs(rnd()) * 3.2 - (p === 3 ? Math.abs(rnd()) * 4.5 : 0) - (p === 3 && i % 7 === 0 ? drag : 0)));
        cells.push({
          id: `P${String(p).padStart(2, '0')}-${String(i).padStart(3, '0')}`,
          pack: p, idx: i,
          soh: +soh.toFixed(1),
          v: +(3.28 + (soh - 75) / 100 * 0.16 + (rnd() - 0.5) * 0.012).toFixed(3),
          temp: +(27.5 + Math.max(0, 86 - soh) * 0.42 + rnd() * 2.1).toFixed(1),
          r: +(0.42 + Math.max(0, 90 - soh) * 0.016 + rnd() * 0.03).toFixed(3)
        });
      }
    }
    return cells;
  }

  function cellStats(cells) {
    const sohs = cells.map(c => c.soh);
    const sorted = [...sohs].sort((a, b) => a - b);
    return {
      avg: +(sohs.reduce((a, b) => a + b, 0) / sohs.length).toFixed(1),
      max: sorted[sorted.length - 1],
      min: sorted[0],
      range: +(sorted[sorted.length - 1] - sorted[0]).toFixed(1),
      p05: sorted[Math.floor(sorted.length * 0.05)],
      laggards: cells.filter(c => c.soh < sorted[Math.floor(sorted.length * 0.05)] + 1.5).sort((a, b) => a.soh - b.soh).slice(0, 8)
    };
  }

  /* ---------- 工单 ---------- */
  const ORDERS = [
    { id: 'WO-20261009-01', site: 'ESS-ZJ-014', type: '重新上云 + 首次体检', engineer: '李工 / 浙北组', status: 'todo', sla: 'SLA 4h 响应 · 已超时 1.2h', plan: '待续费' },
    { id: 'WO-20261009-02', site: 'ESS-ZJ-003', type: '电芯主动均衡活化', engineer: '王工 / 浙东组', status: 'doing', sla: 'SLA 2h 响应 · 进行中 38min', plan: '增效版' },
    { id: 'WO-20261008-05', site: 'ESS-GD-021', type: '电芯主动均衡活化', engineer: '陈工 / 广深组', status: 'doing', sla: 'SLA 2h 响应 · 进行中 76min', plan: '增效版' },
    { id: 'WO-20261008-03', site: 'ESS-ZJ-027', type: '网关铺设 + 协议破解', engineer: '李工 / 浙北组', status: 'review', sla: '待业主确认方案', plan: '基础版' },
    { id: 'WO-20261007-04', site: 'ESS-ZJ-041', type: '季度 SOH 诊断报告', engineer: '云端 AI', status: 'done', sla: '已完成 · 报告已推送', plan: '增效版' },
    { id: 'WO-20261006-02', site: 'ESS-JS-008', type: '退役电池护照出具', engineer: '周工 / 苏南组', status: 'done', sla: '已完成 · 已挂牌 Grade A', plan: '增效版' }
  ];
  const ORDER_META = { todo: '待派单', doing: '作业中', review: '待确认', done: '已完成' };

  /* ---------- 告警事件流 ---------- */
  const ALERTS = [
    { lv: 'high', t: '09-28 14:20', site: 'ESS-ZJ-014', txt: '连续 72h 无数据回传，判定「孤儿电站」，建议立即铺设 Re-Bridge 网关' },
    { lv: 'high', t: '09-29 03:12', site: 'ESS-ZJ-003', txt: 'PACK-03 单体内阻异常抬升，预测 15 天后触发木桶限流' },
    { lv: 'mid',  t: '09-29 11:05', site: 'ESS-ZJ-027', txt: '簇间 SOH 极差达 13.8%，可用容量低于合同承诺值' },
    { lv: 'mid',  t: '09-30 08:41', site: 'ESS-ZJ-041', txt: '液冷介质电导率上升，建议 30 日内安排更换' },
    { lv: 'low',  t: '10-01 19:33', site: 'ESS-GD-033', txt: '连续 3 日峰谷套利收益低于基线 12%' }
  ];
  const ALERT_META = { high: { label: '紧急', cls: 'bad' }, mid: { label: '预警', cls: 'warn' }, low: { label: '提示', cls: 'act' } };

  /* ---------- 财务模型 ---------- */
  const PORTFOLIO = { cabinets: 10, managed: 10, offline: 2, alarm: 2, workers: 2 };

  const FINANCE = (function () {
    // 月度曲线：第 1 月签约，第 2 月起介入维护，挽回额随阶梯爬坡
    const months = ['3月', '4月', '5月', '6月', '7月', '8月', '9月'];
    const recover = [0, 9400, 18200, 24600, 28300, 30100, 31400];  // 月度挽回电费
    const subs = months.map((_, i) => PORTFOLIO.cabinets * (i >= 4 ? 2499 : 2499) / 3); // 月摊订阅
    return { months, recover, subs };
  })();

  const ROI = (function () {
    // 口径：单机柜年化（100kW/215kWh）
    const lossPower = 20, cycles = 2, spread = 0.8, days = 330;
    const lossYear = lossPower * cycles * spread * days;              // 10,560
    const subsYear = 2499 * 4;                                        // 9,996
    const residual = 3200;                                            // 梯次残值溢价
    const lifeExt = 2400;                                             // 延寿 / 避免整包提前更换摊销
    const direct = lossYear;
    const total = lossYear + residual + lifeExt;
    return {
      lossPower, cycles, spread, days, lossYear, subsYear, residual, lifeExt, direct, total,
      roiDirect: +(direct / subsYear * 100).toFixed(0),
      roiTotal: +(total / subsYear * 100).toFixed(0),
      payback: +(subsYear / (total / 12)).toFixed(1)                  // 静态回收期（月）
    };
  })();

  // 初创团队现金流：第 1~6 月投入 80~120 万，第 7 月起签约爬坡，第 14~18 月现金流转正
  const CASHFLOW = (function () {
    const labels = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M8', 'M10', 'M12', 'M14', 'M16', 'M18'];
    const cost = [-38, -34, -26, -22, -20, -18, -12, -8, -6, -4, -3, -3];
    const rev = [0, 0, 0, 0, 4, 9, 18, 29, 42, 55, 71, 86];
    let acc = 0;
    const cum = cost.map((c, i) => (acc += c + rev[i]));
    return { labels, cost, rev, cum };
  })();

  /* ---------- 订阅方案 ---------- */
  const PLANS = [
    { name: '基础版 · 保安全', price: 999, unit: '元 / 柜 / 季', tag: '低门槛', items: ['断网重连与云端托管', '7×24h 热失控 AI 预警', '季度云端 SOH 健康报告', '工单响应 4 小时内'], hot: false },
    { name: '增效版 · 保收益', price: 2499, unit: '元 / 柜 / 季', tag: '主推 · 可转增量分成', items: ['含基础版全部权益', '季度上门电芯主动均衡活化（5~10A）', '承诺放电可用容量恢复 ≥ 8%', '液冷介质 / 消防耗材检测', '优先出具电池护照与梯次挂牌'], hot: true },
    { name: 'EMC 增量分成', price: '20~30%', unit: '修复后月度增量收益分成', tag: '业主零风险', items: ['免收服务费，先修复后分润', '以云端计量数据结算，透明可审计', '适合衰减严重、现金流紧张的业主'], hot: false }
  ];

  /* ---------- 电池护照 / 梯次转卖 ---------- */
  const PASSPORT = {
    site: 'ESS-JS-008', city: '江苏 · 苏州', model: '100kW/215kWh', cycleCount: 2841,
    soh: 76.8, grade: 'A', remain: 165.2, nominal: 215, deltaV: 36,
    scrap: 9800, bid: 42300, fee: 0.08, listed: true,
    buyers: 5, quoteHigh: 44200, quoteLow: 40100,
    timeline: [
      { t: '2024-05', e: '接入 Re-Bridge 网关，重建历史数据基线' },
      { t: '2024-09', e: '首次主动均衡活化，挽回可用容量 11.4%' },
      { t: '2025-06', e: '季度 SOH 报告连续 4 期 ≥ 82%' },
      { t: '2026-03', e: 'SOH 跌破 80%，触发退役评估流程' },
      { t: '2026-09', e: '出具电池护照 Grade A，挂牌撮合完成' }
    ]
  };
  const GRADES = [
    { g: 'A', range: '容量 75%~80%', to: '厂区电动叉车电池 / 低速观光车电池', price: '38,000 ~ 45,000', rate: '约 18% 退役柜入库', cls: 'ok' },
    { g: 'B', range: '容量 70%~75%', to: '离网光伏微网蓄电 / 农业灌溉储能', price: '26,000 ~ 34,000', rate: '约 44% 退役柜入库', cls: 'warn' },
    { g: 'C', range: '容量 < 70%', to: '拆解回收 / 黑粉再生', price: '8,000 ~ 12,000', rate: '其余进入再生渠道', cls: 'dim' }
  ];

  /* ---------- 移动端：今日作业 ---------- */
  const MOBILE = {
    engineer: '王工 · 浙东组',
    task: { id: 'WO-20261009-02', site: 'ESS-ZJ-003', name: '杭州湾精细化工 B1 柜', addr: '宁波市镇海区化工园区 3 号路', eta: '预计作业 118 min' },
    devices: [
      { name: 'Re-Bridge', sn: 'RB-2311-0876', model: '多协议边缘网关', battery: 92, signal: '4G Cat-1', state: 'connected' },
      { name: 'Re-Pulse', sn: 'RP-2309-0142', model: '移动活化工作站 · V2.4', battery: 78, signal: 'Wi-Fi 直连', state: 'connected' }
    ],
    target: { pack: 3, cells: 7, worst: 'P03-014', soh: 66.2, dv: 41, targetDv: 12 },
    passport: { site: 'ESS-JS-008', soh: 76.8, grade: 'A', bid: 42300 }
  };

  const api = {
    SITES, STATUS_META, ORDERS, ORDER_META, ALERTS, ALERT_META,
    PORTFOLIO, FINANCE, ROI, CASHFLOW, PLANS, PASSPORT, GRADES, MOBILE,
    money, num, buildCells, cellStats,
    getSite: c => SITES.find(s => s.code === c),
    totalLoss: () => SITES.reduce((a, s) => a + s.loss, 0),
    recovered: () => 31420,
    onlineRate: () => Math.round(SITES.filter(s => s.status !== 'offline').length / SITES.length * 100)
  };
  return api;
})();
