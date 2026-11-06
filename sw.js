// WISMIR service worker: lets Dashboard and POS open even when the internet is down.
// Pages are always fetched fresh when online (network first); the saved copy is only a fallback.
// Google Apps Script (Sheets sync) requests are never touched here.
const CACHE = 'wismir-v2';
const CORE = ['./', './index.html', './pos.html', './dashboard.html', './pos.webmanifest', './dashboard.webmanifest',
  './icons/pos-192.png', './icons/pos-512.png', './icons/dash-192.png', './icons/dash-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  const font = u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com';
  if (u.origin !== self.location.origin && !font) return;
  if (u.searchParams.has('pin')) return; // data requests (Google Sheets sync) are never cached
  e.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: u.origin === self.location.origin });
    // slow shop wifi: if a saved copy exists, do not wait more than 4 s for the network
    const net = fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
      return res;
    });
    if (!cached) return net;
    const timeout = new Promise(r => setTimeout(() => r(cached), 4000));
    return Promise.race([net.catch(() => cached), timeout]);
  })());
});
