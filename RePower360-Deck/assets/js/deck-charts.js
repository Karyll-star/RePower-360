/* RePower-360 deck :: 商业模式与盈利周期图表（ECharts）
 * 数据全部取自《方案全景框架》与《调研简报》，不新增未经来源支持的假设。
 * 图表按 1920×1080 设计分辨率绘制；deck 由 CSS transform 等比缩放，
 * 因此屏幕上与导出的 PDF 中缩放后依然清晰。
 */
(function () {
  'use strict';

  var C = {
    accent: '#f2a93b',   /* 琥珀 · 主状态色 */
    accent2: '#5aa9ff',  /* 联网蓝 */
    good: '#5fc98a',
    bad: '#e8453a',      /* 急停红 */
    text1: '#e9ecf1',
    text2: '#a9b2be',
    text3: '#727c8a',
    surface: '#1c2026',
    grid: 'rgba(255,255,255,.07)',
    axis: 'rgba(255,255,255,.20)'
  };
  var FONT = '"Inter","Noto Sans SC",sans-serif';
  var MONO = '"JetBrains Mono","IBM Plex Mono",monospace';

  var AX = {
    axisLine: { lineStyle: { color: C.axis } },
    axisTick: { show: false },
    axisLabel: { color: C.text2, fontSize: 13, fontFamily: FONT },
    splitLine: { lineStyle: { color: C.grid } },
    nameTextStyle: { color: C.text3, fontSize: 12, fontFamily: FONT }
  };

  var OPTS = {

    /* ================= 13 · 商业模式适配度雷达 ================= */
    'model-radar': function () {
      return {
        color: [C.bad, C.accent],
        legend: {
          bottom: 0, itemWidth: 14, itemHeight: 8, itemGap: 22,
          textStyle: { color: C.text2, fontSize: 13, fontFamily: FONT }
        },
        tooltip: { trigger: 'item' },
        radar: {
          center: ['50%', '47%'], radius: '63%',
          indicator: [
            { name: '客户付费门槛低', max: 10 },
            { name: '现金流可预测', max: 10 },
            { name: '双方利益一致', max: 10 },
            { name: '退役残值变现', max: 10 },
            { name: '规模可复制', max: 10 }
          ],
          axisName: { color: C.text1, fontSize: 14, fontFamily: FONT },
          splitLine: { lineStyle: { color: C.grid } },
          splitArea: { areaStyle: { color: ['rgba(255,255,255,.02)', 'rgba(255,255,255,.05)'] } },
          axisLine: { lineStyle: { color: C.grid } }
        },
        series: [{
          type: 'radar', symbolSize: 5,
          lineStyle: { width: 2 },
          areaStyle: { opacity: .16 },
          data: [
            { name: '行业传统模式', value: [2, 2, 2, 1, 4] },
            { name: 'RePower-360 模式', value: [9, 9, 9, 9, 8] }
          ]
        }]
      };
    },

    /* ================= 14 · 三层现金流（单柜年化） ================= */
    'cashflow': function () {
      return {
        grid: { left: 8, right: 92, top: 10, bottom: 8, containLabel: true },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        xAxis: {
          type: 'value', name: '元 / 柜 / 年',
          nameTextStyle: { color: C.text3, fontSize: 12, fontFamily: FONT },
          axisLine: { show: false }, axisTick: { show: false },
          axisLabel: { color: C.text3, fontSize: 12, fontFamily: MONO },
          splitLine: { lineStyle: { color: C.grid } }
        },
        yAxis: {
          type: 'category',
          data: ['长尾 · 梯次转卖佣金', '持续 · 季度订阅服务费', '一次性 · 网关硬件'],
          axisLine: { lineStyle: { color: C.axis } },
          axisTick: { show: false },
          axisLabel: { color: C.text1, fontSize: 15, fontFamily: FONT }
        },
        series: [{
          type: 'bar', barWidth: '46%',
          data: [
            { value: 3200, itemStyle: { color: C.accent2 } },
            { value: 9996, itemStyle: { color: C.accent } },
            { value: 1500, itemStyle: { color: C.good } }
          ],
          label: {
            show: true, position: 'right', formatter: '¥{c}',
            color: C.text1, fontSize: 16, fontFamily: MONO, fontWeight: 700
          }
        }]
      };
    },

    /* ================= 25 · 收入结构（环形图） ================= */
    'revenue': function () {
      return {
        tooltip: { trigger: 'item', formatter: '{b}<br/>¥{c} · 占比 {d}%' },
        legend: {
          orient: 'vertical', right: 4, top: 'center',
          itemWidth: 12, itemHeight: 12, itemGap: 14,
          textStyle: { color: C.text2, fontSize: 13, fontFamily: FONT }
        },
        title: {
          text: '≈ 14,700', left: '36%', top: '40%', textAlign: 'center',
          textStyle: { color: C.text1, fontSize: 28, fontWeight: 700, fontFamily: MONO },
          subtext: '元 / 柜 / 年',
          subtextStyle: { color: C.text3, fontSize: 13, fontFamily: FONT }
        },
        series: [{
          type: 'pie', center: ['36%', '52%'], radius: ['48%', '72%'],
          label: { show: false }, labelLine: { show: false },
          itemStyle: { borderColor: C.surface, borderWidth: 3 },
          data: [
            { name: '订阅服务费（基础版）', value: 9996, itemStyle: { color: C.accent } },
            { name: '梯次转卖佣金', value: 3200, itemStyle: { color: C.accent2 } },
            { name: '网关硬件销售', value: 1500, itemStyle: { color: C.good } }
          ]
        }]
      };
    },

    /* ================= 25 · 客户投资回报（对比柱状图） ================= */
    'roi': function () {
      return {
        grid: { left: 8, right: 20, top: 28, bottom: 8, containLabel: true },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        xAxis: {
          type: 'category',
          data: ['客户年损失电费', '基础版年支出', '分成版年支出', '基础版净收益', '分成版净收益'],
          axisLine: { lineStyle: { color: C.axis } },
          axisTick: { show: false },
          axisLabel: { color: C.text1, fontSize: 13, fontFamily: FONT }
        },
        yAxis: {
          type: 'value', name: '元 / 年',
          nameTextStyle: { color: C.text3, fontSize: 12, fontFamily: FONT },
          axisLine: { show: false }, axisTick: { show: false },
          axisLabel: { color: C.text3, fontSize: 12, fontFamily: MONO },
          splitLine: { lineStyle: { color: C.grid } }
        },
        series: [{
          type: 'bar', barWidth: '46%',
          /* 与 P26 收益晴雨表、P27–28 测算明细同一口径（珠三角情景，价差 0.80 元/kWh、两充两放）：
             综合收益 = 10,560 + 梯次残值 3,200 + 延寿 2,400 = 16,160
             基础版年支出 9,996 → 净收益 6,164（ROI 162%）
             分成版年支出 = 1,499×4 + 10,560×25% = 8,636 → 净收益 7,524（ROI 187%） */
          data: [
            { value: 10560, itemStyle: { color: C.bad } },
            { value: 9996, itemStyle: { color: C.accent2 } },
            { value: 8636, itemStyle: { color: C.accent } },
            { value: 6164, itemStyle: { color: C.good } },
            { value: 7524, itemStyle: { color: C.good } }
          ],
          label: {
            show: true, position: 'top', formatter: '¥{c}',
            color: C.text1, fontSize: 15, fontFamily: MONO, fontWeight: 700
          }
        }]
      };
    },

    /* ================= 26 · 盈亏平衡曲线（累计净现金流） =================
     * 假设（均取自方案文档）：
     *   ① 第 1~6 月投入 100 万元（文档区间 80~120 万的中值），按月均摊；
     *   ② 第 7~15 月爬坡签约，每月新增约 16.7 台，第 15 月达 150 台；
     *   ③ 订阅年费 1 万元/柜 → 稳态 12.5 万元/月；
     *   ④ 网关硬件 1,500 元/台、毛利 50% → 每台毛利 750 元，随签约一次性计入。
     * 推演结果：累计净现金流于第 17 个月前后归零，落在文档的 14~18 月区间内。
     */
    'bep': function () {
      var months = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12',
                    '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24'];
      /* 累计净现金流（万元），负值=尚未回本 */
      var cum = [-16.7, -33.3, -50.0, -66.7, -83.3, -100.0, -97.3, -93.3, -87.8,
                 -81.0, -72.8, -63.2, -52.2, -39.8, -26.0, -13.5, -1.0, 11.5,
                 24.0, 36.5, 49.0, 61.5, 74.0, 86.5];

      return {
        grid: { left: 8, right: 24, top: 26, bottom: 8, containLabel: true },
        tooltip: {
          trigger: 'axis',
          formatter: function (p) {
            var i = p[0].dataIndex;
            var v = p[0].data;
            return '第 ' + months[i] + ' 月<br/>累计净现金流 ' +
                   (v < 0 ? '' : '+') + v.toFixed(1) + ' 万元' +
                   (v < 0 ? '（未回本）' : '（已回本）');
          }
        },
        xAxis: {
          type: 'category', data: months, name: '月份',
          nameTextStyle: { color: C.text3, fontSize: 12, fontFamily: FONT },
          axisLine: { lineStyle: { color: C.axis } },
          axisTick: { show: false },
          axisLabel: { color: C.text2, fontSize: 12, fontFamily: MONO, interval: 1 }
        },
        yAxis: {
          type: 'value', name: '累计净现金流（万元）',
          nameTextStyle: { color: C.text3, fontSize: 12, fontFamily: FONT },
          axisLine: { show: false }, axisTick: { show: false },
          axisLabel: { color: C.text3, fontSize: 12, fontFamily: MONO },
          splitLine: { lineStyle: { color: C.grid } }
        },
        series: [{
          type: 'line', data: cum, smooth: true, symbol: 'none',
          lineStyle: { width: 3, color: C.accent },
          areaStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(242,169,59,.28)' },
                { offset: 1, color: 'rgba(242,169,59,0)' }
              ]
            }
          },
          markArea: {
            silent: true,
            itemStyle: { color: 'rgba(95,201,138,.10)' },
            label: {
              show: true, position: 'insideTop', color: C.good,
              fontSize: 12, fontFamily: FONT, formatter: 'BEP 区间 第 14~18 月'
            },
            data: [[{ xAxis: '14' }, { xAxis: '18' }]]
          },
          markLine: {
            silent: true, symbol: 'none',
            data: [{
              yAxis: 0,
              lineStyle: { color: C.text3, type: 'dashed', width: 1 },
              label: {
                show: true, position: 'insideEndTop', color: C.text3,
                fontSize: 12, fontFamily: FONT, formatter: '盈亏平衡线'
              }
            }]
          },
          markPoint: {
            symbol: 'circle', symbolSize: 11,
            itemStyle: { color: C.good, borderColor: C.surface, borderWidth: 2 },
            label: {
              show: true, position: 'top', distance: 12,
              color: C.good, fontSize: 14, fontWeight: 600, fontFamily: FONT,
              formatter: 'BEP ≈ 第 17 个月'
            },
            data: [{ coord: ['17', -1.0] }]
          }
        }]
      };
    },

    /* ================= 07 · 设备健康趋势（原浴盆曲线） ================= */
    'health': function () {
      var years = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
      /* 设备健康度 SOH(%)：前两年平稳，第 3~5 年进入损耗期后加速下滑（趋势示意） */
      var soh = [100, 99, 97, 93, 87, 80, 70, 60, 50, 40, 30];
      /* 月度维护/失效告警强度（相对值）：浴盆曲线“损耗臂”——第 3~5 年起陡升 */
      var demand = [3, 2, 1.4, 3, 6, 11, 20, 32, 48, 68, 90];

      return {
        grid: { left: 8, right: 8, top: 48, bottom: 8, containLabel: true },
        tooltip: { trigger: 'axis' },
        legend: {
          top: 0, itemWidth: 14, itemHeight: 8, itemGap: 18,
          textStyle: { color: C.text2, fontSize: 13, fontFamily: FONT },
          data: ['设备健康度 SOH', '维护 / 失效告警强度']
        },
        xAxis: {
          type: 'category', data: years, name: '投运年数',
          nameTextStyle: { color: C.text3, fontSize: 12, fontFamily: FONT },
          axisLine: { lineStyle: { color: C.axis } },
          axisTick: { show: false },
          axisLabel: { color: C.text2, fontSize: 12, fontFamily: MONO }
        },
        yAxis: [
          {
            type: 'value', name: 'SOH (%)', min: 0, max: 100,
            nameTextStyle: { color: C.text3, fontSize: 12, fontFamily: FONT },
            axisLine: { show: false }, axisTick: { show: false },
            axisLabel: { color: C.text3, fontSize: 12, fontFamily: MONO },
            splitLine: { lineStyle: { color: C.grid } }
          },
          {
            type: 'value', name: '告警强度', min: 0, max: 100,
            nameTextStyle: { color: C.text3, fontSize: 12, fontFamily: FONT },
            axisLine: { show: false }, axisTick: { show: false },
            axisLabel: { color: C.text3, fontSize: 12, fontFamily: MONO },
            splitLine: { show: false }
          }
        ],
        series: [
          {
            name: '设备健康度 SOH', type: 'line', yAxisIndex: 0,
            data: soh, smooth: true, symbol: 'circle', symbolSize: 5,
            lineStyle: { width: 3, color: C.accent },
            areaStyle: {
              color: {
                type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(242,169,59,.26)' },
                  { offset: 1, color: 'rgba(242,169,59,0)' }
                ]
              }
            },
            markArea: {
              silent: true,
              itemStyle: { color: 'rgba(95,201,138,.12)' },
              label: {
                show: true, position: 'insideTop', color: C.good,
                fontSize: 12, fontFamily: FONT, lineHeight: 17,
                formatter: '损耗故障期\n原厂出保窗口'
              },
              data: [[{ xAxis: '3' }, { xAxis: '5' }]]
            },
            markLine: {
              silent: true, symbol: 'none',
              data: [{
                xAxis: '5',
                lineStyle: { color: C.bad, type: 'dashed', width: 1.5 },
                label: {
                  show: true, position: 'insideEndTop', color: C.bad,
                  fontSize: 12, fontFamily: FONT, rotate: 0, distance: 8,
                  formatter: '原厂质保到期（第 5 年）'
                }
              }]
            }
          },
          {
            name: '维护 / 失效告警强度', type: 'line', yAxisIndex: 1,
            data: demand, smooth: true, symbol: 'circle', symbolSize: 5,
            lineStyle: { width: 2.5, color: C.bad },
            areaStyle: { color: 'rgba(232,69,58,.10)' }
          }
        ]
      };
    },

    /* ================= 05 · 后市场产值占比倒挂（堆叠面积） ================= */
    'value-mix': function () {
      var years = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'];
      /* 后市场产值占全生命周期价值比例(%)：初期不足 10% → 跃升至 40%+
       * 端点取自《调研简报》二·2；中间年份为等趋势插值示意 */
      var after = [8, 8.5, 9, 10, 11, 12.5, 14, 16, 18.5, 21, 24, 27.5, 31, 35, 38.5, 42];
      var front = [92, 91.5, 91, 90, 89, 87.5, 86, 84, 81.5, 79, 76, 72.5, 69, 65, 61.5, 58];

      return {
        grid: { left: 8, right: 58, top: 44, bottom: 8, containLabel: true },
        tooltip: { trigger: 'axis' },
        legend: {
          top: 0, itemWidth: 14, itemHeight: 8, itemGap: 18,
          textStyle: { color: C.text2, fontSize: 13, fontFamily: FONT },
          data: ['后市场运维（反复发生）', '前端硬件制造（一次性）']
        },
        xAxis: {
          type: 'category', data: years, name: '运行年数',
          nameTextStyle: { color: C.text3, fontSize: 12, fontFamily: FONT },
          axisLine: { lineStyle: { color: C.axis } },
          axisTick: { show: false },
          axisLabel: { color: C.text2, fontSize: 12, fontFamily: MONO, interval: 2 }
        },
        yAxis: {
          type: 'value', name: '占全生命周期价值 (%)', min: 0, max: 100,
          nameTextStyle: { color: C.text3, fontSize: 12, fontFamily: FONT },
          axisLine: { show: false }, axisTick: { show: false },
          axisLabel: { color: C.text3, fontSize: 12, fontFamily: MONO },
          splitLine: { lineStyle: { color: C.grid } }
        },
        series: [
          {
            name: '后市场运维（反复发生）', type: 'line', stack: 'v',
            data: after, smooth: true, symbol: 'none',
            lineStyle: { width: 2, color: C.accent },
            areaStyle: {
              color: {
                type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(242,169,59,.50)' },
                  { offset: 1, color: 'rgba(242,169,59,.14)' }
                ]
              }
            },
            markPoint: {
              symbol: 'circle', symbolSize: 11,
              itemStyle: { color: C.accent, borderColor: C.surface, borderWidth: 2 },
              label: {
                show: true, position: 'top', distance: 12,
                color: C.accent, fontSize: 14, fontWeight: 600, fontFamily: FONT,
                formatter: '后市场 40%+'
              },
              data: [{ coord: ['15', 42] }]
            }
          },
          {
            name: '前端硬件制造（一次性）', type: 'line', stack: 'v',
            data: front, smooth: true, symbol: 'none',
            lineStyle: { width: 2, color: C.accent2 },
            areaStyle: {
              color: {
                type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(90,169,255,.20)' },
                  { offset: 1, color: 'rgba(90,169,255,.05)' }
                ]
              }
            }
          }
        ]
      };
    },

    /* ================= 05 · 中国新型储能累计装机增长 ================= */
    'capacity': function () {
      var yrs = ['2024', '2025', '2026', '2027', '2028', '2029', '2030'];
      /* 2024 = 78.3GW 为 CNESA 实际值；
       * 理想场景：按 CAGR 24.5% 递推 → 2030 年 291.2GW（BNEF/CNESA 理想场景）
       * 保守场景：按同口径递推 → 2030 年 200GW+ */
      var ideal = [78.3, 97.5, 121.4, 151.1, 188.1, 234.2, 291.2];
      var base = [78.3, 91.5, 107.0, 125.1, 146.2, 170.9, 200.0];

      return {
        grid: { left: 8, right: 46, top: 44, bottom: 8, containLabel: true },
        tooltip: { trigger: 'axis' },
        legend: {
          top: 0, itemWidth: 14, itemHeight: 8, itemGap: 16,
          textStyle: { color: C.text2, fontSize: 13, fontFamily: FONT },
          data: ['理想场景 · CAGR 24.5%', '保守场景 · 2030 年 200GW+']
        },
        xAxis: {
          type: 'category', data: yrs, boundaryGap: false,
          axisLine: { lineStyle: { color: C.axis } },
          axisTick: { show: false },
          axisLabel: { color: C.text2, fontSize: 12, fontFamily: MONO }
        },
        yAxis: {
          type: 'value', name: '累计装机 (GW)', min: 0, max: 320,
          nameTextStyle: { color: C.text3, fontSize: 12, fontFamily: FONT },
          axisLine: { show: false }, axisTick: { show: false },
          axisLabel: { color: C.text3, fontSize: 12, fontFamily: MONO },
          splitLine: { lineStyle: { color: C.grid } }
        },
        series: [
          {
            name: '理想场景 · CAGR 24.5%', type: 'line',
            data: ideal, smooth: true, symbol: 'circle', symbolSize: 5,
            lineStyle: { width: 3, color: C.accent },
            areaStyle: {
              color: {
                type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(242,169,59,.30)' },
                  { offset: 1, color: 'rgba(242,169,59,0)' }
                ]
              }
            },
            markPoint: {
              symbol: 'circle', symbolSize: 11,
              itemStyle: { color: C.accent, borderColor: C.surface, borderWidth: 2 },
              label: {
                show: true, position: 'top', distance: 12,
                color: C.accent, fontSize: 14, fontWeight: 600, fontFamily: FONT,
                formatter: '291.2GW'
              },
              data: [{ coord: ['2030', 291.2] }]
            }
          },
          {
            name: '保守场景 · 2030 年 200GW+', type: 'line',
            data: base, smooth: true, symbol: 'circle', symbolSize: 5,
            lineStyle: { width: 3, color: C.accent2 },
            areaStyle: {
              color: {
                type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(90,169,255,.22)' },
                  { offset: 1, color: 'rgba(90,169,255,0)' }
                ]
              }
            },
            markPoint: {
              symbol: 'circle', symbolSize: 11,
              itemStyle: { color: C.accent2, borderColor: C.surface, borderWidth: 2 },
              label: {
                show: true, position: 'bottom', distance: 14,
                color: C.accent2, fontSize: 14, fontWeight: 600, fontFamily: FONT,
                formatter: '200GW+'
              },
              data: [{ coord: ['2030', 200] }]
            }
          }
        ]
      };
    }

  };

  var charts = [];

  function render() {
    if (!window.echarts) return;
    var nodes = document.querySelectorAll('[data-ec]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var key = el.getAttribute('data-ec');
      var fn = OPTS[key];
      if (!fn || el.getAttribute('data-ec-done')) continue;
      var chart = window.echarts.init(el, null, { renderer: 'canvas' });
      chart.setOption(fn());
      el.setAttribute('data-ec-done', '1');
      charts.push(chart);
    }
  }

  function boot() {
    render();
    /* 首帧后与字体就绪后再画一次，规避 Web Font 落地导致的错位 */
    requestAnimationFrame(render);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(render).catch(function () {});
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') boot();
  else window.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('load', boot);

  window.addEventListener('resize', function () {
    for (var i = 0; i < charts.length; i++) charts[i].resize();
  });
})();
