const CACHE_NAME = 'sentence-app-v7';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/base.css',
  './css/vocab.css',
  './css/study.css',
  './css/calendar.css',
  './css/trash.css',
  './js/state.js',
  './js/shell.js',
  './js/vocab.js',
  './js/study.js',
  './js/add.js',
  './js/trash.js',
  './js/calendar.js',
  './js/settings.js',
  './js/init.js'
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
