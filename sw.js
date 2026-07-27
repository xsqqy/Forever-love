// ================================================================
// 迁逸 · 双屏 Service Worker
// 功能：离线缓存（仅静态资源） + 消息通知
// ================================================================

const CACHE_NAME = 'qianyi-v2';
const APP_SHELL = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

// 只缓存同源静态资源（扩展名白名单）
const STATIC_EXT = ['html', 'css', 'js', 'json', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'woff2', 'woff', 'ttf', 'eot', 'mp3', 'mp4', 'webm'];

function isStaticResource(url) {
    const pathname = url.pathname;
    // 跳过带查询参数的动态请求
    if (url.search && url.search.length > 0) return false;
    const ext = pathname.split('.').pop().toLowerCase();
    return STATIC_EXT.indexOf(ext) !== -1;
}

// ===== 安装：预缓存应用骨架 =====
self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(APP_SHELL).catch(function(e) {
                console.warn('[SW] 部分资源预缓存失败:', e);
            });
        })
    );
    self.skipWaiting();
});

// ===== 激活：清理旧缓存 =====
self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(names) {
            return Promise.all(
                names.filter(function(n) { return n !== CACHE_NAME; })
                     .map(function(n) { return caches.delete(n); })
            );
        }).then(function() {
            return self.clients.claim();
        })
    );
});

// ===== 离线回退：仅缓存静态资源，动态请求直接走网络 =====
self.addEventListener('fetch', function(event) {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

    // 静态资源：缓存优先
    if (isStaticResource(url)) {
        event.respondWith(
            caches.match(event.request).then(function(cached) {
                if (cached) return cached;
                return fetch(event.request).then(function(response) {
                    if (response && response.status === 200 && response.type === 'basic') {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(function(cache) {
                            cache.put(event.request, clone).catch(function(){});
                        });
                    }
                    return response;
                }).catch(function() {
                    if (event.request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                });
            })
        );
    }
    // 动态请求（API等）：直接走网络，不缓存，不阻塞
});

// ===== 后台消息通知 =====
self.addEventListener('message', function(event) {
    const data = event.data;
    if (!data) return;

    if (data.type === 'NOTIFY') {
        const title = data.title || '迁逸 · 双屏';
        const options = {
            body: data.body || '',
            icon: './icon-192.png',
            badge: './icon-192.png',
            tag: data.tag || 'qianyi-msg',
            renotify: true,
            data: { url: './index.html' }
        };
        event.waitUntil(
            self.registration.showNotification(title, options)
        );
    }

    if (data.type === 'CLIENTS_MATCH') {
        event.waitUntil(
            self.clients.matchAll({ type: 'window' }).then(function(clientList) {
                event.source.postMessage({ type: 'CLIENTS_LIST', count: clientList.length });
            })
        );
    }
});

// ===== 通知点击：聚焦或打开应用 =====
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
            for (var i = 0; i < clientList.length; i++) {
                var client = clientList[i];
                if ('focus' in client) {
                    client.postMessage({ type: 'NOTIF_CLICK', tag: event.notification.tag });
                    return client.focus();
                }
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow('./index.html');
            }
        })
    );
});

// ===== Push 推送（预留，需要配合推送服务器） =====
self.addEventListener('push', function(event) {
    if (!event.data) return;
    try {
        const payload = event.data.json();
        const title = payload.title || '迁逸 · 双屏';
        const options = {
            body: payload.body || '',
            icon: './icon-192.png',
            badge: './icon-192.png',
            tag: payload.tag || 'qianyi-push',
            data: { url: './index.html' }
        };
        event.waitUntil(self.registration.showNotification(title, options));
    } catch(e) {
        event.waitUntil(
            self.registration.showNotification('迁逸 · 双屏', {
                body: event.data.text(),
                icon: './icon-192.png',
                tag: 'qianyi-push'
            })
        );
    }
});
