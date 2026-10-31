# 牛肉 BEEF · 官方网站

一个零构建的前端站点，配一套 **EdgeOne Makers 云函数 + Blob 存储** 做数据持久化。
结构与栏目参考 The Slow Tide 官网，全站品牌改为 **牛肉 / BEEF**。

不连后端时也能跑：前端会自动降级为纯 `localStorage` 模式。

## 目录结构

```
beef-site/
├── index.html                 # 全站骨架（所有栏目在同一页，锚点导航）
├── package.json               # 依赖（@edgeone/pages-blob）+ npm run dev / genenv
├── .env.example               # 环境变量样例（复制为 .env 本地使用）
├── scripts/
│   ├── dev-server.mjs         # 本地开发服务器（静态 + /api 转发）
│   └── generate-env.mjs       # 读环境变量 → 生成 assets/js/env.js（仅静态配置用）
├── cloud-functions/           # ★ 后端（Makers 云函数，文件路径即路由）
│   └── api/
│       └── [[default]].js     #   /api/* 通配入口（onRequest → Response）
├── netlify.toml               # Netlify 部署配置（publish = 根目录）
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

## 部署到 EdgeOne Makers

项目已经是 Makers 期望的形态：**静态资源在仓库根目录，后端函数在 `cloud-functions/`**，一个仓库一次推送即可全栈发布。

```
cloud-functions/
└── api/
    └── [[default]].js     →  https://你的域名/api/*（通配，覆盖所有方法）
```

### 部署步骤

1. 把仓库推到 GitHub / Gitee / CNB
2. Makers 控制台 → 新建项目 → **导入 Git 仓库**
3. 构建配置：
   - 安装命令：`npm install`
   - 构建命令：留空（纯静态 + 云函数）
   - 输出目录：`.`（仓库根目录）
4. 在控制台「环境变量」里配置下面的变量，然后部署
5. 部署完成后访问 `https://你的域名/api/health` 验证

也可以不接 Git：控制台「直接上传」把整个项目目录打包上传即可。

### 环境变量

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `BEEF_ADMIN_PASSWORD` | ✅ | 管理员面板密码，只存在于服务端 |
| `ADMIN_TOKEN_SECRET` | ✅ | 登录凭证签名密钥，随机 32 位以上 |
| `BLOB_STORE` | | Blob 命名空间，默认 `beef-site`，首次请求自动创建 |
| `ADMIN_TOKEN_TTL` | | 登录有效期（秒），默认 43200 |
| `BEEF_DOMAIN` | | 绑定域名，会同步写进 `sitemap.xml` / `robots.txt` / `feed.xml` |
| `BEEF_QQ` / `BEEF_SERVER_ADDR` / … | | 站点静态配置，详见 `.env.example` |
| `STORAGE_DRIVER` | | 强制指定存储：`blob` / `cos` / `local` |
| `TENCENTCLOUD_SECRET_ID` / `KEY`、`COS_BUCKET`、`COS_REGION` | | 可选：改用腾讯云 COS 而非 Blob |

### 本地跑起来

```bash
npm install
npm run dev          # http://localhost:8080，数据落到 .data/state.json
```

`npm run dev` 起的是本地开发服务器：根目录当静态站点、`/api/*` 转给云函数，
不连 Blob，方便离线调试。想连真实 Blob 就设 `STORAGE_DRIVER=blob` 并配好项目凭据。

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

浏览器端的 JS 读不到服务器的环境变量，所以这里采用的方案是：
「**部署 / 容器启动时**由 `scripts/generate-env.mjs` 读取环境变量 → 生成 `assets/js/env.js` → 前端从 `window.__BEEF_ENV__` 读取」。

默认（`hash` 模式）脚本只会把密码的 `SHA-256(salt + 密码)` 摘要写进前端文件，
因此**公开源码里不存在明文密码**，前端 `Auth.verify()` 做摘要比对而不是字符串比对。
未设置 `BEEF_ADMIN_PASSWORD` 时管理员登录会被直接拒绝，没有任何内置默认密码。

> 注意：摘要校验依赖 Web Crypto，需通过 **HTTPS**（或 `localhost`）访问站点。
> 若必须明文下发（仅限本地调试），设置 `BEEF_ADMIN_PASSWORD_MODE=plain`。

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

## 后端与数据存储（EdgeOne Blob）

站点现在有真正的后端：**Makers Cloud Functions（Node.js 20）+ EdgeOne Blob 对象存储**。
整站数据以单个 JSON 存在 Blob 的 `<BLOB_STORE>/beef/data.json`，后端全部集中在一个文件里，
运行时唯一依赖是官方 SDK `@edgeone/pages-blob`（读不到时自动降级为本地文件，便于本地联调）。

```
浏览器 ──GET /api/state───────┐
       ──PUT /api/state/:key──▶ Cloud Function ──▶ Blob <store>/beef/data.json
       ──POST /api/vote───────┘
```

**数据不再只存在某一个浏览器里**：管理员的改动写入 Blob，所有访客下次打开都能看到。

> Blob 读取默认为最终一致；本项目因为要做「读-改-写」，已在 `getStore` 上统一开启
> `consistency: 'strong'`，避免刚写完就读到旧值。

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
