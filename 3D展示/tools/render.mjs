/* 无头渲染出片脚本
   前置：1) node tools/server.mjs 已启动
        2) npm i playwright（浏览器用系统 Chrome，无需下载 chromium）
   用法：node tools/render.mjs
        环境变量 CHROME 可指定 Chrome 路径；URL 可覆盖渲染地址
*/
import { chromium } from 'playwright';

/* seq=1：逐帧渲染并回传 JPEG，再由 ffmpeg 以精确帧率编码（规避 VFR 录制问题）
   用法：node tools/render.mjs "http://127.0.0.1:8123/demo.html?seq=1&w=1920&h=1080"
   注意：URL 必须加引号传入；用 set URL=... 在 cmd 里传会因 & 转义丢参数 */
const URL = process.argv[2] || process.env.URL ||
  'http://127.0.0.1:8123/demo.html?seq=1&name=repower-usage-demo';
console.log('[url]', URL);

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME ||
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: [
    '--enable-unsafe-swiftshader',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--autoplay-policy=no-user-gesture-required'
  ]
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

page.on('console', m => console.log('[console:' + m.type() + ']', m.text()));
page.on('pageerror', e => console.log('[pageerror]', e.message));

await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });

const info = await page.evaluate(`JSON.stringify({
  gl: (() => { const c = document.createElement('canvas'); const g = c.getContext('webgl2') || c.getContext('webgl'); const d = g && g.getExtension('WEBGL_debug_renderer_info'); return g ? (d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'ok') : 'none'; })(),
  mp4: MediaRecorder.isTypeSupported('video/mp4;codecs=avc1.42E01E'),
  vp9: MediaRecorder.isTypeSupported('video/webm;codecs=vp9'),
  vp8: MediaRecorder.isTypeSupported('video/webm;codecs=vp8'),
  mime: window.__mime || null
})`);
console.log('[env]', info);

const t0 = Date.now();
let last = null;
while (true) {
  const st = await page.evaluate('JSON.stringify({p: window.__p || null, done: window.__done || null, err: window.__err || null})');
  const o = JSON.parse(st);
  if (o.err) { console.log('[err]', o.err); }
  if (o.done) { console.log('[done]', JSON.stringify(o.done)); break; }
  if (Date.now() - t0 > 1500000) { console.log('[timeout]', st); break; }   /* 25 分钟上限（2K 逐帧渲染较慢） */
  if (JSON.stringify(o.p) !== JSON.stringify(last)) { console.log('[progress]', JSON.stringify(o.p)); last = o.p; }
  await new Promise(r => setTimeout(r, 4000));
}

await browser.close();
console.log('[exit]');
