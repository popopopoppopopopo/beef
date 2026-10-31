#!/usr/bin/env node
/* ============================================================
 * 生成 SCF 函数的环境变量（供 tccli 使用）
 *
 *   node scripts/scf-env.mjs > vars.json
 *
 * 只读下面这份白名单，避免把 CI 里的无关变量（含 GitHub 内置变量）带进云函数。
 * ============================================================ */
const ALLOW = [
  /* 管理员与凭证 */
  'BEEF_ADMIN_PASSWORD',
  'ADMIN_TOKEN_SECRET',
  'ADMIN_TOKEN_TTL',
  /* 腾讯云 COS 存储 */
  'TENCENTCLOUD_SECRET_ID',
  'TENCENTCLOUD_SECRET_KEY',
  'COS_BUCKET',
  'COS_REGION',
  'COS_KEY',
  /* 跨域与限制 */
  'CORS_ORIGIN',
  'ANON_WRITABLE_KEYS',
  'ANON_MAX_ITEMS',
  'ANON_MAX_ADD_PER_REQ',
  'RATE_LIMIT_PER_MIN',
  'MAX_ITEM_BYTES',
  'MAX_STATE_BYTES',
  /* 站点（后端 /api/site 覆盖用） */
  'BEEF_DOMAIN',
  'BEEF_QQ',
  'BEEF_SERVER_ADDR',
  'BEEF_SERVER_PORT',
  'BEEF_SERVER_ONLINE',
  'BEEF_BETA_MODE'
];

const variables = ALLOW
  .filter((k) => process.env[k] !== undefined && process.env[k] !== '')
  .map((k) => ({ Key: k, Value: String(process.env[k]) }));

process.stdout.write(JSON.stringify({ Variables: variables }));
