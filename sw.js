// Офлайн-режим: расчёт работает без интернета (карта и поиск — только онлайн).
const CACHE = 'namaz-v2';
const FILES = ['./', 'index.html', 'app.js', 'PrayTimes.js', 'lib/tz.js', 'lib/leaflet/leaflet.js', 'lib/leaflet/leaflet.css',
  'lib/leaflet/images/marker-icon.png', 'lib/leaflet/images/marker-icon-2x.png', 'lib/leaflet/images/marker-shadow.png',
  'manifest.webmanifest', 'icon.svg', 'icon-180.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // сначала сеть (чтобы обновления доходили), без сети — из кэша
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone();
    caches.open(CACHE).then(c => c.put(e.request, copy));
    return r;
  }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
