#!/usr/bin/env node
/* ============================================================
 * 本地开发服务器（仅用于本地联调，线上由 EdgeOne Makers 托管）
 *
 *   node scripts/dev-server.mjs
 *
 * 行为：
 *   1) 静态文件从仓库根目录提供（模拟 Makers 的静态托管）
 *   2) /api/* 转发给 cloud-functions/api/[[default]].js 的 onRequest
 *   3) 未安装 Blob SDK 时，数据落到 .data/state.json
 * ============================================================ */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(process.cwd());
/* 本地默认用文件存储；想连真实 Blob 就显式设置 STORAGE_DRIVER=blob 并配好凭据 */
if (!process.env.STORAGE_DRIVER) process.env.STORAGE_DRIVER = 'local';
const PORT = Number(process.env.PORT || 8080);
const FN_URL = pathToFileURL(join(ROOT, 'cloud-functions', 'api', '[[default]].js')).href;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function toRequest(req) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const headers = new Headers();
  Object.keys(req.headers).forEach((k) => {
    const v = req.headers[k];
    headers.set(k, Array.isArray(v) ? v.join(', ') : v);
  });
  const method = (req.method || 'GET').toUpperCase();
  const hasBody = !(method === 'GET' || method === 'HEAD');
  const body = hasBody ? await readBody(req) : undefined;
  return new Request(url.href, { method, headers, body });
}

async function writeNode(res, response) {
  const headers = {};
  response.headers.forEach((v, k) => { headers[k] = v; });
  const buf = Buffer.from(await response.arrayBuffer());
  res.writeHead(response.status, headers);
  res.end(res.req && res.req.method === 'HEAD' ? undefined : buf);
}

const mod = await import(FN_URL);
const onRequest = mod.onRequest || mod.default;

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (url.pathname.startsWith('/api/')) {
      const request = await toRequest(req);
      const response = await onRequest({
        request,
        env: process.env,
        clientIp: req.socket.remoteAddress || ''
      });
      await writeNode(res, response);
      return;
    }

    let file = join(ROOT, normalize(decodeURIComponent(url.pathname)));
    if (file !== ROOT && !file.startsWith(ROOT + sep)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Forbidden');
    }
    try {
      const st = await stat(file);
      if (st.isDirectory()) file = join(file, 'index.html');
    } catch (e) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found');
    }
    const buf = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': buf.length
    });
    res.end(req.method === 'HEAD' ? undefined : buf);
  } catch (e) {
    console.error('[dev] 请求异常：', e);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('500 Internal Server Error');
    } else {
      res.end();
    }
  }
});

server.listen(PORT, () => {
  console.log(`本地开发服务器：http://localhost:${PORT}`);
  console.log(`静态目录：${ROOT}`);
});
