/* ============================================================
 * 牛肉 BEEF · 核心工具 / 本地存储 / 弹层 / Toast
 * ============================================================ */
(function () {
  'use strict';

  var P = window.SITE.storagePrefix || 'beef:';

  /* ---------------- DOM ---------------- */
  var U = {
    $: function (s, r) { return (r || document).querySelector(s); },
    $$: function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); },
    el: function (tag, cls, html) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (html != null) e.innerHTML = html;
      return e;
    },
    esc: function (s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },
    uid: function () {
      return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    },
    today: function () {
      var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    },
    now: function () {
      var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
      return U.today() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    },
    hm: function () {
      var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
      return p(d.getHours()) + ':' + p(d.getMinutes());
    },
    daysBetween: function (a, b) {
      var t1 = new Date(a).getTime(), t2 = new Date(b).getTime();
      if (isNaN(t1) || isNaN(t2)) return 0;
      return Math.max(0, Math.floor((t2 - t1) / 86400000));
    },
    copy: function (text) {
      var done = function () { Toast.show('已复制：' + text, 'ok'); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, fallback);
      } else { fallback(); }
      function fallback() {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); }
        catch (e) { Toast.show('复制失败，请手动选择', 'bad'); }
        document.body.removeChild(ta);
      }
    },
    highlight: function (html, kw) {
      if (!kw) return html;
      var safe = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return html.replace(new RegExp('(' + safe + ')', 'gi'), '<mark>$1</mark>');
    },
    isMobile: function () {
      return /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent);
    },
    /* 本地图片 → dataURL */
    readImage: function (file, cb) {
      if (!file) return cb('');
      if (file.size > 1.5 * 1024 * 1024) { Toast.show('图片不能超过 1.5MB', 'bad'); return cb(''); }
      var fr = new FileReader();
      fr.onload = function () { cb(fr.result); };
      fr.onerror = function () { Toast.show('图片读取失败', 'bad'); cb(''); };
      fr.readAsDataURL(file);
    }
  };

  /* ---------------- 存储 ---------------- */
  var Store = {
    get: function (k, def) {
      try {
        var v = localStorage.getItem(P + k);
        return v == null ? def : JSON.parse(v);
      } catch (e) { return def; }
    },
    set: function (k, v) {
      try { localStorage.setItem(P + k, JSON.stringify(v)); }
      catch (e) { Toast.show('本地存储写入失败（可能空间不足）', 'bad'); }
    },
    /* 带种子的列表 */
    list: function (k) {
      var v = this.get(k, null);
      if (v == null) { v = (window.SEED && window.SEED[k]) ? window.SEED[k] : []; this.set(k, v); }
      return v;
    },
    save: function (k, arr) { this.set(k, arr); this._touch(k); },
    /* 只写本地，不触发服务端回推（例如投票的乐观更新） */
    setSilent: function (k, v) { this.set(k, v); },
    reset: function (k) {
      localStorage.removeItem(P + k);
      var v = this.list(k);
      this._touch(k);
      return v;
    },
    /* 变更钩子：交给 Sync 回推到服务端 */
    _touch: function (k) { if (window.Sync) Sync.pushed(k); },
    resetAll: function () {
      Object.keys(localStorage).filter(function (k) { return k.indexOf(P) === 0 && k !== P + 'stats'; })
        .forEach(function (k) { localStorage.removeItem(k); });
    },

    /* 访问统计 */
    stats: function () {
      var s = this.get('stats', null);
      if (!s) s = { days: {}, totalPv: 0, totalUv: 0, devices: {}, lastUv: '' };
      return s;
    },
    saveStats: function (s) { this.set('stats', s); },
    track: function () {
      var s = this.stats(), d = U.today();
      if (!s.days[d]) s.days[d] = { pv: 0, uv: 0 };
      s.days[d].pv++;
      s.totalPv++;
      if (s.lastUv !== d) {
        s.lastUv = d;
        s.days[d].uv++;
        s.totalUv++;
      }
      var dev = U.isMobile() ? '移动端' : '电脑端';
      s.devices[dev] = (s.devices[dev] || 0) + 1;
      this.saveStats(s);
      return s;
    },
    last14: function () {
      var s = this.stats(), out = [], i, d, t;
      for (i = 13; i >= 0; i--) {
        t = new Date(); t.setDate(t.getDate() - i);
        d = t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2) + '-' + ('0' + t.getDate()).slice(-2);
        out.push({ date: d, pv: (s.days[d] && s.days[d].pv) || 0, uv: (s.days[d] && s.days[d].uv) || 0 });
      }
      return out;
    },

    /* 管理员（仅本机会话） */
    adminOn: function () { return sessionStorage.getItem(P + 'admin') === '1'; },
    adminSet: function (v) {
      if (v) sessionStorage.setItem(P + 'admin', '1');
      else {
        sessionStorage.removeItem(P + 'admin');
        if (window.Api) Api.clearToken();   // 退出时清掉服务端凭证
      }
    },

    /* 我的昵称 / 投票记录 / 点赞 */
    nick: function (v) {
      if (v != null) { this.set('nick', v); return v; }
      return this.get('nick', '');
    },
    voted: function (pollId) {
      var v = this.get('votes', {});
      return v[pollId] || null;
    },
    setVoted: function (pollId, idxs) {
      var v = this.get('votes', {});
      v[pollId] = idxs;
      this.set('votes', v);
    },
    liked: function (postId) {
      var v = this.get('likes', {});
      return !!v[postId];
    },
    setLiked: function (postId) {
      var v = this.get('likes', {});
      v[postId] = true;
      this.set('likes', v);
    }
  };

  /* ---------------- Toast ---------------- */
  var Toast = {
    show: function (msg, type) {
      var wrap = U.$('#toastWrap');
      if (!wrap) return;
      var t = U.el('div', 'toast' + (type ? ' ' + type : ''), U.esc(msg));
      wrap.appendChild(t);
      setTimeout(function () {
        t.style.transition = 'opacity .25s'; t.style.opacity = '0';
        setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 260);
      }, 2000);
    }
  };

  /* ---------------- 弹层 ---------------- */
  var Modal = {
    open: function (id) {
      var m = U.$('#modal-' + id);
      if (!m) return;
      U.$$('.modal.open').forEach(function (x) { x.classList.remove('open'); });
      m.classList.add('open');
      document.body.style.overflow = 'hidden';
      if (id === 'admin') { if (window.Admin) Admin.render(); }
    },
    close: function () {
      U.$$('.modal.open').forEach(function (x) { x.classList.remove('open'); });
      document.body.style.overflow = '';
    }
  };

  window.U = U;
  window.Store = Store;
  window.Toast = Toast;
  window.Modal = Modal;
})();
