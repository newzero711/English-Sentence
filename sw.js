const CACHE_NAME = 'sentence-app-v9';
const ASSETS = [
  './',
  './index.html',
  './sources/manifest.json',
  './frontend/css/base.css',
  './frontend/css/vocab.css',
  './frontend/css/study.css',
  './frontend/css/calendar.css',
  './frontend/css/trash.css',
  './frontend/js/state.js',
  './frontend/js/shell.js',
  './frontend/js/vocab.js',
  './frontend/js/study.js',
  './frontend/js/add.js',
  './frontend/js/trash.js',
  './frontend/js/calendar.js',
  './frontend/js/settings.js',
  './frontend/js/init.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Google Apps Script API 호출은 항상 네트워크 우선 (캐싱하지 않음)
  if (url.hostname.includes('script.google.com')) {
    return;
  }

  if (event.request.method !== 'GET') return;

  // 앱 파일은 네트워크 우선 - 항상 최신 버전을 받고, 오프라인일 때만 캐시로 대체한다.
  // (캐시 우선이었던 이전 방식은 sw.js의 CACHE_NAME을 직접 올려야만 갱신됐다)
  event.respondWith(
    fetch(event.request).then((response) => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => caches.match(event.request))
  );
});
