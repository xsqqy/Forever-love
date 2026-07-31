// Service Worker v3 - 消息通知 + 自动更新（合并版）
// 整合自：
//   · sw.js（自动刷新）：network-first 导航 + SKIP_WAITING → 网站更新后自动刷新
//   · sw 2.js（消息通知）：不拦截非导航资源 → 后台保活/消息通知正常（Android & iOS）
// 关键：仅拦截导航请求，其余资源一律放行，确保保活音频与通知链路不受干扰
const CACHE_NAME = 'qianyi-cache-v3';
const SILENT_AUDIO = './silent.mp3';

// ===== 安装：预缓存静音音频（保活必需），立即接管 =====
self.addEventListener('install', function(event) {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.add(SILENT_AUDIO).catch(function(){});
        })
    );
});

// ===== 激活：接管所有客户端 + 清理旧版本缓存 =====
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

// ===== fetch 拦截：仅拦截导航请求（network-first）=====
// 导航请求（HTML 页面）走 network-first，确保网站更新后重新进入即可获取最新版本；
// 离线时回退缓存。其余资源（JS/CSS/图片/音频/接口等）一律不拦截，
// 由浏览器自然处理 —— 这保证了后台保活音频播放、消息通知等功能不受影响（兼容 Android & iOS）。
self.addEventListener('fetch', function(event) {
    var request = event.request;

    // 仅处理 GET 请求
    if (request.method !== 'GET') return;

    // 仅拦截导航请求（页面加载）→ network-first
    if (request.mode === 'navigate' || (request.headers.get('accept') && request.headers.get('accept').indexOf('text/html') !== -1)) {
        event.respondWith(
            fetch(request).then(function(networkResponse) {
                // 网络成功：缓存最新页面并返回
                if (networkResponse && networkResponse.status === 200) {
                    var clone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(function(cache) {
                        cache.put(request, clone).catch(function(){});
                    });
                }
                return networkResponse;
            }).catch(function() {
                // 网络失败（离线）：回退缓存
                return caches.match(request).then(function(cached) {
                    if (cached) return cached;
                    // 无缓存时返回最基本的离线提示
                    return new Response('<h1>离线</h1><p>当前无网络连接，请联网后重试。</p>', {
                        headers: { 'Content-Type': 'text/html; charset=utf-8' }
                    });
                });
            })
        );
        return;
    }

    // 其他资源（JS/CSS/图片/音频等）不调用 event.respondWith，
    // 浏览器将自行处理请求 —— 与原 sw 2.js 行为一致，保活与通知不受干扰。
});

// ===== 接收主线程消息 =====
self.addEventListener('message', function(event) {
    var data = event.data;
    if (!data) return;

    // 主线程通知新版本接管：立即 skipWaiting（配合 index 的 controllerchange 自动刷新）
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

// ===== 通知点击：聚焦窗口 =====
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

// ===== 通知关闭：清除角标 =====
self.addEventListener('notificationclose', function() {
    if (navigator.clearAppBadge) navigator.clearAppBadge().catch(function(){});
});

// ===== 定期同步（如果浏览器支持）=====
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
