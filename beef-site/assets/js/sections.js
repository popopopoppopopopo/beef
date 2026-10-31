/* ============================================================
 * 牛肉 BEEF · 各区块渲染
 * ============================================================ */
(function () {
  'use strict';

  var S = window.SITE;

  var state = { sort: 'new', type: '全部', pendingImg: '', annKw: '', ruleKw: '', banKw: '', taskKw: '' };
  var bound = {};

  var Sct = {

    /* ================= 通用 ================= */
    staticText: function () {
      var $ = U.$;
      document.title = S.brand + ' ' + S.brandEn + ' · 官方网站';
      $('#brandName').textContent = S.brand;
      $('#brandSub').textContent = S.brandEn + ' SURVIVAL';
      $('#heroEn').textContent = S.brandEn;
      $('#heroSlogan').textContent = S.slogan;
      $('#serverAddr').textContent = S.serverAddr + (S.serverPort ? ':' + S.serverPort : '');
      $('#qqGroup').textContent = S.qq;
      $('#sinceDate').textContent = S.since;

      var days = U.daysBetween(S.since, U.today());
      $('#uptime').textContent = days + ' 天';

      var st = $('#serverStatus');
      st.classList.toggle('off', !S.serverOnline);
      st.querySelector('.status-txt').textContent = S.serverOnline ? '服务器运行中' : '服务器已关闭';

      $('#footBrand').textContent = S.brand + ' ' + S.brandEn;
      $('#footDesc').textContent = S.desc;
      $('#copyRight').textContent = '© ' + new Date().getFullYear() + ' ' + S.brand + ' ' + S.brandEn + ' · 保留所有权利';
      $('#dlTitle').textContent = S.brand + ' ' + S.brandEn + ' 官方客户端';
      $('#dlVer').textContent = S.apkVersion;
      $('#chatState').textContent = S.serverOnline ? '服务器实时聊天 · 本地演示' : '服务器已关闭';
    },

    /* ================= 首页 ================= */
    features: function () {
      var box = U.$('#featureGrid');
      box.innerHTML = Store.list('features').map(function (f) {
        return '<div class="card glass feature-card" data-card="f-' + U.esc(f.id || f.title) + '">' +
          '<span class="ico">' + f.icon + '</span>' +
          '<h3>' + U.esc(f.title) + '</h3><p>' + U.esc(f.text) + '</p></div>';
      }).join('');
    },

    about: function () {
      // 历史
      U.$('#historyList').innerHTML = Store.list('history').map(function (h) {
        return '<div class="tl-item"><div class="tl-date">' + U.esc(h.date) + '</div>' +
          '<div class="tl-text">' + U.esc(h.content) + '</div></div>';
      }).join('');

      // 团队
      U.$('#teamList').innerHTML = Store.list('team').map(function (m) {
        return '<div class="team-item' + (m.role === '荣誉' ? ' honor' : '') + '">' +
          '<div class="nm">' + U.esc(m.name) + '</div>' +
          '<div class="rl">' + U.esc(m.role) + '</div>' +
          '<div class="ds">' + U.esc(m.desc) + '</div></div>';
      }).join('');

      // 配置要求（管理员面板可覆盖）
      var ovSpec = Store.get('specOverride', null);
      var spec = ovSpec ? Object.assign({}, window.SEED.spec, ovSpec) : window.SEED.spec;
      U.$('#specBox').innerHTML =
        '<p class="hint">' + U.esc(spec.tip) + '</p>' +
        '<div class="spec-card"><h4>移动端 · 手机 / 平板</h4>' +
          '<div class="row"><span>最低配置</span><span>' + U.esc(spec.mobile.min) + '</span></div>' +
          '<div class="row"><span>推荐配置</span><span>' + U.esc(spec.mobile.rec) + '</span></div>' +
          '<div class="note">' + U.esc(spec.mobile.note) + '</div></div>' +
        '<div class="spec-card"><h4>电脑端</h4>' +
          '<div class="row"><span>最低配置</span><span>' + U.esc(spec.pc.min) + '</span></div>' +
          '<div class="row"><span>推荐配置</span><span>' + U.esc(spec.pc.rec) + '</span></div>' +
          '<div class="note">' + U.esc(spec.pc.note) + '</div></div>';

      // 规则速览
      U.$('#ruleBrief').innerHTML = Store.list('rules').slice(0, 4).map(function (r) {
        return '<div class="tl-item"><div class="tl-title">' + U.esc(r.title) + '</div>' +
          '<div class="tl-text">' + U.esc(r.text) + '</div></div>';
      }).join('');
    },

    ticker: function () {
      var list = Store.list('announcements');
      var items = list.map(function (a) { return '<span>📣 ' + U.esc(a.title) + '</span>'; });
      if (!items.length) items = ['<span>📣 暂无公告</span>'];
      var html = items.join('');
      U.$('#tickerTrack').innerHTML = html + html; // 无缝循环
    },

    /* ================= 公告 ================= */
    ann: function () {
      var kw = state.annKw;
      var list = Store.list('announcements').slice().sort(function (a, b) {
        if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
        return (b.date || '').localeCompare(a.date || '');
      });
      var html = list.filter(function (a) {
        return !kw || (a.title + a.content).toLowerCase().indexOf(kw.toLowerCase()) >= 0;
      }).map(function (a) {
        return '<div class="item' + (a.pinned ? ' pinned' : '') + '" data-card="a-' + a.id + '">' +
          '<h4>' + U.highlight(U.esc(a.title), kw) +
          (a.pinned ? '<span class="badge">置顶</span>' : '') + '</h4>' +
          '<div class="meta"><span>' + U.esc(a.date) + '</span></div>' +
          '<div class="body">' + U.highlight(U.esc(a.content), kw) + '</div></div>';
      }).join('');
      U.$('#annList').innerHTML = html || '<div class="item"><p class="hint">暂无公告</p></div>';
    },

    /* ================= 动态 ================= */
    posts: function () {
      var list = Store.list('posts').slice();
      if (state.type !== '全部') list = list.filter(function (p) { return p.type === state.type; });
      if (state.sort === 'hot') list.sort(function (a, b) { return (b.likes || 0) - (a.likes || 0); });
      else list.sort(function (a, b) {
        if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
        return String(b.date).localeCompare(String(a.date));
      });

      U.$('#postList').innerHTML = list.map(function (p) { return Sct.postHTML(p); }).join('') ||
        '<div class="item"><p class="hint">暂无动态，来发第一条吧</p></div>';
    },

    postHTML: function (p) {
      var liked = Store.liked(p.id);
      var tags = (p.tags || []).map(function (t) { return '<i>#' + U.esc(t) + '</i>'; }).join('');
      var cmts = (p.comments || []).map(function (c) {
        return '<div class="comment"><b>' + U.esc(c.name) + '</b>' + U.esc(c.text) +
          '<span class="tm"> ' + U.esc(c.time || '') + '</span></div>';
      }).join('');
      return '<div class="item post-card' + (p.pinned ? ' pinned' : '') + '" data-card="p-' + p.id + '">' +
        '<div class="post-head">' +
          '<span class="nm">' + U.esc(p.author) + '</span>' +
          '<span class="badge ' + (p.type === '官方' ? 'official' : 'player') + '">' + U.esc(p.type) + '</span>' +
          (p.pinned ? '<span class="badge">置顶</span>' : '') +
          '<span class="tm">' + U.esc(p.date) + '</span>' +
        '</div>' +
        '<div class="post-body">' + U.esc(p.content) + '</div>' +
        (p.image ? '<img class="post-img" src="' + p.image + '" alt="配图" />' : '') +
        (tags ? '<div class="post-tags">' + tags + '</div>' : '') +
        '<div class="post-actions">' +
          '<button data-like="' + p.id + '">' + (liked ? '❤️' : '🤍') + ' ' + (p.likes || 0) + '</button>' +
          '<button data-cmt="' + p.id + '">💬 评论</button>' +
          (String(p.id).indexOf('u') === 0 ? '<button data-del="' + p.id + '">删除</button>' : '') +
        '</div>' +
        '<div class="comments" data-cbox="' + p.id + '" hidden>' + cmts +
          '<div class="composer-row"><input placeholder="你的昵称" data-cname="' + p.id + '" />' +
          '<input placeholder="说点什么…" data-ctext="' + p.id + '" />' +
          '<button class="btn tiny primary" data-csend="' + p.id + '">发送</button></div>' +
        '</div>' +
      '</div>';
    },

    bindPosts: function () {
      var $ = U.$;
      $('#postKeyRow').hidden = !S.betaMode;
      if (bound.posts) return; bound.posts = true;

      $('#postSubmit').addEventListener('click', function () {
        var nick = $('#postNick').value.trim();
        var content = $('#postContent').value.trim();
        if (!nick) { Toast.show('请填写游戏昵称', 'bad'); return; }
        if (!content) { Toast.show('请填写内容', 'bad'); return; }

        if (S.betaMode) {
          var key = $('#postKey').value.trim();
          var keys = Store.list('keys');
          var idx = -1, i;
          for (i = 0; i < keys.length; i++) if (keys[i].code === key && !keys[i].used) { idx = i; break; }
          if (idx < 0) { Toast.show('卡密无效或已使用', 'bad'); return; }
          keys[idx].used = true; Store.save('keys', keys);
        }

        var tags = $('#postTags').value.trim().split(/[\s,，]+/).filter(Boolean).slice(0, 5);
        var list = Store.list('posts');
        list.unshift({
          id: U.uid(), type: '玩家', author: nick, date: U.now(),
          content: content, tags: tags, image: state.pendingImg,
          likes: 0, pinned: false, comments: []
        });
        Store.save('posts', list);
        state.pendingImg = '';
        $('#postContent').value = ''; $('#postTags').value = ''; $('#postKey').value = '';
        $('#postImgTip').textContent = '';
        Store.nick(nick);
        Sct.posts();
        if (window.Glass) { Glass.collect(); }
        Toast.show('发布成功', 'ok');
      });

      var imgBtn = $('#postImgBtn');
      var picker = U.el('input');
      picker.type = 'file'; picker.accept = 'image/*'; picker.style.display = 'none';
      document.body.appendChild(picker);
      imgBtn.addEventListener('click', function () { picker.click(); });
      picker.addEventListener('change', function () {
        U.readImage(picker.files[0], function (data) {
          state.pendingImg = data;
          $('#postImgTip').textContent = data ? '已选择图片（≤1.5MB）' : '';
        });
        picker.value = '';
      });

      U.$$('#feedSort button').forEach(function (b) {
        b.addEventListener('click', function () {
          U.$$('#feedSort button').forEach(function (x) { x.classList.remove('on'); });
          b.classList.add('on'); state.sort = b.dataset.sort; Sct.posts();
        });
      });
      U.$$('#feedType button').forEach(function (b) {
        b.addEventListener('click', function () {
          U.$$('#feedType button').forEach(function (x) { x.classList.remove('on'); });
          b.classList.add('on'); state.type = b.dataset.type; Sct.posts();
        });
      });

      $('#postList').addEventListener('click', function (e) {
        var t = e.target;
        var like = t.closest('[data-like]');
        var cmt = t.closest('[data-cmt]');
        var del = t.closest('[data-del]');
        var send = t.closest('[data-csend]');

        if (like) {
          var id = like.dataset.like;
          if (Store.liked(id)) { Toast.show('你已经点过赞了', 'bad'); return; }
          var list = Store.list('posts'), p = null;
          list.forEach(function (x) { if (x.id === id) p = x; });
          if (p) { p.likes = (p.likes || 0) + 1; Store.save('posts', list); Store.setLiked(id); Sct.posts(); }
          return;
        }
        if (cmt) {
          var box = $('[data-cbox="' + cmt.dataset.cmt + '"]');
          if (box) box.hidden = !box.hidden;
          return;
        }
        if (del) {
          if (!confirm('确定删除这条动态？')) return;
          var l2 = Store.list('posts').filter(function (x) { return x.id !== del.dataset.del; });
          Store.save('posts', l2); Sct.posts(); Toast.show('已删除', 'ok');
          return;
        }
        if (send) {
          var pid = send.dataset.csend;
          var nm = $('[data-cname="' + pid + '"]').value.trim() || '匿名';
          var tx = $('[data-ctext="' + pid + '"]').value.trim();
          if (!tx) { Toast.show('请输入评论内容', 'bad'); return; }
          var l3 = Store.list('posts');
          l3.forEach(function (x) {
            if (x.id === pid) {
              x.comments = x.comments || [];
              x.comments.push({ name: nm, text: tx, time: U.hm() });
            }
          });
          Store.save('posts', l3); Sct.posts();
          Toast.show('评论已发布', 'ok');
        }
      });
    },

    /* ================= 商店 ================= */
    shop: function () {
      U.$('#shopGrid').innerHTML = Store.list('shop').map(function (g) {
        return '<div class="card glass shop-item" data-card="g-' + g.id + '">' +
          '<span class="ico">' + g.icon + '</span>' +
          '<div class="nm">' + U.esc(g.name) + '</div>' +
          '<div class="ds">' + U.esc(g.desc) + '</div>' +
          '<div class="pr">¥' + g.price + ' <small>起</small></div>' +
          '<button class="btn primary" data-buy="' + g.id + '">购买</button></div>';
      }).join('');

      if (!bound.shop) {
        bound.shop = true;
        U.$('#shopGrid').addEventListener('click', function (e) {
          var b = e.target.closest('[data-buy]');
          if (!b) return;
          var id = b.dataset.buy, item = null;
          Store.list('shop').forEach(function (g) { if (g.id === id) item = g; });
          if (item) Toast.show('「' + item.name + '」请加 QQ 群 ' + S.qq + ' 联系管理购买', 'ok');
        });
      }
    },

    /* ================= 投票 ================= */
    polls: function () {
      var box = U.$('#pollGrid');
      box.innerHTML = Store.list('polls').map(function (p) { return Sct.pollHTML(p); }).join('') ||
        '<div class="item"><p class="hint">暂无投票</p></div>';

      if (!bound.polls) {
        bound.polls = true;
        box.addEventListener('click', function (e) {
          var card = e.target.closest('.poll');
          if (!card || card.classList.contains('closed')) return;
          var pid = card.dataset.poll;
          var poll = null;
          Store.list('polls').forEach(function (p) { if (p.id === pid) poll = p; });
          if (!poll) return;

          var opt = e.target.closest('.opt');
          if (opt) {
            var idx = parseInt(opt.dataset.idx, 10);
            U.$$('.opt', card).forEach(function (o) { o.classList.remove('sel'); });
            card._sel = [idx];
            opt.classList.add('sel');
            return;
          }
          var sub = e.target.closest('[data-poll-submit]');
          if (sub) {
            var sel = card._sel || [];
            if (!sel.length) { Toast.show('请先选择一个选项', 'bad'); return; }
            // 本地乐观 +1 立即出结果，票数由服务端累加为准
            var list = Store.list('polls');
            list.forEach(function (p) {
              if (p.id === pid) sel.forEach(function (i) { if (p.options[i]) p.options[i].votes = (p.options[i].votes || 0) + 1; });
            });
            Store.setSilent('polls', list);
            Store.setVoted(pid, sel);
            Sct.polls();
            if (window.Glass) Glass.collect();
            Toast.show('投票成功，感谢参与', 'ok');
            if (window.Api) Api.vote(pid, sel).catch(function () {
              Toast.show('票数未能同步到服务器', 'bad');
            });
            return;
          }
          var clr = e.target.closest('[data-poll-clear]');
          if (clr) {
            Store.setVoted(pid, null);
            Sct.polls();
          }
        });
      }
    },

    pollHTML: function (p) {
      var my = Store.voted(p.id);
      var total = p.options.reduce(function (s, o) { return s + (o.votes || 0); }, 0);
      var voted = !!my;
      var opts = p.options.map(function (o, i) {
        var pct = total ? Math.round((o.votes || 0) * 100 / total) : 0;
        var mine = voted && my.indexOf(i) >= 0;
        return '<div class="opt' + (mine ? ' voted' : '') + '" data-idx="' + i + '">' +
          (voted ? '<div class="bar" style="width:' + pct + '%"></div>' : '') +
          '<span><span>' + (mine ? '✔ ' : '') + U.esc(o.text) + '</span>' +
          (voted ? '<span class="pct">' + pct + '% · ' + (o.votes || 0) + '</span>' : '') +
          '</span></div>';
      }).join('');

      return '<div class="card glass poll' + (voted ? ' closed' : '') + '" data-card="v-' + p.id + '" data-poll="' + p.id + '">' +
        '<h3>🗳️ ' + U.esc(p.title) + (p.multi ? '<span class="badge">多选</span>' : '') + '</h3>' +
        (p.desc ? '<div class="desc">' + U.esc(p.desc) + '</div>' : '') +
        opts +
        '<div class="poll-foot">' +
          '<span class="total">共 ' + total + ' 票' + (voted ? ' · 已投票' : '') + '</span>' +
          (voted ? '<button class="btn tiny ghost" data-poll-clear>重新投票</button>'
                 : '<button class="btn tiny primary" data-poll-submit>投票</button>') +
        '</div></div>';
    },

    /* ================= 便捷工具 ================= */
    quick: function () {
      var box = U.$('#quickGrid');
      if (box.dataset.built) return;
      box.dataset.built = '1';
      box.innerHTML = [
        // 坐标换算
        '<div class="card glass qtool" data-card="q-coord"><h3>📐 坐标换算</h3>' +
        '<div class="desc">主世界 ⇄ 下界（1:8）</div>' +
        '<div class="io"><input id="cx" type="number" placeholder="X" /><input id="cz" type="number" placeholder="Z" /></div>' +
        '<div class="io"><button class="btn tiny" data-coord="nether">主世界 → 下界</button>' +
        '<button class="btn tiny" data-coord="over">下界 → 主世界</button></div>' +
        '<div class="out" id="coordOut">等待输入…</div></div>',

        // 经验计算
        '<div class="card glass qtool" data-card="q-xp"><h3>✨ 经验计算器</h3>' +
        '<div class="desc">等级 ⇄ 累计经验值</div>' +
        '<div class="io"><input id="xpLv" type="number" placeholder="等级，如 30" min="0" /></div>' +
        '<div class="io"><button class="btn tiny" data-xp="toExp">等级 → 经验</button>' +
        '<input id="xpVal" type="number" placeholder="经验值" min="0" />' +
        '<button class="btn tiny" data-xp="toLv">经验 → 等级</button></div>' +
        '<div class="out" id="xpOut">等待输入…</div></div>',

        // 颜色代码
        '<div class="card glass qtool" data-card="q-color"><h3>🎨 颜色代码</h3>' +
        '<div class="desc">基岩版 § 颜色代码生成与预览</div>' +
        '<div class="io"><input id="clrText" placeholder="输入文字，如 牛肉" value="牛肉" /></div>' +
        '<div class="sw-color" id="clrSw"></div>' +
        '<div class="out" id="clrOut">§6牛肉</div></div>',

        // 抽奖
        '<div class="card glass qtool" data-card="q-lot"><h3>🎲 抽奖 / 随机</h3>' +
        '<div class="desc">从名单中随机抽取，每行一个名字</div>' +
        '<textarea id="lotNames" rows="3" placeholder="雪花牛&#10;牛腩&#10;牛排"></textarea>' +
        '<div class="io"><input id="lotCount" type="number" value="1" min="1" max="100" style="flex:0 0 90px" />' +
        '<button class="btn tiny primary" id="lotGo">开始抽取</button></div>' +
        '<div class="out" id="lotOut">等待抽取…</div></div>'
      ].join('');

      // 坐标
      box.addEventListener('click', function (e) {
        var c = e.target.closest('[data-coord]');
        if (c) {
          var x = parseFloat(U.$('#cx').value), z = parseFloat(U.$('#cz').value);
          if (isNaN(x) || isNaN(z)) { Toast.show('请输入 X 和 Z', 'bad'); return; }
          if (c.dataset.coord === 'nether') {
            U.$('#coordOut').innerHTML = '下界坐标：<b>' + Math.floor(x / 8) + ', ' + Math.floor(z / 8) + '</b>（Y 轴不变）';
          } else {
            U.$('#coordOut').innerHTML = '主世界坐标：<b>' + Math.floor(x * 8) + ', ' + Math.floor(z * 8) + '</b>';
          }
          return;
        }
        var xb = e.target.closest('[data-xp]');
        if (xb) {
          if (xb.dataset.xp === 'toExp') {
            var lv = parseInt(U.$('#xpLv').value, 10);
            if (isNaN(lv) || lv < 0) { Toast.show('请输入等级', 'bad'); return; }
            U.$('#xpOut').innerHTML = '等级 <b>' + lv + '</b> 需要累计经验 <b>' + xpTotal(lv) + '</b>';
          } else {
            var v = parseInt(U.$('#xpVal').value, 10);
            if (isNaN(v) || v < 0) { Toast.show('请输入经验值', 'bad'); return; }
            U.$('#xpOut').innerHTML = '经验 <b>' + v + '</b> 对应等级 <b>' + xpLevel(v) + '</b>';
          }
          return;
        }
      });

      // 颜色代码
      var colors = [
        ['0', '黑', '#000'], ['1', '深蓝', '#00A'], ['2', '深绿', '#0A0'], ['3', '湖蓝', '#0AA'],
        ['4', '深红', '#A00'], ['5', '紫', '#A0A'], ['6', '金', '#FA0'], ['7', '灰', '#AAA'],
        ['8', '深灰', '#555'], ['9', '蓝', '#55F'], ['a', '绿', '#5F5'], ['b', '天蓝', '#5FF'],
        ['c', '红', '#F55'], ['d', '粉', '#F5F'], ['e', '黄', '#FF5'], ['f', '白', '#FFF']
      ];
      var sw = U.$('#clrSw');
      sw.innerHTML = colors.map(function (c) {
        return '<button data-c="' + c[0] + '" title="§' + c[0] + ' ' + c[1] +
          '" style="background:' + c[2] + '"></button>';
      }).join('');
      sw.addEventListener('click', function (e) {
        var b = e.target.closest('[data-c]');
        if (!b) return;
        var code = b.dataset.c;
        var txt = U.$('#clrText').value || '';
        U.$('#clrOut').innerHTML = '§' + code + U.esc(txt) +
          '　→　<span style="color:' + colors.filter(function (c) { return c[0] === code; })[0][2] +
          ';font-weight:700">' + U.esc(txt) + '</span>';
      });

      // 抽奖
      U.$('#lotGo').addEventListener('click', function () {
        var names = U.$('#lotNames').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
        var n = parseInt(U.$('#lotCount').value, 10) || 1;
        if (!names.length) { Toast.show('请输入名单', 'bad'); return; }
        if (n > names.length) n = names.length;
        var pool = names.slice(), out = [];
        for (var i = 0; i < n; i++) {
          var k = Math.floor(Math.random() * pool.length);
          out.push(pool.splice(k, 1)[0]);
        }
        U.$('#lotOut').innerHTML = '🎉 ' + out.map(function (s) { return '<b>' + U.esc(s) + '</b>'; }).join('、');
      });
    },

    /* ================= 服务器工具 ================= */
    serverTools: function () {
      // 禁用物品
      var banKw = state.banKw;
      var bans = Store.list('bannedItems').filter(function (b) {
        return !banKw || (b.name + b.reason).toLowerCase().indexOf(banKw.toLowerCase()) >= 0;
      });
      U.$('#banList').innerHTML = bans.map(function (b) {
        return '<div class="item"><h4>🚫 ' + U.highlight(U.esc(b.name), banKw) + '</h4>' +
          '<div class="meta"><span>' + U.highlight(U.esc(b.reason), banKw) + '</span></div></div>';
      }).join('') || '<div class="item"><p class="hint">没有找到相关物品，可能是允许的</p></div>';

      // 任务
      var tKw = state.taskKw;
      var tasks = Store.list('tasks').filter(function (t) {
        return !tKw || (t.name + t.desc).toLowerCase().indexOf(tKw.toLowerCase()) >= 0;
      });
      U.$('#taskList').innerHTML = tasks.map(function (t) {
        return '<div class="item"><h4>🎯 ' + U.highlight(U.esc(t.name), tKw) + '</h4>' +
          '<div class="meta"><span>' + U.highlight(U.esc(t.desc), tKw) + '</span></div>' +
          '<div class="body">奖励：' + U.esc(t.reward) + '</div></div>';
      }).join('') || '<div class="item"><p class="hint">没有找到相关任务</p></div>';

      // 物价表
      var prices = Store.list('prices');
      U.$('#priceTable').innerHTML =
        '<thead><tr><th>物品</th><th>买入价</th><th>回收价</th><th>差价</th><th>利润率</th></tr></thead><tbody>' +
        prices.map(function (p) {
          var d = p.sell - p.buy;
          var r = p.buy ? Math.round(d * 100 / p.buy) : 0;
          return '<tr><td>' + U.esc(p.item) + '</td><td>' + p.buy + '</td><td>' + p.sell + '</td>' +
            '<td style="color:' + (d >= 0 ? 'var(--ok)' : 'var(--bad)') + '">' + d + '</td>' +
            '<td>' + r + '%</td></tr>';
        }).join('') + '</tbody>';

      var sel = U.$('#ecoItem');
      var keep = sel.value;
      sel.innerHTML = prices.map(function (p) {
        return '<option value="' + U.esc(p.item) + '">' + U.esc(p.item) + '</option>';
      }).join('');
      if (keep && prices.some(function (p) { return p.item === keep; })) sel.value = keep;

      if (!bound.tools) {
        bound.tools = true;
        U.$('#toolTabs').addEventListener('click', function (e) {
          var b = e.target.closest('[data-tab]');
          if (!b) return;
          U.$$('#toolTabs button').forEach(function (x) { x.classList.remove('on'); });
          b.classList.add('on');
          U.$$('.tool-pane').forEach(function (p) { p.hidden = p.dataset.pane !== b.dataset.tab; });
        });
        U.$('#banSearch').addEventListener('input', function () { state.banKw = this.value.trim(); Sct.serverTools(); });
        U.$('#taskSearch').addEventListener('input', function () { state.taskKw = this.value.trim(); Sct.serverTools(); });
        U.$('#banAdd').addEventListener('click', function () {
          var n = U.$('#banName').value.trim(), r = U.$('#banReason').value.trim();
          if (!n) { Toast.show('请输入物品名称', 'bad'); return; }
          var l = Store.list('bannedItems');
          l.unshift({ id: U.uid(), name: n, reason: r || '管理团队判定' });
          Store.save('bannedItems', l);
          U.$('#banName').value = ''; U.$('#banReason').value = '';
          Sct.serverTools(); Toast.show('已添加', 'ok');
        });
        U.$('#taskAdd').addEventListener('click', function () {
          var n = U.$('#taskName').value.trim();
          if (!n) { Toast.show('请输入任务名称', 'bad'); return; }
          var l = Store.list('tasks');
          l.unshift({
            id: U.uid(), name: n,
            desc: U.$('#taskDesc').value.trim() || '暂无描述',
            reward: U.$('#taskReward').value.trim() || '待定'
          });
          Store.save('tasks', l);
          U.$('#taskName').value = ''; U.$('#taskDesc').value = ''; U.$('#taskReward').value = '';
          Sct.serverTools(); Toast.show('已添加', 'ok');
        });
        U.$('#toolAdminBtn').addEventListener('click', function () {
          if (!Store.adminOn()) { Modal.open('admin'); Toast.show('请先登录管理员面板', 'bad'); return; }
          var on = U.$('#banAddRow').hidden;
          U.$('#banAddRow').hidden = !on;
          U.$('#taskAddRow').hidden = !on;
          Toast.show(on ? '已开启管理模式' : '已退出管理');
        });
        U.$('#ecoCalc').addEventListener('click', function () { Sct.eco(); });
      }
      Sct.eco();
    },

    eco: function () {
      var name = U.$('#ecoItem').value;
      var qty = parseInt(U.$('#ecoQty').value, 10) || 0;
      var tax = parseFloat(U.$('#ecoTax').value) || 0;
      var fee = parseFloat(U.$('#ecoFee').value) || 0;
      var item = null;
      Store.list('prices').forEach(function (p) { if (p.item === name) item = p; });
      if (!item) { U.$('#ecoOut').innerHTML = '<p class="hint">请选择物品</p>'; return; }

      var cost = item.buy * qty + fee;
      var income = item.sell * qty * (1 - tax / 100);
      var profit = income - cost;
      var rate = cost ? Math.round(profit * 100 / cost) : 0;

      // 套利建议
      var best = null;
      Store.list('prices').forEach(function (p) {
        var g = p.sell * (1 - tax / 100) - p.buy;
        if (!best || g > best.g) best = { item: p.item, g: g };
      });

      U.$('#ecoOut').innerHTML =
        '<div class="kv"><span>物品</span><b>' + U.esc(item.item) + ' ×' + qty + '</b></div>' +
        '<div class="kv"><span>总投入（含手续费）</span><b>' + cost.toFixed(0) + '</b></div>' +
        '<div class="kv"><span>总收入（扣税 ' + tax + '%）</span><b>' + income.toFixed(0) + '</b></div>' +
        '<div class="kv"><span>净利润</span><b class="' + (profit >= 0 ? 'good' : 'warn') + '">' +
          (profit >= 0 ? '+' : '') + profit.toFixed(0) + '</b></div>' +
        '<div class="kv"><span>利润率</span><b class="' + (rate >= 0 ? 'good' : 'warn') + '">' + rate + '%</b></div>' +
        '<p class="hint" style="margin-top:8px">套利建议：' +
          (best && best.g > 0 ? '当前最优为 <b>' + U.esc(best.item) + '</b>，单件净收益 ' + best.g.toFixed(1)
                              : '当前税率下暂无正收益套利物品，建议降低税率或等待物价波动') + '</p>';
    },

    /* ================= 玩家公约 ================= */
    rules: function () {
      var kw = state.ruleKw;
      var list = Store.list('rules').filter(function (r) {
        return !kw || (r.title + r.text).toLowerCase().indexOf(kw.toLowerCase()) >= 0;
      });
      U.$('#ruleList').innerHTML = list.map(function (r, i) {
        return '<div class="item" data-card="r-' + r.id + '">' +
          '<h4>' + (i + 1) + '. ' + U.highlight(U.esc(r.title), kw) + '</h4>' +
          '<div class="body">' + U.highlight(U.esc(r.text), kw) + '</div></div>';
      }).join('') || '<div class="item"><p class="hint">没有匹配的规则</p></div>';
    },

    /* ================= 赛事 ================= */
    events: function () {
      var list = Store.list('events');
      U.$('#eventList').innerHTML = list.map(function (e) {
        return '<div class="card glass event" data-card="e-' + e.id + '">' +
          '<div class="eh"><h3>' + (e.icon || '🏁') + ' ' + U.esc(e.title) + '</h3>' +
          '<span class="status">' + U.esc(e.status) + '</span>' +
          (e.date ? '<span class="badge grey">' + U.esc(e.date) + '</span>' : '') + '</div>' +
          '<div class="body">' + U.esc(e.desc) + '</div></div>';
      }).join('') || '<div class="card glass"><p class="hint">暂无赛事活动</p></div>';

      var live = list.filter(function (e) { return e.status === '进行中'; });
      U.$('#eventNews').innerHTML = live.length
        ? live.map(function (e) { return '<p>🔥 ' + U.esc(e.title) + ' 正在进行中</p>'; }).join('')
        : '<p class="hint">暂无进行中赛事</p>';

      var rp = Store.list('replays');
      U.$('#replayList').innerHTML = rp.length
        ? rp.map(function (r) {
            return '<div class="item"><h4>' + U.esc(r.title) + '</h4>' +
              '<div class="meta"><span>' + U.esc(r.date) + '</span></div>' +
              '<a href="' + U.esc(r.url) + '" target="_blank" rel="noopener">前往观看 →</a></div>';
          }).join('')
        : '<p class="hint">暂无赛事回放</p>';
    },

    /* ================= 兑换码 ================= */
    codes: function () {
      var list = Store.list('codes');
      if (!bound.codes) {
        bound.codes = true;
        U.$('#codeList').addEventListener('click', function (e) {
          var b = e.target.closest('[data-code]');
          if (b) U.copy(b.dataset.code);
        });
      }
      U.$('#codeList').innerHTML = list.map(function (c) {
        return '<div class="item code-item" data-card="c-' + c.id + '">' +
          '<span class="cd">' + U.esc(c.code) + '</span>' +
          '<span class="rd">' + U.esc(c.reward) + '</span>' +
          '<span class="ex">' + (c.expire ? '有效期至 ' + U.esc(c.expire) : '长期有效') + '</span>' +
          '<button class="btn tiny primary" data-code="' + U.esc(c.code) + '">复制</button></div>';
      }).join('') || '<div class="item"><p class="hint">暂无可用兑换码</p></div>';
    },

    /* ================= 赞助 ================= */
    sponsor: function () {
      var rank = Store.list('sponsors').slice().sort(function (a, b) { return b.amount - a.amount; });
      U.$('#sponsorRank').innerHTML = rank.map(function (s, i) {
        return '<div class="rank-row' + (i < 3 ? ' top' + (i + 1) : '') + '">' +
          '<span class="no">' + (i + 1) + '</span>' +
          '<span class="nm">' + U.esc(s.name) + '</span>' +
          '<span class="am">¥' + s.amount + '</span></div>';
      }).join('') || '<p class="hint">还没有赞助记录，成为第一个吧</p>';

      var box = U.$('#sponsorQr');
      if (S.sponsorQr) {
        box.innerHTML = '<img src="' + U.esc(S.sponsorQr) + '" alt="赞助二维码" />';
      } else {
        box.innerHTML = '<div style="font-size:.75rem;color:#333;line-height:1.5;padding:8px">' +
          '二维码占位<br />在 <b>config.js</b><br />设置 <b>sponsorQr</b></div>';
      }
      var qb = U.$('#qrBox');
      var data = encodeURIComponent(S.serverAddr);
      qb.innerHTML = '<img alt="服务器地址二维码" src="https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=' +
        data + '" onerror="this.style.display=\'none\';this.parentNode.innerHTML=\'<div style=font-size:.72rem;color:#333;padding:6px>扫码占位</div>\'" />';
    },

    /* ================= 聊天 ================= */
    chat: function () {
      var log = U.$('#chatLog');
      log.innerHTML = Store.list('chat').map(function (m) {
        return '<div class="chat-msg"><span class="tm">' + U.esc(m.time) + '</span><b>' +
          U.esc(m.name) + '</b>' + U.esc(m.text) + '</div>';
      }).join('');
      log.scrollTop = log.scrollHeight;

      if (!bound.chat) {
        bound.chat = true;
        var send = function () {
          var nm = U.$('#chatName').value.trim() || Store.nick() || '匿名玩家';
          var tx = U.$('#chatMsg').value.trim();
          if (!tx) return;
          var list = Store.list('chat');
          list.push({ id: U.uid(), name: nm, text: tx, time: U.hm() });
          if (list.length > 200) list = list.slice(-200);
          Store.save('chat', list);
          Store.nick(nm);
          U.$('#chatMsg').value = '';
          Sct.chat();
        };
        U.$('#chatSend').addEventListener('click', send);
        U.$('#chatMsg').addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
      }
    },

    /* ================= 下载 / 页脚 ================= */
    download: function () {
      U.$('#dlBtn').textContent = '下载 APK（' + S.apkVersion + '）';
      if (!bound.dl) {
        bound.dl = true;
        U.$('#dlBtn').addEventListener('click', function () {
          if (S.apkUrl && S.apkUrl !== '#download') { location.href = S.apkUrl; }
          else Toast.show('请在 config.js 中配置 apkUrl 下载地址', 'bad');
        });
      }
    },

    footer: function () {
      var nav = [
        ['#home', '首页'], ['#announcements', '公告'], ['#feed', '动态'],
        ['#events', '赛事活动'], ['#codes', '兑换码'], ['#sponsor', '服务器赞助'], ['#rules', '玩家公约']
      ];
      U.$('#footNav').innerHTML = nav.map(function (n) {
        return '<li><a href="' + n[0] + '">' + n[1] + '</a></li>';
      }).join('');

      U.$('#footContact').innerHTML =
        '<li>QQ 交流群：<a href="#" data-copy="' + U.esc(S.qq) + '">' + U.esc(S.qq) + '</a></li>' +
        '<li>服务器：<a href="#" data-copy="' + U.esc(S.serverAddr) + '">' + U.esc(S.serverAddr) + '</a></li>' +
        '<li>邮箱：' + U.esc(S.email) + '</li>' +
        '<li><button data-modal="feedback">问题反馈</button></li>' +
        '<li><button data-modal="repo">开源仓库</button></li>';
    },

    /* ================= 总入口 ================= */
    render: function () {
      this.staticText();
      this.features();
      this.about();
      this.ticker();
      this.ann();
      this.posts();
      this.shop();
      this.polls();
      this.quick();
      this.serverTools();
      this.rules();
      this.events();
      this.codes();
      this.sponsor();
      this.chat();
      this.download();
      this.footer();
      this.bindPosts();

      if (window.Glass) { Glass.collect(); Glass.restoreOrder(); }
    }
  };

  /* ---- MC 经验公式 ---- */
  function xpTotal(lv) {
    if (lv <= 16) return lv * lv + 6 * lv;
    if (lv <= 31) return Math.floor(2.5 * lv * lv - 40.5 * lv + 360);
    return Math.floor(4.5 * lv * lv - 162.5 * lv + 2220);
  }
  function xpLevel(total) {
    var lv = 0;
    while (lv < 100 && xpTotal(lv + 1) <= total) lv++;
    return lv;
  }

  window.Sections = Sct;
})();
