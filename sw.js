/* 排球站位教室：離線快取。先問網站有沒有新版（最多等 3 秒），連不上或回錯誤就用存好的版本。 */
const PREFIX = 'vbdef-';
const VERSION = '2.5.0';
const CACHE = PREFIX + VERSION;
const ASSETS = [
  './', 'index.html', 'css/app.css', 'js/rotation.js', 'js/render3d.js', 'js/gl3d.js', 'js/diagrams.js', 'js/app.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png', 'icons/maskable-512.png',
  'help/screen-1.webp', 'help/screen-2.webp', 'help/screen-3.webp', 'help/rot-1.webp', 'help/rot-2.webp', 'help/rot-3.webp',
  'help/recv-1.webp', 'help/recv-2.webp', 'help/recv-3.webp',
  'help/learn-1.webp', 'help/learn-2.webp', 'help/learn-3.webp', 'help/learn-4.webp',
  'help/3d-1.webp', 'help/3d-2.webp', 'help/sit-1.webp', 'help/sit-2.webp',
  'help/free-1.webp', 'help/free-2.webp', 'help/free-3.webp',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => null)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function withTimeout(promise, ms){
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(r => { clearTimeout(t); resolve(r); }, e => { clearTimeout(t); reject(e); });
  });
}

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
