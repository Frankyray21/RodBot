/* Service worker : permet l'installation et l'usage HORS-LIGNE (terrain, mine).
   Précache la coquille de l'app PUIS télécharge automatiquement TOUT le contenu
   (images du manuel FR/EN, PDF, page 3D, modèles, vidéos, polices) dès la
   première installation. Après ça, le site fonctionne entièrement sans réseau. */
/* Nom du cache de coquille aligné sur APP_VERSION (app.js) : à incrémenter à
   chaque changement. Le changement de nom force le rafraîchissement du code. */
const CACHE = 'rodbot-formation-v1.68.0';
/* Cache de CONTENU (images, PDF, vidéos, modèles 3D) : nom STABLE, il survit
   aux mises à jour du code. Les fichiers sont immuables : pas de re-téléchargement
   de ~150 Mo à chaque version. Incrémenter seulement si le contenu doit repartir à zéro. */
const ASSETS = 'rodbot-assets-v1';
const CACHE_PREFIX = 'rodbot-formation-';
const APP_ROOT = new URL('./', self.location.href);
const CORE = [
  './', './index.html', './app.js', './pdf.js', './styles.css', './interface.css', './interface.js',
  './manifest.webmanifest', './icon-192.png', './icon-512.png',
  './img/hero-machine-photo.webp?v=1.8.11',
  './3d/index.html', './3d/css/styles.css', './3d/css/viewer.css',
  './3d/js/viewer.js', './3d/js/motion.js', './3d/js/tour.js',
  './3d/js/hotspots.js', './3d/js/hero-embed.js'
];

/* Ressources CDN nécessaires hors-ligne : feuilles de polices + moteur 3D.
   Les fichiers de police (.woff2) eux-mêmes sont capturés au vol à la première
   visite par le gestionnaire fetch (leurs URL sont dans le CSS de Google). */
const CDN = [
  'https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700;800;900&display=swap',
  'https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700;800&family=Barlow+Condensed:wght@600;700;800&display=swap',
  'https://cdn.jsdelivr.net/npm/playcanvas@2.13.3/build/playcanvas.mjs'
];

/* Liste COMPLÈTE du contenu du site (générée depuis l'arborescence du dépôt).
   Tout est téléchargé en arrière-plan à l'installation, par petits lots,
   avec reprise automatique (voir precacherTout). */
const PRECACHE = [
  './3d/assets/manuel/p12.jpg', './3d/assets/manuel/p13.jpg', './3d/assets/manuel/p14.jpg', './3d/assets/manuel/p21.jpg', './3d/assets/manuel/p47.jpg', './3d/assets/manuel/p51.jpg',
  './3d/assets/manuel/p52.jpg', './3d/assets/manuel/p55.jpg', './3d/assets/manuel/p65.jpg', './3d/assets/photos/manette.jpg', './3d/assets/previews/hero_poster.jpg', './3d/assets/previews/og.jpg',
  './3d/assets/rodbot_hq.sog', './3d/assets/rodbot_mobile.sog', './3d/assets/textures/sol_gravier.jpg', './3d/assets/videos/hero_rodbot.mp4', './3d/assets/videos/hero_rodbot.webm', './evaluation-risques.pdf',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png', './img/directions-manettes.webp', './img/eq-hmi.png', './img/eq-labeled.png',
  './img/eq-machine-real.png', './img/eq-machine.png', './img/eq-panel.png', './img/eq-track.png', './img/eq-transport.png', './img/fig-en/p07.jpg',
  './img/fig-en/p10.jpg', './img/fig-en/p11.jpg', './img/fig-en/p13.jpg', './img/fig-en/p14.jpg', './img/fig-en/p15.jpg', './img/fig-en/p16.jpg',
  './img/fig-en/p17.jpg', './img/fig-en/p18.jpg', './img/fig-en/p19.jpg', './img/fig-en/p21.jpg', './img/fig-en/p22.jpg', './img/fig-en/p23.jpg',
  './img/fig-en/p24.jpg', './img/fig-en/p25.jpg', './img/fig-en/p27.jpg', './img/fig-en/p28.jpg', './img/fig-en/p29.jpg', './img/fig-en/p31.jpg',
  './img/fig-en/p32.jpg', './img/fig-en/p33.jpg', './img/fig-en/p34.jpg', './img/fig-en/p35.jpg', './img/fig-en/p36.jpg', './img/fig-en/p39.jpg',
  './img/fig-en/p41.jpg', './img/fig-en/p44.jpg', './img/fig-en/p45.jpg', './img/fig-en/p46.jpg', './img/fig-en/p47.jpg', './img/fig-en/p48.jpg',
  './img/fig-en/p49.jpg', './img/fig-en/p50.jpg', './img/fig-en/p51.jpg', './img/fig-en/p52.jpg', './img/fig-en/p53.jpg', './img/fig-en/p54.jpg',
  './img/fig-en/p55.jpg', './img/fig-en/p56.jpg', './img/fig-en/p57.jpg', './img/fig-en/p59.jpg', './img/fig-en/p61.jpg', './img/fig-en/p62.jpg',
  './img/fig-en/p63.jpg', './img/fig-en/p64.jpg', './img/fig-en/p65.jpg', './img/fig-en/p73.jpg', './img/fig-en/p74.jpg', './img/fig-en/p75.jpg',
  './img/fig-en/p76.jpg', './img/fig-en/p77.jpg', './img/fig-en/p78.jpg', './img/fig-en/p81.jpg', './img/fig-en/p86.jpg', './img/fig/p01.jpg',
  './img/fig/p02.jpg', './img/fig/p03.jpg', './img/fig/p04.jpg', './img/fig/p05.jpg', './img/fig/p06.jpg', './img/fig/p07.jpg',
  './img/fig/p08.jpg', './img/fig/p09.jpg', './img/fig/p10.jpg', './img/fig/p11.jpg', './img/fig/p12.jpg', './img/fig/p13.jpg',
  './img/fig/p14.jpg', './img/fig/p15.jpg', './img/fig/p16.jpg', './img/fig/p17.jpg', './img/fig/p18.jpg', './img/fig/p19.jpg',
  './img/fig/p20.jpg', './img/fig/p21.jpg', './img/fig/p22.jpg', './img/fig/p23.jpg', './img/fig/p24.jpg', './img/fig/p25.jpg',
  './img/fig/p26.jpg', './img/fig/p27.jpg', './img/fig/p28.jpg', './img/fig/p29.jpg', './img/fig/p30.jpg', './img/fig/p31.jpg',
  './img/fig/p32.jpg', './img/fig/p33.jpg', './img/fig/p34.jpg', './img/fig/p35.jpg', './img/fig/p36.jpg', './img/fig/p37.jpg',
  './img/fig/p38.jpg', './img/fig/p39.jpg', './img/fig/p40.jpg', './img/fig/p41.jpg', './img/fig/p42.jpg', './img/fig/p43.jpg',
  './img/fig/p44.jpg', './img/fig/p45.jpg', './img/fig/p46.jpg', './img/fig/p47.jpg', './img/fig/p48.jpg', './img/fig/p49.jpg',
  './img/fig/p50.jpg', './img/fig/p51.jpg', './img/fig/p52.jpg', './img/fig/p53.jpg', './img/fig/p54.jpg', './img/fig/p55.jpg',
  './img/fig/p56.jpg', './img/fig/p57.jpg', './img/fig/p58.jpg', './img/fig/p59.jpg', './img/fig/p60.jpg', './img/fig/p61.jpg',
  './img/fig/p62.jpg', './img/fig/p63.jpg', './img/fig/p64.jpg', './img/fig/p65.jpg', './img/fig/p66.jpg', './img/fig/p67.jpg',
  './img/fig/p68.jpg', './img/fig/p69.jpg', './img/fig/p70.jpg', './img/fig/p71.jpg', './img/fig/p72.jpg', './img/fig/p73.jpg',
  './img/fig/p74.jpg', './img/fig/p75.jpg', './img/fig/p76.jpg', './img/fig/p77.jpg', './img/fig/p78.jpg', './img/fig/p79.jpg',
  './img/fig/p80.jpg', './img/fig/p81.jpg', './img/fig/p82.jpg', './img/fig/p83.jpg', './img/fig/p84.jpg', './img/fig/p85.jpg',
  './img/fig/p86.jpg', './img/fig/p87.jpg', './img/gyrophare.webp', './img/hero-machine-photo.webp', './img/hero-machine.png', './img/manual-en/p01.jpg',
  './img/manual-en/p02.jpg', './img/manual-en/p03.jpg', './img/manual-en/p04.jpg', './img/manual-en/p05.jpg', './img/manual-en/p06.jpg', './img/manual-en/p07.jpg',
  './img/manual-en/p08.jpg', './img/manual-en/p09.jpg', './img/manual-en/p10.jpg', './img/manual-en/p11.jpg', './img/manual-en/p12.jpg', './img/manual-en/p13.jpg',
  './img/manual-en/p14.jpg', './img/manual-en/p15.jpg', './img/manual-en/p16.jpg', './img/manual-en/p17.jpg', './img/manual-en/p18.jpg', './img/manual-en/p19.jpg',
  './img/manual-en/p20.jpg', './img/manual-en/p21.jpg', './img/manual-en/p22.jpg', './img/manual-en/p23.jpg', './img/manual-en/p24.jpg', './img/manual-en/p25.jpg',
  './img/manual-en/p26.jpg', './img/manual-en/p27.jpg', './img/manual-en/p28.jpg', './img/manual-en/p29.jpg', './img/manual-en/p30.jpg', './img/manual-en/p31.jpg',
  './img/manual-en/p32.jpg', './img/manual-en/p33.jpg', './img/manual-en/p34.jpg', './img/manual-en/p35.jpg', './img/manual-en/p36.jpg', './img/manual-en/p37.jpg',
  './img/manual-en/p38.jpg', './img/manual-en/p39.jpg', './img/manual-en/p40.jpg', './img/manual-en/p41.jpg', './img/manual-en/p42.jpg', './img/manual-en/p43.jpg',
  './img/manual-en/p44.jpg', './img/manual-en/p45.jpg', './img/manual-en/p46.jpg', './img/manual-en/p47.jpg', './img/manual-en/p48.jpg', './img/manual-en/p49.jpg',
  './img/manual-en/p50.jpg', './img/manual-en/p51.jpg', './img/manual-en/p52.jpg', './img/manual-en/p53.jpg', './img/manual-en/p54.jpg', './img/manual-en/p55.jpg',
  './img/manual-en/p56.jpg', './img/manual-en/p57.jpg', './img/manual-en/p58.jpg', './img/manual-en/p59.jpg', './img/manual-en/p60.jpg', './img/manual-en/p61.jpg',
  './img/manual-en/p62.jpg', './img/manual-en/p63.jpg', './img/manual-en/p64.jpg', './img/manual-en/p65.jpg', './img/manual-en/p66.jpg', './img/manual-en/p67.jpg',
  './img/manual-en/p68.jpg', './img/manual-en/p69.jpg', './img/manual-en/p70.jpg', './img/manual-en/p71.jpg', './img/manual-en/p72.jpg', './img/manual-en/p73.jpg',
  './img/manual-en/p74.jpg', './img/manual-en/p75.jpg', './img/manual-en/p76.jpg', './img/manual-en/p77.jpg', './img/manual-en/p78.jpg', './img/manual-en/p79.jpg',
  './img/manual-en/p80.jpg', './img/manual-en/p81.jpg', './img/manual-en/p82.jpg', './img/manual/p01.jpg', './img/manual/p02.jpg', './img/manual/p03.jpg',
  './img/manual/p04.jpg', './img/manual/p05.jpg', './img/manual/p06.jpg', './img/manual/p07.jpg', './img/manual/p08.jpg', './img/manual/p09.jpg',
  './img/manual/p10.jpg', './img/manual/p11.jpg', './img/manual/p12.jpg', './img/manual/p13.jpg', './img/manual/p14.jpg', './img/manual/p15.jpg',
  './img/manual/p16.jpg', './img/manual/p17.jpg', './img/manual/p18.jpg', './img/manual/p19.jpg', './img/manual/p20.jpg', './img/manual/p21.jpg',
  './img/manual/p22.jpg', './img/manual/p23.jpg', './img/manual/p24.jpg', './img/manual/p25.jpg', './img/manual/p26.jpg', './img/manual/p27.jpg',
  './img/manual/p28.jpg', './img/manual/p29.jpg', './img/manual/p30.jpg', './img/manual/p31.jpg', './img/manual/p32.jpg', './img/manual/p33.jpg',
  './img/manual/p34.jpg', './img/manual/p35.jpg', './img/manual/p36.jpg', './img/manual/p37.jpg', './img/manual/p38.jpg', './img/manual/p39.jpg',
  './img/manual/p40.jpg', './img/manual/p41.jpg', './img/manual/p42.jpg', './img/manual/p43.jpg', './img/manual/p44.jpg', './img/manual/p45.jpg',
  './img/manual/p46.jpg', './img/manual/p47.jpg', './img/manual/p48.jpg', './img/manual/p49.jpg', './img/manual/p50.jpg', './img/manual/p51.jpg',
  './img/manual/p52.jpg', './img/manual/p53.jpg', './img/manual/p54.jpg', './img/manual/p55.jpg', './img/manual/p56.jpg', './img/manual/p57.jpg',
  './img/manual/p58.jpg', './img/manual/p59.jpg', './img/manual/p60.jpg', './img/manual/p61.jpg', './img/manual/p62.jpg', './img/manual/p63.jpg',
  './img/manual/p64.jpg', './img/manual/p65.jpg', './img/manual/p66.jpg', './img/manual/p67.jpg', './img/manual/p68.jpg', './img/manual/p69.jpg',
  './img/manual/p70.jpg', './img/manual/p71.jpg', './img/manual/p72.jpg', './img/manual/p73.jpg', './img/manual/p74.jpg', './img/manual/p75.jpg',
  './img/manual/p76.jpg', './img/manual/p77.jpg', './img/manual/p78.jpg', './img/manual/p79.jpg', './img/manual/p80.jpg', './img/manual/p81.jpg',
  './img/manual/p82.jpg', './img/manual/p83.jpg', './img/manual/p84.jpg', './img/manual/p85.jpg', './img/manual/p86.jpg', './img/manual/p87.jpg',
  './img/mat-annote.png', './img/p13-0.png', './img/p21-0.png', './img/portee.webp', './img/ra/p1.jpg', './img/ra/p2.jpg',
  './img/ra/p3.jpg', './img/ra/p4.jpg', './img/telecommande-annotee.png', './manual-en.pdf', './manuel-operateur.pdf', './qr-formation-rodbot.png',
  './qr-formation-rodbot.svg'
].concat(CDN);

/* Télécharge tout ce qui manque encore dans le cache de contenu.
   - par lots de 5 pour ne pas saturer la connexion ;
   - un échec sur un fichier n'arrête pas le reste (Promise.allSettled) ;
   - relancé à chaque ouverture de page et au retour du réseau (message PRECACHE),
     donc un téléchargement interrompu reprend là où il était rendu. */
let precacheEnCours = null;
function precacherTout() {
  if (precacheEnCours) return precacheEnCours;
  precacheEnCours = (async () => {
    const c = await caches.open(ASSETS);
    const manquants = [];
    for (const url of PRECACHE) {
      if (!(await c.match(url))) manquants.push(url);
    }
    if (!manquants.length) return;
    const LOT = 5;
    for (let i = 0; i < manquants.length; i += LOT) {
      await Promise.allSettled(manquants.slice(i, i + LOT).map(async (url) => {
        const r = await fetch(url);
        if (r && (r.ok || r.type === 'opaque')) await c.put(url, r);
      }));
    }
  })().catch(() => {}).finally(() => { precacheEnCours = null; });
  return precacheEnCours;
}

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    // Ne purger que les anciennes coquilles RodBot. Conserver le contenu stable
    // et tous les caches des autres sites hébergés sur la même origine.
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
  // Téléchargement complet du contenu dès la première installation
  e.waitUntil(precacherTout());
});

/* Les pages envoient PRECACHE à chaque chargement et au retour du réseau :
   permet de reprendre un téléchargement interrompu (connexion coupée, appli fermée). */
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'PRECACHE') {
    const p = precacherTout();
    if (e.waitUntil) e.waitUntil(p);
  }
});

/* Les vidéos demandent des morceaux (en-tête Range) : on découpe la réponse
   complète en cache en réponse partielle 206, sinon la lecture hors-ligne échoue. */
async function reponsePourRange(req, complete) {
  const range = req.headers.get('range');
  if (!range || complete.type === 'opaque') return complete;
  const m = /bytes=(\d+)-(\d*)/.exec(range);
  if (!m) return complete;
  const buf = await complete.arrayBuffer();
  const debut = Number(m[1]);
  const fin = m[2] ? Math.min(Number(m[2]), buf.byteLength - 1) : buf.byteLength - 1;
  if (debut >= buf.byteLength) return complete;
  return new Response(buf.slice(debut, fin + 1), {
    status: 206,
    headers: {
      'Content-Type': complete.headers.get('Content-Type') || '',
      'Content-Range': 'bytes ' + debut + '-' + fin + '/' + buf.byteLength,
      'Content-Length': String(fin - debut + 1)
    }
  });
}

// Une panne de stockage ne doit pas transformer une réponse réseau en erreur.
async function remember(key, response, cacheName = CACHE, allowOpaque = false) {
  if (response && (response.ok || (allowOpaque && response.type === 'opaque')) && response.status !== 206) {
    try { await (await caches.open(cacheName)).put(key, response.clone()); } catch (error) {}
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

async function assetResponse(req, allowOpaque = false) {
  let cached;
  try {
    const cache = await caches.open(ASSETS);
    cached = await cache.match(req);
    if (!cached && !allowOpaque) cached = await cache.match(req, { ignoreSearch: true });
    // Certains petits fichiers font également partie de la coquille précachée.
    if (!cached && !allowOpaque) {
      cached = await (await caches.open(CACHE)).match(req, { ignoreSearch: true });
    }
  } catch (error) {}
  if (cached) return reponsePourRange(req, cached);
  try { return await remember(req, await fetch(req), ASSETS, allowOpaque); }
  catch (error) { return Response.error(); }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Ressources CDN (polices, moteur 3D) : cache d'abord, sinon réseau + mise en cache
  if (url.origin !== self.location.origin) {
    // Le registre des employés et les autres API ne sont jamais mis en cache.
    const cdnOrigins = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com', 'https://cdn.jsdelivr.net'];
    if (!cdnOrigins.includes(url.origin)) return;
    e.respondWith(assetResponse(req, true));
    return;
  }
  if (!url.pathname.startsWith(APP_ROOT.pathname)) return;

  // La COQUILLE DE CODE (page, JS, CSS, manifeste) doit toujours rester synchronisée :
  // réseau d'abord. Sinon un ancien app.js en cache casse la nouvelle page (écran blanc).
  const isShell = req.mode === 'navigate' || /\.(?:js|css|webmanifest)$/.test(url.pathname);
  if (isShell) {
    // Seul l'accueil utilise index.html. Les sous-pages gardent leur propre URL.
    const estAccueil = req.mode === 'navigate' &&
      (url.pathname === APP_ROOT.pathname || url.pathname === APP_ROOT.pathname + 'index.html');
    const est3d = req.mode === 'navigate' &&
      (url.pathname === APP_ROOT.pathname + '3d/' || url.pathname === APP_ROOT.pathname + '3d/index.html');
    let key = req;
    if (estAccueil) key = new URL('index.html', APP_ROOT).href;
    else if (est3d) key = new URL('3d/index.html', APP_ROOT).href;
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

  // Contenu (images du manuel, PDF, vidéos, modèles 3D) : cache d'abord
  // (lourd et immuable), sinon réseau + mise en cache dans le cache stable
  e.respondWith(assetResponse(req));
});
