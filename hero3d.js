/* ============================================================
   Accueil : la machine en 3D, tournée au doigt.

   Le héros affiche la réplique détaillée (3d/assets/rodbot-v5.glb),
   le même fichier que la page « Réplique 3D » : un seul modèle, une
   seule mise en cache pour les deux pages. Aucun choix de qualité.

   La photo du héros reste visible pendant le chargement, puis
   s'efface. Si la 3D ne s'ouvre pas (WebGL absent, fichier hors
   ligne), la photo reste seule : l'accueil n'est jamais vide.

   Le gabarit de l'app est reconstruit à chaque rendu (app.js vide
   #app). La couche 3D vit donc ici et se replace dans le héros
   après chaque rendu : le modèle n'est jamais retéléchargé.
   ============================================================ */
(function (window, document) {
  'use strict';

  var MODELE = '3d/assets/rodbot-v5.glb';
  var DECOR = '3d/assets/warehouse-v5.hdr';
  var VISIONNEUSE = '3d/vendor/model-viewer-4.3.1.min.js';
  var DRACO = '3d/vendor/draco/';
  var ORBITE = '-35deg 72deg 95%';    // vue de départ, machine bien remplie
  var CHAMP = '30deg';

  /* Pose de départ : mêmes valeurs que MOTIONS (3d/js/replique.js).
     Un test compare les deux listes. */
  var MOUVEMENTS = [
    { id: 'turret', clip: 'Rotation_tourelle', min: -35, max: 35, initial: 0, reverse: false },
    { id: 'arm', clip: 'Elevation_bras', min: 0, max: 15, initial: 0, reverse: true },
    { id: 'wrist', clip: 'Inclinaison_pince', min: -10, max: 10, initial: 3, reverse: false },
    { id: 'tool', clip: 'Rotation_pince', min: -35, max: 35, initial: 0, reverse: false },
    { id: 'grip', clip: 'Ouverture_pince', min: 0, max: 100, initial: 0, reverse: false },
    { id: 'jacks', clip: 'Stabilisateurs', min: 0, max: 100, initial: 100, reverse: false }
  ];

  var TEXTES = {
    fr: {
      chargement: 'Chargement de la 3D',
      unite: ' %',
      astuce: '🖐 Glisse pour tourner la machine.',
      recentrer: 'Recentrer',
      recentrerAide: 'Revenir à la vue de départ',
      zoomPlus: 'Zoomer sur la machine',
      zoomMoins: 'Reculer la vue',
      panne: 'La 3D ne s’ouvre pas ici. La photo reste affichée.',
      reessayer: 'Réessayer',
      alt: 'RodBot LP en 3D : bras articulé, chenilles et télécommande. Glisse pour tourner.'
    },
    en: {
      chargement: 'Loading the 3D model',
      unite: '%',
      astuce: '🖐 Drag to turn the machine.',
      recentrer: 'Reset view',
      recentrerAide: 'Back to the starting view',
      zoomPlus: 'Zoom in on the machine',
      zoomMoins: 'Zoom out',
      panne: 'The 3D view cannot open here. The photo stays visible.',
      reessayer: 'Try again',
      alt: 'RodBot LP in 3D: articulated arm, tracks and remote control. Drag to turn.'
    }
  };

  var couche = null;    // couche persistante, replacée après chaque rendu
  var mv = null;        // <model-viewer>
  var els = {};         // commandes de la couche
  var etat = 'attente'; // 'attente' | 'chargement' | 'vivant' | 'panne'
  var progres = 0;
  var langue = 'fr';

  function T() { return TEXTES[langue] || TEXTES.fr; }
  function adresse(rel) { return new URL(rel, document.baseURI).href; }
  function mouvementCalme() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }
  /* Position de la piste d'animation qui donne la valeur voulue (voir replique.js). */
  function tempsMouvement(m, valeur) {
    var borne = Math.max(m.min, Math.min(m.max, valeur));
    var part = (borne - m.min) / (m.max - m.min);
    return m.reverse ? 1 - part : part;
  }

  /* ---------- couche 3D (construite une seule fois) ---------- */
  function bouton(classe, texte) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = classe;
    b.textContent = texte;
    return b;
  }

  function construire() {
    couche = document.createElement('div');
    couche.className = 'rb-hero3d-layer';

    /* Le message reste stable pendant le chargement : un lecteur d'écran
       n'a pas à annoncer chaque pourcentage. La barre porte l'avancement. */
    els.etat = document.createElement('p');
    els.etat.className = 'rb-hero3d-state';
    els.etat.setAttribute('role', 'status');
    els.pourcent = document.createElement('span');
    els.pourcent.className = 'rb-hero3d-percent';
    els.pourcent.setAttribute('aria-hidden', 'true');
    els.etat.appendChild(document.createTextNode(''));
    els.etat.appendChild(els.pourcent);

    els.barre = document.createElement('progress');
    els.barre.className = 'rb-hero3d-bar';
    els.barre.max = 100;
    els.barre.value = 0;

    /* Reprise : on recharge la page. Après un échec, la visionneuse garde le
       modèle en défaut dans son cache et ne le redemande plus (même choix que
       la page « Réplique 3D »). */
    els.reprise = bouton('rb-hero3d-retry', '');
    els.reprise.addEventListener('click', function () { location.reload(); });

    els.voile = document.createElement('div');
    els.voile.className = 'rb-hero3d-veil';
    els.voile.appendChild(els.etat);
    els.voile.appendChild(els.barre);
    els.voile.appendChild(els.reprise);

    els.astuce = document.createElement('p');
    els.astuce.className = 'rb-hero3d-hint';

    els.zoomPlus = bouton('rb-hero3d-zoom-btn', '+');
    els.zoomMoins = bouton('rb-hero3d-zoom-btn', '−');
    els.zoomPlus.addEventListener('click', function () { zoomer(0.78); });
    els.zoomMoins.addEventListener('click', function () { zoomer(1.28); });
    els.zoom = document.createElement('div');
    els.zoom.className = 'rb-hero3d-zoom';
    els.zoom.appendChild(els.zoomPlus);
    els.zoom.appendChild(els.zoomMoins);

    els.recentrer = bouton('rb-hero3d-reset', '');
    els.recentrer.addEventListener('click', recentrer);

    couche.appendChild(els.voile);
    couche.appendChild(els.astuce);
    couche.appendChild(els.zoom);
    couche.appendChild(els.recentrer);

    /* La molette seule doit continuer de faire défiler la page : le héros
       est en haut d'une longue page. Ctrl + molette zoome le modèle. */
    couche.addEventListener('wheel', function (e) {
      if (!e.ctrlKey && !e.metaKey) e.stopPropagation();
    }, true);
  }

  /* ---------- affichage de l'état ---------- */
  function refleter() {
    if (!couche) return;
    var t = T();
    couche.className = 'rb-hero3d-layer is-' + etat;
    var scene = couche.parentElement;
    if (scene) scene.classList.toggle('is-live', etat === 'vivant');
    els.etat.firstChild.nodeValue = etat === 'panne' ? t.panne
      : etat === 'vivant' ? '' : t.chargement + ' ';
    els.pourcent.textContent = etat === 'chargement' ? progres + t.unite : '';
    els.barre.value = progres;
    els.barre.setAttribute('aria-label', t.chargement);
    els.reprise.textContent = t.reessayer;
    els.astuce.textContent = t.astuce;
    els.recentrer.textContent = t.recentrer;
    els.recentrer.setAttribute('aria-label', t.recentrerAide);
    els.zoomPlus.setAttribute('aria-label', t.zoomPlus);
    els.zoomMoins.setAttribute('aria-label', t.zoomMoins);
    if (mv) mv.setAttribute('alt', t.alt);
  }

  function echec() {
    if (etat === 'vivant') return;   // un modèle déjà affiché reste affiché
    etat = 'panne';
    refleter();
  }

  /* ---------- commandes ---------- */
  function recentrer() {
    if (!mv) return;
    mv.cameraOrbit = ORBITE;
    mv.cameraTarget = 'auto auto auto';
    mv.fieldOfView = CHAMP;
    // la rotation lente tourne le modèle : on la remet aussi à zéro
    if (typeof mv.resetTurntableRotation === 'function') mv.resetTurntableRotation();
  }

  function zoomer(facteur) {
    if (!mv || !mv.getCameraOrbit) return;
    var o = mv.getCameraOrbit();
    // les bornes min/max de l'orbite écrêtent la valeur donnée
    mv.cameraOrbit = o.theta + 'rad ' + o.phi + 'rad ' + (o.radius * facteur) + 'm';
  }

  function poserLesArticulations() {
    var dispo = mv.availableAnimations || [];
    for (var i = 0; i < MOUVEMENTS.length; i++) {
      if (dispo.indexOf(MOUVEMENTS[i].clip) === -1) return;
    }
    mv.timeScale = 0;
    mv.animationCrossfadeDuration = 0;
    MOUVEMENTS.forEach(function (m) {
      mv.appendAnimation(m.clip, { time: tempsMouvement(m, m.initial), timeScale: 0, weight: 1, fade: false });
    });
  }

  /* ---------- chargement du modèle ---------- */
  function creerVisionneuse(Element3D) {
    mv = document.createElement('model-viewer');
    /* Créer le premier <model-viewer> remet le décodeur Draco sur le service
       externe de Google. On impose donc le décodeur LOCAL après la création :
       le modèle s'ouvre aussi hors ligne, sans dépendance à un tiers. */
    if (Element3D) Element3D.dracoDecoderLocation = adresse(DRACO);
    var attrs = {
      'camera-controls': '',
      'touch-action': 'pan-y',
      'camera-orbit': ORBITE,
      'min-camera-orbit': 'auto 10deg 60%',
      'max-camera-orbit': 'auto 88deg 170%',
      'field-of-view': CHAMP,
      'interaction-prompt': 'none',
      'shadow-intensity': '1',
      'shadow-softness': '0.8',
      exposure: '1',
      'tone-mapping': 'agx',
      loading: 'eager',
      reveal: 'auto',
      tabindex: '0',              // flèches du clavier : tourner la machine
      alt: T().alt
    };
    Object.keys(attrs).forEach(function (k) { mv.setAttribute(k, attrs[k]); });
    if (!mouvementCalme()) {
      mv.setAttribute('auto-rotate', '');
      mv.setAttribute('auto-rotate-delay', '2600');
      mv.setAttribute('rotation-per-second', '12deg');
    }
    mv.addEventListener('progress', function (e) {
      var d = e.detail || {};
      progres = Math.max(0, Math.min(100, Math.round((d.totalProgress || 0) * 100)));
      if (etat === 'chargement') refleter();
    });
    mv.addEventListener('load', function () {
      etat = 'vivant';
      progres = 100;
      poserLesArticulations();
      refleter();
      // l'astuce s'efface d'elle-même : elle ne doit pas cacher la machine
      setTimeout(function () { couche.classList.add('a-servi'); }, 7000);
    });
    mv.addEventListener('error', echec);
    // L'astuce disparaît dès que la machine a été tournée une fois.
    mv.addEventListener('camera-change', function (e) {
      if (e.detail && e.detail.source === 'user-interaction') couche.classList.add('a-servi');
    });
    mv.environmentImage = adresse(DECOR);
    mv.src = adresse(MODELE);
    couche.insertBefore(mv, couche.firstChild);
  }

  function demarrer() {
    if (etat !== 'attente') return;
    etat = 'chargement';
    progres = 0;
    refleter();
    import(adresse(VISIONNEUSE)).then(function (mod) {
      creerVisionneuse(mod && mod.ModelViewerElement);
    }).catch(function () { echec(); });
  }

  /* ---------- montage après chaque rendu de l'app ---------- */
  function monter() {
    var figure = document.querySelector('[data-rb-hero3d]');
    if (!figure) return;                       // écran autre que l'accueil
    var scene = figure.querySelector('.rb-hero3d-stage');
    if (!scene) return;
    langue = figure.getAttribute('data-rb-hero3d') === 'en' ? 'en' : 'fr';
    if (!couche) construire();
    if (couche.parentElement !== scene) scene.appendChild(couche);
    refleter();
    demarrer();
  }

  function brancher() {
    var IF = window.RBInterface;
    if (IF && !IF.__hero3d) {
      var suite = IF.afterRender;
      IF.afterRender = function () {
        var retour = suite.apply(this, arguments);
        try { monter(); } catch (e) {}
        return retour;
      };
      IF.__hero3d = true;
    } else if (!IF) {
      // filet de sécurité : l'app rend le héros sans passer par RBInterface
      new MutationObserver(function () { try { monter(); } catch (e) {} })
        .observe(document.body, { childList: true, subtree: true });
    }
  }

  brancher();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', monter);
  else monter();

  window.__rbHero3d = {   // sonde pour les tests
    etat: function () { return etat; },
    progres: function () { return progres; },
    langue: function () { return langue; },
    mouvements: MOUVEMENTS,
    tempsMouvement: tempsMouvement
  };
})(window, document);
