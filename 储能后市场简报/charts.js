/* ===========================================================
   ECharts 图表定义
   配色取自 corporate-clean 主题：深蓝 #0a2540 / 蓝 #1d4ed8 / 灰蓝 #94a3b8
   =========================================================== */
(function () {
  'use strict';

  var NAVY = '#0a2540';
  var BLUE = '#1d4ed8';
  var LBLUE = '#8ab4f8';
  var GRAY = '#94a3b8';
  var GREEN = '#0e9f6e';
  var AMBER = '#d97706';
  var RED = '#dc2626';

  var FONT = '-apple-system, "Noto Sans SC", "Microsoft YaHei", sans-serif';
  var LABEL = { color: '#5b6b80', fontSize: 13, fontFamily: FONT };
  var AXIS_LINE = { lineStyle: { color: '#cbd5e1' } };
  var SPLIT = { lineStyle: { color: '#eef2f7' } };
  var NAME_STYLE = { color: '#5b6b80', fontSize: 13, fontFamily: FONT };

  function grid(extra) {
    return Object.assign({ left: 68, right: 32, top: 44, bottom: 52 }, extra || {});
  }
  function valueAxis(name, extra) {
    return Object.assign({
      type: 'value', name: name, nameTextStyle: NAME_STYLE,
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: LABEL, splitLine: SPLIT
    }, extra || {});
  }
  function catAxis(data, extra) {
    return Object.assign({
      type: 'category', data: data,
      axisLine: AXIS_LINE, axisTick: { show: false }, axisLabel: LABEL
    }, extra || {});
  }

  var TOP_LABEL = { show: true, position: 'top', fontSize: 15, fontWeight: 700, color: NAVY, fontFamily: FONT };
  var TOOLTIP = {
    trigger: 'axis',
    backgroundColor: 'rgba(10,37,64,.94)',
    borderWidth: 0,
    textStyle: { color: '#fff', fontSize: 13, fontFamily: FONT },
    axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(29,78,216,.08)' } }
  };

  var CHARTS = {

    /* ---- 图 1 · 累计装机规模 ---- */
    'chart-capacity': {
      grid: grid({ top: 56, bottom: 46 }),
      tooltip: Object.assign({}, TOOLTIP, { valueFormatter: function (v) { return v + ' GW'; } }),
      xAxis: catAxis(['2024 实际', '2030E 保守', '2030E 理想'], { axisLabel: { color: '#5b6b80', fontSize: 15, fontFamily: FONT } }),
      yAxis: valueAxis('累计装机（GW）', { max: 320 }),
      series: [{
        type: 'bar', barWidth: '46%', data: [
          { value: 78.3, itemStyle: { color: NAVY } },
          { value: 200, itemStyle: { color: BLUE } },
          { value: 291.2, itemStyle: { color: LBLUE } }
        ],
        label: Object.assign({}, TOP_LABEL, { formatter: '{c} GW' }),
        markPoint: {
          symbol: 'rect', symbolSize: [0, 0],
          data: [{
            coord: [1, 262],
            value: 'CAGR 24.5%',
            label: { show: true, formatter: 'CAGR 24.5%', color: BLUE, fontSize: 15, fontWeight: 700, fontFamily: FONT, backgroundColor: 'rgba(29,78,216,.08)', padding: [6, 10], borderRadius: 4 }
          }]
        }
      }]
    },

    /* ---- 图 2 · 浴盆曲线 ---- */
    'chart-bathtub': {
      grid: grid({ top: 40, bottom: 56 }),
      tooltip: TOOLTIP,
      xAxis: catAxis(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
        { name: '投运年限（年）', nameLocation: 'middle', nameGap: 32, nameTextStyle: NAME_STYLE }),
      yAxis: valueAxis('相对故障率', { axisLabel: { show: false }, splitLine: SPLIT }),
      series: [{
        type: 'line', smooth: true, symbol: 'none',
        data: [9.5, 6.2, 4.0, 3.4, 4.2, 6.0, 7.6, 9.0, 10.4, 11.6, 12.8],
        lineStyle: { width: 3, color: NAVY },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: 'rgba(10,37,64,.16)' }, { offset: 1, color: 'rgba(10,37,64,.02)' }]
          }
        },
        markArea: {
          silent: true,
          data: [
            [{ xAxis: '0', itemStyle: { color: 'rgba(148,163,184,.14)' },
              label: { show: true, position: 'insideTop', formatter: '初期偶然失效期\n1~2 年', color: '#5b6b80', fontSize: 12, lineHeight: 16, fontFamily: FONT } },
             { xAxis: '2' }],
            [{ xAxis: '2', itemStyle: { color: 'rgba(220,38,38,.10)' },
              label: { show: true, position: 'insideTop', formatter: '损耗故障拐点期\n第 3~5 年', color: RED, fontSize: 13, fontWeight: 700, lineHeight: 17, fontFamily: FONT } },
             { xAxis: '5' }],
            [{ xAxis: '5', itemStyle: { color: 'rgba(217,119,6,.10)' },
              label: { show: true, position: 'insideTop', formatter: '损耗失效期', color: AMBER, fontSize: 12, fontFamily: FONT } },
             { xAxis: '10' }]
          ]
        }
      }]
    },

    /* ---- 图 3 · 系统中标价 ---- */
    'chart-price': {
      grid: grid({ top: 48, bottom: 46 }),
      tooltip: Object.assign({}, TOOLTIP, { valueFormatter: function (v) { return v + ' 元/Wh'; } }),
      xAxis: catAxis(['2022', '2023', '2024']),
      yAxis: valueAxis('系统中标价（元/Wh）', { max: 1.6 }),
      series: [{
        type: 'line', symbol: 'circle', symbolSize: 10, smooth: false,
        data: [1.5, 0.85, 0.4],
        lineStyle: { width: 3, color: RED },
        itemStyle: { color: RED, borderWidth: 2, borderColor: '#fff' },
        label: Object.assign({}, TOP_LABEL, { formatter: '{c} 元/Wh', color: RED }),
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: 'rgba(220,38,38,.14)' }, { offset: 1, color: 'rgba(220,38,38,.01)' }]
          }
        },
        markLine: {
          silent: true, symbol: 'none',
          data: [{ yAxis: 0.4, lineStyle: { color: RED, type: 'dashed' },
            label: { formatter: '0.4 元/Wh 以下', color: RED, fontSize: 12, fontFamily: FONT, position: 'insideEndTop' } }]
        }
      }]
    },

    /* ---- 图 4 · 产值结构倒挂 ---- */
    'chart-value': {
      grid: grid({ top: 48, bottom: 46, left: 62 }),
      tooltip: Object.assign({}, TOOLTIP, { valueFormatter: function (v) { return v + '%'; } }),
      legend: {
        data: ['前端硬件制造产值', '后市场服务产值'], top: 4, right: 0,
        itemWidth: 14, itemHeight: 10, textStyle: { color: '#5b6b80', fontSize: 13, fontFamily: FONT }
      },
      xAxis: catAxis(['交付期 1~2 年', '稳定运行 3~5 年', '衰减期 6~10 年', '退役期 11~15 年']),
      yAxis: valueAxis('生命周期产值占比（%）', { max: 100 }),
      series: [
        {
          name: '前端硬件制造产值', type: 'line', stack: 'total', smooth: true, symbol: 'none',
          data: [92, 85, 65, 52],
          lineStyle: { width: 0 },
          areaStyle: { color: 'rgba(148,163,184,.35)' },
          label: { show: true, position: 'inside', formatter: '{c}%', color: NAVY, fontSize: 13, fontWeight: 700, fontFamily: FONT }
        },
        {
          name: '后市场服务产值', type: 'line', stack: 'total', smooth: true, symbol: 'none',
          data: [8, 15, 35, 48],
          lineStyle: { width: 2, color: BLUE },
          itemStyle: { color: BLUE },
          areaStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [{ offset: 0, color: 'rgba(29,78,216,.42)' }, { offset: 1, color: 'rgba(29,78,216,.22)' }]
            }
          },
          label: { show: true, position: 'inside', formatter: '{c}%', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: FONT }
        }
      ]
    },

    /* ---- 图 5 · 退役容量指数 ---- */
    'chart-retire': {
      grid: grid({ top: 56, bottom: 46 }),
      tooltip: Object.assign({}, TOOLTIP, { valueFormatter: function (v) { return '指数 ' + v + '（2026 = 100）'; } }),
      xAxis: catAxis(['2025', '2026E', '2027E', '2028E', '2029E', '2030E']),
      yAxis: valueAxis('退役容量指数\n（2026E = 100）', { max: 900 }),
      series: [{
        type: 'bar', barWidth: '52%',
        data: [
          { value: 35, itemStyle: { color: 'rgba(148,163,184,.55)' } },
          { value: 100, itemStyle: { color: NAVY },
            label: Object.assign({}, TOP_LABEL, { formatter: '100\n（基准）', lineHeight: 17 }) },
          { value: 190, itemStyle: { color: 'rgba(217,119,6,.55)' } },
          { value: 340, itemStyle: { color: 'rgba(217,119,6,.7)' } },
          { value: 560, itemStyle: { color: 'rgba(217,119,6,.85)' } },
          { value: 880, itemStyle: {
              color: {
                type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [{ offset: 0, color: RED }, { offset: 1, color: 'rgba(217,119,6,.6)' }]
              }
            },
            label: Object.assign({}, TOP_LABEL, { formatter: '880', color: RED }) }
        ],
        label: Object.assign({}, TOP_LABEL, { formatter: '{c}' }),
        markLine: {
          silent: true, symbol: ['none', 'arrow'], symbolSize: 8,
          data: [[
            { coord: [1, 100], symbol: 'none' },
            { coord: [5, 860] }
          ]],
          lineStyle: { color: BLUE, type: 'dashed', width: 2 },
          label: {
            show: true, position: 'middle', distance: 12,
            formatter: '4 年 ≈ 8.8 倍', color: BLUE, fontSize: 14, fontWeight: 700, fontFamily: FONT,
            backgroundColor: 'rgba(29,78,216,.08)', padding: [5, 10], borderRadius: 4
          }
        }
      }]
    },

    /* ---- 图 6 · SOH 离散度 ---- */
    'chart-soh': {
      grid: grid({ top: 44, bottom: 46, left: 56 }),
      tooltip: Object.assign({}, TOOLTIP, { valueFormatter: function (v) { return 'SOH ' + v + '%'; } }),
      xAxis: catAxis(['簇 1', '簇 2', '簇 3', '簇 4', '簇 5', '簇 6', '簇 7', '簇 8', '簇 9', '簇 10']),
      yAxis: valueAxis('单体 SOH（%）', { min: 78, max: 100 }),
      series: [{
        type: 'bar', barWidth: '58%',
        data: [
          { value: 96.2, itemStyle: { color: NAVY } },
          { value: 94.8, itemStyle: { color: NAVY } },
          { value: 93.1, itemStyle: { color: BLUE } },
          { value: 91.5, itemStyle: { color: BLUE } },
          { value: 90.2, itemStyle: { color: BLUE } },
          { value: 89.7, itemStyle: { color: LBLUE } },
          { value: 88.4, itemStyle: { color: LBLUE } },
          { value: 86.3, itemStyle: { color: AMBER } },
          { value: 85.1, itemStyle: { color: AMBER } },
          { value: 82.4, itemStyle: { color: RED } }
        ],
        label: { show: true, position: 'top', fontSize: 12, color: '#5b6b80', fontFamily: FONT },
        markLine: {
          symbol: 'none', silent: true, label: { show: false },
          data: [
            { yAxis: 96.2, lineStyle: { color: NAVY, type: 'dashed' } },
            { yAxis: 82.4, lineStyle: { color: RED, type: 'dashed' } }
          ]
        }
      }]
    },

    /* ---- 图 7 · 容量挽回瀑布 ---- */
    'chart-recover': {
      grid: grid({ top: 44, bottom: 46, left: 56 }),
      tooltip: {
        trigger: 'axis', backgroundColor: 'rgba(10,37,64,.94)', borderWidth: 0,
        textStyle: { color: '#fff', fontSize: 13, fontFamily: FONT }
      },
      xAxis: catAxis(['额定容量', '木桶效应损失', '主动活化挽回', '活化后可用']),
      yAxis: valueAxis('可用容量（%）', { max: 100 }),
      series: [
        {
          name: 'placeholder', type: 'bar', stack: 'w', silent: true,
          itemStyle: { color: 'transparent' },
          data: [0, 85, 85, 0]
        },
        {
          name: 'value', type: 'bar', stack: 'w', barWidth: '50%',
          data: [
            { value: 100, itemStyle: { color: NAVY } },
            { value: 15, itemStyle: { color: RED } },
            { value: 11, itemStyle: { color: GREEN } },
            { value: 96, itemStyle: { color: BLUE } }
          ],
          label: {
            show: true, position: 'top', fontSize: 15, fontWeight: 700, fontFamily: FONT,
            color: NAVY,
            formatter: function (p) {
              var t = ['100%', '-15%', '+11%', '96%'];
              return t[p.dataIndex];
            }
          }
        }
      ]
    },

    /* ---- 图 8 · 现金流形态 ---- */
    'chart-cash': {
      grid: grid({ top: 48, bottom: 46, left: 62 }),
      tooltip: TOOLTIP,
      legend: {
        data: ['单次上门抢修', 'BaaS 健康订阅', 'EMC 增量分成', '梯次残值撮合'],
        top: 2, right: 0, itemWidth: 16, itemHeight: 10,
        textStyle: { color: '#5b6b80', fontSize: 13, fontFamily: FONT }
      },
      xAxis: catAxis(['Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6', 'Y7', 'Y8', 'Y9', 'Y10', 'Y11', 'Y12'],
        { name: '服务年限', nameLocation: 'middle', nameGap: 30, nameTextStyle: NAME_STYLE }),
      yAxis: valueAxis('相对累计现金流'),
      series: [
        { name: '单次上门抢修', type: 'line', smooth: true, symbol: 'none',
          data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
          lineStyle: { width: 2, color: GRAY, type: 'dashed' }, itemStyle: { color: GRAY } },
        { name: 'BaaS 健康订阅', type: 'line', smooth: true, symbol: 'none',
          data: [2.4, 4.8, 7.2, 9.6, 12, 14.4, 16.8, 19.2, 21.6, 24, 26.4, 28.8],
          lineStyle: { width: 3, color: NAVY }, itemStyle: { color: NAVY } },
        { name: 'EMC 增量分成', type: 'line', smooth: true, symbol: 'none',
          data: [4, 8.8, 14.6, 21.5, 29.8, 39.8, 51.8, 66.1, 83.4, 104, 129, 159],
          lineStyle: { width: 3, color: BLUE }, itemStyle: { color: BLUE },
          areaStyle: { color: 'rgba(29,78,216,.10)' } },
        { name: '梯次残值撮合', type: 'line', step: 'end', symbol: 'none',
          data: [0, 0, 0, 0, 0, 20, 26, 33, 41, 50, 60, 72],
          lineStyle: { width: 3, color: GREEN }, itemStyle: { color: GREEN } }
      ]
    }
  };

  var instances = [];

  function renderAll() {
    Object.keys(CHARTS).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || el.getAttribute('data-done')) return;
      var chart = echarts.init(el, null, { renderer: 'canvas' });
      chart.setOption(CHARTS[id]);
      el.setAttribute('data-done', '1');
      instances.push(chart);
    });
  }

  function boot() {
    if (typeof echarts === 'undefined') {
      console.warn('[ PulseSaver deck ] ECharts 未加载，图表将留空');
      return;
    }
    renderAll();
    /* 主题切换 / 缩放时重绘即可，画布尺寸由 deck 的固定画布保证 */
    window.addEventListener('resize', function () {
      instances.forEach(function (c) { c.resize(); });
    });
  }

  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
