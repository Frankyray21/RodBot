/* ===========================================================================
   recherche.js  |  Trouver un mot, dans la base de connaissances.

   Remplace l'ancienne grille de cartes « Ouvrir, toucher, essayer ». Le
   travailleur tape un mot et voit tout de suite ou il mene : une lecon, une
   page du manuel, un atelier 3D. Des mots tout prets sont proposes pour
   ceux qui n'aiment pas taper.

   Deux contraintes ont dicte le code, les memes que pour scene3d.js.

   1. Le moteur de gabarits reconstruit TOUT le DOM a chaque rendu. Un champ
      pose dans le gabarit serait vide des la premiere frappe. Le bloc vit
      donc dans un noeud a lui, cree UNE fois, redepose apres chaque rendu :
      la saisie et les resultats survivent.

   2. Rien n'est telecharge : la recherche lit les lecons deja en memoire
      (COMP.M()) et une liste d'ateliers ecrite ici. Elle marche hors ligne.
   =========================================================================== */
(function (global) {
  'use strict';

  var MAX = 8;   // au-dela, on demande un mot plus precis

  /* Les ateliers 3D : ce que les cartes retirees ouvraient. Ils restent
     trouvables par mot cle. « mots » liste les facons de les nommer sur le
     terrain, pour que la recherche reponde au vocabulaire des operateurs. */
  var ATELIERS = [
    { ex: 'panel', page: 14, ic: '🚪',
      fr: 'Ouvrir le coffret IHM', en: 'Open the HMI cabinet',
      motsFr: 'coffret ihm panneau electrique porte recepteur ppu bornier ecran armoire',
      motsEn: 'hmi cabinet panel door receiver ppu terminal screen electrical' },
    { ex: 'emergency-points', page: 12, ic: '🛑',
      fr: 'Trouver les quatre arrêts d’urgence', en: 'Find the four emergency stops',
      motsFr: 'arret urgence estop e-stop champignon rouge securite quatre',
      motsEn: 'emergency stop estop e-stop red mushroom safety four' },
    { ex: 'radio-points', page: 21, ic: '🕹️',
      fr: 'Repérer les commandes radio', en: 'Find the radio controls',
      motsFr: 'telecommande radio rrc manette joystick js1 js2 js3 bascule pince bouton vert',
      motsEn: 'remote radio rrc joystick js1 js2 js3 rocker grip green button' },
    { ex: 'manual-levers', page: 15, ic: '🎚️',
      fr: 'Observer les leviers manuels', en: 'Look at the manual levers',
      motsFr: 'levier manuel poste debattement neutre commande manuelle',
      motsEn: 'lever manual station travel neutral control' },
    { ex: '', page: 0, ic: '🔍',
      fr: 'Explorer les composants', en: 'Explore the components',
      motsFr: 'composant bras mat pince grappin panier bac tige stabilisateur chenille verin',
      motsEn: 'component arm mast grip gripper basket rod stabiliser track jack' }
  ];

  /* Mots tout prets : un doigt suffit, aucune frappe. */
  var RACCOURCIS = {
    fr: ['Arrêt d’urgence', 'Télécommande', 'Tiges', 'Grappin', 'Entretien'],
    en: ['Emergency stop', 'Remote', 'Rods', 'Gripper', 'Maintenance']
  };

  function normaliser(valeur) {
    try {
      if (global.RBInterface && global.RBInterface.normalize) return global.RBInterface.normalize(valeur);
    } catch (e) {}
    return String(valeur || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  /* Les ateliers qui repondent a la demande. Fonction pure : testable sans
     navigateur. Tous les mots tapes doivent coller, comme pour les lecons. */
  function chercherAteliers(requete, en, pageVue) {
    var mots = normaliser(requete).split(' ').filter(Boolean);
    if (!mots.length) return [];
    return ATELIERS.filter(function (a) {
      var pages = '';
      if (a.page) {
        // Le manuel anglais est decale : les deux numeros doivent repondre.
        var vue = pageVue ? pageVue(a.page) : a.page;
        pages = ' page ' + a.page + (vue && vue !== a.page ? ' page ' + vue : '');
      }
      var botte = normaliser((en ? a.en : a.fr) + ' ' + (en ? a.motsEn : a.motsFr) + pages + ' 3d');
      return mots.every(function (mot) { return botte.indexOf(mot) !== -1; });
    });
  }

  /* Numero de page tel que le manuel ouvert l'affiche. */
  function pageVue(page) {
    var c = comp();
    try { return (c && c.mp) ? c.mp(page) : page; } catch (e) { return page; }
  }

  var hote = null, champ = null, vider = null, compte = null, liste = null, raccourcis = null, etiquette = null;
  var saisie = '';

  function comp() { return global.COMP || null; }
  function en() {
    try { return !!(comp() && comp().state && comp().state.lang === 'en'); } catch (e) { return false; }
  }
  function tr(fr, ang) { return en() ? ang : fr; }

  function bouton(classe) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = classe;
    return b;
  }

  /* Une ligne de resultat : un titre, puis ou il mene. */
  function ligne(ic, titre, sous) {
    var frag = document.createDocumentFragment();
    var icone = document.createElement('span');
    icone.className = 'rb-trouve-ic';
    icone.setAttribute('aria-hidden', 'true');
    icone.textContent = ic;
    var texte = document.createElement('span');
    texte.className = 'rb-trouve-txt';
    var fort = document.createElement('strong');
    fort.textContent = titre;
    var petit = document.createElement('small');
    petit.textContent = sous;
    texte.appendChild(fort); texte.appendChild(petit);
    frag.appendChild(icone); frag.appendChild(texte);
    return frag;
  }

  function resultats() {
    var c = comp();
    liste.replaceChildren();
    var requete = saisie.trim();
    vider.hidden = !requete;
    if (!requete) {
      compte.textContent = tr('Exemples : télécommande, tiges, page 18.',
                              'Examples: remote, rods, page 18.');
      return;
    }
    var lecons = [];
    try {
      if (c && global.RBInterface && global.RBInterface.searchLessons) {
        lecons = global.RBInterface.searchLessons(c.M(), requete, c.mp.bind(c)) || [];
      }
    } catch (e) { lecons = []; }
    var ateliers = chercherAteliers(requete, en(), pageVue);
    var total = lecons.length + ateliers.length;

    if (!total) {
      compte.textContent = tr('Aucun résultat. Essayez un autre mot.',
                              'No result. Try another word.');
      return;
    }
    compte.textContent = total === 1
      ? tr('1 résultat.', '1 result.')
      : total + tr(' résultats.', ' results.') +
        (total > MAX ? tr(' Les ' + MAX + ' premiers sont affichés.', ' The first ' + MAX + ' are shown.') : '');

    /* Les ateliers 3D passent devant : ils sont peu nombreux, ils font agir, et
       ils ont perdu leur grille de cartes sur l'accueil. */
    var restant = MAX;
    ateliers.forEach(function (a) {
      if (restant-- <= 0) return;
      var lien = document.createElement('a');
      lien.className = 'rb-trouve-ligne';
      lien.href = '3d/?' + (a.ex ? 'exercise=' + a.ex + '&' : '') + 'lang=' + (en() ? 'en' : 'fr');
      lien.appendChild(ligne(a.ic, en() ? a.en : a.fr,
        tr('Atelier 3D · 30 Mo', '3D workshop · 30 MB') +
        (a.page ? ' · p. ' + pageVue(a.page) : '')));
      liste.appendChild(lien);
    });
    lecons.forEach(function (r) {
      if (restant-- <= 0) return;
      var b = bouton('rb-trouve-ligne');
      b.appendChild(ligne('📘', r.title,
        tr('Leçon · module ', 'Lesson · module ') + (r.module + 1) + ' · ' + r.moduleTitle +
        ' · p. ' + r.page));
      b.addEventListener('click', function () {
        try { c.openLesson(r.module, r.lesson); } catch (e) {}
      });
      liste.appendChild(b);
    });
  }

  function libelles() {
    if (!hote) return;
    etiquette.textContent = tr('Tapez un mot', 'Type a word');
    champ.setAttribute('placeholder', tr('grappin, arrêt, page 14…', 'gripper, stop, page 14…'));
    champ.setAttribute('aria-label', tr('Chercher un mot', 'Search a word'));
    vider.setAttribute('aria-label', tr('Effacer la recherche', 'Clear the search'));
    raccourcis.replaceChildren();
    (RACCOURCIS[en() ? 'en' : 'fr'] || []).forEach(function (mot) {
      var b = bouton('rb-trouve-mot');
      b.textContent = mot;
      b.addEventListener('click', function () {
        saisie = mot;
        champ.value = mot;
        resultats();
        champ.focus();
      });
      raccourcis.appendChild(b);
    });
    resultats();
  }

  function construire() {
    hote = document.createElement('div');
    hote.className = 'rb-trouve';

    etiquette = document.createElement('label');
    etiquette.className = 'rb-trouve-etiquette';
    etiquette.setAttribute('for', 'rb-trouve-champ');

    champ = document.createElement('input');
    champ.id = 'rb-trouve-champ';
    champ.className = 'rb-trouve-champ';
    champ.type = 'search';
    champ.setAttribute('autocomplete', 'off');
    champ.addEventListener('input', function () { saisie = champ.value; resultats(); });

    vider = bouton('rb-trouve-vider');
    vider.textContent = '✕';
    vider.hidden = true;
    vider.addEventListener('click', function () {
      saisie = ''; champ.value = ''; resultats(); champ.focus();
    });

    var boite = document.createElement('div');
    boite.className = 'rb-trouve-boite';
    boite.appendChild(champ);
    boite.appendChild(vider);

    raccourcis = document.createElement('div');
    raccourcis.className = 'rb-trouve-mots';

    compte = document.createElement('p');
    compte.className = 'rb-trouve-compte';
    compte.setAttribute('role', 'status');
    compte.setAttribute('aria-live', 'polite');

    liste = document.createElement('div');
    liste.className = 'rb-trouve-liste';

    hote.appendChild(etiquette);
    hote.appendChild(boite);
    hote.appendChild(raccourcis);
    hote.appendChild(compte);
    hote.appendChild(liste);
    libelles();
  }

  /* Appele apres CHAQUE rendu : le gabarit vient d'etre reconstruit, il faut
     redeposer le bloc. Il n'est jamais recree, la saisie reste. */
  function monter(racine) {
    try {
      var place = (racine || document).querySelector('[data-rb-recherche]');
      if (!place) return;
      if (!hote) construire();
      if (hote.parentNode !== place) { place.textContent = ''; place.appendChild(hote); }
      libelles();
    } catch (e) {}
  }

  global.RBRecherche = {
    monter: monter,
    _ateliers: ATELIERS,
    _chercherAteliers: chercherAteliers,
    _MAX: MAX
  };
})(typeof window !== 'undefined' ? window : this);
