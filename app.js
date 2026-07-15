/*
 * RodBot LP : Formation opérateur
 * ---------------------------------
 * Application 100 % HTML/CSS/JS, sans aucun framework.
 *
 * Ce fichier contient :
 *   1. Un petit moteur de rendu (~150 lignes) qui interprète le gabarit
 *      déclaratif d'origine ({{ expr }}, <sc-if>, <sc-for>, onClick, onInput,
 *      style-hover) : repris tel quel du design Claude Design.
 *   2. La logique applicative (classe Component) : reprise telle quelle.
 *
 * Le moteur fait un rendu complet à chaque action discrète (clic), et une
 * mise à jour « douce » (en place, sans reconstruire le DOM) pendant la
 * saisie continue (curseurs du simulateur), pour un glissement fluide.
 */
'use strict';

/* Version de l'application, affichée dans le pied de page et utilisée pour
   nommer le cache du service worker. À incrémenter à CHAQUE changement. */
var APP_VERSION = '1.7.6';
/* Correspondance des numéros de page manuel FR(87p) → EN(82p), les deux manuels ayant
   des paginations différentes. Générée par appariement des titres de sections. */
var PAGE_MAP_EN = {1:1,2:2,3:3,4:4,5:4,6:6,7:7,8:8,9:9,10:10,11:10,12:11,13:13,14:14,15:15,16:16,17:17,18:18,19:19,20:20,21:20,22:21,23:22,24:23,25:24,26:25,27:26,28:27,29:28,30:29,31:30,32:31,33:32,34:33,35:34,36:35,37:36,38:36,39:37,40:38,41:39,42:40,43:40,44:41,45:42,46:43,47:44,48:45,49:46,50:46,51:47,52:48,53:49,54:50,55:52,56:53,57:53,58:54,59:55,60:57,61:58,62:59,63:59,64:60,65:61,66:62,67:63,68:64,69:65,70:65,71:66,72:67,73:68,74:69,75:70,76:71,77:72,78:73,79:74,80:75,81:76,82:77,83:78,84:79,85:80,86:81,87:82};
var APP_VERSION_DATE = '15 JUIL. 2026';

var SVG_NS = 'http://www.w3.org/2000/svg';
var ROOT = null;      // conteneur DOM (#app)
var COMP = null;      // instance Component
var TPL_ROOT = null;  // racine du gabarit parsé
var BINDINGS = [];    // liaisons dynamiques enregistrées au rendu complet
var SOFT = false;     // vrai pendant un événement input (mise à jour douce)

/* --------- Résolution d'expressions ({{ a.b.c }}) contre une pile de portées --------- */
function resolveExpr(expr, scope) {
  expr = expr.trim();
  if (expr === 'true') return true;
  if (expr === 'false') return false;
  var parts = expr.split('.');
  var head = parts[0];
  var val, found = false;
  for (var i = scope.length - 1; i >= 0; i--) {
    if (scope[i] != null && Object.prototype.hasOwnProperty.call(scope[i], head)) {
      val = scope[i][head]; found = true; break;
    }
  }
  if (!found) return undefined;
  for (var j = 1; j < parts.length; j++) {
    if (val == null) return undefined;
    val = val[parts[j]];
  }
  return val;
}

/* Remplace toutes les occurrences {{ ... }} d'une chaîne (texte ou valeur d'attribut). */
function interpolate(str, scope) {
  return str.replace(/\{\{([^}]*)\}\}/g, function (_, e) {
    var v = resolveExpr(e, scope);
    return (v === undefined || v === null) ? '' : v;
  });
}

/* --------- Rendu complet : reconstruit tout le DOM et ré-enregistre les liaisons --------- */
function fullRender() {
  var vals = COMP.renderVals();
  BINDINGS = [];
  ROOT.textContent = '';
  var scope = [vals];
  var kids = TPL_ROOT.childNodes;
  for (var i = 0; i < kids.length; i++) renderNode(kids[i], scope, ROOT, false);
  // Respecte prefers-reduced-motion : fige les animations SVG (SMIL) sur une pose
  try {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      var anims = ROOT.querySelectorAll('svg.rb-anim');
      for (var a = 0; a < anims.length; a++) {
        if (anims[a].setCurrentTime) anims[a].setCurrentTime(3.4);
        if (anims[a].pauseAnimations) anims[a].pauseAnimations();
      }
    }
  } catch (e) {}
  try { if (COMP && COMP.syncHistory) COMP.syncHistory(); } catch (e) {}
}

/* --------- Mise à jour douce : réévalue les liaisons en place (aucun nœud recréé) --------- */
function softRender() {
  var vals = COMP.renderVals();
  for (var i = 0; i < BINDINGS.length; i++) {
    var b = BINDINGS[i];
    var sc = [vals].concat(b.scope.slice(1)); // portée de base fraîche, cadres de boucle conservés
    var out = interpolate(b.tmpl, sc);
    if (b.kind === 'text') b.node.nodeValue = out;
    else if (b.kind === 'value') { if (b.node.value !== out) b.node.value = out; }
    else b.node.setAttribute(b.name, out);
  }
}

/* --------- Rendu récursif d'un nœud de gabarit --------- */
function renderNode(tnode, scope, parentDom, svg) {
  // Texte
  if (tnode.nodeType === 3) {
    var text = tnode.nodeValue;
    if (text.indexOf('{{') === -1) {
      if (text.length) parentDom.appendChild(document.createTextNode(text));
    } else {
      var tn = document.createTextNode(interpolate(text, scope));
      BINDINGS.push({ kind: 'text', node: tn, tmpl: text, scope: scope });
      parentDom.appendChild(tn);
    }
    return;
  }
  if (tnode.nodeType !== 1) return; // ignore commentaires, etc.

  var tag = tnode.tagName.toLowerCase();

  // Conditionnel <sc-if value="{{ cond }}">
  if (tag === 'sc-if') {
    var cond = resolveExpr(getRawAttr(tnode, 'value'), scope);
    if (cond) renderChildren(tnode, scope, parentDom, svg);
    return;
  }
  // Boucle <sc-for list="{{ arr }}" as="x">
  if (tag === 'sc-for') {
    var list = resolveExpr(getRawAttr(tnode, 'list'), scope) || [];
    var as = tnode.getAttribute('as') || 'item';
    for (var k = 0; k < list.length; k++) {
      var frame = {}; frame[as] = list[k];
      renderChildren(tnode, scope.concat([frame]), parentDom, svg);
    }
    return;
  }

  // Élément normal (HTML ou SVG)
  var childSvg = svg || tag === 'svg';
  var el = childSvg ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
  var baseStyle = '';

  var attrs = tnode.attributes;
  for (var a = 0; a < attrs.length; a++) {
    var name = attrs[a].name, raw = attrs[a].value;
    var lname = name.toLowerCase();
    if (lname.indexOf('hint-placeholder') === 0) continue;

    if (lname === 'sc-html') {
      el.innerHTML = richHtml(interpolate(raw, scope));
      el.__scHtml = true;   // ne pas rendre d'enfants de gabarit par-dessus
    } else if (lname === 'onclick') {
      (function (fn, node) { node.addEventListener('click', function (e) { if (typeof fn === 'function') fn(e); }); })(resolveExpr(stripBraces(raw), scope), el);
    } else if (lname === 'oninput') {
      (function (fn, node) {
        node.addEventListener('input', function (e) {
          SOFT = true;
          try { if (typeof fn === 'function') fn(e); } finally { SOFT = false; }
        });
      })(resolveExpr(stripBraces(raw), scope), el);
    } else if (lname === 'style-hover') {
      el.__hover = interpolate(raw, scope);
    } else if (lname === 'value') {
      var vv = interpolate(raw, scope);
      el.value = vv;
      if (raw.indexOf('{{') !== -1) BINDINGS.push({ kind: 'value', node: el, tmpl: raw, scope: scope });
    } else {
      var out = raw.indexOf('{{') !== -1 ? interpolate(raw, scope) : raw;
      el.setAttribute(name, out);
      if (name === 'style') baseStyle = out;
      if (raw.indexOf('{{') !== -1) BINDINGS.push({ kind: 'attr', node: el, name: name, tmpl: raw, scope: scope });
    }
  }

  // Survol (style-hover) : superpose puis restaure le style de base
  if (el.__hover) {
    (function (node, base, hover) {
      node.addEventListener('mouseenter', function () { node.setAttribute('style', base + ';' + hover); });
      node.addEventListener('mouseleave', function () { node.setAttribute('style', base); });
    })(el, baseStyle, el.__hover);
  }

  // Repli gracieux si une image du manuel est absente
  if (tag === 'img') addImgFallback(el);

  parentDom.appendChild(el);
  if (!el.__scHtml) renderChildren(tnode, scope, el, childSvg);
}

function renderChildren(tnode, scope, parentDom, svg) {
  var kids = tnode.childNodes;
  for (var i = 0; i < kids.length; i++) renderNode(kids[i], scope, parentDom, svg);
}

/* Récupère la valeur brute d'un attribut sans le déballer de {{ }}. */
function getRawAttr(node, name) { return stripBraces(node.getAttribute(name) || ''); }
function stripBraces(s) { var m = /^\s*\{\{([^}]*)\}\}\s*$/.exec(s); return m ? m[1].trim() : s.trim(); }

/* Placeholder si les photos du manuel (hors export) ne sont pas présentes. */
function addImgFallback(img) {
  img.addEventListener('error', function () {
    // Repli langue : si une planche/figure ANGLAISE manque, on tente la version FRANÇAISE
    // avant d'afficher un espace réservé. (img/manual-en → img/manual, img/fig-en → img/fig)
    var cur = img.getAttribute('src') || '';
    if (!img.__langFb && /\/(manual|fig)-en\//.test(cur)) {
      img.__langFb = true;
      img.src = cur.replace('/manual-en/', '/manual/').replace('/fig-en/', '/fig/');
      return;
    }
    if (img.__fb) return; img.__fb = true;
    var label = (img.getAttribute('alt') || 'Image du manuel');
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="440">' +
      '<rect width="640" height="440" fill="#dcd6c6"/>' +
      '<rect x="10" y="10" width="620" height="420" fill="none" stroke="#b5641b" stroke-width="2" stroke-dasharray="8 8"/>' +
      '<text x="320" y="205" text-anchor="middle" font-family="Archivo,sans-serif" font-size="22" font-weight="800" fill="#5c5645">' + esc(label) + '</text>' +
      '<text x="320" y="240" text-anchor="middle" font-family="monospace" font-size="13" fill="#8f866f">Photo du manuel, à ajouter dans /img</text></svg>';
    img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  });
}
function esc(s) { return String(s).replace(/[<>&]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]; }); }
/* Texte enrichi des leçons : **gras** et ##gras rouge## (mots-clés / sécurité).
   On échappe d'abord le HTML, puis on convertit nos marqueurs, contenu maison, sûr. */
function richHtml(s) {
  s = esc(s);
  s = s.replace(/##([^#]+)##/g, '<strong style="color:#D92624">$1</strong>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#1D1E1B;font-weight:800">$1</strong>');
  return s;
}

/* --------- Classe de base : setState déclenche le rendu (doux ou complet) --------- */
class DCLogic {
  constructor(props) { this.props = props || {}; }
  setState(patch, cb) {
    var next = (typeof patch === 'function') ? patch(this.state) : patch;
    for (var k in next) this.state[k] = next[k];
    if (SOFT) softRender(); else fullRender();
    if (typeof cb === 'function') cb();
  }
}


/* Enrichissement additif des leçons (texte détaillé + figures du manuel).
   Clé "moduleIndex-sectionIndex". Rempli à partir du manuel OM 10667.
   Fusionné dans renderVals() sans modifier les données MODULES d'origine. */
var QUIZ2 = /*__QUIZ2__*/{"0":[{"type":"vf","text":"Le RodBot LP dispose de sa propre source d'énergie embarquée (moteur ou batteries).","options":["Vrai","Faux"],"correct":1,"page":6,"fb":"Le RodBot n'a aucune source d'énergie embarquée : il tire son alimentation électrique ET hydraulique d'une connexion câblée à la foreuse. Ce câble relie aussi les circuits d'arrêt d'urgence des deux machines."},{"type":"multi","text":"Parmi ces modes, lesquels commandent le MÂT (bras robotisé) ? Cochez toutes les bonnes réponses.","options":["DIRECT","LINÉAIRE","RALENTI","TRAJECTOIRE"],"correct":[0,1,3],"page":6,"fb":"DIRECT, LINÉAIRE et TRAJECTOIRE sont les trois modes de commande du mât. RALENTI, lui, ne commande que les chenilles (déplacement de la machine)."},{"type":"order","text":"Classez les trois modes de commande du mât, du plus manuel au plus automatisé.","options":["TRAJECTOIRE","DIRECT","LINÉAIRE"],"correct":[1,2,0],"page":6,"fb":"DIRECT (chaque articulation commandée séparément) → LINÉAIRE (l'effecteur suit des lignes droites) → TRAJECTOIRE (déplacement autonome entre points enregistrés)."},{"type":"cloze","text":"La charge maximale en levage par électroaimant est de _____ lb.","options":["120","308","500"],"correct":0,"page":8,"fb":"120 lb par électroaimant. La charge maximale en levage à usage général est plus élevée : 308 lb."},{"type":"qcm","text":"Quelle est la capacité du bac à tiges ?","options":["20 tiges","35 tiges","50 tiges"],"correct":1,"page":8,"fb":"Le bac contient 35 tiges (Ø 5 po × 6 pi)."}],"1":[{"type":"qcm","text":"Qui est autorisé à mettre en service et à utiliser le RodBot ?","options":["Tout employé de la mine","Le personnel formé, habilité et apte","Toute personne accompagnée d'un superviseur"],"correct":1,"page":10,"fb":"Seul un personnel formé à l'équipement, habilité, conscient des dangers et en bonne condition physique et mentale peut l'utiliser."},{"type":"vf","text":"En cas de blessure par injection de fluide hydraulique sous la peau, il suffit d'appliquer un pansement et de surveiller.","options":["Vrai","Faux"],"correct":1,"page":11,"fb":"FAUX : c'est une urgence : contacter immédiatement les services médicaux. Une injection sous-cutanée de fluide haute pression peut entraîner gangrène et réactions graves."},{"type":"cloze","text":"En extérieur, il est interdit d'utiliser le système par vents violents supérieurs à _____ km/h.","options":["45","65","90"],"correct":1,"page":11,"fb":"65 km/h. On n'utilise pas non plus le système en cas d'orage."},{"type":"multi","text":"Où se trouvent les quatre arrêts d'urgence ? Cochez les quatre emplacements corrects.","options":["Panneau de commande basse tension (sous l'IHM)","Sur le bac à tiges","Télécommande radio (centre, en bas)","Châssis du RodBot (coin inférieur avant droit)","Commandes manuelles (à l'arrière)"],"correct":[0,2,3,4],"page":12,"fb":"Les 4 e-stops : panneau basse tension, télécommande radio, châssis (coin inf. avant droit) et commandes manuelles arrière. Rien sur le bac à tiges. Un e-stop couplé arrête le RodBot ET la foreuse."},{"type":"order","text":"Classez les trois pictogrammes du manuel du plus grave au moins grave.","options":["ATTENTION","DANGER","AVERTISSEMENT"],"correct":[1,2,0],"page":10,"fb":"DANGER (situation mettant la vie en danger) → AVERTISSEMENT (information cruciale pour la sécurité) → ATTENTION (prévention de blessure/dommage matériel)."}],"2":[{"type":"qcm","text":"À quelle fonction correspond le segment J1 du mât ?","options":["Le TÉLESCOPE","Le PIVOTEMENT (slew)","L'INCLINAISON"],"correct":1,"page":13,"fb":"J1 = PIVOTEMENT (slew). Les segments vont de J1 (pivotement) à J6 (inclinaison), l'effecteur étant le GRAPPIN."},{"type":"vf","text":"En mode LOCAL, les signaux de mouvement envoyés par la télécommande radio sont pris en compte.","options":["Vrai","Faux"],"correct":1,"page":14,"fb":"FAUX : en mode LOCAL, les signaux de mouvement de la télécommande sont ignorés et l'icône « No Radio » s'affiche. Il faut l'interrupteur OPERATOR CONTROL sur À DISTANCE (REMOTE)."},{"type":"cloze","text":"Pour piloter la télécommande radio, l'interrupteur OPERATOR CONTROL du panneau doit être en position _____.","options":["LOCAL","À DISTANCE (REMOTE)","VEILLE"],"correct":1,"page":14,"fb":"À DISTANCE (REMOTE). En LOCAL, les commandes radio de mouvement sont ignorées."},{"type":"qcm","text":"Que deviennent les deux valves d'isolement hydraulique en cas de coupure de courant ?","options":["Elles restent dans leur dernier état","Elles s'ouvrent pour purger la pression","Elles se ferment, plus aucune opération hydraulique"],"correct":2,"page":16,"fb":"Normalement fermées, elles se ferment par défaut à la coupure : toute opération hydraulique devient impossible (elles peuvent être forcées ouvertes à la main, sens antihoraire)."},{"type":"order","text":"Remettez les trois premiers segments du mât dans l'ordre J1 → J2 → J3.","options":["TÉLESCOPE","PIVOTEMENT","ARTICULATION (épaule)"],"correct":[1,2,0],"page":13,"fb":"J1 PIVOTEMENT → J2 ARTICULATION (épaule) → J3 TÉLESCOPE."}],"3":[{"type":"vf","text":"Retirer la clé physique de la télécommande pendant le fonctionnement n'a aucune conséquence.","options":["Vrai","Faux"],"correct":1,"page":17,"fb":"FAUX : sans la clé la RRC ne s'allume pas, et la retirer en cours de fonctionnement rompt la liaison avec le récepteur et déclenche un arrêt."},{"type":"qcm","text":"De combien le mode Lent (Turtle) réduit-il la vitesse des articulations ?","options":["25 %","50 %, sauf le grappin","75 %, grappin compris"],"correct":1,"page":19,"fb":"Turtle applique −50 % à toutes les articulations dans les modes DIRECT, LINÉAIRE et TRAJECTOIRE : sauf le grappin, qui garde sa vitesse."},{"type":"qcm","text":"La télécommande est inclinée ou tombe au sol. Que fait le RodBot ?","options":["Il poursuit son mouvement","Il passe en arrêt de sécurité : hydraulique coupée","Il déclenche l'e-stop câblé de la foreuse"],"correct":1,"page":19,"fb":"L'interrupteur d'inclinaison met le RodBot en arrêt de sécurité (hydraulique coupée) SANS déclencher l'e-stop câblé de la foreuse. Retour en veille dès que la RRC est remise à l'horizontale, manettes au neutre."},{"type":"vf","text":"Le voyant ambre CLIGNOTANT signifie que le mât est en mode TRAJECTOIRE ou que la machine se déplace (RALENTI).","options":["Vrai","Faux"],"correct":0,"page":20,"fb":"VRAI. Voyant : fixe = commande à distance active · clignotant = trajectoire ou déplacement · éteint = mode LOCAL."},{"type":"order","text":"Pour changer la batterie SANS déclencher d'arrêt d'urgence, remettez les étapes dans l'ordre.","options":["Remettre le sélecteur sur À DISTANCE","Placer le sélecteur OPERATOR CONTROL sur LOCAL","Remplacer la batterie","Éteindre la RRC (arrêt d'urgence)","Remettre la RRC sur MARCHE (ON)"],"correct":[1,3,2,4,0],"page":44,"fb":"LOCAL → éteindre la RRC (e-stop) → remplacer la batterie → RRC sur MARCHE → vérifier la liaison radio → remettre le sélecteur À DISTANCE."}],"4":[{"type":"qcm","text":"Avant de reprendre le fonctionnement après des défauts, que faut-il effacer ?","options":["Uniquement les défauts actifs","Les défauts actifs ET inactifs","Redémarrer la machine, rien d'autre"],"correct":1,"page":27,"fb":"Tous les défauts, actifs ET inactifs, doivent être effacés (sélectionner la ligne puis « Effacer le défaut »)."},{"type":"cloze","text":"Les butées mécaniques du pivotement sont à ±165°, soit une course totale de _____°.","options":["180","330","360"],"correct":1,"page":32,"fb":"330° (±165°, zone morte de 30° à l'avant). Les limites logicielles par défaut sont 10° et 320°."},{"type":"vf","text":"Un contournement d'erreur de valve n'ignore que le défaut précis sélectionné.","options":["Vrai","Faux"],"correct":1,"page":32,"fb":"FAUX : un contournement actif ignore TOUS les défauts de cette valve. Réservé à un opérateur expérimenté, uniquement pour un défaut non critique connu."},{"type":"qcm","text":"Le mât devient saccadé en mode LINÉAIRE alors que les codeurs sont bien calibrés. Que faire ?","options":["Un réglage des articulations (étalonnage PPU)","Remplacer la pompe","Passer en mode Rabbit"],"correct":0,"page":35,"fb":"Un étalonnage des articulations (PPU) : réglage du Seuil et de la Dynamique. Pendant l'étalonnage, les articulations bougent sans commande directe, prévoir l'espace requis."},{"type":"vf","text":"Des valves du mode RALENTI qui affichent un défaut PENDANT le mode MÂT indiquent un problème grave.","options":["Vrai","Faux"],"correct":1,"page":41,"fb":"FAUX : c'est normal : les valves hors de leur mode désigné affichent un défaut. Ne s'inquiéter que si le défaut apparaît dans le mode désigné."}],"5":[{"type":"qcm","text":"Comment le RodBot doit-il être installé par rapport à l'opérateur ?","options":["Une barrière les sépare, pilotage radio de part et d'autre","Côte à côte pour une meilleure visibilité","Peu importe, la radio porte à 100 m"],"correct":0,"page":45,"fb":"Une BARRIÈRE doit séparer l'opérateur de la machine et de la foreuse ; le pilotage se fait par radio de part et d'autre. Le RodBot n'a aucun système de vision."},{"type":"vf","text":"On peut passer en mode RALENTI (déplacement) même si les mâchoires du grappin sont fermées.","options":["Vrai","Faux"],"correct":1,"page":51,"fb":"FAUX : le passage en RALENTI est impossible si les mâchoires du grappin sont fermées."},{"type":"multi","text":"Quelle est la pose de transport à adopter avant tout déplacement ? Cochez toutes les conditions.","options":["Pivotement parallèle au châssis","Levage abaissé au maximum","Grappin fermé sur une tige","Télescope rétracté","Poignet orienté vers le bas","Grappin ouvert"],"correct":[0,1,3,4,5],"page":51,"fb":"Pose de transport : pivotement parallèle au châssis, levage abaissé, télescope rétracté, poignet vers le bas, grappin OUVERT. Un grappin fermé sur une tige n'en fait pas partie (et empêche le RALENTI)."},{"type":"qcm","text":"Un levier manuel est actionné pendant que la machine est en mode TÉLÉCOMMANDE. Que se passe-t-il ?","options":["Le levier prend la priorité","Erreur de valve → arrêt de protection, hydraulique coupée","Le mouvement s'additionne à la commande radio"],"correct":1,"page":50,"fb":"Le système détecte une erreur de valve et passe en arrêt de protection (hydraulique coupée). Annulation : passer en LOCAL + bouton de réarmement de sécurité."},{"type":"order","text":"Remettez les premières étapes de la séquence de mise en marche dans l'ordre.","options":["Appuyer sur le bouton vert de démarrage","Raccorder le RodBot à l'alimentation (câble de liaison)","Appuyer sur le réarmement de sécurité du panneau","Attendre l'allumage de l'IHM (~30 s)"],"correct":[1,3,0,2],"page":49,"fb":"Raccorder l'alimentation → attendre l'IHM (~30 s) → bouton vert de démarrage (puis appairer la RRC) → réarmement de sécurité → fin de séquence en mode VEILLE."}],"6":[{"type":"qcm","text":"Comment ouvre-t-on le grappin (pince) ?","options":["Bouton vert GRAPPIN maintenu + bascule vers le haut maintenue ≥ 1 s","Un simple appui sur la bascule","Double appui rapide sur le bouton vert"],"correct":0,"page":55,"fb":"OUVRIR : bouton vert GRAPPIN maintenu + bascule vers le haut maintenue au moins 1 seconde (protection contre les chutes de tige). FERMER : bouton vert + bascule vers le bas."},{"type":"vf","text":"Le RodBot détecte automatiquement une personne qui entre dans sa zone de travail.","options":["Vrai","Faux"],"correct":1,"page":63,"fb":"FAUX : le RodBot n'a AUCUN système de vision : il ne détecte ni personnel, ni véhicules, ni équipements. Barrières et restrictions d'accès sont obligatoires."},{"type":"multi","text":"Quels points/limites sont OBLIGATOIRES pour utiliser le mode TRAJECTOIRE ? Cochez tout.","options":["FOREUSE","POINT 1","ATTENTE","LIMITE SUPÉRIEURE","LIMITE INFÉRIEURE"],"correct":[0,2,3,4],"page":61,"fb":"Prérequis TRAJECTOIRE : FOREUSE, ATTENTE et les LIMITES supérieure et inférieure. POINT 1 (et POINT 2) ne sont que des points de passage optionnels."},{"type":"qcm","text":"Après un déplacement en mode RALENTI, que deviennent les points de consigne enregistrés ?","options":["Ils sont tous conservés","Ils sont tous supprimés sauf le POINT DU PLATEAU 1","Ils sont convertis en points par défaut"],"correct":1,"page":63,"fb":"Sécurité intégrée : passer en RALENTI et déplacer la machine supprime tous les points SAUF le PLATEAU 1. Il faut redéfinir les autres depuis le nouvel emplacement."},{"type":"cloze","text":"Le bac à tiges n'est pas fixé rigidement : il n'est pas _____, seulement maintenu par les dispositifs de retenue du châssis.","options":["boulonné","peint","gradué"],"correct":0,"page":65,"fb":"Il n'est pas boulonné : fourreaux pour fourches + pattes de retenue assurent son alignement et son maintien."}],"7":[{"type":"qcm","text":"Avant tout entretien, y compris le lavage, que faut-il faire ?","options":["Mettre hors tension, débrancher et appliquer le cadenassage-étiquetage (LOTO)","Passer en mode VEILLE","Fermer le grappin"],"correct":0,"page":71,"fb":"Hors tension, alimentation débranchée et LOTO sur tous les systèmes, le lavage compte comme un entretien. Attention : certains vérins à valves d'équilibrage stockent de l'énergie hydraulique."},{"type":"qcm","text":"Les fonctions du mât sont anormalement lentes. Cause la plus probable ?","options":["Pompe usée","Le mode Lent (Turtle) est actif → passer en Rabbit","Batterie de la RRC faible"],"correct":1,"page":67,"fb":"Le mode Lent (Turtle) réduit la vitesse de 50 %. Passer en mode Rapide (Rabbit)."},{"type":"cloze","text":"La flèche (le mou) correcte d'une chenille se situe entre 20 et _____ mm.","options":["25","30","40"],"correct":0,"page":75,"fb":"20 à 25 mm. Ne jamais dépasser 30 mm ni tendre à l'excès. Remplacer la chenille quand l'usure « X » descend sous 8 mm."},{"type":"vf","text":"Après un remorquage, il n'est pas nécessaire de réinstaller les bouchons du frein SAHR.","options":["Vrai","Faux"],"correct":1,"page":76,"fb":"FAUX : sans les bouchons SAHR réinstallés, la machine n'a PLUS de freins. Le remorquage exige de retirer les bouchons des deux chenilles (clé M16) après avoir fixé la machine, puis de les réinstaller après."},{"type":"qcm","text":"Quelle huile hydraulique est approuvée pour le RodBot ?","options":["ISO 46","SAE 80W90","ATF Dexron III"],"correct":0,"page":72,"fb":"Huile hydraulique de classe de viscosité ISO 46. Graisse des articulations : EP2. Huile du réducteur d'entraînement final : SAE 80W90."}]}/*__END_QUIZ2__*/;

var ENRICH = /*__ENRICH__*/{"0-0":{"blocks":[{"t":"p","text":"Le **RodBot LP** de Borterra manipule les tiges de forage."},{"t":"sub","text":"Système robotisé"},{"t":"ul","items":["Système robotisé **hydraulique**. Il charge et décharge les tiges en douceur.","Il supprime la **manutention manuelle** des tiges.","Cette manutention est une grande cause d'accidents sur les foreuses.","Il s'adapte à beaucoup d'équipements : foreuses, plateaux à tiges, palettes."]},{"t":"sub","text":"Châssis et tiges"},{"t":"ul","items":[{"text":"Transporteur de tiges sur **chenilles**.","sub":["Les chenilles repositionnent le **RodBot** dans le puits."]},{"text":"Plateau à tiges amovible.","sub":["Pour tiges de **5 po** de diamètre.","Jusqu'à **6 pi** de long."]}]},{"t":"sub","text":"Alimentation et commande"},{"t":"ul","items":["Alimentation hydraulique et électrique par **câble** relié à une foreuse.",{"text":"Commande principale par radio-télécommande (**RRC**).","sub":["Elle déplace les tiges sans intervention manuelle.","Au forage et à la remontée."]}]},{"t":"warn","w":"note","text":"Le câble relie les ##arrêts d'urgence## (e-Stop) du RodBot et de la foreuse. Les deux circuits sont interconnectés."}],"figures":[]},"0-1":{"blocks":[{"t":"sub","text":"Trois modes de commande"},{"t":"ul","items":[{"text":"**Commande directe** (ou « commande manuelle par radio »).","sub":["Les manettes activent chaque joint rotatif un par un.","Comme un engin lourd classique."]},{"text":"**Commande linéaire** : déplace la tige/le tubage en X, Y ou Z d'un seul mouvement.","sub":["Le système actionne plusieurs distributeurs hydrauliques en même temps.","L'opérateur garde le contrôle des actionneurs de l'effecteur (poignet, rotation, inclinaison du grappin)."]},{"text":"**Contrôle de trajectoire** : le mât va seul d'une posture de départ à une posture finale définie.","sub":["Le RodBot calcule la trajectoire.","Pour minimiser le temps et éviter les collisions."]}]},{"t":"p","text":"En **mode trajectoire** :"},{"t":"ul","items":["L'opérateur définit et enregistre des points de destination et de cheminement.","Il manipule le mât par commande directe ou linéaire.","Les tiges se déplacent ensuite entre deux points d'un seul mouvement de manette.","Détails aux sections 11.6.3 (linéaire) et 11.6.4 (trajectoire)."]}],"figures":[]},"0-2":{"blocks":[{"t":"p","text":"L'illustration de la **page 7** identifie les principaux composants de la machine."},{"t":"sub","text":"Mât et grappin"},{"t":"ul","items":["Mât","Grappin","Piédestal"]},{"t":"sub","text":"Déplacement et stabilité"},{"t":"ul","items":["Chenilles","Vérins de stabilisation"]},{"t":"sub","text":"Tiges et rangement"},{"t":"ul","items":["Bac à tubes","Compartiment de rangement"]},{"t":"sub","text":"Commande et signaux"},{"t":"ul","items":["Boîtier de télécommande","Panneau électrique 24 V","Voyant lumineux"]}],"figures":[{"page":7,"cap":"Vue d'ensemble : composants principaux du RodBot LP (grappin, mât, piédestal, bac à tubes, chenilles, vérins de stabilisation, panneau électrique 24 V, voyant, boîtier de télécommande)."}]},"0-3":{"blocks":[{"t":"specs","rows":[["Poids à vide","5800 lb"],["Poids avec bac vide","6500 lb"],["Longueur","116 po"],["Largeur","60 po"],["Hauteur minimale","90 po"]]},{"t":"specs","rows":[["Charge max., levage à usage général","308 lb"],["Charge max., levage de tiges par électroaimant","120 lb"],["Diamètre des tiges","5 po"],["Longueur des tiges","6 pi"],["Capacité du bac","35 tiges"],["Portée verticale max. (tige verticale, depuis le sol)","159 po"],["Portée horizontale max. (depuis l'axe central)","119 po"]]}],"figures":[]},"0-4":{"blocks":[{"t":"specs","rows":[["Alimentation électrique","120 V c.a."],["Intensité maximale absorbée","4.5 A"],["Alimentation hydraulique","Depuis la pompe (non incluse) via l'ensemble de liaison (inclus)"],["Type de pompe requis","Cylindrée variable avec détection de charge"],["Plage de pression d'alimentation","2500-3000 psi"],["Débit maximal requis","80 L/min"],["Raccords hydrauliques","Pression (P), Réservoir (T), Drain de carter (T/Dr), Détection de charge (LS)"],["Longueur de l'ensemble de liaison","30 pi"]]},{"t":"specs","rows":[["Garde au sol","10 po"],["Transmission","Hydrostatique en circuit ouvert"],["Freins","À serrage par ressort, hydrostatiques"],["Pente max. de déplacement, bac vide","35° / 70 %"],["Pente max. de déplacement, bac plein","28° / 53 %"],["Pente max., manipulation des tiges","15° / 27 %"],["Longueur des chenilles","71 po"],["Écartement des chenilles","46 po"],["Largeur des chenilles","12 po"],["Vitesse max. de déplacement lent","2.8 km/h"],["Course des stabilisateurs","10.5 po"]]}],"figures":[]},"1-0":{"blocks":[{"t":"p","text":"Ce chapitre de **sécurité** couvre deux ajouts :"},{"t":"ul","items":["L'ajout de la **télécommande radio**.","La mise en œuvre de la **planification de trajectoire**.","Les deux sur le manipulateur de tiges du mât."]},{"t":"sub","text":"Exigences opérateur"},{"t":"ul","items":["L'opérateur doit avoir lu et compris le **manuel d'utilisation**.","Il doit respecter les calendriers d'entretien recommandés."]},{"t":"sub","text":"Personnel formé"},{"t":"ul","items":[{"text":"Le **Rod Handler** ne doit être utilisé, entretenu et réparé que par du ##personnel formé##.","sub":["Ce personnel doit connaître l'équipement et ses dangers.","Le personnel doit respecter les règles de sécurité et de santé, générales et locales."]}]},{"t":"warn","w":"note","text":"Le fabricant n'est pas responsable en cas d'##utilisation inappropriée##. Ni de modification arbitraire de l'équipement."}],"figures":[]},"1-1":{"blocks":[{"t":"specs","rows":[["DANGER","Situation mettant la vie en danger : doit impérativement être évitée."],["AVERTISSEMENT","Information d'une importance cruciale pour la sécurité."],["ATTENTION","Information visant à prévenir tout risque de blessure et/ou de dommage matériel."]]},{"t":"warn","w":"note","text":"Les procédures du manuel ne dispensent pas l'opérateur de ##rester prudent##."},{"t":"warn","w":"note","text":"Il doit aussi respecter la réglementation régionale et les règles du site et de l'entreprise."}],"figures":[{"page":10,"cap":"Pictogrammes de sécurité du manuel : DANGER, AVERTISSEMENT et ATTENTION."}]},"1-2":{"blocks":[{"t":"sub","text":"##Avant## d'utiliser"},{"t":"ul","items":["N'utiliser le système robotisé qu'après une ##formation complète## et une habilitation en règle.","##Toujours## lire et comprendre toutes les étiquettes avant utilisation."]},{"t":"sub","text":"État de l'opérateur"},{"t":"ul","items":["N'utiliser l'équipement qu'en bonne condition physique et mentale.","##Jamais sous l'influence d'alcool ou de drogues##."]},{"t":"sub","text":"Protections et entretien"},{"t":"ul","items":["##Ne jamais## retirer les protections et capots de sécurité quand le système est sous tension.","Nettoyer les déversements et fuites d'huile avant la mise en service.","Résoudre tout dysfonctionnement avant toute remise en service.","N'utiliser que des pièces de rechange identiques ou équivalentes aux pièces d'origine."]},{"t":"warn","w":"danger","text":"##Fluides sous pression## : une fuite d'huile haute pression sur la peau peut provoquer une injection sous-cutanée."},{"t":"warn","w":"danger","text":"En cas de blessure, ##contacter immédiatement les urgences médicales##."},{"t":"warn","w":"danger","text":"Voir un médecin habitué à ce type de blessure. Risque de gangrène ou de réactions allergiques graves."},{"t":"warn","w":"warn","text":"En extérieur, ##ne pas utiliser## le système par orage ou par vents supérieurs à **65 km/h**."},{"t":"warn","w":"warn","text":"Ne pas l'utiliser si la commande signale une erreur ou fonctionne mal."},{"t":"warn","w":"note","text":"N'entreprendre ##aucun entretien ni réparation## sans autorisation ni qualification appropriée."},{"t":"warn","w":"note","text":"D'abord lire et comprendre les consignes de sécurité du fabricant."},{"t":"warn","w":"note","text":"Vérifier la réglementation locale et celle de la mine."}],"figures":[{"page":11,"cap":"Icônes des premières étapes, pratique sécuritaire de pleine conscience."}]},"1-3":{"blocks":[{"t":"p","text":"La machine a **quatre** emplacements d'##arrêt d'urgence##."},{"t":"p","text":"En activer un stoppe aussitôt tout mouvement de l'appareil de forage."},{"t":"specs","rows":[["Panneau de commande basse tension","Immédiatement sous l'IHM à écran tactile"],["Télécommande radio","Au centre, en bas"],["Châssis du RodBot","Coin inférieur avant droit du châssis"],["Commandes manuelles","À l'arrière, près des leviers hydrauliques de commande du mât"]]},{"t":"warn","w":"warn","text":"Le signal d'##arrêt d'urgence## peut être couplé à l'appareil de forage principal."},{"t":"warn","w":"warn","text":"Alors, un arrêt d'urgence sur une machine déclenche l'arrêt sur les deux."}],"figures":[]},"2-0":{"blocks":[{"t":"p","text":"Le **mât télescopique** (bras robotisé) a plusieurs actionneurs de joint rotatif (poignet)."},{"t":"p","text":"Chaque joint a un numéro (**J…**) et un nom. Voir le schéma **page 13**."},{"t":"sub","text":"Base et bras"},{"t":"ul","items":["**TÉLESCOPE**","**PIVOTEMENT (SLEW)**","**ARTICULATION (ÉPAULE)**"]},{"t":"sub","text":"Poignet et grappin"},{"t":"ul","items":["**JOINT ROTATIF (POIGNET)**","**ROTATION**","**INCLINAISON**","**GRAPPIN (PINCE)**"]},{"t":"warn","w":"note","text":"Exemple : la fonction **PIVOTEMENT (SLEW)** = **J1** (« pivotement 1 »)."}],"figures":[{"page":13,"cap":"Schéma des segments du mât et noms des fonctions"}]},"2-1":{"blocks":[{"t":"p","text":"L'interrupteur de **commande par l'opérateur** est sur le panneau basse tension."},{"t":"p","text":"Il décide si le système robotisé accepte les ordres de la **télécommande radio**."},{"t":"specs","rows":[["Position CONTRÔLE À DISTANCE (REMOTE)","La télécommande radio est reliée au système robotisé et peut le piloter"],["Position LOCAL","Les ordres de la télécommande radio sont ignorés ; l'icône « No Radio » s'affiche"]]},{"t":"sub","text":"Commande et ##sécurité##"},{"t":"ul","items":["**Commande par l'opérateur**","**Bouton de réinitialisation de sécurité**","##Arrêt d'urgence##"]},{"t":"sub","text":"Modules internes"},{"t":"ul","items":["**Panneau de commande principal HMI** (Interface homme-machine)","**PPU** (Module de planification de trajectoire)","**Récepteur radio**"]},{"t":"warn","w":"warn","text":"Pour piloter par radio, l'interrupteur ##DOIT## être sur **CONTRÔLE À DISTANCE (REMOTE)**."},{"t":"warn","w":"warn","text":"En **LOCAL**, aucun ordre radio n'est exécuté."}],"figures":[{"page":14,"cap":"Vue intérieure du panneau de commande principal"}]},"2-2":{"blocks":[{"t":"p","text":"Le **bouton de réinitialisation de sécurité** active le **circuit de sécurité** du robot."},{"t":"steps","items":["Au démarrage : appuyer pour établir (mettre en place) le **circuit de sécurité**.","Après un ##arrêt d'urgence## réinitialisé : appuyer de nouveau pour réactiver le circuit."]}],"figures":[]},"2-3":{"blocks":[{"t":"p","text":"L'**écran tactile du panneau principal** (HMI/IHM, Interface Homme-Machine) montre les infos de commande."},{"t":"p","text":"L'opérateur peut y modifier certains paramètres."},{"t":"ul","items":["Indicateur : interrupteur de commande par l'opérateur sur « **LOCAL** »","Icône « Émetteur-récepteur radio non activé (**No Radio**) »"]},{"t":"warn","w":"note","text":"Voir **section 7** du manuel pour plus d'informations sur cet écran."}],"figures":[{"page":15,"cap":"Écran du panneau principal : indicateur mode LOCAL et icône No Radio"}]},"2-4":{"blocks":[{"t":"p","text":"**Deux valves** hydrauliques d'activation/isolation, **normalement fermées**."},{"t":"p","text":"Leur état dépend du **MODE** choisi par l'opérateur."},{"t":"p","text":"En cas d'erreur, le système de sécurité peut changer leur état."},{"t":"specs","rows":[["Nombre / type","2 valves, normalement fermées"],["Emplacement","Collecteur de raccordement des flexibles de liaison"],["Une valve","Régule le débit vers les chenilles et les vérins"],["L'autre valve","Régule le débit vers tous les autres éléments"],["Commande de l'état","Choix du MODE par l'opérateur ou système de sécurité (si erreur détectée)"]]},{"t":"warn","w":"warn","text":"En cas de **coupure de courant**, les deux valves se ferment par défaut."},{"t":"warn","w":"warn","text":"##Toute opération hydraulique devient alors impossible##."},{"t":"warn","w":"note","text":"Forçage manuel en position ouverte : tourner la valve dans le **sens antihoraire**."}],"figures":[{"page":16,"cap":"Soupape d'activation/d'isolation hydraulique du mât (normalement fermée ; se ferme en cas de coupure d'alimentation électrique)"}]},"3-0":{"blocks":[{"t":"p","text":"La **télécommande radio (RRC)** est conçue pour le RodBot."},{"t":"ul","items":["Résiste aux chocs et à la saleté.","Résiste à l'humidité et à l'eau.","Manettes **entièrement proportionnelles**.","Manettes rappelées à zéro par ressort."]},{"t":"specs","rows":[["Emplacement de la clé","Partie supérieure gauche de la télécommande"],["Rôle","La clé doit être présente pour que la télécommande fonctionne"],["Sans la clé","La télécommande ne s'allume pas"],["Retrait en cours de fonctionnement","Rupture de la liaison RRC ↔ récepteur et déclenchement d'un arrêt"]]},{"t":"warn","w":"warn","text":"##Ne retirez jamais## la **clé physique** quand la machine fonctionne."},{"t":"warn","w":"warn","text":"La liaison RRC ↔ récepteur se rompt et un arrêt se déclenche."}],"figures":[{"page":17,"cap":"Vue d'ensemble de la télécommande radio (RRC)"}]},"3-1":{"blocks":[{"t":"steps","items":["Mettre **OPERATOR CONTROL** (panneau électrique) sur **À DISTANCE (REMOTE)**.","Sinon, aucun message de mouvement n'est reconnu.","Appuyer sur le bouton **ON**, côté gauche de la télécommande.","Vérifier que le voyant DEL, en bas à gauche, passe au **vert** (état « ON »)."]},{"t":"p","text":"Pour désactiver la télécommande : appuyer sur son bouton d'##arrêt d'urgence##."},{"t":"p","text":"Le réinitialiser en tournant la **tête rouge en forme de champignon**."},{"t":"warn","w":"warn","text":"Appuyer sur l'##arrêt d'urgence## de la télécommande arrête la foreuse."},{"t":"warn","w":"warn","text":"Exception : si le sélecteur de mode est réglé sur **LOCAL**."},{"t":"warn","w":"note","text":"La télécommande peut s'allumer avec **OPERATOR CONTROL** sur **LOCAL**."},{"t":"warn","w":"note","text":"Mais le système ignore alors ses messages de mouvement du RodBot."}],"figures":[{"page":18,"cap":"Bouton MARCHE (ON) et bouton d'arrêt d'urgence de la télécommande"}]},"3-2":{"blocks":[{"t":"p","text":"L'##arrêt d'urgence## de la télécommande sans fil commande un **relais** sur le RodBot."},{"t":"p","text":"Ce relais est monté en série avec les autres arrêts d'urgence."},{"t":"p","text":"Cela inclut ceux du RodBot et de la foreuse mère (reliée électriquement)."},{"t":"p","text":"Télécommande activée et **OPERATOR CONTROL** sur **REMOTE** :"},{"t":"p","text":"Appuyer sur l'##arrêt d'urgence## arrête le RodBot et la foreuse mère."},{"t":"p","text":"C'est comme n'importe quel arrêt d'urgence câblé du RodBot ou de la foreuse."},{"t":"warn","w":"danger","text":"En mode **LOCAL**, la communication radio est désactivée."},{"t":"warn","w":"danger","text":"Le bouton d'arrêt d'urgence de la télécommande ##NE fonctionne PAS##."},{"t":"warn","w":"danger","text":"##Ne comptez jamais## sur l'arrêt d'urgence de la RRC en mode LOCAL."},{"t":"warn","w":"note","text":"Désactiver sans couper le moteur : mettre **OPERATOR CONTROL** sur **LOCAL**."},{"t":"warn","w":"note","text":"Puis désactiver via son bouton d'arrêt d'urgence."},{"t":"warn","w":"note","text":"Utile pour changer une batterie faible ou économiser la batterie."}],"figures":[]},"3-3":{"blocks":[{"t":"p","text":"Les modes **Rapide (Rabbit)** / **Lent (Turtle)** appliquent un facteur d'échelle."},{"t":"p","text":"Il s'applique à toutes les articulations."},{"t":"p","text":"Cela vaut dans les modes DIRECT, LINÉAIRE et TRAJECTOIRE."},{"t":"specs","rows":[["Mode Rapide (Rabbit)","Vitesse maximale définie dans le menu Points de consigne des valves (section 8.5)"],["Mode Lent (Turtle)","Vitesse de chaque articulation limitée à 50 % (réduite de moitié)"],["Exception","Le grappin (pince) n'est pas ralenti par le mode Lent"]]}],"figures":[{"page":19,"cap":"Sélecteur Rapide (Rabbit)/Lent (Turtle) et contrôle de limite de la soupape hydraulique directionnelle"}]},"3-4":{"blocks":[{"t":"p","text":"La télécommande a un **interrupteur d'inclinaison**."},{"t":"p","text":"Il détecte une urgence opérateur (télécommande inclinée ou tombée)."},{"t":"ul","items":["Déclenchement : le RodBot passe en ##arrêt de sécurité##, l'alimentation hydraulique est coupée.","Différence avec le bouton rouge : l'arrêt d'urgence câblé de la foreuse n'est ##PAS## déclenché.","Récupération : remettre la télécommande à l'horizontale stable.","Ne toucher aucun joystick.","Le système sort seul de l'arrêt de sécurité et passe en **veille**."]},{"t":"warn","w":"note","text":"**Inspection quotidienne** : vérifier l'interrupteur d'inclinaison de la télécommande à chaque début de quart."}],"figures":[]},"3-5":{"blocks":[{"t":"p","text":"Un **voyant ambre** sur le dessus du RodBot indique l'état du fonctionnement par télécommande radio."},{"t":"specs","rows":[["Allumé fixe","RodBot en mode CONTRÔLE PAR L'OPÉRATEUR : À DISTANCE"],["Éteint","RodBot en mode CONTRÔLE PAR L'OPÉRATEUR : LOCAL"],["Clignotant","Mât en mode TRAJECTOIRE, ou machine se déplaçant en mode RALENTI"]]}],"figures":[]},"3-6":{"blocks":[{"t":"p","text":"La **section 6.7** décrit les commandes des manettes pour chaque mode du LP RodBot."},{"t":"p","text":"La télécommande a trois manettes proportionnelles : **JS1**, **JS2** et **JS3**."},{"t":"sub","text":"Fonctions des manettes"},{"t":"ul","items":["**JS1** : contrôle de l'aimant (une fonction est libre, sans affectation)","Commande de l'avertisseur sonore (klaxon) et du gyrophare","Activation du **grappin (pince)**","Sélecteur **Rapide (Rabbit)** / **Lent (Turtle)**"]},{"t":"sub","text":"Sélection de modes"},{"t":"ul","items":[{"text":"Boutons de sélection de modes :","sub":["**Veille** (attente), **Direct** et **Linéaire**.","**MARCHE**, stabilisateurs et balayage."]},"Activation de la **trajectoire** ; Aide, Attendre, Commencer"]},{"t":"sub","text":"Écran et ##sécurité##"},{"t":"ul","items":["Voyant d'état ; témoins d'état et de batterie faible","Réglage de la luminosité de l'écran ; feux de travail (Work Lights)","##Arrêt d'urgence##"]},{"t":"warn","w":"note","text":"En mode **Lent**, la vitesse des actionneurs est réduite de moitié (**50 %**), sauf pour le grappin (pince)."}],"figures":[{"page":21,"cap":"Disposition des manettes JS1/JS2/JS3, boutons et interrupteurs de la télécommande"},{"page":22,"cap":"Détail des commandes de la télécommande radio"}]},"3-7":{"blocks":[{"t":"p","text":"L'**IHM** de la télécommande n'est **PAS** un écran tactile."},{"t":"p","text":"Les touches du clavier au-dessus de l'écran correspondent aux icônes affichées."},{"t":"p","text":"L'affichage change selon l'état du RodBot."},{"t":"p","text":"Il fournit les renseignements et options de commande pertinents."},{"t":"sub","text":"Position et trajectoire"},{"t":"ul","items":["Position de la foreuse et points de trajectoire (du râtelier à la foreuse)","**Positions du râtelier (Rack Positions)**"]},{"t":"sub","text":"État du système"},{"t":"ul","items":["Indicateur d'**ÉTAT** du système","Indicateur de l'état de charge de la batterie","État du **grappin** et état de l'**aimant**"]},{"t":"sub","text":"Mode et sélection"},{"t":"ul","items":["Type de mode de fonctionnement et indicateur de mode","Mode **Lent** / **Rapide**","L'encadré jaune indique l'élément sélectionné"]}],"figures":[{"page":23,"cap":"Écran (IHM) de la télécommande : correspondance touche / icône"},{"page":24,"cap":"Écran typique avec libellés des indicateurs d'état"}]},"3-8":{"blocks":[{"t":"p","text":"Le **niveau de charge de la batterie** s'affiche en haut à droite de l'écran de la télécommande."},{"t":"p","text":"Il apparaît aussi en bas de l'écran du panneau électrique."},{"t":"warn","w":"warn","text":"Si la télécommande perd le contact radio, la machine réagit comme à un ##arrêt d'urgence##."},{"t":"warn","w":"warn","text":"Même chose si elle s'éteint (**batterie à plat**) pendant le fonctionnement."},{"t":"warn","w":"warn","text":"Suivez la procédure ci-dessous pour changer la batterie sans déclencher l'arrêt."},{"t":"steps","items":["Placer le sélecteur COMMANDE PAR L'OPÉRATEUR sur **LOCAL**.","Mettre la télécommande sur **FERMER (OFF)**, via l'arrêt d'urgence de la télécommande ou de la RRC.","Remplacer la batterie.","Mettre la télécommande sur **MARCHE (ON)**.","Vérifier que l'icône de liaison radio, au bas du moniteur, est rétablie.","Remettre le sélecteur COMMANDE PAR L'OPÉRATEUR en position **À DISTANCE**."]},{"t":"p","text":"Chargement et rangement : le coffret sur la machine contient un **chargeur**."},{"t":"p","text":"Insérer la batterie dans le chargeur ; la charge démarre automatiquement."}],"figures":[{"page":44,"cap":"Chargeur et boîte de rangement de la télécommande radio"}]},"4-0":{"blocks":[{"t":"p","text":"Navigation par les icônes de la barre latérale gauche."},{"t":"sub","text":"NAVIGATION DU MENU"},{"t":"ul","items":["Appuyer sur une icône ouvre la page.","Appuyer de nouveau revient au menu principal."]},{"t":"sub","text":"BARRE DU HAUT"},{"t":"ul","items":[{"text":"La barre du haut affiche :","sub":["état de la connexion radio et puissance du signal","mode actif et état du contrôleur","versions logicielles **PLC** et **PPU**"]},"**PPU** = module de planification de trajectoire."]},{"t":"specs","rows":[["Connexion radio (vert)","Télécommande allumée et connectée"],["Connexion radio (rouge)","Télécommande non opérationnelle ou non autorisée"],["Indicateur contrôleur (vert)","Systèmes opérationnels"],["Indicateur contrôleur (rouge)","Système hors tension ou en ERREUR"],["Indicateur contrôleur (jaune)","Chargement en cours ou avertissement (non-erreur)"]]},{"t":"ul","items":["Appuyer sur un cercle d'état en surbrillance affiche le détail du sous-système.","Bouton « Paramètres système » : ouvre deux écrans (flèches en haut à droite).","Écran 1 : Facteur de courbe des manettes (section 8.4).","Écran 2 : Consigne de la valve de limitation (section 8.5)."]},{"t":"warn","w":"note","text":"Réservé à l'administrateur : étalonnage codeur, réglage des articulations (étalonnage PPU), écran de dérogation des valves."},{"t":"warn","w":"note","text":"Modifiables après **connexion administrateur** seulement. Accès réservé au technicien : manuel p.25."}],"figures":[{"page":25,"cap":"Écran d'accueil de l'IHM : barre supérieure d'état et boutons de navigation"}]},"4-1":{"blocks":[{"t":"p","text":"Le bouton « **ALARMES** » ouvre un tableau de diagnostic des anomalies du RodBot."},{"t":"p","text":"Il aide aussi à repérer les risques de sécurité. Causes de défauts possibles :"},{"t":"ul","items":["Défauts du réseau **CAN** au démarrage.","Articulations actionnées manuellement en mode télécommande.","Et d'autres causes."]},{"t":"ul","items":["Informations système","Avertissements système","Défauts système"]},{"t":"steps","items":["Consulter la colonne ÉTAT : un défaut résolu s'affiche Inactif.","Appuyer sur la ligne du défaut à effacer.","Appuyer sur « Effacer le défaut ».","Naviguer entre les pages avec les flèches en haut à droite."]},{"t":"warn","w":"warn","text":"##Effacer TOUS les défauts, actifs ET inactifs## avant de reprendre le fonctionnement."}],"figures":[{"page":27,"cap":"Exemple de l'écran ALARMES avec la colonne ÉTAT"}]},"4-2":{"blocks":[{"t":"p","text":"La vue **TRAJECTOIRE** est un modèle 3D en temps réel du mât et des obstacles."},{"t":"p","text":"Elle suit le logiciel de planification de trajectoire."},{"t":"p","text":"Accès par le bouton en bas à gauche de l'IHM."},{"t":"p","text":"Appuyer sur une des quatre vues l'agrandit ; un nouvel appui revient en arrière."},{"t":"ul","items":["Diagnostiquer les problèmes après une collision","Confirmer les lectures des codeurs","Diagnostiquer les problèmes de points de consigne"]},{"t":"p","text":"Objets perçus et évités lors de la planification :"},{"t":"ul","items":["Limite supérieure","Limite inférieure","Mât de forage","RodBot et son bac à tiges"]},{"t":"warn","w":"warn","text":"Le logiciel ##ne peut pas modéliser tous les objets## d'une mine souterraine."},{"t":"warn","w":"warn","text":"Objet à éviter absent de l'écran : ajouter des points de consigne pour le contourner."}],"figures":[{"page":28,"cap":"Vue TRAJECTOIRE : modèle 3D à quatre vues de la position du mât"},{"page":29,"cap":"Objets perçus et évités : limites supérieure/inférieure, mât et bac à tiges"}]},"4-3":{"blocks":[{"t":"p","text":"Étalonnage du codeur requis si un codeur est remplacé."},{"t":"p","text":"Ou s'il s'est desserré et a glissé sur l'arbre."},{"t":"p","text":"Amener l'articulation en position d'origine, puis réinitialiser le « point zéro »."},{"t":"p","text":"Sans cette réinitialisation, le codeur ne transmet pas l'orientation exacte."},{"t":"steps","items":["Allumer la machine et régler la télécommande en mode **DIRECT**.","Se connecter à l'IHM en mode administrateur (accès réservé au technicien).","Une articulation à la fois : l'amener à sa position de zéro indiquée.","Puis appuyer sur le bouton correspondant de l'IHM.","Vérifier que la valeur change au déplacement et passe à zéro après appui.","Vérifier ce retour à zéro à chaque retour à cette butée."]},{"t":"specs","rows":[["J1 : Pivotement","Butée mécanique antihoraire"],["J2 : Articulation (épaule)","Position haute maximale"],["J3 : Télescope","Entièrement rentré"],["J4 : Joint rotatif (poignet)","Position basse maximale"],["J5 : Rotation","Sens antihoraire jusqu'à la butée mécanique"],["J6 : Inclinaison","Vérin d'inclinaison entièrement déployé jusqu'à la butée mécanique"]]},{"t":"warn","w":"note","text":"Codeurs très précis : de légers écarts sont acceptables (la valeur peut afficher **1°** ou **359°** au lieu de 0°)."}],"figures":[{"page":31,"cap":"Positions de point zéro des articulations J1 à J6"}]},"4-4":{"blocks":[{"t":"specs","rows":[["Butées mécaniques","+/- 165° (course totale 330°)"],["Zone morte","30° directement à l'avant du système robotisé"],["Limites logicielles par défaut","10° et 320° (correspondent aux butées mécaniques)"]]},{"t":"p","text":"Les limites logicielles de l'écran d'étalonnage peuvent restreindre davantage le pivotement."},{"t":"p","text":"Pour les modifier : appuyer sur le nombre à l'écran, puis saisir la valeur voulue."},{"t":"warn","w":"note","text":"Le bouton **NEUTRALISER LES LIMITES D'ARTICULATION** (OVERRIDE JOINT LIMITS) autorise la course complète jusqu'aux butées."},{"t":"warn","w":"note","text":"Il se réinitialise dès que l'opérateur quitte l'écran d'étalonnage."}],"figures":[{"page":32,"cap":"Limites de rotation du pivotement et zone morte avant"}]},"4-5":{"blocks":[{"t":"p","text":"L'écran de contournement des valves s'affiche lors d'un défaut dans l'un des deux blocs."},{"t":"p","text":"##Réservé à un opérateur expérimenté##."},{"t":"p","text":"Pour basculer un contournement : appuyer sur la case « Contournement de défaut »."},{"t":"p","text":"Choisir la case à côté de l'articulation en défaut."},{"t":"ul","items":["Un défaut connu et non critique est survenu (p. ex. surchauffe).","Et l'opérateur doit absolument continuer à faire fonctionner la machine.","Défaut de valve sur le bloc Mode Ralenti et Stabilisateurs.","Et l'opérateur veut continuer en mode Bras, ou inversement."]},{"t":"warn","w":"danger","text":"Un bouton de contournement actionné fait ignorer ##TOUS les défauts de cette valve##."},{"t":"warn","w":"danger","text":"Dangereux si le défaut est critique, ou s'il évitait un danger imminent pour le personnel ou la machine."}],"figures":[{"page":33,"cap":"Écran de contournement des défauts de valve"}]},"4-6":{"blocks":[{"t":"p","text":"Les courbes de commande règlent la sensibilité des manettes."},{"t":"p","text":"Choix : contrôle fin, ou augmentation linéaire de la vitesse."},{"t":"p","text":"L'écran des limites de consigne plafonne la vitesse max. de chaque articulation."},{"t":"p","text":"Réglages réservés au technicien. Procédure complète : manuel p.34."},{"t":"specs","rows":[["Courbes de commande disponibles","0 à 3"],["Consigne de valve (maximum)","100 % (ne peut être dépassé)"],["Consigne de valve (minimum conseillé)","10 %"]]},{"t":"warn","w":"note","text":"Pour des vitesses supérieures à 100 % ou inférieures à 10 %, consulter **MEDATech** pour un tiroir de valve différent."}],"figures":[{"page":34,"cap":"Courbes de commande de la manette disponibles (0 à 3)"},{"page":35,"cap":"Écran des limites de consigne de valve par articulation"}]},"4-7":{"blocks":[{"t":"p","text":"Mât saccadé ou difficile à contrôler en mode **LINÉAIRE** ou Trajectoire ?"},{"t":"p","text":"Si l'étalonnage des codeurs est bon, faire un réglage des articulations (étalonnage PPU)."},{"t":"p","text":"Procédure détaillée réservée au technicien : manuel p.36."},{"t":"warn","w":"warn","text":"Pendant l'étalonnage, les articulations bougent ##sans commande directe de l'opérateur##."},{"t":"warn","w":"warn","text":"Elles ne détectent pas leur environnement. Rester vigilant pour éviter toute collision."},{"t":"warn","w":"warn","text":"Relâcher la manette arrête le mât à tout instant."},{"t":"warn","w":"warn","text":"Prévoir un espace suffisant. Sinon, déplacer la machine ou contacter MEDATech."}],"figures":[{"page":36,"cap":"Pose de réglage : position actuelle amenée à la position cible du mât"},{"page":39,"cap":"Écran d'étalonnage de la RRC : sélection actuelle et indicateur d'état"}]},"4-8":{"blocks":[{"t":"p","text":"Les **Diagnostics** indiquent l'état de divers éléments du système de commande."},{"t":"p","text":"Ils couvrent les communications des composants et du réseau."},{"t":"p","text":"Le bouton Diagnostics de l'écran d'accueil (HOME) ouvre le premier de trois écrans."},{"t":"p","text":"Ces écrans sont informatifs et non interactifs."},{"t":"p","text":"Seules les flèches de navigation en haut à droite sont actives."},{"t":"ul","items":["Diagnostic des Codeurs","Diagnostic des Valves","Diagnostic du Système Électrique"]},{"t":"warn","w":"note","text":"Interverrouillage : les valves perdent la communication hors de leur mode désigné (**RALENTI** ou **MÂT**)."},{"t":"warn","w":"note","text":"Les valves RALENTI apparaissent en défaut en mode MÂT, et inversement : c'est normal."},{"t":"warn","w":"note","text":"S'inquiéter seulement si une valve est en défaut dans son mode désigné."},{"t":"warn","w":"note","text":"Exemple : valve de PIVOTEMENT en défaut en mode MÂT."}],"figures":[{"page":41,"cap":"Premier écran de diagnostic accessible depuis HOME"}]},"5-0":{"blocks":[{"t":"p","text":"Le RodBot n'a aucune alimentation embarquée."},{"t":"p","text":"Il puise l'énergie électrique et hydraulique de sources externes fournies par l'opérateur."},{"t":"p","text":"Ces sources sont généralement montées sur la foreuse desservie."},{"t":"p","text":"Des câbles de liaison de **10 m** les relient."},{"t":"p","text":"Il peut ainsi se positionner librement par rapport à la foreuse."},{"t":"specs","rows":[["Câble 24 V CC (électronique embarquée)","réf. 279708"],["Câble d'arrêt d'urgence (liaison au circuit de la foreuse mère)","réf. 279729"],["Conditionnement des deux câbles","un seul ensemble sous gaine spirale"],["Raccordement au panneau de commande du RodBot","connecteurs 2 et 4"]]},{"t":"sub","text":"BOÎTIER DE RACCORDEMENT"},{"t":"ul","items":["Le boîtier de raccordement se monte sur la foreuse mère.","Il contient un bloc 120 V CA vers 24 V CC et un point de connexion pour le câble d'arrêt d'urgence."]},{"t":"sub","text":"OPTIONS DE CÂBLAGE"},{"t":"ul","items":["Circuits d'arrêt d'urgence RodBot et foreuse mère indépendants ?","Installer des cavaliers entre 8-1 et 7-2 selon le schéma électrique.","Foreuse mère fournissant un 24 V suffisant (section 1.1.3) :","Le bloc 24 V CC peut être omis ; raccorder la source directement à CONN1."]},{"t":"warn","w":"danger","text":"Installer le LP RodBot avec une barrière séparant l'opérateur de la machine et de la foreuse."},{"t":"warn","w":"danger","text":"Le pilotage se fait par télécommande radio, de part et d'autre de cette barrière."},{"t":"warn","w":"danger","text":"Mât télescopique (bras robotisé) qui bouge sans commande ? Appuyer aussitôt sur l'##arrêt d'urgence##, puis diagnostiquer."}],"figures":[{"page":45,"cap":"Montage du boîtier de raccordement et câbles de liaison 24 V CC / arrêt d'urgence"},{"page":46,"cap":"Schéma électrique du boîtier ; raccordement aux connecteurs 2 et 4 du panneau du RodBot"}]},"5-1":{"blocks":[{"t":"p","text":"Les fonctions hydrauliques sont entraînées par une pompe fournie par l'opérateur."},{"t":"p","text":"Généralement une pompe auxiliaire montée sur la foreuse mère."},{"t":"p","text":"Exigences de cette pompe source : section 1.1.3."},{"t":"ul","items":["Ligne de pression","Ligne de réservoir","Ligne de détection de charge (Load Sense)","Ligne de drainage du carter"]},{"t":"specs","rows":[["Ensemble de flexibles de liaison hydraulique","réf. 278232, flexibles de 10 m"],["Cloison de raccordement à raccords rapides","réf. 278240"],["Montage de la cloison","2 boulons de 3/8 po"],["Raccordement au RodBot","au bloc de distribution"]]},{"t":"warn","w":"warn","text":"Le remplacement de la pompe peut exiger un nouveau calibrage."},{"t":"warn","w":"warn","text":"Les modes **TRAJECTOIRE** et **LINÉAIRE** dépendent de valeurs réglées."},{"t":"warn","w":"warn","text":"Ces valeurs : latence, vitesse de rampe et pression max. de l'alimentation hydraulique."},{"t":"warn","w":"warn","text":"Mauvaises performances après un changement de pompe ? Contacter MEDATech Engineering pour un nouveau calibrage."}],"figures":[{"page":47,"cap":"Ensemble de flexibles de liaison : pression, réservoir, détection de charge, drainage du carter"},{"page":48,"cap":"Cloison de raccordement (2 boulons 3/8 po) et bloc de distribution du RodBot"}]},"5-2":{"blocks":[{"t":"steps","items":["Raccorder le RodBot par le câble de liaison au coffret d'alimentation de la foreuse principale.","Attendre que l'écran de l'IHM s'allume (environ **30 secondes**).","Vérifier que l'arrêt d'urgence de la télécommande est déverrouillé.","Appuyer sur le bouton vert de démarrage pour mettre sous tension.","Suivre les instructions de la télécommande ; l'associer par un nouvel appui sur le bouton vert.","Suivre la télécommande et l'IHM.","Appuyer sur le bouton de réarmement de sécurité du panneau de contrôle.","Attendre la fin de la séquence de démarrage ; l'IHM affiche l'état.","L'IHM passe ensuite en mode **VEILLE**.","En mode VEILLE, le système est prêt : sélectionner les modes par les boutons latéraux."]},{"t":"warn","w":"note","text":"L'écran de l'IHM met environ **30 secondes** à s'allumer."},{"t":"warn","w":"note","text":"La séquence se termine toujours en mode **VEILLE**, l'état prêt à l'emploi."}],"figures":[{"page":49,"cap":"Écran de l'IHM et séquence normale de mise en marche du RodBot"}]},"5-3":{"blocks":[{"t":"p","text":"Le mode se sélectionne depuis la télécommande radio (schéma section 6.7)."},{"t":"p","text":"Chaque mode restreint les fonctions accessibles : c'est une protection."},{"t":"p","text":"Seules les commandes du mode actif sont traitées."},{"t":"specs","rows":[["VEILLE (ou DÉMARRAGE)","mode de sécurité : aucune commande possible"],["RALENTI","commande des transmissions à chenilles uniquement"],["STABILISATEURS","commande des quatre vérins (stabilisateurs) uniquement"],["DIRECT","mode de commande du mât télescopique (bras robotisé)"],["LINÉAIRE","second mode de commande du mât télescopique"],["TRAJECTOIRE","déplacement autonome du bras selon des points de consigne prédéfinis"]]}],"figures":[{"page":50,"cap":"Sélection du mode de fonctionnement depuis la télécommande radio"}]},"5-4":{"blocks":[{"t":"p","text":"Toutes les fonctions peuvent être actionnées « manuellement »."},{"t":"p","text":"Déplacer les leviers des distributeurs hydrauliques."},{"t":"p","text":"Possible seulement si le sélecteur COMMANDE PAR L'OPÉRATEUR est sur **LOCAL**."},{"t":"warn","w":"warn","text":"Déplacer les leviers manuellement en mode **TÉLÉCOMMANDE** déclenche une erreur de valve."},{"t":"warn","w":"warn","text":"Le système passe en ##arrêt de protection## et coupe l'alimentation hydraulique."},{"t":"steps","items":["Passer la machine en mode LOCAL avec le commutateur du panneau de commande basse tension.","Appuyer sur le bouton de réarmement de sécurité pour annuler l'arrêt de protection."]},{"t":"ul","items":["Mise en marche possible si COMMANDE PAR L'OPÉRATEUR est sur LOCAL ; ou","si COMMANDE PAR L'OPÉRATEUR est sur À DISTANCE et que la télécommande radio est activée, arrêt d'urgence non enfoncé.","« REMISE DE SÉCURITÉ À ZÉRO » rétablit le circuit de sécurité et la communication radio."]}],"figures":[{"page":51,"cap":"Bloc de distributeurs « Chenilles et Vérins » et leviers manuels (entretien uniquement)"}]},"5-5":{"blocks":[{"t":"p","text":"Pour commander les chenilles depuis la télécommande, la régler sur **RALENTI**."},{"t":"p","text":"Passage en RALENTI impossible quand les mâchoires du grappin sont fermées."},{"t":"p","text":"Leviers manuels du bloc « Chenilles et Vérins » : entretien des chenilles seulement (section 13.6)."},{"t":"p","text":"Le RodBot est livré avec ces leviers déconnectés, rangés dans le compartiment arrière."},{"t":"ul","items":["Pivotement : orienté parallèlement au châssis de la machine","Levage : abaissé au maximum","Télescope : rétracté","Poignet : orienté vers le bas","Grappin : ouvert"]},{"t":"specs","rows":[["Vitesse maximale, rapide (Hi)","2,8 km/h"],["Vitesse maximale, lente (Lo)","1,5 km/h"],["Valve de dérivation manuelle","tête carrée de 0,55 po, à tourner de 90°"],["Passage en vitesse rapide (Hi)","rotation dans le sens des aiguilles d'une montre"],["Passage en vitesse lente (Lo)","rotation dans le sens inverse des aiguilles d'une montre"]]},{"t":"warn","w":"danger","text":"##Ne jamais déplacer le RodBot avec les valves manuelles##."},{"t":"warn","w":"danger","text":"Risque d'être heurté ou écrasé par le véhicule."},{"t":"warn","w":"danger","text":"Toujours déplacer la machine par télécommande radio."},{"t":"warn","w":"danger","text":"Avant tout déplacement : inspecter la trajectoire (personnel, obstacles, cavités, terrains instables)."},{"t":"warn","w":"danger","text":"Ne jamais se tenir devant ou à côté de la machine."},{"t":"warn","w":"danger","text":"Faire appel à un signaleur si la visibilité est obstruée."},{"t":"warn","w":"danger","text":"Garder les câbles de liaison hors de la trajectoire et du train de roulement : ne pas rouler dessus."}],"figures":[{"page":52,"cap":"Pose de transport du bras à adopter avant tout déplacement"},{"page":53,"cap":"Valve de dérivation manuelle Hi/Lo (carré de 0,55 po) du circuit des chenilles"}]},"5-6":{"blocks":[{"t":"p","text":"Le mode **VEILLE** permet de coupler la télécommande radio au récepteur."},{"t":"p","text":"Mais aucune commande de la télécommande n'est traitée."},{"t":"p","text":"C'est un mode sécurisé pour démarrer la télécommande avant les modes de travail."},{"t":"warn","w":"note","text":"En mode **VEILLE**, toutes les fonctions de sécurité restent fonctionnelles."},{"t":"warn","w":"note","text":"Cela inclut l'arrêt d'urgence, l'interrupteur d'inclinaison et les feux."}],"figures":[{"page":54,"cap":"Amplitude de mouvement du mât : système de positionnement à 6 degrés de mobilité"}]},"6-0":{"blocks":[{"t":"steps","items":["Fermer le grappin sur la tige : maintenir le bouton **vert GRAPPIN** et le commutateur GRAPPIN vers le bas, ensemble.","Ouvrir le grappin, libérer la tige : bouton **vert GRAPPIN** + levier GRAPPIN vers le haut, au moins **1 seconde**."]},{"t":"ul","items":["Le bouton **vert GRAPPIN** est une sécurité.","Le maintenir enfoncé pendant toute la manœuvre.","Sinon, la commande est ignorée."]},{"t":"warn","w":"danger","text":"##Ne jamais se placer sous le mât ou le grappin.##"},{"t":"warn","w":"danger","text":"Attention aux éléments suspendus en mine : câbles électriques, conduites d'eau et d'air, tuyaux de ventilation."},{"t":"warn","w":"danger","text":"Tout contact du mât télescopique peut causer des ##blessures graves, la mort## ou des dommages matériels."}],"figures":[{"page":55,"cap":"Commande du grappin : bouton vert et bascule actionnés simultanément"},{"page":56,"cap":"Façade de la télécommande : bouton vert GRAPPIN et bascule du grappin"}]},"6-1":{"blocks":[{"t":"p","text":"**DIRECT** ou **LINÉAIRE** : au choix. Le mode LINÉAIRE est le plus simple."},{"t":"ul","items":["En **DIRECT**, on commande chaque articulation (comme une grue, un ou plusieurs actionneurs).","En **LINÉAIRE**, on commande directement la position du grappin et de la tige."]},{"t":"specs","rows":[["Mode DIRECT","Commande articulation par articulation ; inscriptions BLANCHES sur la façade"],["Mode LINÉAIRE","Commande de l'effecteur en ligne droite ; étiquette ORANGE"],["Manette gauche (LINÉAIRE)","Haut/Bas et Gauche/Droite"],["Manette droite (LINÉAIRE)","Intérieur/Extérieur (Int./Ext.)"],["Amplitude du mât","6 degrés de mobilité ; pivotement 330° entre butées fixes (butée souple programmable)"]]},{"t":"ul","items":["AVANT / ARRIÈRE : le mât rapproche ou éloigne la tige de la base, en ligne droite (plan horizontal).","HAUT / BAS : le mât monte ou descend la tige en ligne droite, même plan.","GAUCHE / DROITE : pivote le mât sur son socle (PIVOTEMENT), comme en commande manuelle."]},{"t":"warn","w":"note","text":"En mode **LINÉAIRE**, le système gère tous les mouvements."},{"t":"warn","w":"note","text":"Le joint rotatif (poignet), la rotation et l'inclinaison restent commandables séparément."},{"t":"warn","w":"note","text":"Cela affine le positionnement de l'effecteur terminal."}],"figures":[{"page":57,"cap":"Contrôle LINÉAIRE (étiquette orange) et affectation des manettes gauche/droite"},{"page":54,"cap":"Amplitude de mouvement du mât à 6 degrés de mobilité"}]},"6-2":{"blocks":[{"t":"p","text":"Le mode **TRAJECTOIRE** déplace le mât par des points de consigne prédéfinis."},{"t":"ul","items":["Il évite les obstacles (navigation autonome).","Accessible après avoir activé LINÉAIRE ou DIRECT.","Points minimaux requis : FOREUSE, ATTENTE, LIMITE SUPÉRIEURE, LIMITE INFÉRIEURE."]},{"t":"steps","items":["Ouvrir l'écran de configuration : maintenir le bouton LINÉAIRE (ou DIRECT) **3 secondes**.","Saisir une tige de forage par son centre (± 2\" / 5 cm).","Positionner la tige dans le mât de forage ou le présentateur.","Avec le sélecteur de point, mettre **FOREUSE** en surbrillance (vert = point actif).","Pousser le commutateur « Enregistrer/Sélection » vers le haut. Un crochet apparaît dans la case de l'icône."]},{"t":"specs","rows":[["POINT DU PLATEAU 1","Par défaut au-dessus et au centre du bac à tiges ; modifiable"],["POINT DU PLATEAU 2","2e plateau (au sol/à l'écart), tiges plus longues ; ≥ 1' (30 cm) au-dessus du plateau, parallèle au stockage"],["ATTENTE","Point hors du mât ; dernier segment = trajectoire directe vers le train de tiges ; souvent 1 à 2 pieds de FOREUSE"],["FOREUSE","Point de libération et de transfert de la tige à la foreuse ; obligatoire"],["POINT 1 / POINT 2","Points de passage optionnels pour contourner un obstacle"]]},{"t":"p","text":"Exemple d'ordre : POINT DU PLATEAU → POINT 2 → POINT 1 → ATTENTE → FOREUSE."},{"t":"p","text":"Pour supprimer un point : le mettre en surbrillance, pousser « Enregistrer/Sélection » vers le bas."}],"figures":[{"page":59,"cap":"Sélecteurs de point de trajectoire et vue latérale d'un exemple de mode automatique"},{"page":61,"cap":"Vue de dessus : ajout d'un point de passage pour contourner une obstruction"}]},"6-3":{"blocks":[{"t":"p","text":"Les Limites Supérieure et Inférieure sont deux plans horizontaux définis par l'opérateur."},{"t":"sub","text":"RÔLE DES LIMITES"},{"t":"ul","items":["Elles empêchent le mât et la tige d'entrer dans certaines zones.","Le logiciel évite les collisions : conduites, toit / voûte, traverse, sol.","**Obligatoires** pour le mode TRAJECTOIRE."]},{"t":"sub","text":"ZONES D'EXCLUSION"},{"t":"ul","items":["Le RodBot lui-même","La foreuse","Le bac à tiges sur le RodBot","L'arrière (Back)","Le plancher (Floor)"]},{"t":"steps","items":["Vider le grappin avant de le descendre (recommandé).","Placer le grappin à la hauteur sous laquelle la tige et le RodBot ne doivent pas descendre.","Le plan est fixé par le centre de gravité du grappin.","En général à **30 cm** du sol, pousser l'interrupteur vers le haut pour fixer le plan inférieur.","Faire de même pour définir la Limite Supérieure."]},{"t":"warn","w":"note","text":"Tige détectée dans le grappin en mode TRAJECTOIRE : le planificateur suppose une tige de **1,8 m (6')**."},{"t":"warn","w":"note","text":"Il la suppose tenue à moins de **5 cm (2\")** de son centre."},{"t":"warn","w":"note","text":"Il génère un tracé où aucune partie du tuyau ne franchit un plan."},{"t":"warn","w":"note","text":"Le point FOREUSE fixe la position du mât de la foreuse. Le redéfinir à chaque nouvelle configuration."}],"figures":[{"page":62,"cap":"Zones d'exclusion préréglées et plans Limites supérieure/inférieure autour du mât"},{"page":63,"cap":"Centre de gravité du grappin et sélecteurs des plans limites supérieur/inférieur"}]},"6-4":{"blocks":[{"t":"warn","w":"danger","text":"Le RodBot n'a ##AUCUN système de vision##."},{"t":"warn","w":"danger","text":"Il ne détecte ni travailleurs, ni véhicules, ni équipements dans sa zone de travail."},{"t":"warn","w":"danger","text":"Limiter la circulation du personnel dans l'enveloppe de travail du mât."},{"t":"warn","w":"danger","text":"Installer barrières, délimitations et restrictions selon les politiques et procédures de la mine."},{"t":"warn","w":"warn","text":"Mouvement inattendu en mode automatique : appuyer immédiatement sur un ##bouton d'arrêt d'urgence##."},{"t":"warn","w":"warn","text":"Sur la télécommande ou le système robotisé."},{"t":"warn","w":"note","text":"Sécurité : en MODE RALENTI, si la machine se déplace, tous les points de consigne sont supprimés."},{"t":"warn","w":"note","text":"Exception : le POINT DU PLATEAU 1 est conservé."},{"t":"warn","w":"note","text":"Reconfigurer tous les autres depuis le nouvel emplacement."},{"t":"warn","w":"note","text":"Les réglages TRAJECTOIRE (points et limites) sont conservés même après mise hors tension et redémarrage."},{"t":"warn","w":"note","text":"À la fin de chaque tâche, supprimer les points et les limites supérieure et inférieure."},{"t":"warn","w":"note","text":"Le faire avant la configuration suivante."}],"figures":[{"page":62,"cap":"Enveloppe de travail du mât, aucune détection de présence dans la zone"}]},"6-5":{"blocks":[{"t":"steps","items":["Vérifier que tous les points requis et les limites supérieure et inférieure sont définis.","Avec le sélecteur, choisir la destination : FOREUSE ou ATTENTE, et POINT DU PLATEAU 1 ou 2.","Maintenir le bouton **jaune TRAJECTOIRE** et déplacer le levier droit : DROITE = PLATEAU, GAUCHE = FOREUSE.","Mouvement amorcé, relâcher le bouton jaune. Le mât poursuit tant que le levier reste actionné.","Relâcher les manettes arrête immédiatement le mât."]},{"t":"ul","items":["Relâcher le bouton jaune : la télécommande revient au mode LINÉAIRE ou DIRECT précédent.","On peut reprendre la commande manuelle à tout moment.","Réactiver TRAJECTOIRE (bouton jaune + levier droit) génère une nouvelle trajectoire sans collision.","Le mode ne fonctionne que si une trajectoire sans collision est possible."]},{"t":"warn","w":"note","text":"Directions du levier droit : DROITE = PLATEAU (RACK), GAUCHE = FOREUSE (DRILL)."}],"figures":[{"page":64,"cap":"Bouton jaune TRAJECTOIRE et levier droit pour lancer le déplacement autonome"},{"page":65,"cap":"Mode linéaire sélectionné : déplacement de la tige vers la FOREUSE ou le PLATEAU"}]},"6-6":{"blocks":[{"t":"p","text":"Le châssis a des éléments d'alignement pour bien positionner le bac à tiges."},{"t":"ul","items":["Le bac n'est **pas boulonné** ni bridé.","Il est maintenu uniquement par les dispositifs de retenue du châssis."]},{"t":"steps","items":["Engager les fourreaux à fourches du bac dans les profilés du châssis.","Positionner le bac entre les deux pattes de retenue du châssis.","Vérifier que le bac est bien retenu avant toute manutention."]},{"t":"warn","w":"note","text":"Le bac repose sur des retenues, il n'est pas boulonné."},{"t":"warn","w":"note","text":"Contrôler son engagement et son alignement avant de charger des tiges ou de déplacer la machine."}],"figures":[{"page":65,"cap":"Alignement du bac à tiges : fourreaux à fourches et pattes de retenue du châssis"}]},"7-0":{"blocks":[{"t":"p","text":"Le guide de dépannage (section 12) présente chaque symptôme : Défaillance / Cause possible / Vérification-Solution."},{"t":"sub","text":"ORDRE DE VÉRIFICATION"},{"t":"ul","items":["Commencer par les vérifications simples.","Mode de commande, arrêts d'urgence, batterie de la télécommande.","Ensuite seulement, l'hydraulique ou les codeurs."]},{"t":"specs","rows":[["Ne s'allume pas (mode À DISTANCE, télécommande ÉTEINTE)","Régler COMMANDE DE L'OPÉRATEUR sur LOCAL, activer la télécommande, appuyer sur RÉINITIALISATION DE SÉCURITÉ"],["Ne s'allume pas (arrêt d'urgence enfoncé)","Réinitialiser le(s) bouton(s) d'arrêt d'urgence, puis RÉINITIALISATION DE SÉCURITÉ"],["S'arrête en mode À DISTANCE (E-stop télécommande)","Réarmer l'E-stop, mettre le contournement de la télécommande sur MARCHE, RÉINITIALISATION DE SÉCURITÉ, redémarrer"],["Télécommande radio ne s'allume pas","Remplacer ou recharger la batterie ; vérifier la présence de la clé dans la télécommande"],["Fonctions du mât anormalement lentes","Passer du mode LENT (TURTLE) au mode RAPIDE (RABBIT)"],["Ne fonctionne pas en AUTO ou sur la pointe (TIP)","Vérifier les codeurs et leur câblage sur l'écran de l'IHM"],["Amplitude de rotation de la base trop limitée","Réinitialiser les butées logicielles (section 8.2) ; un écart de 2-3° avec les butées mécaniques est normal"],["Mât erratique ou trajectoire imprévisible","Vérifier codeurs, fixations et points zéro ; recalibrer le mât (section 8.6)"]]},{"t":"sub","text":"ACTIVATION DE L'UNITÉ"},{"t":"ul","items":["Activer la télécommande avant de régler le sélecteur sur À DISTANCE.","L'interrupteur d'inclinaison bloque l'activation si l'unité n'est pas tenue à l'horizontale."]},{"t":"sub","text":"MÂT IMMOBILE"},{"t":"ul","items":[{"text":"Mât immobile alors que tout semble prêt, vérifier :","sub":["les messages d'erreur","l'alimentation du connecteur de la bobine du clapet anti-retour","l'alimentation en huile / la conduite de détection de charge","le serrage des flexibles sur la foreuse","que le récepteur radio est sous tension"]}]},{"t":"warn","w":"note","text":"Pour toute assistance dépassant ce manuel, contacter l'équipe MEDATech : service@medatech.ca ou +1 (705) 443-8440, poste 4."}],"figures":[]},"7-1":{"blocks":[{"t":"p","text":"L'entretien régulier est essentiel au fonctionnement sûr, fiable et efficace du RodBot."},{"t":"ul","items":["Section réservée au personnel d'entretien qualifié.","Ce manuel n'est pas un guide de remise en état détaillé.","Pour toute tâche non couverte, contacter les services d'ingénierie de MEDATech."]},{"t":"warn","w":"danger","text":"##Avant tout entretien, y compris le lavage : mettre le RodBot hors tension.##"},{"t":"warn","w":"danger","text":"Débrancher l'alimentation électrique."},{"t":"warn","w":"danger","text":"Appliquer la procédure de ##cadenassage et d'étiquetage (LOTO)## sur tous les systèmes électriques."},{"t":"warn","w":"warn","text":"Certains dispositifs emmagasinent de l'##énergie hydraulique## (ex. vérins à valves d'équilibrage)."},{"t":"warn","w":"warn","text":"Cette énergie peut subsister même hors tension."},{"t":"ul","items":["Seul le personnel qualifié effectue réparations, dépannage ou entretien.","Respecter les pratiques de sécurité et les exigences locales pour tout travail en hauteur.","Faire l'entretien avec l'articulation (épaule) à l'horizontale ou plus bas.","Cela évite les travaux en hauteur inutiles."]}],"figures":[]},"7-2":{"blocks":[{"t":"p","text":"Nettoyer le RodBot, mais ##ne jamais asperger## directement les composants électriques."},{"t":"ul","items":["Concerne les codeurs rotatifs et le panneau électrique.","Même résistants à l'eau, leurs joints d'étanchéité sont fragiles.","Un jet direct de nettoyeur haute pression peut les endommager."]},{"t":"warn","w":"warn","text":"Le lavage compte comme un entretien : ##cadenasser et mettre l'équipement hors tension## avant de nettoyer."}],"figures":[]},"7-3":{"blocks":[{"t":"p","text":"Les inspections régulières protègent les opérateurs et détectent tôt des pannes coûteuses."},{"t":"p","text":"Signaler tout problème immédiatement à la direction et/ou au personnel d'entretien."},{"t":"specs","rows":[["Inspecter flexibles, conduites hydrauliques et câbles électriques (dommages/fuites)","Quotidienne"],["Tester le RodBot sans tige (déplacement conforme)","Quotidienne"],["Vérifier que tous les arrêts d'urgence sont fonctionnels","Hebdomadaire"],["Lubrifier les points d'articulation de la tringlerie et les couronnes d'orientation","Hebdomadaire"],["Ajuster les patins d'usure de l'articulation télescopique","Au besoin"],["Vérifier le niveau d'huile du réducteur d'entraînement des chenilles","Toutes les 500 h"],["Vidanger et remplacer l'huile du réducteur d'entraînement des chenilles","Toutes les 2000 h"],["Inspecter les chenilles","Hebdomadaire"],["Inspecter les structures mécaniques (déformation, fissures de soudure)","Hebdomadaire"]]}],"figures":[]},"7-4":{"blocks":[{"t":"specs","rows":[["Huile hydraulique","Classe de viscosité ISO 46"],["Graisse pour articulations mécaniques","EP2"],["Huile pour réducteur d'entraînement final","SAE 80W90"]]},{"t":"ul","items":["4 points de graissage sur la couronne d'orientation de la base","4 points de graissage sur la couronne d'orientation de rotation","2 points de graissage sur le vérin d'inclinaison"]},{"t":"steps","items":["Graisser l'articulation par les graisseurs de la couronne d'orientation.","Déplacer l'articulation d'environ 30 degrés.","Répéter sur toute la plage de mouvement pour lubrifier toute la couronne."]},{"t":"warn","w":"danger","text":"##Ne pas déplacer les articulations d'orientation## pendant qu'un technicien se trouve dans le rayon d'action de la machine."}],"figures":[{"page":73,"cap":"Points de graissage sur les couronnes d'orientation (graisseurs encerclés en vert)"}]},"7-5":{"blocks":[{"t":"p","text":"La glissière du télescope coulisse sur huit patins en plastique (pucks)."},{"t":"p","text":"Ces patins s'usent avec le temps."},{"t":"p","text":"Le réglage à la plaque de calibre et le remplacement sont des interventions de technicien."},{"t":"p","text":"**Intervention de technicien.** Voir manuel p.74-75."}],"figures":[{"page":74,"cap":"Patins d'usure du télescope et emplacement des vis de réglage"},{"page":75,"cap":"Ensemble plaque de fermeture (art. 1), plaque de poussée (art. 2) et patin (art. 3)"}]},"7-6":{"blocks":[{"t":"p","text":"Tension : le mou de la chenille doit mesurer entre **20 et 25 mm**."},{"t":"p","text":"Vérifier à la règle droite et au ruban à mesurer."},{"t":"p","text":"##Ne jamais laisser le mou dépasser 30 mm## et éviter toute tension excessive."},{"t":"steps","items":["Accéder à la valve de réglage de la chenille, derrière la plaque signalétique.","Pour tendre : injecter de la graisse dans le vérin au pistolet à graisse.","Pour détendre : dévisser lentement la valve pour libérer de la graisse."]},{"t":"specs","rows":[["Neuf","22 mm"],["25 % d'usure","18,5 mm"],["50 % d'usure","15 mm"],["75 % d'usure","11,5 mm"],["Limite d'usure (100 %)","8 mm"]]},{"t":"warn","w":"warn","text":"L'usure des patins de chenille est mesurée par la dimension « X » : ##remplacer la chenille dès que X est inférieure à 8 mm##."}],"figures":[{"page":75,"cap":"Vérification du mou de la chenille (20 à 25 mm) à la règle droite et au ruban"},{"page":76,"cap":"Mesure de l'usure du patin (dimension X) et embout de réglage de tension derrière la plaque signalétique"}]},"7-7":{"blocks":[{"t":"sub","text":"MÉTHODES DE DÉPLACEMENT"},{"t":"ul","items":["Déplacement autonome (tramming)","Remorquage au sol","Chariot élévateur ou chariot télescopique","Remorquage sur une remorque surbaissée"]},{"t":"sub","text":"AVANT DE DÉPLACER"},{"t":"ul","items":[{"text":"Avant tout déplacement, mettre le bras dans la posture prescrite.","sub":["La pente maximale est calculée pour cette posture.","Tout écart déplace le centre de gravité et réduit la stabilité."]}]},{"t":"specs","rows":[["Points d'ancrage du châssis","4 points (arrimage, remorquage, levage)"],["Points de levage du bac à tiges","4 points de 9/16 po de diamètre"],["Levage par fourches","Passages de fourches sur le côté du châssis et sur le bac à tiges"]]},{"t":"steps","items":["Désengager le frein SAHR et fixer solidement la machine au véhicule avant tout remorquage.","**Intervention de technicien.** Voir manuel p.78.","##Après le remorquage, réinstaller les bouchons du frein SAHR, sinon la machine n'a plus de freins.##"]},{"t":"warn","w":"danger","text":"##Toujours fixer solidement la machine avant de désengager les moyeux.##"},{"t":"warn","w":"danger","text":"Sinon, risque de mouvement incontrôlé et de blessures graves."},{"t":"warn","w":"danger","text":"##Réinstaller le frein après remorquage pour rétablir le freinage.##"},{"t":"warn","w":"danger","text":"Sans freins, la machine met en danger tout le personnel et les équipements de la zone."}],"figures":[{"page":77,"cap":"Posture du bras à adopter avant tout déplacement de la machine"},{"page":78,"cap":"Bouchon de désactivation du frein SAHR à retirer à la clé hexagonale M16"}]},"7-8":{"blocks":[{"t":"p","text":"Les annexes A à E couvrent des tâches de technicien."},{"t":"ul","items":["Connexion administrateur.","Réinitialisation et mise à jour de la PPU.","Appairage de la télécommande AUTEC.","Enregistreur de données."]},{"t":"p","text":"**Intervention de technicien.** Voir manuel p.81-86. Pour toute manipulation, contacter MEDATech."}],"figures":[{"page":81,"cap":"Bouton d'alimentation de la PPU à maintenir enfoncé 5 s pour la réinitialisation"},{"page":86,"cap":"Écran d'accueil de l'IHM affichant la version logicielle de la PPU"}]}}/*__END_ENRICH__*/;

class Component extends DCLogic {
  MANUAL = "manuel-operateur.pdf";
  // PDF anglais (OM 10631, 82 pages) : ajouté au dépôt.
  MANUAL_EN = "manual-en.pdf";
  RA = "evaluation-risques.pdf";

  MODULES = [
    {
      num:"01", title:"Découvrir le RodBot LP", short:"Présentation", chapters:"1", pages:"6-9",
      subtitle:"Ce qu'est la machine, ses composants, ses trois modes de commande du mât et ses caractéristiques techniques.",
      intro:"Le RodBot LP de Borterra élimine la manutention manuelle des tiges de forage, l'une des principales causes d'accidents liés aux foreuses. Ce module présente la machine, ses composants et ses capacités.",
      sections:[
        { title:"Qu'est-ce que le RodBot LP ?", page:6, blocks:[
          {t:"p", text:"Système robotisé hydraulique de manutention de tiges de forage, conçu pour charger et décharger les tiges sans heurts. Il s'adapte à une large gamme d'équipements : foreuses, plateaux à tiges et palettes."},
          {t:"p", text:"Monté sur chenilles, il transporte un plateau à tiges amovible et se repositionne à l'intérieur du puits. L'alimentation électrique et hydraulique provient d'une connexion câblée à la foreuse ; ce lien relie aussi les circuits d'arrêt d'urgence des deux machines."},
          {t:"warn", w:"note", text:"La machine est principalement commandée par Radio Télécommande (RRC) : l'opérateur reste à distance des tiges."} ]},
        { title:"Les trois modes de commande du mât", page:6, blocks:[
          {t:"ul", items:[
            "DIRECT (« manuel par télécommande ») : chaque mouvement d'articulation est activé individuellement à la manette, comme sur une machinerie lourde conventionnelle.",
            "LINÉAIRE : la tige se déplace en ligne droite (X, Y ou Z) d'un simple mouvement de manette ; le système actionne simultanément plusieurs distributeurs hydrauliques. L'opérateur garde le contrôle individuel du poignet, de la rotation et de l'inclinaison.",
            "TRAJECTOIRE : le mât se déplace automatiquement entre des points enregistrés par l'opérateur, en suivant une trajectoire calculée qui minimise le temps et évite les collisions."] } ]},
        { title:"Principaux composants", page:7, blocks:[
          {t:"ul", items:["Mât télescopique (bras robotisé) sur piédestal","Grappin (pince) avec électroaimant","Bac à tubes amovible","Chenilles et vérins de stabilisation","Panneau électrique 24 V avec IHM tactile","Boîtier de télécommande radio et compartiment de rangement","Voyant lumineux ambre"] } ]},
        { title:"Dimensions & manipulation des tiges", page:8, blocks:[
          {t:"specs", rows:[["Poids à vide","5 800 lb"],["Poids avec bac vide","6 500 lb"],["Longueur × largeur","116 × 60 po"],["Hauteur minimale","90 po"],["Charge max (usage général)","308 lb"],["Charge max (électroaimant)","120 lb"],["Tiges","Ø 5 po × 6 pi"],["Capacité du bac","35 tiges"],["Portée verticale max (du sol)","159 po"],["Portée horizontale max (de l'axe)","119 po"]] } ]},
        { title:"Alimentation & porteur", page:8, blocks:[
          {t:"specs", rows:[["Électrique","120 V c.a. · 4,5 A max"],["Hydraulique","2 500-3 000 psi · 80 L/min"],["Pompe requise","Cylindrée variable, détection de charge"],["Ensemble de liaison","30 pi"],["Freins","Serrage par ressort (SAHR), hydrostatiques"],["Garde au sol","10 po"],["Pente max, bac vide","35° / 70 %"],["Pente max, bac plein","28° / 53 %"],["Pente max, manutention","15° / 27 %"],["Vitesse max","2,8 km/h"]] },
          {t:"warn", w:"warn", text:"Les pentes maximales sont calculées pour la pose de déplacement. Déplacer le mât hors de cette pose modifie le centre de gravité et réduit la stabilité."} ]}
      ],
      quiz:[
        { text:"Combien de tiges le bac du RodBot peut-il contenir ?", options:["20","35","50"], correct:1 },
        { text:"Quels sont les trois modes de commande du mât ?", options:["DIRECT, LINÉAIRE, TRAJECTOIRE","MANUEL, SEMI-AUTO, AUTO","LOCAL, REMOTE, VEILLE"], correct:0 },
        { text:"Quelle est la charge maximale en levage par électroaimant ?", options:["308 lb","120 lb","500 lb"], correct:1 },
        { text:"D'où provient l'énergie du RodBot ?", options:["D'un moteur diesel embarqué","De batteries embarquées","D'une connexion câblée à la foreuse (électrique + hydraulique)"], correct:2 }
      ]
    },
    {
      num:"02", title:"Sécurité avant tout", short:"Sécurité", chapters:"2", pages:"10-12",
      subtitle:"Consignes d'utilisation, pictogrammes du manuel, pratique de pleine conscience et les quatre arrêts d'urgence.",
      intro:"La liste des consignes couvre l'ajout de la télécommande radio et la planification de trajectoire. Seul un personnel formé et habilité peut mettre en service ou utiliser ce système.",
      sections:[
        { title:"Consignes d'utilisation", page:10, blocks:[
          {t:"ul", items:[
            "Le fabricant décline toute responsabilité en cas d'utilisation inappropriée ou de modifications arbitraires de l'équipement.",
            "L'opérateur doit avoir lu et compris le manuel et respecter les calendriers d'entretien recommandés.",
            "Utilisation, entretien et réparation réservés au personnel formé, conscient des dangers.",
            "Respecter les réglementations générales et locales en matière de santé et de sécurité."] } ]},
        { title:"Les pictogrammes du manuel", page:10, blocks:[
          {t:"ul", items:[
            "DANGER : signale une situation mettant la vie en danger ; ces situations doivent être évitées.",
            "AVERTISSEMENT : information d'une importance cruciale pour la sécurité.",
            "ATTENTION : prévention des risques de blessure et/ou de dommage matériel."] },
          {t:"warn", w:"warn", text:"Les procédures du manuel ne dispensent jamais de la prudence. Respectez la réglementation régionale et les règles spécifiques au site et à l'entreprise."} ]},
        { title:"Pratique sécuritaire de pleine conscience", page:11, blocks:[
          {t:"ul", items:[
            "N'utilisez le système que si vous êtes formé, habilité, en bonne condition physique et mentale, jamais sous l'influence d'alcool ou de drogues.",
            "Lisez et comprenez toutes les étiquettes avant utilisation.",
            "Ne retirez jamais les protections et capots de sécurité quand le système est sous tension.",
            "Il incombe à l'opérateur de connaître les conditions et la présence de personnel dans la zone de travail.",
            "N'intervenez en entretien/réparation que si vous êtes autorisé et qualifié ; pièces de rechange identiques ou équivalentes aux pièces d'origine.",
            "Résolvez tous les dysfonctionnements avant la remise en service ; n'utilisez pas la machine si une erreur est signalée dans le système de commande.",
            "En extérieur : n'utilisez pas le système en cas d'orage ou de vents violents (supérieurs à 65 km/h).",
            "Nettoyez les déversements ou fuites d'huile avant la mise en service."] },
          {t:"warn", w:"danger", text:"Fluides sous pression, risque d'injection sous-cutanée par fuite d'huile hydraulique haute pression. En cas de blessure : contactez IMMÉDIATEMENT les services médicaux d'urgence (risque de gangrène et de réactions graves)."} ]},
        { title:"Les quatre arrêts d'urgence", page:12, blocks:[
          {t:"p", text:"Quatre arrêts d'urgence interrompent immédiatement tout mouvement. Si le signal est couplé à la foreuse principale, l'activation d'un arrêt d'urgence sur l'une des machines déclenche l'arrêt des deux."},
          {t:"specs", rows:[["Panneau basse tension","Immédiatement sous l'IHM tactile"],["Télécommande radio","Au centre, en bas"],["Châssis du RodBot","Coin inférieur avant droit"],["Commandes manuelles","À l'arrière, près des leviers hydrauliques"]] } ]}
      ],
      quiz:[
        { text:"Qui est habilité à utiliser le RodBot ?", options:["Tout employé de la mine","Le personnel formé, habilité et apte","Toute personne accompagnée d'un superviseur"], correct:1 },
        { text:"Combien d'arrêts d'urgence équipent la machine ?", options:["2","3","4"], correct:2 },
        { text:"En cas de blessure par injection de fluide haute pression ?", options:["Appliquer un pansement et surveiller","Contacter immédiatement les urgences médicales","Rincer à l'eau et reprendre le travail"], correct:1 },
        { text:"À partir de quelle vitesse de vent l'utilisation en extérieur est-elle interdite ?", options:["45 km/h","65 km/h","90 km/h"], correct:1 }
      ]
    },
    {
      num:"03", title:"Composants & commandes de base", short:"Commandes", chapters:"3 : 5", pages:"13-16",
      subtitle:"Les segments du mât (J1-J6), l'interrupteur LOCAL/À DISTANCE, le bouton de réinitialisation de sécurité et les valves d'isolement.",
      intro:"Chaque actionneur du mât porte un numéro et un nom de référence. Le panneau de commande basse tension et les valves d'isolement hydraulique déterminent qui commande la machine, et quand rien ne peut bouger.",
      sections:[
        { title:"Les segments du mât (J1 : J6)", page:13, blocks:[
          {t:"specs", rows:[["J1","PIVOTEMENT (slew)"],["J2","ARTICULATION (épaule)"],["J3","TÉLESCOPE"],["J4","JOINT ROTATIF (poignet)"],["J5","ROTATION"],["J6","INCLINAISON"],["Effecteur","GRAPPIN (pince)"]] },
          {t:"p", text:"Exemple : la fonction PIVOTEMENT (SLEW) correspond à J1. Ces noms sont utilisés partout, écrans, diagnostics, calibrage."} ]},
        { title:"Interrupteur de commande LOCAL / À DISTANCE", page:14, blocks:[
          {t:"p", text:"Pour utiliser la télécommande radio, l'interrupteur de commande par l'opérateur (OPERATOR CONTROL) du panneau doit être en position À DISTANCE (REMOTE)."},
          {t:"warn", w:"note", text:"En mode LOCAL, les signaux de la télécommande sont ignorés et l'icône « No Radio » s'affiche sur l'IHM."} ]},
        { title:"Bouton de réinitialisation de sécurité", page:15, blocks:[
          {t:"p", text:"Il « met en place » le circuit de sécurité au démarrage du système, ou le réactive après qu'un arrêt d'urgence a été déclenché puis réinitialisé."} ]},
        { title:"Écran du panneau principal (IHM)", page:15, blocks:[
          {t:"p", text:"L'écran tactile affiche les informations du système de commande ; l'opérateur peut y modifier certains paramètres. Le détail des écrans est couvert au module 05."} ]},
        { title:"Valves d'isolement hydraulique", page:16, blocks:[
          {t:"p", text:"Deux valves d'activation/isolation normalement fermées sont intégrées au collecteur de liaison : l'une régule le débit vers les chenilles et vérins, l'autre vers tous les autres éléments. Leur état dépend du MODE choisi par l'opérateur, ou du système de sécurité s'il détecte une erreur."},
          {t:"warn", w:"warn", text:"En cas de coupure de courant, les deux valves se ferment par défaut : toute opération hydraulique devient impossible. Elles peuvent être forcées en position ouverte manuellement (sens antihoraire)."} ]}
      ],
      quiz:[
        { text:"À quoi correspond J1 ?", options:["Le TÉLESCOPE","Le PIVOTEMENT (slew)","L'INCLINAISON"], correct:1 },
        { text:"L'interrupteur est en mode LOCAL. Que fait la télécommande radio ?", options:["Elle fonctionne normalement","Ses signaux de mouvement sont ignorés","Elle ne commande que le grappin"], correct:1 },
        { text:"Que se passe-t-il pour les valves d'isolement en cas de coupure de courant ?", options:["Elles restent dans leur dernier état","Elles s'ouvrent pour purger la pression","Elles se ferment, plus aucune opération hydraulique"], correct:2 },
        { text:"À quoi sert le bouton de réinitialisation de sécurité ?", options:["À redémarrer l'IHM","À activer/réactiver le circuit de sécurité","À effacer les journaux de données"], correct:1 }
      ]
    },
    {
      num:"04", title:"La télécommande radio", short:"Télécommande", chapters:"6 · 10", pages:"17-24 · 44",
      subtitle:"Activation, clé physique, arrêt d'urgence, modes Rabbit/Turtle, interrupteur d'inclinaison, voyant, manettes, écran et batterie.",
      intro:"La RRC est conçue pour résister aux chocs, à la saleté et à l'eau. Manettes proportionnelles à rappel au zéro ; l'arrêt d'urgence fonctionne en série avec ceux du RodBot et de la foreuse mère.",
      sections:[
        { title:"Clé physique & interverrouillage", page:17, blocks:[
          {t:"warn", w:"note", text:"Une clé physique est installée en haut à gauche de la télécommande. Sans elle, la RRC ne s'allume pas. La retirer en cours de fonctionnement rompt la connexion avec le récepteur et déclenche un arrêt."} ]},
        { title:"Activer / désactiver la télécommande", page:17, blocks:[
          {t:"ul", items:[
            "Prérequis : interrupteur du panneau sur À DISTANCE (REMOTE) : sinon aucun message de mouvement n'est reconnu.",
            "MARCHE : bouton ON sur le côté gauche ; le voyant DEL en bas à gauche de l'écran devient vert.",
            "ARRÊT : appuyer sur l'arrêt d'urgence de la télécommande, puis le réinitialiser en tournant la tête rouge en champignon."] },
          {t:"warn", w:"note", text:"Pour éteindre la RRC sans arrêter la foreuse (changement de batterie, économie d'énergie) : passer d'abord l'interrupteur du panneau en LOCAL, puis appuyer sur l'e-stop de la télécommande."} ]},
        { title:"Arrêt d'urgence de la RRC", page:18, blocks:[
          {t:"p", text:"L'e-stop de la télécommande commande un relais monté en série avec les autres arrêts d'urgence du RodBot et de la foreuse mère. En mode REMOTE, une pression arrête les deux machines, même effet qu'un e-stop câblé."},
          {t:"warn", w:"warn", text:"En mode LOCAL, le bouton d'arrêt d'urgence de la télécommande ne fonctionne PAS."} ]},
        { title:"Modes Rapide (Rabbit) / Lent (Turtle)", page:19, blocks:[
          {t:"p", text:"Applique un facteur d'échelle à toutes les articulations dans les modes DIRECT, LINÉAIRE et TRAJECTOIRE. Rabbit = vitesse maximale définie dans les consignes de valve ; Turtle = vitesse de chaque articulation réduite de 50 % : sauf le grappin."} ]},
        { title:"Interrupteur d'inclinaison", page:19, blocks:[
          {t:"p", text:"Si la télécommande est inclinée ou tombe (opérateur en difficulté), le RodBot passe en arrêt de sécurité : alimentation hydraulique coupée, sans déclencher l'e-stop de la foreuse câblée. Dès que la RRC est remise à l'horizontale, manettes au neutre, le système repasse automatiquement en veille."},
          {t:"warn", w:"warn", text:"Inspection quotidienne : vérifiez le bon fonctionnement de l'interrupteur d'inclinaison au début de chaque quart de travail."} ]},
        { title:"Voyant lumineux ambre", page:20, blocks:[
          {t:"ul", items:["ALLUMÉ (fixe) : mode CONTRÔLE À DISTANCE actif.","CLIGNOTANT : mât en mode TRAJECTOIRE ou machine en déplacement (RALENTI).","ÉTEINT : mode LOCAL."] } ]},
        { title:"Manettes, boutons & interrupteurs", page:21, blocks:[
          {t:"ul", items:[
            "3 manettes proportionnelles (JS1, JS2, JS3) à ressort de rappel.",
            "Boutons de sélection de modes : VEILLE, DIRECT, LINÉAIRE / MARCHE, STABILISATEURS et balayage.",
            "Bouton jaune : activation de la TRAJECTOIRE. Bouton vert : activation du grappin.",
            "Contrôle de l'électroaimant, klaxon + gyrophare, Rabbit/Turtle, luminosité d'écran, feux de travail, aide.",
            "Arrêt d'urgence au centre, en bas. Témoins d'état et de batterie faible."] } ]},
        { title:"Écran de la télécommande", page:23, blocks:[
          {t:"p", text:"Écran non tactile : les touches du clavier au-dessus correspondent aux icônes affichées. L'affichage s'adapte à l'état du RodBot : indicateur d'ÉTAT système, type de mode, état du grappin et de l'aimant, batterie, mode Lent/Rapide, positions du plateau et points de trajectoire. L'encadré jaune signale l'élément sélectionné."} ]},
        { title:"Batterie : remplacement & chargement", page:44, blocks:[
          {t:"warn", w:"warn", text:"Si la RRC s'éteint ou perd le contact en fonctionnement (batterie à plat), la machine traite l'événement comme un arrêt d'urgence."},
          {t:"steps", items:[
            "Placez le sélecteur de COMMANDE PAR L'OPÉRATEUR sur LOCAL.",
            "Mettez la télécommande sur OFF (e-stop de la RRC).",
            "Remplacez la batterie.",
            "Remettez la télécommande sur MARCHE (ON).",
            "Vérifiez que l'icône de liaison radio est rétablie en bas du moniteur.",
            "Remettez le sélecteur en position À DISTANCE."] },
          {t:"p", text:"Le coffret de rangement sur la machine contient le chargeur : insérez la batterie, la charge démarre automatiquement."} ]}
      ],
      quiz:[
        { text:"Que se passe-t-il si on retire la clé physique pendant le fonctionnement ?", options:["Rien, la clé ne sert qu'au démarrage","La connexion est rompue et un arrêt est déclenché","La machine passe en mode LOCAL"], correct:1 },
        { text:"Le mode Turtle (lent) réduit la vitesse des articulations de…", options:["25 %","50 % : sauf le grappin","75 %, grappin compris"], correct:1 },
        { text:"La télécommande tombe au sol. Que fait le RodBot ?", options:["Il continue son mouvement","Il passe en arrêt de sécurité : hydraulique coupée","Il déclenche l'e-stop de la foreuse câblée"], correct:1 },
        { text:"Le voyant ambre clignote. Cela signifie…", options:["Mode LOCAL actif","Batterie faible de la RRC","Mât en TRAJECTOIRE ou déplacement en RALENTI"], correct:2 },
        { text:"Pour remplacer la batterie sans déclencher d'arrêt d'urgence, la première étape est…", options:["Passer le sélecteur du panneau sur LOCAL","Appuyer sur l'e-stop de la RRC directement","Débrancher le câble de liaison"], correct:0 }
      ]
    },
    {
      num:"05", title:"IHM, réglages & diagnostics", short:"IHM & réglages", chapters:"7 : 9", pages:"25-43",
      subtitle:"Écrans de l'IHM, alarmes, vue 3D, calibrage des codeurs, limites de pivotement, contournements, courbes de manettes et réglage PPU.",
      intro:"L'IHM du panneau électrique donne accès à l'état du système, aux alarmes et aux paramètres d'étalonnage. Certains réglages exigent la connexion administrateur et une vigilance particulière.",
      sections:[
        { title:"Écran d'accueil de l'IHM", page:25, blocks:[
          {t:"ul", items:[
            "État de la connexion radio : vert = connectée, rouge = non opérationnelle ou non autorisée.",
            "Barre supérieure, mode en cours : MÂT DIRECT, LINÉAIRE, TRAJECTOIRE, LOCAL, RALENTI, STABILISATEURS, VEILLE ou DÉFAUT.",
            "Indicateurs d'état : vert = opérationnel, rouge = hors tension ou ERREUR, jaune = chargement ou avertissement. Appuyez sur un cercle pour plus d'informations.",
            "Versions logicielles PLC et PPU affichées ; boutons Paramètres, Diagnostics, Alarmes, vue RVIZ."] } ]},
        { title:"Alarmes & effacement des défauts", page:27, blocks:[
          {t:"p", text:"Le tableau des alarmes classe les entrées en informations, avertissements et défauts système. Causes typiques : défauts du réseau CAN au démarrage, articulations actionnées manuellement en mode télécommande… Les défauts résolus passent à l'état Inactif."},
          {t:"warn", w:"warn", text:"Les défauts actifs ET inactifs doivent tous être effacés avant de reprendre le fonctionnement : sélectionnez la ligne, puis « Effacer le défaut »."} ]},
        { title:"Vue TRAJECTOIRE (modèle 3D)", page:28, blocks:[
          {t:"p", text:"Modèle 3D en temps réel de la position du mât et des obstacles modélisés par le logiciel de planification. Utile après une collision, pour confirmer les lectures des codeurs et diagnostiquer les points de consigne. Quatre vues, appuyez pour agrandir."},
          {t:"warn", w:"note", text:"Le logiciel ne peut pas modéliser tous les objets d'une mine souterraine : pour éviter un objet invisible à l'écran, utilisez des points de consigne supplémentaires."} ]},
        { title:"Calibrage des codeurs (point zéro)", page:30, blocks:[
          {t:"p", text:"Requis si un codeur est remplacé ou s'il a glissé sur son arbre : sans réinitialisation du point zéro, l'orientation transmise est fausse."},
          {t:"steps", items:[
            "Allumez la machine et réglez la télécommande en mode DIRECT.",
            "Connectez-vous sur l'IHM avec les identifiants administrateur (Annexe A).",
            "Une articulation à la fois, amenez-la à sa position d'origine (butée définie : J1 antihoraire, J2 haut max, J3 rentré, J4 bas max, J5 antihoraire, J6 vérin déployé).",
            "Appuyez sur le bouton correspondant sur l'IHM et vérifiez que la valeur passe à zéro (1° ou 359° acceptable)."] } ]},
        { title:"Limites de la rotation de pivotement", page:32, blocks:[
          {t:"p", text:"Butées mécaniques à ±165° (course totale 330°, zone morte de 30° à l'avant). Les limites logicielles par défaut sont 10° et 320° ; modifiables à l'écran d'étalonnage en appuyant sur la valeur."},
          {t:"warn", w:"note", text:"Le bouton OVERRIDE JOINT LIMITS libère toute la course jusqu'aux butées, il se réinitialise en quittant l'écran d'étalonnage."} ]},
        { title:"Contournement des erreurs de valve", page:32, blocks:[
          {t:"p", text:"Réservé à un opérateur expérimenté, dans deux scénarios seulement : un défaut connu non critique (ex. surchauffe) qu'il faut absolument dépasser, ou un défaut sur le bloc de valves de l'autre mode que celui utilisé."},
          {t:"warn", w:"danger", text:"Un contournement actif ignore TOUS les défauts de cette valve. Dangereux si le défaut est critique ou s'il masque un danger imminent pour le personnel ou la machine."} ]},
        { title:"Courbes des manettes & limites de consigne", page:33, blocks:[
          {t:"p", text:"Les courbes (0 à 3) définissent la sensibilité des actionneurs par rapport à la manette : plus de course pour la précision, ou montée linéaire en vitesse. Sélectionnez la courbe sur l'IHM et vérifiez que l'icône s'allume."},
          {t:"p", text:"Les LIMITES DES CONSIGNES DE VALVE réduisent la vitesse maximale de chaque articulation en mode DIRECT (les deux sens ; la gravité peut créer un écart). Plage utile : 10 à 100 % : consultez MEDATech pour un tiroir de valve différent au-delà. Un bouton rétablit les valeurs d'usine."} ]},
        { title:"Réglage des articulations (étalonnage PPU)", page:35, blocks:[
          {t:"p", text:"Si le mât devient saccadé en LINÉAIRE/TRAJECTOIRE malgré un calibrage codeur correct : étalonnage Seuil (consigne minimale de mouvement) et Dynamique (délais et vitesses). Positionnez chaque articulation à ±2°/5 mm de la pose cible en mode DIRECT, lancez depuis l'IHM (bouton jaune → vert), puis maintenez la manette gauche : l'articulation fait 2 cycles de va-et-vient (« CALIBRATING »). Relâcher la manette annule."},
          {t:"warn", w:"warn", text:"Pendant l'étalonnage, les articulations bougent SANS commande directe ni détection d'environnement. Espace requis : PIVOT 25°, ÉPAULE 50°, TÉLESCOPE 140 mm, POIGNET 30°, ROTATION 20°, INCLINAISON 40°. Relâcher la manette arrête le mât en tout temps."},
          {t:"p", text:"Ensuite : clé USB rouge MEDATech dans le câble bleu du PPU (1 min), envoyer le dossier « medatech_calibration » au service MEDATech, recharger le fichier « cal.7z » retourné sur la clé, réinsérer (1 min) et redémarrer le PPU depuis l'IHM."} ]},
        { title:"Écrans de diagnostics", page:41, blocks:[
          {t:"ul", items:["Diagnostic des codeurs.","Diagnostic des valves.","Diagnostic du système électrique."] },
          {t:"warn", w:"note", text:"Les valves hors de leur mode désigné affichent normalement un défaut (valves RALENTI en défaut pendant le mode MÂT, et inversement). Ne vous inquiétez que si le défaut apparaît dans le mode désigné."} ]}
      ],
      quiz:[
        { text:"Avant de reprendre le fonctionnement après des défauts, il faut…", options:["Effacer uniquement les défauts actifs","Effacer les défauts actifs ET inactifs","Redémarrer la machine, rien d'autre"], correct:1 },
        { text:"Un contournement d'erreur de valve…", options:["Ignore TOUS les défauts de cette valve, réservé aux cas non critiques","Ne dure que 30 secondes","Est recommandé à chaque défaut"], correct:0 },
        { text:"Quelle est la course totale du pivotement entre butées mécaniques ?", options:["360°","330° (±165°)","180°"], correct:1 },
        { text:"Le mât est saccadé en mode LINÉAIRE malgré des codeurs calibrés. Que faire ?", options:["Un réglage des articulations (étalonnage PPU)","Remplacer la pompe","Passer en mode Rabbit"], correct:0 },
        { text:"Des valves du mode RALENTI affichent un défaut pendant le mode MÂT…", options:["C'est normal : elles sont hors de leur mode désigné","Il faut arrêter la machine immédiatement","Il faut contourner le défaut"], correct:0 }
      ]
    },
    {
      num:"06", title:"Mise en route & déplacement", short:"Mise en route", chapters:"11.1 : 11.5", pages:"45-54",
      subtitle:"Connexion filaire (électrique + hydraulique), séquence de démarrage, les six modes, commande manuelle et déplacement sécuritaire.",
      intro:"Le RodBot n'a aucune source d'énergie embarquée : tout passe par les câbles de liaison de 10 m vers la foreuse. Ce module couvre le branchement, le démarrage et le déplacement de la machine.",
      sections:[
        { title:"Connexion électrique & arrêt d'urgence", page:45, blocks:[
          {t:"p", text:"Deux connexions électriques sous gaine spirale : un câble 24 V CC pour l'électronique embarquée et un câble d'arrêt d'urgence reliant les circuits e-stop du RodBot et de la foreuse mère. Un boîtier de raccordement (120 V CA → 24 V CC) se monte sur la foreuse ; raccordement aux connecteurs 2 et 4 du panneau."},
          {t:"warn", w:"danger", text:"Le RodBot doit être installé avec une BARRIÈRE séparant l'opérateur de la machine et de la foreuse, pilotage par radio, chacun de part et d'autre de la barrière."},
          {t:"warn", w:"warn", text:"Si vous constatez un mouvement inattendu du mât, appuyez immédiatement sur un arrêt d'urgence, puis diagnostiquez le problème."} ]},
        { title:"Raccordement hydraulique", page:47, blocks:[
          {t:"p", text:"L'ensemble de flexibles de liaison (10 m) raccorde le RodBot à la pompe de la foreuse : Pression, Réservoir, Détection de charge (LS) et Drainage du carter. Une cloison à raccords rapides se monte sur la foreuse ou la pompe (2 boulons 3/8 po)."},
          {t:"warn", w:"note", text:"Un remplacement de pompe peut exiger un recalibrage : les modes TRAJECTOIRE et LINÉAIRE dépendent de la latence, de la rampe et de la pression réglées. Contactez MEDATech si leurs performances se dégradent."} ]},
        { title:"Mise en marche, la séquence", page:49, blocks:[
          {t:"steps", items:[
            "Raccordez le RodBot à l'alimentation (câble de liaison → coffret de la foreuse principale).",
            "Attendez l'allumage de l'écran IHM (~30 secondes).",
            "Vérifiez que l'e-stop de la télécommande est déverrouillé, puis appuyez sur le bouton vert de démarrage.",
            "Suivez les instructions à l'écran pour appairer la RRC (nouvel appui sur le bouton vert).",
            "Appuyez sur le bouton de réarmement de sécurité du panneau de contrôle.",
            "Attendez la fin de la séquence de démarrage affichée sur l'IHM.",
            "En mode VEILLE, le système est prêt : sélectionnez un mode depuis les boutons latéraux de la RRC."] } ]},
        { title:"Les six modes de fonctionnement", page:50, blocks:[
          {t:"specs", rows:[["VEILLE","Mode de sécurité : aucune commande traitée ; e-stop, inclinaison et feux restent actifs"],["RALENTI","Chenilles uniquement"],["STABILISATEURS","Les 4 vérins uniquement"],["DIRECT","Articulations individuelles du mât"],["LINÉAIRE","Effecteur en lignes droites X-Y-Z"],["TRAJECTOIRE","Déplacement autonome entre points enregistrés"]] } ]},
        { title:"Commande manuelle & leviers", page:50, blocks:[
          {t:"p", text:"Toutes les fonctions peuvent être actionnées aux leviers des distributeurs, uniquement avec le sélecteur en LOCAL. En mode TÉLÉCOMMANDE, un levier actionné est détecté comme erreur de valve : arrêt de protection, hydraulique coupée. Annulation : passer en LOCAL + bouton de réarmement de sécurité."} ]},
        { title:"Déplacement (RALENTI) & pose de transport", page:51, blocks:[
          {t:"warn", w:"danger", text:"Ne déplacez JAMAIS le RodBot avec les valves manuelles, risque d'être heurté ou écrasé. Toujours par télécommande radio. Les leviers du bloc « chenilles et vérins » servent uniquement à l'entretien et sont livrés déconnectés, rangés à l'arrière."},
          {t:"p", text:"Vous ne pouvez pas passer en mode RALENTI si les mâchoires du grappin sont fermées. Avant tout déplacement, placez le bras en pose de transport :"},
          {t:"ul", items:["Pivotement parallèle au châssis","Levage abaissé au maximum","Télescope rétracté","Poignet orienté vers le bas","Grappin ouvert"] },
          {t:"warn", w:"warn", text:"Inspectez la trajectoire (personnel, obstacles, cavités, terrain instable). Ne vous tenez jamais devant ou à côté de la machine en mouvement ; signaleur si visibilité réduite. Gardez les câbles de liaison hors de la trajectoire, ne roulez jamais dessus."},
          {t:"p", text:"Vitesses chenilles : Hi 2,8 km/h · Lo 1,5 km/h. Pour changer : tournez la valve de dérivation manuelle (carré 0,55 po) de 90° : horaire = Hi, antihoraire = Lo."} ]},
        { title:"Mode VEILLE", page:54, blocks:[
          {t:"p", text:"Permet d'appairer la RRC sans qu'aucune commande ne soit traitée. Toutes les fonctions de sécurité (e-stop, inclinaison) et les feux restent fonctionnels : un mode sûr pour démarrer la télécommande avant de passer aux modes de travail."} ]}
      ],
      quiz:[
        { text:"Quelle est la longueur des câbles de liaison vers la foreuse ?", options:["5 m","10 m","20 m"], correct:1 },
        { text:"Comment le RodBot doit-il être installé par rapport à l'opérateur ?", options:["Une barrière les sépare, pilotage radio de part et d'autre","Côte à côte pour une meilleure visibilité","Peu importe, la radio porte à 100 m"], correct:0 },
        { text:"Peut-on passer en mode RALENTI avec le grappin fermé ?", options:["Oui, sans restriction","Oui, mais en vitesse Lo uniquement","Non, c'est impossible"], correct:2 },
        { text:"Un levier manuel est actionné pendant le mode TÉLÉCOMMANDE…", options:["Le levier prend la priorité","Erreur de valve → arrêt de protection, hydraulique coupée","Le mouvement s'additionne à la commande radio"], correct:1 },
        { text:"Le déplacement de la machine doit se faire…", options:["Par télécommande radio uniquement","Aux valves manuelles pour plus de précision","Indifféremment radio ou leviers"], correct:0 }
      ]
    },
    {
      num:"07", title:"Manutention des tiges", short:"Manutention", chapters:"11.6 : 11.7", pages:"54-66",
      subtitle:"Commande du grappin, modes DIRECT et LINÉAIRE, points de consigne TRAJECTOIRE, limites anti-collision et chargement du bac.",
      intro:"Le cœur du métier : déplacer les tiges entre le plateau et la foreuse. DIRECT ou LINÉAIRE au choix de l'opérateur ; TRAJECTOIRE pour les déplacements automatisés, à condition de définir correctement points et limites.",
      sections:[
        { title:"Commande du grappin (pince)", page:55, blocks:[
          {t:"p", text:"Deux actions simultanées sont requises sur la RRC. FERMER : bouton vert GRAPPIN + bascule GRAPPIN vers le bas. OUVRIR : bouton vert GRAPPIN maintenu + bascule vers le haut maintenue au moins 1 seconde."},
          {t:"warn", w:"danger", text:"Ne jamais se placer sous le mât ou le grappin. Attention aux réseaux suspendus des mines (câbles électriques, conduites d'eau et d'air, ventilation) : tout contact du mât peut entraîner des blessures graves ou la mort."} ]},
        { title:"Choisir entre DIRECT et LINÉAIRE", page:56, blocks:[
          {t:"p", text:"DIRECT : comme une grue traditionnelle, chaque actionneur commandé indépendamment (inscriptions blanches sur la façade). LINÉAIRE : l'effecteur suit des lignes droites, AVANT/ARRIÈRE, HAUT/BAS, GAUCHE/DROITE (pivotement) : étiquettes orange ; manette gauche = haut/bas + gauche/droite, manette droite = intérieur/extérieur. Poignet, rotation et inclinaison restent commandables individuellement."},
          {t:"warn", w:"note", text:"Le choix relève de la préférence personnelle ; pour la plupart des opérateurs, le mode LINÉAIRE est généralement plus simple."} ]},
        { title:"Points de consigne TRAJECTOIRE", page:58, blocks:[
          {t:"p", text:"Accès à l'écran de configuration : maintenir le bouton DIRECT ou LINÉAIRE pendant 3 secondes. Sélectionnez un point avec l'interrupteur « Point de trajectoire », puis « Enregistrer/Sélection » vers le haut pour enregistrer (une coche apparaît) ou vers le bas pour supprimer."},
          {t:"specs", rows:[["PLATEAU 1","Par défaut au-dessus du bac, modifiable"],["PLATEAU 2","Plateau secondaire (au sol) : tige saisie au centre ±5 cm, ≥30 cm au-dessus, parallèle au plateau"],["ATTENTE","Point d'approche final vers la foreuse ; peut servir d'arrêt (présentateur de tiges)"],["FOREUSE","OBLIGATOIRE : point de transfert de la tige, saisie au centre ±5 cm"],["POINT 1 & 2","Points de passage optionnels pour contourner les obstacles"]] },
          {t:"p", text:"Exemple d'enchaînement : PLATEAU → POINT 2 → POINT 1 → ATTENTE → FOREUSE."} ]},
        { title:"Limites supérieure & inférieure (anti-collision)", page:61, blocks:[
          {t:"p", text:"Le planificateur évite d'office : le RodBot lui-même, la foreuse (positionnée d'après le point FOREUSE), le bac à tiges, l'arrière et le plancher. L'opérateur définit en plus deux plans horizontaux, toit/services et sol/rebord."},
          {t:"p", text:"Définition d'un plan : amener le centre de gravité du grappin (vide de préférence) à la hauteur voulue, généralement ~30 cm du sol pour la limite inférieure, puis actionner l'interrupteur vers le haut. Procédure identique pour la limite supérieure."},
          {t:"warn", w:"note", text:"Si une tige est détectée dans le grappin, le planificateur suppose une tige de 6 pi tenue à ±5 cm du centre et garde toute la tige hors des plans."} ]},
        { title:"Pas de système de vision !", page:63, blocks:[
          {t:"warn", w:"danger", text:"Aucun système de vision ne détecte le personnel, les véhicules ou les équipements entrant dans la zone de travail. Barrières, délimitations et restrictions d'exploitation conformes aux politiques de la mine sont OBLIGATOIRES ; limitez la circulation dans l'enveloppe de travail du mât."},
          {t:"warn", w:"warn", text:"Sécurité intégrée : passer en RALENTI et déplacer la machine SUPPRIME tous les points de consigne sauf PLATEAU 1. Les réglages survivent au redémarrage, supprimez points et limites à la fin de chaque tâche et redéfinissez-les à chaque nouvelle configuration."} ]},
        { title:"Fonctionner en mode TRAJECTOIRE", page:64, blocks:[
          {t:"p", text:"Prérequis : FOREUSE, ATTENTE et LIMITES SUPÉRIEURE/INFÉRIEURE définis. Maintenir le bouton jaune TRAJECTOIRE + manette droite : à droite = vers le PLATEAU, à gauche = vers la FOREUSE. Une fois le mouvement amorcé, le bouton peut être relâché ; la manette maintenue poursuit le déplacement, la relâcher arrête le mât."},
          {t:"p", text:"Relâcher le bouton jaune ramène au mode précédent (LINÉAIRE ou DIRECT) : vous pouvez reprendre la main à tout moment, puis réactiver la TRAJECTOIRE : une nouvelle trajectoire sans collision est générée."} ]},
        { title:"Chargement du bac à tiges", page:65, blocks:[
          {t:"ul", items:[
            "Les fourreaux pour fourches du bac s'engagent dans les profilés du châssis.",
            "Le bac se positionne latéralement entre les deux pattes de retenue du châssis.",
            "Le bac n'est PAS boulonné : il est maintenu par ces dispositifs d'alignement et de retenue."] } ]}
      ],
      quiz:[
        { text:"Comment ouvre-t-on le grappin ?", options:["Bouton vert + bascule vers le haut maintenue ≥ 1 s","Un simple appui sur la bascule","Double appui rapide sur le bouton vert"], correct:0 },
        { text:"Quels points sont obligatoires pour utiliser le mode TRAJECTOIRE ?", options:["POINT 1 et POINT 2","FOREUSE, ATTENTE et les LIMITES sup./inf.","Seulement PLATEAU 1"], correct:1 },
        { text:"Le RodBot détecte-t-il une personne entrant dans sa zone de travail ?", options:["Oui, par caméras","Oui, par capteurs laser","Non, aucun système de vision : barrières obligatoires"], correct:2 },
        { text:"Après un déplacement en RALENTI, les points de consigne…", options:["Sont tous conservés","Sont tous supprimés sauf PLATEAU 1","Sont convertis en points par défaut"], correct:1 },
        { text:"Comment le bac à tiges est-il fixé au châssis ?", options:["Boulonné aux quatre coins","Par brides hydrauliques","Non boulonné : fourreaux et pattes de retenue"], correct:2 }
      ]
    },
    {
      num:"08", title:"Dépannage & entretien", short:"Entretien", chapters:"12 : 13 · annexes", pages:"67-87",
      subtitle:"Guide de dépannage, LOTO, inspections, fluides, graissage, patins d'usure, chenilles, transport, remorquage et annexes.",
      intro:"Un entretien régulier garantit un fonctionnement sécuritaire et fiable. Cette section s'adresse au personnel qualifié : et le dépannage commence toujours par les causes simples.",
      sections:[
        { title:"Guide de dépannage, les cas fréquents", page:67, blocks:[
          {t:"specs", rows:[
            ["Ne s'allume pas","Mode À DISTANCE avec RRC éteinte → LOCAL, activer la RRC, réarmement sécurité · ou e-stop enfoncé → réinitialiser"],
            ["La RRC ne s'allume pas","Batterie déchargée → charger · clé absente → remettre la clé"],
            ["S'arrête en mode À DISTANCE","E-stop RRC enfoncé · RRC activée après le sélecteur → activer la RRC d'abord · inclinaison → tenir horizontale"],
            ["Rien ne fonctionne malgré RRC + REMOTE","Circuit de sécurité à rétablir → bouton RÉINITIALISATION · vérifier messages d'erreur, bobine de valve, alimentation huile, récepteur radio"],
            ["Fonctions lentes","Mode Turtle actif → passer en Rabbit"],
            ["Pas d'AUTO / TIP","Codeur en défaut → vérifier l'IHM et le câblage"],
            ["Rotation trop limitée","Butées souples trop restreintes → réinitialiser (écart 2-3° normal)"],
            ["Tige touche sol/toit en TRAJECTOIRE","LIMITES sup./inf. non conformes → les redéfinir · vérifier codeurs"],
            ["Tige mal placée à la foreuse","Redéfinir le point FOREUSE · vérifier codeurs · destination incorrecte"],
            ["Mât erratique","Codeurs mal transmis au PPU → vérifier · recalibrage (section 8.6 du manuel)"]] },
          {t:"p", text:"Assistance MEDATech : service@medatech.ca · +1 (705) 443-8440, poste 4."} ]},
        { title:"Règles d'or avant tout entretien", page:71, blocks:[
          {t:"warn", w:"danger", text:"Machine hors tension, alimentation débranchée, cadenassage-étiquetage (LOTO) respecté pour TOUT entretien, y compris le lavage. Certains dispositifs stockent de l'énergie hydraulique (vérins à valves d'équilibrage). Personnel qualifié uniquement ; pratiques locales de travail en hauteur respectées."},
          {t:"warn", w:"note", text:"Effectuez l'entretien avec l'articulation (épaule) à l'horizontale ou plus bas pour éviter les travaux en hauteur inutiles."} ]},
        { title:"Nettoyage", page:71, blocks:[
          {t:"p", text:"Le RodBot peut et doit être nettoyé : mais jamais de jet direct de nettoyeur à pression sur les composants électriques (codeurs rotatifs, panneau) : la pression endommage leurs joints d'étanchéité."} ]},
        { title:"Inspections régulières", page:71, blocks:[
          {t:"specs", rows:[["Flexibles, conduites, câbles (dommages, fuites)","Quotidienne"],["Test sans tige, mouvements normaux","Quotidienne"],["Arrêts d'urgence fonctionnels","Hebdomadaire"],["Lubrification articulations & couronnes","Hebdomadaire"],["Inspection des chenilles","Hebdomadaire"],["Structures : déformations, fissures de soudure","Hebdomadaire"],["Niveau d'huile réducteur de chenilles","500 h"],["Vidange huile réducteur","2 000 h"],["Patins d'usure du télescope","Au besoin"]] },
          {t:"p", text:"Signalez immédiatement tout problème constaté à la direction et/ou au personnel d'entretien."} ]},
        { title:"Fluides & points de graissage", page:72, blocks:[
          {t:"specs", rows:[["Huile hydraulique","ISO VG 46"],["Graisse (articulations mécaniques)","EP2"],["Huile réducteur d'entraînement final","SAE 80W90"]] },
          {t:"p", text:"10 points de graissage : 4 sur la couronne d'orientation de la base, 4 sur la couronne de rotation, 2 sur le vérin d'inclinaison. Pour les couronnes : graissez, tournez l'articulation d'environ 30°, répétez sur toute la plage."},
          {t:"warn", w:"warn", text:"Ne déplacez pas les articulations d'orientation pendant qu'un technicien se trouve dans le rayon d'action de la machine."} ]},
        { title:"Patins d'usure du télescope", page:73, blocks:[
          {t:"p", text:"Huit patins en plastique guident la glissière du télescope ; ils s'usent et exigent un réglage pour limiter le jeu. Procédure : mât horizontal au-dessus du bac, flèche déployée de 3 po, machine hors tension. Desserrer les contre-écrous, régler les patins 1-2 puis 7-8 avec un jeu d'environ 1/8 po (plaque calibre 11) ; patins 3-4 et 5-6 accotés sans serrage. Resserrer les contre-écrous."},
          {t:"warn", w:"note", text:"Si la tête du boulon arrive en butée contre le contre-écrou, le patin doit être remplacé (retirer la plaque de fermeture, la plaque de poussée, remplacer, remonter, régler). Coincements ou bruits : desserrer 3-6, graisser les rails, vérifier les butées."} ]},
        { title:"Entretien des chenilles", page:75, blocks:[
          {t:"p", text:"Tension : la flèche (le mou) doit mesurer 20 à 25 mm (règle droite + ruban). Jamais plus de 30 mm ni de tension excessive. Réglage par la valve derrière la plaque signalétique : injecter de la graisse pour tendre, dévisser lentement pour détendre."},
          {t:"specs", rows:[["Chenille neuve","X = 22 mm"],["Usure 50 %","X = 15 mm"],["Limite de remplacement","X < 8 mm"]] } ]},
        { title:"Transport, ancrage, remorquage & levage", page:76, blocks:[
          {t:"p", text:"Quatre façons de transporter : déplacement autonome, remorquage au sol, chariot élévateur/télescopique, remorque surbaissée, toujours avec le bras en pose de transport. 4 points d'ancrage sur le châssis (arrimage, remorquage, levage) et 4 points de levage 9/16 po sur le bac ; passages de fourches sur châssis et bac."},
          {t:"warn", w:"danger", text:"Remorquage : désactiver les freins SAHR en retirant le bouchon (clé hexagonale M16) des DEUX chenilles, après avoir solidement fixé la machine au véhicule. Réinstaller les bouchons après remorquage : sans eux, la machine n'a PAS de freins."},
          {t:"warn", w:"warn", text:"Respectez les procédures d'ancrage sécuritaires lors de l'arrimage sur un transporteur et lors du chargement/déchargement."} ]},
        { title:"Les annexes du manuel", page:80, blocks:[
          {t:"ul", items:[
            "A (p. 80) : Paramètres de connexion administrateur de l'IHM.",
            "B (p. 81) : Réinitialisation de la PPU : bouton d'alimentation 5 s, attendre 60 s ; sinon contacter MEDATech.",
            "C (p. 82) : Appairage de la télécommande AUTEC et du récepteur (procédure START/ARRÊT).",
            "D (p. 84) : Mise à jour logicielle du PPU : fichier taiga.7z sur clé USB, attendre 10 min, vérifier la version sur l'IHM.",
            "E (p. 87) : Journaux de données : Wi-Fi « MEDATech-Datalogger », tableau de bord logger.local, journaux UDP/CAN par intervalles de 5 min."] } ]}
      ],
      quiz:[
        { text:"Avant tout entretien, y compris le lavage, il faut…", options:["Mettre hors tension, débrancher et appliquer le LOTO","Passer en mode VEILLE","Fermer le grappin"], correct:0 },
        { text:"Les fonctions du mât sont anormalement lentes. Cause probable ?", options:["Pompe usée","Mode Turtle (lent) actif","Batterie RRC faible"], correct:1 },
        { text:"Quelle est la flèche (le mou) correcte d'une chenille ?", options:["5-10 mm","20-25 mm","40-50 mm"], correct:1 },
        { text:"Après un remorquage, il faut…", options:["Vidanger l'huile hydraulique","Réinstaller les bouchons SAHR : sinon pas de freins","Recalibrer les codeurs"], correct:1 },
        { text:"Quelle huile hydraulique est approuvée ?", options:["ISO VG 46","SAE 80W90","ATF Dexron III"], correct:0 }
      ]
    }
  ];

  RRC_SPOTS = [
    { x:50, y:22, name:"Écran de la télécommande", page:23, desc:"Écran non tactile : les touches du clavier au-dessus correspondent aux icônes affichées (AIMANT, TRAJ, LINÉAIRE à gauche ; DIRECT, STABS, DÉP. LENTE à droite). Il affiche l'état du système, le mode actif, l'état du grappin et de l'aimant, la batterie et les points de trajectoire. L'encadré jaune signale l'élément sélectionné." },
    { x:26, y:52, name:"Manette gauche (JS1)", page:21, desc:"Proportionnelle, à rappel au centre. En DIRECT : pivotement (G/D) et levage (H/B). En LINÉAIRE : effecteur haut/bas et gauche/droite. La molette crantée INCL PINCE au sommet commande l'inclinaison de la pince (J6)." },
    { x:73, y:50, name:"Manette droite (JS2)", page:21, desc:"En DIRECT : télescope (ext./rent.) et poignet (H/B). En LINÉAIRE : effecteur vers la foreuse ou vers le bac. En TRAJECTOIRE : maintenue à droite = vers le PLATEAU, à gauche = vers la FOREUSE. Molette ROTATION PINCE : rotation de la pince (J5)." },
    { x:50.5, y:74, name:"Arrêt d'urgence", page:18, desc:"Champignon rouge relié à un relais monté en série avec les e-stops du RodBot et de la foreuse mère : une pression arrête les DEUX machines. Attention : en mode LOCAL, ce bouton ne fonctionne pas. Cliquez dessus pour tester !", estop:true },
    { x:40.5, y:76, name:"Bouton TRAJ (jaune)", page:64, desc:"Active le mode TRAJECTOIRE : maintenir ce bouton + manette droite pour lancer le déplacement automatique du mât entre les points enregistrés. Une fois le mouvement amorcé, le bouton peut être relâché ; relâcher la manette arrête le mât." },
    { x:60, y:76, name:"Bouton PINCE (vert)", page:55, desc:"Activation du grappin, deux actions simultanées requises : FERMER = bouton vert + bascule vers le bas. OUVRIR = bouton vert maintenu + bascule vers le haut maintenue au moins 1 seconde (protection contre les chutes de tige)." },
    { x:41, y:60, name:"Point de trajectoire (sélection)", page:58, desc:"Interrupteur de sélection des points de consigne (PLATEAU, ATTENTE, FOREUSE, POINT 1-2…). Accès à l'écran de configuration : maintenir le bouton DIRECT ou LINÉAIRE pendant 3 secondes." },
    { x:59.5, y:60, name:"ENR / SUPPRIMER", page:58, desc:"Enregistre (vers le haut, une coche apparaît à l'écran) ou supprime (vers le bas) le point de trajectoire sélectionné. Les limites supérieure et inférieure anti-collision se définissent de la même manière." },
    { x:20.5, y:76, name:"Électroaimant (SOUS TENSION / ARRÊT)", page:21, desc:"Commande l'électroaimant du grappin pour saisir les tiges une à une, charge maximale de 120 lb en levage par aimant." },
    { x:26, y:76, name:"Rapide / Lent (Rabbit-Turtle)", page:19, desc:"Facteur d'échelle appliqué à toutes les articulations dans les modes DIRECT, LINÉAIRE et TRAJECTOIRE. Turtle = vitesse réduite de 50 % : sauf le grappin, qui garde sa vitesse." },
    { x:33.5, y:76, name:"Klaxon & gyrophare", page:21, desc:"Avertisseur sonore et feux. Le klaxon retentit automatiquement à chaque changement de mode pour prévenir le personnel à proximité." },
    { x:79, y:76, name:"MÂT / DÉP. LENTE", page:50, desc:"Sélection des grands modes : commande du mât (DIRECT / LINÉAIRE / TRAJECTOIRE) ou déplacement de la machine (RALENTI : chenilles). Impossible de passer en RALENTI si les mâchoires du grappin sont fermées." },
    { x:11, y:86, name:"Interrupteur d'inclinaison (interne)", page:19, desc:"Capteur interne : si la télécommande est inclinée ou tombe (opérateur en difficulté), le RodBot passe en arrêt de sécurité : alimentation hydraulique coupée. Remise à l'horizontale + manettes au neutre = retour automatique en veille. À tester au début de chaque quart." }
  ];

  SIM_MODES = [
    { id:"VEILLE",   tag:"SÉCURITÉ", desc:"Aucune commande n'est traitée. E-stop, interrupteur d'inclinaison et feux restent actifs. Mode sûr pour appairer la télécommande.", beacon:"on",    tracks:false, mast:false },
    { id:"RALENTI",  tag:"TRAM",     desc:"Déplacement de la machine, chenilles uniquement. Interdit si les mâchoires du grappin sont fermées. Le voyant clignote pour avertir le personnel.", beacon:"blink", tracks:true, mast:false },
    { id:"STABILISATEURS", tag:"TRAM", desc:"Commande des 4 vérins de stabilisation uniquement.", beacon:"on", tracks:true, mast:false },
    { id:"DIRECT",   tag:"MÂT",      desc:"Chaque articulation du mât est commandée individuellement à la manette, comme une grue conventionnelle (inscriptions blanches).", beacon:"on", tracks:false, mast:true },
    { id:"LINÉAIRE", tag:"MÂT",      desc:"L'effecteur suit des lignes droites X-Y-Z : le système coordonne plusieurs distributeurs simultanément (étiquettes orange). Le plus simple pour la plupart des opérateurs.", beacon:"on", tracks:false, mast:true },
    { id:"TRAJECTOIRE", tag:"MÂT",   desc:"Le mât se déplace automatiquement entre les points enregistrés en évitant les collisions. Prérequis : FOREUSE, ATTENTE et limites définies. Le voyant clignote.", beacon:"blink", tracks:false, mast:true },
    { id:"LOCAL",    tag:"PANNEAU",  desc:"Commande aux leviers manuels uniquement. Les signaux radio sont ignorés, et l'e-stop de la télécommande NE FONCTIONNE PAS. Voyant éteint.", beacon:"off", tracks:false, mast:false }
  ];

  constructor(props){
    super(props);
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem("rodbot_formation_v3")||"{}"); } catch(e){}
    let savedLang = "fr";
    try { savedLang = localStorage.getItem("rodbot_lang") || "fr"; } catch(e){}
    this.state = {
      lang: (savedLang==="en" ? "en" : "fr"),
      view:"home", activeId:null, openKey:null,
      answers:{}, graded:false, lastScore:0, lastPassed:false,
      qIdx:0, qSel:null, qChecked:false, qResults:[], mpage:null,
      imgView:null,
      canInstall:false, showInstallHelp:false,
      completed: saved.completed || {}, name: saved.name || "",
      simTab:"rrc", rrcSel:3, estopped:false, rrcInfoOpen:false,
      slew:0, hoist:52, ext:40, tilt:0, jawOpen:false,
      simMode:"VEILLE", klaxon:false
    };
  }

  openSim = (tab)=>{ this.setState({ view:"sim", simTab:tab }); window.scrollTo(0,0); };
  pickSpot = (i)=>{
    const sp=this.spots()[i];
    // Toucher/cliquer une pastille ouvre une fiche pop-up de la commande
    // (fiche centrée sur ordinateur, feuille du bas sur mobile).
    var patch = sp.estop ? { rrcSel:i, estopped:true, rrcInfoOpen:true } : { rrcSel:i, rrcInfoOpen:true };
    this.setState(patch);
  };
  closeRrcInfo = ()=> this.setState({ rrcInfoOpen:false });
  resetEstop = ()=> this.setState({ estopped:false });
  setJoint = (k,e)=> this.setState({ [k]: Number(e.target.value) });
  toggleJaw = ()=> this.setState(s=>({ jawOpen: !s.jawOpen }));
  pickMode = (id)=>{
    if(id===this.state.simMode) return;
    this.setState({ simMode:id, klaxon:true });
    clearTimeout(this._kt);
    this._kt = setTimeout(()=>this.setState({ klaxon:false }), 1400);
  };
  persist(){ try { localStorage.setItem("rodbot_formation_v3", JSON.stringify({ completed:this.state.completed, name:this.state.name })); } catch(e){} }

  // ===== Bilingue FR / EN =====
  tr(fr,en){ return this.state.lang==="en" ? en : fr; }               // choisit la chaîne selon la langue
  M(){ return (this.state.lang==="en" && typeof MODULES_EN!=="undefined") ? MODULES_EN : this.MODULES; }
  spots(){ return (this.state.lang==="en" && typeof RRC_SPOTS_EN!=="undefined") ? RRC_SPOTS_EN : this.RRC_SPOTS; }
  simModesData(){ return (this.state.lang==="en" && typeof SIM_MODES_EN!=="undefined") ? SIM_MODES_EN : this.SIM_MODES; }
  setLang = (l)=>{
    l = (l==="en") ? "en" : "fr";
    if(l===this.state.lang) return;
    this.state.lang = l;
    try { localStorage.setItem("rodbot_lang", l); } catch(e){}
    try { document.documentElement.setAttribute("lang", l); } catch(e){}
    // Recharge le gabarit dans la bonne langue puis rendu complet
    var id = (l==="en") ? "rb-template-en" : "rb-template";
    var node = document.getElementById(id) || document.getElementById("rb-template");
    if(node){
      var doc = new DOMParser().parseFromString('<div id="rb-wrap">'+node.textContent+'</div>','text/html');
      TPL_ROOT = doc.getElementById("rb-wrap");
    }
    fullRender();
    window.scrollTo(0,0);
  };

  manualBase(){ return (this.state.lang==="en" && this.MANUAL_EN) ? this.MANUAL_EN : this.MANUAL; }
  // Remappe un numéro de page FR (données) vers la page correspondante du manuel EN.
  mp(pg){ if(this.state.lang==="en" && typeof PAGE_MAP_EN!=="undefined" && PAGE_MAP_EN[pg]) return PAGE_MAP_EN[pg]; return pg; }
  manualTotal(){ return this.state.lang==="en" ? 82 : 87; }
  pdfAt(page){ return this.manualBase() + "#page=" + page; }
  // Planches du manuel : dossier anglais img/manual-en/ quand la langue = EN
  // (repli automatique sur la planche française si l'anglaise n'existe pas, voir addImgFallback).
  manualImg(pg){ var n=(pg<10?"0"+pg:pg); return (this.state.lang==="en" ? "img/manual-en/p"+n+".jpg" : "img/manual/p"+n+".jpg"); }
  openManual = (n)=>{ this.setState({ mpage: Math.max(1, Math.min(this.manualTotal(), n||1)) }); window.scrollTo(0,0); };
  closeManual = ()=> this.setState({ mpage:null });
  // Visionneuse d'image (photos d'équipement) : pop-up plein cadre, ne quitte pas la page
  openImg = (src,cap)=>{ this.setState({ imgView:{ src:src, cap:cap||"" } }); };
  closeImg = ()=> this.setState({ imgView:null });
  installApp = ()=>{
    if(typeof __deferredPrompt!=="undefined" && __deferredPrompt){
      __deferredPrompt.prompt();
      var self=this;
      __deferredPrompt.userChoice.then(function(){ __deferredPrompt=null; self.setState({ canInstall:false }); }).catch(function(){});
    } else { this.setState({ showInstallHelp:true }); }
  };
  closeInstallHelp = ()=> this.setState({ showInstallHelp:false });
  manualPrev = ()=> this.setState(s=>({ mpage: Math.max(1, (s.mpage||1)-1) }));
  manualNext = ()=> this.setState(s=>({ mpage: Math.min(this.manualTotal(), (s.mpage||1)+1) }));

  // ===== Bouton RETOUR du navigateur / de la tablette =====
  // L'app est une page unique : sans ceci, « Retour » quitterait tout au lieu de
  // fermer le manuel ou de revenir à l'écran précédent. On synchronise l'historique.
  appDepth(){
    var S=this.state, d=0;
    if(S.view!=='home') d += (S.view==='quiz' ? 2 : 1);
    if(S.showInstallHelp) d += 1;
    if(S.mpage!=null) d += 1;
    if(S.imgView) d += 1;
    if(S.rrcInfoOpen) d += 1;
    return d;
  }
  navBackOne(){
    var S=this.state;
    if(S.imgView){ this.setState({ imgView:null }); return; }
    if(S.mpage!=null){ this.setState({ mpage:null }); return; }
    if(S.rrcInfoOpen){ this.setState({ rrcInfoOpen:false }); return; }
    if(S.showInstallHelp){ this.setState({ showInstallHelp:false }); return; }
    if(S.view==='quiz'){ this.setState({ view:'module', graded:false }); return; }
    if(S.view!=='home'){ this.setState({ view:'home', graded:false, answers:{} }); return; }
  }
  syncHistory(){
    try{
      if(!window.history || !history.pushState) return;
      if(this._appDepth===undefined) this._appDepth=0;
      var d=this.appDepth();
      if(d>this._appDepth){
        for(var i=this._appDepth;i<d;i++) history.pushState({rbDepth:i+1},'');
        this._appDepth=d;
      } else if(d<this._appDepth){
        var diff=d-this._appDepth;   // négatif : repli via un bouton interne → on retire les entrées en trop
        this._suppressPop=true;
        this._appDepth=d;
        history.go(diff);
      }
    }catch(e){}
  }
  manualPagesFor(idx){
    var seq=(a,b)=>{ var r=[]; for(var i=a;i<=b;i++) r.push(i); return r; };
    var MAP=[
      [1,2,3,4,5,6,7,8,9],        // 01 : Découvrir (pages liminaires + présentation)
      [10,11,12],                 // 02 : Sécurité
      [13,14,15,16],              // 03 : Composants & commandes
      [17,18,19,20,21,22,23,24,44],// 04 : Télécommande radio (+ batterie p.44)
      seq(25,43),                 // 05 : IHM, réglages & diagnostics
      seq(45,54),                 // 06 : Mise en route & déplacement
      seq(55,66),                 // 07 : Manutention des tiges
      seq(67,87)                  // 08 : Dépannage & entretien + annexes
    ];
    var pages=MAP[idx]||[];
    var self=this, seen={};
    return pages.map(function(pg){ return self.mp(pg); })
      .filter(function(ep){ if(seen[ep]) return false; seen[ep]=true; return true; })
      .map(function(ep){ return { n:ep, src:self.manualImg(ep), href:self.pdfAt(ep), open:(function(x){ return function(){ self.openManual(x); }; })(ep) }; });
  }
  warnStyle(w){
    if(w==="danger") return { wIcon:"⛔", wBg:"rgba(217,38,36,.1)", wBorder:"rgba(217,38,36,.55)", wSolid:"#D92624", wFg:"#B71F1D", wLabel:"DANGER" };
    if(w==="warn")   return { wIcon:"⚠️", wBg:"rgba(232,163,58,.15)", wBorder:"rgba(214,144,36,.5)",  wSolid:"#E8A33A", wFg:"#8A5A10", wLabel:"ATTENTION" };
    return { wIcon:"ℹ️", wBg:"rgba(55,99,168,.09)", wBorder:"rgba(55,99,168,.32)", wSolid:"#3763A8", wFg:"#2F4F83", wLabel:"À SAVOIR" };
  }
  // Découpe un paragraphe en phrases courtes (pour un affichage en points, lecture facilitée)
  splitSentences(t){
    if(!t) return [];
    var SENT=String.fromCharCode(1);
    var s=String(t).replace(/\b(p|pp|ex|cf|no|art|min|max|env|réf|fig|sect|iso|sae|ep|vg|m|n)\.\s/gi, function(m){ return m.slice(0,-1)+SENT; });
    var parts=s.split(/(?<=[.!?:])\s+(?=[A-ZÀ-Ÿ«])/);
    var re=new RegExp(SENT,"g");
    return parts.map(function(x){ return x.replace(re," ").trim(); }).filter(function(x){ return x.length>0; });
  }  optStyle(checked,isSel,isCorrectOpt){
    if(!checked){
      return isSel
        ? { bg:"rgba(217,38,36,.06)", border:"#D92624", badgeBg:"#D92624", badgeFg:"#FFFFFF", badgeBorder:"#D92624", textColor:"#1D1E1B" }
        : { bg:"#FFFFFF", border:"rgba(29,30,27,.18)", badgeBg:"transparent", badgeFg:"#535252", badgeBorder:"rgba(29,30,27,.3)", textColor:"#2A2B28" };
    }
    if(isCorrectOpt) return { bg:"rgba(62,156,90,.13)", border:"#2F7D48", badgeBg:"#2F7D48", badgeFg:"#FFFFFF", badgeBorder:"#2F7D48", textColor:"#1D1E1B" };
    if(isSel) return { bg:"rgba(217,38,36,.1)", border:"#D92624", badgeBg:"#D92624", badgeFg:"#FFFFFF", badgeBorder:"#D92624", textColor:"#1D1E1B" };
    return { bg:"#FFFFFF", border:"rgba(29,30,27,.13)", badgeBg:"transparent", badgeFg:"#989898", badgeBorder:"rgba(29,30,27,.2)", textColor:"#6A6A66" };
  }
  quizAnswerText(q){
    const L=["A","B","C","D","E","F"];
    if(q.type==="multi") return this.tr("Bonnes réponses : ","Correct answers: ")+(q.correct||[]).map(i=>L[i]).join(", ");
    if(q.type==="order") return this.tr("Ordre correct : ","Correct order: ")+(q.correct||[]).map((i,pos)=>(pos+1)+") "+q.options[i]).join("  ·  ");
    if(q.type==="cloze") return this.tr("Réponse : ","Answer: ")+q.options[q.correct];
    return this.tr("Réponse : ","Answer: ")+L[q.correct]+") "+q.options[q.correct];
  }

  moduleDone(i){ return !!this.state.completed[i]; }
  moduleScore(i){ return this.state.completed[i] ? this.state.completed[i].score : 0; }
  allDone(){ return this.M().every((m,i)=>this.moduleDone(i)); }

  goHome = ()=> this.setState({ view:"home", graded:false, answers:{} });
  openModule = (i)=> this.setState({ view:"module", activeId:i, openKey:null });
  toggleSection = (key)=> this.setState(s=>({ openKey: s.openKey===key ? null : key }));
  startQuiz = ()=> { this.setState({ view:"quiz", qIdx:0, qSel:null, qChecked:false, qResults:[], graded:false }); window.scrollTo(0,0); };
  backToModule = ()=> this.setState({ view:"module", graded:false });
  retryQuiz = ()=> { this.setState({ qIdx:0, qSel:null, qChecked:false, qResults:[], graded:false }); window.scrollTo(0,0); };
  setName = (e)=>{ const v=e.target.value; this.setState({name:v}, ()=>this.persist()); };
  scrollToSafety = ()=>{ const el=document.getElementById("rb-safety"); if(el){ const y=el.getBoundingClientRect().top+window.scrollY-80; window.scrollTo({top:y,behavior:"smooth"}); } };
  startFirst = ()=>{ const first=this.M().findIndex((m,i)=>!this.moduleDone(i)); this.openModule(first===-1?0:first); };

  // ===== Moteur de quiz typé (choix unique, vrai/faux, sélection multiple, remise en ordre, texte à trou) =====
  quizFor(idx){
    var Q2 = (this.state.lang==="en" && typeof QUIZ2_EN!=="undefined") ? QUIZ2_EN : (typeof QUIZ2!=="undefined"?QUIZ2:null);
    if(Q2 && Q2[idx]) return Q2[idx];
    const mod=this.M()[idx];
    return (mod?mod.quiz:[]).map(q=>({ type:"qcm", text:q.text, options:q.options, correct:q.correct, page:0, fb:"" }));
  }
  // Réponse unique (choix unique, vrai/faux, texte à trou) : le clic valide et
  // affiche la rétroaction IMMÉDIATEMENT : aucun bouton « Valider » à toucher.
  quizPickOne = (oi)=>{
    if(this.state.qChecked) return;
    const q=this.quizFor(this.state.activeId)[this.state.qIdx];
    const ok=this.quizCorrect(q,oi);
    this.setState(s=>({ qSel:oi, qChecked:true, qResults:s.qResults.concat([ok]) }));
  };
  quizToggle = (oi)=>{ if(this.state.qChecked) return; this.setState(s=>{ const cur=Array.isArray(s.qSel)?s.qSel.slice():[]; const j=cur.indexOf(oi); if(j>=0) cur.splice(j,1); else cur.push(oi); return { qSel:cur }; }); };
  quizOrderReset = ()=>{ if(this.state.qChecked) return; this.setState({ qSel:[] }); };
  quizHasAnswer(q,sel){ if(q.type==="multi") return Array.isArray(sel)&&sel.length>0; if(q.type==="order") return Array.isArray(sel)&&sel.length===q.options.length; return sel!==null&&sel!==undefined; }
  quizCorrect(q,sel){
    if(q.type==="multi"){ const a=(sel||[]).slice().sort((x,y)=>x-y), b=(q.correct||[]).slice().sort((x,y)=>x-y); return a.length===b.length&&a.every((v,i)=>v===b[i]); }
    if(q.type==="order"){ const a=sel||[], b=q.correct||[]; return a.length===b.length&&a.every((v,i)=>v===b[i]); }
    return sel===q.correct;
  }
  quizCheck = ()=>{
    if(this.state.qChecked) return;
    const q=this.quizFor(this.state.activeId)[this.state.qIdx];
    if(!this.quizHasAnswer(q,this.state.qSel)) return;
    const ok=this.quizCorrect(q,this.state.qSel);
    this.setState(s=>({ qChecked:true, qResults:s.qResults.concat([ok]) }));
    window.scrollTo(0,0);
  };
  quizNext = ()=>{
    const list=this.quizFor(this.state.activeId);
    const next=this.state.qIdx+1;
    if(next<list.length){ this.setState({ qIdx:next, qSel:null, qChecked:false }); window.scrollTo(0,0); return; }
    const correct=this.state.qResults.filter(Boolean).length;
    const pct=Math.round(correct/list.length*100);
    const passed=pct>=70;
    this.setState(s=>{
      const completed={...s.completed};
      if(passed) completed[s.activeId]={ score: Math.max(pct,(completed[s.activeId]&&completed[s.activeId].score)||0) };
      return { graded:true, lastScore:pct, lastPassed:passed, completed };
    }, ()=>this.persist());
    window.scrollTo(0,0);
  };
  goToNextModule = ()=>{
    const next=this.state.activeId+1;
    if(next<this.M().length) this.setState({ view:"module", activeId:next, openKey:null, graded:false, qIdx:0, qSel:null, qChecked:false, qResults:[] });
    else if(this.allDone()) this.setState({ view:"cert" });
    else this.goHome();
  };

  renderVals(){
    const S=this.state, M=this.M();
    const total=M.length;
    const doneCount=M.filter((m,i)=>this.moduleDone(i)).length;
    const totalSections=M.reduce((a,m)=>a+m.sections.length,0);

    const base={
      isHome:S.view==="home", isModule:S.view==="module", isQuiz:S.view==="quiz", isCert:S.view==="cert",
      totalModules:total, doneCount, totalSections,
      progressPct: Math.round(doneCount/total*100), passPct:70,
      manualUrl:this.manualBase(), raUrl:this.RA,
      goHome:this.goHome, startFirst:this.startFirst, scrollToSafety:this.scrollToSafety,
      ctaLabel: doneCount===0 ? "Commencer la formation" : (this.allDone() ? "Revoir la formation" : "Continuer la formation")
    };

    base.moduleCards = M.map((m,i)=>{
      const done=this.moduleDone(i);
      return {
        num:m.num, title:m.title, subtitle:m.subtitle, sectionCount:m.sections.length, pages:m.pages,
        bar: done ? "#3E9C5A" : "#1D1E1B",
        statusLabel: done ? ("VALIDÉ "+this.moduleScore(i)+"%") : "À FAIRE",
        statusBg: done ? "#3E9C5A" : "#1D1E1B",
        statusFg: done ? "#FFFFFF" : "#FFFFFF",
        open: ()=>this.openModule(i)
      };
    });

    base.estops = [
      { where:this.tr("PANNEAU BASSE TENSION","LOW-VOLTAGE PANEL"), detail:this.tr("Immédiatement sous l'IHM à écran tactile","Directly below the touchscreen HMI") },
      { where:this.tr("TÉLÉCOMMANDE RADIO","RADIO REMOTE"), detail:this.tr("Au centre, en bas de la RRC","Center, bottom of the RRC") },
      { where:this.tr("CHÂSSIS DU RODBOT","RODBOT CHASSIS"), detail:this.tr("Coin inférieur avant droit","Lower front-right corner") },
      { where:this.tr("COMMANDES MANUELLES","MANUAL CONTROLS"), detail:this.tr("À l'arrière, près des leviers hydrauliques","At the rear, near the hydraulic levers") }
    ];

    const mod = S.activeId!=null ? M[S.activeId] : null;
    if(mod){
      const done=this.moduleDone(S.activeId);
      const modNum=Number(mod.num);
      const firstPage=mod.sections.length?mod.sections[0].page:1;
      base.mod={
        num:mod.num, title:mod.title, intro:mod.intro, chapters:mod.chapters, pages:mod.pages,
        pdfHref:this.pdfAt(this.mp(firstPage)), openManual:()=>this.openManual(this.mp(firstPage)), sectionCount:mod.sections.length,
        quizLen:mod.quiz.length, done, score:this.moduleScore(S.activeId),
        quizCta: done ? this.tr("Repasser le quiz","Retake the quiz") : this.tr("Passer le quiz","Take the quiz"),
        manualPages: this.manualPagesFor(S.activeId),
        manualCount: this.manualPagesFor(S.activeId).length,
        sections: mod.sections.map((sec,si)=>{
          const key=S.activeId+"-"+si;
          const open=S.openKey===key;
          const ENR_SRC = (this.state.lang==="en" && typeof ENRICH_EN!=="undefined") ? ENRICH_EN : (typeof ENRICH!=="undefined"?ENRICH:null);
          const enr = (ENR_SRC && ENR_SRC[key]) ? ENR_SRC[key] : {};
          const figDir = (this.state.lang==="en") ? "img/fig-en/" : "img/fig/";
          const figBlocks = (enr.figures||[]).map(f=>({ t:"img", src:figDir+"p"+(f.page<10?"0"+f.page:f.page)+".jpg", cap:f.cap||"", page:f.page }));
          // Anti-doublon : quand l'enrichissement fournit de la prose/liste (version courte),
          // on retire la prose LONGUE de base mais on garde ses tableaux (specs) et avertissements.
          // On évite aussi d'afficher deux fois le même tableau.
          const enrBlocks = enr.blocks||[];
          const enrHasProse = enrBlocks.some(b=>b.t==="p"||b.t==="ul"||b.t==="steps");
          const baseHasSpecs = sec.blocks.some(b=>b.t==="specs");
          const baseKept = sec.blocks.filter(b=>(b.t==="p"||b.t==="ul"||b.t==="steps") ? !enrHasProse : true);
          const enrKept = enrBlocks.filter(b=> b.t==="specs" ? !baseHasSpecs : true);
          const allBlocks = baseKept.concat(enrKept).concat(figBlocks);
          const hasDanger=allBlocks.some(b=>b.t==="warn"&&b.w==="danger");
          return {
            ref:modNum+"."+(si+1), title:sec.title, page:this.mp(sec.page), pdfHref:this.pdfAt(this.mp(sec.page)), openPage:()=>this.openManual(this.mp(sec.page)),
            accent: hasDanger ? "#D92624" : "#1D1E1B",
            open, chevron: open?"rotate(180deg)":"rotate(0deg)", toggle:()=>this.toggleSection(key),
            blocks: allBlocks.map(b=>{
              const o={ isP:b.t==="p", isUl:b.t==="ul", isSteps:b.t==="steps", isSpecs:b.t==="specs", isWarn:b.t==="warn", isImg:b.t==="img", isSub:b.t==="sub", text:b.text||"" };
              if(b.t==="p") o.lines=this.splitSentences(b.text);
              // Puces sur deux niveaux : un item peut être une chaîne, ou {text, sub:[...]}
              if(b.t==="ul") o.items=(b.items||[]).map(function(it){ return (typeof it==="string") ? { text:it, sub:[], hasSub:false } : { text:it.text||"", sub:it.sub||[], hasSub:!!(it.sub&&it.sub.length) }; });
              if(b.t==="steps") o.steps=b.items.map((tx,ix)=>({ n:ix+1, text:tx }));
              if(b.t==="specs") o.rows=b.rows.map(r=>({ k:r[0], v:r[1] }));
              if(b.t==="warn") Object.assign(o, this.warnStyle(b.w));
              if(b.t==="img"){ o.src=b.src; o.cap=b.cap||""; o.imgPage=this.mp(b.page); o.imgHref=this.pdfAt(this.mp(b.page)); o.openPage=()=>this.openManual(this.mp(b.page)); }
              return o;
            })
          };
        })
      };

      const LETTERS=["A","B","C","D","E","F"];
      const TYPEL={qcm:this.tr("Choix unique","Single choice"),vf:this.tr("Vrai ou faux","True or false"),multi:this.tr("Sélection multiple, cochez toutes les bonnes réponses","Multiple select, check all correct answers"),order:this.tr("Remettez dans le bon ordre","Put in the correct order"),cloze:this.tr("Texte à trou","Fill in the blank")};
      base.quizActive=!S.graded;
      base.quizGraded=S.graded;
      const qlist=this.quizFor(S.activeId);
      const qi=Math.min(S.qIdx,qlist.length-1), q=qlist[qi]||qlist[0];
      const sel=S.qSel, checked=S.qChecked;
      const single=q.type==="qcm"||q.type==="vf"||q.type==="cloze", isMulti=q.type==="multi", isOrder=q.type==="order";
      const hasAns=this.quizHasAnswer(q,sel);
      base.quiz={
        num:qi+1, total:qlist.length, typeLabel:TYPEL[q.type]||"Question", text:q.text,
        isSingle:single, isMulti:isMulti, isOrder:isOrder, isCloze:q.type==="cloze", checked:checked, notChecked:!checked,
        showValidate:(isMulti||isOrder)&&!checked,   // bouton « Valider » seulement pour sélection multiple / remise en ordre
        showTapHint:single&&!checked,                 // « Touchez une réponse » pour les questions à réponse unique
        progressPct:Math.round(((qi+(checked?1:0))/qlist.length)*100),
        orderReset:this.quizOrderReset, hasAnswer:hasAns,
        options:q.options.map((o,oi)=>{
          const isSel=single?sel===oi:(Array.isArray(sel)&&sel.indexOf(oi)>=0);
          const orderPos=isOrder&&Array.isArray(sel)?sel.indexOf(oi):-1;
          let isCorrectOpt=false;
          if(single) isCorrectOpt=(oi===q.correct); else if(isMulti) isCorrectOpt=((q.correct||[]).indexOf(oi)>=0);
          const st=this.optStyle(checked,isSel,isCorrectOpt);
          const badge=isMulti?(isSel?"✓":""):(isOrder?(orderPos>=0?String(orderPos+1):"+"):LETTERS[oi]);
          return { text:o, badge:badge, pick:single?(()=>this.quizPickOne(oi)):(()=>this.quizToggle(oi)),
                   bg:st.bg, border:st.border, badgeBg:st.badgeBg, badgeFg:st.badgeFg, badgeBorder:st.badgeBorder, textColor:st.textColor };
        }),
        checkBg:hasAns?"#1D1E1B":"rgba(29,30,27,.12)", checkFg:hasAns?"#FAF9F5":"rgba(29,30,27,.42)", checkCursor:hasAns?"pointer":"not-allowed",
        check:this.quizCheck, next:this.quizNext,
        nextLabel:(qi+1<qlist.length)?this.tr("Question suivante →","Next question →"):this.tr("Voir mon résultat →","See my result →")
      };
      if(checked){
        const ok=this.quizCorrect(q,sel);
        base.quiz.fb={ ok:ok, label:ok?this.tr("✓ Bonne réponse","✓ Correct answer"):this.tr("✗ Réponse incorrecte","✗ Incorrect answer"),
          bg:ok?"rgba(62,156,90,.1)":"rgba(217,38,36,.08)", bar:ok?"#2F7D48":"#D92624", fg:ok?"#2F7D48":"#B71F1D",
          text:q.fb||"", answerText:this.quizAnswerText(q), page:this.mp(q.page||0), pageHref:this.pdfAt(this.mp(q.page||1)), hasPage:!!q.page, open:(()=>this.openManual(this.mp(q.page||1))) };
      } else { base.quiz.fb=null; }

      const passed=S.lastPassed;
      const lastModule=S.activeId===M.length-1;
      base.result={
        scorePct:S.lastScore,
        ringBg: passed?"rgba(62,156,90,.14)":"rgba(217,38,36,.1)",
        ringFg: passed?"#2F7D48":"#B71F1D",
        title: passed?this.tr("Module validé !","Module passed!"):this.tr("Pas tout à fait…","Not quite…"),
        message: passed
          ? this.tr("Vous maîtrisez les points clés de ce module. Poursuivez avec le module suivant ou revenez au parcours.","You've mastered this module's key points. Continue to the next module or go back to the path.")
          : this.tr("Il faut au moins 70 % pour valider. Revoyez les leçons du module puis retentez le quiz.","You need at least 70% to pass. Review the module lessons, then retake the quiz."),
        nextLabel: !passed?this.tr("Revoir le module","Review the module"):(lastModule?(this.allDone()?this.tr("Voir mon attestation","See my certificate"):this.tr("Retour au parcours","Back to the path")):this.tr("Module suivant","Next module")),
        nextAction: !passed?this.backToModule:(lastModule?(this.allDone()?()=>this.setState({view:"cert"}):this.goHome):this.goToNextModule)
      };
      base.retryQuiz=this.retryQuiz; base.backToModule=this.backToModule; base.startQuiz=this.startQuiz;
    }

    // ===== SIMULATEURS =====
    base.isSim = S.view==="sim";
    base.openSimRrc = ()=>this.openSim("rrc");
    base.openSimMast = ()=>this.openSim("mast");
    base.openSimModes = ()=>this.openSim("modes");
    base.simTabRrc = S.simTab==="rrc";
    base.simTabMast = S.simTab==="mast";
    base.simTabModes = S.simTab==="modes";
    const tabOn=["#FAF9F5","#1D1E1B"], tabOff=["rgba(255,255,255,.08)","#989898"];
    [["Rrc","rrc"],["Mast","mast"],["Modes","modes"]].forEach(([cap,id])=>{
      const on=S.simTab===id;
      base["tab"+cap+"Bg"]=on?tabOn[0]:tabOff[0];
      base["tab"+cap+"Fg"]=on?tabOn[1]:tabOff[1];
    });

    // RRC
    base.estopped = S.estopped;
    base.resetEstop = this.resetEstop;
    base.rrcSpots = this.spots().map((sp,i)=>{
      const sel = S.rrcSel===i;
      const isE = !!sp.estop;
      return {
        n:i+1, x:sp.x, y:sp.y, name:sp.name, pick:()=>this.pickSpot(i),
        bg: (sel||isE) ? "#D92624" : "#1D1E1B",   // badge (coin) : rempli
        fg: "#FFFFFF",                             // numéro
        ring: (sel||isE) ? "#D92624" : "#FAF9F5",  // anneau autour de la commande (centre vide)
        halo: sel ? "rgba(217,38,36,.5)" : "rgba(20,20,19,.6)"
      };
    });
    const selSp = this.spots()[S.rrcSel] || this.spots()[0];
    base.rrcSelN = S.rrcSel+1;
    base.rrcSelName = selSp.name;
    base.rrcSelDesc = selSp.desc;
    base.rrcSelPage = this.mp(selSp.page);
    base.rrcSelHref = this.pdfAt(selSp.page);
    base.rrcSelOpen = ()=>this.openManual(this.mp(selSp.page));
    base.rrcInfoOpen = S.rrcInfoOpen;
    base.closeRrcInfo = this.closeRrcInfo;

    // MÂT
    base.slew=S.slew; base.hoist=S.hoist; base.ext=S.ext; base.tilt=S.tilt;
    base.extPct = Math.round(S.ext/110*100);
    base.setSlew=(e)=>this.setJoint("slew",e);
    base.setHoist=(e)=>this.setJoint("hoist",e);
    base.setExt=(e)=>this.setJoint("ext",e);
    base.setTilt=(e)=>this.setJoint("tilt",e);
    base.boomRot = 180 + S.hoist;
    base.outerLen = 60 + S.ext;
    base.wristX = 210 + S.ext;
    base.wristRot = -(180 + S.hoist);
    base.jawLRot = S.jawOpen ? -34 : -4;
    base.jawRRot = S.jawOpen ? 34 : 4;
    base.rodHeld = !S.jawOpen;
    base.rodDropped = S.jawOpen;
    base.toggleJaw = this.toggleJaw;
    base.jawBtnLabel = S.jawOpen ? "✊ FERMER le grappin (saisir la tige)" : "🖐 OUVRIR le grappin (bouton vert + bascule ≥ 1 s)";
    base.jawBtnBg = S.jawOpen ? "#3E9C5A" : "#1D1E1B";
    base.jawBtnFg = S.jawOpen ? "#FFFFFF" : "#FFFFFF";
    base.mastReadout = "J2 "+S.hoist+"° · J3 "+base.extPct+"% · J6 "+S.tilt+"°";

    // MODES
    const curMode = this.simModesData().find(m=>m.id===S.simMode);
    base.simModes = this.simModesData().map(m=>{
      const on = m.id===S.simMode;
      return {
        name:m.id, tag:m.tag, pick:()=>this.pickMode(m.id),
        bg: on?"rgba(217,38,36,.06)":"#FFFFFF", fg: on?"#1D1E1B":"#535252",
        border: on?"#D92624":"rgba(29,30,27,.16)",
        tagFg: on?"#D92624":"#989898"
      };
    });
    base.simModeName = curMode.id;
    base.simModeDesc = curMode.desc;
    base.beaconColor = curMode.beacon==="off" ? "#3A3B38" : "#F0A81E";
    base.beaconGlow = curMode.beacon==="off" ? "none" : "0 0 26px rgba(240,168,30,.85)";
    base.beaconAnim = curMode.beacon==="blink" ? "rbPulse 1s ease-in-out infinite" : "none";
    base.klaxonOn = S.klaxon;
    base.valveTracks = curMode.tracks ? "OUVERTE" : "FERMÉE";
    base.valveTracksFg = curMode.tracks ? "#2F7D48" : "#535252";
    base.valveMast = curMode.mast ? "OUVERTE" : "FERMÉE";
    base.valveMastFg = curMode.mast ? "#2F7D48" : "#535252";

    base.traineeName=S.name; base.setName=this.setName;
    base.certDate=new Date().toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"});
    // ===== Visionneur intégré du manuel (fiable sur tout appareil) =====
    base.manual = S.mpage ? {
      page:S.mpage, total:this.manualTotal(), src:this.manualImg(S.mpage), pdfHref:this.pdfAt(S.mpage),
      prev:this.manualPrev, next:this.manualNext, close:this.closeManual,
      hasPrev:S.mpage>1, hasNext:S.mpage<this.manualTotal(), noop:function(e){ if(e&&e.stopPropagation) e.stopPropagation(); }
    } : null;

    // ===== Galerie « L'équipement en photos » (accueil) + visionneuse d'image =====
    var self=this;
    base.equip = [
      { src:"img/eq-machine-real.png", pos:"50% 46%",
        tag:this.tr("LA VRAIE MACHINE","THE REAL MACHINE"),
        desc:this.tr("Le RodBot LP en atelier : bras robotisé rouge, bac à tiges et base sur chenilles, l'ensemble que vous piloterez.","The RodBot LP in the shop: red robotic arm, rod basket and tracked base, the machine you'll operate.") },
      { src:"img/telecommande-annotee.png", pos:"50% 50%",
        tag:this.tr("LA TÉLÉCOMMANDE","THE REMOTE"),
        desc:this.tr("Schéma complet de la radio-télécommande (RRC) : joysticks JS1-JS3, modes, e-stop, klaxon, aimant, grappin. Cliquez pour agrandir.","Full diagram of the Radio Remote Control (RRC): JS1-JS3 joysticks, modes, e-Stop, horn, magnet, gripper. Click to enlarge.") },
      { src:"img/eq-hmi.png", pos:"50% 30%",
        tag:this.tr("L'IHM EMBARQUÉE","THE ON-BOARD HMI"),
        desc:this.tr("L'écran tactile du panneau : modes, diagnostics, alarmes et calibrage, détaillé au module 05.","The panel touchscreen: modes, diagnostics, alarms and calibration, detailed in module 05.") },
      { src:"img/eq-labeled.png", pos:"50% 42%",
        tag:this.tr("LE BAC À TIGES","THE ROD BASKET"),
        desc:this.tr("Plateau amovible de 35 tiges, pattes de retenue latérales et fourreaux de fourches pour la manutention.","Removable 35-rod rack, side retention tabs and fork pockets for handling.") },
      { src:"img/eq-panel.png", pos:"50% 12%",
        tag:this.tr("PANNEAU & ARRÊT D'URGENCE","PANEL & EMERGENCY STOP"),
        desc:this.tr("Le panneau basse tension : champignon d'arrêt d'urgence, manomètre, sectionneur d'aimant et valves hydrauliques.","The low-voltage panel: emergency-stop mushroom button, pressure gauge, magnet switch and hydraulic valves.") },
      { src:"img/eq-track.png", pos:"50% 55%",
        tag:this.tr("LES CHENILLES","THE TRACKS"),
        desc:this.tr("Train de roulement en caoutchouc, contrôle de la flèche (mou) de 20 à 25 mm, couvert à l'entretien (module 08).","Rubber track undercarriage, track sag check of 20 to 25 mm, covered under maintenance (module 08).") }
    ].map(function(x){ return { src:x.src, tag:x.tag, desc:x.desc, pos:x.pos, open:(function(s,c){ return function(){ self.openImg(s,c); }; })(x.src,x.tag) }; });

    base.imgView = S.imgView;
    base.closeImg = this.closeImg;
    base.stopEvt = function(e){ if(e&&e.stopPropagation) e.stopPropagation(); };
    base.rrcAnnotOpen = function(){ self.openImg("img/telecommande-annotee.png", self.tr("Télécommande radio, schéma annoté complet","Radio remote, full annotated diagram")); };

    // ===== Installation de l'app (PWA) =====
    var standalone=false;
    try { standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone===true; } catch(e){}
    base.showInstall = !standalone;
    base.installApp = this.installApp;
    base.showInstallHelp = S.showInstallHelp;
    base.closeInstallHelp = this.closeInstallHelp;
    base.isIOS = /iP(hone|ad|od)/.test(navigator.userAgent||"");
    // Bascule de langue FR / EN (dans l'en-tête)
    base.lang = S.lang;
    base.setLangFr = ()=>this.setLang("fr");
    base.setLangEn = ()=>this.setLang("en");
    var _actS="background:#D92624;color:#FFFFFF;", _inS="background:transparent;color:#B8B7B2;";
    base.langFrStyle = (S.lang==="en") ? _inS : _actS;
    base.langEnStyle = (S.lang==="en") ? _actS : _inS;
    base.appVersion = APP_VERSION;
    base.appVersionDate = this.tr(APP_VERSION_DATE, "JUL 15, 2026");

    base.certModules=M.map((m,i)=>({ num:m.num, short:m.short, score:this.moduleScore(i) }));
    const scores=M.map((m,i)=>this.moduleScore(i));
    base.overallScore= scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):0;

    return base;
  }
}


/* ===== Données anglaises (EN) : générées par traduction, sélectionnées via this.state.lang ===== */
var MODULES_EN = [
  {
    num:"01", title:"Getting to Know the RodBot LP", short:"Overview", chapters:"1", pages:"6-9",
    subtitle:"What the machine is, its components, its three mast control modes and its technical specifications.",
    intro:"Borterra's RodBot LP eliminates the manual handling of drill rods, one of the leading causes of drill-related accidents. This module introduces the machine, its components and its capabilities.",
    sections:[
      { title:"What is the RodBot LP?", page:6, blocks:[
        {t:"p", text:"A hydraulic robotic drill-rod handling system, designed to load and unload rods smoothly. It adapts to a wide range of equipment: drills, rod baskets and pallets."},
        {t:"p", text:"Track-mounted, it carries a removable rod basket and repositions itself inside the hole. Electrical and hydraulic power come from a wired connection to the drill; this link also ties together the emergency stop circuits of both machines."},
        {t:"warn", w:"note", text:"The machine is primarily operated by Radio Remote Control (RRC) : the operator stays clear of the rods."} ]},
      { title:"The three mast control modes", page:6, blocks:[
        {t:"ul", items:[
          "DIRECT (\"manual by remote\") : each joint movement is activated individually with the joystick, like conventional heavy machinery.",
          "LINEAR : the rod moves in a straight line (X, Y or Z) with a single joystick movement; the system operates several hydraulic valves at once. The operator retains individual control of the wrist, rotation and tilt.",
          "TRAJECTORY : the mast moves automatically between points recorded by the operator, following a computed path that minimizes time and avoids collisions."] } ]},
      { title:"Main components", page:7, blocks:[
        {t:"ul", items:["Telescoping mast (robotic arm) on a pedestal","Gripper (jaws) with electromagnet","Removable rod basket","Tracks and stabilizer cylinders","24 V electrical panel with touch HMI","Radio remote control unit and storage compartment","Amber beacon"] } ]},
      { title:"Dimensions & rod handling", page:8, blocks:[
        {t:"specs", rows:[["Empty weight","5,800 lb"],["Weight with empty basket","6,500 lb"],["Length × width","116 × 60 in"],["Minimum height","90 in"],["Max load (general use)","308 lb"],["Max load (electromagnet)","120 lb"],["Rods","Ø 5 in × 6 ft"],["Basket capacity","35 rods"],["Max vertical reach (from ground)","159 in"],["Max horizontal reach (from axis)","119 in"]] } ]},
      { title:"Power & carrier", page:8, blocks:[
        {t:"specs", rows:[["Electrical","120 V AC · 4.5 A max"],["Hydraulic","2,500-3,000 psi · 80 L/min"],["Pump required","Variable displacement, load sensing"],["Connection assembly","30 ft"],["Brakes","Spring-applied (SAHR), hydrostatic"],["Ground clearance","10 in"],["Max grade, empty basket","35° / 70 %"],["Max grade, full basket","28° / 53 %"],["Max grade, handling","15° / 27 %"],["Max speed","2.8 km/h"]] },
        {t:"warn", w:"warn", text:"Maximum grades are calculated for the transport pose. Moving the mast out of this pose shifts the center of gravity and reduces stability."} ]}
    ],
    quiz:[
      { text:"How many rods can the RodBot basket hold?", options:["20","35","50"], correct:1 },
      { text:"What are the three mast control modes?", options:["DIRECT, LINEAR, TRAJECTORY","MANUAL, SEMI-AUTO, AUTO","LOCAL, REMOTE, STANDBY"], correct:0 },
      { text:"What is the maximum electromagnet lifting load?", options:["308 lb","120 lb","500 lb"], correct:1 },
      { text:"Where does the RodBot get its power?", options:["From an onboard diesel engine","From onboard batteries","From a wired connection to the drill (electrical + hydraulic)"], correct:2 }
    ]
  },
  {
    num:"02", title:"Safety First", short:"Safety", chapters:"2", pages:"10-12",
    subtitle:"Operating instructions, manual pictograms, mindfulness practice and the four emergency stops.",
    intro:"The list of instructions covers adding the radio remote and trajectory planning. Only trained and authorized personnel may commission or operate this system.",
    sections:[
      { title:"Operating instructions", page:10, blocks:[
        {t:"ul", items:[
          "The manufacturer accepts no liability for improper use or arbitrary modifications to the equipment.",
          "The operator must have read and understood the manual and follow the recommended maintenance schedules.",
          "Operation, maintenance and repair are reserved for trained personnel who are aware of the hazards.",
          "Comply with general and local health and safety regulations."] } ]},
      { title:"The manual's pictograms", page:10, blocks:[
        {t:"ul", items:[
          "DANGER : indicates a life-threatening situation; these situations must be avoided.",
          "WARNING : information of critical importance for safety.",
          "CAUTION : prevention of the risk of injury and/or property damage."] },
        {t:"warn", w:"warn", text:"The manual's procedures never replace caution. Comply with regional regulations and the rules specific to the site and the company."} ]},
      { title:"Safe mindfulness practice", page:11, blocks:[
        {t:"ul", items:[
          "Only operate the system if you are trained, authorized, and in good physical and mental condition, never under the influence of alcohol or drugs.",
          "Read and understand all labels before use.",
          "Never remove guards and safety covers while the system is energized.",
          "It is the operator's responsibility to be aware of conditions and the presence of personnel in the work area.",
          "Only perform maintenance/repair if you are authorized and qualified; spare parts identical or equivalent to the original parts.",
          "Resolve all malfunctions before returning to service; do not operate the machine if an error is reported in the control system.",
          "Outdoors: do not operate the system during a thunderstorm or in high winds (above 65 km/h).",
          "Clean up oil spills or leaks before commissioning."] },
        {t:"warn", w:"danger", text:"Fluids under pressure, risk of subcutaneous injection from a high-pressure hydraulic oil leak. If injured: contact emergency medical services IMMEDIATELY (risk of gangrene and severe reactions)."} ]},
      { title:"The four emergency stops", page:12, blocks:[
        {t:"p", text:"Four emergency stops immediately halt all movement. If the signal is linked to the parent drill, activating an emergency stop on either machine triggers the shutdown of both."},
        {t:"specs", rows:[["Low-voltage control panel","Immediately below the touch HMI"],["Radio remote","Center, bottom"],["RodBot chassis","Lower front right corner"],["Manual controls","At the rear, near the hydraulic levers"]] } ]}
    ],
    quiz:[
      { text:"Who is authorized to operate the RodBot?", options:["Any mine employee","Trained, authorized and fit personnel","Anyone accompanied by a supervisor"], correct:1 },
      { text:"How many emergency stops are on the machine?", options:["2","3","4"], correct:2 },
      { text:"In case of a high-pressure fluid injection injury?", options:["Apply a dressing and monitor","Contact emergency medical services immediately","Rinse with water and resume work"], correct:1 },
      { text:"At what wind speed is outdoor use prohibited?", options:["45 km/h","65 km/h","90 km/h"], correct:1 }
    ]
  },
  {
    num:"03", title:"Components & Basic Controls", short:"Controls", chapters:"3 : 5", pages:"13-16",
    subtitle:"The mast segments (J1-J6), the LOCAL/REMOTE switch, the safety reset button and the isolation valves.",
    intro:"Each mast actuator carries a reference number and name. The low-voltage control panel and the hydraulic isolation valves determine who controls the machine, and when nothing can move.",
    sections:[
      { title:"The mast segments (J1 : J6)", page:13, blocks:[
        {t:"specs", rows:[["J1","SLEW"],["J2","ARTICULATION (shoulder)"],["J3","TELESCOPE"],["J4","ROTARY JOINT (wrist)"],["J5","ROTATION"],["J6","TILT"],["End effector","GRIPPER (jaws)"]] },
        {t:"p", text:"Example: the SLEW function corresponds to J1. These names are used everywhere, screens, diagnostics, calibration."} ]},
      { title:"LOCAL / REMOTE operator control switch", page:14, blocks:[
        {t:"p", text:"To use the radio remote, the panel's OPERATOR CONTROL switch must be in the REMOTE position."},
        {t:"warn", w:"note", text:"In LOCAL mode, remote signals are ignored and the \"No Radio\" icon is shown on the HMI."} ]},
      { title:"Safety reset button", page:15, blocks:[
        {t:"p", text:"It \"sets\" the safety circuit at system startup, or re-enables it after an emergency stop has been triggered and then reset."} ]},
      { title:"Main panel display (HMI)", page:15, blocks:[
        {t:"p", text:"The touchscreen displays control-system information; the operator can change certain settings from it. The screens are covered in detail in module 05."} ]},
      { title:"Hydraulic isolation valves", page:16, blocks:[
        {t:"p", text:"Two normally-closed activation/isolation valves are built into the connection manifold: one regulates flow to the tracks and cylinders, the other to all other elements. Their state depends on the MODE chosen by the operator, or on the safety system if it detects an error."},
        {t:"warn", w:"warn", text:"In the event of a power loss, both valves close by default: any hydraulic operation becomes impossible. They can be forced to the open position manually (counterclockwise)."} ]}
    ],
    quiz:[
      { text:"What does J1 correspond to?", options:["The TELESCOPE","The SLEW","The TILT"], correct:1 },
      { text:"The switch is in LOCAL mode. What does the radio remote do?", options:["It works normally","Its movement signals are ignored","It only controls the gripper"], correct:1 },
      { text:"What happens to the isolation valves in the event of a power loss?", options:["They stay in their last state","They open to bleed off pressure","They close, no more hydraulic operation"], correct:2 },
      { text:"What is the safety reset button for?", options:["To restart the HMI","To enable/re-enable the safety circuit","To clear the data logs"], correct:1 }
    ]
  },
  {
    num:"04", title:"The Radio Remote Control", short:"Remote", chapters:"6 · 10", pages:"17-24 · 44",
    subtitle:"Activation, physical key, emergency stop, Rabbit/Turtle modes, tilt switch, indicator light, joysticks, display and battery.",
    intro:"The RRC is built to withstand impacts, dirt and water. Proportional, self-centering joysticks; the emergency stop works in series with those of the RodBot and the parent drill.",
    sections:[
      { title:"Physical key & interlock", page:17, blocks:[
        {t:"warn", w:"note", text:"A physical key is fitted at the top left of the remote. Without it, the RRC will not turn on. Removing it during operation breaks the connection with the receiver and triggers a stop."} ]},
      { title:"Turning the remote on / off", page:17, blocks:[
        {t:"ul", items:[
          "Prerequisite: panel switch set to REMOTE : otherwise no movement message is recognized.",
          "ON: ON button on the left side; the LED indicator at the bottom left of the screen turns green.",
          "OFF: press the remote's emergency stop, then reset it by turning the red mushroom head."] },
        {t:"warn", w:"note", text:"To turn off the RRC without stopping the drill (battery change, power saving): first set the panel switch to LOCAL, then press the remote's e-Stop."} ]},
      { title:"RRC emergency stop", page:18, blocks:[
        {t:"p", text:"The remote's e-Stop controls a relay wired in series with the other emergency stops of the RodBot and the parent drill. In REMOTE mode, one press stops both machines, the same effect as a wired e-Stop."},
        {t:"warn", w:"warn", text:"In LOCAL mode, the remote's emergency stop button does NOT work."} ]},
      { title:"Fast (Rabbit) / Slow (Turtle) modes", page:19, blocks:[
        {t:"p", text:"Applies a scaling factor to all joints in DIRECT, LINEAR and TRAJECTORY modes. Rabbit = maximum speed defined in the valve settings; Turtle = each joint's speed reduced by 50 % : except the gripper."} ]},
      { title:"Tilt switch", page:19, blocks:[
        {t:"p", text:"If the remote is tilted or dropped (operator in difficulty), the RodBot goes into a safety stop: hydraulic power cut off, without triggering the wired drill's e-Stop. As soon as the RRC is returned to level, joysticks at neutral, the system automatically returns to standby."},
        {t:"warn", w:"warn", text:"Daily inspection: check that the tilt switch works properly at the start of every shift."} ]},
      { title:"Amber beacon", page:20, blocks:[
        {t:"ul", items:["ON (steady) : REMOTE CONTROL mode active.","FLASHING : mast in TRAJECTORY mode or machine tramming (CRAWL).","OFF : LOCAL mode."] } ]},
      { title:"Joysticks, buttons & switches", page:21, blocks:[
        {t:"ul", items:[
          "3 proportional joysticks (JS1, JS2, JS3) with return-to-center spring.",
          "Mode selection buttons: STANDBY, DIRECT, LINEAR / ON, STABILIZERS and slew.",
          "Yellow button: TRAJECTORY activation. Green button: gripper activation.",
          "Electromagnet control, horn + beacon, Rabbit/Turtle, screen brightness, work lights, help.",
          "Emergency stop at center, bottom. Status and low-battery indicators."] } ]},
      { title:"Remote display", page:23, blocks:[
        {t:"p", text:"Non-touch screen: the keypad keys above correspond to the icons shown. The display adapts to the RodBot's state: system STATUS indicator, mode type, gripper and magnet state, battery, Slow/Fast mode, basket positions and trajectory points. The yellow box marks the selected item."} ]},
      { title:"Battery: replacement & charging", page:44, blocks:[
        {t:"warn", w:"warn", text:"If the RRC turns off or loses contact during operation (dead battery), the machine treats the event as an emergency stop."},
        {t:"steps", items:[
          "Set the OPERATOR CONTROL selector to LOCAL.",
          "Turn the remote OFF (RRC e-Stop).",
          "Replace the battery.",
          "Turn the remote back ON.",
          "Check that the radio link icon is restored at the bottom of the monitor.",
          "Return the selector to the REMOTE position."] },
        {t:"p", text:"The storage box on the machine contains the charger: insert the battery and charging starts automatically."} ]}
    ],
    quiz:[
      { text:"What happens if the physical key is removed during operation?", options:["Nothing, the key is only for startup","The connection is broken and a stop is triggered","The machine switches to LOCAL mode"], correct:1 },
      { text:"Turtle (slow) mode reduces joint speed by…", options:["25 %","50 % : except the gripper","75 %, including the gripper"], correct:1 },
      { text:"The remote drops to the ground. What does the RodBot do?", options:["It continues its movement","It goes into a safety stop: hydraulics cut off","It triggers the wired drill's e-Stop"], correct:1 },
      { text:"The amber beacon is flashing. That means…", options:["LOCAL mode active","RRC low battery","Mast in TRAJECTORY or tramming in CRAWL"], correct:2 },
      { text:"To replace the battery without triggering an emergency stop, the first step is…", options:["Set the panel selector to LOCAL","Press the RRC e-Stop directly","Disconnect the connection cable"], correct:0 }
    ]
  },
  {
    num:"05", title:"HMI, Settings & Diagnostics", short:"HMI & settings", chapters:"7 : 9", pages:"25-43",
    subtitle:"HMI screens, alarms, 3D view, encoder calibration, slew limits, bypasses, joystick curves and PPU tuning.",
    intro:"The electrical panel's HMI provides access to system status, alarms and calibration settings. Some settings require administrator login and particular vigilance.",
    sections:[
      { title:"HMI home screen", page:25, blocks:[
        {t:"ul", items:[
          "Radio connection status: green = connected, red = not operational or not authorized.",
          "Top bar, current mode: MAST DIRECT, LINEAR, TRAJECTORY, LOCAL, CRAWL, STABILIZERS, STANDBY or FAULT.",
          "Status indicators: green = operational, red = de-energized or ERROR, yellow = loading or warning. Tap a circle for more information.",
          "PLC and PPU software versions displayed; Settings, Diagnostics, Alarms and RVIZ view buttons."] } ]},
      { title:"Alarms & clearing faults", page:27, blocks:[
        {t:"p", text:"The alarm table classifies entries as information, warnings and system faults. Typical causes: CAN network faults at startup, joints operated manually in remote mode… Resolved faults change to the Inactive state."},
        {t:"warn", w:"warn", text:"Both active AND inactive faults must all be cleared before resuming operation: select the row, then \"Clear fault\"."} ]},
      { title:"TRAJECTORY view (3D model)", page:28, blocks:[
        {t:"p", text:"A real-time 3D model of the mast position and the obstacles modeled by the planning software. Useful after a collision, to confirm encoder readings and diagnose set points. Four views, tap to enlarge."},
        {t:"warn", w:"note", text:"The software cannot model every object in an underground mine: to avoid an object that is invisible on screen, use additional set points."} ]},
      { title:"Encoder calibration (zero point)", page:30, blocks:[
        {t:"p", text:"Required if an encoder is replaced or if it has slipped on its shaft: without a zero-point reset, the reported orientation is wrong."},
        {t:"steps", items:[
          "Turn on the machine and set the remote to DIRECT mode.",
          "Log in to the HMI with the administrator credentials (Appendix A).",
          "One joint at a time, bring it to its home position (defined stop: J1 counterclockwise, J2 fully up, J3 retracted, J4 fully down, J5 counterclockwise, J6 cylinder extended).",
          "Press the corresponding button on the HMI and check that the value goes to zero (1° or 359° acceptable)."] } ]},
      { title:"Slew rotation limits", page:32, blocks:[
        {t:"p", text:"Mechanical stops at ±165° (total travel 330°, 30° dead zone at the front). The default software limits are 10° and 320°; adjustable on the calibration screen by tapping the value."},
        {t:"warn", w:"note", text:"The OVERRIDE JOINT LIMITS button releases the full travel to the stops, it resets when you leave the calibration screen."} ]},
      { title:"Valve error bypass", page:32, blocks:[
        {t:"p", text:"Reserved for an experienced operator, in two scenarios only: a known non-critical fault (e.g. overheating) that absolutely must be overridden, or a fault on the valve block of the mode other than the one in use."},
        {t:"warn", w:"danger", text:"An active bypass ignores ALL faults on that valve. Dangerous if the fault is critical or if it masks an imminent hazard to personnel or the machine."} ]},
      { title:"Joystick curves & set-point limits", page:33, blocks:[
        {t:"p", text:"The curves (0 to 3) define actuator sensitivity relative to the joystick: more travel for precision, or a linear ramp in speed. Select the curve on the HMI and check that the icon lights up."},
        {t:"p", text:"The VALVE SET-POINT LIMITS reduce the maximum speed of each joint in DIRECT mode (both directions; gravity can create a difference). Useful range: 10 to 100 % : consult MEDATech for a different valve spool beyond that. A button restores the factory values."} ]},
      { title:"Joint tuning (PPU calibration)", page:35, blocks:[
        {t:"p", text:"If the mast becomes jerky in LINEAR/TRAJECTORY despite correct encoder calibration: Threshold (minimum movement set point) and Dynamic (delays and speeds) calibration. Position each joint within ±2°/5 mm of the target pose in DIRECT mode, start from the HMI (yellow button → green), then hold the left joystick: the joint does 2 back-and-forth cycles (\"CALIBRATING\"). Releasing the joystick cancels."},
        {t:"warn", w:"warn", text:"During calibration, the joints move WITHOUT direct command or environment sensing. Space required: SLEW 25°, SHOULDER 50°, TELESCOPE 140 mm, WRIST 30°, ROTATION 20°, TILT 40°. Releasing the joystick stops the mast at any time."},
        {t:"p", text:"Then: red MEDATech USB stick in the PPU's blue cable (1 min), send the \"medatech_calibration\" folder to MEDATech service, reload the returned \"cal.7z\" file onto the stick, reinsert (1 min) and restart the PPU from the HMI."} ]},
      { title:"Diagnostics screens", page:41, blocks:[
        {t:"ul", items:["Encoder diagnostics.","Valve diagnostics.","Electrical system diagnostics."] },
        {t:"warn", w:"note", text:"Valves outside their designated mode normally show a fault (CRAWL valves faulted during MAST mode, and vice versa). Only be concerned if the fault appears in the designated mode."} ]}
    ],
    quiz:[
      { text:"Before resuming operation after faults, you must…", options:["Clear only the active faults","Clear both active AND inactive faults","Restart the machine, nothing else"], correct:1 },
      { text:"A valve error bypass…", options:["Ignores ALL faults on that valve, reserved for non-critical cases","Only lasts 30 seconds","Is recommended at every fault"], correct:0 },
      { text:"What is the total slew travel between mechanical stops?", options:["360°","330° (±165°)","180°"], correct:1 },
      { text:"The mast is jerky in LINEAR mode despite calibrated encoders. What to do?", options:["A joint tuning (PPU calibration)","Replace the pump","Switch to Rabbit mode"], correct:0 },
      { text:"CRAWL mode valves show a fault during MAST mode…", options:["That's normal: they are outside their designated mode","Stop the machine immediately","The fault must be bypassed"], correct:0 }
    ]
  },
  {
    num:"06", title:"Startup & Tramming", short:"Startup", chapters:"11.1 : 11.5", pages:"45-54",
    subtitle:"Wired connection (electrical + hydraulic), startup sequence, the six modes, manual control and safe tramming.",
    intro:"The RodBot has no onboard power source: everything passes through the 10 m connection cables to the drill. This module covers connecting, starting and tramming the machine.",
    sections:[
      { title:"Electrical connection & emergency stop", page:45, blocks:[
        {t:"p", text:"Two electrical connections in spiral wrap: a 24 V DC cable for the onboard electronics and an emergency stop cable linking the e-Stop circuits of the RodBot and the parent drill. A junction box (120 V AC → 24 V DC) mounts on the drill; connect to connectors 2 and 4 on the panel."},
        {t:"warn", w:"danger", text:"The RodBot must be installed with a BARRIER separating the operator from the machine and the drill, radio operation, each on either side of the barrier."},
        {t:"warn", w:"warn", text:"If you observe unexpected mast movement, immediately press an emergency stop, then diagnose the problem."} ]},
      { title:"Hydraulic connection", page:47, blocks:[
        {t:"p", text:"The connection hose assembly (10 m) connects the RodBot to the drill's pump: Pressure, Tank, Load Sensing (LS) and Case Drain. A bulkhead with quick couplers mounts on the drill or pump (2 bolts, 3/8 in)."},
        {t:"warn", w:"note", text:"A pump replacement may require recalibration: TRAJECTORY and LINEAR modes depend on the set latency, ramp and pressure. Contact MEDATech if their performance degrades."} ]},
      { title:"Powering on, the sequence", page:49, blocks:[
        {t:"steps", items:[
          "Connect the RodBot to power (connection cable → parent drill box).",
          "Wait for the HMI screen to light up (~30 seconds).",
          "Check that the remote's e-Stop is released, then press the green start button.",
          "Follow the on-screen instructions to pair the RRC (press the green button again).",
          "Press the control panel's safety reset button.",
          "Wait for the startup sequence shown on the HMI to complete.",
          "In STANDBY mode, the system is ready: select a mode from the side buttons of the RRC."] } ]},
      { title:"The six operating modes", page:50, blocks:[
        {t:"specs", rows:[["STANDBY","Safety mode, no command processed; e-Stop, tilt and lights remain active"],["CRAWL","Tracks only"],["STABILIZERS","The 4 cylinders only"],["DIRECT","Individual mast joints"],["LINEAR","End effector in straight X-Y-Z lines"],["TRAJECTORY","Autonomous movement between recorded points"]] } ]},
      { title:"Manual control & levers", page:50, blocks:[
        {t:"p", text:"All functions can be operated with the valve levers, only with the selector in LOCAL. In REMOTE mode, an operated lever is detected as a valve error: protective stop, hydraulics cut off. To clear: switch to LOCAL + safety reset button."} ]},
      { title:"Tramming (CRAWL) & transport pose", page:51, blocks:[
        {t:"warn", w:"danger", text:"NEVER tram the RodBot with the manual valves, risk of being struck or crushed. Always by radio remote. The levers of the \"tracks and cylinders\" block are for maintenance only and are shipped disconnected, stored at the rear."},
        {t:"p", text:"You cannot switch to CRAWL mode if the gripper jaws are closed. Before any tramming, place the arm in the transport pose:"},
        {t:"ul", items:["Slew parallel to the chassis","Hoist lowered fully","Telescope retracted","Wrist pointing down","Gripper open"] },
        {t:"warn", w:"warn", text:"Inspect the path (personnel, obstacles, cavities, unstable ground). Never stand in front of or beside the moving machine; use a spotter if visibility is reduced. Keep the connection cables out of the path, never drive over them."},
        {t:"p", text:"Track speeds: Hi 2.8 km/h · Lo 1.5 km/h. To change: turn the manual bypass valve (0.55 in square) 90° : clockwise = Hi, counterclockwise = Lo."} ]},
      { title:"STANDBY mode", page:54, blocks:[
        {t:"p", text:"Allows the RRC to be paired without any command being processed. All safety functions (e-Stop, tilt) and the lights remain functional: a safe mode to start the remote before switching to the working modes."} ]}
    ],
    quiz:[
      { text:"What is the length of the connection cables to the drill?", options:["5 m","10 m","20 m"], correct:1 },
      { text:"How must the RodBot be installed relative to the operator?", options:["A barrier separates them, radio operation on either side","Side by side for better visibility","It doesn't matter, the radio reaches 100 m"], correct:0 },
      { text:"Can you switch to CRAWL mode with the gripper closed?", options:["Yes, without restriction","Yes, but at Lo speed only","No, it is impossible"], correct:2 },
      { text:"A manual lever is operated during REMOTE mode…", options:["The lever takes priority","Valve error → protective stop, hydraulics cut off","The movement adds to the radio command"], correct:1 },
      { text:"Tramming the machine must be done…", options:["By radio remote only","With the manual valves for more precision","Either by radio or levers, it doesn't matter"], correct:0 }
    ]
  },
  {
    num:"07", title:"Rod Handling", short:"Handling", chapters:"11.6 : 11.7", pages:"54-66",
    subtitle:"Gripper control, DIRECT and LINEAR modes, TRAJECTORY set points, anti-collision limits and basket loading.",
    intro:"The core of the job: moving rods between the basket and the drill. DIRECT or LINEAR at the operator's choice; TRAJECTORY for automated movements, provided points and limits are set correctly.",
    sections:[
      { title:"Gripper (jaws) control", page:55, blocks:[
        {t:"p", text:"Two simultaneous actions are required on the RRC. CLOSE: green GRIPPER button + GRIPPER toggle down. OPEN: green GRIPPER button held + toggle held up for at least 1 second."},
        {t:"warn", w:"danger", text:"Never stand under the mast or gripper. Watch for overhead mine services (electrical cables, water and air lines, ventilation): any mast contact can cause serious injury or death."} ]},
      { title:"Choosing between DIRECT and LINEAR", page:56, blocks:[
        {t:"p", text:"DIRECT: like a traditional crane, each actuator commanded independently (white labels on the face). LINEAR: the end effector follows straight lines, FORWARD/BACK, UP/DOWN, LEFT/RIGHT (slew) : orange labels; left joystick = up/down + left/right, right joystick = in/out. Wrist, rotation and tilt remain individually controllable."},
        {t:"warn", w:"note", text:"The choice is a matter of personal preference; for most operators, LINEAR mode is generally simpler."} ]},
      { title:"TRAJECTORY set points", page:58, blocks:[
        {t:"p", text:"Access the configuration screen: hold the DIRECT or LINEAR button for 3 seconds. Select a point with the \"Trajectory point\" switch, then \"Save/Select\" up to save (a check mark appears) or down to delete."},
        {t:"specs", rows:[["BASKET 1","Default above the basket, adjustable"],["BASKET 2","Secondary basket (on the ground): rod gripped at center ±5 cm, ≥30 cm above, parallel to the basket"],["WAIT","Final approach point toward the drill; can serve as a stop (rod presenter)"],["DRILL","MANDATORY : rod transfer point, gripped at center ±5 cm"],["POINT 1 & 2","Optional waypoints to go around obstacles"]] },
        {t:"p", text:"Example sequence: BASKET → POINT 2 → POINT 1 → WAIT → DRILL."} ]},
      { title:"Upper & lower limits (anti-collision)", page:61, blocks:[
        {t:"p", text:"The planner automatically avoids: the RodBot itself, the drill (positioned from the DRILL point), the rod basket, the rear and the floor. The operator additionally defines two horizontal planes, roof/services and floor/ledge."},
        {t:"p", text:"Defining a plane: bring the gripper's center of gravity (empty, preferably) to the desired height, usually ~30 cm from the ground for the lower limit, then flip the switch up. Same procedure for the upper limit."},
        {t:"warn", w:"note", text:"If a rod is detected in the gripper, the planner assumes a 6 ft rod held ±5 cm from center and keeps the whole rod clear of the planes."} ]},
      { title:"No vision system!", page:63, blocks:[
        {t:"warn", w:"danger", text:"No vision system detects personnel, vehicles or equipment entering the work area. Barriers, boundaries and operating restrictions compliant with mine policies are MANDATORY; limit traffic within the mast's work envelope."},
        {t:"warn", w:"warn", text:"Built-in safety: switching to CRAWL and moving the machine DELETES all set points except BASKET 1. Settings survive a restart, delete points and limits at the end of every task and redefine them at each new setup."} ]},
      { title:"Operating in TRAJECTORY mode", page:64, blocks:[
        {t:"p", text:"Prerequisites: DRILL, WAIT and UPPER/LOWER LIMITS defined. Hold the yellow TRAJECTORY button + right joystick: right = toward the BASKET, left = toward the DRILL. Once the movement is started, the button can be released; holding the joystick continues the movement, releasing it stops the mast."},
        {t:"p", text:"Releasing the yellow button returns to the previous mode (LINEAR or DIRECT) : you can take over at any time, then reactivate TRAJECTORY: a new collision-free path is generated."} ]},
      { title:"Loading the rod basket", page:65, blocks:[
        {t:"ul", items:[
          "The basket's fork sleeves engage the chassis profiles.",
          "The basket positions laterally between the two chassis retaining tabs.",
          "The basket is NOT bolted: it is held by these alignment and retaining devices."] } ]}
    ],
    quiz:[
      { text:"How do you open the gripper?", options:["Green button + toggle held up ≥ 1 s","A single press of the toggle","A quick double press of the green button"], correct:0 },
      { text:"Which points are mandatory to use TRAJECTORY mode?", options:["POINT 1 and POINT 2","DRILL, WAIT and the UPPER/LOWER LIMITS","Only BASKET 1"], correct:1 },
      { text:"Does the RodBot detect a person entering its work area?", options:["Yes, via cameras","Yes, via laser sensors","No, no vision system: barriers mandatory"], correct:2 },
      { text:"After tramming in CRAWL, the set points…", options:["Are all kept","Are all deleted except BASKET 1","Are converted to default points"], correct:1 },
      { text:"How is the rod basket secured to the chassis?", options:["Bolted at the four corners","By hydraulic clamps","Not bolted, sleeves and retaining tabs"], correct:2 }
    ]
  },
  {
    num:"08", title:"Troubleshooting & Maintenance", short:"Maintenance", chapters:"12 : 13 · appendices", pages:"67-87",
    subtitle:"Troubleshooting guide, LOTO, inspections, fluids, greasing, wear pads, tracks, transport, towing and appendices.",
    intro:"Regular maintenance ensures safe, reliable operation. This section is for qualified personnel, and troubleshooting always starts with the simple causes.",
    sections:[
      { title:"Troubleshooting guide, common cases", page:67, blocks:[
        {t:"specs", rows:[
          ["Won't turn on","REMOTE mode with RRC off → LOCAL, turn on the RRC, safety reset · or e-Stop pressed → reset"],
          ["The RRC won't turn on","Battery dead → charge · key missing → put the key back"],
          ["Stops in REMOTE mode","RRC e-Stop pressed · RRC turned on after the selector → turn on the RRC first · tilt → hold level"],
          ["Nothing works despite RRC + REMOTE","Safety circuit needs setting → RESET button · check error messages, valve coil, oil supply, radio receiver"],
          ["Functions slow","Turtle mode active → switch to Rabbit"],
          ["No AUTO / TIP","Encoder faulted → check the HMI and wiring"],
          ["Rotation too limited","Soft stops too restrictive → reset (2-3° difference normal)"],
          ["Rod touches floor/roof in TRAJECTORY","UPPER/LOWER LIMITS non-compliant → redefine them · check encoders"],
          ["Rod misplaced at the drill","Redefine the DRILL point · check encoders · incorrect destination"],
          ["Erratic mast","Encoders poorly transmitted to the PPU → check · recalibrate (manual section 8.6)"]] },
        {t:"p", text:"MEDATech support: service@medatech.ca · +1 (705) 443-8440, ext. 4."} ]},
      { title:"Golden rules before any maintenance", page:71, blocks:[
        {t:"warn", w:"danger", text:"Machine de-energized, power disconnected, lockout-tagout (LOTO) applied for ALL maintenance, including washing. Some devices store hydraulic energy (cylinders with counterbalance valves). Qualified personnel only; local work-at-height practices followed."},
        {t:"warn", w:"note", text:"Perform maintenance with the articulation (shoulder) horizontal or lower to avoid unnecessary work at height."} ]},
      { title:"Cleaning", page:71, blocks:[
        {t:"p", text:"The RodBot can and should be cleaned, but never a direct pressure-washer jet on the electrical components (rotary encoders, panel): the pressure damages their seals."} ]},
      { title:"Regular inspections", page:71, blocks:[
        {t:"specs", rows:[["Hoses, lines, cables (damage, leaks)","Daily"],["Test without rod, normal movements","Daily"],["Emergency stops functional","Weekly"],["Joint & slew-ring lubrication","Weekly"],["Track inspection","Weekly"],["Structures: deformation, weld cracks","Weekly"],["Track reducer oil level","500 h"],["Reducer oil change","2,000 h"],["Telescope wear pads","As needed"]] },
        {t:"p", text:"Immediately report any problem found to management and/or maintenance personnel."} ]},
      { title:"Fluids & grease points", page:72, blocks:[
        {t:"specs", rows:[["Hydraulic oil","ISO VG 46"],["Grease (mechanical joints)","EP2"],["Final drive reducer oil","SAE 80W90"]] },
        {t:"p", text:"10 grease points: 4 on the base slew ring, 4 on the rotation ring, 2 on the tilt cylinder. For the rings: grease, turn the joint about 30°, repeat across the full range."},
        {t:"warn", w:"warn", text:"Do not move the slewing joints while a technician is within the machine's range of action."} ]},
      { title:"Telescope wear pads", page:73, blocks:[
        {t:"p", text:"Eight plastic pads guide the telescope slide; they wear and require adjustment to limit play. Procedure: mast horizontal above the basket, boom extended 3 in, machine de-energized. Loosen the locknuts, adjust pads 1-2 then 7-8 with about 1/8 in clearance (gauge 11 plate); pads 3-4 and 5-6 seated without tightening. Retighten the locknuts."},
        {t:"warn", w:"note", text:"If the bolt head bottoms out against the locknut, the pad must be replaced (remove the closure plate, the thrust plate, replace, reassemble, adjust). Binding or noise: loosen 3-6, grease the rails, check the stops."} ]},
      { title:"Track maintenance", page:75, blocks:[
        {t:"p", text:"Tension: the track sag must measure 20 to 25 mm (straightedge + tape). Never more than 30 mm or excessive tension. Adjust via the valve behind the nameplate: inject grease to tighten, slowly unscrew to loosen."},
        {t:"specs", rows:[["New track","X = 22 mm"],["50 % wear","X = 15 mm"],["Replacement limit","X < 8 mm"]] } ]},
      { title:"Transport, anchoring, towing & lifting", page:76, blocks:[
        {t:"p", text:"Four ways to transport: autonomous tramming, ground towing, forklift/telehandler, low-bed trailer, always with the arm in the transport pose. 4 anchor points on the chassis (tie-down, towing, lifting) and 4 lifting points, 9/16 in, on the basket; fork passages on chassis and basket."},
        {t:"warn", w:"danger", text:"Towing: disable the SAHR brakes by removing the plug (M16 hex key) from BOTH tracks, after securely fastening the machine to the vehicle. Reinstall the plugs after towing: without them, the machine has NO brakes."},
        {t:"warn", w:"warn", text:"Follow safe anchoring procedures when securing to a transporter and when loading/unloading."} ]},
      { title:"The manual's appendices", page:80, blocks:[
        {t:"ul", items:[
          "A (p. 80) : HMI administrator login settings.",
          "B (p. 81) : PPU reset: power button 5 s, wait 60 s; otherwise contact MEDATech.",
          "C (p. 82) : Pairing the AUTEC remote and the receiver (START/STOP procedure).",
          "D (p. 84) : PPU software update: taiga.7z file on USB stick, wait 10 min, check the version on the HMI.",
          "E (p. 87) : Data logs: Wi-Fi \"MEDATech-Datalogger\", logger.local dashboard, UDP/CAN logs at 5-min intervals."] } ]}
    ],
    quiz:[
      { text:"Before any maintenance, including washing, you must…", options:["De-energize, disconnect and apply LOTO","Switch to STANDBY mode","Close the gripper"], correct:0 },
      { text:"The mast functions are abnormally slow. Likely cause?", options:["Worn pump","Turtle (slow) mode active","RRC low battery"], correct:1 },
      { text:"What is the correct track sag?", options:["5-10 mm","20-25 mm","40-50 mm"], correct:1 },
      { text:"After towing, you must…", options:["Drain the hydraulic oil","Reinstall the SAHR plugs, otherwise no brakes","Recalibrate the encoders"], correct:1 },
      { text:"Which hydraulic oil is approved?", options:["ISO VG 46","SAE 80W90","ATF Dexron III"], correct:0 }
    ]
  }
];

var ENRICH_EN = {"0-0":{"blocks":[{"t":"p","text":"Borterra's **RodBot LP** handles drill rods."},{"t":"sub","text":"Robotic system"},{"t":"ul","items":["**Hydraulic** robotic system. It loads and unloads rods smoothly.","It removes **manual rod handling**.","Manual rod handling is a leading cause of drill injuries.","It fits many types of equipment: drills, rod baskets, pallets."]},{"t":"sub","text":"Chassis and rods"},{"t":"ul","items":[{"text":"Track-mounted rod carrier.","sub":["The **tracks** reposition the **RodBot** inside the drift."]},{"text":"Removable rod basket.","sub":["For rods **5 in** in diameter.","Up to **6 ft** long."]}]},{"t":"sub","text":"Power and control"},{"t":"ul","items":["Hydraulic and electric supply via a **cable** to a drill.",{"text":"Main control by Radio Remote Control (**RRC**).","sub":["It moves rods with no manual handling.","During drilling and tripping."]}]},{"t":"warn","w":"note","text":"The link cable connects the ##e-Stop## buttons of the RodBot and the drill. The two circuits are interconnected."}],"figures":[]},"0-1":{"blocks":[{"t":"sub","text":"Three control modes"},{"t":"ul","items":[{"text":"**Direct control** (also \"manual control by radio remote\").","sub":["The joysticks drive each slew joint one by one.","Like conventional heavy machinery."]},{"text":"**Linear control**: moves the rod/casing in X, Y or Z with one joystick movement.","sub":["The system operates several hydraulic valves at once.","The operator keeps control of the end-effector's slew actuators (wrist, rotation, gripper tilt)."]},{"text":"**Trajectory control**: the mast moves alone from a start pose to a user-defined final pose.","sub":["The RodBot computes the path.","To minimize travel time and avoid collisions."]}]},{"t":"p","text":"In **trajectory mode**:"},{"t":"ul","items":["The operator defines and saves destination points and waypoints.","He moves the mast by direct or linear control.","Rods then move between two points with a single joystick movement.","Details in sections 11.6.3 (linear) and 11.6.4 (trajectory)."]}],"figures":[]},"0-2":{"blocks":[{"t":"p","text":"The illustration on **page 7** identifies the machine's main components."},{"t":"sub","text":"Mast and gripper"},{"t":"ul","items":["Mast","Gripper","Pedestal"]},{"t":"sub","text":"Movement and stability"},{"t":"ul","items":["Tracks","Stabilizer cylinders"]},{"t":"sub","text":"Rods and storage"},{"t":"ul","items":["Rod basket","Storage compartment"]},{"t":"sub","text":"Control and signals"},{"t":"ul","items":["Remote control unit","24 V electrical panel","Beacon light"]}],"figures":[{"page":7,"cap":"Overview: main components of the RodBot LP (gripper, mast, pedestal, rod basket, tracks, stabilizer cylinders, 24 V electrical panel, beacon, remote control unit)."}]},"0-3":{"blocks":[{"t":"specs","rows":[["Empty weight","5,800 lb"],["Weight with empty basket","6,500 lb"],["Length","116 in"],["Width","60 in"],["Minimum height","90 in"]]},{"t":"specs","rows":[["Max. load, general-purpose lifting","308 lb"],["Max. load, rod lifting by electromagnet","120 lb"],["Rod diameter","5 in"],["Rod length","6 ft"],["Basket capacity","35 rods"],["Max. vertical reach (vertical rod, from ground)","159 in"],["Max. horizontal reach (from centerline)","119 in"]]}],"figures":[]},"0-4":{"blocks":[{"t":"specs","rows":[["Electrical supply","120 V AC"],["Maximum current draw","4.5 A"],["Hydraulic supply","From the pump (not included) via the link assembly (included)"],["Required pump type","Variable displacement with load sensing"],["Supply pressure range","2,500-3,000 psi"],["Maximum required flow","80 L/min"],["Hydraulic connections","Pressure (P), Tank (T), Case drain (T/Dr), Load sense (LS)"],["Link assembly length","30 ft"]]},{"t":"specs","rows":[["Ground clearance","10 in"],["Transmission","Open-circuit hydrostatic"],["Brakes","Spring-applied, hydrostatic"],["Max. travel grade, empty basket","35° / 70 %"],["Max. travel grade, full basket","28° / 53 %"],["Max. grade, rod handling","15° / 27 %"],["Track length","71 in"],["Track gauge","46 in"],["Track width","12 in"],["Max. slow travel speed","2.8 km/h"],["Stabilizer stroke","10.5 in"]]}],"figures":[]},"1-0":{"blocks":[{"t":"p","text":"This **safety** chapter covers two additions:"},{"t":"ul","items":["Adding the **radio remote**.","Rolling out **trajectory planning**.","Both on the mast's drill-rod handler."]},{"t":"sub","text":"Operator requirements"},{"t":"ul","items":["The operator must have read and understood the **operating manual**.","He must follow the recommended maintenance schedules."]},{"t":"sub","text":"Trained personnel"},{"t":"ul","items":[{"text":"The **Rod Handler** must only be operated, serviced and repaired by ##trained personnel##.","sub":["This personnel must know the equipment and its hazards.","Personnel must follow general and local safety and health rules."]}]},{"t":"warn","w":"note","text":"The manufacturer accepts no liability for ##improper use##. Nor for arbitrary modifications to the equipment."}],"figures":[]},"1-1":{"blocks":[{"t":"specs","rows":[["DANGER","Life-threatening situation: must be avoided at all costs."],["WARNING","Information of critical importance for safety."],["CAUTION","Information intended to prevent any risk of injury and/or property damage."]]},{"t":"warn","w":"note","text":"The manual's procedures do not relieve the operator from ##staying cautious##."},{"t":"warn","w":"note","text":"He must also follow regional rules and the site's and company's safety rules."}],"figures":[{"page":10,"cap":"Manual safety pictograms: DANGER, WARNING and CAUTION."}]},"1-2":{"blocks":[{"t":"sub","text":"##Before## operating"},{"t":"ul","items":["Only operate the robotic system after ##full training## and valid certification.","##Always## read and understand all labels before use."]},{"t":"sub","text":"Operator condition"},{"t":"ul","items":["Only operate the equipment when in good physical and mental condition.","##Never operate under the influence of alcohol or drugs##."]},{"t":"sub","text":"Guards and upkeep"},{"t":"ul","items":["##Never## remove guards and safety covers while the system is powered and running.","Clean up oil spills and leaks before startup.","Resolve all malfunctions before returning to service.","Only use spare parts identical or equivalent to the original parts."]},{"t":"warn","w":"danger","text":"##Pressurized fluids##: a high-pressure hydraulic oil leak on the skin can cause a subcutaneous injection injury."},{"t":"warn","w":"danger","text":"If injured, ##immediately contact emergency medical services##."},{"t":"warn","w":"danger","text":"See a doctor familiar with this injury. Risk of gangrene or severe allergic reactions."},{"t":"warn","w":"warn","text":"Outdoors, ##do not operate## the system in a thunderstorm or in winds above **65 km/h**."},{"t":"warn","w":"warn","text":"Do not operate it if the control system reports an error or works poorly."},{"t":"warn","w":"note","text":"Do not undertake ##any maintenance or repair## without authorization or proper qualification."},{"t":"warn","w":"note","text":"First read and understand the manufacturer's safety instructions."},{"t":"warn","w":"note","text":"Check local and mine-specific regulations."}],"figures":[{"page":11,"cap":"First-steps icons, mindful safe practice."}]},"1-3":{"blocks":[{"t":"p","text":"The machine has **four** ##emergency-stop## locations."},{"t":"p","text":"Activating one immediately stops all movement of the drill unit."},{"t":"specs","rows":[["Low-voltage control panel","Immediately below the touchscreen HMI"],["Radio remote","Center, bottom"],["RodBot frame","Lower front-right corner of the frame"],["Manual controls","At the rear, near the mast's hydraulic control levers"]]},{"t":"warn","w":"warn","text":"The ##emergency-stop## signal can be coupled to the parent drill."},{"t":"warn","w":"warn","text":"Then, an emergency stop on one machine triggers one on both."}],"figures":[]},"2-0":{"blocks":[{"t":"p","text":"The **telescopic mast** (robotic arm) has several slew joint (wrist) actuators."},{"t":"p","text":"Each joint has a number (**J…**) and a name. See the diagram on **page 13**."},{"t":"sub","text":"Base and arm"},{"t":"ul","items":["**TELESCOPE**","**SLEW**","**ARTICULATION (SHOULDER)**"]},{"t":"sub","text":"Wrist and gripper"},{"t":"ul","items":["**SLEW JOINT (WRIST)**","**ROTATION**","**TILT**","**GRIPPER (JAWS)**"]},{"t":"warn","w":"note","text":"Example: the **SLEW** function = **J1** (\"slew 1\")."}],"figures":[{"page":13,"cap":"Diagram of the mast segments and function names"}]},"2-1":{"blocks":[{"t":"p","text":"The **operator control** switch is on the low-voltage control panel."},{"t":"p","text":"It decides whether the robotic system accepts commands from the **radio remote**."},{"t":"specs","rows":[["OPERATOR CONTROL REMOTE position","The radio remote is linked to the robotic system and can drive it"],["LOCAL position","Radio remote commands are ignored; the \"No Radio\" icon is displayed"]]},{"t":"sub","text":"Control and ##safety##"},{"t":"ul","items":["**Operator control**","**Safety reset button**","##Emergency stop##"]},{"t":"sub","text":"Internal modules"},{"t":"ul","items":["**Main HMI control panel** (Human-Machine Interface)","**PPU** (Path Planning Unit)","**Radio receiver**"]},{"t":"warn","w":"warn","text":"To drive by radio remote, the switch ##MUST## be in **REMOTE**."},{"t":"warn","w":"warn","text":"In **LOCAL**, no radio command is executed."}],"figures":[{"page":14,"cap":"Inside view of the main control panel"}]},"2-2":{"blocks":[{"t":"p","text":"The **safety reset button** activates (\"sets\") the robotic system's **safety circuit**."},{"t":"steps","items":["At startup: press to establish (set) the **safety circuit**.","After an ##emergency stop## is triggered then reset: press again to reactivate the circuit."]}],"figures":[]},"2-3":{"blocks":[{"t":"p","text":"The **main panel touchscreen** (HMI, Human-Machine Interface) shows the RodBot control info."},{"t":"p","text":"The operator can change certain settings there."},{"t":"ul","items":["Indicator: operator control switch set to \"**LOCAL**\"","\"**No Radio**\" (radio transceiver not enabled) icon"]},{"t":"warn","w":"note","text":"See manual **section 7** for more on this screen."}],"figures":[{"page":15,"cap":"Main panel screen: LOCAL mode indicator and No Radio icon"}]},"2-4":{"blocks":[{"t":"p","text":"**Two** **normally-closed** hydraulic enable/isolation valves are used."},{"t":"p","text":"Their state is set by the operator's **MODE** choice."},{"t":"p","text":"If it detects an error, the safety system can change their state."},{"t":"specs","rows":[["Number / type","2 valves, normally closed"],["Location","Link-hose connection manifold"],["One valve","Regulates flow to the tracks and cylinders"],["The other valve","Regulates flow to all other elements"],["State control","Operator's MODE choice or safety system (if an error is detected)"]]},{"t":"warn","w":"warn","text":"On a **power loss**, both valves close by default."},{"t":"warn","w":"warn","text":"##Any hydraulic operation then becomes impossible##."},{"t":"warn","w":"note","text":"Force manually to the open position: turn the valve **counterclockwise**."}],"figures":[{"page":16,"cap":"Mast hydraulic enable/isolation valve (normally closed; closes on loss of electrical power)"}]},"3-0":{"blocks":[{"t":"p","text":"The **radio remote (RRC)** is designed for the RodBot."},{"t":"ul","items":["Withstands shock and dirt.","Withstands moisture and water.","Joysticks are **fully proportional**.","Joysticks spring-return to zero."]},{"t":"specs","rows":[["Key location","Upper-left part of the remote"],["Role","The key must be present for the remote to work"],["Without the key","The remote does not power on"],["Removal during operation","Breaks the RRC ↔ receiver link and triggers a stop"]]},{"t":"warn","w":"warn","text":"##Never remove## the **physical key** while the machine is running."},{"t":"warn","w":"warn","text":"The RRC ↔ receiver link breaks and a stop is triggered."}],"figures":[{"page":17,"cap":"Overview of the radio remote (RRC)"}]},"3-1":{"blocks":[{"t":"steps","items":["Set **OPERATOR CONTROL** (electrical panel) to **REMOTE**.","Otherwise, no movement message is recognized.","Press the **ON** button on the left side of the remote.","Confirm the LED, at the bottom left, turns **green** (\"ON\" state)."]},{"t":"p","text":"To turn off the remote: press its ##emergency-stop## button."},{"t":"p","text":"Then reset it by turning the **red mushroom head**."},{"t":"warn","w":"warn","text":"Pressing the remote's ##emergency stop## stops the drill."},{"t":"warn","w":"warn","text":"Exception: if the mode selector was first set to **LOCAL**."},{"t":"warn","w":"note","text":"The remote can be turned on with **OPERATOR CONTROL** on **LOCAL**."},{"t":"warn","w":"note","text":"But the system then ignores its RodBot movement messages."}],"figures":[{"page":18,"cap":"ON button and emergency-stop button of the remote"}]},"3-2":{"blocks":[{"t":"p","text":"The wireless radio remote's ##emergency stop## controls a **relay** on the RodBot."},{"t":"p","text":"This relay is wired in series with the other emergency stops."},{"t":"p","text":"That includes those of the RodBot and the parent drill (electrically connected)."},{"t":"p","text":"With the remote active and **OPERATOR CONTROL** on **REMOTE**:"},{"t":"p","text":"Pressing the ##emergency stop## stops both the RodBot and the parent drill."},{"t":"p","text":"It works like any wired emergency stop on the RodBot or the drill."},{"t":"warn","w":"danger","text":"In **LOCAL** mode, radio communication is disabled."},{"t":"warn","w":"danger","text":"The remote's emergency-stop button ##does NOT work##."},{"t":"warn","w":"danger","text":"##Never rely## on the RRC emergency stop in LOCAL mode."},{"t":"warn","w":"note","text":"Turn off without shutting down the engine: set **OPERATOR CONTROL** to **LOCAL**."},{"t":"warn","w":"note","text":"Then turn off via its emergency-stop button."},{"t":"warn","w":"note","text":"Useful to replace a weak battery or save battery power."}],"figures":[]},"3-3":{"blocks":[{"t":"p","text":"The **Fast (Rabbit)** / **Slow (Turtle)** modes apply a scaling factor."},{"t":"p","text":"It applies to all joints."},{"t":"p","text":"This works in DIRECT, LINEAR and TRAJECTORY modes."},{"t":"specs","rows":[["Fast (Rabbit) mode","Maximum speed set in the Valve Setpoints menu (section 8.5)"],["Slow (Turtle) mode","Each joint's speed limited to 50 % (cut in half)"],["Exception","The gripper (jaws) is not slowed by Slow mode"]]}],"figures":[{"page":19,"cap":"Fast (Rabbit)/Slow (Turtle) selector and directional hydraulic valve limit control"}]},"3-4":{"blocks":[{"t":"p","text":"The remote has a **tilt switch**."},{"t":"p","text":"It detects an operator emergency (remote tilted or dropped)."},{"t":"ul","items":["Triggering: the RodBot enters a ##safety-stop## state; hydraulic power is cut.","Difference from the red button: the wired drill emergency stop is ##NOT## triggered.","Recovery: return the remote to a stable horizontal position.","Do not operate any joystick.","The system exits the safety stop on its own and enters **standby**."]},{"t":"warn","w":"note","text":"**Daily inspection**: check the radio remote's tilt switch at the start of each shift."}],"figures":[]},"3-5":{"blocks":[{"t":"p","text":"An **amber beacon** on top of the RodBot shows the status of radio remote operation."},{"t":"specs","rows":[["Steady on","RodBot in OPERATOR CONTROL: REMOTE mode"],["Off","RodBot in OPERATOR CONTROL: LOCAL mode"],["Flashing","Mast in TRAJECTORY mode, or machine moving in CRAWL mode"]]}],"figures":[]},"3-6":{"blocks":[{"t":"p","text":"**Section 6.7** describes the joystick controls for each LP RodBot operating mode."},{"t":"p","text":"The remote has three proportional joysticks: **JS1**, **JS2** and **JS3**."},{"t":"sub","text":"Joystick functions"},{"t":"ul","items":["**JS1**: magnet control (one function is free, unassigned)","Horn and beacon control","**Gripper (jaws)** activation","**Fast (Rabbit)** / **Slow (Turtle)** selector"]},{"t":"sub","text":"Mode selection"},{"t":"ul","items":[{"text":"Mode selection buttons:","sub":["**Standby** (wait), **Direct** and **Linear**.","**ON**, stabilizers and slew."]},"**Trajectory** activation; Help, Wait, Start"]},{"t":"sub","text":"Screen and ##safety##"},{"t":"ul","items":["Status beacon; status and low-battery indicators","Screen brightness adjustment; work lights","##Emergency stop##"]},{"t":"warn","w":"note","text":"In **Slow** mode, actuator speed is cut in half (**50 %**), except for the gripper (jaws)."}],"figures":[{"page":21,"cap":"Layout of the JS1/JS2/JS3 joysticks, buttons and switches on the remote"},{"page":22,"cap":"Detail of the radio remote controls"}]},"3-7":{"blocks":[{"t":"p","text":"The remote's **HMI** is **NOT** a touchscreen."},{"t":"p","text":"The keypad keys above the screen match the icons displayed."},{"t":"p","text":"The display changes with the RodBot's state."},{"t":"p","text":"It provides the relevant information and control options."},{"t":"sub","text":"Position and trajectory"},{"t":"ul","items":["Drill position and trajectory points (from rack to drill)","**Rack Positions**"]},{"t":"sub","text":"System status"},{"t":"ul","items":["System **STATUS** indicator","Battery charge state indicator","**Gripper** state and **magnet** state"]},{"t":"sub","text":"Mode and selection"},{"t":"ul","items":["Operating mode type and mode indicator","**Slow** / **Fast** mode","The yellow box indicates the selected item"]}],"figures":[{"page":23,"cap":"Remote screen (HMI): key / icon mapping"},{"page":24,"cap":"Typical screen with status indicator labels"}]},"3-8":{"blocks":[{"t":"p","text":"The **battery charge level** is shown at the top right of the remote's screen."},{"t":"p","text":"It also appears at the bottom of the electrical panel screen."},{"t":"warn","w":"warn","text":"If the remote loses radio contact, the machine reacts as to an ##emergency stop##."},{"t":"warn","w":"warn","text":"Same if it shuts off (**dead battery**) during operation."},{"t":"warn","w":"warn","text":"Follow the procedure below to change the battery without triggering the stop."},{"t":"steps","items":["Set the OPERATOR CONTROL selector to **LOCAL**.","Turn the remote **OFF** by pressing the emergency stop on the remote or on the RRC.","Replace the battery.","Turn the remote **ON**.","Confirm the radio link icon, at the bottom of the control monitor, is restored.","Return the OPERATOR CONTROL selector to **REMOTE**."]},{"t":"p","text":"Charging and storage: the box on the machine contains a battery **charger**."},{"t":"p","text":"Insert the battery into the charger; charging starts automatically."}],"figures":[{"page":44,"cap":"Radio remote charger and storage box"}]},"4-0":{"blocks":[{"t":"p","text":"Navigate via the left sidebar icons."},{"t":"sub","text":"MENU NAVIGATION"},{"t":"ul","items":["Press an icon to open its page.","Press again to return to the main menu."]},{"t":"sub","text":"TOP STATUS BAR"},{"t":"ul","items":[{"text":"The top bar shows:","sub":["radio connection status and signal strength","active mode and controller status","**PLC** and **PPU** software versions"]},"**PPU** = Path Planning Unit."]},{"t":"specs","rows":[["Radio connection (green)","Remote on and connected"],["Radio connection (red)","Remote not operational or not authorized"],["Controller indicator (green)","Systems operational"],["Controller indicator (red)","System powered off or in FAULT"],["Controller indicator (yellow)","Loading in progress or warning (non-fault)"]]},{"t":"ul","items":["Press a highlighted status circle to see subsystem details.","\"System settings\" button: opens two screens (arrows at top right).","Screen 1: Joystick curve factor (section 8.4).","Screen 2: Limit valve setpoint (section 8.5)."]},{"t":"warn","w":"note","text":"Reserved for the administrator: encoder calibration, joint tuning (PPU calibration), the valve bypass screen."},{"t":"warn","w":"note","text":"Changeable only after **administrator login**. Reserved for the technician: manual p.25."}],"figures":[{"page":25,"cap":"HMI home screen: top status bar and navigation buttons"}]},"4-1":{"blocks":[{"t":"p","text":"The \"**ALARMS**\" button opens a table to diagnose RodBot anomalies."},{"t":"p","text":"It also helps spot safety risks. Faults have various causes:"},{"t":"ul","items":["**CAN** network faults at startup.","Joints operated manually in remote mode.","And other causes."]},{"t":"ul","items":["System information","System warnings","System faults"]},{"t":"steps","items":["Check the STATUS column: a resolved fault shows Inactive.","Press the row of the fault to clear.","Press \"Clear fault\".","Navigate between pages using the arrows at top right."]},{"t":"warn","w":"warn","text":"##Clear ALL faults, active AND inactive## before operation can resume."}],"figures":[{"page":27,"cap":"Example of the ALARMS screen with the STATUS column"}]},"4-2":{"blocks":[{"t":"p","text":"The **TRAJECTORY** view is a real-time 3D model of the mast and obstacles."},{"t":"p","text":"It follows the path-planning software."},{"t":"p","text":"Access it via the button in the HMI's lower-left corner."},{"t":"p","text":"Press one of the four views to enlarge it; press again to go back."},{"t":"ul","items":["Diagnose problems after a collision","Confirm encoder readings","Diagnose setpoint problems"]},{"t":"p","text":"Objects perceived and avoided during planning:"},{"t":"ul","items":["Upper limit","Lower limit","Drill mast","RodBot and its rod basket"]},{"t":"warn","w":"warn","text":"The software ##cannot model every object## in an underground mine."},{"t":"warn","w":"warn","text":"If an object to avoid does not appear on screen, add extra setpoints to route around it."}],"figures":[{"page":28,"cap":"TRAJECTORY view: four-view 3D model of the mast position"},{"page":29,"cap":"Objects perceived and avoided: upper/lower limits, mast and rod basket"}]},"4-3":{"blocks":[{"t":"p","text":"Encoder calibration is required if an encoder is replaced."},{"t":"p","text":"Also if it has loosened and slipped on the shaft."},{"t":"p","text":"Bring the joint to its home position, then reset the \"zero point\"."},{"t":"p","text":"Without this reset, the encoder does not report the joint's exact orientation."},{"t":"steps","items":["Power on the machine and set the remote to **DIRECT** mode.","Log in to the HMI in administrator mode (technician only).","One joint at a time: move it to its indicated zero position.","Then press the corresponding HMI button.","Confirm the value changes as it moves, and goes to zero after pressing.","Check it returns to zero each time it reaches that stop."]},{"t":"specs","rows":[["J1: Slew","Counterclockwise mechanical stop"],["J2: Articulation (shoulder)","Maximum up position"],["J3: Telescope","Fully retracted"],["J4: Slew joint (wrist)","Maximum down position"],["J5: Rotation","Counterclockwise to the mechanical stop"],["J6: Tilt","Tilt cylinder fully extended to the mechanical stop"]]},{"t":"warn","w":"note","text":"Encoders are very precise: slight variations are acceptable (the value may show **1°** or **359°** instead of 0°)."}],"figures":[{"page":31,"cap":"Zero-point positions of joints J1 to J6"}]},"4-4":{"blocks":[{"t":"specs","rows":[["Mechanical stops","+/- 165° (total travel 330°)"],["Dead zone","30° directly in front of the robotic system"],["Default software limits","10° and 320° (correspond to the mechanical stops)"]]},{"t":"p","text":"The software limits on the calibration screen can further restrict slew rotation."},{"t":"p","text":"To change them: press the number on screen, then enter the desired value."},{"t":"warn","w":"note","text":"The **OVERRIDE JOINT LIMITS** button allows full travel up to the stops."},{"t":"warn","w":"note","text":"It resets as soon as the operator leaves the calibration screen."}],"figures":[{"page":32,"cap":"Slew rotation limits and front dead zone"}]},"4-5":{"blocks":[{"t":"p","text":"The valve bypass screen appears on a valve fault in either of the two valve blocks."},{"t":"p","text":"##For experienced operators only##."},{"t":"p","text":"To toggle a bypass: press the \"Fault bypass\" box next to the faulted joint."},{"t":"ul","items":["A known, non-critical fault has occurred (e.g. an overheat).","And the operator absolutely must keep running the machine.","A valve fault is on the Crawl mode and Stabilizers block.","And the operator wants to keep using Arm mode, or the reverse."]},{"t":"warn","w":"danger","text":"An activated bypass button makes the system ignore ##ALL faults on that valve##."},{"t":"warn","w":"danger","text":"Dangerous if the fault is critical, or was preventing an imminent hazard to personnel or the machine."}],"figures":[{"page":33,"cap":"Valve fault bypass screen"}]},"4-6":{"blocks":[{"t":"p","text":"The joystick curves set joystick sensitivity."},{"t":"p","text":"Choose fine control, or a linear increase in speed."},{"t":"p","text":"The valve setpoint limits screen caps each joint's maximum speed."},{"t":"p","text":"Settings reserved for the technician. Full procedure: manual p.34."},{"t":"specs","rows":[["Available control curves","0 to 3"],["Valve setpoint (maximum)","100 % (cannot be exceeded)"],["Valve setpoint (recommended minimum)","10 %"]]},{"t":"warn","w":"note","text":"For speeds above 100 % or below 10 %, consult **MEDATech** for a different valve spool."}],"figures":[{"page":34,"cap":"Available joystick control curves (0 to 3)"},{"page":35,"cap":"Per-joint valve setpoint limits screen"}]},"4-7":{"blocks":[{"t":"p","text":"Mast jerky or hard to control in **LINEAR** or Trajectory mode?"},{"t":"p","text":"If encoder calibration is good, do a joint tuning (PPU calibration)."},{"t":"p","text":"Detailed procedure reserved for the technician: manual p.36."},{"t":"warn","w":"warn","text":"During calibration, the joints move ##without direct operator command##."},{"t":"warn","w":"warn","text":"They do not sense their surroundings. Stay alert to avoid any collision."},{"t":"warn","w":"warn","text":"Releasing the joystick stops the mast at any time."},{"t":"warn","w":"warn","text":"Provide enough clearance. Otherwise move the machine or contact MEDATech."}],"figures":[{"page":36,"cap":"Tuning pose: current position brought to the mast target position"},{"page":39,"cap":"RRC calibration screen: current selection and status indicator"}]},"4-8":{"blocks":[{"t":"p","text":"The **Diagnostics** show the status of various control-system elements."},{"t":"p","text":"They cover component and network communications."},{"t":"p","text":"The Diagnostics button on the HOME screen opens the first of three screens."},{"t":"p","text":"These screens are informational and non-interactive."},{"t":"p","text":"Only the navigation arrows at top right are active."},{"t":"ul","items":["Encoder Diagnostics","Valve Diagnostics","Electrical System Diagnostics"]},{"t":"warn","w":"note","text":"Interlock: valves lose communication outside their designated mode (**CRAWL** or **MAST**)."},{"t":"warn","w":"note","text":"CRAWL mode valves appear faulted in MAST mode, and vice versa: this is normal."},{"t":"warn","w":"note","text":"Only be concerned if a valve is faulted while in its designated mode."},{"t":"warn","w":"note","text":"Example: SLEW valve faulted in MAST mode."}],"figures":[{"page":41,"cap":"First diagnostic screen accessible from HOME"}]},"5-0":{"blocks":[{"t":"p","text":"The RodBot has no onboard power."},{"t":"p","text":"It draws electrical and hydraulic power from external sources supplied by the operator."},{"t":"p","text":"These sources are usually mounted on the drill it serves."},{"t":"p","text":"**10 m** link-cable assemblies connect them."},{"t":"p","text":"It can then position itself freely relative to the drill."},{"t":"specs","rows":[["24 V DC cable (onboard electronics)","P/N 279708"],["Emergency-stop cable (link to the parent drill circuit)","P/N 279729"],["Packaging of the two cables","a single assembly in spiral wrap"],["Connection to the RodBot control panel","connectors 2 and 4"]]},{"t":"sub","text":"JUNCTION BOX"},{"t":"ul","items":["The junction box mounts on the parent drill.","It holds a 120 V AC to 24 V DC power supply and a connection point for the emergency-stop cable."]},{"t":"sub","text":"WIRING OPTIONS"},{"t":"ul","items":["Keeping the RodBot and parent drill emergency-stop circuits independent?","Install jumpers between 8-1 and 7-2 per the wiring diagram.","If the parent drill provides sufficient 24 V (section 1.1.3):","The 24 V DC power supply can be omitted; connect the source directly to CONN1."]},{"t":"warn","w":"danger","text":"Install the LP RodBot with a barrier separating the operator from the machine and the drill."},{"t":"warn","w":"danger","text":"Control is by radio remote, from either side of the barrier."},{"t":"warn","w":"danger","text":"Telescopic mast (robotic arm) moving with no command given? Immediately press the ##emergency stop##, then diagnose."}],"figures":[{"page":45,"cap":"Junction box mounting and 24 V DC / emergency-stop link cables"},{"page":46,"cap":"Junction box wiring diagram; connection to connectors 2 and 4 of the RodBot panel"}]},"5-1":{"blocks":[{"t":"p","text":"The RodBot's hydraulic functions are driven by an operator-supplied pump."},{"t":"p","text":"Usually an auxiliary pump mounted on the parent drill."},{"t":"p","text":"Source pump requirements: section 1.1.3."},{"t":"ul","items":["Pressure line","Tank line","Load Sense line","Case drain line"]},{"t":"specs","rows":[["Hydraulic link-hose assembly","P/N 278232, 10 m hoses"],["Quick-connect bulkhead","P/N 278240"],["Bulkhead mounting","2 3/8 in bolts"],["Connection to the RodBot","at the manifold block"]]},{"t":"warn","w":"warn","text":"Replacing the pump may require recalibration."},{"t":"warn","w":"warn","text":"The **TRAJECTORY** and **LINEAR** modes rely on set values."},{"t":"warn","w":"warn","text":"These values: latency, ramp speed and maximum hydraulic supply pressure."},{"t":"warn","w":"warn","text":"Either mode performing poorly after a pump change? Contact MEDATech Engineering for a recalibration."}],"figures":[{"page":47,"cap":"Link-hose assembly: pressure, tank, load sense, case drain"},{"page":48,"cap":"Connection bulkhead (2 3/8 in bolts) and RodBot manifold block"}]},"5-2":{"blocks":[{"t":"steps","items":["Connect the RodBot to power via the link cable to the main drill's power box.","Wait for the HMI screen to light up (about **30 seconds**).","Make sure the remote's emergency stop is released.","Press the green start button to power up.","Follow the remote instructions; pair it by pressing the green start button again.","Follow the remote and HMI prompts.","Press the safety reset button on the control panel.","Wait for the startup sequence to finish; the HMI shows the status.","It then switches to **STANDBY** mode.","In STANDBY mode, the system is ready: select modes with the remote side buttons."]},{"t":"warn","w":"note","text":"The HMI screen takes about **30 seconds** to light up."},{"t":"warn","w":"note","text":"The sequence always ends in **STANDBY** mode, the ready-to-use state."}],"figures":[{"page":49,"cap":"HMI screen and normal RodBot power-up sequence"}]},"5-3":{"blocks":[{"t":"p","text":"The mode is selected from the radio remote (diagram in section 6.7)."},{"t":"p","text":"Each mode restricts the accessible functions: this is a protection."},{"t":"p","text":"Only the active mode's commands are processed."},{"t":"specs","rows":[["STANDBY (or STARTUP)","safety mode: no command possible"],["CRAWL","control of the track drives only"],["STABILIZERS","control of the four cylinders (stabilizers) only"],["DIRECT","control mode for the telescopic mast (robotic arm)"],["LINEAR","second control mode for the telescopic mast"],["TRAJECTORY","autonomous arm movement along predefined setpoints"]]}],"figures":[{"page":50,"cap":"Operating mode selection from the radio remote"}]},"5-4":{"blocks":[{"t":"p","text":"All functions can be operated \"manually\"."},{"t":"p","text":"Move the hydraulic valve levers."},{"t":"p","text":"Only possible when the OPERATOR CONTROL selector is in **LOCAL**."},{"t":"warn","w":"warn","text":"Moving the levers manually while in **REMOTE** mode triggers a valve error."},{"t":"warn","w":"warn","text":"The system enters a ##protective stop## and cuts hydraulic power."},{"t":"steps","items":["Set the machine to LOCAL mode with the switch on the low-voltage control panel.","Press the safety reset button to cancel the protective stop."]},{"t":"ul","items":["Startup is possible if OPERATOR CONTROL is set to LOCAL; or","if OPERATOR CONTROL is on REMOTE and the radio remote is active, emergency stop not pressed in.","\"SAFETY RESET\" restores the safety circuit and radio communication."]}],"figures":[{"page":51,"cap":"\"Tracks and Cylinders\" valve block and manual levers (maintenance only)"}]},"5-5":{"blocks":[{"t":"p","text":"To control the tracks from the remote, set it to **CRAWL** mode."},{"t":"p","text":"Switching to CRAWL is impossible when the gripper jaws are closed."},{"t":"p","text":"Manual levers on the \"Tracks and Cylinders\" block: track maintenance only (section 13.6)."},{"t":"p","text":"The RodBot ships with these levers disconnected, stored in the rear compartment."},{"t":"ul","items":["Slew: oriented parallel to the machine frame","Hoist: fully lowered","Telescope: retracted","Wrist: pointed down","Gripper: open"]},{"t":"specs","rows":[["Maximum speed, fast (Hi)","2.8 km/h"],["Maximum speed, slow (Lo)","1.5 km/h"],["Manual bypass valve","0.55 in square head, turn 90°"],["Switch to fast speed (Hi)","clockwise rotation"],["Switch to slow speed (Lo)","counterclockwise rotation"]]},{"t":"warn","w":"danger","text":"##Never move the RodBot using the manual valves##."},{"t":"warn","w":"danger","text":"Risk of being struck or crushed by the vehicle."},{"t":"warn","w":"danger","text":"Always move the machine by radio remote."},{"t":"warn","w":"danger","text":"Before any move: visually inspect the path (personnel, obstacles, voids, unstable ground)."},{"t":"warn","w":"danger","text":"Never stand in front of or beside the machine."},{"t":"warn","w":"danger","text":"Use a spotter if visibility is obstructed."},{"t":"warn","w":"danger","text":"Keep the link cables out of the path and undercarriage: do not drive over them."}],"figures":[{"page":52,"cap":"Transport pose of the arm to adopt before any move"},{"page":53,"cap":"Hi/Lo manual bypass valve (0.55 in square) of the track circuit"}]},"5-6":{"blocks":[{"t":"p","text":"**STANDBY** mode lets you pair the radio remote with the receiver."},{"t":"p","text":"But no command from the remote is processed."},{"t":"p","text":"It is a safe mode to start the remote before the work modes."},{"t":"warn","w":"note","text":"In **STANDBY** mode, all safety functions stay functional."},{"t":"warn","w":"note","text":"That includes the emergency stop, the tilt switch and the lights."}],"figures":[{"page":54,"cap":"Mast range of motion: 6-degrees-of-freedom positioning system"}]},"6-0":{"blocks":[{"t":"steps","items":["Close the gripper on the rod: hold the **green GRIPPER** button and the GRIPPER switch down, at the same time.","Open the gripper, release the rod: **green GRIPPER** button + GRIPPER lever up, for at least **1 second**."]},{"t":"ul","items":["The **green GRIPPER** button is a safety.","Keep it pressed throughout the operation.","Otherwise, the command is ignored."]},{"t":"warn","w":"danger","text":"##Never stand under the mast or the gripper.##"},{"t":"warn","w":"danger","text":"Watch for suspended items in underground mines: electrical cables, water and air lines, ventilation ducts."},{"t":"warn","w":"danger","text":"Any contact of the telescopic mast can cause ##serious injury, death## or property damage."}],"figures":[{"page":55,"cap":"Gripper control: green button and toggle operated at the same time"},{"page":56,"cap":"Remote face: green GRIPPER button and gripper toggle"}]},"6-1":{"blocks":[{"t":"p","text":"**DIRECT** or **LINEAR**: your choice. LINEAR mode is simplest for most operators."},{"t":"ul","items":["In **DIRECT**, you control each joint (like a crane, one or several actuators).","In **LINEAR**, you control the gripper and rod position directly."]},{"t":"specs","rows":[["DIRECT mode","Joint-by-joint control; WHITE lettering on the face"],["LINEAR mode","Straight-line end-effector control; ORANGE label"],["Left joystick (LINEAR)","Up/Down and Left/Right"],["Right joystick (LINEAR)","In/Out"],["Mast range","6 degrees of freedom; 330° slew between fixed stops (programmable soft stop)"]]},{"t":"ul","items":["FORWARD / BACKWARD: the mast moves the rod toward or away from the base, straight line, horizontal plane.","UP / DOWN: the mast moves the rod straight up and down, same plane.","LEFT / RIGHT: slews the mast on its base (SLEW), as in manual control."]},{"t":"warn","w":"note","text":"In **LINEAR** mode, the control system handles all motion."},{"t":"warn","w":"note","text":"The slew joint (wrist), rotation and tilt stay independently controllable."},{"t":"warn","w":"note","text":"This fine-tunes the end-effector positioning."}],"figures":[{"page":57,"cap":"LINEAR control (orange label) and left/right joystick assignment"},{"page":54,"cap":"Mast range of motion at 6 degrees of freedom"}]},"6-2":{"blocks":[{"t":"p","text":"**TRAJECTORY** mode moves the mast through predefined setpoints."},{"t":"ul","items":["It avoids obstacles (autonomous navigation).","Accessible after activating LINEAR or DIRECT mode.","Minimum required points: DRILL, WAIT, UPPER LIMIT, LOWER LIMIT."]},{"t":"steps","items":["Open the configuration screen: hold the LINEAR (or DIRECT) button for **3 seconds**.","Grab a drill rod by its center (± 2\" / 5 cm).","Position the rod in the drill mast or the presenter.","With the trajectory-point selector, highlight **DRILL** (green = active point).","Push the \"Save/Select\" switch up. A checkmark appears in the icon's box."]},{"t":"specs","rows":[["RACK POINT 1","By default above and center of the rod basket; adjustable"],["RACK POINT 2","2nd rack (on ground/off to the side), longer rods; ≥ 1' (30 cm) above the rack, parallel to storage"],["WAIT","Point outside the mast; last segment = direct path to the rod string; often 1 to 2 feet from DRILL"],["DRILL","Rod release and transfer point to the drill; mandatory"],["POINT 1 / POINT 2","Optional waypoints to route around an obstacle"]]},{"t":"p","text":"Example order: RACK POINT → POINT 2 → POINT 1 → WAIT → DRILL."},{"t":"p","text":"To delete a saved point: highlight it, push the \"Save/Select\" switch down."}],"figures":[{"page":59,"cap":"Trajectory-point selectors and side view of an example automatic mode"},{"page":61,"cap":"Top view: adding a waypoint to route around an obstruction"}]},"6-3":{"blocks":[{"t":"p","text":"The Upper and Lower Limits are two operator-defined horizontal planes."},{"t":"sub","text":"ROLE OF THE LIMITS"},{"t":"ul","items":["They keep the mast and rod out of certain zones.","The software avoids collisions: pipes, roof / back, cross member, floor.","**Mandatory** for TRAJECTORY mode."]},{"t":"sub","text":"EXCLUSION ZONES"},{"t":"ul","items":["The RodBot itself","The drill","The rod basket on the RodBot","The Back","The Floor"]},{"t":"steps","items":["Empty the gripper before lowering it (recommended).","Move the gripper to the height below which the rod and RodBot must not go.","The plane is set by the gripper's center of gravity.","Usually at **30 cm** from the ground, flick the switch up to set the lower plane.","Follow a similar procedure to set the Upper Limit."]},{"t":"warn","w":"note","text":"Rod detected in the gripper in TRAJECTORY mode: the planner assumes a **1.8 m (6')** rod."},{"t":"warn","w":"note","text":"It assumes the rod is held within **5 cm (2\")** of its center."},{"t":"warn","w":"note","text":"It generates a path where no part of the pipe crosses a plane."},{"t":"warn","w":"note","text":"The DRILL point sets the drill's mast position. Redefine it for each new setup."}],"figures":[{"page":62,"cap":"Preset exclusion zones and Upper/Lower Limit planes around the mast"},{"page":63,"cap":"Gripper center of gravity and upper/lower limit plane selectors"}]},"6-4":{"blocks":[{"t":"warn","w":"danger","text":"The RodBot has ##NO vision system##."},{"t":"warn","w":"danger","text":"It detects neither workers, nor vehicles, nor equipment entering its work zone."},{"t":"warn","w":"danger","text":"Limit personnel traffic in the mast's work envelope."},{"t":"warn","w":"danger","text":"Set up barriers, boundaries and operating restrictions per the mine's policies and procedures."},{"t":"warn","w":"warn","text":"Unexpected movement in automatic mode: immediately press one ##emergency-stop button##."},{"t":"warn","w":"warn","text":"On the remote or the robotic system."},{"t":"warn","w":"note","text":"Safety: in CRAWL MODE, if the machine moves, all setpoints are deleted."},{"t":"warn","w":"note","text":"Exception: RACK POINT 1 is kept."},{"t":"warn","w":"note","text":"Reconfigure all others from the new location."},{"t":"warn","w":"note","text":"The TRAJECTORY settings (points and limits) are kept even after power-off and restart."},{"t":"warn","w":"note","text":"At the end of each task, delete the points and the upper and lower limits."},{"t":"warn","w":"note","text":"Do it before the next setup."}],"figures":[{"page":62,"cap":"Mast work envelope, no presence detection in the zone"}]},"6-5":{"blocks":[{"t":"steps","items":["Confirm all required trajectory points and the upper and lower limits are set.","With the selector, choose the destination: DRILL or WAIT, and RACK POINT 1 or 2.","Hold the **yellow TRAJECTORY** button and move the right lever: RIGHT = RACK, LEFT = DRILL.","Once movement starts, release the yellow button. The mast continues while the lever stays operated.","Releasing the joysticks immediately stops the mast."]},{"t":"ul","items":["Release the yellow button: the remote returns to the previous LINEAR or DIRECT mode.","You can take back manual control at any time.","Reactivating TRAJECTORY (yellow button + right lever) generates a new collision-free path.","The mode works only while a collision-free path is possible."]},{"t":"warn","w":"note","text":"Right lever directions: RIGHT = RACK, LEFT = DRILL."}],"figures":[{"page":64,"cap":"Yellow TRAJECTORY button and right lever to start the autonomous move"},{"page":65,"cap":"Linear mode selected: moving the rod to the DRILL or the RACK"}]},"6-6":{"blocks":[{"t":"p","text":"The frame has alignment features to correctly position the rod basket."},{"t":"ul","items":["The basket is **not bolted** or clamped.","It is held only by the frame's retaining devices."]},{"t":"steps","items":["Engage the basket's fork pockets into the frame profiles.","Position the basket between the two frame retaining tabs.","Confirm the basket is properly held before any handling."]},{"t":"warn","w":"note","text":"The basket rests on retainers, it is not bolted."},{"t":"warn","w":"note","text":"Check its engagement and alignment before loading rods or moving the machine."}],"figures":[{"page":65,"cap":"Rod basket alignment: fork pockets and frame retaining tabs"}]},"7-0":{"blocks":[{"t":"p","text":"The troubleshooting guide (section 12) presents each symptom: Failure / Possible cause / Check-Solution."},{"t":"sub","text":"ORDER OF CHECKS"},{"t":"ul","items":["Start with the simple checks.","Control mode, emergency stops, remote battery.","Only then, the hydraulics or the encoders."]},{"t":"specs","rows":[["Does not power on (REMOTE mode, remote OFF)","Set OPERATOR CONTROL to LOCAL, turn on the remote, press SAFETY RESET"],["Does not power on (emergency stop pressed)","Reset the emergency-stop button(s), then SAFETY RESET"],["Stops in REMOTE mode (remote e-Stop)","Reset the e-Stop, set the remote bypass to ON, SAFETY RESET, restart"],["Radio remote does not power on","Replace or recharge the battery; check that the key is present in the remote"],["Mast functions abnormally slow","Switch from SLOW (TURTLE) mode to FAST (RABBIT) mode"],["Does not work in AUTO or on the TIP","Check the encoders and their wiring on the HMI screen"],["Base rotation range too limited","Reset the software stops (section 8.2); a 2-3° gap from the mechanical stops is normal"],["Erratic mast or unpredictable trajectory","Check encoders, fasteners and zero points; recalibrate the mast (section 8.6)"]]},{"t":"sub","text":"UNIT ACTIVATION"},{"t":"ul","items":["Turn the remote ON before setting the selector to REMOTE.","The tilt switch blocks turn-on if the unit is not held horizontal."]},{"t":"sub","text":"MAST NOT MOVING"},{"t":"ul","items":[{"text":"Mast not moving while everything seems ready, check:","sub":["the error messages","power to the check-valve coil connector","the oil supply / load-sense line","the tightening of the hoses on the drill","that the radio receiver is powered"]}]},{"t":"warn","w":"note","text":"For any assistance beyond this manual, contact the MEDATech team: service@medatech.ca or +1 (705) 443-8440, ext. 4."}],"figures":[]},"7-1":{"blocks":[{"t":"p","text":"Regular maintenance is essential to safe, reliable and efficient RodBot operation."},{"t":"ul","items":["This section is for qualified maintenance personnel.","This manual is not a detailed overhaul guide.","For any task not covered, contact MEDATech engineering services."]},{"t":"warn","w":"danger","text":"##Before any maintenance, including washing: power off the RodBot.##"},{"t":"warn","w":"danger","text":"Disconnect the electrical supply."},{"t":"warn","w":"danger","text":"Apply the ##lockout-tagout (LOTO)## procedure on all electrical systems."},{"t":"warn","w":"warn","text":"Some devices store ##hydraulic energy## (e.g. cylinders with counterbalance valves)."},{"t":"warn","w":"warn","text":"This energy can remain even when powered off."},{"t":"ul","items":["Only qualified personnel should carry out repairs, troubleshooting or maintenance.","Follow safe practices and local requirements for any work at height.","Perform maintenance with the articulation (shoulder) horizontal or lower.","This avoids unnecessary work at height."]}],"figures":[]},"7-2":{"blocks":[{"t":"p","text":"Clean the RodBot, but ##never spray## the electrical components directly."},{"t":"ul","items":["This concerns the rotary encoders and the electrical panel.","Even water-resistant, their seals are fragile.","A direct pressure-washer jet can damage them."]},{"t":"warn","w":"warn","text":"Washing counts as maintenance: ##lock out and power off the equipment## before cleaning."}],"figures":[]},"7-3":{"blocks":[{"t":"p","text":"Regular inspections protect operators and catch costly failures early."},{"t":"p","text":"Report any problem immediately to management and/or maintenance personnel."},{"t":"specs","rows":[["Inspect hoses, hydraulic lines and electrical cables (damage/leaks)","Daily"],["Test the RodBot without a rod (movement as expected)","Daily"],["Confirm that all emergency stops are functional","Weekly"],["Lubricate the linkage pivot points and the slew rings","Weekly"],["Adjust the telescopic joint wear pads","As needed"],["Check the oil level of the track drive gearbox","Every 500 h"],["Drain and replace the track drive gearbox oil","Every 2,000 h"],["Inspect the tracks","Weekly"],["Inspect the mechanical structures (deformation, weld cracks)","Weekly"]]}],"figures":[]},"7-4":{"blocks":[{"t":"specs","rows":[["Hydraulic oil","ISO 46 viscosity grade"],["Grease for mechanical joints","EP2"],["Final drive gearbox oil","SAE 80W90"]]},{"t":"ul","items":["4 grease points on the base slew ring","4 grease points on the rotation slew ring","2 grease points on the tilt cylinder"]},{"t":"steps","items":["Grease the joint through the slew ring grease fittings.","Move the joint about 30 degrees.","Repeat over the full range of motion to fully lubricate the ring."]},{"t":"warn","w":"danger","text":"##Do not move the slew joints## while a technician is within the machine's working radius."}],"figures":[{"page":73,"cap":"Grease points on the slew rings (grease fittings circled in green)"}]},"7-5":{"blocks":[{"t":"p","text":"The telescope slide runs on eight plastic pads (pucks)."},{"t":"p","text":"These pads wear over time."},{"t":"p","text":"Their gauge-plate adjustment and replacement are technician tasks."},{"t":"p","text":"**Technician intervention.** See manual p.74-75."}],"figures":[{"page":74,"cap":"Telescope wear pads and location of the adjustment screws"},{"page":75,"cap":"Closure plate assembly (item 1), thrust plate (item 2) and pad (item 3)"}]},"7-6":{"blocks":[{"t":"p","text":"Tension: the track sag (slack) must measure between **20 and 25 mm**."},{"t":"p","text":"Check with a straightedge and a tape measure."},{"t":"p","text":"##Never let the sag exceed 30 mm## and avoid over-tensioning."},{"t":"steps","items":["Access the track adjustment valve, behind the nameplate.","To tension: inject grease into the cylinder with a grease gun.","To slacken: slowly unscrew the valve to release grease."]},{"t":"specs","rows":[["New","22 mm"],["25 % wear","18.5 mm"],["50 % wear","15 mm"],["75 % wear","11.5 mm"],["Wear limit (100 %)","8 mm"]]},{"t":"warn","w":"warn","text":"Track pad wear is measured by dimension \"X\": ##replace the track as soon as X is below 8 mm##."}],"figures":[{"page":75,"cap":"Checking track sag (20 to 25 mm) with a straightedge and tape"},{"page":76,"cap":"Measuring pad wear (dimension X) and tension adjustment fitting behind the nameplate"}]},"7-7":{"blocks":[{"t":"sub","text":"MOVING METHODS"},{"t":"ul","items":["Autonomous travel (tramming)","Ground towing","Forklift or telehandler","Towing on a lowboy trailer"]},{"t":"sub","text":"BEFORE MOVING"},{"t":"ul","items":[{"text":"Before any move, set the arm in the prescribed pose.","sub":["The maximum grade is calculated for this pose.","Any deviation shifts the center of gravity and reduces stability."]}]},{"t":"specs","rows":[["Frame anchor points","4 points (tie-down, towing, lifting)"],["Rod basket lifting points","4 points 9/16 in in diameter"],["Fork lifting","Fork passages on the side of the frame and on the rod basket"]]},{"t":"steps","items":["Disengage the SAHR brake and firmly secure the machine to the vehicle before any towing.","**Technician intervention.** See manual p.78.","##After towing, reinstall the SAHR brake plugs, otherwise the machine has no brakes.##"]},{"t":"warn","w":"danger","text":"##Always firmly secure the machine before disengaging the hubs.##"},{"t":"warn","w":"danger","text":"Otherwise, risk of uncontrolled movement and serious injury."},{"t":"warn","w":"danger","text":"##Reinstall the brake after towing to restore braking.##"},{"t":"warn","w":"danger","text":"Without brakes, the machine endangers all personnel and equipment in the area."}],"figures":[{"page":77,"cap":"Arm pose to adopt before any move of the machine"},{"page":78,"cap":"SAHR brake disable plug to remove with an M16 hex wrench"}]},"7-8":{"blocks":[{"t":"p","text":"Appendices A to E cover technician tasks."},{"t":"ul","items":["Administrator login.","PPU reset and update.","AUTEC remote pairing.","The data logger."]},{"t":"p","text":"**Technician intervention.** See manual p.81-86. For any of these, contact MEDATech."}],"figures":[{"page":81,"cap":"PPU power button to hold for 5 s for the reset"},{"page":86,"cap":"HMI home screen showing the PPU software version"}]}};

var QUIZ2_EN = {"0":[{"type":"vf","text":"The RodBot LP has its own onboard power source (engine or batteries).","options":["True","False"],"correct":1,"page":6,"fb":"The RodBot has no onboard power source: it draws both its electrical AND hydraulic supply from a cabled connection to the drill. This cable also links the emergency-stop circuits of the two machines."},{"type":"multi","text":"Among these modes, which ones control the MAST (robotic arm)? Check all correct answers.","options":["DIRECT","LINEAR","CRAWL","TRAJECTORY"],"correct":[0,1,3],"page":6,"fb":"DIRECT, LINEAR and TRAJECTORY are the three mast control modes. CRAWL, on the other hand, only controls the tracks (moving the machine)."},{"type":"order","text":"Rank the three mast control modes, from most manual to most automated.","options":["TRAJECTORY","DIRECT","LINEAR"],"correct":[1,2,0],"page":6,"fb":"DIRECT (each joint controlled separately) → LINEAR (the end effector follows straight lines) → TRAJECTORY (autonomous movement between recorded points)."},{"type":"cloze","text":"The maximum lifting load per electromagnet is _____ lb.","options":["120","308","500"],"correct":0,"page":8,"fb":"120 lb per electromagnet. The general-purpose maximum lifting load is higher: 308 lb."},{"type":"qcm","text":"What is the capacity of the rod basket?","options":["20 rods","35 rods","50 rods"],"correct":1,"page":8,"fb":"The basket holds 35 rods (Ø 5 in × 6 ft)."}],"1":[{"type":"qcm","text":"Who is authorized to commission and operate the RodBot?","options":["Any mine employee","Trained, authorized and fit personnel","Anyone accompanied by a supervisor"],"correct":1,"page":10,"fb":"Only personnel trained on the equipment, authorized, aware of the hazards and in good physical and mental condition may operate it."},{"type":"vf","text":"In the event of a hydraulic fluid injection injury under the skin, it is enough to apply a bandage and monitor it.","options":["True","False"],"correct":1,"page":11,"fb":"FALSE : this is an emergency: contact medical services immediately. A subcutaneous injection of high-pressure fluid can lead to gangrene and severe reactions."},{"type":"cloze","text":"Outdoors, the system must not be used in high winds above _____ km/h.","options":["45","65","90"],"correct":1,"page":11,"fb":"65 km/h. The system must also not be used during a thunderstorm."},{"type":"multi","text":"Where are the four emergency stops located? Check the four correct locations.","options":["Low-voltage control panel (below the HMI)","On the rod basket","Radio remote (center, bottom)","RodBot chassis (lower front right corner)","Manual controls (at the rear)"],"correct":[0,2,3,4],"page":12,"fb":"The 4 e-Stops: low-voltage panel, radio remote, chassis (lower front right corner) and rear manual controls. Nothing on the rod basket. A coupled e-Stop stops both the RodBot AND the drill."},{"type":"order","text":"Rank the manual's three pictograms from most severe to least severe.","options":["CAUTION","DANGER","WARNING"],"correct":[1,2,0],"page":10,"fb":"DANGER (life-threatening situation) → WARNING (safety-critical information) → CAUTION (preventing injury/property damage)."}],"2":[{"type":"qcm","text":"Which function does mast segment J1 correspond to?","options":["The TELESCOPE","The SLEW","The TILT"],"correct":1,"page":13,"fb":"J1 = SLEW. The segments run from J1 (slew) to J6 (tilt), with the end effector being the GRIPPER."},{"type":"vf","text":"In LOCAL mode, the motion signals sent by the radio remote are acted upon.","options":["True","False"],"correct":1,"page":14,"fb":"FALSE : in LOCAL mode, the remote's motion signals are ignored and the 'No Radio' icon is displayed. The OPERATOR CONTROL switch must be set to REMOTE."},{"type":"cloze","text":"To operate the radio remote, the panel's OPERATOR CONTROL switch must be in the _____ position.","options":["LOCAL","REMOTE","STANDBY"],"correct":1,"page":14,"fb":"REMOTE. In LOCAL, radio motion commands are ignored."},{"type":"qcm","text":"What happens to the two hydraulic isolation valves in the event of a power failure?","options":["They stay in their last state","They open to release the pressure","They close, no more hydraulic operation"],"correct":2,"page":16,"fb":"Normally closed, they default to closed on a power loss: all hydraulic operation becomes impossible (they can be forced open by hand, counterclockwise)."},{"type":"order","text":"Put the first three mast segments back in order J1 → J2 → J3.","options":["TELESCOPE","SLEW","JOINT (shoulder)"],"correct":[1,2,0],"page":13,"fb":"J1 SLEW → J2 JOINT (shoulder) → J3 TELESCOPE."}],"3":[{"type":"vf","text":"Removing the physical key from the remote during operation has no consequences.","options":["True","False"],"correct":1,"page":17,"fb":"FALSE : without the key the RRC will not power on, and removing it during operation breaks the link with the receiver and triggers a stop."},{"type":"qcm","text":"By how much does Slow mode (Turtle) reduce joint speed?","options":["25%","50%, except the gripper","75%, including the gripper"],"correct":1,"page":19,"fb":"Turtle applies −50% to all joints in DIRECT, LINEAR and TRAJECTORY modes, except the gripper, which keeps its speed."},{"type":"qcm","text":"The remote is tilted or falls to the ground. What does the RodBot do?","options":["It continues its movement","It goes into a safety stop: hydraulics cut off","It triggers the drill's wired e-Stop"],"correct":1,"page":19,"fb":"The tilt switch puts the RodBot into a safety stop (hydraulics cut off) WITHOUT triggering the drill's wired e-Stop. It returns to standby as soon as the RRC is brought back to horizontal with the joysticks at neutral."},{"type":"vf","text":"A FLASHING amber beacon means the mast is in TRAJECTORY mode or the machine is moving (CRAWL).","options":["True","False"],"correct":0,"page":20,"fb":"TRUE. Beacon: steady = remote control active · flashing = trajectory or movement · off = LOCAL mode."},{"type":"order","text":"To change the battery WITHOUT triggering an emergency stop, put the steps back in order.","options":["Set the selector back to REMOTE","Set the OPERATOR CONTROL selector to LOCAL","Replace the battery","Turn off the RRC (emergency stop)","Turn the RRC back ON"],"correct":[1,3,2,4,0],"page":44,"fb":"LOCAL → turn off the RRC (e-Stop) → replace the battery → RRC ON → check the radio link → set the selector back to REMOTE."}],"4":[{"type":"qcm","text":"Before resuming operation after faults, what must be cleared?","options":["Only the active faults","Both active AND inactive faults","Restart the machine, nothing else"],"correct":1,"page":27,"fb":"All faults, both active AND inactive, must be cleared (select the row, then 'Clear fault')."},{"type":"cloze","text":"The slew mechanical stops are at ±165°, giving a total travel of _____°.","options":["180","330","360"],"correct":1,"page":32,"fb":"330° (±165°, with a 30° dead zone at the front). The default software limits are 10° and 320°."},{"type":"vf","text":"A valve error bypass ignores only the specific selected fault.","options":["True","False"],"correct":1,"page":32,"fb":"FALSE : an active bypass ignores ALL faults on that valve. Reserved for an experienced operator, only for a known non-critical fault."},{"type":"qcm","text":"The mast becomes jerky in LINEAR mode even though the encoders are properly calibrated. What should you do?","options":["A joint adjustment (PPU calibration)","Replace the pump","Switch to Rabbit mode"],"correct":0,"page":35,"fb":"A joint calibration (PPU): adjusting the Threshold and Dynamics. During calibration, the joints move without direct command, allow for the required clearance."},{"type":"vf","text":"CRAWL-mode valves showing a fault DURING MAST mode indicate a serious problem.","options":["True","False"],"correct":1,"page":41,"fb":"FALSE : this is normal: valves outside their designated mode show a fault. Only be concerned if the fault appears in the designated mode."}],"5":[{"type":"qcm","text":"How must the RodBot be set up relative to the operator?","options":["A barrier separates them, radio control from either side","Side by side for better visibility","It doesn't matter, the radio reaches 100 m"],"correct":0,"page":45,"fb":"A BARRIER must separate the operator from the machine and the drill; control is done by radio from either side. The RodBot has no vision system."},{"type":"vf","text":"You can switch to CRAWL mode (movement) even if the gripper jaws are closed.","options":["True","False"],"correct":1,"page":51,"fb":"FALSE : switching to CRAWL is impossible if the gripper jaws are closed."},{"type":"multi","text":"What is the transport pose to adopt before any movement? Check all the conditions.","options":["Slew parallel to the chassis","Hoist lowered fully","Gripper closed on a rod","Telescope retracted","Wrist pointing down","Gripper open"],"correct":[0,1,3,4,5],"page":51,"fb":"Transport pose: slew parallel to the chassis, hoist lowered, telescope retracted, wrist down, gripper OPEN. A gripper closed on a rod is not part of it (and prevents CRAWL)."},{"type":"qcm","text":"A manual lever is operated while the machine is in REMOTE mode. What happens?","options":["The lever takes priority","Valve error → protective stop, hydraulics cut off","The movement adds to the radio command"],"correct":1,"page":50,"fb":"The system detects a valve error and goes into a protective stop (hydraulics cut off). To clear: switch to LOCAL + safety reset button."},{"type":"order","text":"Put the first steps of the start-up sequence back in order.","options":["Press the green start button","Connect the RodBot to the power supply (link cable)","Press the panel's safety reset","Wait for the HMI to power up (~30 s)"],"correct":[1,3,0,2],"page":49,"fb":"Connect the power supply → wait for the HMI (~30 s) → green start button (then pair the RRC) → safety reset → sequence ends in STANDBY mode."}],"6":[{"type":"qcm","text":"How do you open the gripper (jaws)?","options":["Hold the green GRIPPER button + hold the rocker up ≥ 1 s","A single press of the rocker","A quick double-press of the green button"],"correct":0,"page":55,"fb":"OPEN: hold the green GRIPPER button + hold the rocker up for at least 1 second (protection against dropping rods). CLOSE: green button + rocker down."},{"type":"vf","text":"The RodBot automatically detects a person entering its work area.","options":["True","False"],"correct":1,"page":63,"fb":"FALSE : the RodBot has NO vision system: it detects neither personnel, nor vehicles, nor equipment. Barriers and access restrictions are mandatory."},{"type":"multi","text":"Which points/limits are MANDATORY to use TRAJECTORY mode? Check all.","options":["DRILL","POINT 1","WAIT","UPPER LIMIT","LOWER LIMIT"],"correct":[0,2,3,4],"page":61,"fb":"TRAJECTORY prerequisites: DRILL, WAIT and the upper and lower LIMITS. POINT 1 (and POINT 2) are only optional waypoints."},{"type":"qcm","text":"After moving in CRAWL mode, what happens to the recorded setpoints?","options":["They are all kept","They are all deleted except DECK POINT 1","They are converted to default points"],"correct":1,"page":63,"fb":"Built-in safety: switching to CRAWL and moving the machine deletes all points EXCEPT DECK 1. The others must be redefined from the new location."},{"type":"cloze","text":"The rod basket is not rigidly fixed: it is not _____, only held by the chassis retention devices.","options":["bolted","painted","graduated"],"correct":0,"page":65,"fb":"It is not bolted: fork pockets + retention brackets ensure its alignment and holding."}],"7":[{"type":"qcm","text":"Before any maintenance, including washing, what must you do?","options":["Power down, disconnect and apply lockout-tagout (LOTO)","Switch to STANDBY mode","Close the gripper"],"correct":0,"page":71,"fb":"Powered down, power supply disconnected and LOTO on all systems, washing counts as maintenance. Warning: some cylinders with counterbalance valves store hydraulic energy."},{"type":"qcm","text":"The mast functions are abnormally slow. Most likely cause?","options":["Worn pump","Slow mode (Turtle) is active → switch to Rabbit","Low RRC battery"],"correct":1,"page":67,"fb":"Slow mode (Turtle) reduces speed by 50%. Switch to Fast mode (Rabbit)."},{"type":"cloze","text":"The correct track sag (slack) is between 20 and _____ mm.","options":["25","30","40"],"correct":0,"page":75,"fb":"20 to 25 mm. Never exceed 30 mm or over-tension. Replace the track when the 'X' wear drops below 8 mm."},{"type":"vf","text":"After towing, it is not necessary to reinstall the SAHR brake plugs.","options":["True","False"],"correct":1,"page":76,"fb":"FALSE : without the SAHR plugs reinstalled, the machine has NO brakes. Towing requires removing the plugs from both tracks (M16 wrench) after securing the machine, then reinstalling them afterward."},{"type":"qcm","text":"Which hydraulic oil is approved for the RodBot?","options":["ISO 46","SAE 80W90","ATF Dexron III"],"correct":0,"page":72,"fb":"Hydraulic oil of viscosity grade ISO 46. Joint grease: EP2. Final drive gearbox oil: SAE 80W90."}]};

var RRC_SPOTS_EN = [
  { x:50, y:22, name:"Remote display", page:23, desc:"Non-touch screen: the keypad buttons above correspond to the on-screen icons (MAGNET, TRAJ, LINEAR on the left; DIRECT, STABS, CRAWL on the right). It shows the system status, the active mode, the gripper and magnet status, the battery and the trajectory points. The yellow box marks the selected item." },
  { x:26, y:52, name:"Left joystick (JS1)", page:21, desc:"Proportional, self-centering. In DIRECT: slew (L/R) and hoist (U/D). In LINEAR: end effector up/down and left/right. The detented JAW TILT thumbwheel on top controls the jaw tilt (J6)." },
  { x:73, y:50, name:"Right joystick (JS2)", page:21, desc:"In DIRECT: telescope (extend/retract) and wrist (U/D). In LINEAR: end effector toward the drill or toward the basket. In TRAJECTORY: held right = toward the DECK, held left = toward the DRILL. JAW ROTATE thumbwheel: jaw rotation (J5)." },
  { x:50.5, y:74, name:"Emergency stop (e-Stop)", page:18, desc:"Red mushroom button wired to a relay in series with the e-Stops of the RodBot and the parent drill: one press stops BOTH machines. Warning: in LOCAL mode, this button does not work. Click it to test!", estop:true },
  { x:40.5, y:76, name:"TRAJ button (yellow)", page:64, desc:"Activates TRAJECTORY mode: hold this button + right joystick to start the automatic movement of the mast between the recorded points. Once the movement has begun, the button can be released; releasing the joystick stops the mast." },
  { x:60, y:76, name:"GRIPPER button (green)", page:55, desc:"Gripper activation, two simultaneous actions required: CLOSE = green button + rocker down. OPEN = hold green button + hold rocker up for at least 1 second (protection against dropping rods)." },
  { x:41, y:60, name:"Trajectory point (selection)", page:58, desc:"Setpoint selection switch (DECK, WAIT, DRILL, POINT 1-2…). To access the setup screen: hold the DIRECT or LINEAR button for 3 seconds." },
  { x:59.5, y:60, name:"SAVE / DELETE", page:58, desc:"Saves (up, a checkmark appears on screen) or deletes (down) the selected trajectory point. The upper and lower anti-collision limits are set the same way." },
  { x:20.5, y:76, name:"Electromagnet (ON / OFF)", page:21, desc:"Controls the gripper electromagnet to pick up rods one at a time, maximum lifting load of 120 lb per magnet." },
  { x:26, y:76, name:"Fast / Slow (Rabbit-Turtle)", page:19, desc:"Scaling factor applied to all joints in DIRECT, LINEAR and TRAJECTORY modes. Turtle = speed reduced by 50% : except the gripper, which keeps its speed." },
  { x:33.5, y:76, name:"Horn & beacon", page:21, desc:"Audible alarm and lights. The horn sounds automatically at every mode change to warn nearby personnel." },
  { x:79, y:76, name:"MAST / CRAWL", page:50, desc:"Selects the major modes: mast control (DIRECT / LINEAR / TRAJECTORY) or machine movement (CRAWL : tracks). Switching to CRAWL is impossible if the gripper jaws are closed." },
  { x:11, y:86, name:"Tilt switch (internal)", page:19, desc:"Internal sensor: if the remote is tilted or falls (operator in distress), the RodBot goes into a safety stop, hydraulic supply cut off. Return to horizontal + joysticks at neutral = automatic return to standby. Test it at the start of every shift." }
];

var SIM_MODES_EN = [
  { id:"VEILLE",   tag:"SAFETY", desc:"No command is processed. E-Stop, tilt switch and lights remain active. Safe mode for pairing the remote.", beacon:"on",    tracks:false, mast:false },
  { id:"RALENTI",  tag:"TRAM",     desc:"Machine movement, tracks only. Prohibited if the gripper jaws are closed. The beacon flashes to warn personnel.", beacon:"blink", tracks:true, mast:false },
  { id:"STABILISATEURS", tag:"TRAM", desc:"Controls the 4 stabilizer cylinders only.", beacon:"on", tracks:true, mast:false },
  { id:"DIRECT",   tag:"MAST",      desc:"Each mast joint is controlled individually with the joystick, like a conventional crane (white markings).", beacon:"on", tracks:false, mast:true },
  { id:"LINÉAIRE", tag:"MAST",      desc:"The end effector follows straight X-Y-Z lines: the system coordinates several valves simultaneously (orange labels). The simplest for most operators.", beacon:"on", tracks:false, mast:true },
  { id:"TRAJECTOIRE", tag:"MAST",   desc:"The mast moves automatically between the recorded points while avoiding collisions. Prerequisites: DRILL, WAIT and defined limits. The beacon flashes.", beacon:"blink", tracks:false, mast:true },
  { id:"LOCAL",    tag:"PANEL",  desc:"Control by manual levers only. Radio signals are ignored, and the remote's e-Stop DOES NOT WORK. Beacon off.", beacon:"off", tracks:false, mast:false }
];

/* --------- Démarrage --------- */
var __deferredPrompt = null;
try {
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    __deferredPrompt = e;
    try { if (COMP) COMP.setState({ canInstall: true }); } catch (_) {}
  });
  window.addEventListener('appinstalled', function () {
    __deferredPrompt = null;
    try { if (COMP) COMP.setState({ canInstall: false, showInstallHelp: false }); } catch (_) {}
  });
} catch (e) {}

function bootRodbot() {
  ROOT = document.getElementById('app');
  COMP = new Component({});
  // Choisit le gabarit selon la langue enregistrée (repli sur FR si l'anglais manque)
  var tplId = (COMP.state.lang === 'en') ? 'rb-template-en' : 'rb-template';
  var tplNode = document.getElementById(tplId) || document.getElementById('rb-template');
  var doc = new DOMParser().parseFromString('<div id="rb-wrap">' + tplNode.textContent + '</div>', 'text/html');
  TPL_ROOT = doc.getElementById('rb-wrap');
  try { document.documentElement.setAttribute('lang', COMP.state.lang); } catch (e) {}
  fullRender();
  // PWA : installation + usage hors-ligne (service worker)
  // Mise à jour automatique : quand une nouvelle version est déployée, le nouveau
  // service worker s'installe puis prend le contrôle, on recharge alors la page
  // une seule fois pour afficher la dernière version (fini le cache figé sur tablette).
  try {
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      // On ne recharge que si un ancien SW contrôlait déjà la page (= vraie mise à jour),
      // jamais lors de la toute première visite (aucun contrôleur au départ).
      var __hadController = !!navigator.serviceWorker.controller;
      var __reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (!__hadController || __reloaded) return; __reloaded = true; location.reload();
      });
      navigator.serviceWorker.register('sw.js').then(function (reg) {
        try { reg.update(); } catch (e) {}
      }).catch(function () {});
    }
  } catch (e) {}
  // Clavier pour le visionneur du manuel : Échap ferme, ← / → naviguent
  document.addEventListener('keydown', function(e){
    if(!COMP) return;
    if(COMP.state.imgView){ if(e.key==='Escape') COMP.closeImg(); return; }
    if(COMP.state.mpage==null) return;
    if(e.key==='Escape') COMP.closeManual();
    else if(e.key==='ArrowLeft') COMP.manualPrev();
    else if(e.key==='ArrowRight') COMP.manualNext();
  });
  // Bouton RETOUR du navigateur / de la tablette : ferme le manuel ou remonte d'un écran
  window.addEventListener('popstate', function(){
    if(!COMP) return;
    if(COMP._suppressPop){ COMP._suppressPop=false; return; }
    if(COMP.appDepth()<=0) return;              // déjà à l'accueil : on laisse quitter la page
    COMP._appDepth = Math.max(0, (COMP._appDepth||0)-1);
    COMP.navBackOne();
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootRodbot);
else bootRodbot();
