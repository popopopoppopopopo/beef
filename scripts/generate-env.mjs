#!/usr/bin/env node
/* ============================================================
 * 牛肉 BEEF · 环境变量注入脚本（零第三方依赖）
 *
 * 作用：读取环境变量（优先级 process.env > 项目根 .env），
 *       生成 assets/js/env.js 供前端 window.__BEEF_ENV__ 读取。
 *
 * 用法：
 *   node scripts/generate-env.mjs
 *   BEEF_ADMIN_PASSWORD=xxx node scripts/generate-env.mjs
 *
 * 说明：浏览器无法直接读取服务器进程的环境变量，
 *       因此本脚本在「部署时 / 容器启动时」把环境变量落成一个静态文件，
 *       这是纯静态站点使用环境变量的标准做法。
 * ============================================================ */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_FILE = join(ROOT, 'assets', 'js', 'env.js');
const DOMAIN_FILES = ['sitemap.xml', 'robots.txt', 'feed.xml'];

/* ------------------------------------------------------------
 * .env 解析（只支持 KEY=VALUE，够用且不引入依赖）
 * ------------------------------------------------------------ */
function parseDotEnv(text) {
  const out = {};
  text.split(/\r?\n/).forEach((raw) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const eq = line.indexOf('=');
    if (eq < 0) return;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    const quoted = (val[0] === '"' && val.endsWith('"')) || (val[0] === "'" && val.endsWith("'"));
    if (quoted) val = val.slice(1, -1);
    if (key) out[key] = val;
  });
  return out;
}

const fileEnv = existsSync(join(ROOT, '.env'))
  ? parseDotEnv(readFileSync(join(ROOT, '.env'), 'utf8'))
  : {};

/* 运行时环境变量优先：只取 BEEF_ 前缀且非空的值 */
const runtimeEnv = {};
Object.keys(process.env).forEach((k) => {
  if (k.startsWith('BEEF_')) {
    const v = process.env[k];
    if (v !== undefined && v !== '') runtimeEnv[k] = v;
  }
});

const ENV = { ...fileEnv, ...runtimeEnv };
const raw = (k) => (ENV[k] === undefined || ENV[k] === '' ? undefined : String(ENV[k]));

/* ------------------------------------------------------------
 * 普通站点配置
 * ------------------------------------------------------------ */
const SPEC = [
  ['BEEF_DOMAIN', 'domain', 'string'],
  ['BEEF_TITLE_SUFFIX', 'titleSuffix', 'string'],
  ['BEEF_BRAND', 'brand', 'string'],
  ['BEEF_BRAND_EN', 'brandEn', 'string'],
  ['BEEF_FULL_NAME', 'fullName', 'string'],
  ['BEEF_SLOGAN', 'slogan', 'string'],
  ['BEEF_DESCRIPTION', 'desc', 'string'],
  ['BEEF_SINCE', 'since', 'string'],
  ['BEEF_QQ', 'qq', 'string'],
  ['BEEF_SERVER_ADDR', 'serverAddr', 'string'],
  ['BEEF_SERVER_PORT', 'serverPort', 'string'],
  ['BEEF_EMAIL', 'email', 'string'],
  ['BEEF_REPO_URL', 'repo', 'string'],
  ['BEEF_APK_VERSION', 'apkVersion', 'string'],
  ['BEEF_APK_URL', 'apkUrl', 'string'],
  ['BEEF_SPONSOR_QR', 'sponsorQr', 'string'],
  ['BEEF_SERVER_ONLINE', 'serverOnline', 'bool'],
  ['BEEF_BETA_MODE', 'betaMode', 'bool'],
  /* 后端地址：EdgeOne 纯前端 + 独立后端时填 API 网关地址，
     例如 https://service-xxxx.gz.apigw.tencentcs.com/release/api */
  ['BEEF_API_BASE', 'apiBase', 'string']
];

const TRUE_SET = new Set(['1', 'true', 'yes', 'on']);
const FALSE_SET = new Set(['0', 'false', 'no', 'off']);

function toBool(v) {
  const s = String(v).trim().toLowerCase();
  if (TRUE_SET.has(s)) return true;
  if (FALSE_SET.has(s)) return false;
  return undefined;
}

const conf = {};
SPEC.forEach(([envKey, outKey, type]) => {
  const v = raw(envKey);
  if (v === undefined) return;
  const parsed = type === 'bool' ? toBool(v) : v;
  if (parsed === undefined) {
    console.warn(`[env] ${envKey} 的值无法识别，已忽略：${v}`);
    return;
  }
  conf[outKey] = parsed;
});

/* ------------------------------------------------------------
 * 凭据类配置（默认不向浏览器下发明文）
 * ------------------------------------------------------------ */
const warnings = [];
/* 默认 none：管理员登录一律走后端接口，密码不进入前端文件。
   只有纯静态托管（无后端）做本地降级校验时才用 hash / plain。 */
const mode = (raw('BEEF_ADMIN_PASSWORD_MODE') || 'none').toLowerCase();
const adminPwd = raw('BEEF_ADMIN_PASSWORD');

if (mode === 'none') {
  if (adminPwd) console.warn('[env] BEEF_ADMIN_PASSWORD 只用于服务端，不会写入前端文件（BEEF_ADMIN_PASSWORD_MODE=none）。');
} else if (adminPwd) {
  if (mode === 'plain') {
    warnings.push('BEEF_ADMIN_PASSWORD_MODE=plain：管理员密码将以明文写入前端文件，任何人查看源码即可获取，仅建议本地调试使用。');
    conf.adminAuth = { mode: 'plain', value: adminPwd };
  } else {
    const salt = raw('BEEF_ADMIN_PASSWORD_SALT') || `beef:${conf.domain || 'admin'}`;
    conf.adminAuth = {
      mode: 'hash',
      salt,
      hash: createHash('sha256').update(`${salt}:${adminPwd}`, 'utf8').digest('hex')
    };
  }
} else {
  warnings.push('未设置 BEEF_ADMIN_PASSWORD：管理员面板将禁止登录（前端不再内置任何默认密码）。');
}

/* 内测卡密：逗号 / 分号 / 换行分隔，留空表示不预置 */
const splitList = (v) =>
  v.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);

const betaKeys = raw('BEEF_BETA_KEYS');
if (betaKeys) conf.seedKeys = splitList(betaKeys).map((code) => ({ code, used: false }));

/* 兑换码：每行一条，格式 码|奖励|有效期，有效期可省略 */
const redeemCodes = raw('BEEF_REDEEM_CODES');
if (redeemCodes) {
  conf.seedCodes = redeemCodes
    .split(/[;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line, i) => {
      const [code, reward, expire] = line.split('|').map((s) => s.trim());
      if (!code) throw new Error(`BEEF_REDEEM_CODES 第 ${i + 1} 条缺少兑换码：${line}`);
      return { id: `env-c${i + 1}`, code, reward: reward || '礼包 ×1', expire: expire || '' };
    });
}

/* ------------------------------------------------------------
 * 写出 env.js
 * ------------------------------------------------------------ */
const banner = [
  '/* ============================================================',
  ' * 自动生成文件 · 请勿手动修改，也不要提交含真实凭据的版本。',
  ' * 由 scripts/generate-env.mjs 依据环境变量生成。',
  ' * 生成时间：' + new Date().toISOString(),
  ' * ============================================================ */'
].join('\n');

writeFileSync(
  OUT_FILE,
  `${banner}\nwindow.__BEEF_ENV__ = Object.freeze(${JSON.stringify(conf, null, 2)});\n`,
  'utf8'
);

/* ------------------------------------------------------------
 * 同步域名到 sitemap / robots / feed（可选）
 * ------------------------------------------------------------ */
if (conf.domain) {
  DOMAIN_FILES.forEach((f) => {
    const p = join(ROOT, f);
    if (!existsSync(p)) return;
    const before = readFileSync(p, 'utf8');
    const after = before.replace(/beef\.netlify\.app/g, conf.domain);
    if (after !== before) writeFileSync(p, after, 'utf8');
  });
}

/* ------------------------------------------------------------
 * 输出摘要
 * ------------------------------------------------------------ */
const safeKeys = Object.keys(conf);
console.log(`[env] 已生成 assets/js/env.js，共 ${safeKeys.length} 项配置：${safeKeys.join(', ') || '（无）'}`);
if (conf.adminAuth) {
  console.log(`[env] 管理员校验方式：${conf.adminAuth.mode === 'hash' ? 'SHA-256 摘要（源码中不含明文密码）' : '明文（不安全）'}`);
}
if (conf.domain) console.log(`[env] 域名已同步到 sitemap.xml / robots.txt / feed.xml：${conf.domain}`);
warnings.forEach((w) => console.warn(`[env] 提示：${w}`));
