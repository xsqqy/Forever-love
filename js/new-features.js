/* ============================================================
 * new-features.js —— 新功能独立脚本
 * 包含：第3/4/5/6/7/8/9(真心话·支持选项)/10/11(桌宠全站自由出没)/12/13/14 项功能逻辑
 *       + 更新与修复通告弹窗（更新后首次进入显示，停留满120秒后可关闭，点过不再显示）
 * 本轮更新：新增更新通告弹窗；配合 index.html 的后台保活自愈优化（被打断自动恢复）
 * 依赖：index.html（主文件）、new-features.css（样式）
 * 数据全部存 IndexedDB（blobs 库，键名前缀 nf_），退出重进不丢失
 * ============================================================ */
(function () {
'use strict';

/* ==================== 0. 基础设施 ==================== */
var NF = {};
window.NF = NF;

/* ---------- 0.1 IndexedDB 存储层（数据持久化，退出不丢） ---------- */
var _nfCache = {};        /* 内存缓存，减少异步读取 */
var _nfLoaded = {};       /* 已从 IndexedDB 读取过的键 */
var _nfPending = {};      /* 待写入任务 */

function nfSave(key, val) {
    _nfCache[key] = val;
    try {
        var json = JSON.stringify(val);
        _nfPending[key] = json;
        if (window.saveImgDB) {
            window.saveImgDB(key, json).then(function (ok) {
                delete _nfPending[key];
                if (!ok) console.warn('[NF] 数据保存失败:', key);
            }).catch(function () { delete _nfPending[key]; });
        }
    } catch (e) { console.error('[NF] 序列化失败:', key, e); }
}

function nfLoad(key, def, cb) {
    if (_nfLoaded[key]) { cb(_nfCache[key] !== undefined ? _nfCache[key] : def); return; }
    if (window.loadImgDB) {
        window.loadImgDB(key, function (v) {
            _nfLoaded[key] = true;
            if (v) {
                try { _nfCache[key] = JSON.parse(v); } catch (e) { _nfCache[key] = def; }
            } else {
                _nfCache[key] = def;
            }
            cb(_nfCache[key]);
        }, true);
    } else {
        _nfLoaded[key] = true;
        if (_nfCache[key] === undefined) _nfCache[key] = def;
        cb(_nfCache[key]);
    }
}
/* 同步读缓存（未加载完成时返回默认值） */
function nfGet(key, def) {
    return _nfCache[key] !== undefined ? _nfCache[key] : def;
}

/* ---------- 0.2 工具函数 ---------- */
function nfUid() { return 'nf' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function nfEsc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function nfToast(msg) {
    try {
        var el = document.getElementById('nfToast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'nfToast';
            el.style.cssText = 'position:fixed;left:50%;bottom:120px;transform:translateX(-50%) translateY(10px);background:rgba(64,59,52,0.88);color:#faf9f7;padding:9px 18px;border-radius:50px;box-shadow:0 8px 40px rgba(97,88,76,0.25);letter-spacing:0.3px;font-size:13px;z-index:2147483000;opacity:0;transition:opacity .25s,transform .25s;pointer-events:none;max-width:80vw;text-align:center;line-height:1.5;';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.style.opacity = '1';
        el.style.transform = 'translateX(-50%) translateY(0)';
        if (el._t) clearTimeout(el._t);
        el._t = setTimeout(function () { el.style.opacity = '0'; el.style.transform = 'translateX(-50%) translateY(10px)'; }, 2600);
    } catch (e) {}
}
function nfPick(arr) { return arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : null; }
function nfRand(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function nfFmtTime(ts) {
    try {
        var d = new Date(ts);
        function p(n) { return n < 10 ? '0' + n : '' + n; }
        return (d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    } catch (e) { return ''; }
}
/* SVG 图标（所有图标均为 SVG，不使用 emoji 字符） */
function nfIcon(name) {
    var paths = {
        plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
        close: '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>',
        edit: '<path d="M11 5h2M12 5v0M4 19l4-1 11-11-3-3L5 15l-1 4z" fill="none"/>',
        trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
        hide: '<path d="M3 3l18 18M10.5 10.7a2.5 2.5 0 0 0 3.4 3.4"/><path d="M7 5.9C4.9 7.4 3.3 9.6 2.5 12c1.5 4 5.5 7 9.5 7 1.5 0 3-.4 4.3-1.1M20.8 15.3c.3-.5.6-1 .8-1.3-1.5-4-5.5-7-9.5-7"/>',
        eye: '<path d="M2.5 12C4 8 8 5 12 5s8 3 9.5 7C20 16 16 19 12 19S4 16 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
        upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
        download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
        link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2"/>',
        image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
        check: '<path d="M5 13l4 4L19 7"/>',
        grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
        folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>',
        pet: '<circle cx="12" cy="12" r="4"/><path d="M12 3c1 2 1 3 0 4M17.5 6.5c-1.5 1-3 1-4 0M21 12c-2 1-3 1-4 0M17.5 17.5c-1.5-1-3-1-4 0M12 21c-1-2-1-3 0-4M6.5 17.5c1.5-1 3-1 4 0M3 12c2 1 3 1 4 0M6.5 6.5c1.5 1 3 1 4 0"/>',
        bell: '<path d="M12 3a6 6 0 0 0-6 6v3.3L4.5 15a1 1 0 0 0 .9 1.5h13.2a1 1 0 0 0 .9-1.5L18 12.3V9a6 6 0 0 0-6-6z"/><path d="M9.6 18a2.4 2.4 0 0 0 4.8 0"/>',
        heart: '<path d="M12 20.6C7.2 17.3 3 13.9 3 9.9 3 7.2 5 5 7.6 5c1.8 0 3.3 1 4.4 2.6C13.1 6 14.6 5 16.4 5 19 5 21 7.2 21 9.9c0 4-4.2 7.4-9 10.7z"/>',
        chat: '<path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z"/>',
        refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.6M20 3v5h-5"/>',
        gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:1em;height:1em;vertical-align:-0.15em;">' + (paths[name] || paths.plus) + '</svg>';
}

/* 主数据便捷访问（appData 由主文件提供，持久化同样在 IndexedDB）
   注意：主文件用 let appData 声明（全局词法绑定，不在 window 上），必须直接引用标识符 */
function nfAppData() {
    try { if (typeof appData !== 'undefined' && appData) return appData; } catch (e) {}
    try { if (window.appData) return window.appData; } catch (e) {}
    return {};
}
function nfPersist() {
    try { if (typeof persist === 'function') persist(); else if (typeof saveData === 'function') saveData(); } catch (e) {}
}
function nfRefreshChat() {
    try { if (typeof renderMessages === 'function') { renderMessages(false); } } catch (e) {}
}
/* 自定义卡片消息统一入口（走主文件 addMessage，成为正常聊天记录，退出重进不丢） */
function nfAddCard(subtype, payload) {
    try {
        var msg = { id: 'nf' + Date.now() + Math.random(), time: Date.now(), type: 'system', subtype: subtype };
        for (var k in payload) msg[k] = payload[k];
        if (typeof addMessage === 'function') addMessage(msg);
    } catch (e) { console.error('[NF] addCard失败:', e); }
}

/* ==================== 下面各功能模块将按序挂载 ==================== */

/* ==================== 2. 第4+5项：色盘旁色号输入框 ==================== */
/* 所有自调节色盘（input[type=color]）旁注入色号输入框，粘贴色号（如 #FFB6C1）即可切换颜色
   动态生成的色盘（一起听歌设置等）由 MutationObserver 兜底注入
   第5项：聊天设置里的长方形色盘在 new-features.css 中改为圆形（不改动其它区域） */

function nfNormalizeColor(str) {
    if (!str) return null;
    var s = String(str).trim().replace(/^#/, '');
    if (/^[0-9a-fA-F]{3}$/.test(s)) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
    return '#' + s.toLowerCase();
}

function nfAttachHexInput(picker) {
    if (!picker || picker.dataset.nfHex === '1') return;
    try {
        picker.dataset.nfHex = '1';
        var box = document.createElement('span');
        box.className = 'nf-hex-box';
        box.innerHTML = '<input class="nf-hex-input" type="text" spellcheck="false" placeholder="色号"/>';
        var input = box.querySelector('.nf-hex-input');
        picker.insertAdjacentElement('afterend', box);
        /* 色盘 -> 输入框 */
        function syncFromPicker() { input.value = (picker.value || '').toUpperCase(); }
        syncFromPicker();
        picker.addEventListener('input', syncFromPicker);
        picker.addEventListener('change', syncFromPicker);
        /* 输入框 -> 色盘（回车或失焦生效，并触发原有 oninput 逻辑） */
        function applyHex() {
            var norm = nfNormalizeColor(input.value);
            if (!norm) { syncFromPicker(); return; }
            input.value = norm.toUpperCase();
            if (picker.value !== norm) {
                picker.value = norm;
                /* 触发主文件原有的 oninput/onchange 事件，保持原功能联动 */
                picker.dispatchEvent(new Event('input', { bubbles: true }));
                picker.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
        input.addEventListener('change', applyHex);
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); applyHex(); input.blur(); }
            if (e.key === 'Escape') { syncFromPicker(); input.blur(); }
        });
        input.addEventListener('click', function (e) { e.stopPropagation(); });
    } catch (e) {}
}

function nfScanColorPickers(root) {
    try {
        var list = (root || document).querySelectorAll('input[type="color"]');
        for (var i = 0; i < list.length; i++) nfAttachHexInput(list[i]);
    } catch (e) {}
}

function nfInitHexInputs() {
    nfScanColorPickers(document);
    /* 动态插入的色盘（模态框、一起听歌设置等）自动补注入
       性能优化：观察回调做300ms防抖合并——原来DOM每变一次就全量查询一次，
       聊天重绘等高频变动场景下开销大；现在批量合并后只扫一次 */
    try {
        var pending = false;
        var mo = new MutationObserver(function () {
            if (pending) return;
            pending = true;
            setTimeout(function () {
                pending = false;
                try { nfScanColorPickers(document); } catch (e) {}
            }, 300);
        });
        mo.observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
}


/* ==================== 4. 第6项：对方自主更新头像（三库互斥概率） ==================== */
/* 数据：nf_avatars = { other:[{id,src}], mine:[{id,src}], couple:[{id,other,mine}] }
   概率：nf_avatar_prob = { other:0, mine:0, couple:0 }
   三者互斥：每次只掷一次骰子，命中哪个区域只换哪个；无冷却，每次机会独立 */
var _avLib = { other: [], mine: [], couple: [] };
var _avProb = { other: 0, mine: 0, couple: 0 };

function nfAvLoad(cb) {
    nfLoad('nf_avatars', { other: [], mine: [], couple: [] }, function (v) {
        _avLib = v && typeof v === 'object' ? v : { other: [], mine: [], couple: [] };
        if (!_avLib.other) _avLib.other = [];
        if (!_avLib.mine) _avLib.mine = [];
        if (!_avLib.couple) _avLib.couple = [];
        nfLoad('nf_avatar_prob', { other: 0, mine: 0, couple: 0 }, function (p) {
            _avProb = p && typeof p === 'object' ? p : { other: 0, mine: 0, couple: 0 };
            if (cb) cb();
        });
    });
}
function nfAvSaveLib() { nfSave('nf_avatars', _avLib); }
function nfAvSaveProb() { nfSave('nf_avatar_prob', _avProb); }

/* 联系人同步：换头像同时更新联系人对象里的头像，保证切换联系人后不回退 */
function nfSyncContactAvatar(who, src) {
    try {
        var contacts = (nfAppData().contactList || {}).contacts || [];
        var cs = nfAppData().chatSettings || {};
        for (var i = 0; i < contacts.length; i++) {
            var c = contacts[i];
            if (who === 'other' && (c.avatar === cs.otherAvatar || c.name === cs.otherNickname)) { c.avatar = src; return; }
        }
    } catch (e) {}
}

/* 头像更换入口按钮（注入聊天加号面板"请求更换头像"旁） */
function nfAvInjectEntry() {
    var anchor = document.querySelector('.plus-item[data-icon="avatarChange"]');
    if (!anchor || document.getElementById('nfAvEntry')) return;
    var item = document.createElement('div');
    item.className = 'plus-item';
    item.id = 'nfAvEntry';
    item.innerHTML = '<div class="plus-icon">' + nfIcon('refresh') + '</div><span>头像更换</span>';
    item.addEventListener('click', function (e) {
        e.stopPropagation();
        try { if (typeof closePlusPanel === 'function') closePlusPanel(); } catch (err) {}
        nfAvOpenModal();
    });
    anchor.parentNode.insertBefore(item, anchor.nextSibling);
}

/* 裁剪编辑器：上传时可调节头像比例（拖动位置 + 缩放） */
function nfAvCropEditor(src, title, cb) {
    var ov = document.createElement('div');
    ov.className = 'nf-modal-overlay';
    ov.innerHTML =
        '<div class="nf-modal nf-crop-modal">' +
            '<div class="nf-modal-title">' + nfEsc(title || '调整头像比例') + '</div>' +
            '<div class="nf-crop-stage"><img src="' + nfEsc(src) + '" alt=""/></div>' +
            '<div class="nf-crop-zoom-row"><span>缩放</span><input type="range" min="50" max="300" value="100"/><span class="nf-crop-zoom-val">100%</span></div>' +
            '<div class="nf-crop-tip">拖动图片调整位置，滑块调整大小；框内区域即为头像</div>' +
            '<div class="nf-modal-btns">' +
                '<button class="nf-btn plain" data-act="cancel">取消</button>' +
                '<button class="nf-btn primary" data-act="ok">使用</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(ov);
    ov.style.display = 'flex';

    var img = ov.querySelector('.nf-crop-stage img');
    var slider = ov.querySelector('.nf-crop-zoom-row input');
    var zoomVal = ov.querySelector('.nf-crop-zoom-val');
    var state = { scale: 1, x: 0, y: 0 };

    function apply() {
        img.style.transform = 'translate(' + state.x + 'px,' + state.y + 'px) scale(' + state.scale + ')';
        img.style.transformOrigin = 'center center';
    }
    /* 图片就绪后初始化：等比缩放填满裁剪框 */
    img.onload = function () {
        var st = ov.querySelector('.nf-crop-stage');
        var sw = st.clientWidth, sh = st.clientHeight;
        var iw = img.naturalWidth || 1, ih = img.naturalHeight || 1;
        state.scale = Math.max(sw / iw, sh / ih);
        slider.value = String(Math.round(state.scale * 100));
        zoomVal.textContent = Math.round(state.scale * 100) + '%';
        apply();
    };
    slider.addEventListener('input', function () {
        state.scale = (parseInt(slider.value, 10) || 100) / 100;
        zoomVal.textContent = slider.value + '%';
        apply();
    });
    /* 拖动（鼠标 + 触摸统一用 pointer 事件） */
    var dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
    function down(x, y) { dragging = true; sx = x; sy = y; ox = state.x; oy = state.y; }
    function move(x, y) {
        if (!dragging) return;
        state.x = ox + (x - sx); state.y = oy + (y - sy);
        apply();
    }
    img.addEventListener('pointerdown', function (e) { e.preventDefault(); down(e.clientX, e.clientY); img.setPointerCapture(e.pointerId); });
    img.addEventListener('pointermove', function (e) { move(e.clientX, e.clientY); });
    img.addEventListener('pointerup', function () { dragging = false; });
    img.addEventListener('pointercancel', function () { dragging = false; });

    ov.querySelector('[data-act="cancel"]').addEventListener('click', function () { ov.remove(); });
    ov.querySelector('[data-act="ok"]').addEventListener('click', function () {
        try {
            var st = ov.querySelector('.nf-crop-stage');
            var size = 512;
            var canvas = document.createElement('canvas');
            canvas.width = size; canvas.height = size;
            var ctx = canvas.getContext('2d');
            /* 裁剪框中心 -> 图片坐标 */
            var rect = st.getBoundingClientRect();
            var irect = img.getBoundingClientRect();
            var cx = rect.width / 2, cy = rect.height / 2;
            var ix = cx - (irect.left - rect.left), iy = cy - (irect.top - rect.top);
            var ratio = (img.naturalWidth || 1) / (irect.width || 1);
            ctx.drawImage(img, ix * ratio, iy * ratio, rect.width * ratio, rect.height * ratio, 0, 0, size, size);
            var out = canvas.toDataURL('image/png');
            ov.remove();
            cb(out);
        } catch (e) { ov.remove(); cb(src); }
    });
}

/* URL 校验：头像支持链接上传 */
function nfAvIsValidUrl(s) {
    if (!s) return false;
    return /^https?:\/\//i.test(String(s).trim());
}

function nfAvOpenModal() {
    var old = document.getElementById('nfAvModal');
    if (old) old.remove();
    var ov = document.createElement('div');
    ov.className = 'nf-modal-overlay';
    ov.id = 'nfAvModal';
    ov.innerHTML = '<div class="nf-modal nf-av-modal">' +
        '<div class="nf-modal-close" data-act="close">' + nfIcon('close') + '</div>' +
        '<div class="nf-modal-title">头像更换</div>' +
        '<div class="nf-modal-sub">对方会按概率自己换头像：换TA的、换你的、或给你们俩换情头（三者互斥，一次只换一种）</div>' +
        '<div class="nf-scroll">' +
            '<div class="nf-av-sec" data-sec="other">' +
                '<div class="nf-av-sec-head">' + nfIcon('image') + '<b>对方头像</b>' +
                    '<span class="nf-av-count"></span></div>' +
                '<div class="nf-av-prob-row"><span>触发概率</span><input type="range" min="0" max="100" value="0"/><b>0%</b></div>' +
                '<div class="nf-av-btns">' +
                    '<button class="nf-btn" data-act="up-other">上传图片</button>' +
                    '<button class="nf-btn" data-act="url-other">链接上传</button>' +
                '</div>' +
                '<div class="nf-av-url-row" style="display:none"><input type="text" placeholder="粘贴图片链接，回车添加"/><button class="nf-btn primary">添加</button></div>' +
                '<div class="nf-av-grid"></div>' +
            '</div>' +
            '<div class="nf-av-sec" data-sec="mine">' +
                '<div class="nf-av-sec-head">' + nfIcon('image') + '<b>我方头像</b>' +
                    '<span class="nf-av-count"></span></div>' +
                '<div class="nf-av-prob-row"><span>触发概率</span><input type="range" min="0" max="100" value="0"/><b>0%</b></div>' +
                '<div class="nf-av-btns">' +
                    '<button class="nf-btn" data-act="up-mine">上传图片</button>' +
                    '<button class="nf-btn" data-act="url-mine">链接上传</button>' +
                '</div>' +
                '<div class="nf-av-url-row" style="display:none"><input type="text" placeholder="粘贴图片链接，回车添加"/><button class="nf-btn primary">添加</button></div>' +
                '<div class="nf-av-grid"></div>' +
            '</div>' +
            '<div class="nf-av-sec" data-sec="couple">' +
                '<div class="nf-av-sec-head">' + nfIcon('heart') + '<b>情头（成组更换）</b>' +
                    '<span class="nf-av-count"></span></div>' +
                '<div class="nf-av-prob-row"><span>触发概率</span><input type="range" min="0" max="100" value="0"/><b>0%</b></div>' +
                '<div class="nf-av-btns">' +
                    '<button class="nf-btn" data-act="up-couple">上传一组（两张）</button>' +
                    '<button class="nf-btn" data-act="url-couple">链接上传</button>' +
                '</div>' +
                '<div class="nf-av-url-row" style="display:none">' +
                    '<input type="text" placeholder="对方头像链接"/><input type="text" placeholder="我方头像链接"/>' +
                    '<button class="nf-btn primary">添加一组</button></div>' +
                '<div class="nf-av-couple-list"></div>' +
                '<div class="nf-av-tip">触发情头更换时，你们俩的头像会一起换成同一组的两张</div>' +
            '</div>' +
        '</div>' +
    '</div>';
    document.body.appendChild(ov);
    ov.style.display = 'flex';

    function close() { ov.remove(); }
    ov.querySelector('[data-act="close"]').addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });

    /* 渲染图库 + 概率 */
    function renderSecs() {
        ov.querySelectorAll('.nf-av-sec').forEach(function (sec) {
            var key = sec.dataset.sec;
            var prob = sec.querySelector('.nf-av-prob-row input');
            var probVal = sec.querySelector('.nf-av-prob-row b');
            prob.value = _avProb[key] || 0;
            probVal.textContent = (_avProb[key] || 0) + '%';
            prob.oninput = function () {
                _avProb[key] = parseInt(prob.value, 10) || 0;
                probVal.textContent = _avProb[key] + '%';
                nfAvSaveProb();
            };
            sec.querySelector('.nf-av-count').textContent = '共 ' + (_avLib[key] || []).length + ' 张';
            if (key === 'couple') {
                var clist = sec.querySelector('.nf-av-couple-list');
                clist.innerHTML = '';
                (_avLib.couple || []).forEach(function (grp) {
                    var row = document.createElement('div');
                    row.className = 'nf-av-couple-item';
                    row.innerHTML = '<img src="' + nfEsc(grp.other) + '"/><span class="nf-av-x">' + nfIcon('link') + '</span><img src="' + nfEsc(grp.mine) + '"/><button class="nf-av-del">' + nfIcon('trash') + '</button>';
                    row.querySelector('.nf-av-del').addEventListener('click', function () {
                        var idx = _avLib.couple.indexOf(grp);
                        if (idx >= 0) { _avLib.couple.splice(idx, 1); nfAvSaveLib(); renderSecs(); }
                    });
                    clist.appendChild(row);
                });
                if (!_avLib.couple.length) clist.innerHTML = '<div class="nf-empty">还没有上传情头</div>';
            } else {
                var grid = sec.querySelector('.nf-av-grid');
                grid.innerHTML = '';
                (_avLib[key] || []).forEach(function (it) {
                    var cell = document.createElement('div');
                    cell.className = 'nf-av-cell';
                    cell.innerHTML = '<img src="' + nfEsc(it.src) + '" alt=""/><button class="nf-av-del">' + nfIcon('close') + '</button>';
                    cell.querySelector('.nf-av-del').addEventListener('click', function () {
                        var idx = _avLib[key].indexOf(it);
                        if (idx >= 0) { _avLib[key].splice(idx, 1); nfAvSaveLib(); renderSecs(); }
                    });
                    grid.appendChild(cell);
                });
                if (!_avLib[key].length) grid.innerHTML = '<div class="nf-empty">头像库为空，上传后对方会从这里随机换头像</div>';
            }
        });
    }
    renderSecs();

    /* 文件上传（多选 -> 裁剪编辑 -> 入库） */
    function pickFiles(multiple, cb) {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        if (multiple) input.multiple = true;
        input.onchange = function (e) {
            var files = Array.prototype.slice.call(e.target.files || []);
            if (!files.length) return;
            var results = [];
            (function next(i) {
                if (i >= files.length) { cb(results); return; }
                var reader = new FileReader();
                reader.onload = function (ev) { results.push(ev.target.result); next(i + 1); };
                reader.onerror = function () { next(i + 1); };
                reader.readAsDataURL(files[i]);
            })(0);
        };
        input.click();
    }
    function cropAndPush(key, srcs, done) {
        /* 逐张进入裁剪编辑器，可调节比例 */
        var outs = [];
        (function one(i) {
            if (i >= srcs.length) { done(outs); return; }
            nfAvCropEditor(srcs[i], '调整头像比例（第 ' + (i + 1) + '/' + srcs.length + ' 张）', function (out) {
                outs.push(out); one(i + 1);
            });
        })(0);
    }

    ov.querySelectorAll('.nf-av-btns button').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var act = btn.dataset.act;
            if (act === 'up-other') {
                pickFiles(true, function (srcs) {
                    cropAndPush('other', srcs, function (outs) {
                        outs.forEach(function (s) { _avLib.other.push({ id: nfUid(), src: s }); });
                        nfAvSaveLib(); renderSecs(); nfToast('已加入对方头像库');
                    });
                });
            } else if (act === 'up-mine') {
                pickFiles(true, function (srcs) {
                    cropAndPush('mine', srcs, function (outs) {
                        outs.forEach(function (s) { _avLib.mine.push({ id: nfUid(), src: s }); });
                        nfAvSaveLib(); renderSecs(); nfToast('已加入我方头像库');
                    });
                });
            } else if (act === 'up-couple') {
                pickFiles(true, function (srcs) {
                    if (srcs.length < 2) { nfToast('情头需要两张图片，第一张为对方、第二张为我方'); }
                    cropAndPush('couple', srcs, function (outs) {
                        for (var i = 0; i + 1 < outs.length; i += 2) {
                            _avLib.couple.push({ id: nfUid(), other: outs[i], mine: outs[i + 1] });
                        }
                        nfAvSaveLib(); renderSecs();
                        if (outs.length >= 2) nfToast('已加入情头库（按上传顺序两两配对）');
                    });
                });
            } else if (act.indexOf('url-') === 0) {
                var sec = btn.closest('.nf-av-sec');
                var row = sec.querySelector('.nf-av-url-row');
                row.style.display = row.style.display === 'none' ? 'flex' : 'none';
            }
        });
    });

    /* URL 添加 */
    ov.querySelectorAll('.nf-av-url-row').forEach(function (row) {
        var sec = row.closest('.nf-av-sec');
        var key = sec.dataset.sec;
        var inputs = row.querySelectorAll('input');
        var addBtn = row.querySelector('button');
        function doAdd() {
            if (key === 'couple') {
                var u1 = inputs[0].value.trim(), u2 = inputs[1].value.trim();
                if (!nfAvIsValidUrl(u1) || !nfAvIsValidUrl(u2)) { nfToast('请输入有效的图片链接'); return; }
                _avLib.couple.push({ id: nfUid(), other: u1, mine: u2 });
                inputs[0].value = ''; inputs[1].value = '';
            } else {
                var u = inputs[0].value.trim();
                if (!nfAvIsValidUrl(u)) { nfToast('请输入有效的图片链接'); return; }
                _avLib[key].push({ id: nfUid(), src: u });
                inputs[0].value = '';
            }
            nfAvSaveLib(); renderSecs(); nfToast('已添加');
        }
        addBtn.addEventListener('click', doAdd);
        inputs.forEach(function (ip) {
            ip.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } });
        });
    });
}

/* 触发判定（无冷却）：我发消息后调用 */
function nfAvMaybeTrigger() {
    var total = (_avProb.other || 0) + (_avProb.mine || 0) + (_avProb.couple || 0);
    if (total <= 0) return;
    var r = Math.random() * 100;
    var p1 = _avProb.other || 0, p2 = p1 + (_avProb.mine || 0), p3 = p2 + (_avProb.couple || 0);
    var mode = null;
    if (r < p1 && _avLib.other.length) mode = 'other';
    else if (r < p2 && _avLib.mine.length) mode = 'mine';
    else if (r < p3 && _avLib.couple.length) mode = 'couple';
    if (!mode) return;

    setTimeout(function () {
        try {
            var cs = nfAppData().chatSettings || {};
            if (mode === 'other') {
                var it = nfPick(_avLib.other);
                cs.otherAvatar = it.src;
                nfSyncContactAvatar('other', it.src);
                nfAvCard({ mode: 'other', src: it.src });
            } else if (mode === 'mine') {
                var it2 = nfPick(_avLib.mine);
                cs.myAvatar = it2.src;
                nfAvCard({ mode: 'mine', src: it2.src });
            } else {
                var grp = nfPick(_avLib.couple);
                cs.otherAvatar = grp.other;
                cs.myAvatar = grp.mine;
                nfSyncContactAvatar('other', grp.other);
                nfAvCard({ mode: 'couple', src: grp.other, src2: grp.mine });
            }
            nfPersist();
            nfRefreshChat();
        } catch (e) {}
    }, nfRand(1200, 3200));
}

/* 头像更换卡片消息（以聊天消息形式出现） */
function nfAvCard(payload) {
    nfAddCard('nf-av', { nfav: payload });
}

/* 卡片渲染（由 buildMessageRow patch 调用） */
function nfBuildAvCard(msg) {
    var p = msg.nfav || {};
    var row = document.createElement('div');
    row.className = 'system-msg';
    row.dataset.id = msg.id;
    var title = p.mode === 'other' ? '对方更换了头像' : (p.mode === 'mine' ? '对方给你换了头像' : '你们换上了情头');
    var imgs = '';
    if (p.mode === 'couple') {
        imgs = '<div class="nf-avcard-imgs"><img src="' + nfEsc(p.src) + '"/><span class="nf-avcard-heart">' + nfIcon('heart') + '</span><img src="' + nfEsc(p.src2) + '"/></div>';
    } else {
        imgs = '<div class="nf-avcard-imgs"><img src="' + nfEsc(p.src) + '"/></div>';
    }
    var card = document.createElement('div');
    card.className = 'nf-card nf-avcard';
    card.innerHTML = '<div class="nf-card-tape"></div>' +
        '<div class="nf-card-title">' + title + '</div>' + imgs +
        '<div class="nf-card-date">- ' + nfFmtTime(msg.time || Date.now()) + ' -</div>';
    row.appendChild(card);
    try { if (typeof attachRowMenu === 'function') attachRowMenu(row, msg.id); } catch (e) {}
    return row;
}


/* 设置app-外观-输入框字体颜色下方注入滑块；往左=输入框上移贴紧键盘，往右=下移，中间=默认
   偏移量存 IndexedDB（nf_kb_offset），退出重进保持不变，直到用户再次调节 */
var _kbAdj = 0;

window.NF_getKbAdjust = function () { return _kbAdj; };

function nfApplyKbAdjust(newAdj, oldAdj) {
    /* 键盘已打开时，立即在现有 padding 基础上应用差值，实时看到效果 */
    try {
        var chatPage = document.getElementById('chatPage');
        if (chatPage && chatPage.classList.contains('keyboard-open')) {
            var cur = parseInt(chatPage.style.paddingBottom, 10) || 0;
            chatPage.style.paddingBottom = Math.max(0, cur - oldAdj + newAdj) + 'px';
        }
    } catch (e) {}
}

function nfInitKbSlider() {
    var anchor = document.getElementById('p3InputColorPicker');
    if (!anchor || !anchor.parentNode) return;
    var row = anchor.closest('.settings-row');
    if (!row || document.getElementById('nfKbSliderRow')) return;

    var wrap = document.createElement('div');
    wrap.className = 'settings-row nf-kb-row';
    wrap.id = 'nfKbSliderRow';
    wrap.innerHTML =
        '<label>输入框与键盘间距</label>' +
        '<div class="nf-kb-slider-wrap">' +
            '<span class="nf-kb-side">上</span>' +
            '<input type="range" id="nfKbSlider" min="-120" max="120" step="2" value="0"/>' +
            '<span class="nf-kb-side">下</span>' +
        '</div>' +
        '<div class="nf-kb-meta"><span id="nfKbVal">默认</span>' +
        '<span class="nf-kb-reset" id="nfKbReset">恢复默认</span></div>' +
        '<div class="nf-kb-tip">中间为默认高度；往左输入框向上贴紧键盘，往右向下远离键盘。调节后自动保存，下次进入保持不变</div>';

    row.parentNode.insertBefore(wrap, row.nextSibling);

    var slider = wrap.querySelector('#nfKbSlider');
    var valEl = wrap.querySelector('#nfKbVal');
    var resetEl = wrap.querySelector('#nfKbReset');

    function fmt(v) {
        if (v === 0) return '默认';
        return (v > 0 ? '向下 ' : '向上 ') + Math.abs(v) + 'px';
    }
    /* 性能优化：拖动过程只调间距，停止600ms后再写库（原来每拖一格写一次IndexedDB） */
    var saveDeb = null;
    function saveSoon() {
        if (saveDeb) clearTimeout(saveDeb);
        saveDeb = setTimeout(function () { saveDeb = null; nfSave('nf_kb_offset', _kbAdj); }, 600);
    }
    slider.addEventListener('input', function () {
        var old = _kbAdj;
        _kbAdj = parseInt(slider.value, 10) || 0;
        valEl.textContent = fmt(_kbAdj);
        nfApplyKbAdjust(_kbAdj, old);
        saveSoon();   /* IndexedDB 持久化（防抖） */
    });
    slider.addEventListener('change', function () { if (saveDeb) { clearTimeout(saveDeb); saveDeb = null; nfSave('nf_kb_offset', _kbAdj); } });
    resetEl.addEventListener('click', function () {
        var old = _kbAdj;
        _kbAdj = 0;
        slider.value = '0';
        valEl.textContent = fmt(0);
        nfApplyKbAdjust(0, old);
        nfSave('nf_kb_offset', 0);
        nfToast('已恢复默认间距');
    });
    /* 恢复已保存的偏移 */
    nfLoad('nf_kb_offset', 0, function (v) {
        if (typeof v === 'number' && v !== 0) {
            _kbAdj = v;
            slider.value = String(v);
            valEl.textContent = fmt(v);
        } else {
            _kbAdj = 0;
        }
    });
}


/* ==================== 5. 第7项：表情包功能重建（分类系统） ==================== */
/* 数据结构：appData.emojis.cats = { mine: [{id, name, items:[src]}], other: [...] }
   mine / other 平铺数组始终 = 所有分类items的并集（供主文件回复逻辑继续使用，完全向后兼容）
   上传的新表情自动进入当前选中分类（或默认分类）；分类可增删改名，删除分类时表情回到默认分类 */
var _emojiState = { side: 'mine', cat: 'default', editing: false };

function nfEmojiData() {
    var em = nfAppData().emojis;
    if (!em) return null;
    if (!em.mine) em.mine = [];
    if (!em.other) em.other = [];
    if (!em.cats) em.cats = {};
    if (!em.cats.mine) em.cats.mine = [];
    if (!em.cats.other) em.cats.other = [];
    return em;
}

/* 初始化/迁移：把平铺数组里的表情收进"默认"分类 */
function nfEmojiMigrate() {
    var em = nfEmojiData();
    if (!em) return;
    ['mine', 'other'].forEach(function (side) {
        var cats = em.cats[side];
        /* 保证默认分类存在 */
        if (!cats.length || cats[0].id !== 'default') {
            cats.unshift({ id: 'default', name: '默认', items: [] });
        }
        /* 迁移：平铺数组中不在任何分类的表情进入默认分类 */
        var inCats = {};
        cats.forEach(function (c) { (c.items || []).forEach(function (s) { inCats[s] = true; }); });
        em[side].forEach(function (s) { if (!inCats[s]) cats[0].items.push(s); });
        /* 同步：分类里已被删除的表情移除 */
        var flat = {};
        em[side].forEach(function (s) { flat[s] = true; });
        cats.forEach(function (c) {
            c.items = (c.items || []).filter(function (s) { return flat[s]; });
        });
    });
    nfPersist();
}

/* 平铺数组重建 = 所有分类并集（去重） */
function nfEmojiSyncFlat() {
    var em = nfEmojiData();
    if (!em) return;
    ['mine', 'other'].forEach(function (side) {
        var seen = {}, out = [];
        em.cats[side].forEach(function (c) {
            (c.items || []).forEach(function (s) { if (!seen[s]) { seen[s] = true; out.push(s); } });
        });
        em[side] = out;
    });
    nfPersist();
}

/* 分类栏 + 网格重建渲染（接管主文件的 renderEmojis） */
function nfEmojiRender() {
    var em = nfEmojiData();
    if (!em) return;
    /* 吸收外部上传进平铺数组的新表情（进入当前选中分类，若存在） */
    var side = _emojiState.side;
    var cats = em.cats[side];
    var inCats = {};
    cats.forEach(function (c) { (c.items || []).forEach(function (s) { inCats[s] = true; }); });
    var target = cats.filter(function (c) { return c.id === _emojiState.cat; })[0] || cats[0];
    em[side].forEach(function (s) { if (!inCats[s]) target.items.push(s); });

    var bar = document.getElementById('nfEmojiCatbar');
    var gridMine = document.getElementById('emojiGridMine');
    var gridOther = document.getElementById('emojiGridOther');
    if (!gridMine || !gridOther) return;
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'nfEmojiCatbar';
        var tabs = document.querySelector('#emojiPanel .emoji-tabs');
        (tabs ? tabs.parentNode : gridMine.parentNode).insertBefore(bar, tabs ? tabs.nextSibling : gridMine);
    }
    bar.innerHTML = '';
    /* 隐藏主文件旧的双页签（由新侧栏接管） */
    var oldTabs = document.querySelector('#emojiPanel .emoji-tabs');
    if (oldTabs) oldTabs.style.display = 'none';
    var sideTabs = document.createElement('div');
    sideTabs.className = 'nf-emoji-side';
    sideTabs.innerHTML = '<span class="nf-emoji-side-b' + (side === 'mine' ? ' on' : '') + '" data-side="mine">我的表情</span>' +
        '<span class="nf-emoji-side-b' + (side === 'other' ? ' on' : '') + '" data-side="other">对方表情</span>';
    bar.appendChild(sideTabs);
    sideTabs.querySelectorAll('.nf-emoji-side-b').forEach(function (b) {
        b.addEventListener('click', function () {
            _emojiState.side = b.dataset.side;
            _emojiState.cat = 'default';
            _emojiState.editing = false;
            nfEmojiRender();
        });
    });
    /* 分类 chips */
    var catBar = document.createElement('div');
    catBar.className = 'nf-emoji-cats';
    cats.forEach(function (c) {
        var chip = document.createElement('span');
        chip.className = 'nf-emoji-chip' + (c.id === _emojiState.cat ? ' on' : '');
        chip.dataset.catid = c.id;
        chip.innerHTML = nfEsc(c.name || '未命名') + '<i>' + (c.items || []).length + '</i>';
        chip.addEventListener('click', function () { _emojiState.cat = c.id; nfEmojiRender(); });
        catBar.appendChild(chip);
    });
    var addChip = document.createElement('span');
    addChip.className = 'nf-emoji-chip add';
    addChip.innerHTML = nfIcon('plus') + ' 分类';
    addChip.addEventListener('click', nfEmojiAddCat);
    catBar.appendChild(addChip);
    var mgChip = document.createElement('span');
    mgChip.className = 'nf-emoji-chip mgr';
    mgChip.textContent = _emojiState.editing ? '完成' : '管理';
    mgChip.addEventListener('click', function () { _emojiState.editing = !_emojiState.editing; nfEmojiRender(); });
    catBar.appendChild(mgChip);
    bar.appendChild(catBar);

    /* 网格：当前分类的表情 */
    var grid = side === 'mine' ? gridMine : gridOther;
    gridMine.style.display = side === 'mine' ? 'grid' : 'none';
    gridOther.style.display = side === 'other' ? 'grid' : 'none';
    grid.querySelectorAll('.emoji-item,.nf-emoji-item').forEach(function (el) { el.remove(); });
    var addBtn = grid.querySelector('.emoji-add');
    if (!addBtn) {
        addBtn = document.createElement('div');
        addBtn.className = 'emoji-add';
        addBtn.innerHTML = '<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
        addBtn.addEventListener('click', function () {
            if (typeof addEmoji === 'function') addEmoji(side); else nfEmojiPickFiles(side);
        });
        grid.appendChild(addBtn);
    }
    var cur = cats.filter(function (c) { return c.id === _emojiState.cat; })[0] || cats[0];
    var canManage = _emojiState.editing && cur && cur.id !== 'default';
    (cur ? (cur.items || []) : []).forEach(function (src, idx) {
        var item = document.createElement('div');
        item.className = 'emoji-item nf-emoji-item';
        item.style.position = 'relative';
        item.innerHTML = '<img src="' + nfEsc(src) + '" alt="">';
        /* 管理模式：点表情弹出操作（移动/删除）；普通模式：点=发送 */
        item.addEventListener('click', function (e) {
            e.preventDefault();
            if (_emojiState.editing) { nfEmojiItemMenu(side, cur, idx, src); return; }
            try { if (typeof sendEmoji === 'function') sendEmoji(side, src); } catch (err) {}
        });
        /* 长按也可进操作菜单（普通模式快捷管理单个） */
        var lp = null;
        item.addEventListener('touchstart', function () {
            lp = setTimeout(function () { lp = null; nfEmojiItemMenu(side, cur, idx, src); }, 500);
        }, { passive: true });
        item.addEventListener('touchend', function () { if (lp) { clearTimeout(lp); lp = null; } }, { passive: true });
        item.addEventListener('touchmove', function () { if (lp) { clearTimeout(lp); lp = null; } }, { passive: true });
        item.addEventListener('contextmenu', function (e) { e.preventDefault(); nfEmojiItemMenu(side, cur, idx, src); });
        grid.insertBefore(item, addBtn);
    });
    if (cur && !cur.items.length) {
        var empty = document.createElement('div');
        empty.className = 'nf-emoji-empty';
        empty.textContent = '这个分类还没有表情，点 + 上传';
        grid.insertBefore(empty, addBtn);
    }
    /* 对侧网格也清掉旧渲染（避免旧代码把表情渲染到隐藏网格） */
    var other = side === 'mine' ? gridOther : gridMine;
    other.querySelectorAll('.emoji-item,.nf-emoji-item').forEach(function (el) { el.remove(); });
    nfEmojiSyncFlat();
}

/* 单个表情操作菜单（移动分类/删除） */
function nfEmojiItemMenu(side, cat, idx, src) {
    var old = document.getElementById('nfEmojiItemMenu');
    if (old) old.remove();
    var em = nfEmojiData();
    var cats = em.cats[side];
    var m = document.createElement('div');
    m.id = 'nfEmojiItemMenu';
    m.className = 'nf-popmenu';
    var h = '<div class="nf-popmenu-title">这张表情</div>';
    if (cats.length > 1) {
        h += '<div class="nf-popmenu-sub">移动到分类</div>';
        cats.forEach(function (c) {
            if (c.id !== cat.id) h += '<div class="nf-popmenu-item" data-mv="' + nfEsc(c.id) + '">' + nfEsc(c.name) + '</div>';
        });
    }
    h += '<div class="nf-popmenu-item danger" data-del="1">删除这张表情</div>';
    m.innerHTML = h;
    document.body.appendChild(m);
    m.style.left = '50%';
    m.style.top = '30%';
    m.style.transform = 'translateX(-50%)';
    m.addEventListener('click', function (e) {
        var it = e.target.closest('.nf-popmenu-item');
        if (!it) return;
        if (it.dataset.del) {
            var ci = cat.items.indexOf(src);
            if (ci >= 0) cat.items.splice(ci, 1);
            nfToast('已删除');
        } else if (it.dataset.mv) {
            var dst = cats.filter(function (c) { return c.id === it.dataset.mv; })[0];
            var ci2 = cat.items.indexOf(src);
            if (ci2 >= 0) cat.items.splice(ci2, 1);
            if (dst) dst.items.push(src);
            _emojiState.cat = dst ? dst.id : 'default';
            nfToast('已移动到「' + (dst ? dst.name : '默认') + '」');
        }
        m.remove();
        nfPersist();
        nfEmojiRender();
    });
    /* 点击其他区域关闭 */
    setTimeout(function () {
        var close = function (ev) { if (!m.contains(ev.target)) { m.remove(); document.removeEventListener('click', close, true); } };
        document.addEventListener('click', close, true);
    }, 50);
}

/* 新建分类 */
function nfEmojiAddCat() {
    var em = nfEmojiData();
    var side = _emojiState.side;
    var name = prompt('新分类名称（如：猫猫、兔兔、搞怪）');
    if (name === null) return;
    name = name.trim();
    if (!name) { nfToast('分类名不能为空'); return; }
    if (em.cats[side].some(function (c) { return c.name === name; })) { nfToast('已存在同名分类'); return; }
    var cat = { id: 'c' + Date.now().toString(36), name: name, items: [] };
    em.cats[side].push(cat);
    _emojiState.cat = cat.id;
    nfPersist();
    nfEmojiRender();
    nfToast('已创建分类「' + name + '」');
}

/* 分类重命名/删除（长按分类chip） */
function nfEmojiCatMenu(chipEl, side, cat) {
    var old = document.getElementById('nfEmojiCatMenu');
    if (old) old.remove();
    var m = document.createElement('div');
    m.id = 'nfEmojiCatMenu';
    m.className = 'nf-popmenu';
    m.innerHTML = '<div class="nf-popmenu-title">分类「' + nfEsc(cat.name) + '」</div>' +
        (cat.id === 'default' ? '' : '<div class="nf-popmenu-item" data-ren="1">重命名分类</div>') +
        (cat.id === 'default' ? '' : '<div class="nf-popmenu-item danger" data-delcat="1">删除分类（表情回到默认）</div>') +
        '<div class="nf-popmenu-item" data-cancel="1">取消</div>';
    document.body.appendChild(m);
    var r = chipEl.getBoundingClientRect();
    m.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 180)) + 'px';
    m.style.top = Math.min(r.bottom + 6, window.innerHeight - 180) + 'px';
    m.addEventListener('click', function (e) {
        var it = e.target.closest('.nf-popmenu-item');
        if (!it) return;
        var em = nfEmojiData();
        if (it.dataset.ren) {
            var nn = prompt('新的分类名称', cat.name);
            if (nn && nn.trim()) { cat.name = nn.trim(); nfPersist(); }
        } else if (it.dataset.delcat) {
            var cats = em.cats[side];
            var def = cats[0];
            (cat.items || []).forEach(function (s) { if (def.items.indexOf(s) < 0) def.items.push(s); });
            var i = cats.indexOf(cat);
            if (i >= 0) cats.splice(i, 1);
            _emojiState.cat = 'default';
            nfToast('分类已删除，表情已回到默认分类');
        }
        m.remove();
        nfPersist();
        nfEmojiRender();
    });
    setTimeout(function () {
        var close = function (ev) { if (!m.contains(ev.target)) { m.remove(); document.removeEventListener('click', close, true); } };
        document.addEventListener('click', close, true);
    }, 50);
}

/* 独立批量上传（不依赖主文件 currentEditType 流程） */
function nfEmojiPickFiles(side) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = function (e) {
        var files = Array.prototype.slice.call(e.target.files || []);
        if (!files.length) return;
        var em = nfEmojiData();
        var cats = em.cats[side];
        var target = cats.filter(function (c) { return c.id === _emojiState.cat; })[0] || cats[0];
        var done = 0;
        files.forEach(function (f) {
            var reader = new FileReader();
            reader.onload = function (ev) {
                target.items.push(ev.target.result);
                if (++done === files.length) { nfPersist(); nfEmojiRender(); nfToast('已上传 ' + done + ' 张到「' + target.name + '」'); }
            };
            reader.onerror = function () { if (++done === files.length) { nfPersist(); nfEmojiRender(); } };
            reader.readAsDataURL(f);
        });
    };
    input.click();
}

function nfInitEmojiCats() {
    if (!document.getElementById('emojiPanel')) return;
    nfEmojiMigrate();
    /* 接管渲染：主文件任何地方调用 renderEmojis 都走分类版 */
    if (typeof renderEmojis === 'function') {
        window.renderEmojis = nfEmojiRender;
        window.renderEmojiGrid = function () { nfEmojiRender(); };
    }
    nfEmojiRender();
    /* 长按分类chip（事件委托） */
    var bar0 = document.getElementById('nfEmojiCatbar');
    if (bar0) {
        var lt = null;
        bar0.addEventListener('touchstart', function (e) {
            var chip = e.target.closest('.nf-emoji-chip');
            if (!chip || chip.classList.contains('add') || chip.classList.contains('mgr')) return;
            var em = nfEmojiData();
            var side = _emojiState.side;
            var cat = em.cats[side].filter(function (c) { return c.id === chip.dataset.catid; })[0];
            if (!cat) {
                /* 通过名字匹配 */
                var name = chip.textContent.replace(/\d+$/, '');
                cat = em.cats[side].filter(function (c) { return c.name === name; })[0];
            }
            if (cat) lt = setTimeout(function () { lt = null; nfEmojiCatMenu(chip, side, cat); }, 550);
        }, { passive: true });
        bar0.addEventListener('touchend', function () { if (lt) { clearTimeout(lt); lt = null; } }, { passive: true });
        bar0.addEventListener('touchmove', function () { if (lt) { clearTimeout(lt); lt = null; } }, { passive: true });
    }
}


/* ==================== 6. 第8项：收纳（加号面板）备注更换 ==================== */
/* 在聊天 + 面板（收纳区）注入「更换备注」入口；修改对方备注并同步联系人列表
   修改记录以聊天卡片形式发送（成为聊天记录），历史备注可快速切换 */
function nfRemarkInjectEntry() {
    var anchor = document.getElementById('nfAvEntry') || document.querySelector('.plus-item[data-icon="avatarChange"]');
    if (!anchor || document.getElementById('nfRemarkEntry')) return;
    var item = document.createElement('div');
    item.className = 'plus-item';
    item.id = 'nfRemarkEntry';
    item.innerHTML = '<div class="plus-icon">' + nfIcon('edit') + '</div><span>更换备注</span>';
    item.addEventListener('click', function (e) {
        e.stopPropagation();
        try { if (typeof closePlusPanel === 'function') closePlusPanel(); } catch (err) {}
        nfRemarkOpenModal();
    });
    anchor.parentNode.insertBefore(item, anchor.nextSibling);
}

function nfRemarkHistory() { return nfGet('nf_remark_history', []); }

function nfRemarkOpenModal() {
    var old = document.getElementById('nfRemarkModal');
    if (old) old.remove();
    var cs = nfAppData().chatSettings || {};
    var cur = cs.otherNickname || '对方';
    var hist = nfRemarkHistory().slice(-8).reverse();
    var ov = document.createElement('div');
    ov.className = 'nf-modal-overlay';
    ov.id = 'nfRemarkModal';
    ov.innerHTML = '<div class="nf-modal nf-remark-modal">' +
        '<div class="nf-modal-close" data-act="close">' + nfIcon('close') + '</div>' +
        '<div class="nf-modal-title">更换备注</div>' +
        '<div class="nf-modal-sub">把对方备注改成你喜欢的名字，聊天顶部和联系人列表都会一起更新</div>' +
        '<div class="nf-scroll">' +
            '<div class="nf-remark-cur">当前备注：<b>' + nfEsc(cur) + '</b></div>' +
            '<div class="nf-remark-input-row">' +
                '<input type="text" id="nfRemarkInput" maxlength="30" placeholder="输入新的备注"/>' +
                '<button class="nf-btn primary" id="nfRemarkOk">修改</button>' +
            '</div>' +
            '<div class="nf-remark-hist-head">历史备注（点击快速换回）</div>' +
            '<div class="nf-remark-hist" id="nfRemarkHist">' +
                (hist.length ? hist.map(function (r) {
                    return '<span class="nf-remark-chip" data-r="' + nfEsc(r) + '">' + nfEsc(r) + '</span>';
                }).join('') : '<span class="nf-empty-inline">暂无历史备注</span>') +
            '</div>' +
        '</div>' +
    '</div>';
    document.body.appendChild(ov);
    ov.style.display = 'flex';
    function close() { ov.remove(); }
    ov.querySelector('[data-act="close"]').addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });

    function apply(nv) {
        nv = (nv || '').trim();
        if (!nv) { nfToast('备注不能为空'); return; }
        if (nv === cur) { nfToast('备注没有变化'); return; }
        try {
            var data = nfAppData();
            var cs2 = data.chatSettings || {};
            var old2 = cs2.otherNickname || '对方';
            cs2.otherNickname = nv;
            /* 同步默认联系人的名字 */
            var contacts = (data.contactList || {}).contacts || [];
            contacts.forEach(function (c) {
                if (c.isDefault || c.name === old2) c.name = nv;
            });
            /* 聊天顶部标题同步 */
            var title = document.getElementById('chatTitle');
            if (title && title.textContent.indexOf('输入') < 0) title.textContent = nv;
            var nvv = document.getElementById('otherNicknameValue');
            if (nvv) nvv.textContent = nv;
            /* 历史记录 */
            var h = nfRemarkHistory();
            if (h.indexOf(old2) < 0 && old2 && old2 !== '对方') h.push(old2);
            if (h.indexOf(nv) < 0) h.push(nv);
            nfSave('nf_remark_history', h.slice(-30));
            nfPersist();
            nfRefreshChat();
            /* 聊天记录卡片 */
            nfAddCard('nf-remark2', { rm2: { from: old2, to: nv, time: Date.now() } });
            close();
            nfToast('备注已更新为「' + nv + '」');
        } catch (e) { nfToast('修改失败，请重试'); }
    }
    ov.querySelector('#nfRemarkOk').addEventListener('click', function () {
        apply(ov.querySelector('#nfRemarkInput').value);
    });
    ov.querySelector('#nfRemarkInput').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); apply(this.value); }
    });
    ov.querySelectorAll('.nf-remark-chip').forEach(function (chip) {
        chip.addEventListener('click', function () { apply(chip.dataset.r); });
    });
    setTimeout(function () { try { ov.querySelector('#nfRemarkInput').focus(); } catch (e) {} }, 100);
}

/* 备注更换卡片渲染 */
function nfBuildRemarkCard(msg) {
    var r = msg.rm2 || {};
    var row = document.createElement('div');
    row.className = 'system-msg';
    row.dataset.id = msg.id;
    var card = document.createElement('div');
    card.className = 'nf-card nf-rm2-card';
    card.innerHTML = '<div class="nf-card-tape"></div>' +
        '<div class="nf-card-title">' + nfIcon('edit') + ' 备注更换</div>' +
        '<div class="nf-rm2-row"><span class="nf-rm2-old">' + nfEsc(r.from) + '</span>' +
        '<span class="nf-rm2-arrow">' + nfIcon('link') + '</span>' +
        '<span class="nf-rm2-new">' + nfEsc(r.to) + '</span></div>' +
        '<div class="nf-card-date">- ' + nfFmtTime(r.time || msg.time) + ' -</div>';
    row.appendChild(card);
    try { if (typeof attachRowMenu === 'function') attachRowMenu(row, msg.id); } catch (e) {}
    return row;
}


/* ==================== 7. 第9项：真心话问问问（支持选项） ==================== */
/* 剪刀石头布每局分出胜负后自动进入真心话环节：赢家提问、输家回答
   问题与回答全部以聊天卡片（聊天记录）形式出现在聊天界面，退出重进不丢
   出题时可以给题目设置选项：
   · 有选项的问题 → 回答时直接从选项里选一个（对方随机选，我直接点选）
   · 只有问题的题 → 我直接输入回答；对方的回答直接从「字卡」里随机调取内容回复
     （没有可用字卡时，用内置回答+自定义回答兜底）
   题库可在剪刀石头布弹窗里的「真心话题库」管理（题目可带选项）；平局不触发 */
var TRUTH_Q_PRESET = [
    '今天有没有想过我？想了几次？',
    '如果只能带一样东西和我去旅行，你会带什么？',
    '第一次见我的时候，心里偷偷打了多少分？',
    '我做过哪件小事让你印象最深？',
    '如果用一个词形容我们的关系，你会用哪个词？',
    '你手机里有没有偷偷存我的丑照？',
    '以后最想和我一起做的一件事是什么？',
    '我生气的时候，你其实心里在想什么？',
    '你觉得我什么时候最好看？',
    '你有没有背着我偷偷吃过好吃的没告诉我？',
    '如果明天是世界末日，今天你最想和谁待在一起？',
    '你梦到过我吗？梦里我们在干嘛？',
    '我说的哪句废话你记得最牢？',
    '你的小本本里有没有写过关于我的东西？',
    '如果我能学会一项新技能，你希望是什么？'
];
var TRUTH_A_PRESET = [
    '想了！从早上睁眼想到现在～',
    '当然带你呀，别的东西可以再买',
    '第一次见你就觉得，完了，栽了',
    '你打瞌睡的时候吧，睫毛一颤一颤的',
    '命中注定，这个词刚刚好',
    '……这个可以不说吗（心虚）',
    '想和你去看一次凌晨的海',
    '在想怎么哄你，又怕越哄越气',
    '认真听我说话的时候最好看',
    '呜呜被抓到了，下次带你一起去',
    '那必须是和你啊，这还用问',
    '梦到你请我吃了一整条街的小吃',
    '你随口说的"路上小心"，记到现在',
    '小本本第一章就是关于你的',
    '希望你会做饭，这样我就能理直气壮不做了'
];
var TRUTH_C_PRESET = [
    '嗯嗯，这个回答我记在小本本上了',
    '哈哈这个回答也太可爱了',
    '好吧好吧，勉强信你一次',
    '记下来了，下次抽查你',
    '这个答案我给满分',
    '嘻嘻，被你甜到了'
];

var _truthCfg = { enabled: true, questions: [], answers: [] };

/* 题目结构统一为 { q: '问题', opts: ['选项A', ...] }（opts 为空数组 = 只有问题的题）
   兼容旧版纯字符串题目（自动升级为无选项结构） */
function nfTruthNormQ(item) {
    if (typeof item === 'string') return { q: item, opts: [] };
    if (item && typeof item === 'object') {
        var opts = [];
        if (Array.isArray(item.opts)) {
            for (var i = 0; i < item.opts.length; i++) {
                var o = String(item.opts[i] == null ? '' : item.opts[i]).trim();
                if (o) opts.push(o);
            }
        }
        return { q: String(item.q || '').trim(), opts: opts };
    }
    return null;
}

function nfTruthLoad(cb) {
    nfLoad('nf_truth', { enabled: true, questions: [], answers: [] }, function (v) {
        _truthCfg = v && typeof v === 'object' ? v : { enabled: true, questions: [], answers: [] };
        if (!_truthCfg.questions) _truthCfg.questions = [];
        if (!_truthCfg.answers) _truthCfg.answers = [];
        if (_truthCfg.enabled === undefined) _truthCfg.enabled = true;
        /* 旧版纯字符串题目升级为 {q, opts} 结构 */
        var norm = [];
        for (var i = 0; i < _truthCfg.questions.length; i++) {
            var q = nfTruthNormQ(_truthCfg.questions[i]);
            if (q && q.q) norm.push(q);
        }
        _truthCfg.questions = norm;
        if (cb) cb();
    });
}
function nfTruthSave() { nfSave('nf_truth', _truthCfg); }

function nfFindMsg(id) {
    try {
        var hist = nfAppData().chatHistory || [];
        for (var i = 0; i < hist.length; i++) { if (hist[i].id === id) return hist[i]; }
    } catch (e) {}
    return null;
}

/* 对方回答直接从「字卡」里调取内容（全站字卡：共用+当前联系人专属，同聊天回复的调取规则） */
function nfTruthWordAnswer() {
    try {
        if (typeof getAllVisibleWordCards === 'function') {
            var all = getAllVisibleWordCards();
            if (all && all.length) return nfPick(all);
        }
    } catch (e) {}
    return null;
}

/* 对方的自动回答：有选项 → 直接从选项里选；无选项 → 从字卡里调取内容；
   没有可用字卡时 → 用内置回答+自定义回答兜底（保证功能永远有回复） */
function nfTruthAutoAnswer(opts) {
    if (opts && opts.length) return nfPick(opts);
    var wc = nfTruthWordAnswer();
    if (wc) return wc;
    return nfPick(TRUTH_A_PRESET.concat(_truthCfg.answers || []));
}

/* 主文件回调：对局结束（r.result = win/lose/draw） */
window.NF_TruthGame = {
    onRoundEnd: function (r) {
        try {
            if (!r || !r.result || r.result === 'draw') return;
            if (!_truthCfg.enabled) return;
            if (r.result === 'win') {
                /* 我赢：由我出题 */
                setTimeout(function () {
                    nfAddCard('nf-truth', { t: { who: 'me', phase: 'ask', gid: r.id, time: Date.now() } });
                }, nfRand(900, 2200));
            } else if (r.result === 'lose') {
                /* 我输：对方出题（预设题库+自定义题库随机，题目可能带选项） */
                var pool = [];
                for (var i = 0; i < TRUTH_Q_PRESET.length; i++) {
                    pool.push({ q: TRUTH_Q_PRESET[i], opts: [] });
                }
                var myQs = _truthCfg.questions || [];
                for (var j = 0; j < myQs.length; j++) {
                    var nq = nfTruthNormQ(myQs[j]);
                    if (nq && nq.q) pool.push(nq);
                }
                var q = nfPick(pool) || { q: '', opts: [] };
                setTimeout(function () {
                    nfAddCard('nf-truth', { t: { who: 'other', phase: 'ask', q: q.q, opts: q.opts, gid: r.id, time: Date.now() } });
                }, nfRand(1400, 3200));
            }
        } catch (e) {}
    }
};

/* 选项展示条（已回答时高亮被选中的选项） */
function nfTruthOptsChips(opts, picked) {
    if (!opts || !opts.length) return '';
    var h = '<div class="nf-truth-optchips">';
    for (var i = 0; i < opts.length; i++) {
        h += '<span' + (picked != null && opts[i] === picked ? ' class="picked"' : '') + '>' + nfEsc(opts[i]) + '</span>';
    }
    return h + '</div>';
}

/* 选项构建器（我出题卡片 / 题库弹窗 共用）
   root 内需含：[data-opttg] 展开/收起按钮、.nf-truth-optbuild 容器、
   [data-optlist] 选项输入列表、[data-addopt] 添加选项按钮；最多4个选项 */
function nfTruthWireOptBuilder(root) {
    var tg = root.querySelector('[data-opttg]');
    var box = root.querySelector('.nf-truth-optbuild');
    var list = root.querySelector('[data-optlist]');
    if (!tg || !box || !list) return;
    function addRow() {
        if (list.children.length >= 4) { nfToast('最多设置4个选项'); return; }
        var d = document.createElement('div');
        d.className = 'nf-truth-optitem';
        d.innerHTML = '<input type="text" maxlength="20" placeholder="选项' + (list.children.length + 1) + '"/><button type="button" data-delopt="1">' + nfIcon('close') + '</button>';
        list.appendChild(d);
    }
    tg.addEventListener('click', function (e) {
        e.stopPropagation();
        var hidden = box.style.display === 'none';
        box.style.display = hidden ? '' : 'none';
        if (hidden && !list.children.length) { addRow(); addRow(); }
    });
    var add = root.querySelector('[data-addopt]');
    if (add) add.addEventListener('click', function (e) { e.stopPropagation(); addRow(); });
    list.addEventListener('click', function (e) {
        var del = e.target && e.target.closest ? e.target.closest('[data-delopt]') : null;
        if (del && list.contains(del) && del.parentNode) del.parentNode.removeChild(del);
    });
}
/* 收集选项构建器里已填写的选项（过滤空行） */
function nfTruthCollectOpts(list) {
    var out = [];
    if (!list) return out;
    var inputs = list.querySelectorAll('input');
    for (var i = 0; i < inputs.length; i++) {
        var v = (inputs[i].value || '').trim();
        if (v) out.push(v);
    }
    return out;
}
/* 选项填写校验：要么不填（只有问题），要么至少填两个 */
function nfTruthOptsValid(opts) {
    if (!opts.length) return true;
    if (opts.length === 1) { nfToast('选项要么不填，要么至少填两个'); return false; }
    return true;
}

/* 真心话卡片渲染（所有问答都以聊天记录形式展示） */
function nfBuildTruthCard(msg) {
    var t = msg.t || {};
    var row = document.createElement('div');
    row.className = 'system-msg';
    row.dataset.id = msg.id;
    var card = document.createElement('div');
    card.className = 'nf-card nf-truth-card';
    var h = '<div class="nf-card-tape"></div>';
    var opts = Array.isArray(t.opts) ? t.opts : [];

    if (t.who === 'me') {
        if (t.phase === 'ask') {
            h += '<div class="nf-card-title">' + nfIcon('chat') + ' 真心话问问问</div>' +
                '<div class="nf-truth-sub">你赢了这局！可以向对方提一个真心话</div>' +
                '<div class="nf-truth-input-row"><input type="text" maxlength="60" placeholder="想问TA什么真心话？"/>' +
                '<button class="nf-btn primary" data-send="1">提问</button></div>' +
                '<button type="button" class="nf-truth-opttoggle" data-opttg="1">＋ 设置选项（对方直接从选项里选）</button>' +
                '<div class="nf-truth-optbuild" style="display:none">' +
                    '<div class="nf-truth-buildlist" data-optlist="1"></div>' +
                    '<button type="button" class="nf-truth-addopt" data-addopt="1">＋ 添加选项</button>' +
                    '<div class="nf-truth-buildtip">不设置选项的话，对方会用字卡里的内容回答</div>' +
                '</div>';
        } else if (t.phase === 'asked') {
            h += '<div class="nf-card-title">' + nfIcon('chat') + ' 真心话问问问</div>' +
                '<div class="nf-truth-q"><span>我的提问</span>' + nfEsc(t.q) + '</div>' +
                nfTruthOptsChips(opts) +
                '<div class="nf-truth-wait">对方正在认真想…</div>';
        } else if (t.phase === 'answered') {
            h += '<div class="nf-card-title">' + nfIcon('chat') + ' 真心话问问问</div>' +
                '<div class="nf-truth-q"><span>我的提问</span>' + nfEsc(t.q) + '</div>' +
                nfTruthOptsChips(opts, t.a) +
                '<div class="nf-truth-a"><span>对方的回答</span>' + nfEsc(t.a) + '</div>';
        }
    } else {
        if (t.phase === 'ask') {
            if (opts.length) {
                /* 有选项的问题：我直接点选项回答，不用打字 */
                var optBtns = '';
                for (var i = 0; i < opts.length; i++) {
                    optBtns += '<button type="button" class="nf-truth-opt" data-pick="' + i + '">' + nfEsc(opts[i]) + '</button>';
                }
                h += '<div class="nf-card-title">' + nfIcon('chat') + ' 真心话问问问</div>' +
                    '<div class="nf-truth-sub">你输了这局，对方想问你一个真心话</div>' +
                    '<div class="nf-truth-q"><span>对方提问</span>' + nfEsc(t.q) + '</div>' +
                    '<div class="nf-truth-opts">' + optBtns + '</div>';
            } else {
                /* 只有问题的题：直接输入回答 */
                h += '<div class="nf-card-title">' + nfIcon('chat') + ' 真心话问问问</div>' +
                    '<div class="nf-truth-sub">你输了这局，对方想问你一个真心话</div>' +
                    '<div class="nf-truth-q"><span>对方提问</span>' + nfEsc(t.q) + '</div>' +
                    '<div class="nf-truth-input-row"><input type="text" maxlength="80" placeholder="诚实地回答吧～"/>' +
                    '<button class="nf-btn primary" data-ans="1">回答</button></div>';
            }
        } else if (t.phase === 'answered') {
            h += '<div class="nf-card-title">' + nfIcon('chat') + ' 真心话问问问</div>' +
                '<div class="nf-truth-q"><span>对方提问</span>' + nfEsc(t.q) + '</div>' +
                nfTruthOptsChips(opts, t.a) +
                '<div class="nf-truth-a"><span>我的回答</span>' + nfEsc(t.a) + '</div>' +
                (t.react ? '<div class="nf-truth-react">对方：' + nfEsc(t.react) + '</div>' : '');
        }
    }
    h += '<div class="nf-card-date">- ' + nfFmtTime(t.time || msg.time) + ' -</div>';
    card.innerHTML = h;
    row.appendChild(card);

    /* 交互绑定 */
    var sendBtn = card.querySelector('[data-send]');
    var ansBtn = card.querySelector('[data-ans]');
    var pickBtns = card.querySelectorAll('[data-pick]');
    /* 我出题时的选项构建器 */
    nfTruthWireOptBuilder(card);

    function doAsk() {
        var input = card.querySelector('.nf-truth-input-row input');
        var q = (input.value || '').trim();
        if (!q) { nfToast('先写下你的问题吧'); return; }
        var myOpts = nfTruthCollectOpts(card.querySelector('[data-optlist]'));
        if (!nfTruthOptsValid(myOpts)) return;
        t.q = q; t.opts = myOpts; t.phase = 'asked';
        nfPersist(); nfRefreshChat();
        /* 对方稍后回答：有选项从选项里选，无选项从字卡里调取内容回复 */
        var delay = nfRand(2000, 5000);
        setTimeout(function () {
            var m = nfFindMsg(msg.id);
            if (!m || !m.t || m.t.phase !== 'asked') return;
            m.t.a = nfTruthAutoAnswer(m.t.opts);
            m.t.phase = 'answered';
            nfPersist(); nfRefreshChat();
        }, delay);
    }
    function doAnswer() {
        var input = card.querySelector('input');
        var a = (input.value || '').trim();
        if (!a) { nfToast('先写下你的回答吧'); return; }
        t.a = a; t.phase = 'answered';
        t.react = nfPick(TRUTH_C_PRESET);
        nfPersist(); nfRefreshChat();
    }
    function doPick(i) {
        if (!opts[i]) return;
        t.a = opts[i]; t.phase = 'answered';
        t.react = nfPick(TRUTH_C_PRESET);
        nfPersist(); nfRefreshChat();
    }
    if (sendBtn) {
        sendBtn.addEventListener('click', function (e) { e.stopPropagation(); doAsk(); });
        card.querySelector('input').addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); doAsk(); }
        });
    }
    if (ansBtn) {
        ansBtn.addEventListener('click', function (e) { e.stopPropagation(); doAnswer(); });
        card.querySelector('input').addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); doAnswer(); }
        });
    }
    if (pickBtns && pickBtns.length) {
        for (var p = 0; p < pickBtns.length; p++) {
            (function (btn) {
                btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    doPick(parseInt(btn.dataset.pick, 10));
                });
            })(pickBtns[p]);
        }
    }
    try { if (typeof attachRowMenu === 'function') attachRowMenu(row, msg.id); } catch (e) {}
    return row;
}

/* 真心话题库管理弹窗（从剪刀石头布弹窗进入）
   题目可带选项：带选项的题回答时直接从选项里选；
   只有问题的题：我直接输入回答，对方从「字卡」里随机调一句回复 */
function nfTruthOpenBank() {
    var old = document.getElementById('nfTruthModal');
    if (old) old.remove();
    var ov = document.createElement('div');
    ov.className = 'nf-modal-overlay';
    ov.id = 'nfTruthModal';
    function renderBody() {
        var qs = _truthCfg.questions || [];
        var h = '<div class="nf-modal nf-truth-bank">' +
            '<div class="nf-modal-close" data-act="close">' + nfIcon('close') + '</div>' +
            '<div class="nf-modal-title">真心话题库</div>' +
            '<div class="nf-modal-sub">自定义题目会加入随机池（和内置题库一起抽）；每局结束后自动进入真心话环节</div>' +
            '<div class="nf-scroll">' +
            '<div class="nf-tb-toggle"><span>真心话环节</span><button class="nf-btn ' + (_truthCfg.enabled ? 'primary' : 'plain') + '" data-tg="1">' + (_truthCfg.enabled ? '已开启' : '已关闭') + '</button></div>' +
            '<div class="nf-tb-sec"><div class="nf-tb-head">我的题目（' + qs.length + '条）</div>' +
                '<div class="nf-tb-add"><input type="text" maxlength="60" placeholder="添加自定义题目"/><button class="nf-btn primary" data-addq="1">添加</button></div>' +
                '<button type="button" class="nf-truth-opttoggle" data-opttg="1">＋ 给题目设置选项（可选）</button>' +
                '<div class="nf-truth-optbuild" style="display:none">' +
                    '<div class="nf-truth-buildlist" data-optlist="1"></div>' +
                    '<button type="button" class="nf-truth-addopt" data-addopt="1">＋ 添加选项</button>' +
                    '<div class="nf-truth-buildtip">设置了选项的题，回答时直接从选项里选；不设置的题直接回答</div>' +
                '</div>' +
                '<div class="nf-tb-list">' +
                (qs.length ? qs.map(function (q, i) {
                    var item = nfTruthNormQ(q) || { q: '(空)', opts: [] };
                    var optsHtml = '';
                    if (item.opts.length) {
                        var chips = '';
                        for (var k = 0; k < item.opts.length; k++) chips += '<i>' + nfEsc(item.opts[k]) + '</i>';
                        optsHtml = '<em class="nf-tb-opts">' + chips + '</em>';
                    }
                    return '<div class="nf-tb-item"><span>' + nfEsc(item.q) + optsHtml + '</span><button data-delq="' + i + '">' + nfIcon('close') + '</button></div>';
                }).join('') : '<div class="nf-empty">还没有自定义题目，目前使用内置题库</div>') +
                '</div></div>' +
            '<div class="nf-tb-sec"><div class="nf-tb-head">回答规则</div>' +
                '<div class="nf-truth-rule">· 带选项的问题：回答时直接点选项回答</div>' +
                '<div class="nf-truth-rule">· 只有问题的题：你直接打字回答；对方会从「字卡」里随机调一句回复（没有可用字卡时用内置回答）</div>' +
            '</div>' +
            '</div></div>';
        return h;
    }
    function mount() {
        ov.innerHTML = renderBody();
        ov.style.display = 'flex';
        ov.querySelector('[data-act="close"]').addEventListener('click', function () { ov.remove(); });
        ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
        var tg = ov.querySelector('[data-tg]');
        if (tg) tg.addEventListener('click', function () { _truthCfg.enabled = !_truthCfg.enabled; nfTruthSave(); mount(); });
        /* 添加题目（可带选项） */
        var addq = ov.querySelector('[data-addq]');
        if (addq) addq.addEventListener('click', function () {
            var input = ov.querySelector('[data-addq]').parentNode.querySelector('input');
            var v = (input.value || '').trim();
            if (!v) { nfToast('题目不能为空'); return; }
            var opts = nfTruthCollectOpts(ov.querySelector('[data-optlist]'));
            if (!nfTruthOptsValid(opts)) return;
            _truthCfg.questions.push({ q: v, opts: opts });
            nfTruthSave(); mount();
        });
        /* 选项构建器 */
        nfTruthWireOptBuilder(ov);
        ov.querySelectorAll('[data-delq]').forEach(function (b) {
            b.addEventListener('click', function () {
                _truthCfg.questions.splice(parseInt(b.dataset.delq, 10), 1);
                nfTruthSave(); mount();
            });
        });
        /* 回车快捷添加 */
        var qinp = ov.querySelector('.nf-tb-add input');
        if (qinp) qinp.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                ov.querySelector('[data-addq]').click();
            }
        });
    }
    document.body.appendChild(ov);
    mount();
}

/* 往剪刀石头布弹窗主界面注入「真心话题库」按钮 */
function nfTruthInjectBtn() {
    var btns = document.querySelector('#iaRpsModalBody .ia-modal-btn');
    if (!btns || document.getElementById('nfTruthBtn')) return;
    var b = document.createElement('button');
    b.className = 'ia-modal-btn plain';
    b.id = 'nfTruthBtn';
    b.textContent = '真心话题库';
    b.addEventListener('click', function (e) {
        e.stopPropagation();
        nfTruthOpenBank();
    });
    btns.parentNode.insertBefore(b, btns.nextSibling);
}


/* ==================== 8. 第10项：反应功能 ==================== */
/* 长按任意消息 →「回应」→ 选择反应图标；反应以小气泡挂在消息旁
   对方也会按概率对我发的消息做出反应（无冷却）；概率在聊天设置里调 */
var NF_REACTIONS = [
    { id: 'heart', name: '心动', svg: '<path d="M12 20.6C7.2 17.3 3 13.9 3 9.9 3 7.2 5 5 7.6 5c1.8 0 3.3 1 4.4 2.6C13.1 6 14.6 5 16.4 5 19 5 21 7.2 21 9.9c0 4-4.2 7.4-9 10.7z" fill="#ff6b81" stroke="none"/>' },
    { id: 'thumb', name: '赞', svg: '<path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3zm0 0l4.5-6.8A2 2 0 0 1 14.9 4l.5 1.6c.3 1-.3 2-1.3 2.3L11 10h7a2 2 0 0 1 2 2.4l-1.2 6A2 2 0 0 1 16.8 20H7" fill="#ffb340" stroke="none"/>' },
    { id: 'laugh', name: '哈哈', svg: '<circle cx="12" cy="12" r="9" fill="#ffd93b" stroke="none"/><path d="M7.5 12.5a4.5 4.5 0 0 0 9 0z" fill="#8a5a00"/><circle cx="9" cy="9" r="1.1" fill="#8a5a00"/><circle cx="15" cy="9" r="1.1" fill="#8a5a00"/>' },
    { id: 'cry', name: '哭哭', svg: '<path d="M12 21a9 9 0 1 1 9-9 7 7 0 0 1-9 9z" transform="rotate(180 12 12)" fill="#9fd0ff" stroke="none"/><path d="M8 17c1.5-2 6.5-2 8 0" fill="none" stroke="#3d6fa8" stroke-width="1.6" stroke-linecap="round"/><circle cx="9" cy="11" r="1.2" fill="#3d6fa8"/><circle cx="15" cy="11" r="1.2" fill="#3d6fa8"/><path d="M9 14.5l-1 3M15 14.5l1 3" stroke="#5aa2e8" stroke-width="1.6" stroke-linecap="round" fill="none"/>' },
    { id: 'angry', name: '生气', svg: '<circle cx="12" cy="13" r="9" fill="#ff8a80" stroke="none"/><path d="M6.5 8.5l3 1.5M17.5 8.5l-3 1.5" stroke="#b71c1c" stroke-width="1.6" stroke-linecap="round" fill="none"/><path d="M8.5 17c1-1.8 6-1.8 7 0" fill="none" stroke="#b71c1c" stroke-width="1.6" stroke-linecap="round"/><circle cx="9.3" cy="12" r="1.2" fill="#b71c1c"/><circle cx="14.7" cy="12" r="1.2" fill="#b71c1c"/>' },
    { id: 'wow', name: '惊讶', svg: '<circle cx="12" cy="12" r="9" fill="#ffd93b" stroke="none"/><circle cx="12" cy="14.5" r="2.6" fill="#8a5a00"/><circle cx="9" cy="9" r="1.2" fill="#8a5a00"/><circle cx="15" cy="9" r="1.2" fill="#8a5a00"/><path d="M8 6.5c1.2-.8 2.2-.8 3 0M13 6.5c.8-.8 1.8-.8 3 0" stroke="#8a5a00" stroke-width="1.2" stroke-linecap="round" fill="none"/>' }
];
var _reactProb = 0;
var _reactCurMsgId = null;

function nfReactSVG(type) {
    for (var i = 0; i < NF_REACTIONS.length; i++) {
        if (NF_REACTIONS[i].id === type) {
            return '<svg viewBox="0 0 24 24" style="width:14px;height:14px;flex:none;">' + NF_REACTIONS[i].svg + '</svg>';
        }
    }
    return '';
}

/* 消息行附加反应角标（由 buildMessageRow wrapper 调用） */
function nfReactAttachChips(row, msg) {
    try {
        if (!msg || !msg.reactions || !msg.reactions.length) return;
        var old = row.querySelector('.nf-react-chips');
        if (old) old.remove();
        var chips = document.createElement('div');
        chips.className = 'nf-react-chips' + (msg.sender === 'mine' ? ' mine' : '');
        var agg = {};
        msg.reactions.forEach(function (r) {
            if (!agg[r.type]) agg[r.type] = [];
            agg[r.type].push(r.by);
        });
        var h = '';
        for (var t in agg) {
            var byOther = agg[t].indexOf('other') >= 0;
            var byMe = agg[t].indexOf('mine') >= 0;
            h += '<span class="nf-react-chip' + (byOther && byMe ? ' both' : (byOther ? ' oth' : ' me')) + '" title="' + (byOther && byMe ? '你们都' : (byOther ? '对方' : '你')) + '">' + nfReactSVG(t) + '</span>';
        }
        chips.innerHTML = h;
        row.appendChild(chips);
    } catch (e) {}
}

/* 反应选择弹层 */
function nfReactOpenPicker(msgId) {
    var old = document.getElementById('nfReactPicker');
    if (old) old.remove();
    var m = nfFindMsg(msgId);
    if (!m) return;
    var box = document.createElement('div');
    box.id = 'nfReactPicker';
    box.className = 'nf-react-picker';
    var h = '';
    NF_REACTIONS.forEach(function (r) {
        var on = m.reactions && m.reactions.some(function (x) { return x.by === 'mine' && x.type === r.id; });
        h += '<span class="nf-react-opt' + (on ? ' on' : '') + '" data-t="' + r.id + '" title="' + r.name + '">' +
            '<svg viewBox="0 0 24 24">' + r.svg + '</svg></span>';
    });
    box.innerHTML = h;
    document.body.appendChild(box);
    /* 定位到屏幕中下方 */
    box.style.left = '50%';
    box.style.top = '38%';
    box.style.transform = 'translate(-50%,-50%)';
    box.querySelectorAll('.nf-react-opt').forEach(function (opt) {
        opt.addEventListener('click', function (e) {
            e.stopPropagation();
            var type = opt.dataset.t;
            if (!m.reactions) m.reactions = [];
            var exist = null;
            for (var i = 0; i < m.reactions.length; i++) {
                if (m.reactions[i].by === 'mine' && m.reactions[i].type === type) { exist = m.reactions[i]; break; }
            }
            if (exist) {
                m.reactions.splice(m.reactions.indexOf(exist), 1); /* 再点一次取消 */
            } else {
                /* 同一条消息上我的旧反应替换为新选择（一消息一反应，微信式） */
                m.reactions = m.reactions.filter(function (x) { return x.by !== 'mine'; });
                m.reactions.push({ by: 'mine', type: type, time: Date.now() });
            }
            nfPersist();
            nfRefreshChat();
            box.remove();
            /* 我给对方消息加反应时，对方有机会回应一个不同的反应 */
            if (m.sender === 'other' && m.reactions.length) nfReactOtherEcho(msgId);
        });
    });
    setTimeout(function () {
        var close = function (ev) { if (!box.contains(ev.target)) { box.remove(); document.removeEventListener('click', close, true); } };
        document.addEventListener('click', close, true);
    }, 50);
}

/* 对方也会跟一个反应（对我给对方消息加反应的行为做出小回应） */
function nfReactOtherEcho(msgId) {
    try {
        if (Math.random() * 100 > 30) return;
        setTimeout(function () {
            var m = nfFindMsg(msgId);
            if (!m || !m.reactions) return;
            if (m.reactions.some(function (x) { return x.by === 'other'; })) return;
            var pool = NF_REACTIONS.filter(function (r) { return r.id !== 'angry'; });
            m.reactions.push({ by: 'other', type: nfPick(pool).id, time: Date.now() });
            nfPersist(); nfRefreshChat();
        }, nfRand(1500, 4000));
    } catch (e) {}
}

/* 长按菜单注入「回应」项（包装 showMsgOpsMenu） */
function nfReactInstallMenu() {
    var menu = document.getElementById('msgOpsMenu');
    if (!menu || document.getElementById('nfReactMenuItem')) return;
    var item = document.createElement('div');
    item.className = 'msg-ops-item';
    item.id = 'nfReactMenuItem';
    item.textContent = '回应';
    item.addEventListener('click', function () {
        try { if (typeof closeMsgOpsMenu === 'function') closeMsgOpsMenu(); } catch (e) {}
        if (_reactCurMsgId != null) nfReactOpenPicker(_reactCurMsgId);
    });
    /* 放在「引用」前面 */
    var quote = menu.querySelector('.msg-ops-item:nth-child(2)');
    menu.insertBefore(item, quote || menu.firstChild);
}

/* 对方对我消息的主动反应（无冷却，按概率） */
function nfReactMaybeOtherReact(msg) {
    try {
        if (!msg || msg.sender !== 'mine' || _reactProb <= 0) return;
        if (msg.type !== 'text' && msg.type !== 'image' && msg.type !== 'emoji') return;
        if (Math.random() * 100 > _reactProb) return;
        setTimeout(function () {
            var m = nfFindMsg(msg.id);
            if (!m) return;
            if (!m.reactions) m.reactions = [];
            if (m.reactions.some(function (x) { return x.by === 'other'; })) return;
            m.reactions.push({ by: 'other', type: nfPick(NF_REACTIONS).id, time: Date.now() });
            nfPersist(); nfRefreshChat();
        }, nfRand(2000, 6000));
    } catch (e) {}
}

/* 聊天设置注入「对方回应概率」滑块（表情包概率行下方） */
function nfReactInjectSettings() {
    var anchor = document.getElementById('emojiProb');
    if (!anchor || document.getElementById('nfReactProbRow')) return;
    var row = anchor.closest('.settings-row');
    if (!row) return;
    var wrap = document.createElement('div');
    wrap.className = 'settings-row';
    wrap.id = 'nfReactProbRow';
    wrap.innerHTML = '<label>对方回应概率(%)</label>' +
        '<input id="nfReactProb" max="100" min="0" type="range" value="0" style="width:110px;"/>' +
        '<span id="nfReactProbVal">0</span><span style="font-size:10px;color:#999;margin-left:4px;">0-100</span>';
    row.parentNode.insertBefore(wrap, row.nextSibling);
    var slider = wrap.querySelector('#nfReactProb');
    var val = wrap.querySelector('#nfReactProbVal');
    slider.addEventListener('input', function () {
        _reactProb = parseInt(slider.value, 10) || 0;
        val.textContent = _reactProb;
        nfSave('nf_react_prob', _reactProb);
    });
    nfLoad('nf_react_prob', 0, function (v) {
        _reactProb = typeof v === 'number' ? v : 0;
        slider.value = String(_reactProb);
        val.textContent = _reactProb;
    });
}


/* ==================== 9. 第11项：桌宠（全站自由出没）+ 桌宠字卡 ==================== */
/* 桌宠在全网站自由出没（不躲任何页面，锁屏时除外），最大自由度：
   · 有时溜达到随机位置、有时原地长呆一阵子（节奏自己定）
   · 偶尔会躲起来一会儿（躲猫猫，可关闭），过一阵子再蹦出来
   · 可拖到任意位置；点一下会随机说一句「桌宠字卡」；长按进入桌宠设置
   数据全部存 IndexedDB（nf_pet），退出重进位置与设置不变 */
var NF_PET_PRESETS = {
    cat: {
        name: '小猫',
        svg: '<svg viewBox="0 0 64 64"><defs><linearGradient id="nfPetCat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe3c8"/><stop offset="1" stop-color="#ffcf9e"/></linearGradient></defs>' +
            '<path d="M16 26L12 12l12 7z" fill="url(#nfPetCat)" stroke="#d9a066" stroke-width="1.6" stroke-linejoin="round"/>' +
            '<path d="M48 26l4-14-12 7z" fill="url(#nfPetCat)" stroke="#d9a066" stroke-width="1.6" stroke-linejoin="round"/>' +
            '<ellipse cx="32" cy="36" rx="20" ry="18" fill="url(#nfPetCat)" stroke="#d9a066" stroke-width="1.6"/>' +
            '<circle cx="24.5" cy="34" r="2.6" fill="#4a3b2a"/><circle cx="39.5" cy="34" r="2.6" fill="#4a3b2a"/>' +
            '<path d="M32 39.5l-2.2 2.2h4.4z" fill="#e08585"/>' +
            '<path d="M32 41.7q-2.5 2.3-5 .4M32 41.7q2.5 2.3 5 .4" fill="none" stroke="#4a3b2a" stroke-width="1.4" stroke-linecap="round"/>' +
            '<path d="M14 37h8M14 40h8M42 37h8M42 40h8" stroke="#c98f5a" stroke-width="1.2" stroke-linecap="round"/>' +
            '<path d="M52 24q6 2 4 8" fill="none" stroke="#d9a066" stroke-width="2" stroke-linecap="round"/>' +
            '<ellipse cx="56" cy="33" rx="2.4" ry="3" fill="#ffb3c1" opacity=".9"/></svg>'
    },
    bunny: {
        name: '兔兔',
        svg: '<svg viewBox="0 0 64 64"><defs><linearGradient id="nfPetBun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fdf3f7"/><stop offset="1" stop-color="#f7dce8"/></linearGradient></defs>' +
            '<ellipse cx="24" cy="14" rx="4.6" ry="11" fill="url(#nfPetBun)" stroke="#dba8c0" stroke-width="1.5" transform="rotate(-8 24 14)"/>' +
            '<ellipse cx="40" cy="14" rx="4.6" ry="11" fill="url(#nfPetBun)" stroke="#dba8c0" stroke-width="1.5" transform="rotate(8 40 14)"/>' +
            '<ellipse cx="25" cy="13" rx="2.1" ry="7" fill="#f4b8cd" transform="rotate(-8 25 13)"/>' +
            '<ellipse cx="39" cy="13" rx="2.1" ry="7" fill="#f4b8cd" transform="rotate(8 39 13)"/>' +
            '<circle cx="32" cy="38" r="17" fill="url(#nfPetBun)" stroke="#dba8c0" stroke-width="1.5"/>' +
            '<circle cx="25.5" cy="36" r="2.3" fill="#6b4a5a"/><circle cx="38.5" cy="36" r="2.3" fill="#6b4a5a"/>' +
            '<circle cx="26.2" cy="35.3" r=".8" fill="#fff"/><circle cx="39.2" cy="35.3" r=".8" fill="#fff"/>' +
            '<path d="M32 40l-1.8 1.8h3.6z" fill="#e08585"/>' +
            '<path d="M28 45q4 3 8 0" fill="none" stroke="#6b4a5a" stroke-width="1.4" stroke-linecap="round"/>' +
            '<circle cx="20" cy="41" r="2.2" fill="#ffb3c1" opacity=".65"/><circle cx="44" cy="41" r="2.2" fill="#ffb3c1" opacity=".65"/></svg>'
    },
    bear: {
        name: '熊熊',
        svg: '<svg viewBox="0 0 64 64"><defs><linearGradient id="nfPetBear" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9b08c"/><stop offset="1" stop-color="#c39a6b"/></linearGradient></defs>' +
            '<circle cx="15" cy="17" r="7" fill="url(#nfPetBear)" stroke="#a07b52" stroke-width="1.5"/>' +
            '<circle cx="49" cy="17" r="7" fill="url(#nfPetBear)" stroke="#a07b52" stroke-width="1.5"/>' +
            '<circle cx="15" cy="17" r="3.4" fill="#e8c9a8"/><circle cx="49" cy="17" r="3.4" fill="#e8c9a8"/>' +
            '<circle cx="32" cy="36" r="18" fill="url(#nfPetBear)" stroke="#a07b52" stroke-width="1.5"/>' +
            '<ellipse cx="32" cy="42" rx="8.5" ry="6.5" fill="#e8c9a8"/>' +
            '<ellipse cx="32" cy="38.6" rx="3.6" ry="2.6" fill="#4a3b2a"/>' +
            '<path d="M32 41.2v2.6M32 43.8q-2.6 2.4-5 .5M32 43.8q2.6 2.4 5 .5" fill="none" stroke="#4a3b2a" stroke-width="1.4" stroke-linecap="round"/>' +
            '<circle cx="24.5" cy="33" r="2.4" fill="#4a3b2a"/><circle cx="39.5" cy="33" r="2.4" fill="#4a3b2a"/>' +
            '<circle cx="25.2" cy="32.3" r=".8" fill="#fff"/><circle cx="40.2" cy="32.3" r=".8" fill="#fff"/></svg>'
    }
};
var _petCfg = {
    enabled: true, preset: 'cat', img: null,
    autoMove: true, moveInterval: 14, hideSeek: true,
    x: 72, y: 55, sayProb: 100, bubbleDur: 5,
    cards: ['今天也要开心呀', '摸摸头，不哭', '偷偷告诉你，我在等你上线', '风吹过来都是甜的']
};
var _petEl = null;
var _petBubble = null;
var _petMoveTimer = null;
var _petVisTimer = null;
var _petHideTimer = null;
var _petDragging = false;
var _petDownT = 0;
var _petMoved = false;
var _petHidden = false;      /* 躲猫猫状态 */
var _petSaveT = 0;           /* 溜达位置的节流保存：避免每次移动都写库 */
var _petSaveDeb = null;      /* 设置面板滑块的防抖保存 */

function nfPetLoad(cb) {
    nfLoad('nf_pet', null, function (v) {
        if (v && typeof v === 'object') {
            for (var k in v) _petCfg[k] = v[k];
        }
        if (cb) cb();
    });
}
function nfPetSave() { nfSave('nf_pet', _petCfg); }

function nfPetImageHTML() {
    if (_petCfg.img) return '<img src="' + nfEsc(_petCfg.img) + '" alt=""/>';
    var p = NF_PET_PRESETS[_petCfg.preset] || NF_PET_PRESETS.cat;
    return p.svg;
}

function nfPetApplyPos(animate) {
    if (!_petEl) return;
    var dur = animate === false ? '0s' : '1.6s';
    _petEl.style.transitionDuration = dur;
    _petEl.style.left = _petCfg.x + '%';
    _petEl.style.top = _petCfg.y + '%';
}

/* 随机溜达：在可视范围内随机挑一个位置（避开底部dock区域） */
function nfPetWander() {
    if (!_petCfg.enabled || !_petCfg.autoMove || !_petEl) return;
    var oldX = _petCfg.x;
    var nx = nfRand(10, 86);
    var ny = nfRand(12, 62);
    _petCfg.x = nx; _petCfg.y = ny;
    /* 朝向：向右走朝右，向左走朝左 */
    if (nx > oldX) _petEl.classList.remove('flip');
    else if (nx < oldX) _petEl.classList.add('flip');
    nfPetApplyPos(true);
    nfPetSavePos();
}

/* 溜达位置保存节流：1分钟最多写一次库（拖动结束/退后台时会强制保存） */
function nfPetSavePos() {
    var now = Date.now();
    if (_petSaveT && now - _petSaveT < 60000) return;
    _petSaveT = now;
    nfPetSave();
}

/* 躲猫猫：偶尔躲起来一会儿，再从随机位置蹦出来 */
function nfPetHide() {
    if (!_petEl || _petHidden) return;
    _petHidden = true;
    if (_petBubble) { try { _petBubble.remove(); } catch (e) {} _petBubble = null; }
    _petEl.classList.add('hiding');
    if (_petHideTimer) clearTimeout(_petHideTimer);
    _petHideTimer = setTimeout(function () { nfPetReveal(); }, nfRand(9000, 40000));
}

/* 从躲猫猫里蹦出来：换个位置出现，偶尔说一句字卡 */
function nfPetReveal() {
    if (!_petEl || !_petHidden) return;
    _petHidden = false;
    _petCfg.x = nfRand(10, 86);
    _petCfg.y = nfRand(12, 62);
    nfPetApplyPos(false);
    _petEl.classList.remove('hiding');
    _petEl.classList.add('peek');
    setTimeout(function () { try { _petEl.classList.remove('peek'); } catch (e) {} }, 900);
    nfPetSave();
    var cards = _petCfg.cards || [];
    if (cards.length && Math.random() < 0.55) nfPetSay(true);
}

/* 每次行动：掷骰子决定接下来干嘛（最大自由度）
   · 偶尔躲猫猫（hideSeek 开启时）
   · 有时原地呆着不动（长呆）
   · 大多数时候溜达到新位置 */
function nfPetNextAction() {
    if (!_petCfg.enabled || !_petCfg.autoMove || !_petEl || _petHidden) return;
    var r = Math.random();
    if (_petCfg.hideSeek && r < 0.13) { nfPetHide(); return; }
    if (r < 0.38) return;   /* 它自己决定：原地再呆一会儿 */
    nfPetWander();
}

function nfPetScheduleWander() {
    if (_petMoveTimer) { clearTimeout(_petMoveTimer); _petMoveTimer = null; }
    if (!_petCfg.enabled || !_petCfg.autoMove) return;
    /* 自由节奏：基础间隔 ×(0.65~1.35)；三成概率进入“长呆”模式（×1.8~3.2） */
    var base = (_petCfg.moveInterval || 14) * 1000;
    var mult = Math.random() < 0.3 ? (1.8 + Math.random() * 1.4) : (0.65 + Math.random() * 0.7);
    var wait = Math.round(base * mult);
    _petMoveTimer = setTimeout(function () {
        nfPetNextAction();
        nfPetScheduleWander();
    }, wait);
}

/* 桌宠说话气泡（桌宠字卡） */
function nfPetSay(force) {
    if (!_petEl) return;
    var cards = _petCfg.cards || [];
    if (!cards.length) {
        nfToast('桌宠还没有字卡：长按桌宠 → 桌宠字卡 添加几句吧');
        return;
    }
    if (!force && Math.random() * 100 > (_petCfg.sayProb || 100)) return;
    if (_petBubble) _petBubble.remove();
    var b = document.createElement('div');
    b.className = 'nf-pet-bubble';
    b.textContent = nfPick(cards);
    _petEl.appendChild(b);
    _petBubble = b;
    requestAnimationFrame(function () { b.classList.add('show'); });
    if (b._t) clearTimeout(b._t);
    b._t = setTimeout(function () {
        b.classList.remove('show');
        setTimeout(function () { if (b.parentNode) b.remove(); if (_petBubble === b) _petBubble = null; }, 350);
    }, (_petCfg.bubbleDur || 5) * 1000);
}

/* 可见性：全站任何页面都正常出没；仅锁屏时藏起来
   （躲猫猫的隐身由 .hiding 样式类负责，不动 display，蹦出来时不受影响） */
function nfPetCheckVisibility() {
    if (!_petEl) return;
    var lock = document.querySelector('.lock-screen-overlay.active');
    var shouldShow = _petCfg.enabled && !lock;
    var isShown = _petEl.style.display !== 'none';
    if (shouldShow !== isShown) {
        _petEl.style.display = shouldShow ? '' : 'none';
        if (shouldShow) nfPetScheduleWander();
    }
}

function nfPetBuild() {
    if (_petEl) _petEl.remove();
    /* 重建形象时清掉躲猫猫状态，避免新元素被旧的隐藏状态卡住 */
    _petHidden = false;
    if (_petHideTimer) { clearTimeout(_petHideTimer); _petHideTimer = null; }
    var el = document.createElement('div');
    el.id = 'nfPet';
    el.className = 'nf-pet';
    el.innerHTML = '<div class="nf-pet-body">' + nfPetImageHTML() + '</div>' +
        '<div class="nf-pet-shadow"></div>';
    document.body.appendChild(el);
    _petEl = el;
    nfPetApplyPos(false);
    /* 点击 = 说一句桌宠字卡 */
    el.addEventListener('click', function () {
        if (_petMoved) { _petMoved = false; return; }  /* 拖动结束不触发说话 */
        if (_petHidden) return;                          /* 躲猫猫中不响应 */
        nfPetSay(false);
    });
    /* 长按 = 打开桌宠设置 */
    var lp = null;
    el.addEventListener('pointerdown', function (e) {
        _petDownT = Date.now();
        _petMoved = false;
        lp = setTimeout(function () { lp = null; nfPetOpenSettings(); }, 600);
    });
    el.addEventListener('pointermove', function () { if (lp) { clearTimeout(lp); lp = null; } });
    el.addEventListener('pointerup', function () { if (lp) { clearTimeout(lp); lp = null; } });
    /* 拖动：按住即可拖到任意位置 */
    var drag = null;
    el.addEventListener('pointerdown', function (e) {
        drag = { sx: e.clientX, sy: e.clientY, ox: _petCfg.x, oy: _petCfg.y, moved: false };
        try { el.setPointerCapture(e.pointerId); } catch (err) {}
    });
    el.addEventListener('pointermove', function (e) {
        if (!drag) return;
        var dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
        if (Math.abs(dx) + Math.abs(dy) > 6) {
            drag.moved = true;
            _petMoved = true;
            if (lp) { clearTimeout(lp); lp = null; }
            var nx = Math.max(2, Math.min(92, drag.ox + dx / window.innerWidth * 100));
            var ny = Math.max(4, Math.min(80, drag.oy + dy / window.innerHeight * 100));
            _petCfg.x = Math.round(nx * 10) / 10;
            _petCfg.y = Math.round(ny * 10) / 10;
            el.style.transitionDuration = '0s';
            el.style.left = _petCfg.x + '%';
            el.style.top = _petCfg.y + '%';
        }
    });
    function endDrag() {
        if (drag && drag.moved) {
            drag = null;
            nfPetSave();
            nfPetScheduleWander(); /* 拖完重新计时溜达 */
        }
        drag = null;
    }
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);
    /* 可见性轮询（仅锁屏时藏起来，全站其它页面照常出没；后台标签页跳过以省电） */
    if (_petVisTimer) clearInterval(_petVisTimer);
    _petVisTimer = setInterval(function () {
        if (!document.hidden) nfPetCheckVisibility();
    }, 900);
    /* 页面切后台/关闭前把最新位置落库（弥补溜达保存节流） */
    window.addEventListener('pagehide', function () { try { nfPetSave(); } catch (e) {} });
    document.addEventListener('visibilitychange', function () {
        try {
            if (document.hidden) nfPetSave();
            else nfPetCheckVisibility();
        } catch (e) {}
    });
    nfPetCheckVisibility();
    nfPetScheduleWander();
}

/* 桌宠设置弹窗 */
function nfPetOpenSettings() {
    var old = document.getElementById('nfPetModal');
    if (old) old.remove();
    var ov = document.createElement('div');
    ov.className = 'nf-modal-overlay';
    ov.id = 'nfPetModal';
    function render() {
        var presets = '';
        for (var k in NF_PET_PRESETS) {
            presets += '<span class="nf-pet-preset' + (!_petCfg.img && _petCfg.preset === k ? ' on' : '') + '" data-p="' + k + '">' +
                NF_PET_PRESETS[k].svg.replace(/viewBox="0 0 64 64"/, 'viewBox="0 0 64 64" style="width:34px;height:34px;"') +
                '<i>' + NF_PET_PRESETS[k].name + '</i></span>';
        }
        var cards = _petCfg.cards || [];
        ov.innerHTML = '<div class="nf-modal nf-pet-modal">' +
            '<div class="nf-modal-close" data-act="close">' + nfIcon('close') + '</div>' +
            '<div class="nf-modal-title">桌宠设置</div>' +
            '<div class="nf-modal-sub">桌宠在全站自由出没：有时溜达、有时原地长呆、偶尔躲起来一会儿；点它会说一句桌宠字卡</div>' +
            '<div class="nf-scroll">' +
                '<div class="nf-pet-row"><span>桌宠开关</span><button class="nf-btn ' + (_petCfg.enabled ? 'primary' : 'plain') + '" data-tg="1">' + (_petCfg.enabled ? '已开启' : '已关闭') + '</button></div>' +
                '<div class="nf-pet-sec-title">形象</div>' +
                '<div class="nf-pet-presets">' + presets +
                    '<span class="nf-pet-preset custom' + (_petCfg.img ? ' on' : '') + '" data-custom="1"><span class="nf-pet-custom-ico">' + nfIcon('image') + '</span><i>自定义</i></span>' +
                '</div>' +
                '<div class="nf-pet-row"><span>自己溜达</span><button class="nf-btn ' + (_petCfg.autoMove ? 'primary' : 'plain') + '" data-mv="1">' + (_petCfg.autoMove ? '已开启' : '已关闭') + '</button></div>' +
                '<div class="nf-pet-row"><span>偶尔躲起来（躲猫猫）</span><button class="nf-btn ' + (_petCfg.hideSeek ? 'primary' : 'plain') + '" data-hs="1">' + (_petCfg.hideSeek ? '已开启' : '已关闭') + '</button></div>' +
                '<div class="nf-pet-slider"><span>溜达间隔</span><input type="range" min="5" max="60" value="' + (_petCfg.moveInterval || 14) + '"/><b>' + (_petCfg.moveInterval || 14) + 's</b></div>' +
                '<div class="nf-pet-slider"><span>点击说话概率</span><input type="range" min="0" max="100" value="' + (_petCfg.sayProb || 100) + '"/><b>' + (_petCfg.sayProb || 100) + '%</b></div>' +
                '<div class="nf-pet-slider"><span>气泡显示时长</span><input type="range" min="2" max="15" value="' + (_petCfg.bubbleDur || 5) + '"/><b>' + (_petCfg.bubbleDur || 5) + 's</b></div>' +
                '<div class="nf-pet-sec-title">桌宠字卡（点它会随机说一句）</div>' +
                '<div class="nf-tb-add"><input type="text" maxlength="60" placeholder="添加一句桌宠会说的话"/><button class="nf-btn primary" data-addcard="1">添加</button></div>' +
                '<div class="nf-tb-list">' +
                    (cards.length ? cards.map(function (c, i) {
                        return '<div class="nf-tb-item"><span>' + nfEsc(c) + '</span><button data-delcard="' + i + '">' + nfIcon('close') + '</button></div>';
                    }).join('') : '<div class="nf-empty">还没有字卡，添加几句吧</div>') +
                '</div>' +
                '<div class="nf-pet-row"><span>回到初始位置</span><button class="nf-btn plain" data-reset="1">重置位置</button></div>' +
            '</div>' +
        '</div>';
        bind();
    }
    function bind() {
        ov.style.display = 'flex';
        ov.querySelector('[data-act="close"]').addEventListener('click', function () { ov.remove(); });
        ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
        ov.querySelector('[data-tg]').addEventListener('click', function () {
            _petCfg.enabled = !_petCfg.enabled; nfPetSave(); render();
            if (_petEl) _petEl.style.display = _petCfg.enabled ? '' : 'none';
            if (_petCfg.enabled) nfPetScheduleWander();
        });
        ov.querySelector('[data-mv]').addEventListener('click', function () {
            _petCfg.autoMove = !_petCfg.autoMove; nfPetSave(); render();
            if (_petCfg.autoMove) nfPetScheduleWander();
            else if (_petMoveTimer) { clearTimeout(_petMoveTimer); _petMoveTimer = null; }
        });
        var hsBtn = ov.querySelector('[data-hs]');
        if (hsBtn) hsBtn.addEventListener('click', function () {
            _petCfg.hideSeek = !_petCfg.hideSeek; nfPetSave(); render();
            /* 关掉躲猫猫时，如果正好躲着就把TA叫回来 */
            if (!_petCfg.hideSeek && _petHidden) {
                if (_petHideTimer) { clearTimeout(_petHideTimer); _petHideTimer = null; }
                nfPetReveal();
            }
        });
        /* 滑块：拖动过程只更新数值，停止600ms后才写库（原来每拖一格都写一次IndexedDB） */
        function saveDebounced() {
            if (_petSaveDeb) clearTimeout(_petSaveDeb);
            _petSaveDeb = setTimeout(function () { _petSaveDeb = null; nfPetSave(); }, 600);
        }
        var sliders = ov.querySelectorAll('.nf-pet-slider input');
        sliders[0].addEventListener('input', function () {
            _petCfg.moveInterval = parseInt(this.value, 10) || 14;
            this.parentNode.querySelector('b').textContent = _petCfg.moveInterval + 's';
            saveDebounced();
        });
        sliders[0].addEventListener('change', function () { nfPetScheduleWander(); });
        sliders[1].addEventListener('input', function () {
            _petCfg.sayProb = parseInt(this.value, 10) || 0;
            this.parentNode.querySelector('b').textContent = _petCfg.sayProb + '%';
            saveDebounced();
        });
        sliders[2].addEventListener('input', function () {
            _petCfg.bubbleDur = parseInt(this.value, 10) || 5;
            this.parentNode.querySelector('b').textContent = _petCfg.bubbleDur + 's';
            saveDebounced();
        });
        ov.querySelectorAll('.nf-pet-preset[data-p]').forEach(function (p) {
            p.addEventListener('click', function () {
                _petCfg.preset = p.dataset.p; _petCfg.img = null;
                nfPetSave(); render();
                if (_petEl) _petEl.querySelector('.nf-pet-body').innerHTML = nfPetImageHTML();
            });
        });
        var custom = ov.querySelector('[data-custom]');
        if (custom) custom.addEventListener('click', function () {
            var input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = function (e) {
                var f = e.target.files[0];
                if (!f) return;
                var reader = new FileReader();
                reader.onload = function (ev) {
                    _petCfg.img = ev.target.result;
                    nfPetSave(); render();
                    if (_petEl) _petEl.querySelector('.nf-pet-body').innerHTML = nfPetImageHTML();
                };
                reader.readAsDataURL(f);
            };
            input.click();
        });
        var addBtn = ov.querySelector('[data-addcard]');
        if (addBtn) addBtn.addEventListener('click', function () {
            var input = addBtn.parentNode.querySelector('input');
            var v = (input.value || '').trim();
            if (!v) { nfToast('内容不能为空'); return; }
            if (!_petCfg.cards) _petCfg.cards = [];
            _petCfg.cards.push(v);
            nfPetSave(); render();
        });
        ov.querySelectorAll('[data-delcard]').forEach(function (b) {
            b.addEventListener('click', function () {
                _petCfg.cards.splice(parseInt(b.dataset.delcard, 10), 1);
                nfPetSave(); render();
            });
        });
        var resetBtn = ov.querySelector('[data-reset]');
        if (resetBtn) resetBtn.addEventListener('click', function () {
            _petCfg.x = 72; _petCfg.y = 55;
            nfPetSave(); nfPetApplyPos(false);
            nfToast('桌宠回到初始位置');
        });
        /* 回车快捷添加 */
        var inp = ov.querySelector('.nf-tb-add input');
        if (inp) inp.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); ov.querySelector('[data-addcard]').click(); }
        });
    }
    document.body.appendChild(ov);
    render();
}

function nfInitPet() {
    nfPetLoad(function () {
        if (_petCfg.enabled === undefined) _petCfg.enabled = true;
        nfPetBuild();
    });
}


/* ==================== 10. 第12项：字卡导入导出 ==================== */
/* 在字卡管理界面注入「导出全部字卡」「导入字卡」按钮
   导出：全部分组 + 联系人独立字卡（JSON文件）
   导入：按文字去重合并（不清空原有字卡），同名分组合并 */
function nfWcInjectBtns() {
    var anchor = document.querySelector('#wordcardPage .wordcard-actions');
    if (!anchor || document.getElementById('nfWcBtns')) return;
    var wrap = document.createElement('div');
    wrap.id = 'nfWcBtns';
    wrap.style.cssText = 'width:100%;display:flex;gap:8px;margin-top:4px;flex-wrap:wrap;';
    var exp = document.createElement('div');
    exp.className = 'action-btn';
    exp.textContent = '导出全部字卡';
    exp.addEventListener('click', function (e) { e.stopPropagation(); nfWcExport(); });
    var imp = document.createElement('div');
    imp.className = 'action-btn';
    imp.textContent = '导入字卡';
    imp.addEventListener('click', function (e) { e.stopPropagation(); nfWcImport(); });
    wrap.appendChild(exp);
    wrap.appendChild(imp);
    anchor.appendChild(wrap);
}

function nfWcExport() {
    try {
        var data = nfAppData();
        var payload = {
            nfWordCards: true,
            exportedAt: new Date().toISOString(),
            wordCards: data.wordCards || {},
            wordGroups: data.wordGroups || [],
            contactWordCards: data.contactWordCards || {}
        };
        var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = '字卡_' + new Date().toISOString().slice(0, 10) + '.json';
        a.click();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
        nfToast('字卡已导出（含全部分组）');
    } catch (e) { nfToast('导出失败，请重试'); }
}

function nfWcImport() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = function (e) {
        var f = e.target.files[0];
        if (!f) return;
        var reader = new FileReader();
        reader.onload = function (ev) {
            try {
                var data = JSON.parse(ev.target.result);
                var src = data.wordCards || data.nfWordCards || null;
                if (!src || typeof src !== 'object') { nfToast('这不是有效的字卡文件'); return; }
                var app = nfAppData();
                if (!app.wordCards) app.wordCards = { default: [] };
                var added = 0, groups = 0;
                for (var g in src) {
                    var list = Array.isArray(src[g]) ? src[g] : [];
                    if (!app.wordCards[g]) { app.wordCards[g] = []; groups++; }
                    var texts = {};
                    app.wordCards[g].forEach(function (c) { texts[c.text] = true; });
                    list.forEach(function (c) {
                        var t = c && typeof c === 'object' ? c.text : c;
                        if (!t || texts[t]) return;
                        texts[t] = true;
                        app.wordCards[g].push(typeof c === 'object' ? { text: t, hidden: !!c.hidden } : { text: t, hidden: false });
                        added++;
                    });
                }
                /* 分组名同步到分组列表 */
                if (Array.isArray(data.wordGroups)) {
                    var names = (data.wordGroups || []).map(function (x) { return typeof x === 'string' ? x : x.name; });
                    if (Array.isArray(app.wordGroups)) {
                        names.forEach(function (n) {
                            if (n && !app.wordGroups.some(function (x) { return (typeof x === 'string' ? x : x.name) === n; })) {
                                app.wordGroups.push(n);
                            }
                        });
                    }
                }
                /* 联系人独立字卡合并 */
                if (data.contactWordCards && typeof data.contactWordCards === 'object') {
                    if (!app.contactWordCards) app.contactWordCards = {};
                    for (var cid in data.contactWordCards) {
                        var cList = Array.isArray(data.contactWordCards[cid]) ? data.contactWordCards[cid] : [];
                        if (!app.contactWordCards[cid]) app.contactWordCards[cid] = [];
                        var cTexts = {};
                        app.contactWordCards[cid].forEach(function (c) { cTexts[c.text] = true; });
                        cList.forEach(function (c) {
                            var t = c && typeof c === 'object' ? c.text : c;
                            if (!t || cTexts[t]) return;
                            cTexts[t] = true;
                            app.contactWordCards[cid].push(typeof c === 'object' ? { text: t, hidden: !!c.hidden } : { text: t, hidden: false });
                            added++;
                        });
                    }
                }
                nfPersist();
                try {
                    if (typeof renderWordCardList === 'function') renderWordCardList();
                    if (typeof renderWordCardTabs === 'function') renderWordCardTabs();
                } catch (err) {}
                nfToast('导入完成：新增 ' + added + ' 张字卡' + (groups ? '、' + groups + ' 个分组' : '') + '（已自动去重）');
            } catch (err) { nfToast('文件解析失败，请确认是字卡导出文件'); }
        };
        reader.readAsText(f);
    };
    input.click();
}


/* ==================== 11. 第13项：备份提醒 ==================== */
/* 超过7天没备份（或从未备份且使用超过3天）时，在聊天里发一张提醒卡片
   每天最多提醒一次；点击卡片「去备份」直达存储数据页 */
var NF_BACKUP_DAYS = 7;

function nfBackupTouch() {
    nfSave('nf_last_backup', Date.now());
    nfSave('nf_last_backup_remind', 0);
}

function nfBackupMaybeRemind() {
    try {
        nfLoad('nf_last_backup', 0, function (last) {
            nfLoad('nf_last_backup_remind', 0, function (lastRemind) {
                var today = new Date(); today.setHours(0, 0, 0, 0);
                if (lastRemind && Date.now() - lastRemind < 86400000) return;   /* 今天已提醒过 */
                var need = false;
                if (!last) {
                    /* 从未备份：使用超过3天就提醒 */
                    nfLoad('nf_first_seen', 0, function (first) {
                        if (!first) { nfSave('nf_first_seen', Date.now()); return; }
                        if (Date.now() - first > 3 * 86400000) need = true;
                        if (need) doRemind();
                    });
                    return;
                }
                if (Date.now() - last > NF_BACKUP_DAYS * 86400000) need = true;
                if (need) doRemind();
                function doRemind() {
                    var days = last ? Math.floor((Date.now() - last) / 86400000) : 0;
                    nfSave('nf_last_backup_remind', Date.now());
                    nfAddCard('nf-backup', { bk: { time: Date.now(), days: days } });
                }
            });
        });
    } catch (e) {}
}

function nfBuildBackupCard(msg) {
    var b = msg.bk || {};
    var row = document.createElement('div');
    row.className = 'system-msg';
    row.dataset.id = msg.id;
    var card = document.createElement('div');
    card.className = 'nf-card nf-backup-card';
    var tip = b.days ? '已经 ' + b.days + ' 天没有备份啦，数据都只存在这台设备上，备份一下更安心～'
                     : '好像还从来没有备份过哦，数据都只存在这台设备上，导出一份备份更安心～';
    card.innerHTML = '<div class="nf-card-tape"></div>' +
        '<div class="nf-card-title">' + nfIcon('bell') + ' 备份小提醒</div>' +
        '<div class="nf-backup-text">' + nfEsc(tip) + '</div>' +
        '<div class="nf-btns"><button class="nf-btn primary" data-go="1">去备份</button>' +
        '<button class="nf-btn plain" data-dismiss="1">先不用</button></div>' +
        '<div class="nf-card-date">- ' + nfFmtTime(b.time || msg.time) + ' -</div>';
    row.appendChild(card);
    card.querySelector('[data-go]').addEventListener('click', function (e) {
        e.stopPropagation();
        try { if (typeof openStorageApp === 'function') openStorageApp(); } catch (err) {}
    });
    card.querySelector('[data-dismiss]').addEventListener('click', function (e) {
        e.stopPropagation();
        nfToast('好的，下次再提醒你');
    });
    return row;
}

/* 记录用户点击过导出按钮（视为完成过备份） */
function nfBackupHookButtons() {
    try {
        document.addEventListener('click', function (e) {
            var btn = e.target.closest('button');
            if (!btn) return;
            var txt = (btn.textContent || '').trim();
            if (txt.indexOf('导出全局文件') >= 0 || txt.indexOf('导出聊天记录') >= 0 || txt.indexOf('导出字卡备份') >= 0 || txt.indexOf('导出全部字卡') >= 0) {
                nfBackupTouch();
            }
        }, true);
    } catch (e) {}
}


/* ==================== 12. 第14项：OPPO手机录音提示优化 ==================== */
/* OPPO/vivo 自带录音机常见格式（部分amr变种）浏览器选不了或读了没反应
   在打开语音上传入口时提前给一条友好提示，读失败后再给一次（纯提示，不改正片逻辑） */
function nfIsOppoLike() {
    try {
        var ua = navigator.userAgent || '';
        if (/OPPO|PA[A-Z]{2}\d{2}|CPH\d{3,4}|PCG\d{3,4}|PCT\d{3,4}|PED\d{3,4}|vivo|V\d{4}A|iQOO/i.test(ua)) return true;
        if (navigator.userAgentData && navigator.userAgentData.brands) {
            var b = navigator.userAgentData.brands.some(function (x) { return /OPPO|vivo/i.test(x.brand || ''); });
            if (b) return true;
        }
        var nav = navigator.userAgentData && navigator.userAgentData.mobile;
        return nav === true && /Android/i.test(ua) && false; /* 其余安卓不做提示 */
    } catch (e) { return false; }
}
var _oppoTipShown = false;

function nfOppoShowTip() {
    if (!_oppoTipShown) {
        _oppoTipShown = true;
        nfToast('OPPO/vivo手机录音文件格式可能不受支持：如果选完没反应，请到「文件管理」把录音重命名成 .mp3 或 .m4a 后再选择上传');
    }
}

function nfInitOppoTip() {
    if (!nfIsOppoLike()) return;
    /* 打开语音上传入口时提示 */
    try {
        document.addEventListener('click', function (e) {
            var el = e.target.closest('[onclick*="audioFileInput"], [onclick*="handleAudioCardUpload"]');
            if (el) nfOppoShowTip();
        }, true);
    } catch (e) {}
    /* 读取失败兜底提示 */
    try {
        var orig = window.handleAudioCardUpload;
        if (typeof orig === 'function') {
            window.handleAudioCardUpload = function (e) {
                var files = e && e.target ? e.target.files : null;
                var r = orig.apply(this, arguments);
                if (files && files.length) {
                    setTimeout(function () { _oppoTipShown = false; }, 1500); /* 下次再提示 */
                }
                return r;
            };
        }
    } catch (e) {}
}


/* ==================== 13. 装配层：补丁安装 + 初始化入口 ==================== */
/* 上面各功能都是“零件”，这里统一装配（此前主文件所有内联脚本均已执行完毕） */

/* 13.1 消息行渲染补丁：nf 卡片分发 + 反应角标挂载
   主文件内部调用 buildMessageRow 时经全局作用域解析，包装 window 上的引用即可生效 */
function nfPatchBuildMessageRow() {
    if (!window.buildMessageRow || window.buildMessageRow._nfPatched) return;
    var orig = window.buildMessageRow;
    var wrapped = function (msg) {
        var row = null;
        try {
            if (msg && msg.type === 'system' && msg.subtype) {
                if (msg.subtype === 'nf-av' && msg.nfav) return nfBuildAvCard(msg);
                if (msg.subtype === 'nf-remark2' && msg.rm2) return nfBuildRemarkCard(msg);
                if (msg.subtype === 'nf-truth' && msg.t) return nfBuildTruthCard(msg);
                if (msg.subtype === 'nf-backup' && msg.bk) return nfBuildBackupCard(msg);
            }
        } catch (e) {}
        row = orig.apply(this, arguments);
        try { if (row && row.nodeType === 1 && msg) nfReactAttachChips(row, msg); } catch (e) {}
        return row;
    };
    wrapped._nfPatched = true;
    window.buildMessageRow = wrapped;
}

/* 13.2 消息发送补丁：我发消息后 → 头像概率触发 + 对方回应概率（均无冷却） */
function nfPatchAddMessage() {
    if (!window.addMessage || window.addMessage._nfPatched) return;
    var orig = window.addMessage;
    var wrapped = function (msg) {
        var r = orig.apply(this, arguments);
        try {
            if (msg && msg.sender === 'mine' && !msg.subtype &&
                (msg.type === 'text' || msg.type === 'emoji' || msg.type === 'image')) {
                nfAvMaybeTrigger();
                nfReactMaybeOtherReact(msg);
            }
        } catch (e) {}
        return r;
    };
    wrapped._nfPatched = true;
    window.addMessage = wrapped;
}

/* 13.3 长按菜单补丁：捕获当前操作的消息id（供「回应」入口使用） */
function nfPatchShowMsgOpsMenu() {
    if (!window.showMsgOpsMenu || window.showMsgOpsMenu._nfPatched) return;
    var orig = window.showMsgOpsMenu;
    var wrapped = function (e, msgId) {
        try { _reactCurMsgId = msgId; } catch (err) {}
        return orig.apply(this, arguments);
    };
    wrapped._nfPatched = true;
    window.showMsgOpsMenu = wrapped;
}

/* 13.4 静态UI注入（全部幂等：已注入则直接返回；界面局部重绘后也可安全重跑） */
function nfInjectAll() {
    nfInitKbSlider();
    nfAvInjectEntry();
    nfRemarkInjectEntry();
    nfReactInjectSettings();
    nfReactInstallMenu();
    nfWcInjectBtns();
    nfTruthInjectBtn();
}

/* 13.5 数据就绪后的初始化（表情分类接管 / 桌宠 / 备份提醒）
   必须等主文件 IndexedDB 数据合并完成，避免读到迁移前的旧结构 */
function nfInitAfterData() {
    if (nfInitAfterData._done) return;
    nfInitAfterData._done = true;
    try { nfAvLoad(); } catch (e) {}
    try { nfTruthLoad(); } catch (e) {}
    try { nfInitEmojiCats(); } catch (e) { console.error('[NF] 表情分类初始化失败:', e); }
    try { nfInitPet(); } catch (e) { console.error('[NF] 桌宠初始化失败:', e); }
    /* 备份提醒：进入40秒后检查一次（每天最多提醒一次） */
    setTimeout(function () { try { nfBackupMaybeRemind(); } catch (e) {} }, 40000);
    /* 重渲染消息流：让已存在的 nf 卡片（退出重进后）正确显示 */
    setTimeout(function () { try { nfRefreshChat(); } catch (e) {} }, 600);
}

/* 13.6 启动入口 */
function nfBoot() {
    /* 阶段1：立即安装补丁与静态注入（此时主文件全部内联脚本已执行） */
    try { nfPatchBuildMessageRow(); } catch (e) { console.error('[NF] 渲染补丁失败:', e); }
    try { nfPatchAddMessage(); } catch (e) { console.error('[NF] 发送补丁失败:', e); }
    try { nfPatchShowMsgOpsMenu(); } catch (e) { console.error('[NF] 菜单补丁失败:', e); }
    try { nfInitHexInputs(); } catch (e) { console.error('[NF] 色号输入框失败:', e); }
    try { nfInjectAll(); } catch (e) { console.error('[NF] UI注入失败:', e); }
    try { nfBackupHookButtons(); } catch (e) {}
    try { nfInitOppoTip(); } catch (e) {}

    /* 阶段2：等待主文件 IndexedDB 加载完成（_idbReady 为其全局标记）
       兜底：最多等15秒，超时也继续初始化，避免功能卡死 */
    var waited = 0;
    var timer = setInterval(function () {
        waited += 150;
        var ready = false;
        try { ready = (typeof _idbReady !== 'undefined') && _idbReady === true; } catch (err) {}
        if (ready || waited >= 15000) {
            clearInterval(timer);
            try { nfInitAfterData(); } catch (e) { console.error('[NF] 数据就绪初始化失败:', e); }
        }
    }, 150);

    /* 周期性补注入：界面局部重绘导致入口丢失时自动补回（幂等，开销极小）
       性能优化：页面切到后台时暂停，回到前台立即补一次 */
    setInterval(function () {
        if (document.hidden) return;
        try { nfInjectAll(); } catch (e) {}
    }, 3000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { try { nfBoot(); } catch (e) { console.error('[NF] 启动失败:', e); } });
} else {
    try { nfBoot(); } catch (e) { console.error('[NF] 启动失败:', e); }
}

/* 调试接口 */
NF.version = '1.0.0';
NF.boot = nfBoot;
NF.toast = nfToast;

})();


/* ==================== 15. 更新与修复通告（更新后首次进入弹一次） ==================== */
/* 汇总本窗口全部更新与修复内容：localStorage 记录已读，只有点过「我知道了」才不再显示；
   弹出后需停留满 120 秒按钮才可点击（确保读完），期间无法用其它方式关闭。
   深色模式自动适配；z-index 999999 压过锁屏(9999)与所有弹窗。 */
(function () {
    var KEY = 'nf_update_notice_20260909';
    try { if (localStorage.getItem(KEY)) return; } catch (e) { return; }
    var WAIT = 120;   /* 强制阅读秒数：120秒后才允许关闭 */
    var left = WAIT;
    var ov = document.createElement('div');
    ov.className = 'nf-upd-overlay';
    ov.innerHTML =
        '<div class="nf-upd-box">' +
            '<div class="nf-upd-title">更新与修复通告</div>' +
            '<div class="nf-upd-list">' +
                '<p><b>真心话大冒险</b>：出题时可以给题目设置选项（最多4个）。有选项的问题直接点选项回答；没有选项的问题，对方用字卡内容回答，也可以自己作答。</p>' +
                '<p><b>锁屏密码</b>：只支持设置4-12位纯数字。之前设置过非数字密码的已重置为默认密码080365，解锁后请尽快修改。</p>' +
                '<p><b>桌宠</b>：全站自由出没，不再固定在某个页面。偶尔躲猫猫，之后换个位置出现；有时长待原地，有时四处溜达。</p>' +
                '<p><b>流畅度</b>：聊天记录按需渲染、数据保存写入降频、后台暂停部分动画，翻记录和打字更顺。</p>' +
                '<p><b>后台保活</b>：静音音频被视频等App打断后，回到网页会自动恢复保活，不用手动重开；保活开关只有手动关闭才会停止。</p>' +
            '</div>' +
            '<button class="nf-upd-btn" type="button" disabled>我知道了 (' + left + 's)</button>' +
        '</div>';
    document.body.appendChild(ov);
    var btn = ov.querySelector('.nf-upd-btn');
    var t = setInterval(function () {
        left--;
        if (left <= 0) {
            clearInterval(t);
            btn.disabled = false;
            btn.textContent = '我知道了';
        } else {
            btn.textContent = '我知道了 (' + left + 's)';
        }
    }, 1000);
    btn.addEventListener('click', function () {
        if (btn.disabled) return;
        clearInterval(t);
        try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {}
        ov.remove();
    });
})();
