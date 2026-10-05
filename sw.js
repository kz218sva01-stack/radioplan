// РадиоПлан КЗ — оффлайн-кэш. Программа и библиотека карты хранятся на телефоне,
// просмотренные участки карты, рельефа и зданий тоже кэшируются (до ~3000 файлов).
const APP = 'radioplan-app-v19';
const TILES = 'radioplan-tiles-v1';
const MAX_TILES = 3000;
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png',
  'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js', 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('radioplan-app-') && k !== APP).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
async function trim() {
  const c = await caches.open(TILES); const ks = await c.keys();
  for (let i = 0; i < ks.length - MAX_TILES; i++) await c.delete(ks[i]);
}
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url);
  // сама программа: сначала сеть (чтобы приходили обновления), без сети — из кэша
  if (u.origin === location.origin) {
    e.respondWith(fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(APP).then(c => c.put(r, cp)); } return res; })
      .catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || caches.match('./index.html'))));
    return;
  }
  // библиотека карты — из кэша
  if (/maplibre-gl@/.test(u.href)) {
    e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => { const cp = res.clone(); caches.open(APP).then(c => c.put(r, cp)); return res; })));
    return;
  }
  // карта, рельеф, здания, шрифты: сеть, при неудаче — кэш
  if (/openfreemap|amazonaws|arcgisonline|elevation-tiles|fonts|sprites/.test(u.href)) {
    e.respondWith(fetch(r).then(res => {
      if (res.ok || res.type === 'opaque') { const cp = res.clone(); caches.open(TILES).then(c => c.put(r, cp)).then(() => Math.random() < 0.05 && trim()); }
      return res;
    }).catch(() => caches.match(r).then(m => m || Response.error())));
  }
});
