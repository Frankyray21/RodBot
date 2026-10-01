/* ===========================================================================
   scene3d.js  |  La machine qui tourne sur la page d'accueil.

   Reprend la replique articulee du dossier 3d/ et lui fait faire, tout seul,
   un tour complet : on fait le tour de la machine, la camera se rapproche,
   puis elle recule. Rien n'est demande au travailleur, mais il PEUT prendre
   la main : un doigt sur la machine la tourne, deux doigts la zooment. La
   visite s'arrete le temps qu'il la manipule, puis repart toute seule de
   l'angle ou il l'a laissee.

   Deux contraintes ont dicte le code.

   1. Le moteur de gabarits reconstruit TOUT le DOM a chaque rendu
      (fullRender vide ROOT). Un <model-viewer> pose dans le gabarit serait
      donc detruit et le modele recharge a chaque clic. La scene vit donc
      dans un noeud a elle, cree UNE fois, que l'on redepose dans son
      emplacement apres chaque rendu.

   2. Le modele pese 27 Mo et l'app sert des mineurs sous terre. Rien ne se
      telecharge tant que la scene n'est pas a l'ecran, et rien du tout si
      le telephone demande d'economiser les donnees ou si le reseau rampe :
      dans ce cas l'affiche fixe reste, avec un bouton pour charger.
   =========================================================================== */
(function (global) {
  'use strict';

  var MV = './3d/vendor/model-viewer-4.3.1.min.js';
  var GLB = './3d/assets/rodbot-v39-a122e150.glb';
  var HDR = './3d/assets/warehouse-v5.hdr';
  var DRACO = './3d/vendor/draco/';
  var AFFICHE = './3d/assets/rodbot-v39-poster.jpg';

  /* Un tour complet dure 30 s ; la camera respire sur 20 s, donc les deux
     mouvements ne retombent jamais en phase et la scene ne se repete pas. */
  var TOUR_S = 30;
  var RESPIRE_S = 20;
  /* Le doigt a la priorite : la visite repart seulement apres ce temps sans
     aucun geste, pour ne pas arracher la machine des mains du travailleur. */
  var REPRISE_MS = 6000;

  var hote = null, cadre = null, vue = null, affiche = null, btn = null, lien = null, etat = null, astuce = null;
  var pret = false, pause = false, visible = false, demande = false, casse = false;
  var raf = 0, t0 = 0, phase = 0, obs = null;
  var libre = false, derniereMain = 0, doigt = false;   // la main du travailleur

  function reduit() {
    try { return global.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }
  /* Reseau qui rampe ou economiseur de donnees : on ne telecharge rien. */
  function reseauMaigre() {
    try {
      var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (!c) return false;
      if (c.saveData) return true;
      return c.effectiveType === 'slow-2g' || c.effectiveType === '2g';
    } catch (e) { return false; }
  }
  function en() {
    try { return !!(global.COMP && global.COMP.state && global.COMP.state.lang === 'en'); } catch (e) { return false; }
  }
  function tr(fr, ang) { return en() ? ang : fr; }

  function libelles() {
    if (!btn) return;
    if (casse) { btn.hidden = true; return; }
    btn.hidden = false;
    if (!demande) btn.textContent = tr('Charger la machine en 3D', 'Load the machine in 3D');
    else if (!pret) btn.textContent = tr('Chargement…', 'Loading…');
    else btn.textContent = pause ? tr('Animer la machine', 'Animate the machine')
                                 : tr('Mettre en pause', 'Pause');
    btn.setAttribute('aria-pressed', String(!pause && pret));
    if (lien) {
      lien.textContent = tr('Explorer la machine en 3D ↗', 'Explore the machine in 3D ↗');
      lien.setAttribute('href', '3d/?lang=' + (en() ? 'en' : 'fr'));
    }
    if (etat) etat.textContent = pret ? '' : (demande ? tr('Chargement de la machine…', 'Loading the machine…') : '');
    if (astuce) {
      astuce.textContent = tr('🖐 Glissez pour tourner la machine.', '🖐 Drag to turn the machine.');
      astuce.hidden = !pret || libre;
    }
  }

  /* La choregraphie, en une seule fonction sans effet de bord pour qu'elle
     soit verifiable : au temps « phase » (en secondes), ou se trouve la
     camera ? On fait le tour de la machine en 30 s, et sur 20 s la camera se
     rapproche puis recule en montant et descendant un peu. Les deux durees
     ne sont pas multiples : la scene ne se repete jamais a l'identique. */
  function orbite(phase) {
    var tour = phase * Math.PI * 2 / TOUR_S;
    var respire = phase * Math.PI * 2 / RESPIRE_S;
    var theta = -180 + (phase % TOUR_S) / TOUR_S * 360;     // le tour complet
    var phi = 72 - 9 * Math.sin(tour);                      // un peu plus haut, un peu plus bas
    var dist = 96 - 26 * (0.5 - 0.5 * Math.cos(respire));   // de 96 % a 70 %
    return theta.toFixed(2) + 'deg ' + phi.toFixed(2) + 'deg ' + dist.toFixed(1) + '%';
  }
  /* L'inverse d'orbite() pour l'angle : a quel moment de la visite la camera
     se trouve-t-elle a cet angle ? Sert a repartir de la ou le doigt a laisse
     la machine, sans la faire sauter a l'autre bout du tour. */
  function phaseAngle(thetaDeg) {
    var t = ((thetaDeg + 180) % 360 + 360) % 360;
    return t / 360 * TOUR_S;
  }
  function angleCourant() {
    try { return vue.getCameraOrbit().theta * 180 / Math.PI; } catch (e) { return null; }
  }
  function pas(temps) {
    raf = 0;
    if (pause || !visible || !pret || document.hidden) { t0 = 0; return; }
    var dt = t0 ? Math.min(0.06, (temps - t0) / 1000) : 0;
    t0 = temps;
    if (libre) {
      // Le doigt tient la machine : on ne touche a rien, on attend.
      if (doigt || temps - derniereMain < REPRISE_MS) { raf = requestAnimationFrame(pas); return; }
      reprendre();
    }
    phase += dt;
    try { vue.cameraOrbit = orbite(phase); } catch (e) {}
    raf = requestAnimationFrame(pas);
  }

  /* La visite reprend a l'angle affiche. La hauteur et la distance reviennent
     toutes seules : model-viewer glisse vers la position demandee. */
  function reprendre() {
    libre = false;
    var angle = angleCourant();
    if (angle !== null) phase = phaseAngle(angle);
    if (astuce) astuce.hidden = true;
  }

  function maintenant() {
    return (global.performance && performance.now) ? performance.now() : Date.now();
  }
  /* Un geste sur la machine : la visite s'efface, le travailleur conduit. */
  function mainPrise() {
    derniereMain = maintenant();
    if (libre) return;
    libre = true;
    if (astuce) astuce.hidden = true;
    if (pause) { pause = false; }   // tourner la machine la reveille
    relance();
  }
  /* Le doigt se leve : le compte a rebours de la reprise part de maintenant.
     Tant qu'il appuie, la visite ne reprend pas, meme si l'appareil rame et
     que « camera-change » se fait attendre. */
  function mainLachee() {
    if (!doigt) return;
    doigt = false;
    derniereMain = maintenant();
  }

  function relance() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    t0 = 0;
    if (!pause && visible && pret && !document.hidden) raf = requestAnimationFrame(pas);
    libelles();
  }

  /* Le telechargement ne part qu'ici : scene a l'ecran et reseau correct. */
  function charger() {
    if (demande || casse) return;
    demande = true;
    libelles();
    import(MV).then(function (m) {
      try { m.ModelViewerElement.dracoDecoderLocation = DRACO; } catch (e) {}
      vue.environmentImage = HDR;
      vue.src = GLB;
    }).catch(function () { casse = true; pret = false; libelles(); });
  }

  function construire() {
    hote = document.createElement('div');
    hote.className = 'rb-scene3d-hote';
    cadre = document.createElement('div');
    cadre.className = 'rb-scene3d';
    hote.appendChild(cadre);

    affiche = document.createElement('img');
    affiche.className = 'rb-scene3d-affiche';
    affiche.src = AFFICHE;
    affiche.alt = tr('Réplique 3D du RodBot LP', '3D replica of the RodBot LP');
    affiche.width = 1280; affiche.height = 720;
    cadre.appendChild(affiche);

    vue = document.createElement('model-viewer');
    vue.className = 'rb-scene3d-vue';
    vue.setAttribute('alt', tr('Présentation animée de la réplique du RodBot',
                               'Animated presentation of the RodBot replica'));
    vue.setAttribute('camera-orbit', '-180deg 72deg 96%');
    vue.setAttribute('field-of-view', '30deg');
    vue.setAttribute('shadow-intensity', '1');
    vue.setAttribute('shadow-softness', '0.8');
    vue.setAttribute('exposure', '1');
    vue.setAttribute('tone-mapping', 'agx');
    vue.setAttribute('interaction-prompt', 'none');
    vue.setAttribute('loading', 'lazy');
    /* La machine se tourne au doigt. « pan-y » laisse le doigt vertical
       faire defiler la page : le heros est en haut d'une longue page. */
    vue.setAttribute('camera-controls', '');
    vue.setAttribute('touch-action', 'pan-y');
    vue.setAttribute('min-camera-orbit', 'auto 15deg 45%');
    vue.setAttribute('max-camera-orbit', 'auto 88deg 130%');
    vue.setAttribute('tabindex', '0');
    vue.appendChild(document.createElement('span')).setAttribute('slot', 'progress-bar');
    cadre.appendChild(vue);

    // Le bouton reste sur l'image, en bas a droite. Le lien vers la page 3D
    // passe SOUS le cadre : sur un telephone, les deux cote a cote se
    // marchaient dessus et masquaient la machine.
    var barre = document.createElement('div');
    barre.className = 'rb-scene3d-barre';
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rb-scene3d-btn';
    barre.appendChild(btn);
    cadre.appendChild(barre);

    var pied = document.createElement('div');
    pied.className = 'rb-scene3d-pied';
    etat = document.createElement('span');
    etat.className = 'rb-scene3d-etat';
    etat.setAttribute('role', 'status');
    astuce = document.createElement('span');
    astuce.className = 'rb-scene3d-astuce';
    astuce.hidden = true;
    lien = document.createElement('a');
    lien.className = 'rb-scene3d-lien';
    pied.appendChild(etat); pied.appendChild(astuce); pied.appendChild(lien);
    hote.appendChild(pied);

    vue.addEventListener('load', function () {
      pret = true;
      cadre.classList.add('est-charge');
      if (astuce && !libre) astuce.hidden = false;
      relance();
    });
    /* Seul un VRAI geste compte. La visite ecrit l'orbite a chaque image et
       declenche aussi cet evenement : sa source n'est pas « user-interaction ». */
    vue.addEventListener('camera-change', function (e) {
      if (e && e.detail && e.detail.source === 'user-interaction') mainPrise();
    });
    vue.addEventListener('pointerdown', function () { doigt = true; mainPrise(); });
    // Le doigt se releve souvent hors de la machine : on ecoute toute la page.
    document.addEventListener('pointerup', mainLachee);
    document.addEventListener('pointercancel', mainLachee);
    vue.addEventListener('error', function () { casse = true; pret = false; libelles(); });

    btn.addEventListener('click', function () {
      if (casse) return;
      if (!demande) { pause = false; charger(); return; }
      pause = !pause;
      // « Animer la machine » reprend la visite, meme apres un geste.
      if (!pause && libre) reprendre();
      relance();
    });

    // L'animation dort tant que la scene n'est pas a l'ecran.
    // Le navigateur peut grouper PLUSIEURS entrees dans un seul appel : la
    // scene est observee avant d'etre posee dans la page, donc la premiere
    // entree dit toujours « hors de l'ecran ». C'est la DERNIERE qui compte.
    try {
      obs = new IntersectionObserver(function (e) {
        visible = e[e.length - 1].isIntersecting;
        // Le mouvement peut etre en pause (reglage du systeme) sans empecher
        // d'afficher la machine : on charge quand meme, elle restera figee.
        if (visible && !demande && !reseauMaigre()) charger();
        relance();
      }, { threshold: 0.12 });
      obs.observe(hote);
    } catch (e) { visible = true; charger(); }

    document.addEventListener('visibilitychange', relance);
    try {
      global.matchMedia('(prefers-reduced-motion: reduce)')
        .addEventListener('change', function (e) { if (e.matches) { pause = true; relance(); } });
    } catch (e) {}

    // Mouvement refuse par le systeme : la machine reste, mais figee.
    if (reduit()) pause = true;
    libelles();
  }

  /* Appele apres CHAQUE rendu : le gabarit vient d'etre reconstruit, il faut
     redeposer la scene dans son emplacement. Elle n'est jamais recreee. */
  function monter(racine) {
    try {
      var slot = (racine || document).querySelector('[data-rb-scene3d]');
      if (!slot) { visible = false; if (raf) { cancelAnimationFrame(raf); raf = 0; } return; }
      if (!hote) construire();
      if (hote.parentNode !== slot) { slot.textContent = ''; slot.appendChild(hote); }
      libelles();
    } catch (e) {}
  }

  global.RBScene3D = { monter: monter, _orbite: orbite, _phaseAngle: phaseAngle,
                      _TOUR_S: TOUR_S, _RESPIRE_S: RESPIRE_S, _REPRISE_MS: REPRISE_MS,
                      _etat: function () { return { pret: pret, pause: pause, libre: libre }; } };
})(typeof window !== 'undefined' ? window : this);
