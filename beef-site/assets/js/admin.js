/* ============================================================
 * 牛肉 BEEF · 管理员面板
 * 纯前端：数据保存在浏览器 localStorage（无后端）
 * ============================================================ */
(function () {
  'use strict';

  var SCHEMA = [
    { key: 'features', label: '首页特色', fields: [
      { k: 'icon', l: '图标 emoji', def: '⭐' },
      { k: 'title', l: '卡片标题' },
      { k: 'text', l: '卡片说明', type: 'textarea' }
    ]},
    { key: 'announcements', label: '公告管理', fields: [
      { k: 'title', l: '公告标题' },
      { k: 'content', l: '公告内容', type: 'textarea' },
      { k: 'date', l: '日期（留空为今天）' },
      { k: 'pinned', l: '置顶', type: 'check' }
    ]},
    { key: 'posts', label: '动态管理', fields: [
      { k: 'author', l: '发布者' },
      { k: 'content', l: '内容', type: 'textarea' },
      { k: 'tags', l: '标签（空格分隔）', type: 'tags' },
      { k: 'type', l: '类型', type: 'select', opts: ['官方', '玩家'] },
      { k: 'pinned', l: '置顶', type: 'check' }
    ]},
    { key: 'history', label: '历史管理', fields: [
      { k: 'date', l: '历史日期' },
      { k: 'content', l: '历史内容', type: 'textarea' }
    ]},
    { key: 'events', label: '赛事管理', fields: [
      { k: 'title', l: '赛事标题' },
      { k: 'status', l: '状态', type: 'select', opts: ['筹备中', '进行中', '已结束'] },
      { k: 'date', l: '日期' },
      { k: 'icon', l: '图标 emoji', def: '🏁' },
      { k: 'desc', l: '赛事说明', type: 'textarea' }
    ]},
    { key: 'codes', label: '兑换码', fields: [
      { k: 'code', l: '兑换码' },
      { k: 'reward', l: '奖励内容' },
      { k: 'expire', l: '有效期至' }
    ]},
    { key: 'sponsors', label: '赞助管理', fields: [
      { k: 'name', l: '玩家名' },
      { k: 'amount', l: '赞助金额', type: 'number' }
    ]},
    { key: 'replays', label: '回放管理', fields: [
      { k: 'title', l: '回放标题' },
      { k: 'url', l: '视频链接' },
      { k: 'date', l: '日期（留空为今天）' }
    ]},
    { key: 'team', label: '团队管理', fields: [
      { k: 'name', l: '成员名' },
      { k: 'role', l: '职位', type: 'select', opts: ['服主', '管理员', '荣誉'] },
      { k: 'desc', l: '简介' }
    ]},
    { key: 'shop', label: '商店管理', fields: [
      { k: 'name', l: '商品名' },
      { k: 'icon', l: '图标 emoji', def: '🎁' },
      { k: 'price', l: '价格', type: 'number' },
      { k: 'desc', l: '描述', type: 'textarea' }
    ]},
    { key: 'rules', label: '公约管理', fields: [
      { k: 'title', l: '规则标题' },
      { k: 'text', l: '规则内容', type: 'textarea' }
    ]},
    { key: 'prices', label: '物价管理', fields: [
      { k: 'item', l: '物品' },
      { k: 'buy', l: '买入价', type: 'number' },
      { k: 'sell', l: '回收价', type: 'number' }
    ]},
    { key: 'plans', label: '策划管理', fields: [
      { k: 'tag', l: '阶段标签', type: 'select', opts: ['规划中', '筹备中', '进行中', '已上线'] },
      { k: 'title', l: '标题' },
      { k: 'text', l: '说明', type: 'textarea' }
    ]},
    { key: 'bannedItems', label: '禁用物品', fields: [
      { k: 'name', l: '物品名称' },
      { k: 'reason', l: '禁用原因' }
    ]},
    { key: 'tasks', label: '任务管理', fields: [
      { k: 'name', l: '任务名称' },
      { k: 'desc', l: '任务描述' },
      { k: 'reward', l: '奖励' }
    ]},
    { key: 'chat', label: '聊天管理', fields: [
      { k: 'name', l: '发言者', def: '系统' },
      { k: 'text', l: '内容', type: 'textarea' },
      { k: 'time', l: '时间' }
    ]}
  ];

  var editing = {};   // key -> id
  var cur = 'announcements';

  var Admin = {

    render: function () {
      var box = U.$('#adminBody');
      if (!box) return;
      if (!Store.adminOn()) { this.login(box); return; }

      var tabs = SCHEMA.map(function (s) {
        return '<button data-at="' + s.key + '"' + (s.key === cur ? ' class="on"' : '') + '>' + s.label + '</button>';
      }).join('') +
        '<button data-at="poll"' + (cur === 'poll' ? ' class="on"' : '') + '>投票管理</button>' +
        '<button data-at="keys"' + (cur === 'keys' ? ' class="on"' : '') + '>内测卡密</button>' +
        '<button data-at="home"' + (cur === 'home' ? ' class="on"' : '') + '>首页配置</button>' +
        '<button data-at="server"' + (cur === 'server' ? ' class="on"' : '') + '>服务器设置</button>' +
        '<button data-at="stats"' + (cur === 'stats' ? ' class="on"' : '') + '>访问统计</button>' +
        '<button data-at="data"' + (cur === 'data' ? ' class="on"' : '') + '>数据</button>';

      box.innerHTML =
        '<div class="admin-tabs">' + tabs + '</div>' +
        '<div id="adminPane"></div>' +
        '<div style="display:flex;justify-content:flex-end"><button class="btn ghost" id="adminOut">退出登录</button></div>';

      U.$$('#adminBody [data-at]').forEach(function (b) {
        b.addEventListener('click', function () { cur = b.dataset.at; Admin.render(); });
      });
      U.$('#adminOut').addEventListener('click', function () {
        Store.adminSet(false); Store.set('adminKeep', false);
        Admin.render(); Toast.show('已退出登录', 'ok');
      });

      var pane = U.$('#adminPane');
      if (cur === 'poll') this.pollPane(pane);
      else if (cur === 'keys') this.keyPane(pane);
      else if (cur === 'home') this.homePane(pane);
      else if (cur === 'server') this.serverPane(pane);
      else if (cur === 'stats') this.statPane(pane);
      else if (cur === 'data') this.dataPane(pane);
      else this.crudPane(pane, cur);
    },

    login: function (box) {
      box.innerHTML =
        '<div class="admin-login">' +
        '<h4 style="text-align:center;margin:4px 0 0">🔒 管理员登录</h4>' +
        '<input type="password" id="adminPwd" placeholder="管理员密码" />' +
        '<label><input type="checkbox" id="adminKeep"' +
          (Store.get('adminKeep', false) ? ' checked' : '') + ' /> 在这台设备上保持登录</label>' +
        '<button class="btn primary" id="adminIn">登录</button>' +
        '<p class="hint">登录后可管理：首页特色、公告、动态、历史、团队、商店、投票、兑换码、赛事、回放、赞助、公约、物价、策划、禁用物品、任务、聊天、内测卡密、服务器设置、访问统计、数据导入导出。</p>' +
        '<p class="hint">本站为纯静态站点，面板数据只保存在当前浏览器，不会同步给其他访客。</p>' +
        '</div>';
      U.$('#adminIn').addEventListener('click', Admin.doLogin);
      U.$('#adminPwd').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') Admin.doLogin();
      });
      setTimeout(function () { var p = U.$('#adminPwd'); if (p) p.focus(); }, 30);
    },

    doLogin: function () {
      var v = U.$('#adminPwd').value;
      var keep = U.$('#adminKeep') ? U.$('#adminKeep').checked : false;
      Store.set('adminKeep', keep);
      window.Api.login(v, keep).then(function (r) {
        if (!r.ok) { Toast.show(r.error || '密码错误', 'bad'); return; }
        Store.adminSet(true);
        Admin.render();
        Toast.show('登录成功，欢迎回来，' + window.SITE.brand + ' 管理员' +
          (r.offline ? '（本地模式）' : ''), 'ok');
      });
    },

    /* ---------- 通用 CRUD ---------- */
    crudPane: function (box, key) {
      var sc = null;
      SCHEMA.forEach(function (s) { if (s.key === key) sc = s; });
      if (!sc) return;

      var editId = editing[key] || null;
      var list = Store.list(key);
      // 兼容初始内容里没有 id 的数据（如首页特色卡片）
      var fixed = false;
      list.forEach(function (x) { if (!x.id) { x.id = U.uid(); fixed = true; } });
      if (fixed) Store.save(key, list);
      var item = null;
      if (editId) list.forEach(function (x) { if (x.id === editId) item = x; });

      var form = sc.fields.map(function (f) {
        var v = item ? (item[f.k] == null ? '' : item[f.k]) : (f.def || '');
        if (f.type === 'textarea') {
          return '<textarea data-f="' + f.k + '" rows="3" placeholder="' + f.l + '">' + U.esc(v) + '</textarea>';
        }
        if (f.type === 'check') {
          return '<label><input type="checkbox" data-f="' + f.k + '"' + (v ? ' checked' : '') + ' /> ' + f.l + '</label>';
        }
        if (f.type === 'select') {
          return '<select data-f="' + f.k + '">' + f.opts.map(function (o) {
            return '<option' + (o === v ? ' selected' : '') + '>' + o + '</option>';
          }).join('') + '</select>';
        }
        if (f.type === 'number') {
          return '<div class="fr"><input type="number" data-f="' + f.k + '" value="' + U.esc(v) + '" placeholder="' + f.l + '" /></div>';
        }
        return '<div class="fr"><input data-f="' + f.k + '" value="' + U.esc(v) + '" placeholder="' + f.l + '" /></div>';
      }).join('');

      box.innerHTML =
        '<div class="admin-pane">' +
          '<div class="admin-form">' + form +
            '<div class="fr">' +
              '<button class="btn primary" data-save="' + key + '">' + (item ? '保存修改' : '添加') + '</button>' +
              (item ? '<button class="btn ghost" data-cancel="' + key + '">取消编辑</button>' : '') +
            '</div>' +
          '</div>' +
          '<div class="admin-list" id="al-' + key + '">' + this.rowsHTML(key, list) + '</div>' +
        '</div>';

      U.$('#al-' + key).addEventListener('click', function (e) {
        var ed = e.target.closest('[data-edit]');
        var rm = e.target.closest('[data-remove]');
        var up = e.target.closest('[data-up]');
        if (ed) { editing[key] = ed.dataset.edit; Admin.render(); return; }
        if (up) {
          var l = Store.list(key), i = -1;
          l.forEach(function (x, n) { if (x.id === up.dataset.up) i = n; });
          if (i > 0) { var t = l[i - 1]; l[i - 1] = l[i]; l[i] = t; Store.save(key, l); Admin.render(); }
          return;
        }
        if (rm) {
          if (!confirm('确定删除？')) return;
          var l2 = Store.list(key).filter(function (x) { return x.id !== rm.dataset.remove; });
          Store.save(key, l2); Admin.render(); Toast.show('已删除', 'ok');
        }
      });

      var sv = box.querySelector('[data-save]');
      sv.addEventListener('click', function () {
        var data = {}, ok = false;
        U.$$('[data-f]', box).forEach(function (inp) {
          var k = inp.dataset.f;
          var f = null;
          sc.fields.forEach(function (x) { if (x.k === k) f = x; });
          if (inp.type === 'checkbox') { data[k] = inp.checked; return; }
          var val = inp.value.trim();
          if (val) ok = true;
          if (f && f.type === 'number') val = parseFloat(val) || 0;
          if (f && f.type === 'tags') val = val.split(/[\s,，]+/).filter(Boolean);
          data[k] = val;
        });
        if (!ok) { Toast.show('请至少填写一项内容', 'bad'); return; }

        var l = Store.list(key);
        if (item) {
          l.forEach(function (x) { if (x.id === item.id) Object.assign(x, data); });
        } else {
          data.id = U.uid();
          if (key === 'posts') { data.date = data.date || U.now(); data.likes = 0; data.comments = []; }
          if (!data.date && (key === 'announcements' || key === 'history' || key === 'replays')) data.date = U.today();
          l.unshift(data);
        }
        Store.save(key, l);
        editing[key] = null;
        Admin.render();
        Sections.render();
        Toast.show('已保存', 'ok');
      });

      var cc = box.querySelector('[data-cancel]');
      if (cc) cc.addEventListener('click', function () { editing[key] = null; Admin.render(); });
    },

    rowsHTML: function (key, list) {
      return list.map(function (x) {
        var t = x.title || x.name || x.content || x.text || x.item || x.code || x.author || '(无标题)';
        var extra = '';
        if (x.date) extra = ' · ' + x.date;
        if (x.amount != null) extra = ' · ¥' + x.amount;
        if (x.status) extra = ' · ' + x.status;
        return '<div class="admin-row">' +
          '<button data-up="' + x.id + '" title="上移">↑</button>' +
          '<span class="t">' + U.esc(String(t).slice(0, 40)) + U.esc(extra) + '</span>' +
          '<button data-edit="' + x.id + '">编辑</button>' +
          '<button data-remove="' + x.id + '">删除</button></div>';
      }).join('') || '<p class="hint">暂无数据</p>';
    },

    /* ---------- 投票管理 ---------- */
    pollPane: function (box) {
      var polls = Store.list('polls');
      box.innerHTML = '<div class="admin-pane">' +
        '<div class="admin-form">' +
          '<select id="pollPick"><option value="">+ 新建投票</option>' +
          polls.map(function (p) { return '<option value="' + p.id + '">' + U.esc(p.title) + '</option>'; }).join('') +
          '</select>' +
          '<div class="fr"><input id="pollTitle" placeholder="投票标题" /></div>' +
          '<div class="fr"><input id="pollDesc" placeholder="投票说明（可选）" /></div>' +
          '<textarea id="pollOpts" rows="4" placeholder="选项，每行一个"></textarea>' +
          '<label><input type="checkbox" id="pollMulti" /> 允许多选</label>' +
          '<label><input type="checkbox" id="pollActive" checked /> 启用</label>' +
          '<div class="fr">' +
            '<button class="btn primary" id="pollSave">保存投票</button>' +
            '<button class="btn ghost" id="pollClear">清空票数</button>' +
            '<button class="btn ghost" id="pollToggle">启/停用</button>' +
          '</div>' +
        '</div>' +
        '<div class="admin-list" id="pollRows">' +
          polls.map(function (p) {
            return '<div class="admin-row"><span class="t">' + U.esc(p.title) +
              ' · ' + p.options.length + ' 项' + (p.active === false ? ' · 已停用' : '') + '</span>' +
              '<button data-edit="' + p.id + '" class="poll-edit">编辑</button>' +
              '<button data-remove="' + p.id + '" class="poll-del">删除</button></div>';
          }).join('') + '</div>' +
        '<p class="hint">保存会覆盖当前投票的题目与选项（不影响已有票数）；清空票数用于重新计票。</p>' +
      '</div>';

      function fill(id) {
        var p = null;
        polls.forEach(function (x) { if (x.id === id) p = x; });
        if (!p) { U.$('#pollTitle').value = ''; U.$('#pollDesc').value = ''; U.$('#pollOpts').value = ''; return; }
        U.$('#pollTitle').value = p.title || '';
        U.$('#pollDesc').value = p.desc || '';
        U.$('#pollOpts').value = p.options.map(function (o) { return o.text; }).join('\n');
        U.$('#pollMulti').checked = !!p.multi;
        U.$('#pollActive').checked = p.active !== false;
      }
      U.$('#pollPick').addEventListener('change', function () { fill(this.value); });

      U.$$('#pollRows .poll-edit').forEach(function (b) {
        b.addEventListener('click', function () {
          U.$('#pollPick').value = b.dataset.edit; fill(b.dataset.edit);
        });
      });
      U.$$('#pollRows .poll-del').forEach(function (b) {
        b.addEventListener('click', function () {
          if (!confirm('删除该投票？')) return;
          Store.save('polls', Store.list('polls').filter(function (p) { return p.id !== b.dataset.remove; }));
          Admin.render(); Sections.render(); Toast.show('已删除', 'ok');
        });
      });

      U.$('#pollSave').addEventListener('click', function () {
        var id = U.$('#pollPick').value;
        var title = U.$('#pollTitle').value.trim();
        var opts = U.$('#pollOpts').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
        if (!title || !opts.length) { Toast.show('请填写标题与至少一个选项', 'bad'); return; }
        var list = Store.list('polls');
        if (id) {
          list.forEach(function (p) {
            if (p.id === id) {
              p.title = title; p.desc = U.$('#pollDesc').value.trim();
              p.multi = U.$('#pollMulti').checked; p.active = U.$('#pollActive').checked;
              p.options = opts.map(function (t) {
                var old = null;
                p.options.forEach(function (o) { if (o.text === t) old = o; });
                return { text: t, votes: old ? old.votes : 0 };
              });
            }
          });
        } else {
          list.push({
            id: U.uid(), title: title, desc: U.$('#pollDesc').value.trim(),
            multi: U.$('#pollMulti').checked, active: U.$('#pollActive').checked,
            options: opts.map(function (t) { return { text: t, votes: 0 }; })
          });
        }
        Store.save('polls', list);
        Admin.render(); Sections.render();
        Toast.show('投票已保存', 'ok');
      });

      U.$('#pollClear').addEventListener('click', function () {
        var id = U.$('#pollPick').value;
        if (!id) { Toast.show('请先选择投票', 'bad'); return; }
        var list = Store.list('polls');
        list.forEach(function (p) { if (p.id === id) p.options.forEach(function (o) { o.votes = 0; }); });
        Store.save('polls', list);
        Sections.render(); Toast.show('票数已清空', 'ok');
      });

      U.$('#pollToggle').addEventListener('click', function () {
        var id = U.$('#pollPick').value;
        if (!id) { Toast.show('请先选择投票', 'bad'); return; }
        var list = Store.list('polls');
        list.forEach(function (p) { if (p.id === id) p.active = p.active === false; });
        Store.save('polls', list);
        Admin.render(); Sections.render(); Toast.show('状态已切换', 'ok');
      });
    },

    /* ---------- 内测卡密 ---------- */
    keyPane: function (box) {
      var keys = Store.list('keys');
      box.innerHTML = '<div class="admin-pane">' +
        '<div class="admin-form">' +
          '<div class="fr"><input id="keyCount" type="number" value="10" min="1" max="200" placeholder="数量" /></div>' +
          '<button class="btn primary" id="keyGen">生成内测卡密</button>' +
        '</div>' +
        '<div class="admin-list" id="keyRows">' + keys.map(function (k) {
          return '<div class="admin-row"><span class="t">' + U.esc(k.code) +
            (k.used ? ' · 已使用' : ' · 未使用') + '</span>' +
            '<button data-kcopy="' + U.esc(k.code) + '">复制</button>' +
            '<button data-kreset="' + k.id + '">重置</button>' +
            '<button data-kdel="' + k.id + '">删除</button></div>';
        }).join('') + '</div>' +
        '<p class="hint">每张卡密只能发布一条帖子，发布后自动核销；重置可恢复为未使用。</p>' +
      '</div>';

      U.$('#keyGen').addEventListener('click', function () {
        var n = parseInt(U.$('#keyCount').value, 10) || 10;
        var keys2 = Store.list('keys');
        for (var i = 0; i < n; i++) {
          keys2.push({ id: U.uid(), code: randKey(), used: false });
        }
        Store.save('keys', keys2); Admin.render(); Toast.show('已生成 ' + n + ' 张卡密', 'ok');
      });

      U.$('#keyRows').addEventListener('click', function (e) {
        var t = e.target;
        var c = t.closest('[data-kcopy]');
        if (c) { U.copy(c.dataset.kcopy); return; }
        var r = t.closest('[data-kreset]');
        if (r) {
          var l = Store.list('keys');
          l.forEach(function (k) { if (k.id === r.dataset.kreset) k.used = false; });
          Store.save('keys', l); Admin.render(); Toast.show('已重置', 'ok'); return;
        }
        var d = t.closest('[data-kdel]');
        if (d) {
          Store.save('keys', Store.list('keys').filter(function (k) { return k.id !== d.dataset.kdel; }));
          Admin.render(); Toast.show('已删除', 'ok');
        }
      });
    },

    /* ---------- 首页配置（配置要求） ---------- */
    homePane: function (box) {
      var ov = Store.get('specOverride', null) || {};
      var sp = window.SEED.spec;
      var val = function (a, b) {
        return U.esc(ov[a] != null ? ov[a] : sp[a]);
      };
      var val2 = function (g, k) {
        return U.esc((ov[g] && ov[g][k] != null) ? ov[g][k] : sp[g][k]);
      };

      box.innerHTML = '<div class="admin-pane"><div class="admin-form">' +
        '<div class="fr"><input id="spTip" value="' + val('tip') + '" placeholder="顶部提示语" /></div>' +
        '<h4>移动端</h4>' +
        '<div class="fr"><input id="spMmin" value="' + val2('mobile', 'min') + '" placeholder="移动端最低配置" /></div>' +
        '<div class="fr"><input id="spMrec" value="' + val2('mobile', 'rec') + '" placeholder="移动端推荐配置" /></div>' +
        '<div class="fr"><input id="spMnote" value="' + val2('mobile', 'note') + '" placeholder="移动端备注" /></div>' +
        '<h4>电脑端</h4>' +
        '<div class="fr"><input id="spPmin" value="' + val2('pc', 'min') + '" placeholder="电脑端最低配置" /></div>' +
        '<div class="fr"><input id="spPrec" value="' + val2('pc', 'rec') + '" placeholder="电脑端推荐配置" /></div>' +
        '<div class="fr"><input id="spPnote" value="' + val2('pc', 'note') + '" placeholder="电脑端备注" /></div>' +
        '<div class="fr"><button class="btn primary" id="spSave">保存</button>' +
        '<button class="btn ghost" id="spReset">恢复默认</button></div>' +
      '</div></div>';

      U.$('#spSave').addEventListener('click', function () {
        Store.set('specOverride', {
          tip: U.$('#spTip').value.trim(),
          mobile: {
            min: U.$('#spMmin').value.trim(),
            rec: U.$('#spMrec').value.trim(),
            note: U.$('#spMnote').value.trim()
          },
          pc: {
            min: U.$('#spPmin').value.trim(),
            rec: U.$('#spPrec').value.trim(),
            note: U.$('#spPnote').value.trim()
          }
        });
        Sections.render(); Toast.show('配置要求已保存', 'ok');
      });
      U.$('#spReset').addEventListener('click', function () {
        Store.set('specOverride', null);
        Admin.render(); Sections.render(); Toast.show('已恢复默认', 'ok');
      });
    },

    /* ---------- 服务器设置 ---------- */
    serverPane: function (box) {
      box.innerHTML = '<div class="admin-pane"><div class="admin-form">' +
        '<label><input type="checkbox" id="svOnline"' + (window.SITE.serverOnline ? ' checked' : '') +
          ' /> 服务器运行状态（运行中 / 已关闭）</label>' +
        '<div class="fr"><input id="svAddr" value="' + U.esc(window.SITE.serverAddr) + '" placeholder="服务器地址" /></div>' +
        '<div class="fr"><input id="svQq" value="' + U.esc(window.SITE.qq) + '" placeholder="QQ 群" /></div>' +
        '<div class="fr"><input id="svBrand" value="' + U.esc(window.SITE.brand) + '" placeholder="品牌名" /></div>' +
        '<div class="fr"><input id="svSlogan" value="' + U.esc(window.SITE.slogan) + '" placeholder="一句话简介" /></div>' +
        '<label><input type="checkbox" id="svBeta"' + (window.SITE.betaMode ? ' checked' : '') + ' /> 内测模式（发动态需卡密）</label>' +
        '<button class="btn primary" id="svSave">保存</button>' +
        '<p class="hint">设置保存在本机浏览器；若要永久生效，请同步修改 <b>assets/js/config.js</b>。</p>' +
      '</div></div>';

      U.$('#svSave').addEventListener('click', function () {
        window.SITE.serverOnline = U.$('#svOnline').checked;
        window.SITE.serverAddr = U.$('#svAddr').value.trim() || window.SITE.serverAddr;
        window.SITE.qq = U.$('#svQq').value.trim() || window.SITE.qq;
        window.SITE.brand = U.$('#svBrand').value.trim() || window.SITE.brand;
        window.SITE.slogan = U.$('#svSlogan').value.trim() || window.SITE.slogan;
        window.SITE.betaMode = U.$('#svBeta').checked;
        Store.set('siteOverride', {
          serverOnline: window.SITE.serverOnline, serverAddr: window.SITE.serverAddr,
          qq: window.SITE.qq, brand: window.SITE.brand, slogan: window.SITE.slogan,
          betaMode: window.SITE.betaMode
        });
        U.$('#postKeyRow').hidden = !window.SITE.betaMode;
        Sections.render();
        Toast.show('已保存', 'ok');
      });
    },

    /* ---------- 访问统计 ---------- */
    statPane: function (box) {
      var s = Store.stats(), d = U.today();
      var today = s.days[d] || { pv: 0, uv: 0 };
      var days = Store.last14();
      var max = Math.max.apply(null, days.map(function (x) { return x.pv; }).concat([1]));
      var dev = s.devices || {};
      var devTotal = Object.keys(dev).reduce(function (a, k) { return a + dev[k]; }, 0) || 1;

      box.innerHTML = '<div class="admin-pane">' +
        '<div class="admin-stat">' +
          '<div class="mini-stat"><b>' + today.pv + '</b><span>今日访问 PV</span></div>' +
          '<div class="mini-stat"><b>' + today.uv + '</b><span>今日访客 UV</span></div>' +
          '<div class="mini-stat"><b>' + s.totalPv + '</b><span>累计访问</span></div>' +
          '<div class="mini-stat"><b>' + s.totalUv + '</b><span>累计访客</span></div>' +
        '</div>' +
        '<h4>近 14 天访问趋势</h4>' +
        '<div class="chart">' + days.map(function (x) {
          var h = Math.round(x.pv * 100 / max);
          return '<div class="cb" style="height:' + Math.max(2, h) + '%" title="' + x.date + ' PV ' + x.pv + ' UV ' + x.uv + '">' +
            '<span>' + x.date.slice(8) + '</span></div>';
        }).join('') + '</div>' +
        '<h4>设备占比</h4>' +
        '<div class="devices">' + Object.keys(dev).map(function (k) {
          return '<div class="device">' + U.esc(k) + '：' + Math.round(dev[k] * 100 / devTotal) + '%</div>';
        }).join('') + '</div>' +
        '<p class="hint">统计自启用起记录：每次打开官网（PC / 手机端）自动上报一次访问，同一设备每天最多计一次访客（UV）。</p>' +
      '</div>';
    },

    /* ---------- 数据 ---------- */
    dataPane: function (box) {
      box.innerHTML = '<div class="admin-pane">' +
        '<button class="btn ghost" id="dExport">导出全部数据 JSON</button>' +
        '<button class="btn ghost" id="dImport">导入 JSON</button>' +
        '<button class="btn ghost" id="dReset">重置为初始内容</button>' +
        '<textarea id="dJson" rows="5" placeholder="导出的 JSON 会显示在这里"></textarea>' +
        '<p class="hint">数据保存在浏览器 localStorage，换设备或清除缓存会丢失；接后端时可直接把这段 JSON 迁过去。</p>' +
      '</div>';

      U.$('#dExport').addEventListener('click', function () {
        var out = {};
        Object.keys(window.SEED).forEach(function (k) { out[k] = Store.list(k); });
        U.$('#dJson').value = JSON.stringify(out, null, 2);
        Toast.show('已导出', 'ok');
      });
      U.$('#dImport').addEventListener('click', function () {
        try {
          var o = JSON.parse(U.$('#dJson').value);
          Object.keys(o).forEach(function (k) { Store.save(k, o[k]); });
          Sections.render(); Admin.render(); Toast.show('导入成功', 'ok');
        } catch (e) { Toast.show('JSON 格式有误', 'bad'); }
      });
      U.$('#dReset').addEventListener('click', function () {
        if (!confirm('确定把所有内容恢复为初始内容？')) return;
        Object.keys(window.SEED).forEach(function (k) { Store.reset(k); });
        Sections.render(); Admin.render(); Toast.show('已重置', 'ok');
      });
    }
  };

  function randKey() {
    var s = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', out = '', i;
    for (i = 0; i < 12; i++) out += s[Math.floor(Math.random() * s.length)];
    return 'BEEF-' + out.slice(0, 4) + '-' + out.slice(4, 8) + '-' + out.slice(8);
  }

  window.Admin = Admin;
})();
