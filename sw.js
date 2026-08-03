const CACHE = 'ban-tim-villa-v3';
const SHELL = ['/', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Never cache API calls, or data.json — dữ liệu villa phải luôn lấy bản mới nhất.
  if (url.includes('/api/') || url.includes('/data.json')) return;

  // Never intercept cross-origin requests (Google Sheet CSV, fonts, PapaParse CDN, etc).
  // Caching these was the bug: once fetched once, this service worker kept serving
  // the *first* version of the Google Sheet forever, so edits never showed up.
  if (!url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return response;
        }).catch(() => cached)
      );
    })
  );
});
