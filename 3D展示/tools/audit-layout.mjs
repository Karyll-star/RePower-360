import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--enable-unsafe-swiftshader']
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });

await page.goto('http://127.0.0.1:8123/demo.html?auto=0&_=' + Date.now(), { waitUntil: 'load' });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });

const res = await page.evaluate('JSON.stringify(window.__panelCheck())');
const o = JSON.parse(res);
console.log('=== 卡片排版自检（宽度 / 纵向）');
o.rows.forEach(r => {
  console.log(`  ${r.ok ? 'OK  ' : 'FAIL'}  ${r.item.padEnd(16)} 实测=${String(r.w).padStart(6)}  上限=${String(r.max).padStart(5)}  采用字号=${r.used || '-'}`);
});
console.log('超宽/溢出项:', o.bad.length ? o.bad.map(b => b.item + '(' + b.w + '>' + b.max + ')').join(', ') : '无 ✅');

/* 两章各渲染一帧，确认不抛错 */
for (const t of [39, 45]) {
  const ok = await page.evaluate(`(function(){ try { window.__seek(${t}); return 'ok'; } catch(e) { return 'ERR ' + e.message; } })()`);
  console.log(`seek(${t}) -> ${ok}`);
}
console.log('页面错误:', errs.length ? errs.join(' || ') : '无 ✅');

await browser.close();
