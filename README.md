# 牛肉 BEEF · 官方网站

**前端跑在 EdgeOne（纯静态，不含任何后端代码与密钥）；后端跑在腾讯云 SCF 云函数（代码在 GitHub，密钥全部来自 GitHub Secrets）。**

结构与栏目参考 The Slow Tide 官网，全站品牌改为 **牛肉 / BEEF**。
后端不可用时前端自动降级为纯 `localStorage` 模式，页面照常能用。

## 目录结构

```
beef-site/
├── index.html                 # 全站骨架（所有栏目在同一页，锚点导航）
├── package.json               # npm run genenv / npm run backend 等脚本
├── .env.example               # 环境变量总表（Secrets / Variables / 前端三档）
├── edgeone.json               # ★ 前端部署配置：无构建、根目录即产物、无后端
├── .github/workflows/
│   └── deploy.yml             # ★ 一条流水线：前端 → EdgeOne，后端 → SCF
├── backend/                   # ★ 后端（腾讯云 SCF 云函数）
│   ├── index.js               #   入口 index.main_handler + 本地调试服务
│   └── package.json           #   依赖：腾讯云官方 COS SDK
├── scripts/
│   ├── generate-env.mjs       #   读环境变量 → 生成 assets/js/env.js
│   ├── scf-env.mjs            #   生成注入云函数的环境变量 JSON
│   └── deploy-scf.sh          #   打包并部署后端到 SCF
├── netlify.toml               # Netlify 部署配置（可选备用）
├── feed.xml  robots.txt  sitemap.xml
└── assets/
    ├── css/style.css          # 液态玻璃主题
    ├── img/logo.svg
    └── js/
        ├── env.js             # ★ 运行时配置（自动生成，勿手改、勿提交）
        ├── config.js          # 站点配置 + 初始内容（从 env.js 取值）
        ├── core.js            # 工具函数、localStorage、Toast、弹层
        ├── glass.js           # 液态玻璃实验室
        ├── sections.js        # 各栏目渲染
        ├── admin.js           # 管理员面板（纯前端）
        └── main.js            # 启动、导航、搜索、主题
```

## 栏目

首页 · 公告 · 动态 · 商店 · 投票 · 便捷工具 · 服务器工具 · 玩家公约 · 赛事活动 · 兑换码 · 服务器赞助 · 聊天室 · 下载

## 部署（前端 → EdgeOne，后端 → 腾讯云 SCF）

一次 `git push` 触发 `.github/workflows/deploy.yml`，出两个互不相干的产物：

```
GitHub 仓库
   │
   ├── job frontend ──▶ dist/（只有 index.html + assets，无任何后端代码）
   │                      │  edgeone makers deploy ./dist
   │                      ▼
   │                  EdgeOne Makers（纯前端静态托管）
   │
   └── job backend  ──▶ function.zip（backend/ + node_modules）
                          │  tccli scf UpdateFunctionCode
                          ▼
                      腾讯云 SCF 云函数 ──▶ COS / beef/data.json

浏览器 ──▶ EdgeOne 拿页面 ──▶ 按 BEEF_API_BASE 跨域调 SCF
```

前端产物会经过一道**安全检查**（不含 `backend/`、不含任何密钥字样），通过后才会部署。

### 一次性准备（只需做一次）

1. **EdgeOne**：新建「**直接上传**」类型的项目，拿一个 API Token。
   CLI 部署要求项目是直接上传型；Git 导入型项目请新建一个，或把自动部署关掉。
2. **SCF**：控制台新建云函数，运行时 `Nodejs18+`，入口 `index.main_handler`，
   再给它挂一个 **API 网关触发器**（路径 `/api/{param+}`，放行 GET/POST/PUT/DELETE/OPTIONS）。
   把网关地址填到 `BEEF_API_BASE`，末尾要带 `/api`。
3. **COS**：建私有桶，CAM 子账号只给这一个桶的读写权限（也可省，退化成本地文件）。
4. **GitHub**：Settings → Secrets and variables → Actions，按 `.env.example` 的 A/B 两档填好。

之后每次推 `main` 分支就自动部署，改密钥只需改 Secrets 再跑一次 workflow。

### Secrets / Variables 对照

| 类别 | 名称 | 去向 |
| --- | --- | --- |
| Secret | `EDGEONE_API_TOKEN` | GitHub Actions（部署前端） |
| Secret | `TENCENTCLOUD_SECRET_ID` / `KEY` | Actions 部署 + 云函数读 COS |
| Secret | `BEEF_ADMIN_PASSWORD` | 仅云函数 |
| Secret | `ADMIN_TOKEN_SECRET` | 仅云函数 |
| Variable | `EDGEONE_PROJECT` | Actions |
| Variable | `SCF_REGION` / `SCF_FUNCTION_NAME` | Actions |
| Variable | `BEEF_API_BASE` | 前端 `env.js`（告诉页面后端在哪） |
| Variable | `CORS_ORIGIN` | 仅云函数（允许的前端域名） |
| Variable | `COS_BUCKET` / `COS_REGION` / `COS_KEY` | 仅云函数 |
| Variable | `BEEF_DOMAIN` / `BEEF_QQ` / `BEEF_SERVER_ADDR` / … | 前端 `env.js` + 云函数 |

**前端文件里永远不会有密码**：`BEEF_ADMIN_PASSWORD_MODE` 默认 `none`，
管理员登录一律走 `POST /api/login`，比对发生在云函数里。

### 本地跑起来

```bash
npm run genenv                      # 前端：生成 assets/js/env.js
npm run backend:install             # 后端：装 COS SDK
BEEF_ADMIN_PASSWORD=dev-pass ADMIN_TOKEN_SECRET=dev-secret npm run backend
# http://localhost:9000/api/health
```

后端本地默认把数据写到 `.data/state.json`（未配 COS 时），不联网也能调。
前端直接用浏览器打开 `index.html` 即可，配了 `BEEF_API_BASE` 就会连后端。

## 部署到 Netlify（两种方式）

### 方式 A：拖拽（最快）
1. 打开 https://app.netlify.com/drop
2. 把 **`beef-site` 整个文件夹**拖进去
3. 等待几秒即可拿到 `https://xxx.netlify.app`

### 方式 B：Git 仓库
1. 把 `beef-site` 推到 GitHub / GitLab
2. Netlify → **Add new site → Import an existing project**
3. Build command 填 `npm run genenv`，Publish directory 填 `.`
4. 在 **Site configuration → Environment variables** 里配置 `BEEF_*` 变量，然后 Deploy

> 绑定自定义域名后，设置 `BEEF_DOMAIN=你的域名` 重新部署即可，`sitemap.xml` / `robots.txt` / `feed.xml` 会自动同步。

## 需要你改的地方（全部走环境变量）

站点里已经不再写死任何密码与凭据，改配置只需要改环境变量，不用动代码。

| 环境变量 | 对应配置 | 说明 |
| --- | --- | --- |
| `BEEF_DOMAIN` | `domain` | 绑定域名，会同步写入 `sitemap.xml` / `robots.txt` / `feed.xml` |
| `BEEF_BRAND` / `BEEF_BRAND_EN` | `brand` / `brandEn` | 品牌名（默认 牛肉 / BEEF） |
| `BEEF_QQ` | `qq` | QQ 交流群号 |
| `BEEF_SERVER_ADDR` / `BEEF_SERVER_PORT` | `serverAddr` / `serverPort` | 服务器地址 |
| `BEEF_SPONSOR_QR` | `sponsorQr` | 赞助收款二维码图片地址（留空显示占位） |
| `BEEF_APK_URL` / `BEEF_APK_VERSION` | `apkUrl` / `apkVersion` | 客户端下载 |
| `BEEF_REPO_URL` | `repo` | 开源仓库地址 |
| `BEEF_SERVER_ONLINE` | `serverOnline` | `true` / `false` |
| `BEEF_BETA_MODE` | `betaMode` | 内测模式：发动态需要卡密 |
| **`BEEF_ADMIN_PASSWORD`** | 管理员面板密码 | **必填**，见下方「管理员密码」 |
| `BEEF_ADMIN_PASSWORD_MODE` | `hash`（默认）/ `plain` | 建议保持 `hash` |
| `BEEF_ADMIN_PASSWORD_SALT` | 摘要盐值 | 可选，换了需重新生成 |
| `BEEF_BETA_KEYS` | 初始内测卡密 | 逗号 / 分号 / 换行分隔 |
| `BEEF_REDEEM_CODES` | 初始兑换码 | `码\|奖励\|有效期`，多条用 `;` 或换行 |

`assets/js/config.js` 的 `SEED` 里是所有栏目的初始内容（公告、动态、团队、赛事、物价、商店、公约…），直接改数组即可；其中卡密与兑换码可被上面两个环境变量覆盖。

### 管理员密码为何不再写在源码里

浏览器端的 JS 读不到服务器的环境变量，所以分两层处理：

- **站点信息**（域名 / QQ / 服务器地址…）：由 `scripts/generate-env.mjs` 在 GitHub Actions 里
  读取 Variables → 生成 `assets/js/env.js` → 前端从 `window.__BEEF_ENV__` 读
- **管理员密码**：**不进前端**。前端把密码 `POST /api/login` 发给 SCF，
  由云函数拿自己的环境变量做恒定时间比对，通过则返回签名 token

默认 `BEEF_ADMIN_PASSWORD_MODE=none`，即**不向前端下发任何形式的密码**（连摘要也不给）。
只有在完全无后端的纯静态部署下，才设成 `hash`（下发 SHA-256 摘要做本地降级校验）或 `plain`（明文，仅供调试）。
未设置 `BEEF_ADMIN_PASSWORD` 时管理员登录会被直接拒绝，没有任何内置默认密码。

## 管理员入口

三种进法（任选）：

1. 顶栏右上角 **🔒 管理** 按钮（手机端在 ☰ 菜单里）
2. 直接访问 `https://你的域名/#admin`
3. 页脚「管理」链接，或 `服务器工具 → 管理`

- 密码由环境变量 `BEEF_ADMIN_PASSWORD` 提供（源码中无任何默认密码）
- 登录框可勾选 **在这台设备上保持登录**，之后打开站点自动处于管理员态
- 关闭弹层会自动清掉 `#admin`，刷新不会再弹

### 登录后能管的东西（共 21 个模块）

| 分类 | 模块 |
| --- | --- |
| 内容 | 首页特色、公告、动态、服务器历史、管理团队、策划路线 |
| 运营 | 商店、投票、兑换码、内测卡密、赛事、赛事回放、赞助、玩家公约 |
| 工具 | 物价、禁用物品、任务、聊天记录 |
| 站点 | 首页配置要求、服务器设置（名称/地址/QQ/状态/内测模式） |
| 数据 | 访问统计（PV/UV/趋势/设备占比）、导出 JSON、导入 JSON、重置初始内容 |

每个列表都支持新增、编辑、上移调整顺序、删除；改动立即反映到前台。

## 后端与数据存储（SCF + COS）

后端是一个 **腾讯云 SCF 云函数**，代码在 `backend/`（单文件，约 400 行），
整站数据以单个 JSON 存在 **COS** 的 `<Bucket>/beef/data.json`。

```
浏览器 ──GET /api/state───────┐
       ──PUT /api/state/:key──▶ SCF 云函数 ──▶ COS bucket / beef/data.json
       ──POST /api/vote───────┘
```

**数据不再只存在某一个浏览器里**：管理员的改动写入 COS，所有访客下次打开都能看到。

- 未配置 `COS_BUCKET` / `COS_REGION` 时自动降级为本地文件，方便本地联调（线上请务必配好）
- 唯一依赖是腾讯云官方 SDK `cos-nodejs-sdk-v5`
- 前端与后端不同源，靠 `CORS_ORIGIN` 控制允许的来源，预检 `OPTIONS` 由函数直接返回 204

### 接口一览

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/health` | 公开 | 健康检查，返回存储类型与目标 |
| GET | `/api/state` | 公开 | 拉取全量数据（栏目数据 + 站点配置） |
| POST | `/api/login` | 公开 | 用 `BEEF_ADMIN_PASSWORD` 换临时凭证 |
| PUT | `/api/state/:key` | 见下 | 写某个栏目；`posts` / `chat` 匿名可写（追加语义） |
| PUT | `/api/site` | 仅管理员 | 覆盖站点字段（`qq` / `serverAddr` / `betaMode`…） |
| POST | `/api/vote` | 公开 | 投票，票数在服务端自增 |
| DELETE | `/api/state` | 仅管理员 | 清空全部数据 |

### 权限与安全

- **管理员密码只存在于服务端环境变量** `BEEF_ADMIN_PASSWORD`，前端永远拿不到，也不再有摘要泄漏问题
- 登录后拿到 HMAC-SHA256 签名的 token（默认 12 小时有效），密钥取自 `ADMIN_TOKEN_SECRET`
- 除 `posts` / `chat` 以外的栏目一律需要 token 才能写；匿名写采用**追加语义**：只能新增或改自己那条，删不掉服务端已有内容
- 匿名请求有频次限制，单次新增条数、单条大小、总体积均有上限
- 站点配置字段走白名单，非法栏目名、非数组、超限内容一律拒绝
- 密钥与口令只来自云端环境变量，代码里没有任何凭据；`.env` 已在 `.gitignore` 中，不要上传

### 前端如何接进来

- `assets/js/api.js`：封装接口调用，并在 `Store.save/reset` 上挂了回推钩子（防抖 700ms）
- 渲染逻辑仍走 `localStorage` 并保持同步，因此 `sections.js` / `admin.js` 几乎没动
- 启动时先尝试 1.5s 内拉取远端数据；拉不到就先用本地缓存渲染，到位后自动重绘
- 后端不可用时自动降级为本地模式，页面照常使用（面板会提示「本地模式」）

> 仍为本地数据的部分：访问统计（PV/UV）、点赞、我的投票记录、反馈留言、液态玻璃主题偏好。
> 投票计数本身是服务端累加的，只是「我投过了」这个标记存在本地。

## 液态玻璃实验室

- 背景壁纸：默认 / 极光 / 日落 / 薄荷 / 赛博 / 森林 / 海洋 / 樱花 / 纯白 / 透明 / 自定义
- 强度预设：柔和 / 适中 / 强烈
- UI 透明度、阴影扩展、光效强度、偏移
- 拖动模式：网格排序 / 自由摆放
- 选项：玻璃效果 / 性能优先 / 深色玻璃
- 随机主题、重置默认、**生成分享码**（用 `?glass=分享码` 链接可复现同一套主题）
- 内置 FPS / 帧时间 / 渲染负载监测

## 浏览器支持

Chrome / Edge / Safari / Firefox 最新版。`backdrop-filter` 在旧浏览器会自动降级为半透明实色。
