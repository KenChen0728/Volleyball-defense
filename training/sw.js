/* 練球手冊：離線快取。先問網站有沒有新版（最多等 3 秒），連不上或回錯誤就用存好的版本。
   快取名稱用 vbtrain- 開頭，不會動到排球站位教室（vbdef-）的快取。 */
const PREFIX = 'vbtrain-';
const VERSION = '2026.11.25.1';
const CACHE = PREFIX + VERSION;
const ASSETS = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
function withTimeout(p, ms){ return new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout')), ms); p.then(r => { clearTimeout(t); res(r); }, e => { clearTimeout(t); rej(e); }); }); }
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await withTimeout(fetch(req, { cache: 'no-cache' }), 3000);
      if (res && res.ok){ cache.put(req, res.clone()); return res; }
      throw new Error('bad response');
    } catch (e) {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate'){ const home = await cache.match('index.html'); if (home) return home; }
      return Response.error();
    }
  })());
});
