/* ============================================================
 * 牛肉 BEEF · 站点配置 + 初始内容
 *
 * 站点信息（域名 / QQ / 服务器地址…）与凭据（管理员密码 / 卡密 / 兑换码）
 * 一律不再写死在本文件，改为从 assets/js/env.js 读取。
 * env.js 由 scripts/generate-env.mjs 在「构建时或容器启动时」依据环境变量生成，
 * 未配置项自动回退到下面的默认值。
 * ============================================================ */
(function () {
  var ENV = window.__BEEF_ENV__ || {};

  function str(k, def) {
    var v = ENV[k];
    return (v === undefined || v === null || v === '') ? def : String(v);
  }
  function bool(k, def) {
    return (typeof ENV[k] === 'boolean') ? ENV[k] : def;
  }

  window.SITE = {
    /* ---------- 品牌 ---------- */
    brand: str('brand', '牛肉'),                        // ← BEEF_BRAND
    brandEn: str('brandEn', 'BEEF'),                    // ← BEEF_BRAND_EN
    fullName: str('fullName', '牛肉 BEEF'),             // ← BEEF_FULL_NAME
    domain: str('domain', 'beef.netlify.app'),          // ← BEEF_DOMAIN
    slogan: str('slogan', '基岩版社区向生存服务器 · 友善交流，共建世界。'),
    desc: str('desc', '牛肉（BEEF）——社区向 Minecraft 基岩版生存服务器。友善交流，共建世界。'),
    since: str('since', '2026-10-01'),                  // 开服日期，用于「已运行」

    /* ---------- 联系方式 ---------- */
    qq: str('qq', '123456789'),                         // ← BEEF_QQ
    serverAddr: str('serverAddr', 'mc.beef.example.com'), // ← BEEF_SERVER_ADDR
    serverPort: str('serverPort', '19132'),             // ← BEEF_SERVER_PORT
    email: str('email', 'hi@beef.example.com'),         // ← BEEF_EMAIL
    repo: str('repo', 'https://github.com/'),           // ← BEEF_REPO_URL
    apkVersion: str('apkVersion', 'v1.3.0'),            // ← BEEF_APK_VERSION
    apkUrl: str('apkUrl', '#download'),                 // ← BEEF_APK_URL
    sponsorQr: str('sponsorQr', ''),                    // ← BEEF_SPONSOR_QR

    /* ---------- 开关 ---------- */
    serverOnline: bool('serverOnline', true),           // ← BEEF_SERVER_ONLINE
    betaMode: bool('betaMode', false),                  // ← BEEF_BETA_MODE（内测模式：发动态需填卡密）
    storagePrefix: 'beef:'

    /* 注意：管理员密码已从 SITE 移除，请见下方 window.Auth
       与环境变量 BEEF_ADMIN_PASSWORD。 */
  };

  /* ------------------------------------------------------------
   * 管理员身份校验
   * 环境变量 BEEF_ADMIN_PASSWORD 在系统侧转成 SHA-256 摘要后才下发，
   * 因此前端源码里不存在明文密码；未配置时管理员登录直接拒绝。
   * ------------------------------------------------------------ */
  var auth = ENV.adminAuth || null;

  function toHex(buf) {
    return Array.prototype.map.call(new Uint8Array(buf), function (b) {
      return ('0' + b.toString(16)).slice(-2);
    }).join('');
  }

  window.Auth = {
    configured: function () {
      if (!auth) return false;
      return auth.mode === 'plain' ? !!auth.value : !!(auth.hash && auth.salt);
    },
    /* @return Promise<{ok:boolean, reason:'unconfigured'|'insecure'|'wrong'}> */
    verify: function (input) {
      if (!this.configured()) return Promise.resolve({ ok: false, reason: 'unconfigured' });
      if (auth.mode === 'plain') {
        return Promise.resolve({ ok: input === auth.value, reason: 'wrong' });
      }
      if (!(window.crypto && window.crypto.subtle && window.crypto.subtle.digest)) {
        // 非 HTTPS / 非安全上下文下 Web Crypto 不可用，无法完成摘要校验
        return Promise.resolve({ ok: false, reason: 'insecure' });
      }
      return window.crypto.subtle
        .digest('SHA-256', new TextEncoder().encode(auth.salt + ':' + input))
        .then(function (buf) {
          return { ok: toHex(buf) === auth.hash, reason: 'wrong' };
        });
    }
  };
})();

/* ============================================================
 * 初始内容（首次访问写入本地存储，之后由管理员面板维护）
 * ============================================================ */
(function () {
  var ENV = window.__BEEF_ENV__ || {};

  window.SEED = {
  /* 特色卡片 */
  features: [
    { icon: '🌍', title: '生存世界', text: '经典基岩版生存，自由探索、建造与合作，定期新增遗迹与玩法。' },
    { icon: '🏁', title: '赛事活动', text: '定期举办牛肉杯等赛事，官方统一发放装备，公平竞技赢取奖励。' },
    { icon: '💬', title: '活跃社区', text: '玩家互助、交流心得、参与日常讨论，共同决定服务器发展方向。' },
    { icon: '⚖️', title: '公平规则', text: '严格执行玩家公约，禁止作弊与破坏，维护良好游戏环境。' }
  ],

  /* 公告 */
  announcements: [
    {
      id: 'a1', pinned: true, date: '2026-10-20',
      title: 'S1 赛季「牛肉杯」正式开启',
      content: '牛肉 BEEF 首个官方 PVP 赛事进入筹备阶段，面向全体玩家开放。单人淘汰制，官方统一发放装备。开赛时间与报名方式将在后续公告中公布，请留意官网「服务器公告」与游戏内通知。'
    },
    {
      id: 'a2', pinned: false, date: '2026-10-18',
      title: '服务器例行维护通知',
      content: '本周四 02:00 - 04:00 进行例行维护，期间无法进入服务器。维护内容包括世界备份、插件更新与经济系统平衡调整，请提前下线。'
    },
    {
      id: 'a3', pinned: false, date: '2026-10-12',
      title: '官网改版上线 · 液态玻璃实验室',
      content: '全新官网改版完成，新增液态玻璃实验室，可自定义壁纸、玻璃强度、透明度与光影效果，并支持生成分享码。若设备卡顿，请在实验室中开启「性能优先」。'
    }
  ],

  /* 服务器历史 */
  history: [
    { id: 'h1', date: '2026-10-01', content: '牛肉 BEEF 服务器正式开服，首批玩家上山定居。' },
    { id: 'h2', date: '2026-10-05', content: '首个玩家共建主城「牛镇」落成。' },
    { id: 'h3', date: '2026-10-12', content: 'S1 牛肉杯赛事筹备启动，官网同步改版。' },
    { id: 'h4', date: '2026-10-20', content: '经济系统 2.0 上线，新增玩家商店与物价指数。' }
  ],

  /* 管理团队 */
  team: [
    { id: 't1', name: '牛大厨', role: '服主', desc: '服务器服主' },
    { id: 't2', name: '雪花牛', role: '管理员', desc: '管理团队成员' },
    { id: 't3', name: '牛腩', role: '管理员', desc: '管理团队成员' },
    { id: 't4', name: '牛排', role: '管理员', desc: '管理团队成员' },
    { id: 't5', name: '牛筋', role: '管理员', desc: '管理团队成员' },
    { id: 't6', name: '牛百叶', role: '管理员', desc: '管理团队成员' },
    { id: 't7', name: '牛舌', role: '管理员', desc: '管理团队成员' },
    { id: 't8', name: '牛油', role: '管理员', desc: '管理团队成员' },
    { id: 't9', name: '牛尾', role: '管理员', desc: '管理团队成员' },
    { id: 't10', name: '和牛', role: '荣誉', desc: '已退出管理，曾作出重大贡献' }
  ],

  /* 动态 / 帖子 */
  posts: [
    {
      id: 'p1', type: '官方', author: '牛大厨', date: '2026-10-20 10:24',
      content: '主城「牛镇」二期已经开放，新增交易区与公共农场，欢迎来逛！',
      tags: ['建设', '主城'], image: '', likes: 42, pinned: true, comments: []
    },
    {
      id: 'p2', type: '玩家', author: '雪花牛', date: '2026-10-19 21:07',
      content: '今天在下界挖到一组石英，回主世界盖了个小屋，坐标 -312 64 908，欢迎来做客。',
      tags: ['建筑'], image: '', likes: 18, pinned: false, comments: []
    },
    {
      id: 'p3', type: '玩家', author: '牛腩', date: '2026-10-18 15:33',
      content: '物价表更新啦，钻石价格略有回落，想出手的小伙伴可以再等等。',
      tags: ['经济'], image: '', likes: 25, pinned: false, comments: []
    }
  ],

  /* 投票 */
  polls: [
    {
      id: 'v1', title: '开发方向', active: true, multi: false,
      desc: '下一个大版本优先做哪个方向？',
      options: [
        { text: '新维度：牛肉矿洞', votes: 12 },
        { text: '家园系统升级', votes: 27 },
        { text: '经济系统重做', votes: 9 },
        { text: '副本 / 团本玩法', votes: 31 }
      ]
    },
    {
      id: 'v2', title: '域名后缀', active: true, multi: false,
      desc: '官网正式域名用哪个后缀？',
      options: [
        { text: 'beef.cn', votes: 20 },
        { text: 'beef.top', votes: 6 },
        { text: 'beef.dev', votes: 15 },
        { text: 'mcbeef.com', votes: 11 }
      ]
    },
    {
      id: 'v3', title: '模组投票', active: true, multi: true,
      desc: '希望加入的辅助模组（可多选）',
      options: [
        { text: '连锁挖矿', votes: 38 },
        { text: '背包整理', votes: 22 },
        { text: '小地图', votes: 17 },
        { text: '自动熔炉', votes: 8 }
      ]
    }
  ],

  /* 赛事 */
  events: [
    {
      id: 'e1', title: 'S1 牛肉杯', status: '筹备中', icon: '🏁', date: '2026-11-08',
      desc: '「牛肉杯」是牛肉 BEEF 服务器首个官方 PVP 赛事，面向全体玩家开放。赛事采用单人淘汰制，玩家需自备装备，在指定竞技场内进行对决。具体开赛时间、报名方式及详细规则将在后续公告中陆续公布，请留意官网「服务器公告」栏目及游戏内通知。有意参与的玩家可提前做好装备与物资准备。'
    }
  ],
  replays: [],

  /* 兑换码 */
  codes: [
    { id: 'c1', code: 'BEEF-2026-WELCOME', reward: '新手礼包 ×1（面包 16 / 火把 32）', expire: '2026-12-31', used: false },
    { id: 'c2', code: 'NIUROU-S1', reward: 'S1 赛季纪念称号', expire: '2026-11-30', used: false }
  ],

  /* 赞助 */
  sponsors: [
    { id: 's1', name: '雪花牛', amount: 128 },
    { id: 's2', name: '牛腩', amount: 66 },
    { id: 's3', name: '匿名玩家', amount: 50 },
    { id: 's4', name: '牛排', amount: 30 }
  ],

  /* 服务器工具数据 */
  bannedItems: [
    { id: 'b1', name: 'TNT 大炮', reason: '造成地图破坏与卡顿' },
    { id: 'b2', name: '刷怪笼刷经验机', reason: '破坏经济平衡' },
    { id: 'b3', name: '透视材质包', reason: '影响公平性' },
    { id: 'b4', name: '自动连点器 / 宏', reason: '不公平竞争' },
    { id: 'b5', name: '高频红石时钟', reason: '服务器卡顿源' }
  ],
  tasks: [
    { id: 'k1', name: '每日签到', desc: '每天登录服务器并签到', reward: '金币 ×100' },
    { id: 'k2', name: '挖矿 128 块', desc: '累计挖掘任意矿石 128 块', reward: '金币 ×200' },
    { id: 'k3', name: '建造小屋', desc: '提交一处可居住建筑并通过审核', reward: '称号「建筑牛」' },
    { id: 'k4', name: '牛肉杯参赛', desc: '参与 S1 牛肉杯至少一场对决', reward: '限定皮肤兑换券' }
  ],
  prices: [
    { id: 'm1', item: '钻石', buy: 80, sell: 60 },
    { id: 'm2', item: '绿宝石', buy: 55, sell: 40 },
    { id: 'm3', item: '铁锭', buy: 12, sell: 8 },
    { id: 'm4', item: '金锭', buy: 30, sell: 22 },
    { id: 'm5', item: '下界石英', buy: 9, sell: 6 },
    { id: 'm6', item: '附魔瓶', buy: 45, sell: 32 }
  ],

  /* 商店 */
  shop: [
    { id: 'g1', icon: '🥇', name: '牛肉会员 · 月卡', price: 12, desc: '专属称号、每日额外奖励、优先排队。' },
    { id: 'g2', icon: '👑', name: '牛肉会员 · 季卡', price: 30, desc: '月卡全部权益，另赠限定披风与传送特权。' },
    { id: 'g3', icon: '🪨', name: '传送石 ×16', price: 6, desc: '可在任意地标间快速传送。' },
    { id: 'g4', icon: '🧪', name: '经验瓶 ×64', price: 8, desc: '快速补充经验，附魔必备。' },
    { id: 'g5', icon: '🏷️', name: '定制称号', price: 20, desc: '自定义专属彩色称号，永久有效。' },
    { id: 'g6', icon: '🧱', name: '领地扩展 ×4096', price: 15, desc: '扩大你的领地保护范围。' }
  ],

  /* 玩家公约 */
  rules: [
    { id: 'r1', title: '友善交流', text: '禁止人身攻击、引战、刷屏与任何形式的歧视言论。' },
    { id: 'r2', title: '禁止作弊', text: '禁止使用任何外挂、透视、自动连点、宏与利用 Bug 获利。' },
    { id: 'r3', title: '禁止破坏', text: '禁止偷窃、炸毁、岩浆破坏他人建筑，保持距离建造。' },
    { id: 'r4', title: '公平游戏', text: '禁止小号刷奖励、恶意刷票、垄断物价与利用交易漏洞。' },
    { id: 'r5', title: '卡顿管控', text: '禁止高频红石、大量实体农场、TNT 大炮等影响服务器性能的行为。' },
    { id: 'r6', title: '争议处理', text: '遇到纠纷请截图并联系管理团队，禁止在公屏争吵。' },
    { id: 'r7', title: '违规处罚', text: '视情节给予警告、禁用功能、短期封禁直至永久封禁。' },
    { id: 'r8', title: '规则更新', text: '管理团队有权根据实际情况修订本公约，修订后即时生效。' }
  ],

  /* 策划 / 路线图 */
  plans: [
    { id: 'pl1', tag: '已上线', title: '官网 2.0 · 液态玻璃', text: '全新视觉与液态玻璃实验室，支持主题分享码。' },
    { id: 'pl2', tag: '进行中', title: '经济系统 2.0', text: '玩家商店、物价指数与税收模型。' },
    { id: 'pl3', tag: '筹备中', title: 'S1 牛肉杯', text: '首个官方 PVP 赛事，单人淘汰制。' },
    { id: 'pl4', tag: '规划中', title: '牛肉矿洞 · 新维度', text: '高风险高回报的公共矿洞玩法。' },
    { id: 'pl5', tag: '规划中', title: '家园系统升级', text: '多家园点位、权限分级与传送网络。' }
  ],

  /* 配置要求（静态展示） */
  spec: {
    mobile: {
      min: '麒麟 985 / 苹果 A14 / 骁龙 855 / 天玑 1000L 及以上',
      rec: '麒麟 9000 / 苹果 A15 / 骁龙 888 / 天玑 1200 及以上',
      note: '最低约 4 区块 30 帧；推荐可加载更多区块，运行更流畅。'
    },
    pc: {
      min: 'CPU：AMD R7 5700X / Intel i5-12400F　内存：12GB　显卡：6GB 显存',
      rec: 'CPU：AMD R7 5800X / Intel i5-13600KF　内存：16GB　显卡：8GB 显存（RTX 3060 / RTX 4060 级）',
      note: '最低可正常进服游玩；推荐配置特效与区块渲染更完整。'
    },
    tip: '本服含模组与光影资源，以下配置仅供参考，未达到也能正常游玩。'
  },

  /* 聊天室初始消息（本地演示） */
  chat: [
    { id: 'ch1', name: '系统', text: '欢迎来到牛肉 BEEF 服务器聊天室（本地演示，无后端）。', time: '10:00' }
  ],

  /* 内测卡密：默认不预置，由环境变量 BEEF_BETA_KEYS 注入 */
  keys: []
};

  /* 环境变量覆盖：内测卡密 / 兑换码（BEEF_BETA_KEYS、BEEF_REDEEM_CODES） */
  if (Array.isArray(ENV.seedKeys)) {
    window.SEED.keys = ENV.seedKeys.map(function (k, i) {
      return { id: 'env-k' + (i + 1), code: String(k.code || ''), used: !!k.used };
    }).filter(function (k) { return k.code; });
  }
  if (Array.isArray(ENV.seedCodes)) window.SEED.codes = ENV.seedCodes;
})();
