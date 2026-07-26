// ================================================================
// 迁逸 · 双屏 Service Worker
// 功能：离线缓存 + 后台保活唤醒 + 消息通知
// v2: 修复缓存不更新问题 —— 导航请求改为网络优先
// ================================================================

const CACHE_NAME = 'qianyi-v2';
const APP_SHELL = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

// ===== 安装：预缓存应用骨架 =====
self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            // 静默缓存，失败的资源不阻塞安装
            return cache.addAll(APP_SHELL).catch(function(e) {
                console.warn('[SW] 部分资源预缓存失败:', e);
            });
        })
    );
    // 立即激活，不等待旧SW退出
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
            // 立即控制所有客户端
            return self.clients.claim();
        })
    );
});

// ===== 缓存策略 =====
// 导航请求(HTML页面)：网络优先，确保总是拿到最新页面；网络失败才回退缓存
// 其他资源(GET)：缓存优先，网络兜底（stale-while-revalidate）
self.addEventListener('fetch', function(event) {
    // 只处理GET请求
    if (event.request.method !== 'GET') return;
    // 跳过chrome-extension和blob/data URI
    const url = new URL(event.request.url);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

    // 导航请求：网络优先
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).then(function(response) {
                // 成功的响应才缓存
                if (response && response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(function(cache) {
                        cache.put(event.request, clone).catch(function(){});
                        // 同步更新 ./ 和 ./index.html 的缓存
                        cache.put('./index.html', clone.clone()).catch(function(){});
                    });
                }
                return response;
            }).catch(function() {
                // 网络失败，回退到缓存的 index.html
                return caches.match(event.request).then(function(cached) {
                    return cached || caches.match('./index.html');
                });
            })
        );
        return;
    }

    // 其他资源：缓存优先，网络兜底
    event.respondWith(
        caches.match(event.request).then(function(cached) {
            if (cached) {
                // 后台静默更新缓存（stale-while-revalidate）
                fetch(event.request).then(function(response) {
                    if (response && response.status === 200 && response.type === 'basic') {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(function(cache) {
                            cache.put(event.request, clone).catch(function(){});
                        });
                    }
                }).catch(function(){});
                return cached;
            }
            return fetch(event.request).then(function(response) {
                // 成功的响应才缓存
                if (response && response.status === 200 && response.type === 'basic') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(function(cache) {
                        cache.put(event.request, clone).catch(function(){});
                    });
                }
                return response;
            }).catch(function() {
                // 网络失败且无缓存时，对导航请求返回缓存的index.html
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});

// ===== 后台消息通知 =====
// 当页面通过 postMessage 发送通知请求时，SW 显示系统通知
self.addEventListener('message', function(event) {
    const data = event.data;
    if (!data) return;

    // 显示系统通知
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

    // 保活心跳：页面定期发送ALIVE消息，SW记录最后活动时间
    if (data.type === 'ALIVE') {
        self._lastAlive = Date.now();
    }

    // 客户端请求回复（用于消息点击后通知页面打开聊天）
    if (data.type === 'CLIENTS_MATCH') {
        event.waitUntil(
            self.clients.matchAll({ type: 'window' }).then(function(clientList) {
                event.source.postMessage({ type: 'CLIENTS_LIST', count: clientList.length });
            })
        );
    }

    // 手动触发立即更新
    if (data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// ===== 通知点击：聚焦或打开应用 =====
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
            // 如果已有打开的窗口，聚焦它
            for (var i = 0; i < clientList.length; i++) {
                var client = clientList[i];
                if ('focus' in client) {
                    client.postMessage({ type: 'NOTIF_CLICK', tag: event.notification.tag });
                    return client.focus();
                }
            }
            // 否则打开新窗口
            if (self.clients.openWindow) {
                return self.clients.openWindow('./index.html');
            }
        })
    );
});

// ===== Periodic Background Sync（实验性，需要浏览器支持） =====
// 部分Chrome/Edge支持，可在后台定时唤醒
self.addEventListener('periodicsync', function(event) {
    if (event.tag === 'qianyi-periodic') {
        event.waitUntil(
            self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
                // 唤醒所有客户端，让它们检查是否有需要补发的消息
                clientList.forEach(function(client) {
                    client.postMessage({ type: 'WAKE_UP' });
                });
            })
        );
    }
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
        // 非JSON的纯文本推送
        event.waitUntil(
            self.registration.showNotification('迁逸 · 双屏', {
                body: event.data.text(),
                icon: './icon-192.png',
                tag: 'qianyi-push'
            })
        );
    }
});
