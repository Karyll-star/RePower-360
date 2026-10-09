/* ============================================================================
 * RePower-360 · UI Demo 外壳控制
 * 视图切换 / Toast / Modal / 图表自适应 / 交付说明
 * ==========================================================================*/
(function () {
  'use strict';
  const D = window.RP;
  const $ = s => document.querySelector(s);
  const money = D.money;

  /* ---------------- 通用浮层 ---------------- */
  const UI = {
    toast(msg, type) {
      const wrap = $('#toastWrap');
      const el = document.createElement('div');
      el.className = 'toast' + (type ? ' ' + type : '');
      el.textContent = msg;
      wrap.appendChild(el);
      setTimeout(() => el.remove(), 2600);
    },
    open(title, html, foot) {
      $('#modalTitle').textContent = title;
      $('#modalBody').innerHTML = html;
      $('#modalFoot').innerHTML = foot || '';
      $('#mask').classList.add('on');
      $('#modal').classList.add('on');
    },
    close() {
      $('#mask').classList.remove('on');
      $('#modal').classList.remove('on');
    },
    /* --------- 业务弹窗 --------- */
    modal(type, data) {
      if (type === 'recloud') {
        UI.open('重新上云 · ' + data.code, `
          <p class="note" style="margin-bottom:12px">该站点被判定为「孤儿电站」：${data.link}，
            整柜 SOH ${data.soh}%，月损失 ${money(data.loss)}。铺设网关后可恢复云端托管。</p>
          <ul class="m-h" style="display:block">
            ${['① 现场磁吸安装 Re-Bridge 网关（无需停机）',
              '② 自动破壁私有 CAN / RS485 协议，映射为统一数据模型',
              '③ 历史缓存数据补传，重建 240 颗单体数字孪生档案',
              '④ 第三方平台接管调度，7×24h 热失控 AI 预警启用'].map(t => `
              <li style="list-style:none;padding:7px 0;border-bottom:1px solid var(--border);font-size:12.5px;color:var(--text-2)">${t}</li>`).join('')}
          </ul>
          <div class="kv mt"><span class="k">网关硬件</span><span class="v">¥1,500 / 台（毛利 50%）</span></div>
          <div class="kv"><span class="k">预计工程量</span><span class="v">30 分钟 / 柜</span></div>
          <div class="kv"><span class="k">建议用工</span><span class="v">${data.city.split(' · ')[0]}就近工程师</span></div>`,
          `<button class="btn" data-act="modal-close">取消</button>
           <button class="btn btn-p" data-act="confirm-recloud" data-c="${data.code}">确认铺设并派单</button>`);
      }
      if (type === 'recloudAll') {
        UI.open('批量重新上云', `
          <p class="note" style="margin-bottom:12px">当前检出 2 座孤儿电站：ESS-ZJ-014、ESS-ZJ-027，
            合计月损失 ¥7,380。建议本周一次上门集中铺设网关。</p>
          <div class="kv"><span class="k">网关数量</span><span class="v">2 台</span></div>
          <div class="kv"><span class="k">硬件收入</span><span class="v">¥3,000</span></div>
          <div class="kv"><span class="k">订阅转化预期</span><span class="v">增效版 ×2 ≈ ¥19,992 / 年</span></div>`,
          `<button class="btn" data-act="modal-close">稍后再说</button>
           <button class="btn btn-p" data-act="confirm-recloud-all">确认批量派单</button>`);
      }
      if (type === 'dispatch') {
        const o = D.ORDERS.find(x => x.id === data) || {};
        const s = D.getSite(o.site) || {};
        UI.open('派单 · ' + data, `
          <div class="kv"><span class="k">站点</span><span class="v">${s.name || '—'} · ${o.site || ''}</span></div>
          <div class="kv"><span class="k">作业类型</span><span class="v">${o.type || '—'}</span></div>
          <div class="kv"><span class="k">推荐工程师</span><span class="v">李工 / 浙北组（距 12km）</span></div>
          <div class="kv"><span class="k">预计到达</span><span class="v">今日 13:40</span></div>
          <div class="kv"><span class="k">SLA</span><span class="v">4 小时内响应</span></div>
          <p class="note mt">派单后系统自动向工程师 App 推送导航、作业指引与备件清单。</p>`,
          `<button class="btn" data-act="modal-close">取消</button>
           <button class="btn btn-p" data-act="confirm-dispatch" data-id="${data}">确认派单</button>`);
      }
      if (type === 'order') {
        UI.open('生成上门活化工单', `
          <div class="kv"><span class="k">目标站点</span><span class="v">ESS-ZJ-003 · PACK-03</span></div>
          <div class="kv"><span class="k">落后单体</span><span class="v">7 颗（最弱 66.2%）</span></div>
          <div class="kv"><span class="k">作业参数</span><span class="v">5~10A 双向均衡 · 目标 ΔV ≤ 12mV</span></div>
          <div class="kv"><span class="k">预计时长</span><span class="v">2 小时（含安全复核）</span></div>
          <div class="kv"><span class="k">承诺效果</span><span class="v" style="color:var(--good)">放电可用容量恢复 ≥ 8%</span></div>`,
          `<button class="btn" data-act="modal-close">取消</button>
           <button class="btn btn-p" data-act="confirm-order">生成并推送至 App</button>`);
      }
      if (type === 'list') {
        const P = D.PASSPORT;
        UI.open('出具电池护照并挂牌撮合', `
          <p class="note" style="margin-bottom:12px">基于 27 个月连续云端数据出具第三方 SOH 体检报告，
            评级 Grade A，向下游 5 家认证厂商发布报价邀请。</p>
          <table class="tbl"><thead><tr><th>意向方</th><th>用途</th><th class="r">报价</th></tr></thead><tbody>
            ${[['某叉车集团', '厂区电动叉车电池', P.quoteHigh], ['低速车厂 A', '观光 / 巡逻车', 42800],
              ['离网微网集成商', '光伏离网蓄电', 41900], ['农业储能商', '灌溉泵站储能', 40600],
              ['再生资源企业', '拆解黑粉回收', P.quoteLow]]
              .map(r => `<tr><td class="strong">${r[0]}</td><td>${r[1]}</td><td class="r mono">${money(r[2])}</td></tr>`).join('')}
          </tbody></table>
          <div class="kv mt"><span class="k">撮合成交价</span><span class="v" style="color:var(--good)">${money(P.bid)}</span></div>
          <div class="kv"><span class="k">平台佣金 8%</span><span class="v">${money(P.bid * P.fee)}</span></div>`,
          `<button class="btn" data-act="modal-close">暂不挂牌</button>
           <button class="btn btn-p" data-act="confirm-list">确认挂牌</button>`);
      }
    }
  };
  window.UI = UI;

  /* ---------------- 交付说明 ---------------- */
  function about() {
    UI.open('交付说明 · 界面 Demo', `
      <p class="note" style="margin-bottom:14px">本 Demo 对应《设计任务书 2-1》<b>交付物 2：界面 Demo</b>，
        数值口径与《"智储重生（RePower-360）"方案全景框架》《工商业储能柜后市场潜力调研简报》保持一致。</p>
      <table class="tbl"><thead><tr><th>模块</th><th>任务书要求</th><th>本 Demo 实现</th></tr></thead><tbody>
        <tr><td class="strong">PC 中台</td><td>资产救援大盘：柜联网状态、一键重新上云</td>
            <td>10 座站点台账 + 状态灯 + 批量/单柜上云 + AI 预警塔</td></tr>
        <tr><td class="strong">PC 中台</td><td>电芯数字孪生：240 颗单体热力图</td>
            <td>5 PACK × 48 cells SOH 矩阵、落后单体清单、ΔV 15 天预测</td></tr>
        <tr><td class="strong">PC 中台</td><td>经济收益晴雨表：挽回金额与 ROI</td>
            <td>客户算一算滑块、月度挽回 vs 订阅、累计现金流与 BEP 第 14~18 月</td></tr>
        <tr><td class="strong">PC 中台</td><td>订阅 / 退役转卖</td>
            <td>SLA 分级订阅卡、工单台账、电池护照与 Grade A/B/C 挂牌撮合</td></tr>
        <tr><td class="strong">移动端 App</td><td>扫码连接 Re-Bridge 与 Re-Pulse</td>
            <td>扫码框动效 → 协议破解 → 240 单体建档</td></tr>
        <tr><td class="strong">移动端 App</td><td>一键活化作业流</td>
            <td>四步指引 + 进度动画 + ΔV 实时回落 + 工单自动回填</td></tr>
        <tr><td class="strong">移动端 App</td><td>安全温度报警 / 电池护照</td>
            <td>52.4℃ 告警浮层与处置指引、SOH 报告一键挂牌</td></tr>
      </tbody></table>
      <div class="kv mt"><span class="k">界面 CMF 依据</span><span class="v">《物理实体工具产品设计规范》第 19 节</span></div>
      <div class="kv"><span class="k">操作方式</span><span class="v">点击导航 / 按钮即可体验，可录屏导出 MP4</span></div>
      <div class="kv"><span class="k">AI 工具标注</span><span class="v">界面构建：CodeBuddy（Claude / GPT 系列模型）</span></div>`,
      `<button class="btn btn-p" data-act="modal-close">开始演示</button>`);
  }

  /* ---------------- 事件 ---------------- */
  document.getElementById('viewSwitch').addEventListener('click', e => {
    const b = e.target.closest('.sb-btn'); if (!b) return;
    document.querySelectorAll('#viewSwitch .sb-btn').forEach(x => x.classList.toggle('is-on', x === b));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('is-active', v.dataset.view === b.dataset.view));
    setTimeout(() => window.dispatchEvent(new CustomEvent('rp:resize')), 30);
  });

  $('#btnAbout').addEventListener('click', about);
  $('#btnReset').addEventListener('click', () => {
    window.RP_APP.reset();
    window.RP_PC.render('dash');
    UI.toast('演示状态已重置', 'ok');
  });
  $('#modalClose').addEventListener('click', () => UI.close());
  $('#mask').addEventListener('click', () => UI.close());
  document.addEventListener('keydown', e => { if (e.key === 'Escape') UI.close(); });

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-act]');
    if (!t || !t.closest('#modal')) return;
    switch (t.dataset.act) {
      case 'modal-close': UI.close(); break;
      case 'confirm-recloud': {
        const s = D.getSite(t.dataset.c);
        if (s) { s.status = 'online'; s.link = '网关已接管'; }
        UI.close(); UI.toast(`${t.dataset.c} 已铺设 Re-Bridge，30 分钟后重回云端`, 'ok');
        window.RP_PC.render('dash'); break;
      }
      case 'confirm-recloud-all':
        UI.close(); UI.toast('已生成 2 张铺设工单并推送至浙北组 App', 'ok');
        window.RP_PC.render('dash'); break;
      case 'confirm-dispatch':
        UI.close(); UI.toast(`工单 ${t.dataset.id} 已派给 李工 / 浙北组`, 'ok'); break;
      case 'confirm-order':
        UI.close(); UI.toast('活化工单已生成，推送至王工移动端 App', 'ok');
        document.querySelector('.sb-btn[data-view="app"]').click();
        setTimeout(() => window.RP_APP.go('job'), 60); break;
      case 'confirm-list':
        UI.close(); UI.toast('已挂牌，5 家厂商收到报价邀请（佣金 8%）', 'ok');
        window.RP_PC.render('resell'); break;
    }
  });

  /* ---------------- 深链（便于录屏 / 出图）----------------
   * #pc-dash      → PC 中台 · 资产救援大盘
   * #pc-twin      → PC 中台 · 电芯数字孪生
   * #app-job      → 移动端 · 活化作业流
   * 追加 ?shot=1  → 出图模式：隐藏演示条 / 解说栏 / 交付说明弹窗
   */
  function applyHash() {
    const raw = (location.hash || '').replace(/^#/, '');
    if (!raw) return false;
    const [path, qs] = raw.split('?');
    const shot = /shot=1/.test(qs || '');
    const [view, key] = path.split('-');
    if (shot) document.body.classList.add('shot');
    if (view === 'pc') window.RP_PC.render(key || 'dash');
    else if (view === 'app') {
      document.querySelector('.sb-btn[data-view="app"]').click();
      window.RP_APP.go(key || 'home');
    }
    return shot;
  }

  /* ---------------- 启动 ---------------- */
  window.addEventListener('resize', () => window.dispatchEvent(new CustomEvent('rp:resize')));
  window.addEventListener('rp:resize', () => {
    try {
      document.querySelectorAll('.chart, #cGauge').forEach(d => {
        const inst = echarts.getInstanceByDom(d);
        if (inst) inst.resize();
      });
    } catch (e) {}
  });

  window.RP_PC.render('dash');
  window.RP_APP.render();
  const isShot = applyHash();
  if (!isShot) setTimeout(about, 500);
})();
