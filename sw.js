/* Service worker : permet l'installation et l'usage HORS-LIGNE (terrain, mine).
   Précache la coquille de l'app ; met en cache les images/PDF au fil de la consultation. */
/* Nom du cache aligné sur APP_VERSION (app.js) : à incrémenter à chaque changement.
   Le changement de nom force le rafraîchissement de la coquille mise en cache. */
const CACHE = 'rodbot-formation-v1.42.0';
const CACHE_PREFIX = 'rodbot-formation-';
const APP_ROOT = new URL('./', self.location.href);
const CORE = [
  './', './index.html', './app.js', './styles.css', './interface.css', './interface.js',
  './manifest.webmanifest', './icon-192.png', './icon-512.png',
  './img/hero-machine-photo.webp?v=1.8.11'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Une panne de stockage ne doit pas transformer une réponse réseau en erreur.
async function remember(key, response) {
  if (response && response.ok && response.status !== 206) {
    try { await (await caches.open(CACHE)).put(key, response.clone()); } catch (error) {}
  }
  return response;
}

async function offlineResponse(key, isHome) {
  try {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(key);
    if (cached) return cached;
    if (isHome) {
      const root = await cache.match(APP_ROOT.href);
      if (root) return root;
    }
  } catch (error) {}
  // Ne jamais fournir du HTML à la place d'un script, style ou fichier absent.
  return Response.error();
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(APP_ROOT.pathname)) return;

  // La COQUILLE DE CODE (page, JS, CSS, manifeste) doit toujours rester synchronisée :
  // réseau d'abord. Sinon un ancien app.js en cache casse la nouvelle page (écran blanc).
  const isShell = req.mode === 'navigate' || /\.(?:js|css|webmanifest)$/.test(url.pathname);
  if (isShell) {
    // Seul l'accueil utilise index.html. Les sous-pages gardent leur propre URL.
    const estAccueil = req.mode === 'navigate' &&
      (url.pathname === APP_ROOT.pathname || url.pathname === APP_ROOT.pathname + 'index.html');
    let key = req;
    if (estAccueil) key = new URL('index.html', APP_ROOT).href;
    else if (req.mode !== 'navigate') {
      // app.js?v=... retrouve app.js précaché, uniquement dans cette version.
      url.search = '';
      url.hash = '';
      key = url.href;
    }
    e.respondWith(
      fetch(req).then((r) => remember(key, r)).catch(() => offlineResponse(key, estAccueil))
    );
    return;
  }

  // Images du manuel, PDF, polices : cache d'abord (lourds et immuables), sinon réseau + mise en cache
  e.respondWith(
    (async () => {
      let cached;
      try { cached = await (await caches.open(CACHE)).match(req); } catch (error) {}
      if (cached) return cached;
      try { return await remember(req, await fetch(req)); }
      catch (error) { return Response.error(); }
    })()
  );
});
