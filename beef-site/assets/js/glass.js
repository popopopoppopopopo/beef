/* ============================================================
 * 牛肉 BEEF · 液态玻璃实验室
 * 壁纸 / 玻璃强度 / 透明度 / 光影 / 拖动模式 / 分享码
 * ============================================================ */
(function () {
  'use strict';

  var WALLPAPERS = [
    { id: 'default', name: '默认', pv: 'linear-gradient(135deg,#0b1220,#1d4b5a)' },
    { id: 'aurora', name: '极光', pv: 'linear-gradient(135deg,#16d9a3,#7b5cff)' },
    { id: 'sunset', name: '日落', pv: 'linear-gradient(135deg,#ff9a6c,#ff4d6d)' },
    { id: 'mint', name: '薄荷', pv: 'linear-gradient(135deg,#b8f2e6,#17786a)' },
    { id: 'cyber', name: '赛博', pv: 'linear-gradient(135deg,#00e5ff,#ff00e6)' },
    { id: 'forest', name: '森林', pv: 'linear-gradient(135deg,#7bd389,#14432a)' },
    { id: 'ocean', name: '海洋', pv: 'linear-gradient(135deg,#6ad6ff,#124a80)' },
    { id: 'sakura', name: '樱花', pv: 'linear-gradient(135deg,#ffd3e2,#8f4a5c)' },
    { id: 'white', name: '纯白', pv: 'linear-gradient(135deg,#f4f7fb,#cfdcec)' },
    { id: 'transparent', name: '透明', pv: 'linear-gradient(135deg,#333,#111)' },
    { id: 'custom', name: '自定义', pv: 'linear-gradient(135deg,#ff8a5c,#1b3a4b)' }
  ];

  var INTENSITY = {
    soft: { blur: 10, spread: 24 },
    normal: { blur: 18, spread: 40 },
    strong: { blur: 28, spread: 60 }
  };

  var DEFAULTS = {
    wp: 'default', c1: '#0b1220', c2: '#1b3a4b',
    intensity: 'normal', alpha: 10, spread: 40, glow: 16, offset: 12,
    drag: 'off', glass: true, perf: false, dark: false
  };

  var Glass = {
    s: null,
    pos: {},
    order: {},

    /* ---------- 读写 ---------- */
    load: function () {
      var s = Store.get('glass', null);
      this.s = s ? Object.assign({}, DEFAULTS, s) : Object.assign({}, DEFAULTS);
      this.pos = Store.get('glassPos', {});
      this.order = Store.get('glassOrder', {});
      // URL 分享码
      var m = location.search.match(/[?&]glass=([^&]+)/);
      if (m) {
        var dec = this.decode(m[1]);
        if (dec) this.s = Object.assign({}, DEFAULTS, dec);
      }
      return this.s;
    },
    save: function () {
      Store.set('glass', this.s);
      Store.set('glassPos', this.pos);
      Store.set('glassOrder', this.order);
    },
    encode: function (s) {
      try {
        return 'BEEF1-' + btoa(unescape(encodeURIComponent(JSON.stringify(s)))).replace(/=+$/, '');
      } catch (e) { return ''; }
    },
    decode: function (code) {
      try {
        var raw = code.replace(/^BEEF1-/, '');
        return JSON.parse(decodeURIComponent(escape(atob(raw))));
      } catch (e) { return null; }
    },

    /* ---------- 应用 ---------- */
    apply: function () {
      var s = this.s, b = document.body, i;
      WALLPAPERS.forEach(function (w) { b.classList.remove('bg-' + w.id); });
      b.classList.add('bg-' + s.wp);

      if (s.wp === 'custom') {
        b.style.setProperty('--bg1', s.c1);
        b.style.setProperty('--bg2', s.c1);
        b.style.setProperty('--bg3', s.c2);
      } else {
        b.style.removeProperty('--bg1');
        b.style.removeProperty('--bg2');
        b.style.removeProperty('--bg3');
      }

      var it = INTENSITY[s.intensity] || INTENSITY.normal;
      b.style.setProperty('--glass-blur', it.blur + 'px');
      b.style.setProperty('--glass-alpha', (s.alpha / 100).toFixed(3));
      b.style.setProperty('--shadow-spread', s.spread + 'px');
      b.style.setProperty('--glow', s.glow + '%');
      b.style.setProperty('--offset', s.offset + 'px');

      b.classList.toggle('no-glass', !s.glass);
      b.classList.toggle('perf', !!s.perf);
      b.classList.toggle('dark-glass', !!s.dark);
      b.classList.toggle('drag-on', s.drag !== 'off');
      b.setAttribute('data-drag', s.drag);

      // 同步控件
      this.syncUI();
    },

    /* ---------- UI 同步 ---------- */
    syncUI: function () {
      var s = this.s, $ = U.$;
      U.$$('#wallpapers .swatch').forEach(function (b) {
        b.classList.toggle('on', b.dataset.wp === s.wp);
      });
      if ($('#customColors')) $('#customColors').hidden = (s.wp !== 'custom');
      U.$$('#intensity button').forEach(function (b) { b.classList.toggle('on', b.dataset.i === s.intensity); });
      U.$$('#dragMode button').forEach(function (b) { b.classList.toggle('on', b.dataset.d === s.drag); });
      if ($('#alpha')) { $('#alpha').value = s.alpha; $('#alphaVal').textContent = '通透 ' + s.alpha + '%'; }
      if ($('#spread')) { $('#spread').value = s.spread; $('#spreadVal').textContent = s.spread + 'px'; }
      if ($('#glow')) { $('#glow').value = s.glow; $('#glowVal').textContent = s.glow + '%'; }
      if ($('#offset')) { $('#offset').value = s.offset; $('#offsetVal').textContent = s.offset + 'px'; }
      if ($('#c1')) $('#c1').value = s.c1;
      if ($('#c2')) $('#c2').value = s.c2;
      if ($('#optGlass')) $('#optGlass').checked = s.glass;
      if ($('#optPerf')) $('#optPerf').checked = s.perf;
      if ($('#optDark')) $('#optDark').checked = s.dark;
    },

    /* ---------- 初始化 ---------- */
    init: function () {
      this.load();
      this.buildSwatches();
      this.bind();
      this.apply();
      this.startFps();
    },

    buildSwatches: function () {
      var box = U.$('#wallpapers');
      if (!box) return;
      var self = this;
      box.innerHTML = WALLPAPERS.map(function (w) {
        return '<button class="swatch" data-wp="' + w.id + '">' +
          '<span class="pv" style="background:' + w.pv + '"></span>' + w.name + '</button>';
      }).join('');
      box.addEventListener('click', function (e) {
        var b = e.target.closest('.swatch');
        if (!b) return;
        self.s.wp = b.dataset.wp;
        self.apply(); self.save();
      });
    },

    bind: function () {
      var self = this, $ = U.$;

      U.$$('#intensity button').forEach(function (b) {
        b.addEventListener('click', function () {
          self.s.intensity = b.dataset.i; self.apply(); self.save();
        });
      });

      U.$$('#dragMode button').forEach(function (b) {
        b.addEventListener('click', function () {
          self.s.drag = b.dataset.d; self.apply(); self.save();
          if (self.s.drag === 'off') self.clearDrag(); else self.setupDrag();
        });
      });

      [['#alpha', 'alpha', function (v) { return '通透 ' + v + '%'; }],
       ['#spread', 'spread', function (v) { return v + 'px'; }],
       ['#glow', 'glow', function (v) { return v + '%'; }],
       ['#offset', 'offset', function (v) { return v + 'px'; }]
      ].forEach(function (cfg) {
        var el = $(cfg[0]);
        if (!el) return;
        el.addEventListener('input', function () {
          self.s[cfg[1]] = parseInt(el.value, 10);
          var out = $(cfg[0] + 'Val');
          if (out) out.textContent = cfg[2](el.value);
          self.apply();
        });
        el.addEventListener('change', function () { self.save(); });
      });

      [['#c1', 'c1'], ['#c2', 'c2']].forEach(function (c) {
        var el = $(c[0]);
        if (!el) return;
        el.addEventListener('input', function () {
          self.s[c[1]] = el.value; self.s.wp = 'custom'; self.apply(); self.save();
        });
      });

      [['#optGlass', 'glass'], ['#optPerf', 'perf'], ['#optDark', 'dark']].forEach(function (c) {
        var el = $(c[0]);
        if (!el) return;
        el.addEventListener('change', function () {
          self.s[c[1]] = el.checked;
          if (c[1] === 'perf' && el.checked) Toast.show('已开启性能优先，玻璃模糊将降低', 'ok');
          self.apply(); self.save();
        });
      });

      var rnd = $('#labRandom');
      if (rnd) rnd.addEventListener('click', function () { self.random(); });

      var rst = $('#labReset');
      if (rst) rst.addEventListener('click', function () {
        self.s = Object.assign({}, DEFAULTS);
        self.pos = {}; self.order = {};
        self.apply(); self.save(); self.clearDrag();
        Toast.show('已重置为默认主题', 'ok');
      });

      var sh = $('#labShare');
      if (sh) sh.addEventListener('click', function () {
        var code = self.encode(self.s);
        $('#shareCode').value = code;
        Toast.show('分享码已生成', 'ok');
      });

      var cp = $('#shareCopy');
      if (cp) cp.addEventListener('click', function () {
        var v = $('#shareCode').value;
        if (!v) { Toast.show('请先生成分享码', 'bad'); return; }
        U.copy(v);
      });

      var ap = $('#labApply');
      if (ap) ap.addEventListener('click', function () {
        self.save(); self.apply();
        Toast.show('已应用并保存主题', 'ok');
      });
    },

    random: function () {
      var wp = WALLPAPERS[Math.floor(Math.random() * WALLPAPERS.length)].id;
      var keys = Object.keys(INTENSITY);
      this.s.wp = (wp === 'custom' || wp === 'transparent') ? 'default' : wp;
      this.s.intensity = keys[Math.floor(Math.random() * keys.length)];
      this.s.alpha = 6 + Math.floor(Math.random() * 20);
      this.s.spread = 16 + Math.floor(Math.random() * 48);
      this.s.glow = Math.floor(Math.random() * 45);
      this.s.offset = 4 + Math.floor(Math.random() * 24);
      this.s.dark = Math.random() > 0.7;
      this.apply(); this.save();
      Toast.show('已随机生成主题：' + this.s.wp, 'ok');
    },

    /* ---------- 卡片拖动 ---------- */
    collect: function () {
      var self = this, n = 0;
      U.$$('[data-card]').forEach(function (card) {
        var p = card.parentNode;
        if (!p.dataset.scope) p.dataset.scope = 'sc' + (n++);
        // 自由摆放位置
        var pos = self.pos[card.dataset.card];
        if (pos) card.style.transform = 'translate(' + pos.x + 'px,' + pos.y + 'px)';
        // 拖拽把手
        if (!card.querySelector('.drag-handle')) {
          var h = U.el('div', 'drag-handle', '⠿');
          card.style.position = 'relative';
          card.appendChild(h);
        }
        if (!card._bound) {
          card._bound = true;
          card.addEventListener('pointerdown', function (e) { self.onDown(e, card); });
        }
      });
    },

    restoreOrder: function () {
      var self = this;
      U.$$('[data-card]').forEach(function (card) {
        var p = card.parentNode;
        if (!p || !p.dataset.scope) return;
        var ids = self.order[p.dataset.scope];
        if (!ids) return;
        var idx = ids.indexOf(card.dataset.card);
        if (idx < 0) return;
        var ref = null, i;
        for (i = idx + 1; i < ids.length; i++) {
          ref = p.querySelector('[data-card="' + ids[i] + '"]');
          if (ref) break;
        }
        if (ref && ref !== card && ref.parentNode === p) p.insertBefore(card, ref);
        else if (!ref && p.lastElementChild !== card) p.appendChild(card);
      });
    },

    saveOrder: function (scope) {
      var p = U.$('[data-scope="' + scope + '"]');
      if (!p) return;
      this.order[scope] = U.$$('[data-card]', p).map(function (c) { return c.dataset.card; });
      this.save();
    },

    onDown: function (e, card) {
      var self = this;
      if (self.s.drag === 'off') return;
      var t = e.target;
      if (t.closest('input,textarea,select,button,a,summary,label')) return;
      if (self.s.drag === 'grid' && !t.closest('.drag-handle')) return;
      if (self.s.drag === 'free' && t.closest('.drag-handle')) { /* also allow */ }

      card.setPointerCapture && card.setPointerCapture(e.pointerId);
      e.preventDefault();

      var startX = e.clientX, startY = e.clientY;
      var base = self.pos[card.dataset.card] || { x: 0, y: 0 };
      card.classList.add('dragging');

      function move(ev) {
        if (self.s.drag === 'free') {
          var x = base.x + ev.clientX - startX;
          var y = base.y + ev.clientY - startY;
          card.style.transform = 'translate(' + x + 'px,' + y + 'px)';
          self.pos[card.dataset.card] = { x: x, y: y };
        } else {
          var under = document.elementFromPoint(ev.clientX, ev.clientY);
          var other = under && under.closest ? under.closest('[data-card]') : null;
          if (other && other !== card && other.parentNode === card.parentNode) {
            var p = card.parentNode;
            var rect = other.getBoundingClientRect();
            var before = ev.clientY < rect.top + rect.height / 2;
            p.insertBefore(card, before ? other : other.nextSibling);
          }
        }
      }
      function up() {
        card.classList.remove('dragging');
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        if (self.s.drag === 'grid') self.saveOrder(card.parentNode.dataset.scope);
        else self.save();
      }
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    },

    clearDrag: function () {
      this.pos = {}; this.order = {};
      U.$$('[data-card]').forEach(function (c) { c.style.transform = ''; });
      this.save();
    },

    setupDrag: function () { this.collect(); },

    /* ---------- FPS ---------- */
    startFps: function () {
      var last = performance.now(), frames = 0, acc = 0;
      var fpsEl = U.$('#fps'), ftEl = U.$('#frametime'), rlEl = U.$('#renderLoad');
      function loop(t) {
        frames++;
        var dt = t - last; last = t; acc += dt;
        if (acc >= 1000) {
          var fps = Math.round(frames * 1000 / acc);
          var ft = (acc / frames).toFixed(1);
          if (fpsEl) fpsEl.textContent = fps;
          if (ftEl) ftEl.textContent = ft + 'ms';
          if (rlEl) rlEl.textContent = fps >= 50 ? '低' : (fps >= 30 ? '中' : '高');
          frames = 0; acc = 0;
        }
        requestAnimationFrame(loop);
      }
      requestAnimationFrame(loop);
    }
  };

  window.Glass = Glass;
})();
