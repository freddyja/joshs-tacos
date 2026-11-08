/* Josh's Tacos service worker. Bump VERSION (npm run bump -- x.y.z) on every deploy. */
const VERSION = '1.1.0';
const CACHE_PREFIX = 'jt-';
const CACHE = `${CACHE_PREFIX}v${VERSION}`;

// Relative to the worker's location, so this works under /joshs-tacos/.
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './menu.json',
  './i18n/en.json',
  './i18n/es.json',
  './js/app.js',
  './js/cart.js',
  './js/i18n.js',
  './js/install.js',
  './js/order.js',
  './js/share.js',
  './js/updater.js',
  './js/version.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './img/tacos.jpg',
];

self.addEventListener('install', (event) => {
  // Do NOT skipWaiting here: the page saves the cart first, then asks us to.
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' })))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      // Only ever delete our own (jt-) caches.
      await Promise.all(
        keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (data.type === 'GET_VERSION') {
    const port = event.ports && event.ports[0];
    if (port) port.postMessage({ version: VERSION, cache: CACHE });
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // App shell: serve the cached index for this version; fall back to network.
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match('./index.html');
        if (cached) return cached;
        return fetch(req);
      })
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      return cached || fetch(req);
    })
  );
});
