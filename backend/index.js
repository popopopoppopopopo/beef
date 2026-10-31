/* ============================================================
 * 牛肉 BEEF · 后端（腾讯云 SCF 云函数）
 *
 * 入口：index.main_handler（API 网关触发器）
 * 存储：腾讯云 COS 的 <Bucket>/beef/data.json（未配置密钥时降级为本地文件）
 * 凭据：全部来自函数的环境变量，由 GitHub Actions 从 Secrets 注入，
 *       代码里不写死任何密钥。
 *
 * 本地调试：node backend/index.js  → http://localhost:9000/api/health
 * ============================================================ */
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

/* ---------------- 配置（全部来自环境变量） ---------------- */
const DEFAULT_SITE_FIELDS = [
  'brand', 'brandEn', 'fullName', 'domain', 'slogan', 'desc', 'since',
  'qq', 'serverAddr', 'serverPort', 'email', 'repo',
  'apkVersion', 'apkUrl', 'sponsorQr', 'serverOnline', 'betaMode'
];
const KEY_RE = /^[A-Za-z0-9_-]{1,40}$/;
const STATE_KEY = process.env.COS_KEY || 'beef/data.json';

let CFG = null;
const pick = (keys, def) => {
  for (const k of keys) {
    const v = process.env[k];
    if (v !== undefined && v !== null && v !== '') return String(v);
  }
  return def;
};
const toNum = (v, def) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
};

function cfg() {
  if (CFG) return CFG;
  const cosId = pick(['TENCENTCLOUD_SECRET_ID', 'COS_SECRET_ID'], '');
  const cosKey = pick(['TENCENTCLOUD_SECRET_KEY', 'COS_SECRET_KEY'], '');
  const bucket = pick(['COS_BUCKET'], '');
  const region = pick(['COS_REGION'], '');
  CFG = {
    cosEnabled: !!(cosId && cosKey && bucket && region),
    cosId, cosKey, bucket, region,
    adminPassword: pick(['BEEF_ADMIN_PASSWORD', 'ADMIN_PASSWORD'], ''),
    tokenSecret: pick(['ADMIN_TOKEN_SECRET'], ''),
    tokenTTL: toNum(pick(['ADMIN_TOKEN_TTL'], ''), 12 * 3600),
    maxItemBytes: toNum(pick(['MAX_ITEM_BYTES'], ''), 256 * 1024),
    maxStateBytes: toNum(pick(['MAX_STATE_BYTES'], ''), 32 * 1024 * 1024),
    anonWritable: pick(['ANON_WRITABLE_KEYS'], 'posts,chat').split(',').map((s) => s.trim()).filter(Boolean),
    anonMaxItems: toNum(pick(['ANON_MAX_ITEMS'], ''), 500),
    anonMaxAddPerReq: toNum(pick(['ANON_MAX_ADD_PER_REQ'], ''), 5),
    rateLimitPerMin: toNum(pick(['RATE_LIMIT_PER_MIN'], ''), 30),
    corsOrigin: pick(['CORS_ORIGIN'], '*'),
    localFile: pick(['LOCAL_STATE_FILE'], path.join(__dirname, '..', '.data', 'state.json'))
  };
  return CFG;
}

/* ---------------- 工具 ---------------- */
const b64url = (buf) => Buffer.from(buf).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function sign(secret, text) {
  return b64url(crypto.createHmac('sha256', secret).update(text).digest());
}

function safeEqual(a, b) {
  const ab = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  const max = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < max; i++) diff |= (ab[i] || 0) ^ (bb[i] || 0);
  return diff === 0;
}

const json = (status, data, origin) => ({
  isBase64Encoded: false,
  statusCode: status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'X-Content-Type-Options': 'nosniff'
  },
  body: JSON.stringify(data)
});

/* ---------------- 存储：COS / 本地文件 ---------------- */
function cosClient(c) {
  // 腾讯云官方 SDK
  const COS = require('cos-nodejs-sdk-v5');
  return new COS({ SecretId: c.cosId, SecretKey: c.cosKey });
}

async function readState(c) {
  if (c.cosEnabled) {
    const cos = cosClient(c);
    return new Promise((resolve, reject) => {
      cos.getObject({ Bucket: c.bucket, Region: c.region, Key: STATE_KEY }, (err, data) => {
        if (err) {
          if (err.statusCode === 404 || err.code === 'NoSuchKey') return resolve(null);
          return reject(new Error('COS 读取失败：' + (err.message || JSON.stringify(err))));
        }
        resolve(data && data.Body ? data.Body.toString('utf8') : null);
      });
    });
  }
  try {
    return await fsp.readFile(c.localFile, 'utf8');
  } catch (e) {
    return null;
  }
}

async function writeState(c, state) {
  const text = JSON.stringify(state);
  if (Buffer.byteLength(text, 'utf8') > c.maxStateBytes) {
    const err = new Error(`数据总量超过上限 ${Math.floor(c.maxStateBytes / 1024 / 1024)}MB`);
    err.code = 413;
    throw err;
  }
  if (c.cosEnabled) {
    const cos = cosClient(c);
    await new Promise((resolve, reject) => {
      cos.putObject({
        Bucket: c.bucket, Region: c.region, Key: STATE_KEY,
        Body: Buffer.from(text, 'utf8'),
        ContentType: 'application/json; charset=utf-8'
      }, (e) => (e ? reject(new Error('COS 写入失败：' + e.message)) : resolve()));
    });
    return;
  }
  await fsp.mkdir(path.dirname(c.localFile), { recursive: true });
  await fsp.writeFile(c.localFile, text, 'utf8');
}

/* ---------------- 鉴权 ---------------- */
function issueToken(c) {
  const payload = { exp: Math.floor(Date.now() / 1000) + c.tokenTTL };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(c.tokenSecret, body)}`;
}

function verifyToken(c, token) {
  if (!token || typeof token !== 'string' || token.indexOf('.') < 0) return false;
  const i = token.indexOf('.');
  const body = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expect = sign(c.tokenSecret, body);
  if (!safeEqual(sig, expect)) return false;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64').toString('utf8'));
    return payload.exp > Math.floor(Date.now() / 1000);
  } catch (e) {
    return false;
  }
}

/* ---------------- 数据校验 ---------------- */
function idOf(item) {
  if (!item) return null;
  for (const f of ['id', 'code', 'key']) {
    if (item[f] !== undefined && item[f] !== null) return String(item[f]);
  }
  return null;
}
const validItem = (c, i) => !!i && typeof i === 'object' && !Array.isArray(i)
  && Buffer.byteLength(JSON.stringify(i), 'utf8') <= c.maxItemBytes;

const emptyState = () => ({ version: Date.now(), site: {}, data: {} });

function normalize(raw) {
  let obj = raw;
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw); } catch (e) { obj = null; }
  }
  if (!obj || typeof obj !== 'object') return emptyState();
  return {
    version: Number(obj.version) || Date.now(),
    site: (obj.site && typeof obj.site === 'object') ? obj.site : {},
    data: (obj.data && typeof obj.data === 'object') ? obj.data : {}
  };
}

/* 匿名写：只能追加 / 改自己那条，删不掉服务端已有内容 */
function mergeAppend(c, current, incoming) {
  const cur = Array.isArray(current) ? current : [];
  const inc = Array.isArray(incoming) ? incoming : [];
  const curIds = new Set(cur.map(idOf).filter(Boolean));
  const added = inc.filter((i) => validItem(c, i)).filter((i) => {
    const id = idOf(i);
    return !id || !curIds.has(id);
  });
  if (added.length > c.anonMaxAddPerReq) {
    const err = new Error(`单次最多新增 ${c.anonMaxAddPerReq} 条`);
    err.code = 413;
    throw err;
  }
  let next = cur.concat(added);
  if (next.length > c.anonMaxItems) next = next.slice(next.length - c.anonMaxItems);
  return next;
}

/* ---------------- 限流 ---------------- */
const hits = new Map();
function rateOk(c, ip) {
  const now = Date.now();
  const rec = hits.get(ip) || { n: 0, t: now };
  if (now - rec.t > 60000) { rec.n = 0; rec.t = now; }
  rec.n++;
  hits.set(ip, rec);
  if (hits.size > 5000) hits.clear();
  return rec.n <= c.rateLimitPerMin;
}

/* ---------------- 路由 ---------------- */
async function handle(req) {
  const c = cfg();
  const { method, path: p, headers, body, ip } = req;
  const seg = String(p || '').replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  const token = (headers['x-admin-token'] || '')
    || String(headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
  const isAdmin = verifyToken(c, token);
  const origin = c.corsOrigin;

  if (method === 'OPTIONS') return json(204, {}, origin);

  if (seg[1] === 'health') {
    return json(200, {
      ok: true,
      storage: c.cosEnabled ? 'cos' : 'local',
      target: c.cosEnabled ? `COS ${c.region}/${c.bucket}/${STATE_KEY}` : c.localFile,
      adminEnabled: !!c.adminPassword,
      weakSecret: !c.tokenSecret
    }, origin);
  }

  if (method === 'POST' && seg[1] === 'login') {
    if (!rateOk(c, ip)) return json(429, { error: '尝试过于频繁，请稍后再试' }, origin);
    if (!c.adminPassword) return json(401, { error: '服务端未配置 BEEF_ADMIN_PASSWORD' }, origin);
    if (!safeEqual((body && body.password) || '', c.adminPassword)) {
      return json(401, { error: '密码错误' }, origin);
    }
    return json(200, { token: issueToken(c), expiresIn: c.tokenTTL }, origin);
  }

  if (method === 'GET' && seg[1] === 'state' && !seg[2]) {
    try {
      const st = normalize(await readState(c));
      return json(200, { version: st.version, site: st.site, data: st.data }, origin);
    } catch (e) {
      console.error('[api] 读取失败：', e.message);
      return json(200, { version: 0, site: {}, data: {}, offline: true }, origin);
    }
  }

  if (method === 'PUT' && seg[1] === 'state' && seg[2]) {
    const key = decodeURIComponent(seg[2]);
    if (!rateOk(c, ip)) return json(429, { error: '操作过于频繁，请稍后再试' }, origin);
    if (!body || !Array.isArray(body.list)) return json(400, { error: '列表格式不正确' }, origin);
    if (!KEY_RE.test(key)) return json(400, { error: '非法的栏目名：' + key }, origin);
    if (!isAdmin && c.anonWritable.indexOf(key) < 0) return json(401, { error: '需要管理员权限' }, origin);
    try {
      const cur = normalize(await readState(c));
      if (!isAdmin) {
        cur.data[key] = mergeAppend(c, cur.data[key], body.list);
      } else {
        if (!body.list.every((i) => validItem(c, i))) {
          const err = new Error('存在超过大小上限的内容');
          err.code = 413;
          throw err;
        }
        cur.data[key] = body.list;
      }
      cur.version = Date.now();
      await writeState(c, cur);
      return json(200, { ok: true, version: cur.version, key, count: (cur.data[key] || []).length }, origin);
    } catch (e) {
      return json(e.code || 500, { error: e.message }, origin);
    }
  }

  if (method === 'PUT' && seg[1] === 'site') {
    if (!isAdmin) return json(401, { error: '需要管理员权限' }, origin);
    const patch = body;
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      return json(400, { error: '配置格式不正确' }, origin);
    }
    try {
      const cur = normalize(await readState(c));
      Object.keys(patch).forEach((k) => {
        if (DEFAULT_SITE_FIELDS.indexOf(k) < 0) return;
        const v = patch[k];
        if (typeof v === 'string' || typeof v === 'boolean' || typeof v === 'number') cur.site[k] = v;
      });
      cur.version = Date.now();
      await writeState(c, cur);
      return json(200, { ok: true, version: cur.version, site: cur.site }, origin);
    } catch (e) {
      return json(e.code || 500, { error: e.message }, origin);
    }
  }

  if (method === 'POST' && seg[1] === 'vote') {
    if (!rateOk(c, ip)) return json(429, { error: '操作过于频繁，请稍后再试' }, origin);
    if (!body || !body.id) return json(400, { error: '缺少投票 ID' }, origin);
    const idxs = Array.isArray(body.idxs) ? body.idxs.slice(0, 20) : [];
    try {
      const cur = normalize(await readState(c));
      const polls = cur.data.polls;
      if (!Array.isArray(polls)) {
        const err = new Error('尚无投票数据');
        err.code = 404;
        throw err;
      }
      let target = null;
      polls.forEach((p) => { if (String(p.id) === String(body.id)) target = p; });
      if (!target) {
        const err = new Error('投票不存在');
        err.code = 404;
        throw err;
      }
      if (!Array.isArray(target.options)) {
        const err = new Error('投票数据不完整');
        err.code = 400;
        throw err;
      }
      idxs.forEach((raw) => {
        const idx = parseInt(raw, 10);
        if (Number.isInteger(idx) && target.options[idx]) {
          target.options[idx].votes = (target.options[idx].votes || 0) + 1;
        }
      });
      cur.version = Date.now();
      await writeState(c, cur);
      return json(200, { ok: true, version: cur.version }, origin);
    } catch (e) {
      return json(e.code || 500, { error: e.message }, origin);
    }
  }

  if (method === 'DELETE' && seg[1] === 'state') {
    if (!isAdmin) return json(401, { error: '需要管理员权限' }, origin);
    try {
      const next = emptyState();
      await writeState(c, next);
      return json(200, { ok: true, version: next.version }, origin);
    } catch (e) {
      return json(e.code || 500, { error: e.message }, origin);
    }
  }

  return json(404, { error: 'not found' }, origin);
}

/* ---------------- SCF 入口 ---------------- */
function normalizeReq(event) {
  const headers = {};
  Object.keys(event.headers || {}).forEach((k) => { headers[k.toLowerCase()] = event.headers[k]; });
  let body = null;
  if (event.body) {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body;
    try { body = JSON.parse(raw); } catch (e) { body = null; }
  }
  const qs = event.queryStringParameters || {};
  const query = Object.keys(qs).length
    ? '?' + new URLSearchParams(qs).toString()
    : '';
  return {
    method: (event.httpMethod || event.method || 'GET').toUpperCase(),
    path: event.path || (event.requestContext && event.requestContext.path) || '/',
    query,
    headers,
    body,
    ip: (event.requestContext && event.requestContext.sourceIp)
      || headers['x-forwarded-for']
      || headers['x-real-ip']
      || ''
  };
}

exports.main_handler = async (event) => {
  try {
    return await handle(normalizeReq(event || {}));
  } catch (e) {
    console.error('[api] 未处理异常：', e);
    return json(500, { error: '服务器内部错误' }, (cfg().corsOrigin));
  }
};

/* ---------------- 本地调试：node backend/index.js ---------------- */
if (require.main === module) {
  const http = require('node:http');
  const PORT = Number(process.env.PORT || 9000);
  http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => {
      const event = {
        httpMethod: req.method,
        path: req.url.split('?')[0],
        queryStringParameters: Object.fromEntries(new URL(req.url, 'http://x').searchParams),
        headers: req.headers,
        body: Buffer.concat(chunks).toString('utf8'),
        isBase64Encoded: false,
        requestContext: { sourceIp: req.socket.remoteAddress || '' }
      };
      const out = await exports.main_handler(event);
      res.writeHead(out.statusCode, out.headers);
      res.end(out.body);
    });
  }).listen(PORT, () => {
    console.log(`[dev] 后端本地服务：http://localhost:${PORT}`);
    console.log('[dev] 健康检查：http://localhost:' + PORT + '/api/health');
  });
}
