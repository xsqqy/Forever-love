// Service Worker v2 - 后台保活 / 消息通知 / 自动更新
// 核心：network-first 策略确保网站更新后重新进入即可自动获取最新版本
const CACHE_NAME = 'qianyi-cache-v2';
const SILENT_AUDIO = './silent.mp3';

// 安装时缓存静音音频，并跳过等待立即接管
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

// ===== fetch 拦截：network-first 确保始终获取最新页面 =====
// 导航请求（HTML 页面）优先走网络，拿到最新版本；离线时回退缓存
// 其他资源（图片/CSS/JS）走 stale-while-revalidate，兼顾速度与更新
self.addEventListener('fetch', function(event) {
    var request = event.request;

    // 仅处理 GET 请求
    if (request.method !== 'GET') return;

    // 导航请求（页面加载）→ network-first
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

    // 静音音频等静态资源 → cache-first（离线也能保活）
    if (request.url.indexOf(SILENT_AUDIO) !== -1) {
        event.respondWith(
            caches.match(request).then(function(cached) {
                return cached || fetch(request).then(function(resp) {
                    if (resp && resp.status === 200) {
                        var clone = resp.clone();
                        caches.open(CACHE_NAME).then(function(cache) {
                            cache.put(request, clone).catch(function(){});
                        });
                    }
                    return resp;
                }).catch(function(){ return cached; });
            })
        );
        return;
    }

    // 其余资源 → stale-while-revalidate（先用缓存，后台更新）
    event.respondWith(
        caches.match(request).then(function(cached) {
            var fetchPromise = fetch(request).then(function(networkResponse) {
                if (networkResponse && networkResponse.status === 200) {
                    var clone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(function(cache) {
                        cache.put(request, clone).catch(function(){});
                    });
                }
                return networkResponse;
            }).catch(function() { return cached; });
            return cached || fetchPromise;
        })
    );
});

// ===== 接收主线程消息 =====
self.addEventListener('message', function(event) {
    var data = event.data;
    if (!data) return;

    // 主线程通知新版本接管：立即 skipWaiting
    if (data.type === 'SKIP_WAITING') {
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
