#!/usr/bin/env bash
# ============================================================
# 部署后端到腾讯云 SCF（由 GitHub Actions 调用）
#
# 前置：控制台已建好一次函数（运行时 Nodejs18+，入口 index.main_handler）
# 本脚本只做两件事：更新代码包、更新环境变量
#
# 需要的环境变量（Actions 里从 Secrets / Variables 注入）：
#   TENCENTCLOUD_SECRET_ID / TENCENTCLOUD_SECRET_KEY  腾讯云密钥（Secrets）
#   SCF_REGION              例如 ap-guangzhou
#   SCF_FUNCTION_NAME       例如 beef-api
#   BEEF_ADMIN_PASSWORD     管理员密码（Secrets）
#   ADMIN_TOKEN_SECRET      登录凭证签名密钥（Secrets）
#   COS_*                   COS 存储配置（配置齐全才启用 COS，否则走本地文件）
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

for v in TENCENTCLOUD_SECRET_ID TENCENTCLOUD_SECRET_KEY SCF_REGION SCF_FUNCTION_NAME; do
  if [ -z "${!v:-}" ]; then echo "缺少环境变量：$v" >&2; exit 1; fi
done

ZIP="function.zip"
rm -f "$ZIP"

echo "==> 打包后端（含 node_modules）"
( cd backend && zip -qr "../$ZIP" . -x '*.git*' '*.DS_Store' )
echo "    包大小：$(du -h "$ZIP" | cut -f1)"

echo "==> 更新函数代码"
tccli scf UpdateFunctionCode \
  --Region "$SCF_REGION" \
  --FunctionName "$SCF_FUNCTION_NAME" \
  --Handler index.main_handler \
  --ZipFile "fileb://$ZIP"

echo "==> 更新函数环境变量"
VARS="$(node scripts/scf-env.mjs)"
tccli scf UpdateFunctionConfiguration \
  --Region "$SCF_REGION" \
  --FunctionName "$SCF_FUNCTION_NAME" \
  --Environment "$VARS"

echo "==> 完成：$SCF_FUNCTION_NAME（$SCF_REGION）"
