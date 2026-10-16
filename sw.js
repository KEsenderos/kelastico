// KElástico  sw.js  版 0.2.4  基づく仕様書：KElastico_仕様書_v0.2.4.md
// 役割：オフライン用のキャッシュ（仕様書 第10-3節）

const CACHE_VERSION = 'kelastico-v0.2.4';
const ASSETS = ['./', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/config.js', 'js/util.js', 'js/store.js', 'js/engine.js', 'js/media.js',
  'js/library.js', 'js/player.js', 'js/ui.js', 'js/app.js', 'js/worklet/kel-processor.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('kelastico-') && k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req))
  );
});
