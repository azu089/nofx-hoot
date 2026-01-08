// QuantFi Service Worker
// 版本号用于缓存更新
const CACHE_VERSION = 'quantfi-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

// 需要缓存的静态资源（仅缓存确定存在的资源）
const STATIC_ASSETS = [
  '/manifest.json',
  '/offline.html',
];

// 安装事件：预缓存静态资源
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      console.log('[SW] Caching static assets');
      // 使用 addAll 的替代方案，忽略失败的请求
      const results = await Promise.allSettled(
        STATIC_ASSETS.map(async (url) => {
          try {
            const response = await fetch(url);
            if (response.ok) {
              await cache.put(url, response);
              return { url, success: true };
            }
            return { url, success: false, reason: 'not ok' };
          } catch (error) {
            console.log('[SW] Failed to cache:', url);
            return { url, success: false, reason: error.message };
          }
        })
      );
      console.log('[SW] Cache results:', results);
    })
  );
  // 跳过等待，立即激活
  self.skipWaiting();
});

// 激活事件：清理旧缓存
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map((key) => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    })
  );
  // 立即控制所有客户端
  self.clients.claim();
});

// 请求拦截策略
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳过非同源请求
  if (url.origin !== location.origin) {
    return;
  }

  // API 请求：网络优先，失败时返回缓存
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // 静态资源：缓存优先
  if (request.destination === 'image' ||
      request.destination === 'script' ||
      request.destination === 'style') {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 页面导航：网络优先
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // 其他请求：缓存优先
  event.respondWith(cacheFirst(request));
});

// 网络优先策略
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    // 缓存成功的 GET 请求
    if (request.method === 'GET' && networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    // 页面请求返回离线页面
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }
    throw error;
  }
}

// 缓存优先策略
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  try {
    const networkResponse = await fetch(request);
    if (request.method === 'GET' && networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Fetch failed:', request.url);
    throw error;
  }
}

// 推送通知
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');
  let data = {};

  if (event.data) {
    data = event.data.json();
  }

  const title = data.title || 'QuantFi 通知';
  const options = {
    body: data.body || '您有新的通知',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/dashboard',
    },
    actions: data.actions || [
      { action: 'open', title: '查看' },
      { action: 'close', title: '关闭' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 点击通知
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click');
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const url = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      // 如果已有窗口，聚焦并导航
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          client.navigate(url);
          return client.focus();
        }
      }
      // 否则打开新窗口
      return clients.openWindow(url);
    })
  );
});

// 后台同步
self.addEventListener('sync', (event) => {
  console.log('[SW] Sync event:', event.tag);

  if (event.tag === 'sync-trades') {
    event.waitUntil(syncTrades());
  }
});

async function syncTrades() {
  console.log('[SW] Syncing trades...');
  // 后台同步逻辑（待实现）
}
