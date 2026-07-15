/* Service worker — permet l'installation et l'usage HORS-LIGNE (terrain, mine).
   Précache la coquille de l'app ; met en cache les images/PDF au fil de la consultation. */
/* Nom du cache aligné sur APP_VERSION (app.js) — à incrémenter à chaque changement.
   Le changement de nom force le rafraîchissement de la coquille mise en cache. */
const CACHE = 'rodbot-formation-v1.6.1';
const CORE = [
  './', './index.html', './app.js', './styles.css',
  './manifest.webmanifest', './icon-192.png', './icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // laisse le réseau gérer les polices CDN

  if (req.mode === 'navigate') {
    // Réseau d'abord, repli sur la coquille en cache si hors-ligne
    e.respondWith(
      fetch(req).then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put('./index.html', cp)); return r; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Cache d'abord pour les assets (images du manuel, PDF, etc.), sinon réseau + mise en cache
  e.respondWith(
    caches.match(req).then((cached) =>
      cached || fetch(req).then((r) => {
        if (r && r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); }
        return r;
      }).catch(() => cached)
    )
  );
});
