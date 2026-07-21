/* Service worker : permet l'installation et l'usage HORS-LIGNE (terrain, mine).
   Précache la coquille de l'app ; met en cache les images/PDF au fil de la consultation. */
/* Nom du cache aligné sur APP_VERSION (app.js) : à incrémenter à chaque changement.
   Le changement de nom force le rafraîchissement de la coquille mise en cache. */
const CACHE = 'rodbot-formation-v1.28.0';
const CORE = [
  './', './index.html', './app.js', './styles.css',
  './manifest.webmanifest', './icon-192.png', './icon-512.png',
  './img/hero-machine-photo.webp?v=1.8.11'
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

  // La COQUILLE DE CODE (page, JS, CSS, manifeste) doit toujours rester synchronisée :
  // réseau d'abord. Sinon un ancien app.js en cache casse la nouvelle page (écran blanc).
  const isShell = req.mode === 'navigate' || /\.(?:js|css|webmanifest)$/.test(url.pathname);
  if (isShell) {
    // la clé './index.html' est réservée à l'accueil : les navigations vers /3d/
    // sont mises en cache sous leur propre URL pour ne pas empoisonner la coquille
    const estAccueil = req.mode === 'navigate' && !url.pathname.includes('/3d');
    e.respondWith(
      fetch(req).then((r) => {
        const cp = r.clone();
        caches.open(CACHE).then((c) => c.put(estAccueil ? './index.html' : req, cp));
        return r;
      }).catch(() => caches.match(req).then((c) => c || caches.match('./index.html')))
    );
    return;
  }

  // Images du manuel, PDF, polices : cache d'abord (lourds et immuables), sinon réseau + mise en cache
  e.respondWith(
    caches.match(req).then((cached) =>
      cached || fetch(req).then((r) => {
        if (r && r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); }
        return r;
      }).catch(() => cached)
    )
  );
});
