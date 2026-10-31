/* ============================================================
 * 牛肉 BEEF · API（EdgeOne Makers Cloud Functions）
 *
 * 路由：文件路径即路由
 *   cloud-functions/api/[[default]].js  →  /api/*（通配，含所有方法）
 *
 * 存储：EdgeOne Blob（@edgeone/pages-blob）
 *   整站数据以单个 JSON 存在 Blob 的 <store>/beef/data.json
 *   未安装 SDK 时（本地开发）自动降级为本地文件 .data/state.json
 *
 * 环境变量全部在 Makers 控制台「环境变量」里配置，
 * 代码中一律从 context.env / process.env 读取，不写死任何凭据。
 * ============================================================ */

/* ---------------- 配置 ---------------- */
const DEFAULT_SITE_FIELDS = [
  'brand', 'brandEn', 'fullName', 'domain', 'slogan', 'desc', 'since',
  'qq', 'serverAddr', 'serverPort', 'email', 'repo',
  'apkVersion', 'apkUrl', 'sponsorQr', 'serverOnline', 'betaMode'
];
const KEY_RE = /^[A-Za-z0-9_-]{1,40}$/;
const STATE_KEY = 'beef/data.json';

let CFG = null;

function pick(env, keys, def) {
  for (const k of keys) {
    if (env[k] !== undefined && env[k] !== null && env[k] !== '') return String(env[k]);
  }
  return def;
}
function toBool(v, def) {
  if (v === undefined || v === null || v === '') return def;
  const s = String(v).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(s)) return true;
  if (['0', 'false', 'no', 'off'].includes(s)) return false;
  return def;
}
function toNum(v, def) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

function buildCfg(env) {
  const cfg = {
    /* Blob 命名空间（首次调用自动创建） */
    blobStore: pick(env, ['BLOB_STORE'], 'beef-site'),
    /* 可选：腾讯云 COS（配置了就优先用 COS） */
    cosSecretId: pick(env, ['TENCENTCLOUD_SECRET_ID', 'COS_SECRET_ID'], ''),
    cosSecretKey: pick(env, ['TENCENTCLOUD_SECRET_KEY', 'COS_SECRET_KEY'], ''),
    cosBucket: pick(env, ['COS_BUCKET'], ''),
    cosRegion: pick(env, ['COS_REGION'], ''),
    /* 本地开发兜底：未安装 Blob SDK 时写到这个文件 */
    localFile: pick(env, ['LOCAL_STATE_FILE'], '.data/state.json'),
    /* 管理员密码 */
    adminPassword: pick(env, ['BEEF_ADMIN_PASSWORD', 'ADMIN_PASSWORD'], ''),
    tokenSecret: pick(env, ['ADMIN_TOKEN_SECRET'], ''),
    tokenTTL: toNum(pick(env, ['ADMIN_TOKEN_TTL'], ''), 12 * 3600),
    /* 限制 */
    maxItemBytes: toNum(pick(env, ['MAX_ITEM_BYTES'], ''), 256 * 1024),
    maxStateBytes: toNum(pick(env, ['MAX_STATE_BYTES'], ''), 32 * 1024 * 1024),
    anonWritable: (pick(env, ['ANON_WRITABLE_KEYS'], 'posts,chat') || '')
      .split(',').map((s) => s.trim()).filter(Boolean),
    anonMaxItems: toNum(pick(env, ['ANON_MAX_ITEMS'], ''), 500),
    anonMaxAddPerReq: toNum(pick(env, ['ANON_MAX_ADD_PER_REQ'], ''), 5),
    rateLimitPerMin: toNum(pick(env, ['RATE_LIMIT_PER_MIN'], ''), 30)
  };
  cfg.storageKind = pick(env, ['STORAGE_DRIVER'], '')
    || (cfg.cosSecretId && cfg.cosSecretKey && cfg.cosBucket && cfg.cosRegion ? 'cos' : 'blob');
  return cfg;
}

function getCfg(env) {
  if (!CFG) CFG = buildCfg(Object.assign({}, process.env, env));
  return CFG;
}

/* ---------------- 工具 ---------------- */
function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }, headers || {})
  });
}

const SECURITY = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(secret, text) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
  return b64url(sig);
}

async function safeEqualStr(a, b) {
  const ab = new TextEncoder().encode(String(a));
  const bb = new TextEncoder().encode(String(b));
  // 长度不同也要走一次比较，避免时序差异
  const max = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < max; i++) diff |= (ab[i] || 0) ^ (bb[i] || 0);
  return diff === 0;
}

/* ---------------- 存储 ---------------- */
let blobMod;
async function loadBlob() {
  if (blobMod !== undefined) return blobMod;
  try {
    blobMod = await import('@edgeone/pages-blob');
  } catch (e) {
    blobMod = null;
    console.warn('[storage] 未找到 @edgeone/pages-blob，降级为本地文件存储');
  }
  return blobMod;
}

async function readState(cfg) {
  if (cfg.storageKind === 'cos') {
    // 腾讯云 COS 官方 SDK（如已安装）
    try {
      const COS = (await import('cos-nodejs-sdk-v5')).default;
      const cos = new COS({ SecretId: cfg.cosSecretId, SecretKey: cfg.cosSecretKey });
      return new Promise((resolve, reject) => {
        cos.getObject({ Bucket: cfg.cosBucket, Region: cfg.cosRegion, Key: STATE_KEY }, (err, data) => {
          if (err) {
            if (err.statusCode === 404 || err.code === 'NoSuchKey') return resolve(null);
            return reject(new Error('COS 读取失败：' + (err.message || JSON.stringify(err))));
          }
          resolve(data && data.Body ? data.Body.toString('utf8') : null);
        });
      });
    } catch (e) {
      throw new Error('COS 驱动不可用：' + e.message);
    }
  }
  const mod = await loadBlob();
  if (mod && mod.getStore) {
    const store = mod.getStore({ name: cfg.blobStore, consistency: 'strong' });
    const obj = await store.getJSON(STATE_KEY);
    return obj;
  }
  const fs = await import('node:fs/promises');
  try {
    return JSON.parse(await fs.readFile(cfg.localFile, 'utf8'));
  } catch (e) {
    return null;
  }
}

async function writeState(cfg, state) {
  const text = JSON.stringify(state);
  if (Buffer.byteLength(text, 'utf8') > cfg.maxStateBytes) {
    const err = new Error(`数据总量超过上限 ${Math.floor(cfg.maxStateBytes / 1024 / 1024)}MB`);
    err.code = 413;
    throw err;
  }
  if (cfg.storageKind === 'cos') {
    try {
      const COS = (await import('cos-nodejs-sdk-v5')).default;
      const cos = new COS({ SecretId: cfg.cosSecretId, SecretKey: cfg.cosSecretKey });
      await new Promise((resolve, reject) => {
        cos.putObject({
          Bucket: cfg.cosBucket, Region: cfg.cosRegion, Key: STATE_KEY,
          Body: Buffer.from(text, 'utf8'),
          ContentType: 'application/json; charset=utf-8'
        }, (e) => (e ? reject(new Error('COS 写入失败：' + e.message)) : resolve()));
      });
      return;
    } catch (e) {
      throw new Error('COS 驱动不可用：' + e.message);
    }
  }
  const mod = await loadBlob();
  if (mod && mod.getStore) {
    const store = mod.getStore({ name: cfg.blobStore, consistency: 'strong' });
    await store.setJSON(STATE_KEY, state);
    return;
  }
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  await fs.mkdir(path.dirname(path.resolve(cfg.localFile)), { recursive: true });
  await fs.writeFile(path.resolve(cfg.localFile), text, 'utf8');
}

/* ---------------- 鉴权 ---------------- */
async function issueToken(cfg) {
  const payload = { exp: Math.floor(Date.now() / 1000) + cfg.tokenTTL, rnd: Math.random().toString(36).slice(2) };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${await hmac(cfg.tokenSecret, body)}`;
}

async function verifyToken(cfg, token) {
  if (!token || typeof token !== 'string' || token.indexOf('.') < 0) return false;
  const i = token.indexOf('.');
  const body = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expect = await hmac(cfg.tokenSecret, body);
  if (sig.length !== expect.length) return false;
  if (!await safeEqualStr(sig, expect)) return false;
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
function validItem(cfg, item) {
  return !!item && typeof item === 'object' && !Array.isArray(item)
    && Buffer.byteLength(JSON.stringify(item), 'utf8') <= cfg.maxItemBytes;
}
function emptyState() {
  return { version: Date.now(), site: {}, data: {} };
}
function normalize(raw) {
  if (!raw || typeof raw !== 'object') return emptyState();
  return {
    version: Number(raw.version) || Date.now(),
    site: (raw.site && typeof raw.site === 'object') ? raw.site : {},
    data: (raw.data && typeof raw.data === 'object') ? raw.data : {}
  };
}
/* 匿名写：只能追加/更新，不能删掉服务端已有条目 */
function mergeAppend(cfg, current, incoming) {
  const cur = Array.isArray(current) ? current : [];
  const inc = Array.isArray(incoming) ? incoming : [];
  const clean = inc.filter((i) => validItem(cfg, i));
  const curIds = new Set(cur.map(idOf).filter(Boolean));
  const added = clean.filter((i) => {
    const id = idOf(i);
    return !id || !curIds.has(id);
  });
  if (added.length > cfg.anonMaxAddPerReq) {
    const err = new Error(`单次最多新增 ${cfg.anonMaxAddPerReq} 条`);
    err.code = 413;
    throw err;
  }
  let next = cur.concat(added);
  if (next.length > cfg.anonMaxItems) next = next.slice(next.length - cfg.anonMaxItems);
  return next;
}

/* ---------------- 限流 ---------------- */
const hits = new Map();
function rateOk(cfg, ip) {
  const now = Date.now();
  const rec = hits.get(ip) || { n: 0, t: now };
  if (now - rec.t > 60000) { rec.n = 0; rec.t = now; }
  rec.n++;
  hits.set(ip, rec);
  if (hits.size > 5000) hits.clear();
  return rec.n <= cfg.rateLimitPerMin;
}

/* ---------------- 路由 ---------------- */
async function route({ request, env, clientIp }) {
  const cfg = getCfg(env);
  const url = new URL(request.url);
  const seg = url.pathname.replace(/^\/+|\/+$/g, '').split('/'); // ['api', ...]
  const token = request.headers.get('x-admin-token')
    || (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const isAdmin = await verifyToken(cfg, token);
  const method = request.method.toUpperCase();

  if (seg[1] === 'health') {
    return json({
      ok: true,
      storage: cfg.storageKind,
      store: cfg.storageKind === 'blob' ? cfg.blobStore : undefined,
      adminEnabled: !!cfg.adminPassword,
      weakSecret: !cfg.tokenSecret
    }, 200, SECURITY);
  }

  if (method === 'POST' && seg[1] === 'login') {
    if (!rateOk(cfg, clientIp)) return json({ error: '尝试过于频繁，请稍后再试' }, 429, SECURITY);
    let body = {};
    try { body = await request.json(); } catch (e) { return json({ error: '请求格式不正确' }, 400, SECURITY); }
    if (!cfg.adminPassword) return json({ error: '服务端未配置 BEEF_ADMIN_PASSWORD' }, 401, SECURITY);
    if (!(await safeEqualStr(body.password || '', cfg.adminPassword))) {
      return json({ error: '密码错误' }, 401, SECURITY);
    }
    return json({ token: await issueToken(cfg), expiresIn: cfg.tokenTTL }, 200, SECURITY);
  }

  if (method === 'GET' && seg[1] === 'state' && !seg[2]) {
    try {
      const st = normalize(await readState(cfg));
      return json({ version: st.version, site: st.site, data: st.data }, 200, SECURITY);
    } catch (e) {
      console.error('[api] 读取失败：', e.message);
      return json({ version: 0, site: {}, data: {}, offline: true }, 200, SECURITY);
    }
  }

  /* PUT /api/state/:key */
  if (method === 'PUT' && seg[1] === 'state' && seg[2]) {
    const key = decodeURIComponent(seg[2]);
    if (!rateOk(cfg, clientIp)) return json({ error: '操作过于频繁，请稍后再试' }, 429, SECURITY);
    let body;
    try { body = await request.json(); } catch (e) { return json({ error: '请求格式不正确' }, 400, SECURITY); }
    if (!Array.isArray(body.list)) return json({ error: '列表格式不正确' }, 400, SECURITY);
    if (!KEY_RE.test(key)) return json({ error: '非法的栏目名：' + key }, 400, SECURITY);
    if (!isAdmin && cfg.anonWritable.indexOf(key) < 0) return json({ error: '需要管理员权限' }, 401, SECURITY);

    try {
      const cur = normalize(await readState(cfg));
      if (!isAdmin) {
        cur.data[key] = mergeAppend(cfg, cur.data[key], body.list);
      } else {
        if (!body.list.every((i) => validItem(cfg, i))) {
          const err = new Error('存在超过大小上限的内容');
          err.code = 413;
          throw err;
        }
        cur.data[key] = body.list;
      }
      cur.version = Date.now();
      await writeState(cfg, cur);
      return json({ ok: true, version: cur.version, key: key, count: (cur.data[key] || []).length }, 200, SECURITY);
    } catch (e) {
      console.warn('[api] 写入失败：', e.message);
      return json({ error: e.message }, e.code || 500, SECURITY);
    }
  }

  /* PUT /api/site */
  if (method === 'PUT' && seg[1] === 'site') {
    if (!isAdmin) return json({ error: '需要管理员权限' }, 401, SECURITY);
    let patch;
    try { patch = await request.json(); } catch (e) { return json({ error: '请求格式不正确' }, 400, SECURITY); }
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      return json({ error: '配置格式不正确' }, 400, SECURITY);
    }
    try {
      const cur = normalize(await readState(cfg));
      Object.keys(patch).forEach((k) => {
        if (DEFAULT_SITE_FIELDS.indexOf(k) < 0) return;
        const v = patch[k];
        if (typeof v === 'string' || typeof v === 'boolean' || typeof v === 'number') cur.site[k] = v;
      });
      cur.version = Date.now();
      await writeState(cfg, cur);
      return json({ ok: true, version: cur.version, site: cur.site }, 200, SECURITY);
    } catch (e) {
      return json({ error: e.message }, e.code || 500, SECURITY);
    }
  }

  /* POST /api/vote */
  if (method === 'POST' && seg[1] === 'vote') {
    if (!rateOk(cfg, clientIp)) return json({ error: '操作过于频繁，请稍后再试' }, 429, SECURITY);
    let body = {};
    try { body = await request.json(); } catch (e) { return json({ error: '请求格式不正确' }, 400, SECURITY); }
    if (!body.id) return json({ error: '缺少投票 ID' }, 400, SECURITY);
    const idxs = Array.isArray(body.idxs) ? body.idxs.slice(0, 20) : [];
    try {
      const cur = normalize(await readState(cfg));
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
      await writeState(cfg, cur);
      return json({ ok: true, version: cur.version }, 200, SECURITY);
    } catch (e) {
      return json({ error: e.message }, e.code || 500, SECURITY);
    }
  }

  /* DELETE /api/state —— 清空 */
  if (method === 'DELETE' && seg[1] === 'state') {
    if (!isAdmin) return json({ error: '需要管理员权限' }, 401, SECURITY);
    try {
      const next = emptyState();
      await writeState(cfg, next);
      return json({ ok: true, version: next.version }, 200, SECURITY);
    } catch (e) {
      return json({ error: e.message }, e.code || 500, SECURITY);
    }
  }

  return json({ error: 'not found' }, 404, SECURITY);
}

/* ---------------- 入口 ---------------- */
export async function onRequest(context) {
  const env = Object.assign({}, process.env || {}, context && context.env ? context.env : {});
  const request = context && context.request;
  const clientIp = (context && context.clientIp)
    || (request && request.headers.get('x-forwarded-for'))
    || '';

  try {
    return await route({ request, env, clientIp });
  } catch (e) {
    console.error('[api] 未处理异常：', e);
    return json({ error: '服务器内部错误' }, 500, SECURITY);
  }
}

export default onRequest;
