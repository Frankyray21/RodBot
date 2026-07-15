/*
 * RodBot LP — Formation opérateur
 * ---------------------------------
 * Application 100 % HTML/CSS/JS, sans aucun framework.
 *
 * Ce fichier contient :
 *   1. Un petit moteur de rendu (~150 lignes) qui interprète le gabarit
 *      déclaratif d'origine ({{ expr }}, <sc-if>, <sc-for>, onClick, onInput,
 *      style-hover) — repris tel quel du design Claude Design.
 *   2. La logique applicative (classe Component) — reprise telle quelle.
 *
 * Le moteur fait un rendu complet à chaque action discrète (clic), et une
 * mise à jour « douce » (en place, sans reconstruire le DOM) pendant la
 * saisie continue (curseurs du simulateur), pour un glissement fluide.
 */
'use strict';

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

    if (lname === 'onclick') {
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
  renderChildren(tnode, scope, el, childSvg);
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
    if (img.__fb) return; img.__fb = true;
    var label = (img.getAttribute('alt') || 'Image du manuel');
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="440">' +
      '<rect width="640" height="440" fill="#dcd6c6"/>' +
      '<rect x="10" y="10" width="620" height="420" fill="none" stroke="#b5641b" stroke-width="2" stroke-dasharray="8 8"/>' +
      '<text x="320" y="205" text-anchor="middle" font-family="Archivo,sans-serif" font-size="22" font-weight="800" fill="#5c5645">' + esc(label) + '</text>' +
      '<text x="320" y="240" text-anchor="middle" font-family="monospace" font-size="13" fill="#8f866f">Photo du manuel — à ajouter dans /img</text></svg>';
    img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  });
}
function esc(s) { return String(s).replace(/[<>&]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]; }); }

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
var QUIZ2 = /*__QUIZ2__*/{"0":[{"type":"vf","text":"Le RodBot LP dispose de sa propre source d'énergie embarquée (moteur ou batteries).","options":["Vrai","Faux"],"correct":1,"page":6,"fb":"Le RodBot n'a aucune source d'énergie embarquée : il tire son alimentation électrique ET hydraulique d'une connexion câblée à la foreuse. Ce câble relie aussi les circuits d'arrêt d'urgence des deux machines."},{"type":"multi","text":"Parmi ces modes, lesquels commandent le MÂT (bras robotisé) ? Cochez toutes les bonnes réponses.","options":["DIRECT","LINÉAIRE","RALENTI","TRAJECTOIRE"],"correct":[0,1,3],"page":6,"fb":"DIRECT, LINÉAIRE et TRAJECTOIRE sont les trois modes de commande du mât. RALENTI, lui, ne commande que les chenilles (déplacement de la machine)."},{"type":"order","text":"Classez les trois modes de commande du mât, du plus manuel au plus automatisé.","options":["TRAJECTOIRE","DIRECT","LINÉAIRE"],"correct":[1,2,0],"page":6,"fb":"DIRECT (chaque articulation commandée séparément) → LINÉAIRE (l'effecteur suit des lignes droites) → TRAJECTOIRE (déplacement autonome entre points enregistrés)."},{"type":"cloze","text":"La charge maximale en levage par électroaimant est de _____ lb.","options":["120","308","500"],"correct":0,"page":8,"fb":"120 lb par électroaimant. La charge maximale en levage à usage général est plus élevée : 308 lb."},{"type":"qcm","text":"Quelle est la capacité du bac à tiges ?","options":["20 tiges","35 tiges","50 tiges"],"correct":1,"page":8,"fb":"Le bac contient 35 tiges (Ø 5 po × 6 pi)."}],"1":[{"type":"qcm","text":"Qui est autorisé à mettre en service et à utiliser le RodBot ?","options":["Tout employé de la mine","Le personnel formé, habilité et apte","Toute personne accompagnée d'un superviseur"],"correct":1,"page":10,"fb":"Seul un personnel formé à l'équipement, habilité, conscient des dangers et en bonne condition physique et mentale peut l'utiliser."},{"type":"vf","text":"En cas de blessure par injection de fluide hydraulique sous la peau, il suffit d'appliquer un pansement et de surveiller.","options":["Vrai","Faux"],"correct":1,"page":11,"fb":"FAUX — c'est une urgence : contacter immédiatement les services médicaux. Une injection sous-cutanée de fluide haute pression peut entraîner gangrène et réactions graves."},{"type":"cloze","text":"En extérieur, il est interdit d'utiliser le système par vents violents supérieurs à _____ km/h.","options":["45","65","90"],"correct":1,"page":11,"fb":"65 km/h. On n'utilise pas non plus le système en cas d'orage."},{"type":"multi","text":"Où se trouvent les quatre arrêts d'urgence ? Cochez les quatre emplacements corrects.","options":["Panneau de commande basse tension (sous l'IHM)","Sur le bac à tiges","Télécommande radio (centre, en bas)","Châssis du RodBot (coin inférieur avant droit)","Commandes manuelles (à l'arrière)"],"correct":[0,2,3,4],"page":12,"fb":"Les 4 e-stops : panneau basse tension, télécommande radio, châssis (coin inf. avant droit) et commandes manuelles arrière. Rien sur le bac à tiges. Un e-stop couplé arrête le RodBot ET la foreuse."},{"type":"order","text":"Classez les trois pictogrammes du manuel du plus grave au moins grave.","options":["ATTENTION","DANGER","AVERTISSEMENT"],"correct":[1,2,0],"page":10,"fb":"DANGER (situation mettant la vie en danger) → AVERTISSEMENT (information cruciale pour la sécurité) → ATTENTION (prévention de blessure/dommage matériel)."}],"2":[{"type":"qcm","text":"À quelle fonction correspond le segment J1 du mât ?","options":["Le TÉLESCOPE","Le PIVOTEMENT (slew)","L'INCLINAISON"],"correct":1,"page":13,"fb":"J1 = PIVOTEMENT (slew). Les segments vont de J1 (pivotement) à J6 (inclinaison), l'effecteur étant le GRAPPIN."},{"type":"vf","text":"En mode LOCAL, les signaux de mouvement envoyés par la télécommande radio sont pris en compte.","options":["Vrai","Faux"],"correct":1,"page":14,"fb":"FAUX — en mode LOCAL, les signaux de mouvement de la télécommande sont ignorés et l'icône « No Radio » s'affiche. Il faut l'interrupteur OPERATOR CONTROL sur À DISTANCE (REMOTE)."},{"type":"cloze","text":"Pour piloter la télécommande radio, l'interrupteur OPERATOR CONTROL du panneau doit être en position _____.","options":["LOCAL","À DISTANCE (REMOTE)","VEILLE"],"correct":1,"page":14,"fb":"À DISTANCE (REMOTE). En LOCAL, les commandes radio de mouvement sont ignorées."},{"type":"qcm","text":"Que deviennent les deux valves d'isolement hydraulique en cas de coupure de courant ?","options":["Elles restent dans leur dernier état","Elles s'ouvrent pour purger la pression","Elles se ferment — plus aucune opération hydraulique"],"correct":2,"page":16,"fb":"Normalement fermées, elles se ferment par défaut à la coupure : toute opération hydraulique devient impossible (elles peuvent être forcées ouvertes à la main, sens antihoraire)."},{"type":"order","text":"Remettez les trois premiers segments du mât dans l'ordre J1 → J2 → J3.","options":["TÉLESCOPE","PIVOTEMENT","ARTICULATION (épaule)"],"correct":[1,2,0],"page":13,"fb":"J1 PIVOTEMENT → J2 ARTICULATION (épaule) → J3 TÉLESCOPE."}],"3":[{"type":"vf","text":"Retirer la clé physique de la télécommande pendant le fonctionnement n'a aucune conséquence.","options":["Vrai","Faux"],"correct":1,"page":17,"fb":"FAUX — sans la clé la RRC ne s'allume pas, et la retirer en cours de fonctionnement rompt la liaison avec le récepteur et déclenche un arrêt."},{"type":"qcm","text":"De combien le mode Lent (Turtle) réduit-il la vitesse des articulations ?","options":["25 %","50 %, sauf le grappin","75 %, grappin compris"],"correct":1,"page":19,"fb":"Turtle applique −50 % à toutes les articulations dans les modes DIRECT, LINÉAIRE et TRAJECTOIRE — sauf le grappin, qui garde sa vitesse."},{"type":"qcm","text":"La télécommande est inclinée ou tombe au sol. Que fait le RodBot ?","options":["Il poursuit son mouvement","Il passe en arrêt de sécurité : hydraulique coupée","Il déclenche l'e-stop câblé de la foreuse"],"correct":1,"page":19,"fb":"L'interrupteur d'inclinaison met le RodBot en arrêt de sécurité (hydraulique coupée) SANS déclencher l'e-stop câblé de la foreuse. Retour en veille dès que la RRC est remise à l'horizontale, manettes au neutre."},{"type":"vf","text":"Le voyant ambre CLIGNOTANT signifie que le mât est en mode TRAJECTOIRE ou que la machine se déplace (RALENTI).","options":["Vrai","Faux"],"correct":0,"page":20,"fb":"VRAI. Voyant : fixe = commande à distance active · clignotant = trajectoire ou déplacement · éteint = mode LOCAL."},{"type":"order","text":"Pour changer la batterie SANS déclencher d'arrêt d'urgence, remettez les étapes dans l'ordre.","options":["Remettre le sélecteur sur À DISTANCE","Placer le sélecteur OPERATOR CONTROL sur LOCAL","Remplacer la batterie","Éteindre la RRC (arrêt d'urgence)","Remettre la RRC sur MARCHE (ON)"],"correct":[1,3,2,4,0],"page":44,"fb":"LOCAL → éteindre la RRC (e-stop) → remplacer la batterie → RRC sur MARCHE → vérifier la liaison radio → remettre le sélecteur À DISTANCE."}],"4":[{"type":"qcm","text":"Avant de reprendre le fonctionnement après des défauts, que faut-il effacer ?","options":["Uniquement les défauts actifs","Les défauts actifs ET inactifs","Redémarrer la machine, rien d'autre"],"correct":1,"page":27,"fb":"Tous les défauts, actifs ET inactifs, doivent être effacés (sélectionner la ligne puis « Effacer le défaut »)."},{"type":"cloze","text":"Les butées mécaniques du pivotement sont à ±165°, soit une course totale de _____°.","options":["180","330","360"],"correct":1,"page":32,"fb":"330° (±165°, zone morte de 30° à l'avant). Les limites logicielles par défaut sont 10° et 320°."},{"type":"vf","text":"Un contournement d'erreur de valve n'ignore que le défaut précis sélectionné.","options":["Vrai","Faux"],"correct":1,"page":32,"fb":"FAUX — un contournement actif ignore TOUS les défauts de cette valve. Réservé à un opérateur expérimenté, uniquement pour un défaut non critique connu."},{"type":"qcm","text":"Le mât devient saccadé en mode LINÉAIRE alors que les codeurs sont bien calibrés. Que faire ?","options":["Un réglage des articulations (étalonnage PPU)","Remplacer la pompe","Passer en mode Rabbit"],"correct":0,"page":35,"fb":"Un étalonnage des articulations (PPU) : réglage du Seuil et de la Dynamique. Pendant l'étalonnage, les articulations bougent sans commande directe — prévoir l'espace requis."},{"type":"vf","text":"Des valves du mode RALENTI qui affichent un défaut PENDANT le mode MÂT indiquent un problème grave.","options":["Vrai","Faux"],"correct":1,"page":41,"fb":"FAUX — c'est normal : les valves hors de leur mode désigné affichent un défaut. Ne s'inquiéter que si le défaut apparaît dans le mode désigné."}],"5":[{"type":"qcm","text":"Comment le RodBot doit-il être installé par rapport à l'opérateur ?","options":["Une barrière les sépare — pilotage radio de part et d'autre","Côte à côte pour une meilleure visibilité","Peu importe, la radio porte à 100 m"],"correct":0,"page":45,"fb":"Une BARRIÈRE doit séparer l'opérateur de la machine et de la foreuse ; le pilotage se fait par radio de part et d'autre. Le RodBot n'a aucun système de vision."},{"type":"vf","text":"On peut passer en mode RALENTI (déplacement) même si les mâchoires du grappin sont fermées.","options":["Vrai","Faux"],"correct":1,"page":51,"fb":"FAUX — le passage en RALENTI est impossible si les mâchoires du grappin sont fermées."},{"type":"multi","text":"Quelle est la pose de transport à adopter avant tout déplacement ? Cochez toutes les conditions.","options":["Pivotement parallèle au châssis","Levage abaissé au maximum","Grappin fermé sur une tige","Télescope rétracté","Poignet orienté vers le bas","Grappin ouvert"],"correct":[0,1,3,4,5],"page":51,"fb":"Pose de transport : pivotement parallèle au châssis, levage abaissé, télescope rétracté, poignet vers le bas, grappin OUVERT. Un grappin fermé sur une tige n'en fait pas partie (et empêche le RALENTI)."},{"type":"qcm","text":"Un levier manuel est actionné pendant que la machine est en mode TÉLÉCOMMANDE. Que se passe-t-il ?","options":["Le levier prend la priorité","Erreur de valve → arrêt de protection, hydraulique coupée","Le mouvement s'additionne à la commande radio"],"correct":1,"page":50,"fb":"Le système détecte une erreur de valve et passe en arrêt de protection (hydraulique coupée). Annulation : passer en LOCAL + bouton de réarmement de sécurité."},{"type":"order","text":"Remettez les premières étapes de la séquence de mise en marche dans l'ordre.","options":["Appuyer sur le bouton vert de démarrage","Raccorder le RodBot à l'alimentation (câble de liaison)","Appuyer sur le réarmement de sécurité du panneau","Attendre l'allumage de l'IHM (~30 s)"],"correct":[1,3,0,2],"page":49,"fb":"Raccorder l'alimentation → attendre l'IHM (~30 s) → bouton vert de démarrage (puis appairer la RRC) → réarmement de sécurité → fin de séquence en mode VEILLE."}],"6":[{"type":"qcm","text":"Comment ouvre-t-on le grappin (pince) ?","options":["Bouton vert GRAPPIN maintenu + bascule vers le haut maintenue ≥ 1 s","Un simple appui sur la bascule","Double appui rapide sur le bouton vert"],"correct":0,"page":55,"fb":"OUVRIR : bouton vert GRAPPIN maintenu + bascule vers le haut maintenue au moins 1 seconde (protection contre les chutes de tige). FERMER : bouton vert + bascule vers le bas."},{"type":"vf","text":"Le RodBot détecte automatiquement une personne qui entre dans sa zone de travail.","options":["Vrai","Faux"],"correct":1,"page":63,"fb":"FAUX — le RodBot n'a AUCUN système de vision : il ne détecte ni personnel, ni véhicules, ni équipements. Barrières et restrictions d'accès sont obligatoires."},{"type":"multi","text":"Quels points/limites sont OBLIGATOIRES pour utiliser le mode TRAJECTOIRE ? Cochez tout.","options":["FOREUSE","POINT 1","ATTENTE","LIMITE SUPÉRIEURE","LIMITE INFÉRIEURE"],"correct":[0,2,3,4],"page":61,"fb":"Prérequis TRAJECTOIRE : FOREUSE, ATTENTE et les LIMITES supérieure et inférieure. POINT 1 (et POINT 2) ne sont que des points de passage optionnels."},{"type":"qcm","text":"Après un déplacement en mode RALENTI, que deviennent les points de consigne enregistrés ?","options":["Ils sont tous conservés","Ils sont tous supprimés sauf le POINT DU PLATEAU 1","Ils sont convertis en points par défaut"],"correct":1,"page":63,"fb":"Sécurité intégrée : passer en RALENTI et déplacer la machine supprime tous les points SAUF le PLATEAU 1. Il faut redéfinir les autres depuis le nouvel emplacement."},{"type":"cloze","text":"Le bac à tiges n'est pas fixé rigidement : il n'est pas _____, seulement maintenu par les dispositifs de retenue du châssis.","options":["boulonné","peint","gradué"],"correct":0,"page":65,"fb":"Il n'est pas boulonné : fourreaux pour fourches + pattes de retenue assurent son alignement et son maintien."}],"7":[{"type":"qcm","text":"Avant tout entretien — y compris le lavage — que faut-il faire ?","options":["Mettre hors tension, débrancher et appliquer le cadenassage-étiquetage (LOTO)","Passer en mode VEILLE","Fermer le grappin"],"correct":0,"page":71,"fb":"Hors tension, alimentation débranchée et LOTO sur tous les systèmes — le lavage compte comme un entretien. Attention : certains vérins à valves d'équilibrage stockent de l'énergie hydraulique."},{"type":"qcm","text":"Les fonctions du mât sont anormalement lentes. Cause la plus probable ?","options":["Pompe usée","Le mode Lent (Turtle) est actif → passer en Rabbit","Batterie de la RRC faible"],"correct":1,"page":67,"fb":"Le mode Lent (Turtle) réduit la vitesse de 50 %. Passer en mode Rapide (Rabbit)."},{"type":"cloze","text":"La flèche (le mou) correcte d'une chenille se situe entre 20 et _____ mm.","options":["25","30","40"],"correct":0,"page":75,"fb":"20 à 25 mm. Ne jamais dépasser 30 mm ni tendre à l'excès. Remplacer la chenille quand l'usure « X » descend sous 8 mm."},{"type":"vf","text":"Après un remorquage, il n'est pas nécessaire de réinstaller les bouchons du frein SAHR.","options":["Vrai","Faux"],"correct":1,"page":76,"fb":"FAUX — sans les bouchons SAHR réinstallés, la machine n'a PLUS de freins. Le remorquage exige de retirer les bouchons des deux chenilles (clé M16) après avoir fixé la machine, puis de les réinstaller après."},{"type":"qcm","text":"Quelle huile hydraulique est approuvée pour le RodBot ?","options":["ISO 46","SAE 80W90","ATF Dexron III"],"correct":0,"page":72,"fb":"Huile hydraulique de classe de viscosité ISO 46. Graisse des articulations : EP2. Huile du réducteur d'entraînement final : SAE 80W90."}]}/*__END_QUIZ2__*/;

var ENRICH = /*__ENRICH__*/{"0-0":{"blocks":[{"t":"p","text":"Le RodBot LP de Borterra est un système robotisé hydraulique de manutention de tiges de forage, conçu pour le chargement et le déchargement sans heurts des tiges. Il élimine la manutention manuelle des tiges — l'une des principales causes d'accidents de travail liés aux foreuses — et s'adapte à une large gamme d'équipements : foreuses, plateaux à tiges et palettes."},{"t":"ul","items":["Transporteur de tiges monté sur chenilles ; les chenilles permettent de repositionner le RodBot à l'intérieur du puits.","Plateau à tiges amovible, conçu pour des tiges de 5 po de diamètre et jusqu'à 6 pi de long.","Alimentation hydraulique et électrique assurée par une connexion câblée (hydraulique et électrique) à une foreuse.","Commande principale par radio-télécommande (RRC), pour déplacer les tiges sans intervention manuelle lors des opérations de forage et de remontée."]},{"t":"warn","w":"note","text":"Le câble de liaison à la foreuse relie également les boutons d'arrêt d'urgence (e-Stop) du RodBot et de la foreuse : les deux circuits d'arrêt d'urgence sont interconnectés."}],"figures":[]},"0-1":{"blocks":[{"t":"ul","items":["Commande directe (aussi appelée « commande manuelle par télécommande radio ») : les manettes activent chaque mouvement de joint rotatif individuellement, comme les commandes d'une machinerie lourde conventionnelle.","Commande linéaire : déplace la tige / le tubage dans une direction linéaire X, Y ou Z d'un simple mouvement de manette ; le système actionne simultanément plusieurs distributeurs hydrauliques. L'opérateur conserve un contrôle individuel des actionneurs rotatifs de l'effecteur terminal (poignet, rotation, inclinaison du grappin).","Contrôle de trajectoire : le mât se déplace automatiquement d'une posture initiale vers une posture finale définie par l'utilisateur, en suivant une trajectoire calculée par le RodBot pour minimiser le temps de déplacement tout en évitant les collisions."]},{"t":"p","text":"Pour le mode trajectoire, l'opérateur définit et enregistre d'abord des points de destination et des points de cheminement dans l'espace, en manipulant le mât par commande directe ou linéaire ; les tiges peuvent ensuite être déplacées entre deux emplacements d'un seul mouvement de manette. Détails aux sections 11.6.3 (linéaire) et 11.6.4 (trajectoire)."}],"figures":[]},"0-2":{"blocks":[{"t":"p","text":"L'illustration de la page 7 identifie les principaux composants de la machine."},{"t":"ul","items":["Grappin","Bac à tubes","Chenilles","Vérins de stabilisation","Boîtier de télécommande","Voyant lumineux","Panneau électrique 24 V","Piédestal","Mât","Compartiment de rangement"]}],"figures":[{"page":7,"cap":"Vue d'ensemble : composants principaux du RodBot LP (grappin, mât, piédestal, bac à tubes, chenilles, vérins de stabilisation, panneau électrique 24 V, voyant, boîtier de télécommande)."}]},"0-3":{"blocks":[{"t":"specs","rows":[["Poids à vide","5800 lb"],["Poids avec bac vide","6500 lb"],["Longueur","116 po"],["Largeur","60 po"],["Hauteur minimale","90 po"]]},{"t":"specs","rows":[["Charge max., levage à usage général","308 lb"],["Charge max., levage de tiges par électroaimant","120 lb"],["Diamètre des tiges","5 po"],["Longueur des tiges","6 pi"],["Capacité du bac","35 tiges"],["Portée verticale max. (tige verticale, depuis le sol)","159 po"],["Portée horizontale max. (depuis l'axe central)","119 po"]]}],"figures":[]},"0-4":{"blocks":[{"t":"specs","rows":[["Alimentation électrique","120 V c.a."],["Intensité maximale absorbée","4.5 A"],["Alimentation hydraulique","Depuis la pompe (non incluse) via l'ensemble de liaison (inclus)"],["Type de pompe requis","Cylindrée variable avec détection de charge"],["Plage de pression d'alimentation","2500-3000 psi"],["Débit maximal requis","80 L/min"],["Raccords hydrauliques","Pression (P), Réservoir (T), Drain de carter (T/Dr), Détection de charge (LS)"],["Longueur de l'ensemble de liaison","30 pi"]]},{"t":"specs","rows":[["Garde au sol","10 po"],["Transmission","Hydrostatique en circuit ouvert"],["Freins","À serrage par ressort, hydrostatiques"],["Pente max. de déplacement, bac vide","35° / 70 %"],["Pente max. de déplacement, bac plein","28° / 53 %"],["Pente max., manipulation des tiges","15° / 27 %"],["Longueur des chenilles","71 po"],["Écartement des chenilles","46 po"],["Largeur des chenilles","12 po"],["Vitesse max. de déplacement lent","2.8 km/h"],["Course des stabilisateurs","10.5 po"]]}],"figures":[]},"1-0":{"blocks":[{"t":"p","text":"Ce chapitre de sécurité couvre spécifiquement l'ajout de la télécommande radio et la mise en œuvre de la planification de trajectoire sur le manipulateur de tiges de forage du mât."},{"t":"ul","items":["L'opérateur doit avoir lu et compris le manuel d'utilisation et respecter les calendriers d'entretien recommandés.","Le Rod Handler ne doit être utilisé, entretenu et réparé que par du personnel formé à l'équipement et conscient des dangers qu'il présente.","Le personnel doit respecter les réglementations générales et locales en matière de sécurité et de santé."]},{"t":"warn","w":"note","text":"Le fabricant décline toute responsabilité pour les dommages résultant d'une utilisation inappropriée ou de modifications arbitraires apportées à l'équipement."}],"figures":[]},"1-1":{"blocks":[{"t":"specs","rows":[["DANGER","Situation mettant la vie en danger — doit impérativement être évitée."],["AVERTISSEMENT","Information d'une importance cruciale pour la sécurité."],["ATTENTION","Information visant à prévenir tout risque de blessure et/ou de dommage matériel."]]},{"t":"warn","w":"note","text":"Les procédures décrites dans le manuel ne dispensent pas l'opérateur de faire preuve de prudence, ni de respecter la réglementation régionale et les règles, réglementations et pratiques de sécurité spécifiques au site et à l'entreprise."}],"figures":[{"page":10,"cap":"Pictogrammes de sécurité du manuel : DANGER, AVERTISSEMENT et ATTENTION."}]},"1-2":{"blocks":[{"t":"ul","items":["N'utiliser le système robotisé qu'après une formation complète et une habilitation en règle.","Toujours lire et comprendre toutes les étiquettes avant d'utiliser le système.","N'utiliser l'équipement qu'en bonne condition physique et mentale, jamais sous l'influence de l'alcool ou de drogues.","Ne jamais retirer les protections et capots de sécurité lorsque le système est sous tension et en fonctionnement.","Nettoyer les déversements et fuites d'huile avant la mise en service et résoudre tous les dysfonctionnements avant toute remise en service.","N'utiliser que des pièces de rechange identiques ou équivalentes aux pièces d'origine."]},{"t":"warn","w":"danger","text":"Fluides sous pression : une fuite d'huile hydraulique à haute pression sur la peau peut provoquer une injection sous-cutanée. En cas de blessure, contacter immédiatement les services médicaux d'urgence ou un médecin habitué à ce type de blessure — risque de gangrène ou de réactions allergiques graves."},{"t":"warn","w":"warn","text":"En extérieur, ne pas utiliser le système en cas d'orage ou de vents violents supérieurs à 65 km/h. Ne pas l'utiliser non plus si une erreur est signalée par le système de commande ou si son bon fonctionnement est compromis."},{"t":"warn","w":"note","text":"N'entreprendre aucune opération d'entretien ou de réparation sans y avoir été autorisé, sans qualification appropriée et sans avoir lu et compris les consignes de sécurité du fabricant ; vérifier la réglementation locale et celle spécifique à la mine."}],"figures":[{"page":11,"cap":"Icônes des premières étapes — pratique sécuritaire de pleine conscience."}]},"1-3":{"blocks":[{"t":"p","text":"La machine est équipée de quatre emplacements d'arrêt d'urgence ; leur activation interrompt immédiatement tout mouvement de l'appareil de forage."},{"t":"specs","rows":[["Panneau de commande basse tension","Immédiatement sous l'IHM à écran tactile"],["Télécommande radio","Au centre, en bas"],["Châssis du RodBot","Coin inférieur avant droit du châssis"],["Commandes manuelles","À l'arrière, près des leviers hydrauliques de commande du mât"]]},{"t":"warn","w":"warn","text":"Si le signal d'arrêt d'urgence est couplé à l'appareil de forage principal, l'activation d'un arrêt d'urgence sur l'une ou l'autre des machines déclenche un arrêt d'urgence sur les deux."}],"figures":[]},"2-0":{"blocks":[{"t":"p","text":"Le mât télescopique (bras robotisé) est composé de plusieurs actionneurs de joint rotatif (poignet). Chaque joint porte un numéro (J…) et un nom de référence, identifiés sur le schéma de la page 13."},{"t":"ul","items":["TÉLESCOPE","PIVOTEMENT (SLEW)","ARTICULATION (ÉPAULE)","JOINT ROTATIF (POIGNET)","ROTATION","INCLINAISON","GRAPPIN (PINCE)"]},{"t":"warn","w":"note","text":"Exemple de correspondance donné par le manuel : la fonction PIVOTEMENT (SLEW) correspond à J1, soit « pivotement 1 »."}],"figures":[{"page":13,"cap":"Schéma des segments du mât et noms des fonctions"}]},"2-1":{"blocks":[{"t":"p","text":"L'interrupteur de commande par l'opérateur, situé sur le panneau de commande basse tension, détermine si les ordres de la télécommande radio sont pris en compte par le système robotisé."},{"t":"specs","rows":[["Position CONTRÔLE À DISTANCE (REMOTE)","La télécommande radio est en lien avec le système robotisé et peut le piloter"],["Position LOCAL","Les signaux de commande de la télécommande radio ne sont pas pris en compte ; l'icône « Pas de communication par ondes radio (No Radio) » s'affiche"]]},{"t":"ul","items":["Commande par l'opérateur","Bouton de réinitialisation de sécurité","Panneau de commande principal HMI (Interface homme-machine)","PPU (Module de planification de trajectoire)","Récepteur radio","Arrêt d'urgence"]},{"t":"warn","w":"warn","text":"Pour piloter par télécommande radio, l'interrupteur DOIT être en position CONTRÔLE À DISTANCE (REMOTE). En mode LOCAL, aucun ordre radio n'est exécuté."}],"figures":[{"page":14,"cap":"Vue intérieure du panneau de commande principal"}]},"2-2":{"blocks":[{"t":"p","text":"Le bouton de réinitialisation de sécurité active (« met en place ») le circuit de sécurité du système robotisé."},{"t":"steps","items":["Au démarrage du système robotisé, appuyer pour établir (mettre en place) le circuit de sécurité.","Après un arrêt d'urgence déclenché puis réinitialisé, appuyer de nouveau pour réactiver le circuit de sécurité."]}],"figures":[]},"2-3":{"blocks":[{"t":"p","text":"L'écran tactile du panneau principal, également appelé HMI/IHM (Interface Homme-Machine), affiche les informations relatives au système de commande du RodBot. L'opérateur peut modifier certains paramètres du système directement via l'IHM."},{"t":"ul","items":["Indicateur signalant que l'interrupteur de contrôle par l'opérateur est réglé sur le mode « LOCAL »","Icône « Émetteur-récepteur radio non activé (No Radio) »"]},{"t":"warn","w":"note","text":"La section 7 du manuel contient des informations complémentaires concernant cet écran."}],"figures":[{"page":15,"cap":"Écran du panneau principal : indicateur mode LOCAL et icône No Radio"}]},"2-4":{"blocks":[{"t":"p","text":"Deux valves d'activation/d'isolation hydrauliques, normalement fermées, sont intégrées au collecteur auquel se raccordent les flexibles de liaison. Leur état est déterminé par le choix de l'opérateur dans le « MODE », ou par le système de sécurité s'il détecte une erreur."},{"t":"specs","rows":[["Nombre / type","2 valves, normalement fermées"],["Emplacement","Collecteur de raccordement des flexibles de liaison"],["Une valve","Régule le débit vers les chenilles et les vérins"],["L'autre valve","Régule le débit vers tous les autres éléments"],["Commande de l'état","Choix du MODE par l'opérateur ou système de sécurité (si erreur détectée)"]]},{"t":"warn","w":"warn","text":"En cas de coupure de courant, les deux valves se ferment par défaut, rendant toute opération hydraulique impossible."},{"t":"warn","w":"note","text":"Ces valves peuvent être forcées manuellement en position ouverte en tournant la valve dans le sens antihoraire."}],"figures":[{"page":16,"cap":"Soupape d'activation/d'isolation hydraulique du mât (normalement fermée ; se ferme en cas de coupure d'alimentation électrique)"}]},"3-0":{"blocks":[{"t":"p","text":"La télécommande radio (RRC) a été spécialement conçue pour le RodBot : elle est prévue pour résister aux chocs, à la saleté, à l'humidité et à l'exposition à l'eau. Ses manettes sont entièrement proportionnelles et rappelées à la position zéro par un ressort."},{"t":"specs","rows":[["Emplacement de la clé","Partie supérieure gauche de la télécommande"],["Rôle","La clé doit être présente pour que la télécommande fonctionne"],["Sans la clé","La télécommande ne s'allume pas"],["Retrait en cours de fonctionnement","Rupture de la liaison RRC ↔ récepteur et déclenchement d'un arrêt"]]},{"t":"warn","w":"warn","text":"Ne retirez jamais la clé physique pendant que la machine fonctionne : la connexion entre la RRC et le récepteur est rompue et un arrêt est déclenché."}],"figures":[{"page":17,"cap":"Vue d'ensemble de la télécommande radio (RRC)"}]},"3-1":{"blocks":[{"t":"steps","items":["Placer l'interrupteur OPERATOR CONTROL du panneau électrique sur À DISTANCE (REMOTE) : sinon le système ne reconnaîtra aucun message de mouvement.","Appuyer sur le bouton ON situé sur le côté gauche de la télécommande.","Vérifier que le voyant DEL, en bas à gauche de l'écran, devient vert (état « ON » confirmé)."]},{"t":"p","text":"Pour désactiver la télécommande, appuyer sur son bouton d'arrêt d'urgence. Celui-ci devra ensuite être réinitialisé en tournant la tête rouge en forme de champignon."},{"t":"warn","w":"warn","text":"Appuyer sur l'arrêt d'urgence de la télécommande arrête la foreuse, sauf si le sélecteur de mode de commande a été préalablement réglé sur LOCAL."},{"t":"warn","w":"note","text":"La télécommande peut être allumée alors que OPERATOR CONTROL est sur LOCAL, mais le système ne reconnaîtra alors aucun message provenant d'elle concernant les mouvements du RodBot."}],"figures":[{"page":18,"cap":"Bouton MARCHE (ON) et bouton d'arrêt d'urgence de la télécommande"}]},"3-2":{"blocks":[{"t":"p","text":"L'arrêt d'urgence de la télécommande radio sans fil commande un relais situé sur le RodBot, installé en série avec les autres arrêts d'urgence du RodBot et de la foreuse mère, à laquelle il est relié électriquement."},{"t":"p","text":"Lorsque la télécommande est activée et que OPERATOR CONTROL est sur REMOTE, une pression sur l'arrêt d'urgence arrête à la fois le RodBot et la foreuse mère : le même effet que d'appuyer sur n'importe quel arrêt d'urgence par câble du RodBot ou de la foreuse."},{"t":"warn","w":"danger","text":"En mode LOCAL, la communication radio est désactivée et le bouton d'arrêt d'urgence de la télécommande NE fonctionne PAS. Ne comptez jamais sur l'arrêt d'urgence de la RRC lorsque le sélecteur est sur LOCAL."},{"t":"warn","w":"note","text":"Pour désactiver la télécommande sans couper le moteur : placer d'abord OPERATOR CONTROL sur LOCAL, puis désactiver la télécommande via son bouton d'arrêt d'urgence. Utile pour remplacer une batterie faible ou économiser l'énergie de la batterie."}],"figures":[]},"3-3":{"blocks":[{"t":"p","text":"Les modes Rapide (Rabbit) / Lent (Turtle) appliquent un facteur d'échelle à toutes les articulations dans les modes DIRECT, LINÉAIRE et TRAJECTOIRE."},{"t":"specs","rows":[["Mode Rapide (Rabbit)","Vitesse maximale définie dans le menu Points de consigne des valves (section 8.5)"],["Mode Lent (Turtle)","Vitesse de chaque articulation limitée à 50 % (réduite de moitié)"],["Exception","Le grappin (pince) n'est pas ralenti par le mode Lent"]]}],"figures":[{"page":19,"cap":"Sélecteur Rapide (Rabbit)/Lent (Turtle) et contrôle de limite de la soupape hydraulique directionnelle"}]},"3-4":{"blocks":[{"t":"p","text":"La télécommande est équipée d'un interrupteur d'inclinaison destiné à détecter une situation d'urgence de l'opérateur (télécommande inclinée ou tombée)."},{"t":"ul","items":["Déclenchement : le RodBot passe en état d'arrêt de sécurité, l'alimentation hydraulique est coupée.","Différence avec le bouton rouge : l'arrêt d'urgence de la foreuse à câble n'est PAS déclenché, contrairement à une pression sur l'arrêt d'urgence.","Récupération : dès que la télécommande est remise en position horizontale stable et qu'aucun joystick n'est actionné, le système sort automatiquement de l'arrêt de sécurité et passe en mode veille."]},{"t":"warn","w":"note","text":"Inspection quotidienne : vérifiez le bon fonctionnement de l'interrupteur d'inclinaison de la télécommande radio au début de chaque quart de travail."}],"figures":[]},"3-5":{"blocks":[{"t":"p","text":"Un voyant ambre installé sur le dessus du RodBot indique l'état du fonctionnement par télécommande radio."},{"t":"specs","rows":[["Allumé fixe","RodBot en mode CONTRÔLE PAR L'OPÉRATEUR – À DISTANCE"],["Éteint","RodBot en mode CONTRÔLE PAR L'OPÉRATEUR – LOCAL"],["Clignotant","Mât en mode TRAJECTOIRE, ou machine se déplaçant en mode RALENTI"]]}],"figures":[]},"3-6":{"blocks":[{"t":"p","text":"La section 6.7 décrit les commandes des manettes pour chacun des modes de fonctionnement du LP RodBot. La télécommande comporte trois manettes proportionnelles : JS1, JS2 et JS3."},{"t":"ul","items":["JS1 : contrôle de l'aimant (une fonction est libre, sans affectation)","Commande de l'avertisseur sonore (klaxon) et du gyrophare","Activation du grappin (pince)","Sélecteur Rapide (Rabbit) / Lent (Turtle)","Voyant d'état ; témoins d'état et de batterie faible","Boutons de sélection de modes : Veille (attente), Direct et Linéaire","Boutons de sélection de modes : MARCHE, stabilisateurs et balayage","Activation de la trajectoire ; Aide, Attendre, Commencer","Réglage de la luminosité de l'écran ; feux de travail (Work Lights)","Arrêt d'urgence"]},{"t":"warn","w":"note","text":"En mode Lent, la vitesse des actionneurs est réduite de moitié (50 %), sauf pour le grappin (pince)."}],"figures":[{"page":21,"cap":"Disposition des manettes JS1/JS2/JS3, boutons et interrupteurs de la télécommande"},{"page":22,"cap":"Détail des commandes de la télécommande radio"}]},"3-7":{"blocks":[{"t":"p","text":"L'interface homme-machine (IHM) de la télécommande n'est PAS un écran tactile : les touches du clavier situées sur le dessus de l'écran correspondent aux icônes affichées. L'affichage change selon l'état du RodBot afin de fournir les renseignements pertinents et les options de commande."},{"t":"ul","items":["Position de la foreuse et points de trajectoire (du râtelier à la foreuse)","Indicateur d'ÉTAT du système","Indicateur de l'état de charge de la batterie","Positions du râtelier (Rack Positions)","Type de mode de fonctionnement et indicateur de mode","État du grappin et état de l'aimant","Mode Lent / Rapide","L'encadré jaune indique l'élément sélectionné"]}],"figures":[{"page":23,"cap":"Écran (IHM) de la télécommande : correspondance touche / icône"},{"page":24,"cap":"Écran typique avec libellés des indicateurs d'état"}]},"3-8":{"blocks":[{"t":"p","text":"Le niveau de charge de la batterie s'affiche en haut à droite de l'écran de la télécommande, ainsi qu'en bas de l'écran du panneau électrique."},{"t":"warn","w":"warn","text":"Si la télécommande perd le contact radio ou s'éteint pendant le fonctionnement (batterie à plat), la machine assimile cette situation à un arrêt d'urgence. Suivez la procédure ci-dessous pour changer la batterie sans déclencher l'arrêt."},{"t":"steps","items":["Placer le sélecteur COMMANDE PAR L'OPÉRATEUR sur LOCAL.","Mettre la télécommande sur FERMER (OFF), en appuyant sur l'arrêt d'urgence de la télécommande ou sur la RRC.","Remplacer la batterie.","Mettre la télécommande sur MARCHE (ON).","Vérifier que l'icône de liaison radio, au bas du moniteur de contrôle, est rétablie.","Remettre le sélecteur COMMANDE PAR L'OPÉRATEUR en position À DISTANCE."]},{"t":"p","text":"Chargement et rangement : le coffret de rangement situé sur la machine contient un chargeur de batterie. Insérez la batterie dans le chargeur et la charge débute automatiquement."}],"figures":[{"page":44,"cap":"Chargeur et boîte de rangement de la télécommande radio"}]},"4-0":{"blocks":[{"t":"p","text":"La navigation s'effectue par les icônes de la barre latérale gauche : appuyer sur une icône ouvre sa page, appuyer de nouveau ramène au menu principal. La barre supérieure regroupe l'état de la connexion radio, la puissance du signal, le mode de fonctionnement actif, l'état général du contrôleur, ainsi que les versions logicielles du PLC et du PPU (module de planification de trajectoire)."},{"t":"specs","rows":[["Connexion radio – vert","Télécommande allumée et connectée"],["Connexion radio – rouge","Télécommande non opérationnelle ou non autorisée"],["Indicateur contrôleur – vert","Systèmes opérationnels"],["Indicateur contrôleur – rouge","Système hors tension ou en ERREUR"],["Indicateur contrôleur – jaune","Chargement en cours ou avertissement (non-erreur)"]]},{"t":"ul","items":["Appuyer sur un cercle d'état en surbrillance affiche le détail du sous-système concerné.","Le bouton « Paramètres système » ouvre deux écrans (navigation par les flèches en haut à droite) : Facteur de courbe des manettes (section 8.4) et Consigne de la valve de limitation (section 8.5)."]},{"t":"warn","w":"note","text":"L'étalonnage du codeur, le réglage des articulations (étalonnage des PPU) et l'écran de dérogation des valves ne sont modifiables qu'après connexion administrateur. Identifiants IHM — utilisateur : opt / mot de passe : qwer."}],"figures":[{"page":25,"cap":"Écran d'accueil de l'IHM : barre supérieure d'état et boutons de navigation"}]},"4-1":{"blocks":[{"t":"p","text":"Le bouton « ALARMES » ouvre un tableau qui aide à diagnostiquer les anomalies du RodBot et à identifier les risques de sécurité. Les défauts surviennent pour diverses raisons : défauts du réseau CAN au démarrage, articulations actionnées manuellement alors que le système est en mode télécommande, etc."},{"t":"ul","items":["Informations système","Avertissements système","Défauts système"]},{"t":"steps","items":["Consulter la colonne ÉTAT : un défaut résolu s'affiche comme Inactif.","Appuyer sur la ligne du défaut à effacer.","Appuyer sur le bouton « Effacer le défaut ».","Naviguer entre les pages du tableau à l'aide des flèches en haut à droite."]},{"t":"warn","w":"warn","text":"Les défauts actifs ET inactifs doivent tous être effacés avant que le fonctionnement puisse reprendre."}],"figures":[{"page":27,"cap":"Exemple de l'écran ALARMES avec la colonne ÉTAT"}]},"4-2":{"blocks":[{"t":"p","text":"La vue TRAJECTOIRE est un modèle 3D en temps réel de la position du mât et des obstacles, tel que modélisé par le logiciel de planification de trajectoire. On y accède par le bouton situé dans le coin inférieur gauche de l'IHM ; appuyer sur l'une des quatre vues l'agrandit, un nouvel appui revient à l'écran précédent."},{"t":"ul","items":["Diagnostiquer les problèmes après une collision","Confirmer les lectures des codeurs","Diagnostiquer les problèmes de points de consigne"]},{"t":"p","text":"Les objets perçus et évités lors de la planification comprennent la limite supérieure, la limite inférieure, le mât de forage ainsi que le RodBot et son bac à tiges."},{"t":"warn","w":"warn","text":"Le logiciel ne peut pas modéliser tous les objets d'une exploitation minière souterraine. Si un objet à éviter n'apparaît pas à l'écran, il faut ajouter des points de consigne supplémentaires pour le contourner."}],"figures":[{"page":28,"cap":"Vue TRAJECTOIRE : modèle 3D à quatre vues de la position du mât"},{"page":29,"cap":"Objets perçus et évités : limites supérieure/inférieure, mât et bac à tiges"}]},"4-3":{"blocks":[{"t":"p","text":"Le calibrage du codeur est requis si un codeur est remplacé, ou s'il s'est desserré et a glissé sur l'arbre. Il consiste à amener l'articulation en position d'origine puis à réinitialiser le « point zéro » ; sans cette réinitialisation, le codeur ne transmet pas l'orientation exacte de l'articulation."},{"t":"steps","items":["Allumer la machine et régler la télécommande en mode DIRECT.","Se connecter à l'IHM avec les identifiants administrateur (opt / qwer).","Une articulation à la fois, la déplacer jusqu'à sa position de zéro indiquée, puis appuyer sur le bouton correspondant sur l'IHM.","Vérifier que la valeur change au déplacement et qu'elle passe bien à zéro après appui, ainsi qu'à chaque retour à cette butée."]},{"t":"specs","rows":[["J1 – Pivotement","Butée mécanique antihoraire"],["J2 – Articulation (épaule)","Position haute maximale"],["J3 – Télescope","Entièrement rentré"],["J4 – Joint rotatif (poignet)","Position basse maximale"],["J5 – Rotation","Sens antihoraire jusqu'à la butée mécanique"],["J6 – Inclinaison","Vérin d'inclinaison entièrement déployé jusqu'à la butée mécanique"]]},{"t":"warn","w":"note","text":"Les codeurs étant très précis, de légers écarts sont acceptables : la valeur peut afficher 1° ou 359° au lieu de 0°."}],"figures":[{"page":31,"cap":"Positions de point zéro des articulations J1 à J6"}]},"4-4":{"blocks":[{"t":"specs","rows":[["Butées mécaniques","+/- 165° (course totale 330°)"],["Zone morte","30° directement à l'avant du système robotisé"],["Limites logicielles par défaut","10° et 320° (correspondent aux butées mécaniques)"]]},{"t":"p","text":"La rotation de pivotement peut être restreinte davantage par les limites logicielles affichées sur l'écran d'étalonnage. Pour les modifier, appuyer sur le nombre à l'écran et saisir la valeur désirée."},{"t":"warn","w":"note","text":"Le bouton NEUTRALISER LES LIMITES D'ARTICULATION (OVERRIDE JOINT LIMITS) autorise le déplacement sur toute la course jusqu'aux butées ; la neutralisation se réinitialise dès que l'opérateur quitte l'écran d'étalonnage."}],"figures":[{"page":32,"cap":"Limites de rotation du pivotement et zone morte avant"}]},"4-5":{"blocks":[{"t":"p","text":"L'écran de contournement des valves s'affiche lorsqu'un défaut de valve survient dans l'un des deux blocs de valves. Il ne doit être utilisé que par un opérateur expérimenté. Pour basculer un contournement, appuyer sur la case « Contournement de défaut » située à côté de l'articulation en défaut."},{"t":"ul","items":["Un défaut connu et non critique est survenu (par exemple une surchauffe) et l'opérateur doit absolument continuer à faire fonctionner la machine.","Un défaut de valve est présent sur le bloc du Mode Ralenti et des Stabilisateurs et l'opérateur souhaite continuer à utiliser le mode Bras — ou inversement."]},{"t":"warn","w":"danger","text":"Lorsqu'un bouton de contournement est actionné, le système ignore TOUS les défauts de cette valve. Cela peut être dangereux si le défaut est critique ou s'il servait à éviter un danger imminent pour le personnel ou la machine."}],"figures":[{"page":33,"cap":"Écran de contournement des défauts de valve"}]},"4-6":{"blocks":[{"t":"p","text":"Les courbes des manettes définissent la sensibilité des actionneurs hydrauliques par rapport aux commandes de la manette : soit une plus grande course de manette pour un contrôle précis, soit une augmentation linéaire de la vitesse d'articulation. Pour changer de courbe, sélectionner la sensibilité sur l'IHM et vérifier que l'icône s'allume pour confirmer."},{"t":"p","text":"Si les articulations se déplacent trop vite en mode DIRECT, l'écran LIMITES DES CONSIGNES DE VALVE permet de plafonner la vitesse maximale de chaque articulation : la manette poussée à fond produit alors un débit de valve inférieur, donc une vitesse d'actionneur réduite. Appuyer sur la valeur numérique de l'articulation, saisir le nouveau pourcentage au pavé, puis valider par Entrée."},{"t":"specs","rows":[["Courbes de commande disponibles","0 à 3"],["Consigne de valve – maximum","100 % (ne peut être dépassé)"],["Consigne de valve – minimum conseillé","10 %"]]},{"t":"warn","w":"note","text":"La restriction s'applique aux deux sens de l'articulation, mais la vitesse réelle peut différer selon la gravité. Pour des vitesses > 100 % ou < 10 %, consulter MEDATech afin d'obtenir un tiroir de valve différent. Un bouton permet de rétablir les réglages d'usine par défaut."}],"figures":[{"page":34,"cap":"Courbes de commande de la manette disponibles (0 à 3)"},{"page":35,"cap":"Écran des limites de consigne de valve par articulation"}]},"4-7":{"blocks":[{"t":"p","text":"Le réglage des articulations s'impose si le mouvement du mât devient saccadé ou difficile à contrôler en modes LINÉAIRE et Trajectoire, une fois l'étalonnage des codeurs effectué. Deux types existent : Seuil (consigne de valve la plus basse nécessaire pour amorcer le mouvement) et Dynamique (délais et vitesses correspondant à une plage de consignes de valve)."},{"t":"steps","items":["Amener chaque articulation à moins de 2° ou 5 mm de sa position cible, en mode DIRECT.","Appuyer sur le bouton jaune de l'IHM : il devient vert et l'écran d'étalonnage apparaît sur la télécommande radio (RRC).","Sur la RRC, utiliser le sélecteur pour choisir l'articulation sous le type approprié (Seuil ou Dynamique).","Maintenir la manette gauche vers la gauche : l'écran affiche « CALIBRATING » et l'articulation effectue deux cycles de va-et-vient (relâcher avant la fin annule).","Une fois terminé, le point jaune passe au vert ; répéter pour chaque articulation requise.","Insérer la clé USB rouge MEDATech dans le câble bleu du PPU et attendre 1 minute, puis retirer la clé.","Envoyer le fichier « medatech_calibration » au service MEDATech, qui renvoie un fichier « cal.7z ».","Placer « cal.7z » sur la clé USB rouge, la réinsérer 1 minute, puis appuyer sur le bouton vert de l'IHM pour redémarrer le PPU."]},{"t":"specs","rows":[["Pivotement","25° dans le sens horaire en premier"],["Articulation (épaule)","50° vers le bas en premier"],["Télescopage","140 mm vers l'extérieur en premier"],["Joint rotatif (poignet)","30° vers le haut en premier"],["Rotation","20° dans le sens horaire (manette) en premier"],["Inclinaison","40° vers la droite en premier"]]},{"t":"warn","w":"warn","text":"Pendant l'étalonnage, les articulations se déplacent sans commande directe de l'opérateur et sans détection de leur environnement. Rester vigilant pour éviter toute collision avec le RodBot ou un obstacle. Relâcher la manette arrête le mouvement du mât à tout instant ; prévoir un espace suffisant, sinon déplacer la machine ou contacter MEDATech."}],"figures":[{"page":36,"cap":"Pose de réglage : position actuelle amenée à la position cible du mât"},{"page":39,"cap":"Écran d'étalonnage de la RRC : sélection actuelle et indicateur d'état"}]},"4-8":{"blocks":[{"t":"p","text":"Les diagnostics indiquent l'état de divers éléments du système de commande, comme les communications des composants ou du réseau. Le bouton Diagnostics de l'écran d'accueil (HOME) ouvre le premier des trois écrans ; ces écrans sont uniquement informatifs et non interactifs, à l'exception des flèches de navigation en haut à droite."},{"t":"ul","items":["Diagnostic des Codeurs","Diagnostic des Valves","Diagnostic du Système Électrique"]},{"t":"warn","w":"note","text":"Interverrouillage : les valves perdent la communication lorsqu'elles ne sont pas dans leur mode désigné (RALENTI ou MÂT). Les valves du mode RALENTI apparaissent en défaut quand le système est en mode MÂT, et inversement — c'est normal. Ne s'inquiéter que si une valve est en défaut alors qu'elle est bien dans son mode désigné (p. ex. valve de PIVOTEMENT en défaut en mode MÂT)."}],"figures":[{"page":41,"cap":"Premier écran de diagnostic accessible depuis HOME"}]},"5-0":{"blocks":[{"t":"p","text":"Le RodBot ne possède aucune source d'alimentation embarquée : il puise son énergie électrique et hydraulique dans des sources externes fournies par l'opérateur, généralement montées sur la foreuse desservie. Le RodBot et ces sources sont reliés par des ensembles de câbles de liaison de 10 m, ce qui lui permet de se positionner librement par rapport à la foreuse."},{"t":"specs","rows":[["Câble 24 V CC (électronique embarquée)","réf. 279708"],["Câble d'arrêt d'urgence (liaison au circuit de la foreuse mère)","réf. 279729"],["Conditionnement des deux câbles","un seul ensemble sous gaine spirale"],["Raccordement au panneau de commande du RodBot","connecteurs 2 et 4"]]},{"t":"ul","items":["Le boîtier de raccordement se monte sur la foreuse mère : il contient un bloc d'alimentation convertissant le 120 V CA en 24 V CC et un point de connexion pour le câble d'arrêt d'urgence.","Pour maintenir les circuits d'arrêt d'urgence du RodBot et de la foreuse mère indépendants, installer des cavaliers entre 8-1 et 7-2 selon le schéma électrique.","Si la foreuse mère fournit un 24 V suffisant (voir section 1.1.3), le bloc d'alimentation 24 V CC peut être omis et la source raccordée directement à CONN1."]},{"t":"warn","w":"danger","text":"Le LP RodBot doit être installé de sorte qu'une barrière sépare l'opérateur de la machine et de la foreuse, le pilotage se faisant par télécommande radio de part et d'autre de cette barrière. En cas de mouvement inattendu du mât télescopique (bras robotisé) alors qu'aucune commande n'est donnée, appuyez immédiatement sur l'arrêt d'urgence puis diagnostiquez le problème."}],"figures":[{"page":45,"cap":"Montage du boîtier de raccordement et câbles de liaison 24 V CC / arrêt d'urgence"},{"page":46,"cap":"Schéma électrique du boîtier ; raccordement aux connecteurs 2 et 4 du panneau du RodBot"}]},"5-1":{"blocks":[{"t":"p","text":"Les fonctions hydrauliques du RodBot sont entraînées par une pompe fournie par l'opérateur, généralement une pompe auxiliaire montée sur la foreuse mère. Les exigences relatives à cette pompe source sont énoncées à la section 1.1.3."},{"t":"ul","items":["Ligne de pression","Ligne de réservoir","Ligne de détection de charge (Load Sense)","Ligne de drainage du carter"]},{"t":"specs","rows":[["Ensemble de flexibles de liaison hydraulique","réf. 278232, flexibles de 10 m"],["Cloison de raccordement à raccords rapides","réf. 278240"],["Montage de la cloison","2 boulons de 3/8 po"],["Raccordement au RodBot","au bloc de distribution"]]},{"t":"warn","w":"warn","text":"Le remplacement de la pompe peut nécessiter un nouveau calibrage. Les modes TRAJECTOIRE et LINÉAIRE reposent sur des valeurs réglées de latence, de vitesse de rampe et de pression maximale de l'alimentation hydraulique. Si l'un de ces modes (ou les deux) présente des performances insatisfaisantes après un changement de pompe, communiquez avec MEDATech Engineering pour planifier un nouveau calibrage."}],"figures":[{"page":47,"cap":"Ensemble de flexibles de liaison : pression, réservoir, détection de charge, drainage du carter"},{"page":48,"cap":"Cloison de raccordement (2 boulons 3/8 po) et bloc de distribution du RodBot"}]},"5-2":{"blocks":[{"t":"steps","items":["Raccordez le RodBot à l'alimentation au moyen du câble de liaison relié au coffret d'alimentation de la foreuse principale.","Attendez que l'écran de l'IHM s'allume (environ 30 secondes).","Assurez-vous que l'arrêt d'urgence de la télécommande est déverrouillé, puis appuyez sur le bouton vert de démarrage pour mettre l'équipement sous tension.","Suivez les instructions à l'écran de la télécommande pour l'associer en appuyant de nouveau sur le bouton vert de démarrage.","Suivez les instructions de la télécommande et de l'IHM pour appuyer sur le bouton de réarmement de sécurité situé sur le panneau de contrôle.","Attendez la fin de la séquence de démarrage ; l'IHM affiche l'état du démarrage avant de passer en mode VEILLE.","Une fois en mode VEILLE, le système est prêt : les modes de fonctionnement se sélectionnent depuis la télécommande à l'aide des boutons latéraux."]},{"t":"warn","w":"note","text":"L'écran de l'IHM met environ 30 secondes à s'allumer. La séquence se termine toujours en mode VEILLE, qui correspond à l'état prêt à l'emploi."}],"figures":[{"page":49,"cap":"Écran de l'IHM et séquence normale de mise en marche du RodBot"}]},"5-3":{"blocks":[{"t":"p","text":"Le mode souhaité se sélectionne à partir de la télécommande radio, selon le schéma de la section 6.7. Chaque mode restreint les fonctions accessibles, ce qui constitue une protection : seules les commandes correspondant au mode actif sont traitées."},{"t":"specs","rows":[["VEILLE (ou DÉMARRAGE)","mode de sécurité : aucune commande possible"],["RALENTI","commande des transmissions à chenilles uniquement"],["STABILISATEURS","commande des quatre vérins (stabilisateurs) uniquement"],["DIRECT","mode de commande du mât télescopique (bras robotisé)"],["LINÉAIRE","second mode de commande du mât télescopique"],["TRAJECTOIRE","déplacement autonome du bras selon des points de consigne prédéfinis"]]}],"figures":[{"page":50,"cap":"Sélection du mode de fonctionnement depuis la télécommande radio"}]},"5-4":{"blocks":[{"t":"p","text":"Toutes les fonctions peuvent être actionnées « manuellement » en déplaçant les leviers des distributeurs hydrauliques lorsque le sélecteur de COMMANDE PAR L'OPÉRATEUR est en position LOCAL."},{"t":"warn","w":"warn","text":"Si les leviers sont déplacés manuellement pendant que la machine est en mode TÉLÉCOMMANDE, le système de sécurité détecte cette action comme une erreur de valve et passe en état d'arrêt de protection, ce qui entraîne la coupure de l'alimentation hydraulique."},{"t":"steps","items":["Passez la machine en mode LOCAL à l'aide du commutateur situé sur le panneau de commande basse tension.","Appuyez sur le bouton de réarmement de sécurité pour annuler l'arrêt de protection."]},{"t":"ul","items":["Mise en marche possible si COMMANDE PAR L'OPÉRATEUR est réglé sur LOCAL ; ou","si COMMANDE PAR L'OPÉRATEUR est sur À DISTANCE et que la télécommande radio est activée, sans que son arrêt d'urgence soit enfoncé.","Appuyer sur « REMISE DE SÉCURITÉ À ZÉRO » rétablit le circuit de sécurité et la communication radio."]}],"figures":[{"page":51,"cap":"Bloc de distributeurs « Chenilles et Vérins » et leviers manuels (entretien uniquement)"}]},"5-5":{"blocks":[{"t":"p","text":"Pour commander les chenilles depuis la télécommande, celle-ci doit être réglée sur le mode RALENTI. Le passage en RALENTI est impossible lorsque les mâchoires du grappin sont fermées. Les leviers manuels du bloc « Chenilles et Vérins » servent uniquement à l'entretien des chenilles (section 13.6) : le RodBot est livré avec ces leviers déconnectés et rangés dans le compartiment arrière."},{"t":"ul","items":["Pivotement : orienté parallèlement au châssis de la machine","Levage : abaissé au maximum","Télescope : rétracté","Poignet : orienté vers le bas","Grappin : ouvert"]},{"t":"specs","rows":[["Vitesse maximale — rapide (Hi)","2,8 km/h"],["Vitesse maximale — lente (Lo)","1,5 km/h"],["Valve de dérivation manuelle","tête carrée de 0,55 po, à tourner de 90°"],["Passage en vitesse rapide (Hi)","rotation dans le sens des aiguilles d'une montre"],["Passage en vitesse lente (Lo)","rotation dans le sens inverse des aiguilles d'une montre"]]},{"t":"warn","w":"danger","text":"Ne déplacez jamais le RodBot à l'aide des valves manuelles : l'opérateur s'expose à être heurté ou écrasé par le véhicule. Déplacez toujours la machine par télécommande radio. Avant tout déplacement, inspectez visuellement la trajectoire (personnel, obstacles, cavités, terrains instables), ne vous tenez jamais devant ou à côté de la machine, faites appel à un signaleur si la visibilité est obstruée, et gardez les câbles de liaison hydrauliques et électriques hors de la trajectoire et du train de roulement — ne roulez pas dessus."}],"figures":[{"page":52,"cap":"Pose de transport du bras à adopter avant tout déplacement"},{"page":53,"cap":"Valve de dérivation manuelle Hi/Lo (carré de 0,55 po) du circuit des chenilles"}]},"5-6":{"blocks":[{"t":"p","text":"Le mode VEILLE permet de coupler la télécommande radio avec le récepteur, mais aucune commande provenant de la télécommande n'est traitée par le système de commande. Il offre ainsi un mode sécurisé pour démarrer la télécommande radio avant de passer aux modes de travail."},{"t":"warn","w":"note","text":"En mode VEILLE, toutes les fonctions de sécurité (arrêt d'urgence et interrupteur d'inclinaison) ainsi que les feux demeurent fonctionnels."}],"figures":[{"page":54,"cap":"Amplitude de mouvement du mât : système de positionnement à 6 degrés de mobilité"}]},"6-0":{"blocks":[{"t":"steps","items":["Fermer le grappin sur la tige : appuyer et maintenir le bouton vert GRAPPIN tout en basculant le commutateur GRAPPIN vers le bas — les deux actions simultanément.","Ouvrir le grappin et libérer la tige : maintenir le bouton vert GRAPPIN et maintenir le levier GRAPPIN vers le haut pendant au moins 1 seconde."]},{"t":"p","text":"Le bouton vert GRAPPIN sert de sécurité : il doit rester enfoncé pendant toute la manœuvre d'ouverture ou de fermeture, sinon la commande n'est pas prise en compte par le système."},{"t":"warn","w":"danger","text":"Aucun travailleur ne doit jamais se placer sous le mât ou le grappin. Rester attentif aux éléments suspendus des mines souterraines (câbles électriques, conduites d'eau et d'air, tuyaux de ventilation) : tout contact du mât télescopique avec ces réseaux peut entraîner des blessures graves, la mort ou des dommages matériels."}],"figures":[{"page":55,"cap":"Commande du grappin : bouton vert et bascule actionnés simultanément"},{"page":56,"cap":"Façade de la télécommande : bouton vert GRAPPIN et bascule du grappin"}]},"6-1":{"blocks":[{"t":"p","text":"Le choix DIRECT ou LINÉAIRE relève d'une préférence personnelle ; pour la plupart des opérateurs et la majeure partie du temps, le mode LINÉAIRE est le plus simple. En DIRECT, l'opérateur commande chaque articulation (comme une grue traditionnelle, un actionneur à la fois ou plusieurs) ; en LINÉAIRE, il commande directement la position du grappin et de la tige."},{"t":"specs","rows":[["Mode DIRECT","Commande articulation par articulation ; inscriptions BLANCHES sur la façade"],["Mode LINÉAIRE","Commande de l'effecteur en ligne droite ; étiquette ORANGE"],["Manette gauche (LINÉAIRE)","Haut/Bas et Gauche/Droite"],["Manette droite (LINÉAIRE)","Intérieur/Extérieur (Int./Ext.)"],["Amplitude du mât","6 degrés de mobilité ; pivotement 330° entre butées fixes (butée souple programmable)"]]},{"t":"ul","items":["AVANT / ARRIÈRE — le mât approche ou éloigne la tige de la base en ligne droite, dans le plan horizontal.","HAUT / BAS — le mât déplace la tige en ligne droite, de haut en bas, dans le même plan.","GAUCHE / DROITE — fait pivoter le mât sur son socle (PIVOTEMENT), comme en commande manuelle."]},{"t":"warn","w":"note","text":"En mode LINÉAIRE, le système de commande gère toutes les fonctions du mouvement ; les mouvements du joint rotatif (poignet), de rotation et d'inclinaison restent toutefois commandables indépendamment pour affiner le positionnement de l'effecteur terminal."}],"figures":[{"page":57,"cap":"Contrôle LINÉAIRE (étiquette orange) et affectation des manettes gauche/droite"},{"page":54,"cap":"Amplitude de mouvement du mât à 6 degrés de mobilité"}]},"6-2":{"blocks":[{"t":"p","text":"Le mode TRAJECTOIRE utilise un logiciel de navigation et de planification autonome qui déplace le mât à travers des points de consigne prédéfinis en évitant les obstacles. Il est accessible après avoir activé le mode LINÉAIRE ou DIRECT. Points minimaux requis : FOREUSE, ATTENTE, LIMITE SUPÉRIEURE et LIMITE INFÉRIEURE."},{"t":"steps","items":["Ouvrir l'écran de configuration : maintenir le bouton du mode LINÉAIRE (ou DIRECT) enfoncé pendant 3 secondes.","Saisir une tige de forage par son centre (± 2\" / 5 cm).","Positionner la tige dans le mât de forage ou le présentateur.","Avec le sélecteur de point de trajectoire, mettre FOREUSE en surbrillance (la surbrillance verte indique le point actif).","Pousser vers le haut le commutateur « Enregistrer/Sélection » : un crochet apparaît dans la case de l'icône à l'écran."]},{"t":"specs","rows":[["POINT DU PLATEAU 1","Par défaut au-dessus et au centre du bac à tiges ; modifiable"],["POINT DU PLATEAU 2","2e plateau (au sol/à l'écart), tiges plus longues ; ≥ 1' (30 cm) au-dessus du plateau, parallèle au stockage"],["ATTENTE","Point hors du mât ; dernier segment = trajectoire directe vers le train de tiges ; souvent 1 à 2 pieds de FOREUSE"],["FOREUSE","Point de libération et de transfert de la tige à la foreuse ; obligatoire"],["POINT 1 / POINT 2","Points de passage optionnels pour contourner un obstacle"]]},{"t":"p","text":"Exemple d'ordre de parcours : POINT DU PLATEAU → POINT 2 → POINT 1 → ATTENTE → FOREUSE. Pour supprimer un point enregistré, le mettre en surbrillance et actionner vers le bas le commutateur « Enregistrer/Sélection »."}],"figures":[{"page":59,"cap":"Sélecteurs de point de trajectoire et vue latérale d'un exemple de mode automatique"},{"page":61,"cap":"Vue de dessus : ajout d'un point de passage pour contourner une obstruction"}]},"6-3":{"blocks":[{"t":"p","text":"Les Limites Supérieure et Inférieure sont deux plans horizontaux définis par l'opérateur qui empêchent le mât et la tige de pénétrer certaines zones. Le logiciel s'en sert pour éviter toute collision avec les conduites, le toit / la voûte, une traverse ou le sol. Elles sont obligatoires pour utiliser le mode TRAJECTOIRE."},{"t":"ul","items":["Le RodBot lui-même","La foreuse","Le bac à tiges sur le RodBot","L'arrière (Back)","Le plancher (Floor)"]},{"t":"steps","items":["Vider le grappin avant de le descendre (recommandé).","Déplacer le grappin au-dessus du sol, à la hauteur sous laquelle la tige et le RodBot ne doivent pas descendre — le plan est fixé par le centre de gravité du grappin.","Généralement à 30 cm du sol, actionner l'interrupteur vers le haut pour définir le plan inférieur.","Suivre une procédure similaire pour définir la Limite Supérieure."]},{"t":"warn","w":"note","text":"Si une tige est détectée dans le grappin en mode TRAJECTOIRE, le planificateur suppose une tige de 1,8 m (6') maintenue à moins de 5 cm (2\") de son centre et génère un tracé de sorte qu'aucune partie du tuyau ne franchisse un plan. Le point FOREUSE devant fixer la position du mât de la foreuse, il doit être redéfini à chaque nouvelle configuration."}],"figures":[{"page":62,"cap":"Zones d'exclusion préréglées et plans Limites supérieure/inférieure autour du mât"},{"page":63,"cap":"Centre de gravité du grappin et sélecteurs des plans limites supérieur/inférieur"}]},"6-4":{"blocks":[{"t":"warn","w":"danger","text":"Le RodBot n'est équipé d'AUCUN système de vision : il ne détecte ni les travailleurs, ni les véhicules, ni les équipements qui pénètrent dans sa zone de travail. Limiter la circulation du personnel dans l'enveloppe de travail du mât et mettre en place barrières, délimitations et restrictions d'exploitation conformément aux politiques et procédures de la mine."},{"t":"warn","w":"warn","text":"Si un mouvement inattendu se produit en mode automatique, appuyer immédiatement sur l'un des boutons d'arrêt d'urgence, situés sur la télécommande ou sur le système robotisé."},{"t":"warn","w":"note","text":"Par mesure de sécurité, si la machine est mise en MODE RALENTI et qu'elle se déplace dans ce mode, tous les points de consigne sont supprimés SAUF le POINT DU PLATEAU 1 ; tous les autres doivent être reconfigurés depuis le nouvel emplacement."},{"t":"warn","w":"note","text":"Les réglages TRAJECTOIRE (points et limites) sont mémorisés même après mise hors tension et redémarrage. Les procédures recommandent de supprimer les points ainsi que les limites supérieure et inférieure à la fin de chaque tâche, avant de passer à la configuration suivante."}],"figures":[{"page":62,"cap":"Enveloppe de travail du mât — aucune détection de présence dans la zone"}]},"6-5":{"blocks":[{"t":"steps","items":["Vérifier que tous les points de trajectoire requis ainsi que les limites supérieure et inférieure sont définis.","Avec le sélecteur de points de trajectoire, choisir la destination : FOREUSE ou ATTENTE, et POINT DU PLATEAU 1 ou 2.","Maintenir le bouton jaune TRAJECTOIRE enfoncé et déplacer le levier droit : vers la DROITE pour le PLATEAU (RACK), vers la GAUCHE pour la FOREUSE (DRILL).","Une fois le mouvement amorcé, relâcher le bouton jaune : le mât poursuit la trajectoire tant que le levier reste actionné.","Relâcher les manettes arrête immédiatement le mouvement du mât."]},{"t":"p","text":"Au relâchement du bouton jaune, la télécommande revient au mode LINÉAIRE ou DIRECT précédent. On peut reprendre la commande manuelle à tout moment, puis réactiver TRAJECTOIRE (bouton jaune + levier droit) : une nouvelle trajectoire sans collision est alors générée vers la destination choisie. Le mode ne fonctionne que tant qu'une trajectoire sans collision est possible."},{"t":"warn","w":"note","text":"Directions du levier droit : DROITE = PLATEAU (RACK), GAUCHE = FOREUSE (DRILL)."}],"figures":[{"page":64,"cap":"Bouton jaune TRAJECTOIRE et levier droit pour lancer le déplacement autonome"},{"page":65,"cap":"Mode linéaire sélectionné : déplacement de la tige vers la FOREUSE ou le PLATEAU"}]},"6-6":{"blocks":[{"t":"p","text":"Le châssis du RodBot comporte des éléments d'alignement garantissant le bon positionnement du bac à tiges. Le bac n'est pas fixé rigidement par des boulons ou des brides : il est maintenu en place uniquement par les dispositifs de retenue du châssis."},{"t":"steps","items":["Engager les fourreaux pour fourches du bac dans les profilés du châssis.","Positionner le bac latéralement entre les deux pattes de retenue du châssis.","Vérifier que le bac est bien retenu par ces dispositifs avant toute manutention."]},{"t":"warn","w":"note","text":"Le bac reposant sur des retenues et non boulonné, contrôler son bon engagement et son alignement avant de charger des tiges ou de déplacer la machine."}],"figures":[{"page":65,"cap":"Alignement du bac à tiges : fourreaux à fourches et pattes de retenue du châssis"}]},"7-0":{"blocks":[{"t":"p","text":"Le guide de dépannage (section 12) présente chaque symptôme sous la forme Défaillance / Cause possible / Vérification-Solution. Commencez toujours par les vérifications les plus simples (mode de commande, arrêts d'urgence, batterie de la télécommande) avant d'investiguer l'hydraulique ou les codeurs."},{"t":"specs","rows":[["Ne s'allume pas (mode À DISTANCE, télécommande ÉTEINTE)","Régler COMMANDE DE L'OPÉRATEUR sur LOCAL, activer la télécommande, appuyer sur RÉINITIALISATION DE SÉCURITÉ"],["Ne s'allume pas (arrêt d'urgence enfoncé)","Réinitialiser le(s) bouton(s) d'arrêt d'urgence, puis RÉINITIALISATION DE SÉCURITÉ"],["S'arrête en mode À DISTANCE (E-stop télécommande)","Réarmer l'E-stop, mettre le contournement de la télécommande sur MARCHE, RÉINITIALISATION DE SÉCURITÉ, redémarrer"],["Télécommande radio ne s'allume pas","Remplacer ou recharger la batterie ; vérifier la présence de la clé dans la télécommande"],["Fonctions du mât anormalement lentes","Passer du mode LENT (TURTLE) au mode RAPIDE (RABBIT)"],["Ne fonctionne pas en AUTO ou sur la pointe (TIP)","Vérifier les codeurs et leur câblage sur l'écran de l'IHM"],["Amplitude de rotation de la base trop limitée","Réinitialiser les butées logicielles (section 8.2) ; un écart de 2-3° avec les butées mécaniques est normal"],["Mât erratique ou trajectoire imprévisible","Vérifier codeurs, fixations et points zéro ; recalibrer le mât (section 8.6)"]]},{"t":"ul","items":["La télécommande doit être ACTIVÉE avant de régler le sélecteur sur À DISTANCE ; l'interrupteur d'inclinaison bloque l'activation si l'unité n'est pas tenue à l'horizontale.","Si le mât ne bouge pas alors que tout semble prêt : vérifier les messages d'erreur, l'alimentation du connecteur de la bobine du clapet anti-retour, l'alimentation en huile / la conduite de détection de charge, le bon serrage des flexibles sur la foreuse, et que le récepteur radio est sous tension."]},{"t":"warn","w":"note","text":"Pour toute assistance dépassant ce manuel, contacter l'équipe MEDATech : service@medatech.ca ou +1 (705) 443-8440, poste 4."}],"figures":[]},"7-1":{"blocks":[{"t":"p","text":"L'entretien régulier est essentiel au fonctionnement sécuritaire, fiable et efficace du RodBot. Cette section s'adresse au personnel d'entretien qualifié. Le manuel n'est pas un guide de remise en état détaillé : contacter les services d'ingénierie de MEDATech pour toute tâche non couverte."},{"t":"warn","w":"danger","text":"Avant tout entretien — y compris le lavage — mettre le RodBot hors tension, débrancher l'alimentation électrique et appliquer la procédure de cadenassage et d'étiquetage (LOTO) sur tous les systèmes électriques."},{"t":"warn","w":"warn","text":"Certains dispositifs emmagasinent de l'énergie hydraulique, comme les vérins munis de valves d'équilibrage ; cette énergie peut rester présente même hors tension."},{"t":"ul","items":["Seul le personnel qualifié doit effectuer les réparations, le dépannage ou l'entretien.","Respecter les pratiques de sécurité et les exigences locales pour tout travail en hauteur.","Effectuer l'entretien avec l'articulation (épaule) à l'horizontale ou plus bas, afin d'éviter les travaux en hauteur inutiles."]}],"figures":[]},"7-2":{"blocks":[{"t":"p","text":"Le RodBot peut et doit être nettoyé, mais il ne faut jamais asperger directement les composants électriques (codeurs rotatifs, panneau électrique). Bien que résistants à l'eau, la pression d'un jet direct de nettoyeur haute pression pourrait endommager leurs joints d'étanchéité."},{"t":"warn","w":"warn","text":"Le lavage compte comme un entretien : cadenasser et mettre l'équipement hors tension avant de nettoyer."}],"figures":[]},"7-3":{"blocks":[{"t":"p","text":"Les inspections régulières servent autant à la sécurité des opérateurs qu'à la détection précoce de pannes potentiellement coûteuses. Tout problème constaté doit être signalé immédiatement à la direction et/ou au personnel d'entretien."},{"t":"specs","rows":[["Inspecter flexibles, conduites hydrauliques et câbles électriques (dommages/fuites)","Quotidienne"],["Tester le RodBot sans tige (déplacement conforme)","Quotidienne"],["Vérifier que tous les arrêts d'urgence sont fonctionnels","Hebdomadaire"],["Lubrifier les points d'articulation de la tringlerie et les couronnes d'orientation","Hebdomadaire"],["Ajuster les patins d'usure de l'articulation télescopique","Au besoin"],["Vérifier le niveau d'huile du réducteur d'entraînement des chenilles","Toutes les 500 h"],["Vidanger et remplacer l'huile du réducteur d'entraînement des chenilles","Toutes les 2000 h"],["Inspecter les chenilles","Hebdomadaire"],["Inspecter les structures mécaniques (déformation, fissures de soudure)","Hebdomadaire"]]}],"figures":[]},"7-4":{"blocks":[{"t":"specs","rows":[["Huile hydraulique","Classe de viscosité ISO 46"],["Graisse pour articulations mécaniques","EP2"],["Huile pour réducteur d'entraînement final","SAE 80W90"]]},{"t":"ul","items":["4 points de graissage sur la couronne d'orientation de la base","4 points de graissage sur la couronne d'orientation de rotation","2 points de graissage sur le vérin d'inclinaison"]},{"t":"steps","items":["Graisser l'articulation par les graisseurs de la couronne d'orientation.","Déplacer l'articulation d'environ 30 degrés.","Répéter jusqu'à ce que toute la plage de mouvement ait été couverte, pour une lubrification complète de la couronne."]},{"t":"warn","w":"danger","text":"Ne pas déplacer les articulations d'orientation pendant qu'un technicien se trouve dans le rayon d'action de la machine."}],"figures":[{"page":73,"cap":"Points de graissage sur les couronnes d'orientation (graisseurs encerclés en vert)"}]},"7-5":{"blocks":[{"t":"p","text":"La glissière du télescope est guidée par un ensemble de huit patins en plastique (pucks) qui coulissent contre la surface de la flèche intérieure lors du déploiement et de la rétraction. Avec le temps, ces patins s'usent et nécessitent un réglage afin de minimiser le jeu et le flottement dans le bras."},{"t":"steps","items":["Déplacer le mât en position horizontale au-dessus du bac.","Déployer la flèche à 3 po de sa position rétractée.","Mettre la machine hors tension.","Desserrer les contre-écrous de toutes les vis de réglage.","Dévisser toutes les vis jusqu'à ce qu'elles soient desserrées ou que la flèche intérieure touche la flèche extérieure.","Patins 1 et 2 : serrer ou desserrer jusqu'à ce qu'une plaque d'acier de calibre 11 (~1/8 po) s'insère entre la bande d'usure de la flèche intérieure et l'enveloppe de la flèche extérieure.","Vis 3 et 4 : ne pas les serrer, mais s'assurer qu'elles sont accotées et non desserrées.","Répéter le réglage à la plaque de calibre 11 pour les patins 7 et 8.","Répéter l'ajustement accoté (sans serrage) pour les patins 5 et 6.","Serrer les contre-écrous."]},{"t":"ul","items":["En cas de coincement ou de bruits forts : desserrer les patins 3, 4, 5 et 6 jusqu'au résultat souhaité.","Appliquer de la graisse sur les rails de la flèche intérieure.","Vérifier l'absence de frottement sur les butées d'extrémité de flèche ou sur le cordon de soudure de la flèche extérieure."]},{"t":"p","text":"Remplacement : si la tête du boulon arrive en butée contre le contre-écrou, remplacer le patin — desserrer le contre-écrou, retirer les 3 boulons de 3/8 po de la plaque de fermeture (article 1), retirer la plaque de poussée métallique (article 2) et le patin (article 3), puis réassembler dans l'ordre inverse, régler les vis selon la procédure ci-dessus et resserrer le contre-écrou."}],"figures":[{"page":74,"cap":"Patins d'usure du télescope et emplacement des vis de réglage"},{"page":75,"cap":"Ensemble plaque de fermeture (art. 1), plaque de poussée (art. 2) et patin (art. 3)"}]},"7-6":{"blocks":[{"t":"p","text":"Tension : la flèche (le mou) de la chenille doit mesurer entre 20 et 25 mm, vérifiée à l'aide d'une règle droite et d'un ruban à mesurer. Ne jamais laisser la flèche dépasser 30 mm et éviter toute tension excessive."},{"t":"steps","items":["Accéder à la valve de réglage de la chenille, située derrière la plaque signalétique.","Pour tendre : injecter de la graisse dans le vérin à l'aide d'un pistolet à graisse.","Pour détendre : dévisser lentement la valve afin de libérer de la graisse."]},{"t":"specs","rows":[["Neuf","22 mm"],["25 % d'usure","18,5 mm"],["50 % d'usure","15 mm"],["75 % d'usure","11,5 mm"],["Limite d'usure (100 %)","8 mm"]]},{"t":"warn","w":"warn","text":"L'usure des patins de chenille est mesurée par la dimension « X » : remplacer la chenille dès que X est inférieure à 8 mm."}],"figures":[{"page":75,"cap":"Vérification du mou de la chenille (20 à 25 mm) à la règle droite et au ruban"},{"page":76,"cap":"Mesure de l'usure du patin (dimension X) et embout de réglage de tension derrière la plaque signalétique"}]},"7-7":{"blocks":[{"t":"ul","items":["Déplacement autonome (tramming)","Remorquage au sol","Chariot élévateur ou chariot télescopique","Remorquage sur une remorque surbaissée","Avant tout déplacement, positionner le bras dans la posture prescrite : la pente maximale est calculée pour cette posture, et tout écart déplace le centre de gravité et réduit la stabilité."]},{"t":"specs","rows":[["Points d'ancrage du châssis","4 points (arrimage, remorquage, levage)"],["Points de levage du bac à tiges","4 points de 9/16 po de diamètre"],["Levage par fourches","Passages de fourches sur le côté du châssis et sur le bac à tiges"]]},{"t":"steps","items":["Désactiver le frein SAHR (application par ressort, desserrage hydraulique) : retirer le bouchon des deux ensembles de chenilles à l'aide d'une clé hexagonale M16, ce qui met la machine au point mort.","Fixer solidement la machine au véhicule de remorquage avant de désengager les moyeux d'entraînement.","Après le remorquage, réinstaller les bouchons avant toute utilisation."]},{"t":"warn","w":"danger","text":"Toujours fixer solidement la machine avant de désengager les moyeux : à défaut, risque de mouvement incontrôlé et de blessures graves. Le moyeu doit être remplacé après remorquage pour rétablir le freinage — utiliser la machine sans freins met en danger tout le personnel et les équipements de la zone."}],"figures":[{"page":77,"cap":"Posture du bras à adopter avant tout déplacement de la machine"},{"page":78,"cap":"Bouchon de désactivation du frein SAHR à retirer à la clé hexagonale M16"}]},"7-8":{"blocks":[{"t":"specs","rows":[["Annexe A — Connexion administrateur","Identifiant : opt / Mot de passe : qwer"],["Annexe B — Réinitialisation de la PPU","Bouton d'alimentation PPU maintenu 5 s, puis attente 60 s"],["Annexe C — Appairage AUTEC","Jumelage télécommande/récepteur de rechange (jumelés d'usine)"],["Annexe D — Mise à jour PPU","Fichier taiga.7z sur clé USB vierge"],["Annexe E — Enregistreur de données","Wi-Fi MEDATech-Datalogger / tableau de bord logger.local"]]},{"t":"steps","items":["Réinitialisation de la PPU (Annexe B) — Appuyer sur le bouton d'alimentation de la PPU et le maintenir enfoncé pendant cinq (5) secondes.","Vérifier que le port USB est alimenté et/ou attendre 60 secondes pour voir si l'erreur PPU disparaît.","Si cela ne fonctionne pas, contacter MEDATech pour obtenir de l'aide."]},{"t":"steps","items":["Mise à jour logicielle PPU (Annexe D) — Copier le fichier taiga.7z dans le répertoire racine d'une clé USB vierge.","Système en marche, brancher la clé au câble USB de la PPU et installer la mise à jour.","Attendre au moins 10 minutes, puis éteindre l'appareil ; retirer la clé USB et rallumer.","Sur l'écran d'accueil de l'IHM, vérifier que le numéro de version de la PPU a bien été mis à jour."]},{"t":"ul","items":["Enregistreur de données PPU (Annexe E) : machine sous tension, un réseau Wi-Fi « MEDATech-Datalogger » apparaît.","SSID : MEDATech-Datalogger — Mot de passe : Medatech123 ; tableau de bord accessible via l'invite ou à l'adresse logger.local.","Sous-page « Logs » : journaux UDP (PPU) et CAN téléchargeables par intervalles de 5 minutes."]}],"figures":[{"page":81,"cap":"Bouton d'alimentation de la PPU à maintenir enfoncé 5 s pour la réinitialisation"},{"page":86,"cap":"Écran d'accueil de l'IHM affichant la version logicielle de la PPU"}]}}/*__END_ENRICH__*/;

class Component extends DCLogic {
  MANUAL = "manuel-operateur.pdf";
  RA = "evaluation-risques.pdf";

  MODULES = [
    {
      num:"01", title:"Découvrir le RodBot LP", short:"Présentation", chapters:"1", pages:"6–9",
      subtitle:"Ce qu'est la machine, ses composants, ses trois modes de commande du mât et ses caractéristiques techniques.",
      intro:"Le RodBot LP de Borterra élimine la manutention manuelle des tiges de forage — l'une des principales causes d'accidents liés aux foreuses. Ce module présente la machine, ses composants et ses capacités.",
      sections:[
        { title:"Qu'est-ce que le RodBot LP ?", page:6, blocks:[
          {t:"p", text:"Système robotisé hydraulique de manutention de tiges de forage, conçu pour charger et décharger les tiges sans heurts. Il s'adapte à une large gamme d'équipements : foreuses, plateaux à tiges et palettes."},
          {t:"p", text:"Monté sur chenilles, il transporte un plateau à tiges amovible et se repositionne à l'intérieur du puits. L'alimentation électrique et hydraulique provient d'une connexion câblée à la foreuse ; ce lien relie aussi les circuits d'arrêt d'urgence des deux machines."},
          {t:"warn", w:"note", text:"La machine est principalement commandée par Radio Télécommande (RRC) — l'opérateur reste à distance des tiges."} ]},
        { title:"Les trois modes de commande du mât", page:6, blocks:[
          {t:"ul", items:[
            "DIRECT (« manuel par télécommande ») — chaque mouvement d'articulation est activé individuellement à la manette, comme sur une machinerie lourde conventionnelle.",
            "LINÉAIRE — la tige se déplace en ligne droite (X, Y ou Z) d'un simple mouvement de manette ; le système actionne simultanément plusieurs distributeurs hydrauliques. L'opérateur garde le contrôle individuel du poignet, de la rotation et de l'inclinaison.",
            "TRAJECTOIRE — le mât se déplace automatiquement entre des points enregistrés par l'opérateur, en suivant une trajectoire calculée qui minimise le temps et évite les collisions."] } ]},
        { title:"Principaux composants", page:7, blocks:[
          {t:"ul", items:["Mât télescopique (bras robotisé) sur piédestal","Grappin (pince) avec électroaimant","Bac à tubes amovible","Chenilles et vérins de stabilisation","Panneau électrique 24 V avec IHM tactile","Boîtier de télécommande radio et compartiment de rangement","Voyant lumineux ambre"] } ]},
        { title:"Dimensions & manipulation des tiges", page:8, blocks:[
          {t:"specs", rows:[["Poids à vide","5 800 lb"],["Poids avec bac vide","6 500 lb"],["Longueur × largeur","116 × 60 po"],["Hauteur minimale","90 po"],["Charge max (usage général)","308 lb"],["Charge max (électroaimant)","120 lb"],["Tiges","Ø 5 po × 6 pi"],["Capacité du bac","35 tiges"],["Portée verticale max (du sol)","159 po"],["Portée horizontale max (de l'axe)","119 po"]] } ]},
        { title:"Alimentation & porteur", page:8, blocks:[
          {t:"specs", rows:[["Électrique","120 V c.a. · 4,5 A max"],["Hydraulique","2 500–3 000 psi · 80 L/min"],["Pompe requise","Cylindrée variable, détection de charge"],["Ensemble de liaison","30 pi"],["Freins","Serrage par ressort (SAHR), hydrostatiques"],["Garde au sol","10 po"],["Pente max, bac vide","35° / 70 %"],["Pente max, bac plein","28° / 53 %"],["Pente max, manutention","15° / 27 %"],["Vitesse max","2,8 km/h"]] },
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
      num:"02", title:"Sécurité avant tout", short:"Sécurité", chapters:"2", pages:"10–12",
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
            "DANGER — signale une situation mettant la vie en danger ; ces situations doivent être évitées.",
            "AVERTISSEMENT — information d'une importance cruciale pour la sécurité.",
            "ATTENTION — prévention des risques de blessure et/ou de dommage matériel."] },
          {t:"warn", w:"warn", text:"Les procédures du manuel ne dispensent jamais de la prudence. Respectez la réglementation régionale et les règles spécifiques au site et à l'entreprise."} ]},
        { title:"Pratique sécuritaire de pleine conscience", page:11, blocks:[
          {t:"ul", items:[
            "N'utilisez le système que si vous êtes formé, habilité, en bonne condition physique et mentale — jamais sous l'influence d'alcool ou de drogues.",
            "Lisez et comprenez toutes les étiquettes avant utilisation.",
            "Ne retirez jamais les protections et capots de sécurité quand le système est sous tension.",
            "Il incombe à l'opérateur de connaître les conditions et la présence de personnel dans la zone de travail.",
            "N'intervenez en entretien/réparation que si vous êtes autorisé et qualifié ; pièces de rechange identiques ou équivalentes aux pièces d'origine.",
            "Résolvez tous les dysfonctionnements avant la remise en service ; n'utilisez pas la machine si une erreur est signalée dans le système de commande.",
            "En extérieur : n'utilisez pas le système en cas d'orage ou de vents violents (supérieurs à 65 km/h).",
            "Nettoyez les déversements ou fuites d'huile avant la mise en service."] },
          {t:"warn", w:"danger", text:"Fluides sous pression — risque d'injection sous-cutanée par fuite d'huile hydraulique haute pression. En cas de blessure : contactez IMMÉDIATEMENT les services médicaux d'urgence (risque de gangrène et de réactions graves)."} ]},
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
      num:"03", title:"Composants & commandes de base", short:"Commandes", chapters:"3 – 5", pages:"13–16",
      subtitle:"Les segments du mât (J1–J6), l'interrupteur LOCAL/À DISTANCE, le bouton de réinitialisation de sécurité et les valves d'isolement.",
      intro:"Chaque actionneur du mât porte un numéro et un nom de référence. Le panneau de commande basse tension et les valves d'isolement hydraulique déterminent qui commande la machine — et quand rien ne peut bouger.",
      sections:[
        { title:"Les segments du mât (J1 – J6)", page:13, blocks:[
          {t:"specs", rows:[["J1","PIVOTEMENT (slew)"],["J2","ARTICULATION (épaule)"],["J3","TÉLESCOPE"],["J4","JOINT ROTATIF (poignet)"],["J5","ROTATION"],["J6","INCLINAISON"],["Effecteur","GRAPPIN (pince)"]] },
          {t:"p", text:"Exemple : la fonction PIVOTEMENT (SLEW) correspond à J1. Ces noms sont utilisés partout — écrans, diagnostics, calibrage."} ]},
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
        { text:"Que se passe-t-il pour les valves d'isolement en cas de coupure de courant ?", options:["Elles restent dans leur dernier état","Elles s'ouvrent pour purger la pression","Elles se ferment — plus aucune opération hydraulique"], correct:2 },
        { text:"À quoi sert le bouton de réinitialisation de sécurité ?", options:["À redémarrer l'IHM","À activer/réactiver le circuit de sécurité","À effacer les journaux de données"], correct:1 }
      ]
    },
    {
      num:"04", title:"La télécommande radio", short:"Télécommande", chapters:"6 · 10", pages:"17–24 · 44",
      subtitle:"Activation, clé physique, arrêt d'urgence, modes Rabbit/Turtle, interrupteur d'inclinaison, voyant, manettes, écran et batterie.",
      intro:"La RRC est conçue pour résister aux chocs, à la saleté et à l'eau. Manettes proportionnelles à rappel au zéro ; l'arrêt d'urgence fonctionne en série avec ceux du RodBot et de la foreuse mère.",
      sections:[
        { title:"Clé physique & interverrouillage", page:17, blocks:[
          {t:"warn", w:"note", text:"Une clé physique est installée en haut à gauche de la télécommande. Sans elle, la RRC ne s'allume pas. La retirer en cours de fonctionnement rompt la connexion avec le récepteur et déclenche un arrêt."} ]},
        { title:"Activer / désactiver la télécommande", page:17, blocks:[
          {t:"ul", items:[
            "Prérequis : interrupteur du panneau sur À DISTANCE (REMOTE) — sinon aucun message de mouvement n'est reconnu.",
            "MARCHE : bouton ON sur le côté gauche ; le voyant DEL en bas à gauche de l'écran devient vert.",
            "ARRÊT : appuyer sur l'arrêt d'urgence de la télécommande, puis le réinitialiser en tournant la tête rouge en champignon."] },
          {t:"warn", w:"note", text:"Pour éteindre la RRC sans arrêter la foreuse (changement de batterie, économie d'énergie) : passer d'abord l'interrupteur du panneau en LOCAL, puis appuyer sur l'e-stop de la télécommande."} ]},
        { title:"Arrêt d'urgence de la RRC", page:18, blocks:[
          {t:"p", text:"L'e-stop de la télécommande commande un relais monté en série avec les autres arrêts d'urgence du RodBot et de la foreuse mère. En mode REMOTE, une pression arrête les deux machines — même effet qu'un e-stop câblé."},
          {t:"warn", w:"warn", text:"En mode LOCAL, le bouton d'arrêt d'urgence de la télécommande ne fonctionne PAS."} ]},
        { title:"Modes Rapide (Rabbit) / Lent (Turtle)", page:19, blocks:[
          {t:"p", text:"Applique un facteur d'échelle à toutes les articulations dans les modes DIRECT, LINÉAIRE et TRAJECTOIRE. Rabbit = vitesse maximale définie dans les consignes de valve ; Turtle = vitesse de chaque articulation réduite de 50 % — sauf le grappin."} ]},
        { title:"Interrupteur d'inclinaison", page:19, blocks:[
          {t:"p", text:"Si la télécommande est inclinée ou tombe (opérateur en difficulté), le RodBot passe en arrêt de sécurité : alimentation hydraulique coupée — sans déclencher l'e-stop de la foreuse câblée. Dès que la RRC est remise à l'horizontale, manettes au neutre, le système repasse automatiquement en veille."},
          {t:"warn", w:"warn", text:"Inspection quotidienne : vérifiez le bon fonctionnement de l'interrupteur d'inclinaison au début de chaque quart de travail."} ]},
        { title:"Voyant lumineux ambre", page:20, blocks:[
          {t:"ul", items:["ALLUMÉ (fixe) — mode CONTRÔLE À DISTANCE actif.","CLIGNOTANT — mât en mode TRAJECTOIRE ou machine en déplacement (RALENTI).","ÉTEINT — mode LOCAL."] } ]},
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
        { text:"Le mode Turtle (lent) réduit la vitesse des articulations de…", options:["25 %","50 % — sauf le grappin","75 %, grappin compris"], correct:1 },
        { text:"La télécommande tombe au sol. Que fait le RodBot ?", options:["Il continue son mouvement","Il passe en arrêt de sécurité : hydraulique coupée","Il déclenche l'e-stop de la foreuse câblée"], correct:1 },
        { text:"Le voyant ambre clignote. Cela signifie…", options:["Mode LOCAL actif","Batterie faible de la RRC","Mât en TRAJECTOIRE ou déplacement en RALENTI"], correct:2 },
        { text:"Pour remplacer la batterie sans déclencher d'arrêt d'urgence, la première étape est…", options:["Passer le sélecteur du panneau sur LOCAL","Appuyer sur l'e-stop de la RRC directement","Débrancher le câble de liaison"], correct:0 }
      ]
    },
    {
      num:"05", title:"IHM, réglages & diagnostics", short:"IHM & réglages", chapters:"7 – 9", pages:"25–43",
      subtitle:"Écrans de l'IHM, alarmes, vue 3D, calibrage des codeurs, limites de pivotement, contournements, courbes de manettes et réglage PPU.",
      intro:"L'IHM du panneau électrique donne accès à l'état du système, aux alarmes et aux paramètres d'étalonnage. Certains réglages exigent la connexion administrateur et une vigilance particulière.",
      sections:[
        { title:"Écran d'accueil de l'IHM", page:25, blocks:[
          {t:"ul", items:[
            "État de la connexion radio : vert = connectée, rouge = non opérationnelle ou non autorisée.",
            "Barre supérieure — mode en cours : MÂT DIRECT, LINÉAIRE, TRAJECTOIRE, LOCAL, RALENTI, STABILISATEURS, VEILLE ou DÉFAUT.",
            "Indicateurs d'état : vert = opérationnel, rouge = hors tension ou ERREUR, jaune = chargement ou avertissement. Appuyez sur un cercle pour plus d'informations.",
            "Versions logicielles PLC et PPU affichées ; boutons Paramètres, Diagnostics, Alarmes, vue RVIZ."] } ]},
        { title:"Alarmes & effacement des défauts", page:27, blocks:[
          {t:"p", text:"Le tableau des alarmes classe les entrées en informations, avertissements et défauts système. Causes typiques : défauts du réseau CAN au démarrage, articulations actionnées manuellement en mode télécommande… Les défauts résolus passent à l'état Inactif."},
          {t:"warn", w:"warn", text:"Les défauts actifs ET inactifs doivent tous être effacés avant de reprendre le fonctionnement : sélectionnez la ligne, puis « Effacer le défaut »."} ]},
        { title:"Vue TRAJECTOIRE (modèle 3D)", page:28, blocks:[
          {t:"p", text:"Modèle 3D en temps réel de la position du mât et des obstacles modélisés par le logiciel de planification. Utile après une collision, pour confirmer les lectures des codeurs et diagnostiquer les points de consigne. Quatre vues — appuyez pour agrandir."},
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
          {t:"warn", w:"note", text:"Le bouton OVERRIDE JOINT LIMITS libère toute la course jusqu'aux butées — il se réinitialise en quittant l'écran d'étalonnage."} ]},
        { title:"Contournement des erreurs de valve", page:32, blocks:[
          {t:"p", text:"Réservé à un opérateur expérimenté, dans deux scénarios seulement : un défaut connu non critique (ex. surchauffe) qu'il faut absolument dépasser, ou un défaut sur le bloc de valves de l'autre mode que celui utilisé."},
          {t:"warn", w:"danger", text:"Un contournement actif ignore TOUS les défauts de cette valve. Dangereux si le défaut est critique ou s'il masque un danger imminent pour le personnel ou la machine."} ]},
        { title:"Courbes des manettes & limites de consigne", page:33, blocks:[
          {t:"p", text:"Les courbes (0 à 3) définissent la sensibilité des actionneurs par rapport à la manette : plus de course pour la précision, ou montée linéaire en vitesse. Sélectionnez la courbe sur l'IHM et vérifiez que l'icône s'allume."},
          {t:"p", text:"Les LIMITES DES CONSIGNES DE VALVE réduisent la vitesse maximale de chaque articulation en mode DIRECT (les deux sens ; la gravité peut créer un écart). Plage utile : 10 à 100 % — consultez MEDATech pour un tiroir de valve différent au-delà. Un bouton rétablit les valeurs d'usine."} ]},
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
        { text:"Un contournement d'erreur de valve…", options:["Ignore TOUS les défauts de cette valve — réservé aux cas non critiques","Ne dure que 30 secondes","Est recommandé à chaque défaut"], correct:0 },
        { text:"Quelle est la course totale du pivotement entre butées mécaniques ?", options:["360°","330° (±165°)","180°"], correct:1 },
        { text:"Le mât est saccadé en mode LINÉAIRE malgré des codeurs calibrés. Que faire ?", options:["Un réglage des articulations (étalonnage PPU)","Remplacer la pompe","Passer en mode Rabbit"], correct:0 },
        { text:"Des valves du mode RALENTI affichent un défaut pendant le mode MÂT…", options:["C'est normal : elles sont hors de leur mode désigné","Il faut arrêter la machine immédiatement","Il faut contourner le défaut"], correct:0 }
      ]
    },
    {
      num:"06", title:"Mise en route & déplacement", short:"Mise en route", chapters:"11.1 – 11.5", pages:"45–54",
      subtitle:"Connexion filaire (électrique + hydraulique), séquence de démarrage, les six modes, commande manuelle et déplacement sécuritaire.",
      intro:"Le RodBot n'a aucune source d'énergie embarquée : tout passe par les câbles de liaison de 10 m vers la foreuse. Ce module couvre le branchement, le démarrage et le déplacement de la machine.",
      sections:[
        { title:"Connexion électrique & arrêt d'urgence", page:45, blocks:[
          {t:"p", text:"Deux connexions électriques sous gaine spirale : un câble 24 V CC pour l'électronique embarquée et un câble d'arrêt d'urgence reliant les circuits e-stop du RodBot et de la foreuse mère. Un boîtier de raccordement (120 V CA → 24 V CC) se monte sur la foreuse ; raccordement aux connecteurs 2 et 4 du panneau."},
          {t:"warn", w:"danger", text:"Le RodBot doit être installé avec une BARRIÈRE séparant l'opérateur de la machine et de la foreuse — pilotage par radio, chacun de part et d'autre de la barrière."},
          {t:"warn", w:"warn", text:"Si vous constatez un mouvement inattendu du mât, appuyez immédiatement sur un arrêt d'urgence, puis diagnostiquez le problème."} ]},
        { title:"Raccordement hydraulique", page:47, blocks:[
          {t:"p", text:"L'ensemble de flexibles de liaison (10 m) raccorde le RodBot à la pompe de la foreuse : Pression, Réservoir, Détection de charge (LS) et Drainage du carter. Une cloison à raccords rapides se monte sur la foreuse ou la pompe (2 boulons 3/8 po)."},
          {t:"warn", w:"note", text:"Un remplacement de pompe peut exiger un recalibrage : les modes TRAJECTOIRE et LINÉAIRE dépendent de la latence, de la rampe et de la pression réglées. Contactez MEDATech si leurs performances se dégradent."} ]},
        { title:"Mise en marche — la séquence", page:49, blocks:[
          {t:"steps", items:[
            "Raccordez le RodBot à l'alimentation (câble de liaison → coffret de la foreuse principale).",
            "Attendez l'allumage de l'écran IHM (~30 secondes).",
            "Vérifiez que l'e-stop de la télécommande est déverrouillé, puis appuyez sur le bouton vert de démarrage.",
            "Suivez les instructions à l'écran pour appairer la RRC (nouvel appui sur le bouton vert).",
            "Appuyez sur le bouton de réarmement de sécurité du panneau de contrôle.",
            "Attendez la fin de la séquence de démarrage affichée sur l'IHM.",
            "En mode VEILLE, le système est prêt : sélectionnez un mode depuis les boutons latéraux de la RRC."] } ]},
        { title:"Les six modes de fonctionnement", page:50, blocks:[
          {t:"specs", rows:[["VEILLE","Mode de sécurité — aucune commande traitée ; e-stop, inclinaison et feux restent actifs"],["RALENTI","Chenilles uniquement"],["STABILISATEURS","Les 4 vérins uniquement"],["DIRECT","Articulations individuelles du mât"],["LINÉAIRE","Effecteur en lignes droites X-Y-Z"],["TRAJECTOIRE","Déplacement autonome entre points enregistrés"]] } ]},
        { title:"Commande manuelle & leviers", page:50, blocks:[
          {t:"p", text:"Toutes les fonctions peuvent être actionnées aux leviers des distributeurs — uniquement avec le sélecteur en LOCAL. En mode TÉLÉCOMMANDE, un levier actionné est détecté comme erreur de valve : arrêt de protection, hydraulique coupée. Annulation : passer en LOCAL + bouton de réarmement de sécurité."} ]},
        { title:"Déplacement (RALENTI) & pose de transport", page:51, blocks:[
          {t:"warn", w:"danger", text:"Ne déplacez JAMAIS le RodBot avec les valves manuelles — risque d'être heurté ou écrasé. Toujours par télécommande radio. Les leviers du bloc « chenilles et vérins » servent uniquement à l'entretien et sont livrés déconnectés, rangés à l'arrière."},
          {t:"p", text:"Vous ne pouvez pas passer en mode RALENTI si les mâchoires du grappin sont fermées. Avant tout déplacement, placez le bras en pose de transport :"},
          {t:"ul", items:["Pivotement parallèle au châssis","Levage abaissé au maximum","Télescope rétracté","Poignet orienté vers le bas","Grappin ouvert"] },
          {t:"warn", w:"warn", text:"Inspectez la trajectoire (personnel, obstacles, cavités, terrain instable). Ne vous tenez jamais devant ou à côté de la machine en mouvement ; signaleur si visibilité réduite. Gardez les câbles de liaison hors de la trajectoire — ne roulez jamais dessus."},
          {t:"p", text:"Vitesses chenilles : Hi 2,8 km/h · Lo 1,5 km/h. Pour changer : tournez la valve de dérivation manuelle (carré 0,55 po) de 90° — horaire = Hi, antihoraire = Lo."} ]},
        { title:"Mode VEILLE", page:54, blocks:[
          {t:"p", text:"Permet d'appairer la RRC sans qu'aucune commande ne soit traitée. Toutes les fonctions de sécurité (e-stop, inclinaison) et les feux restent fonctionnels : un mode sûr pour démarrer la télécommande avant de passer aux modes de travail."} ]}
      ],
      quiz:[
        { text:"Quelle est la longueur des câbles de liaison vers la foreuse ?", options:["5 m","10 m","20 m"], correct:1 },
        { text:"Comment le RodBot doit-il être installé par rapport à l'opérateur ?", options:["Une barrière les sépare — pilotage radio de part et d'autre","Côte à côte pour une meilleure visibilité","Peu importe, la radio porte à 100 m"], correct:0 },
        { text:"Peut-on passer en mode RALENTI avec le grappin fermé ?", options:["Oui, sans restriction","Oui, mais en vitesse Lo uniquement","Non, c'est impossible"], correct:2 },
        { text:"Un levier manuel est actionné pendant le mode TÉLÉCOMMANDE…", options:["Le levier prend la priorité","Erreur de valve → arrêt de protection, hydraulique coupée","Le mouvement s'additionne à la commande radio"], correct:1 },
        { text:"Le déplacement de la machine doit se faire…", options:["Par télécommande radio uniquement","Aux valves manuelles pour plus de précision","Indifféremment radio ou leviers"], correct:0 }
      ]
    },
    {
      num:"07", title:"Manutention des tiges", short:"Manutention", chapters:"11.6 – 11.7", pages:"54–66",
      subtitle:"Commande du grappin, modes DIRECT et LINÉAIRE, points de consigne TRAJECTOIRE, limites anti-collision et chargement du bac.",
      intro:"Le cœur du métier : déplacer les tiges entre le plateau et la foreuse. DIRECT ou LINÉAIRE au choix de l'opérateur ; TRAJECTOIRE pour les déplacements automatisés — à condition de définir correctement points et limites.",
      sections:[
        { title:"Commande du grappin (pince)", page:55, blocks:[
          {t:"p", text:"Deux actions simultanées sont requises sur la RRC. FERMER : bouton vert GRAPPIN + bascule GRAPPIN vers le bas. OUVRIR : bouton vert GRAPPIN maintenu + bascule vers le haut maintenue au moins 1 seconde."},
          {t:"warn", w:"danger", text:"Ne jamais se placer sous le mât ou le grappin. Attention aux réseaux suspendus des mines (câbles électriques, conduites d'eau et d'air, ventilation) : tout contact du mât peut entraîner des blessures graves ou la mort."} ]},
        { title:"Choisir entre DIRECT et LINÉAIRE", page:56, blocks:[
          {t:"p", text:"DIRECT : comme une grue traditionnelle, chaque actionneur commandé indépendamment (inscriptions blanches sur la façade). LINÉAIRE : l'effecteur suit des lignes droites — AVANT/ARRIÈRE, HAUT/BAS, GAUCHE/DROITE (pivotement) — étiquettes orange ; manette gauche = haut/bas + gauche/droite, manette droite = intérieur/extérieur. Poignet, rotation et inclinaison restent commandables individuellement."},
          {t:"warn", w:"note", text:"Le choix relève de la préférence personnelle ; pour la plupart des opérateurs, le mode LINÉAIRE est généralement plus simple."} ]},
        { title:"Points de consigne TRAJECTOIRE", page:58, blocks:[
          {t:"p", text:"Accès à l'écran de configuration : maintenir le bouton DIRECT ou LINÉAIRE pendant 3 secondes. Sélectionnez un point avec l'interrupteur « Point de trajectoire », puis « Enregistrer/Sélection » vers le haut pour enregistrer (une coche apparaît) ou vers le bas pour supprimer."},
          {t:"specs", rows:[["PLATEAU 1","Par défaut au-dessus du bac — modifiable"],["PLATEAU 2","Plateau secondaire (au sol) : tige saisie au centre ±5 cm, ≥30 cm au-dessus, parallèle au plateau"],["ATTENTE","Point d'approche final vers la foreuse ; peut servir d'arrêt (présentateur de tiges)"],["FOREUSE","OBLIGATOIRE — point de transfert de la tige, saisie au centre ±5 cm"],["POINT 1 & 2","Points de passage optionnels pour contourner les obstacles"]] },
          {t:"p", text:"Exemple d'enchaînement : PLATEAU → POINT 2 → POINT 1 → ATTENTE → FOREUSE."} ]},
        { title:"Limites supérieure & inférieure (anti-collision)", page:61, blocks:[
          {t:"p", text:"Le planificateur évite d'office : le RodBot lui-même, la foreuse (positionnée d'après le point FOREUSE), le bac à tiges, l'arrière et le plancher. L'opérateur définit en plus deux plans horizontaux — toit/services et sol/rebord."},
          {t:"p", text:"Définition d'un plan : amener le centre de gravité du grappin (vide de préférence) à la hauteur voulue — généralement ~30 cm du sol pour la limite inférieure — puis actionner l'interrupteur vers le haut. Procédure identique pour la limite supérieure."},
          {t:"warn", w:"note", text:"Si une tige est détectée dans le grappin, le planificateur suppose une tige de 6 pi tenue à ±5 cm du centre et garde toute la tige hors des plans."} ]},
        { title:"Pas de système de vision !", page:63, blocks:[
          {t:"warn", w:"danger", text:"Aucun système de vision ne détecte le personnel, les véhicules ou les équipements entrant dans la zone de travail. Barrières, délimitations et restrictions d'exploitation conformes aux politiques de la mine sont OBLIGATOIRES ; limitez la circulation dans l'enveloppe de travail du mât."},
          {t:"warn", w:"warn", text:"Sécurité intégrée : passer en RALENTI et déplacer la machine SUPPRIME tous les points de consigne sauf PLATEAU 1. Les réglages survivent au redémarrage — supprimez points et limites à la fin de chaque tâche et redéfinissez-les à chaque nouvelle configuration."} ]},
        { title:"Fonctionner en mode TRAJECTOIRE", page:64, blocks:[
          {t:"p", text:"Prérequis : FOREUSE, ATTENTE et LIMITES SUPÉRIEURE/INFÉRIEURE définis. Maintenir le bouton jaune TRAJECTOIRE + manette droite : à droite = vers le PLATEAU, à gauche = vers la FOREUSE. Une fois le mouvement amorcé, le bouton peut être relâché ; la manette maintenue poursuit le déplacement, la relâcher arrête le mât."},
          {t:"p", text:"Relâcher le bouton jaune ramène au mode précédent (LINÉAIRE ou DIRECT) — vous pouvez reprendre la main à tout moment, puis réactiver la TRAJECTOIRE : une nouvelle trajectoire sans collision est générée."} ]},
        { title:"Chargement du bac à tiges", page:65, blocks:[
          {t:"ul", items:[
            "Les fourreaux pour fourches du bac s'engagent dans les profilés du châssis.",
            "Le bac se positionne latéralement entre les deux pattes de retenue du châssis.",
            "Le bac n'est PAS boulonné : il est maintenu par ces dispositifs d'alignement et de retenue."] } ]}
      ],
      quiz:[
        { text:"Comment ouvre-t-on le grappin ?", options:["Bouton vert + bascule vers le haut maintenue ≥ 1 s","Un simple appui sur la bascule","Double appui rapide sur le bouton vert"], correct:0 },
        { text:"Quels points sont obligatoires pour utiliser le mode TRAJECTOIRE ?", options:["POINT 1 et POINT 2","FOREUSE, ATTENTE et les LIMITES sup./inf.","Seulement PLATEAU 1"], correct:1 },
        { text:"Le RodBot détecte-t-il une personne entrant dans sa zone de travail ?", options:["Oui, par caméras","Oui, par capteurs laser","Non — aucun système de vision : barrières obligatoires"], correct:2 },
        { text:"Après un déplacement en RALENTI, les points de consigne…", options:["Sont tous conservés","Sont tous supprimés sauf PLATEAU 1","Sont convertis en points par défaut"], correct:1 },
        { text:"Comment le bac à tiges est-il fixé au châssis ?", options:["Boulonné aux quatre coins","Par brides hydrauliques","Non boulonné — fourreaux et pattes de retenue"], correct:2 }
      ]
    },
    {
      num:"08", title:"Dépannage & entretien", short:"Entretien", chapters:"12 – 13 · annexes", pages:"67–87",
      subtitle:"Guide de dépannage, LOTO, inspections, fluides, graissage, patins d'usure, chenilles, transport, remorquage et annexes.",
      intro:"Un entretien régulier garantit un fonctionnement sécuritaire et fiable. Cette section s'adresse au personnel qualifié — et le dépannage commence toujours par les causes simples.",
      sections:[
        { title:"Guide de dépannage — les cas fréquents", page:67, blocks:[
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
          {t:"warn", w:"danger", text:"Machine hors tension, alimentation débranchée, cadenassage-étiquetage (LOTO) respecté pour TOUT entretien — y compris le lavage. Certains dispositifs stockent de l'énergie hydraulique (vérins à valves d'équilibrage). Personnel qualifié uniquement ; pratiques locales de travail en hauteur respectées."},
          {t:"warn", w:"note", text:"Effectuez l'entretien avec l'articulation (épaule) à l'horizontale ou plus bas pour éviter les travaux en hauteur inutiles."} ]},
        { title:"Nettoyage", page:71, blocks:[
          {t:"p", text:"Le RodBot peut et doit être nettoyé — mais jamais de jet direct de nettoyeur à pression sur les composants électriques (codeurs rotatifs, panneau) : la pression endommage leurs joints d'étanchéité."} ]},
        { title:"Inspections régulières", page:71, blocks:[
          {t:"specs", rows:[["Flexibles, conduites, câbles (dommages, fuites)","Quotidienne"],["Test sans tige — mouvements normaux","Quotidienne"],["Arrêts d'urgence fonctionnels","Hebdomadaire"],["Lubrification articulations & couronnes","Hebdomadaire"],["Inspection des chenilles","Hebdomadaire"],["Structures : déformations, fissures de soudure","Hebdomadaire"],["Niveau d'huile réducteur de chenilles","500 h"],["Vidange huile réducteur","2 000 h"],["Patins d'usure du télescope","Au besoin"]] },
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
          {t:"p", text:"Quatre façons de transporter : déplacement autonome, remorquage au sol, chariot élévateur/télescopique, remorque surbaissée — toujours avec le bras en pose de transport. 4 points d'ancrage sur le châssis (arrimage, remorquage, levage) et 4 points de levage 9/16 po sur le bac ; passages de fourches sur châssis et bac."},
          {t:"warn", w:"danger", text:"Remorquage : désactiver les freins SAHR en retirant le bouchon (clé hexagonale M16) des DEUX chenilles — après avoir solidement fixé la machine au véhicule. Réinstaller les bouchons après remorquage : sans eux, la machine n'a PAS de freins."},
          {t:"warn", w:"warn", text:"Respectez les procédures d'ancrage sécuritaires lors de l'arrimage sur un transporteur et lors du chargement/déchargement."} ]},
        { title:"Les annexes du manuel", page:80, blocks:[
          {t:"ul", items:[
            "A (p. 80) — Paramètres de connexion administrateur de l'IHM.",
            "B (p. 81) — Réinitialisation de la PPU : bouton d'alimentation 5 s, attendre 60 s ; sinon contacter MEDATech.",
            "C (p. 82) — Appairage de la télécommande AUTEC et du récepteur (procédure START/ARRÊT).",
            "D (p. 84) — Mise à jour logicielle du PPU : fichier taiga.7z sur clé USB, attendre 10 min, vérifier la version sur l'IHM.",
            "E (p. 87) — Journaux de données : Wi-Fi « MEDATech-Datalogger », tableau de bord logger.local, journaux UDP/CAN par intervalles de 5 min."] } ]}
      ],
      quiz:[
        { text:"Avant tout entretien — y compris le lavage — il faut…", options:["Mettre hors tension, débrancher et appliquer le LOTO","Passer en mode VEILLE","Fermer le grappin"], correct:0 },
        { text:"Les fonctions du mât sont anormalement lentes. Cause probable ?", options:["Pompe usée","Mode Turtle (lent) actif","Batterie RRC faible"], correct:1 },
        { text:"Quelle est la flèche (le mou) correcte d'une chenille ?", options:["5–10 mm","20–25 mm","40–50 mm"], correct:1 },
        { text:"Après un remorquage, il faut…", options:["Vidanger l'huile hydraulique","Réinstaller les bouchons SAHR — sinon pas de freins","Recalibrer les codeurs"], correct:1 },
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
    { x:60, y:76, name:"Bouton PINCE (vert)", page:55, desc:"Activation du grappin — deux actions simultanées requises : FERMER = bouton vert + bascule vers le bas. OUVRIR = bouton vert maintenu + bascule vers le haut maintenue au moins 1 seconde (protection contre les chutes de tige)." },
    { x:41, y:60, name:"Point de trajectoire (sélection)", page:58, desc:"Interrupteur de sélection des points de consigne (PLATEAU, ATTENTE, FOREUSE, POINT 1-2…). Accès à l'écran de configuration : maintenir le bouton DIRECT ou LINÉAIRE pendant 3 secondes." },
    { x:59.5, y:60, name:"ENR / SUPPRIMER", page:58, desc:"Enregistre (vers le haut — une coche apparaît à l'écran) ou supprime (vers le bas) le point de trajectoire sélectionné. Les limites supérieure et inférieure anti-collision se définissent de la même manière." },
    { x:20.5, y:76, name:"Électroaimant (SOUS TENSION / ARRÊT)", page:21, desc:"Commande l'électroaimant du grappin pour saisir les tiges une à une — charge maximale de 120 lb en levage par aimant." },
    { x:26, y:76, name:"Rapide / Lent (Rabbit-Turtle)", page:19, desc:"Facteur d'échelle appliqué à toutes les articulations dans les modes DIRECT, LINÉAIRE et TRAJECTOIRE. Turtle = vitesse réduite de 50 % — sauf le grappin, qui garde sa vitesse." },
    { x:33.5, y:76, name:"Klaxon & gyrophare", page:21, desc:"Avertisseur sonore et feux. Le klaxon retentit automatiquement à chaque changement de mode pour prévenir le personnel à proximité." },
    { x:79, y:76, name:"MÂT / DÉP. LENTE", page:50, desc:"Sélection des grands modes : commande du mât (DIRECT / LINÉAIRE / TRAJECTOIRE) ou déplacement de la machine (RALENTI — chenilles). Impossible de passer en RALENTI si les mâchoires du grappin sont fermées." },
    { x:11, y:86, name:"Interrupteur d'inclinaison (interne)", page:19, desc:"Capteur interne : si la télécommande est inclinée ou tombe (opérateur en difficulté), le RodBot passe en arrêt de sécurité — alimentation hydraulique coupée. Remise à l'horizontale + manettes au neutre = retour automatique en veille. À tester au début de chaque quart." }
  ];

  SIM_MODES = [
    { id:"VEILLE",   tag:"SÉCURITÉ", desc:"Aucune commande n'est traitée. E-stop, interrupteur d'inclinaison et feux restent actifs. Mode sûr pour appairer la télécommande.", beacon:"on",    tracks:false, mast:false },
    { id:"RALENTI",  tag:"TRAM",     desc:"Déplacement de la machine — chenilles uniquement. Interdit si les mâchoires du grappin sont fermées. Le voyant clignote pour avertir le personnel.", beacon:"blink", tracks:true, mast:false },
    { id:"STABILISATEURS", tag:"TRAM", desc:"Commande des 4 vérins de stabilisation uniquement.", beacon:"on", tracks:true, mast:false },
    { id:"DIRECT",   tag:"MÂT",      desc:"Chaque articulation du mât est commandée individuellement à la manette, comme une grue conventionnelle (inscriptions blanches).", beacon:"on", tracks:false, mast:true },
    { id:"LINÉAIRE", tag:"MÂT",      desc:"L'effecteur suit des lignes droites X-Y-Z : le système coordonne plusieurs distributeurs simultanément (étiquettes orange). Le plus simple pour la plupart des opérateurs.", beacon:"on", tracks:false, mast:true },
    { id:"TRAJECTOIRE", tag:"MÂT",   desc:"Le mât se déplace automatiquement entre les points enregistrés en évitant les collisions. Prérequis : FOREUSE, ATTENTE et limites définies. Le voyant clignote.", beacon:"blink", tracks:false, mast:true },
    { id:"LOCAL",    tag:"PANNEAU",  desc:"Commande aux leviers manuels uniquement. Les signaux radio sont ignorés — et l'e-stop de la télécommande NE FONCTIONNE PAS. Voyant éteint.", beacon:"off", tracks:false, mast:false }
  ];

  constructor(props){
    super(props);
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem("rodbot_formation_v3")||"{}"); } catch(e){}
    this.state = {
      view:"home", activeId:null, openKey:null,
      answers:{}, graded:false, lastScore:0, lastPassed:false,
      qIdx:0, qSel:null, qChecked:false, qResults:[], mpage:null,
      completed: saved.completed || {}, name: saved.name || "",
      simTab:"rrc", rrcSel:3, estopped:false,
      slew:0, hoist:52, ext:40, tilt:0, jawOpen:false,
      simMode:"VEILLE", klaxon:false
    };
  }

  openSim = (tab)=>{ this.setState({ view:"sim", simTab:tab }); window.scrollTo(0,0); };
  pickSpot = (i)=>{
    const sp=this.RRC_SPOTS[i];
    if(sp.estop) this.setState({ rrcSel:i, estopped:true });
    else this.setState({ rrcSel:i });
  };
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

  pdfAt(page){ return this.MANUAL + "#page=" + page; }
  manualImg(pg){ return "img/manual/p"+(pg<10?"0"+pg:pg)+".jpg"; }
  openManual = (n)=>{ this.setState({ mpage: Math.max(1, Math.min(87, n||1)) }); window.scrollTo(0,0); };
  closeManual = ()=> this.setState({ mpage:null });
  manualPrev = ()=> this.setState(s=>({ mpage: Math.max(1, (s.mpage||1)-1) }));
  manualNext = ()=> this.setState(s=>({ mpage: Math.min(87, (s.mpage||1)+1) }));
  manualPagesFor(idx){
    var seq=(a,b)=>{ var r=[]; for(var i=a;i<=b;i++) r.push(i); return r; };
    var MAP=[
      [1,2,3,4,5,6,7,8,9],        // 01 — Découvrir (pages liminaires + présentation)
      [10,11,12],                 // 02 — Sécurité
      [13,14,15,16],              // 03 — Composants & commandes
      [17,18,19,20,21,22,23,24,44],// 04 — Télécommande radio (+ batterie p.44)
      seq(25,43),                 // 05 — IHM, réglages & diagnostics
      seq(45,54),                 // 06 — Mise en route & déplacement
      seq(55,66),                 // 07 — Manutention des tiges
      seq(67,87)                  // 08 — Dépannage & entretien + annexes
    ];
    var pages=MAP[idx]||[];
    return pages.map(function(pg){
      return { n:pg, src:this.manualImg(pg), href:this.pdfAt(pg), open:()=>this.openManual(pg) };
    }, this);
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
    if(q.type==="multi") return "Bonnes réponses : "+(q.correct||[]).map(i=>L[i]).join(", ");
    if(q.type==="order") return "Ordre correct : "+(q.correct||[]).map((i,pos)=>(pos+1)+") "+q.options[i]).join("  ·  ");
    if(q.type==="cloze") return "Réponse : "+q.options[q.correct];
    return "Réponse : "+L[q.correct]+") "+q.options[q.correct];
  }

  moduleDone(i){ return !!this.state.completed[i]; }
  moduleScore(i){ return this.state.completed[i] ? this.state.completed[i].score : 0; }
  allDone(){ return this.MODULES.every((m,i)=>this.moduleDone(i)); }

  goHome = ()=> this.setState({ view:"home", graded:false, answers:{} });
  openModule = (i)=> this.setState({ view:"module", activeId:i, openKey:null });
  toggleSection = (key)=> this.setState(s=>({ openKey: s.openKey===key ? null : key }));
  startQuiz = ()=> { this.setState({ view:"quiz", qIdx:0, qSel:null, qChecked:false, qResults:[], graded:false }); window.scrollTo(0,0); };
  backToModule = ()=> this.setState({ view:"module", graded:false });
  retryQuiz = ()=> { this.setState({ qIdx:0, qSel:null, qChecked:false, qResults:[], graded:false }); window.scrollTo(0,0); };
  setName = (e)=>{ const v=e.target.value; this.setState({name:v}, ()=>this.persist()); };
  scrollToSafety = ()=>{ const el=document.getElementById("rb-safety"); if(el){ const y=el.getBoundingClientRect().top+window.scrollY-80; window.scrollTo({top:y,behavior:"smooth"}); } };
  startFirst = ()=>{ const first=this.MODULES.findIndex((m,i)=>!this.moduleDone(i)); this.openModule(first===-1?0:first); };

  // ===== Moteur de quiz typé (choix unique, vrai/faux, sélection multiple, remise en ordre, texte à trou) =====
  quizFor(idx){
    if(typeof QUIZ2!=="undefined" && QUIZ2[idx]) return QUIZ2[idx];
    const mod=this.MODULES[idx];
    return (mod?mod.quiz:[]).map(q=>({ type:"qcm", text:q.text, options:q.options, correct:q.correct, page:0, fb:"" }));
  }
  quizPickOne = (oi)=>{ if(this.state.qChecked) return; this.setState({ qSel:oi }); };
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
    if(next<this.MODULES.length) this.setState({ view:"module", activeId:next, openKey:null, graded:false, qIdx:0, qSel:null, qChecked:false, qResults:[] });
    else if(this.allDone()) this.setState({ view:"cert" });
    else this.goHome();
  };

  renderVals(){
    const S=this.state, M=this.MODULES;
    const total=M.length;
    const doneCount=M.filter((m,i)=>this.moduleDone(i)).length;
    const totalSections=M.reduce((a,m)=>a+m.sections.length,0);

    const base={
      isHome:S.view==="home", isModule:S.view==="module", isQuiz:S.view==="quiz", isCert:S.view==="cert",
      totalModules:total, doneCount, totalSections,
      progressPct: Math.round(doneCount/total*100), passPct:70,
      manualUrl:this.MANUAL, raUrl:this.RA,
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
      { where:"PANNEAU BASSE TENSION", detail:"Immédiatement sous l'IHM à écran tactile" },
      { where:"TÉLÉCOMMANDE RADIO", detail:"Au centre, en bas de la RRC" },
      { where:"CHÂSSIS DU RODBOT", detail:"Coin inférieur avant droit" },
      { where:"COMMANDES MANUELLES", detail:"À l'arrière, près des leviers hydrauliques" }
    ];

    const mod = S.activeId!=null ? M[S.activeId] : null;
    if(mod){
      const done=this.moduleDone(S.activeId);
      const modNum=Number(mod.num);
      const firstPage=mod.sections.length?mod.sections[0].page:1;
      base.mod={
        num:mod.num, title:mod.title, intro:mod.intro, chapters:mod.chapters, pages:mod.pages,
        pdfHref:this.pdfAt(firstPage), openManual:()=>this.openManual(firstPage), sectionCount:mod.sections.length,
        quizLen:mod.quiz.length, done, score:this.moduleScore(S.activeId),
        quizCta: done ? "Repasser le quiz" : "Passer le quiz",
        manualPages: this.manualPagesFor(S.activeId),
        manualCount: this.manualPagesFor(S.activeId).length,
        sections: mod.sections.map((sec,si)=>{
          const key=S.activeId+"-"+si;
          const open=S.openKey===key;
          const enr = (typeof ENRICH!=="undefined" && ENRICH[key]) ? ENRICH[key] : {};
          const figBlocks = (enr.figures||[]).map(f=>({ t:"img", src:"img/fig/p"+(f.page<10?"0"+f.page:f.page)+".jpg", cap:f.cap||"", page:f.page }));
          const allBlocks = sec.blocks.concat(enr.blocks||[]).concat(figBlocks);
          const hasDanger=allBlocks.some(b=>b.t==="warn"&&b.w==="danger");
          return {
            ref:modNum+"."+(si+1), title:sec.title, page:sec.page, pdfHref:this.pdfAt(sec.page), openPage:()=>this.openManual(sec.page),
            accent: hasDanger ? "#D92624" : "#1D1E1B",
            open, chevron: open?"rotate(180deg)":"rotate(0deg)", toggle:()=>this.toggleSection(key),
            blocks: allBlocks.map(b=>{
              const o={ isP:b.t==="p", isUl:b.t==="ul", isSteps:b.t==="steps", isSpecs:b.t==="specs", isWarn:b.t==="warn", isImg:b.t==="img", text:b.text||"" };
              if(b.t==="p") o.lines=this.splitSentences(b.text);
              if(b.t==="ul") o.items=b.items;
              if(b.t==="steps") o.steps=b.items.map((tx,ix)=>({ n:ix+1, text:tx }));
              if(b.t==="specs") o.rows=b.rows.map(r=>({ k:r[0], v:r[1] }));
              if(b.t==="warn") Object.assign(o, this.warnStyle(b.w));
              if(b.t==="img"){ o.src=b.src; o.cap=b.cap||""; o.imgPage=b.page; o.imgHref=this.pdfAt(b.page); o.openPage=()=>this.openManual(b.page); }
              return o;
            })
          };
        })
      };

      const LETTERS=["A","B","C","D","E","F"];
      const TYPEL={qcm:"Choix unique",vf:"Vrai ou faux",multi:"Sélection multiple — cochez toutes les bonnes réponses",order:"Remettez dans le bon ordre",cloze:"Texte à trou"};
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
        nextLabel:(qi+1<qlist.length)?"Question suivante →":"Voir mon résultat →"
      };
      if(checked){
        const ok=this.quizCorrect(q,sel);
        base.quiz.fb={ ok:ok, label:ok?"✓ Bonne réponse":"✗ Réponse incorrecte",
          bg:ok?"rgba(62,156,90,.1)":"rgba(217,38,36,.08)", bar:ok?"#2F7D48":"#D92624", fg:ok?"#2F7D48":"#B71F1D",
          text:q.fb||"", answerText:this.quizAnswerText(q), page:q.page||0, pageHref:this.pdfAt(q.page||1), hasPage:!!q.page, open:(()=>this.openManual(q.page||1)) };
      } else { base.quiz.fb=null; }

      const passed=S.lastPassed;
      const lastModule=S.activeId===M.length-1;
      base.result={
        scorePct:S.lastScore,
        ringBg: passed?"rgba(62,156,90,.14)":"rgba(217,38,36,.1)",
        ringFg: passed?"#2F7D48":"#B71F1D",
        title: passed?"Module validé !":"Pas tout à fait…",
        message: passed
          ? "Vous maîtrisez les points clés de ce module. Poursuivez avec le module suivant ou revenez au parcours."
          : "Il faut au moins 70 % pour valider. Revoyez les leçons du module puis retentez le quiz.",
        nextLabel: !passed?"Revoir le module":(lastModule?(this.allDone()?"Voir mon attestation":"Retour au parcours"):"Module suivant"),
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
    base.rrcSpots = this.RRC_SPOTS.map((sp,i)=>{
      const sel = S.rrcSel===i;
      const isE = !!sp.estop;
      return {
        n:i+1, x:sp.x, y:sp.y, name:sp.name, pick:()=>this.pickSpot(i),
        bg: sel ? (isE?"#D92624":"#1D1E1B") : "rgba(20,20,19,.82)",
        fg: sel ? (isE?"#fff":"#FFFFFF") : "#FAF9F5",
        ring: isE ? "#D92624" : "#1D1E1B",
        halo: sel ? (isE?"rgba(217,38,36,.32)":"rgba(29,30,27,.24)") : "rgba(29,30,27,.12)"
      };
    });
    const selSp = this.RRC_SPOTS[S.rrcSel] || this.RRC_SPOTS[0];
    base.rrcSelN = S.rrcSel+1;
    base.rrcSelName = selSp.name;
    base.rrcSelDesc = selSp.desc;
    base.rrcSelPage = selSp.page;
    base.rrcSelHref = this.pdfAt(selSp.page);

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
    const curMode = this.SIM_MODES.find(m=>m.id===S.simMode);
    base.simModes = this.SIM_MODES.map(m=>{
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
      page:S.mpage, total:87, src:this.manualImg(S.mpage), pdfHref:this.pdfAt(S.mpage),
      prev:this.manualPrev, next:this.manualNext, close:this.closeManual,
      hasPrev:S.mpage>1, hasNext:S.mpage<87, noop:function(e){ if(e&&e.stopPropagation) e.stopPropagation(); }
    } : null;

    base.certModules=M.map((m,i)=>({ num:m.num, short:m.short, score:this.moduleScore(i) }));
    const scores=M.map((m,i)=>this.moduleScore(i));
    base.overallScore= scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):0;

    return base;
  }
}


/* --------- Démarrage --------- */
function bootRodbot() {
  ROOT = document.getElementById('app');
  var tplSrc = document.getElementById('rb-template').textContent;
  var doc = new DOMParser().parseFromString('<div id="rb-wrap">' + tplSrc + '</div>', 'text/html');
  TPL_ROOT = doc.getElementById('rb-wrap');
  COMP = new Component({});
  fullRender();
  // Clavier pour le visionneur du manuel : Échap ferme, ← / → naviguent
  document.addEventListener('keydown', function(e){
    if(!COMP || COMP.state.mpage==null) return;
    if(e.key==='Escape') COMP.closeManual();
    else if(e.key==='ArrowLeft') COMP.manualPrev();
    else if(e.key==='ArrowRight') COMP.manualNext();
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootRodbot);
else bootRodbot();
