/* 本地渲染服务：静态托管 3D 展示目录 + 接收浏览器上传的录制文件
   用法：node tools/server.mjs   （默认 http://127.0.0.1:8123）
   端点：
     GET  /<path>                  静态文件
     POST /upload?name=demo.mp4    写入 <root>/out/<name>（二进制 body）
     GET  /__ping                  健康检查
*/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'out');
const PORT = Number(process.env.PORT || 8123);

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));

  res.setHeader('Cache-Control', 'no-store, must-revalidate');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  if (req.method === 'GET' && url.pathname === '/__ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, root: ROOT }));
  }

  if (req.method === 'POST' && url.pathname === '/upload') {
    const name = (url.searchParams.get('name') || 'output.bin').replace(/[\\/]/g, '_');
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const buf = Buffer.concat(chunks);
      const file = path.join(OUT, name);
      fs.writeFileSync(file, buf);
      console.log('[saved]', file, buf.length, 'bytes');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, file, bytes: buf.length }));
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/frame') {
    const idx = String(url.searchParams.get('idx') || '0').replace(/[^0-9]/g, '').padStart(5, '0');
    const dir = path.join(OUT, 'frames');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      fs.writeFileSync(path.join(dir, idx + '.jpg'), Buffer.concat(chunks));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, idx }));
    });
    return;
  }

  if (req.method === 'GET') {
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/' || rel === '') rel = '/demo.html';
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end('404');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    return fs.createReadStream(file).pipe(res);
  }

  res.writeHead(405); res.end('405');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('serving', ROOT, '-> http://127.0.0.1:' + PORT);
});
