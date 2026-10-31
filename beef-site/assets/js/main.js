/* ============================================================
 * 牛肉 BEEF · 启动 / 导航 / 搜索 / 弹层 / 主题
 * ============================================================ */
(function () {
  'use strict';

  var NAV = [
    ['home', '首页'], ['announcements', '公告'], ['feed', '动态'], ['shop', '商店'],
    ['vote', '投票'], ['quicktools', '便捷工具'], ['servertools', '服务器工具'],
    ['rules', '玩家公约'], ['events', '赛事活动'], ['codes', '兑换码'],
    ['sponsor', '服务器赞助'], ['download', '下载']
  ];

  var App = {

    boot: function () {
      // 站点覆盖配置（管理员面板里改过的）
      var ov = Store.get('siteOverride', null);
      if (ov) Object.assign(window.SITE, ov);

      // 「保持登录」：同一设备下次打开自动进入管理员态
      if (Store.get('adminKeep', false)) Store.adminSet(true);

      // 关闭弹层时清掉 #admin，避免刷新又弹出
      var origClose = Modal.close;
      Modal.close = function () {
        origClose();
        if (location.hash === '#admin') {
          history.replaceState(null, '', location.pathname + location.search);
        }
      };

      this.buildNav();
      this.theme();
      Glass.init();
      Sections.render();
      this.bindGlobal();
      this.bindMy();
      this.bindPlan();
      this.bindFeedback();
      this.clock();
      this.scrollSpy();
      this.toTop();
      this.menu();
      Store.track();

      var self = this;
      function onHash() {
        var id = location.hash.slice(1);
        if (id === 'admin') { Modal.open('admin'); return; }
        self.highlightNav(id);
      }
      window.addEventListener('hashchange', onHash);
      setTimeout(onHash, 60);
    },

    /* ---------- 导航 ---------- */
    buildNav: function () {
      var html = NAV.map(function (n) {
        return '<a href="#' + n[0] + '" data-n="' + n[0] + '">' + n[1] + '</a>';
      }).join('');
      U.$('#nav').innerHTML = html;
      // 移动端菜单：栏目 + 功能入口
      U.$('#mobileNav').innerHTML = html +
        '<a href="#" data-modal="my">我的</a>' +
        '<a href="#" data-modal="plan">策划</a>' +
        '<a href="#" data-modal="feedback">反馈</a>' +
        '<a href="#admin" data-modal="admin">🔒 管理</a>';
    },

    highlightNav: function (id) {
      U.$$('#nav a, #mobileNav a').forEach(function (a) {
        a.classList.toggle('on', a.dataset.n === id);
      });
    },

    scrollSpy: function () {
      var self = this;
      var ids = NAV.map(function (n) { return n[0]; });
      function upd() {
        var y = window.scrollY + 140, curId = ids[0];
        ids.forEach(function (id) {
          var el = document.getElementById(id);
          if (el && el.offsetTop <= y) curId = id;
        });
        self.highlightNav(curId);
      }
      window.addEventListener('scroll', upd, { passive: true });
      upd();
    },

    menu: function () {
      var b = U.$('#menuBtn'), n = U.$('#mobileNav');
      b.addEventListener('click', function () { n.classList.toggle('open'); });
      n.addEventListener('click', function (e) {
        if (e.target.tagName === 'A') n.classList.remove('open');
      });
    },

    toTop: function () {
      var b = U.$('#toTop');
      b.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      window.addEventListener('scroll', function () {
        b.style.opacity = window.scrollY > 400 ? '1' : '0';
        b.style.pointerEvents = window.scrollY > 400 ? 'auto' : 'none';
      }, { passive: true });
      b.style.opacity = '0'; b.style.pointerEvents = 'none';
      b.style.transition = 'opacity .25s';
    },

    /* ---------- 主题 ---------- */
    theme: function () {
      var b = U.$('#themeBtn');
      var isLight = Store.get('light', false);
      function set(v) {
        isLight = v;
        document.body.classList.toggle('light', v);
        b.textContent = v ? '☾' : '☀';
        Store.set('light', v);
      }
      set(isLight);
      b.addEventListener('click', function () {
        if (!isLight && !Store.get('glassWarned', false)) {
          Toast.show('已切换为浅色主题', 'ok');
          Store.set('glassWarned', true);
        }
        set(!isLight);
      });
    },

    /* ---------- 时钟 ---------- */
    clock: function () {
      var el = U.$('#clock');
      function tick() {
        var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
        var h = d.getHours();
        var ap = h < 12 ? 'AM' : 'PM';
        el.textContent = p(h) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) + ' ' + ap;
      }
      tick();
      setInterval(tick, 1000);
    },

    /* ---------- 全局事件 ---------- */
    bindGlobal: function () {
      var self = this;

      // 弹层 / 复制
      document.addEventListener('click', function (e) {
        var t = e.target;

        var m = t.closest('[data-modal]');
        if (m) { e.preventDefault(); Modal.open(m.dataset.modal); return; }

        var c = t.closest('[data-close]');
        if (c) { Modal.close(); return; }

        var ce = t.closest('[data-copy-el]');
        if (ce) {
          var src = document.getElementById(ce.dataset.copyEl);
          if (src) U.copy(src.textContent.trim());
          return;
        }

        var cp = t.closest('[data-copy]');
        if (cp) { e.preventDefault(); U.copy(cp.dataset.copy); return; }
      });

      // 点击遮罩关闭
      U.$$('.modal').forEach(function (m) {
        m.addEventListener('click', function (e) { if (e.target === m) Modal.close(); });
      });

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') Modal.close();
      });

      // 搜索
      var gs = U.$('#globalSearch');
      gs.addEventListener('input', function () { self.search(gs.value.trim()); });

      // 开源仓库
      U.$('#repoGo').addEventListener('click', function () {
        window.open(window.SITE.repo, '_blank', 'noopener');
      });
    },

    search: function (kw) {
      var secs = U.$$('[data-searchable]');
      if (!kw) {
        secs.forEach(function (s) { s.classList.remove('hidden'); });
        return;
      }
      var k = kw.toLowerCase(), hit = 0;
      secs.forEach(function (s) {
        var inTag = (s.dataset.searchable || '').toLowerCase().indexOf(k) >= 0;
        var inTxt = s.textContent.toLowerCase().indexOf(k) >= 0;
        var ok = inTag || inTxt;
        s.classList.toggle('hidden', !ok);
        if (ok) hit++;
      });
      if (!hit) Toast.show('没有找到「' + kw + '」相关内容', 'bad');
    },

    /* ---------- 我的 ---------- */
    bindMy: function () {
      var $ = U.$;
      var nick = Store.nick();
      $('#myNick').value = nick;
      $('#myNick').addEventListener('input', function () { Store.nick(this.value); });

      // 每次打开刷新
      var mo = $('#modal-my');
      var obs = new MutationObserver(function () {
        if (mo.classList.contains('open')) App.refreshMy();
      });
      obs.observe(mo, { attributes: true, attributeFilter: ['class'] });
    },

    refreshMy: function () {
      var nick = Store.nick();
      var posts = Store.list('posts').filter(function (p) { return p.author === nick; });
      var votes = Store.get('votes', {});
      var likes = Object.keys(Store.get('likes', {})).length;

      U.$('#myStats').innerHTML =
        '<div class="mini-stat"><b>' + posts.length + '</b><span>我的帖子</span></div>' +
        '<div class="mini-stat"><b>' + Object.keys(votes).length + '</b><span>参与投票</span></div>' +
        '<div class="mini-stat"><b>' + likes + '</b><span>点赞过的动态</span></div>';

      U.$('#myPosts').innerHTML = posts.length
        ? posts.map(function (p) {
            return '<div class="item"><h4>' + U.esc(String(p.content).slice(0, 40)) + '</h4>' +
              '<div class="meta"><span>' + U.esc(p.date) + '</span><span>' + (p.likes || 0) + ' 赞</span></div></div>';
          }).join('')
        : '<p class="hint">还没有发布过动态</p>';

      var polls = Store.list('polls');
      var rows = Object.keys(votes).map(function (pid) {
        var p = null;
        polls.forEach(function (x) { if (x.id === pid) p = x; });
        if (!p) return '';
        var txt = (votes[pid] || []).map(function (i) { return p.options[i] ? p.options[i].text : ''; }).join('、');
        return '<div class="item"><h4>' + U.esc(p.title) + '</h4><div class="meta"><span>我选了：' + U.esc(txt) + '</span></div></div>';
      }).join('');
      U.$('#myVotes').innerHTML = rows || '<p class="hint">还没有参与投票</p>';
    },

    /* ---------- 策划 ---------- */
    bindPlan: function () {
      var render = function () {
        U.$('#planList').innerHTML = Store.list('plans').map(function (p) {
          return '<div class="tl-item"><span class="tl-tag">' + U.esc(p.tag) + '</span>' +
            '<div class="tl-title">' + U.esc(p.title) + '</div>' +
            '<div class="tl-text">' + U.esc(p.text) + '</div></div>';
        }).join('');
      };
      render();
      App._renderPlan = render;
    },

    /* ---------- 反馈 ---------- */
    bindFeedback: function () {
      var list = function () {
        var fb = Store.get('feedback', []);
        U.$('#fbList').innerHTML = fb.length
          ? fb.map(function (f) {
              return '<div class="item"><h4>' + U.esc(f.type) + '</h4>' +
                '<div class="meta"><span>' + U.esc(f.time) + '</span>' +
                (f.contact ? '<span>' + U.esc(f.contact) + '</span>' : '') + '</div>' +
                '<div class="body">' + U.esc(f.content) + '</div></div>';
            }).join('')
          : '';
      };
      U.$('#fbSubmit').addEventListener('click', function () {
        var c = U.$('#fbContent').value.trim();
        if (!c) { Toast.show('请填写反馈内容', 'bad'); return; }
        var fb = Store.get('feedback', []);
        fb.unshift({
          id: U.uid(), type: U.$('#fbType').value, content: c,
          contact: U.$('#fbContact').value.trim(), time: U.now()
        });
        Store.set('feedback', fb);
        U.$('#fbContent').value = ''; U.$('#fbContact').value = '';
        list();
        Toast.show('反馈已提交，感谢支持', 'ok');
      });
      list();
      App._renderFb = list;
    }
  };

  /* 公约搜索（放在外部以便 sections 复用） */
  function stateRule(kw) {
    // 直接调用 Sections 内部的过滤：通过 DOM 过滤实现
    var items = U.$$('#ruleList .item');
    items.forEach(function (it) {
      var ok = !kw || it.textContent.toLowerCase().indexOf(kw.toLowerCase()) >= 0;
      it.style.display = ok ? '' : 'none';
    });
  }

  /* 公告搜索（DOM 过滤） */
  function stateAnn(kw) {
    U.$$('#annList .item').forEach(function (it) {
      var ok = !kw || it.textContent.toLowerCase().indexOf(kw.toLowerCase()) >= 0;
      it.style.display = ok ? '' : 'none';
    });
  }

  /* 远端数据到位后套用站点覆盖配置并重绘 */
  function rehydrate() {
    var ov = Store.get('siteOverride', null);
    if (ov) Object.assign(window.SITE, ov);
    if (window.Sections) Sections.render();
    if (Store.adminOn() && window.Admin) Admin.render();
  }

  function start() {
    // 有后端时先快速拉一次，成功则首屏就是最新数据
    Sync.syncNow(1500).then(function (ok) {
      App.boot();
      if (ok) return null;
      // 后端较慢：先用本地缓存渲染，后台补拉后刷新
      return Sync.syncNow(10000).then(function (ok2) { if (ok2) rehydrate(); });
    });

    // 切回页面且间隔超过 60s 时静默刷新一次
    var hiddenAt = 0;
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { hiddenAt = Date.now(); return; }
      if (Date.now() - hiddenAt < 60000) return;
      Sync.syncNow(8000).then(function (ok) { if (ok) rehydrate(); });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    // 用 DOM 过滤覆盖，避免全量重绘
    U.$('#annSearch').addEventListener('input', function () { stateAnn(this.value.trim()); });
    U.$('#ruleSearch').addEventListener('input', function () { stateRule(this.value.trim()); });

    if (window.Sync) start();
    else App.boot();
  });
})();
