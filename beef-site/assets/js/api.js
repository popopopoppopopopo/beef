/* ============================================================
 * 牛肉 BEEF · 后端同步层
 *
 * 前端仍然是「同步渲染」，这里只负责两件事：
 *   1) 启动时从服务端拉取全量数据，写入 localStorage 后重绘
 *   2) Store 发生变更时，把对应栏目回推到服务端（COS）
 *
 * 后端不可用时（纯静态托管）自动降级为纯本地模式，功能不受影响。
 * ============================================================ */
(function () {
  'use strict';

  var PE = window.SITE.storagePrefix || 'beef:';
  var BASE = (window.__BEEF_ENV__ && window.__BEEF_ENV__.apiBase) || '/api';

  var timers = {};
  var applying = false;
  var warnedOffline = false;

  function req(method, url, body, timeout) {
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var opt = {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin'
    };
    if (body !== undefined) opt.body = JSON.stringify(body);
    if (ctrl) opt.signal = ctrl.signal;

    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeout || 15000) : null;
    return fetch(BASE + url, opt)
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          return { status: r.status, data: j };
        });
      })
      .then(function (res) {
        if (res.status >= 200 && res.status < 300) return res.data;
        var err = new Error((res.data && res.data.error) || ('HTTP ' + res.status));
        err.status = res.status;
        throw err;
      })
      .finally(function () { if (timer) clearTimeout(timer); });
  }

  function offline(err) {
    if (!warnedOffline) {
      warnedOffline = true;
      if (window.Toast) Toast.show('后端未连接，已切换为本地模式', 'bad');
      console.warn('[Api] 后端不可用：', err && err.message);
    }
  }

  var Api = {
    base: BASE,
    /* 管理员凭证：保持登录放 localStorage，否则只用会话 */
    token: function () {
      try { return localStorage.getItem(PE + 'token') || sessionStorage.getItem(PE + 'token') || ''; }
      catch (e) { return ''; }
    },
    setToken: function (t, keep) {
      try {
        if (keep) localStorage.setItem(PE + 'token', t);
        else {
          localStorage.removeItem(PE + 'token');
          sessionStorage.setItem(PE + 'token', t);
        }
      } catch (e) { /* 忽略存储失败 */ }
    },
    clearToken: function () {
      try {
        localStorage.removeItem(PE + 'token');
        sessionStorage.removeItem(PE + 'token');
      } catch (e) { /* ignore */ }
    },

    /* 健康检查 */
    health: function (timeout) { return req('GET', '/health', undefined, timeout || 3000); },

    /* 拉取全量数据 */
    pull: function (timeout) { return req('GET', '/state', undefined, timeout || 15000); },

    /* 登录：优先走服务端；后端不可用时回退到本地摘要校验 */
    login: function (password, keep) {
      return req('POST', '/login', { password: password }, 10000)
        .then(function (d) {
          Api.setToken(d.token, keep);
          return { ok: true };
        })
        .catch(function (err) {
          if (err.status === 401) return { ok: false, error: (err.message || '密码错误') };
          if (window.Auth && Auth.configured()) {
            return Auth.verify(password).then(function (r) {
              return r.ok ? { ok: true, offline: true } : { ok: false, error: '密码错误' };
            });
          }
          offline(err);
          return { ok: false, error: '无法连接后端，且本地未配置管理员密码' };
        });
    },

    /* 写回某个栏目 */
    pushKey: function (key, list) {
      var extra = Api.token() ? { 'X-Admin-Token': Api.token() } : {};
      var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
      var opt = {
        method: 'PUT',
        headers: Object.assign({ 'Content-Type': 'application/json' }, extra),
        credentials: 'same-origin',
        body: JSON.stringify({ list: list })
      };
      if (ctrl) opt.signal = ctrl.signal;
      var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 15000) : null;
      return fetch(BASE + '/state/' + encodeURIComponent(key), opt)
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (j) {
            return { status: r.status, data: j };
          });
        })
        .then(function (res) {
          if (res.status >= 200 && res.status < 300) return { ok: true, version: res.data.version };
          if (res.status === 401) {
            if (window.Store) Store.adminSet(false);
            if (window.Toast) Toast.show('登录已失效，请重新登录', 'bad');
          }
          throw new Error((res.data && res.data.error) || ('HTTP ' + res.status));
        })
        .catch(function (err) {
          if (err.name === 'AbortError') throw err;
          offline(err);
          throw err;
        })
        .finally(function () { if (timer) clearTimeout(timer); });
    },

    /* 站点配置（管理员） */
    pushSite: function (patch) {
      var extra = Api.token() ? { 'X-Admin-Token': Api.token() } : {};
      var opt = {
        method: 'PUT',
        headers: Object.assign({ 'Content-Type': 'application/json' }, extra),
        credentials: 'same-origin',
        body: JSON.stringify(patch)
      };
      return fetch(BASE + '/site', opt).then(function (r) {
        return r.json().catch(function () { return {}; });
      });
    },

    /* 投票（匿名可参与） */
    vote: function (pollId, idxs) {
      return req('POST', '/vote', { id: pollId, idxs: idxs }, 10000);
    }
  };

  /* ------------------------------------------------------------
   * Sync：把远端数据落到 localStorage（前端渲染逻辑不变）
   * ------------------------------------------------------------ */
  var Sync = {
    keys: function () { return Object.keys(window.SEED || {}); },

    /* 远端数据写入本地缓存，期间关闭回推避免循环 */
    apply: function (st) {
      if (!st || !st.data) return false;
      applying = true;
      try {
        this.keys().forEach(function (k) {
          if (!Array.isArray(st.data[k])) return;
          try { localStorage.setItem(PE + k, JSON.stringify(st.data[k])); }
          catch (e) { /* ignore */ }
        });
        if (st.site && Object.keys(st.site).length) {
          try { localStorage.setItem(PE + 'siteOverride', JSON.stringify(st.site)); }
          catch (e) { /* ignore */ }
        }
        try { localStorage.setItem(PE + 'version', String(st.version || 0)); }
        catch (e) { /* ignore */ }
      } finally {
        applying = false;
      }
      return true;
    },

    /* 拉取并应用，返回是否成功；后端不可用时返回 false，绝不抛错 */
    syncNow: function (timeout) {
      var p;
      try { p = Api.pull(timeout); }
      catch (e) { offline(e); return Promise.resolve(false); }
      return p.then(function (st) {
        return !!(st && !st.offline && Sync.apply(st));
      }).catch(function (err) {
        if (err.name !== 'AbortError') offline(err);
        return false;
      });
    },

    /* Store 变更后的回推（防抖） */
    pushed: function (key) {
      if (applying) return;
      if (this.keys().indexOf(key) < 0) return; // 只回推真实栏目
      if (timers[key]) clearTimeout(timers[key]);
      timers[key] = setTimeout(function () {
        delete timers[key];
        try {
          var v = localStorage.getItem(PE + key);
          var list = v ? JSON.parse(v) : [];
          Api.pushKey(key, list).catch(function (err) {
            if (err && err.name === 'AbortError') return;
            if (window.Toast) Toast.show('已保存到本地，同步服务器失败', 'bad');
          });
        } catch (e) { /* ignore */ }
      }, 700);
    }
  };

  window.Api = Api;
  window.Sync = Sync;
})();
