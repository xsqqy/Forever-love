// Service Worker - 后台保活与消息通知
// 版本号使用 Date.now()：每次 SW 重新安装都会生成新缓存名，
// 配合注册时的自动时间戳，强制 iOS Safari 拉取最新资源，
// 解决苹果用户必须开梯子才能访问（旧缓存不刷新）的问题。
const CACHE_NAME = 'qianyi-cache-' + Date.now();
const SILENT_AUDIO = './silent.mp3';

// 安装时缓存静音音频
self.addEventListener('install', function(event) {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.add(SILENT_AUDIO).catch(function(){});
        })
    );
});

// 激活时接管，并清理旧版本缓存（清除历史缓存，确保苹果用户拿到最新资源）
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
