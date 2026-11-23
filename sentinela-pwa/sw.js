// Service worker: app shell offline (stale-while-revalidate).
const V = 'sentinela-v1.0.0';
const SHELL = ['./', 'index.html', 'css/app.css', 'js/app.js', 'js/core.js', 'js/nlp.js', 'js/ai.js', 'js/summary.js', 'js/store.js', 'js/ui.js', 'manifest.webmanifest', 'icons/icon.svg'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request; if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(caches.open(V).then(async (c) => { const hit = await c.match(r, { ignoreSearch: true }); const net = fetch(r).then((res) => { if (res.ok) c.put(r, res.clone()); return res; }).catch(() => hit || c.match('index.html')); return hit || net; }));
});
