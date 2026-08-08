// Service Worker - 后台保活与消息通知
// 缓存名使用固定版本号（与 index.html 中的 _SW_BUILD 对应）。
// 旧实现使用 'qianyi-cache-' + Date.now()，导致每次 SW 重新安装都生成全新缓存名，
// 旧缓存被反复清空重建，配合主线程的 controllerchange→reload 在安卓上引发界面闪烁与刷新死循环。
const CACHE_NAME = 'qianyi-cache-v20260808a';
const SILENT_AUDIO = './silent.mp3';

// 安装时缓存静音音频，并跳过等待以便新版本尽快激活（激活后静默接管，主线程不再强制刷新）
self.addEventListener('install', function(event) {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.add(SILENT_AUDIO).catch(function(){});
        })
    );
});

// 激活时接管，并清理旧版本缓存（仅保留当前版本，确保苹果用户拿到最新资源）
self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(keys.map(function(k) {
                if (k !== CACHE_NAME) { return caches.delete(k); }
            }));
        }).then(function() { return self.clients.claim(); })
    );
});

// 接收主线程消息
self.addEventListener('message', function(event) {
    var data = event.data;
    if (!data) return;

    if (data.type === 'SKIP_WAITING') {
        // 主线程请求立即激活新版本（静默激活，不触发页面刷新）
        self.skipWaiting();
    }

    if (data.type === 'ALIVE') {
        // 保活心跳：回复确认
        event.ports[0] && event.ports[0].postMessage({ type: 'ALIVE_ACK', ts: Date.now() });
    }

    if (data.type === 'NOTIFY') {
        // 显示通知
        if (self.registration && self.registration.showNotification) {
            self.registration.showNotification(data.title || '消息', {
                body: data.body || '',
                tag: data.tag || 'qianyi-msg',
                icon: data.icon || '',
                data: data.data || {},
                silent: false
            }).catch(function(){});
        }
    }

    if (data.type === 'CLEAR_BADGE') {
        if (navigator.clearAppBadge) navigator.clearAppBadge().catch(function(){});
    }
});

// 通知点击：聚焦窗口并通知主线程直接进入对应聊天界面
self.addEventListener('notificationclick', function(event) {
    var _data = (event.notification && event.notification.data) || {};
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
            for (var i = 0; i < clientList.length; i++) {
                var client = clientList[i];
                // 通知主线程：用户点击了系统通知，请直接进入对应聊天
                try { client.postMessage({ type: 'NOTIF_CLICK', contactId: _data.contactId || null }); } catch(e) {}
                if ('focus' in client) { return client.focus(); }
            }
            if (self.clients.openWindow) return self.clients.openWindow('./');
        })
    );
});

// 定期同步（如果浏览器支持）
self.addEventListener('periodicsync', function(event) {
    if (event.tag === 'keep-alive') {
        event.waitUntil(
            self.clients.matchAll().then(function(clients) {
                clients.forEach(function(client) {
                    client.postMessage({ type: 'PERIODIC_TICK', ts: Date.now() });
                });
            })
        );
    }
});
