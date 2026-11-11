// assets/sw.js —— 信息河 PWA Service Worker (Stale-While-Revalidate 离线缓存引擎)
const CACHE_NAME = "infostream-pwa-v1";

// 预缓存核心静态资产
const PRECACHE_ASSETS = [
  "/",
  "/favicon.svg",
  "/manifest.webmanifest",
  "/assets/styles.css",
  "/assets/app.js",
  "/assets/bookmark.js"
];

// 安装阶段：预缓存核心静态外壳
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// 激活阶段：清理旧缓存并接管当前客户端
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// 抓取策略：
// 1. 静态资源（CSS, JS, SVG, Fonts）：Cache-First / Stale-While-Revalidate
// 2. HTML 页面导航：Network-First（优先获取最新服务端 SSR），失败时回退到缓存的离线首屏
// 3. API 请求（/api/*）：Network-Only（不缓存动态 API，保持实时性）
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 忽略非 GET 请求或跨域请求（如 Google Analytics, AdSense）
  if (req.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // API 请求保持网络优先且不污染本地离线缓存
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // 静态静态资产：Stale-While-Revalidate 策略
  if (
    url.pathname.startsWith("/assets/") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".webmanifest")
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req).then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return networkRes;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // HTML 导航请求：Network-First 策略（优先保证最新 SSR 内容），断网时回退 Cache
  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(req).then((networkRes) => {
        if (networkRes && networkRes.status === 200) {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        }
        return networkRes;
      }).catch(() => {
        return caches.match(req).then((cached) => {
          if (cached) return cached;
          // 若特定页面未缓存，尝试回退到已缓存的主站首页
          return caches.match("/");
        });
      })
    );
  }
});

