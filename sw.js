// Service Worker v4 - 消息通知 + 自动更新（合并版）
// 整合策略：
//   · 通知/保活/点击/定期同步 → 完全沿用 sw2.js（已验证 Android & iOS 通知正常）
//   · 自动刷新 → 仅新增 SKIP_WAITING 消息处理，配合 HTML 端 updatefound/controllerchange/reload
//   · 零 fetch 拦截 → 保活音频与通知链路完全不受干扰（这是 v3 通知失效的根因）
const CACHE_NAME = 'qianyi-cache-v4';
const SILENT_AUDIO = './silent.mp3';
const DEFAULT_ICON = './icon-192.png';

// 安装时缓存静音音频
self.addEventListener('install', function(event) {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.add(SILENT_AUDIO).catch(function(){});
        })
    );
});

// 激活时接管所有客户端，并清理旧版本缓存
self.addEventListener('activate', function(event) {
    event.waitUntil(
        Promise.all([
            self.clients.claim(),
            caches.keys().then(function(keyList) {
                return Promise.all(keyList.map(function(key) {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                }));
            })
        ])
    );
});

// 接收主线程消息
self.addEventListener('message', function(event) {
    var data = event.data;
    if (!data) return;

    // 主线程通知新版本接管：立即 skipWaiting（配合 HTML 端 controllerchange 自动刷新）
    if (data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (data.type === 'ALIVE') {
        // 保活心跳：回复确认
        event.ports[0] && event.ports[0].postMessage({ type: 'ALIVE_ACK', ts: Date.now() });
    }

    if (data.type === 'NOTIFY') {
        // 显示消息通知（Android & iOS 通用）
        if (self.registration && self.registration.showNotification) {
            self.registration.showNotification(data.title || '消息', {
                body: data.body || '',
                tag: data.tag || 'qianyi-msg',
                icon: data.icon || DEFAULT_ICON,
                badge: data.icon || DEFAULT_ICON,
                data: data.data || {},
                silent: false
            }).catch(function(){});
        }
    }

    if (data.type === 'CLEAR_BADGE') {
        if (navigator.clearAppBadge) navigator.clearAppBadge().catch(function(){});
    }
});

// 通知点击：聚焦窗口
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window' }).then(function(clientList) {
            for (var i = 0; i < clientList.length; i++) {
                var client = clientList[i];
                if ('focus' in client) return client.focus();
            }
            if (self.clients.openWindow) return self.clients.openWindow('./');
        })
    );
});

// 通知关闭：清除角标
self.addEventListener('notificationclose', function() {
    if (navigator.clearAppBadge) navigator.clearAppBadge().catch(function(){});
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
