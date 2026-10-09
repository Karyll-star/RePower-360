/* 一次性构建脚本：为含专业名词的内容页在左下角注入 .footnote 名词注释。
 * 跳过封面 / 章节分隔页（整版海报页不适合密集脚注）。
 * 结果写入 index.html（静态 HTML）；脚本幂等，可重复运行。 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'index.html');
let html = fs.readFileSync(file, 'utf8');

/* 术语表：[页面可见文本中出现的关键词, 释义] —— 释义尽量短，控制脚注在两行内 */
const TERMS = [
  ['SOH', '电池健康度（可用容量 ÷ 额定容量）'],
  ['BMS', '电池管理系统，负责监控与电芯均衡'],
  ['木桶效应', '整柜可用容量被最差那颗电芯限制'],
  ['被动均衡', '靠电阻把多余电量发热耗掉，仅毫安级'],
  ['主动均衡', '把电量在电芯间转移而非耗散，可达安培级'],
  ['两充两放', '一天两次充满、两次放完的工商业典型工况'],
  ['峰谷套利', '低谷电价充电、高峰电价放电赚差价'],
  ['孤儿电站', '原厂倒闭或断网、无人维保的存量柜'],
  ['EIS', '电化学阻抗谱，无损测电芯真实健康度'],
  ['梯次利用', '退役电芯按实测残值降级再用'],
  ['PACK', '电池包：电芯串并联组成的模块单元'],
  ['CAGR', '复合年均增长率'],
  ['EMC', '合同能源管理，从客户增量收益中分成'],
  ['BaaS', '电池即服务，按月付费不买断'],
  ['SLA', '服务等级协议，约定响应与赔付标准'],
  ['电池护照', '电池全生命周期健康与维修履历档案'],
  ['DC/DC', '直流电压变换模块'],
  ['RS485', '工业现场常用串行通信标准'],
  ['CAN', '工业现场常用通信总线'],
  ['IP65', '完全防尘 + 防低压喷水的防护等级'],
  ['液冷', '乙二醇冷却液循环散热'],
  ['内阻', '电芯内部电阻，随老化升高'],
  ['压差', '单体间电压差，越大一致性越差'],
  ['残值', '退役电池可回收的剩余价值'],
  ['物联网卡', '设备内置流量卡，用于上传运行数据'],
  ['边缘网关', '现场采集与协议转换、负责上云的设备'],
  ['盈亏平衡', '累计收入刚好覆盖累计成本的时点'],
  ['ROI', '投资回报率'],
  ['GW', '功率单位吉瓦；GWh 为容量单位吉瓦时'],
  ['CMF', '颜色、材料与表面处理'],
  ['DIN', '工业控制柜通用标准安装导轨'],
  ['阳极氧化', '铝合金耐磨耐腐蚀表面处理'],
  ['防爆阀', '压力异常时自动泄压的安全部件'],
  ['灭火介质', '储能消防系统使用的灭火材料'],
  ['除硫', '高频脉冲打散极板结晶、恢复活性'],
  ['增量分成', '从为客户挽回的放电收益中按比例抽成'],
  ['爆炸图', '零件沿装配轴分散展示的拆解图'],
  ['Re-Pulse', '本方案的移动式电芯主动活化工作站'],
  ['Re-Bridge', '本方案的储能柜边缘数字化网关']
];

const MAX_TERMS = 8;
const SEP = '　|　';
const PREFIX = '名词注释：';

function visibleText(inner) {
  let scan = inner;
  const ni = scan.indexOf('<div class="notes"');
  if (ni >= 0) scan = scan.slice(0, ni);
  const fi = scan.indexOf('<div class="footnote"');
  if (fi >= 0) scan = scan.slice(0, fi);
  return scan
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&nbsp;/g, ' ');
}

function dropFootnote(absStart) {
  const fi = html.indexOf('<div class="footnote"', absStart);
  const endSec = html.indexOf('</section>', absStart);
  if (fi < 0 || fi > endSec) return false;
  const fe = html.indexOf('</div>', fi);
  if (fe < 0) return false;
  let a = fi;
  let b = fe + '</div>'.length;
  while (a > 0 && (html[a - 1] === ' ' || html[a - 1] === '\n')) a--;
  while (b < html.length && (html[b] === '\n' || html[b] === ' ')) b++;
  html = html.slice(0, a) + html.slice(b);
  return true;
}

const starts = [];
const re = /<section class="slide/g;
let m;
while ((m = re.exec(html))) starts.push(m.index);

let added = 0, removed = 0, skipped = 0;

for (let i = starts.length - 1; i >= 0; i--) {
  const s = starts[i];
  const e = html.indexOf('</section>', s);
  if (e < 0) continue;

  const headTag = html.slice(s, html.indexOf('>', s));
  const isCover = /\bcover\b/.test(headTag);

  if (isCover) {
    if (dropFootnote(s)) removed++;
    skipped++;
    continue;
  }

  const inner = html.slice(s, e);
  const text = visibleText(inner);

  const hits = [];
  for (const [k, d] of TERMS) {
    if (text.indexOf(k) >= 0) hits.push(k + ' = ' + d);
    if (hits.length >= MAX_TERMS) break;
  }
  if (!hits.length) {
    dropFootnote(s);
    continue;
  }

  const gloss = PREFIX + hits.join('；');

  const fi = inner.indexOf('<div class="footnote"');
  if (fi >= 0) {
    const fe = inner.indexOf('</div>', fi);
    if (fe < 0) continue;
    let rest = inner.slice(inner.indexOf('>', fi) + 1, fe).trim();
    /* 幂等：先剥掉上一次生成的名词注释，只保留数据来源等原文 */
    if (rest.indexOf(PREFIX) === 0) {
      const p = rest.indexOf(SEP);
      rest = p >= 0 ? rest.slice(p + SEP.length) : '';
    }
    const merged = rest ? gloss + SEP + rest : gloss;
    const absStart = s + fi;
    const absEnd = s + fe + '</div>'.length;
    html = html.slice(0, absStart) +
      '<div class="footnote">' + merged + '</div>' +
      html.slice(absEnd);
  } else {
    html = html.slice(0, e) +
      '    <div class="footnote">' + gloss + '</div>\n  ' +
      html.slice(e);
  }
  added++;
}

fs.writeFileSync(file, html, 'utf8');
console.log('slides: ' + starts.length +
  ' | footnotes set: ' + added +
  ' | cover/empty cleaned: ' + (removed) +
  ' | covers skipped: ' + skipped);
