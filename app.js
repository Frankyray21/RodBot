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
var ENRICH = /*__ENRICH__*/{}/*__END_ENRICH__*/;

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
      return { n:pg, src:"img/manual/p"+(pg<10?"0"+pg:pg)+".jpg", href:this.pdfAt(pg) };
    }, this);
  }
  warnStyle(w){
    if(w==="danger") return { wBg:"rgba(217,38,36,.09)", wBorder:"rgba(217,38,36,.5)", wSolid:"#D92624", wFg:"#B71F1D", wLabel:"⚠ DANGER" };
    if(w==="warn")   return { wBg:"rgba(232,163,58,.13)", wBorder:"rgba(214,144,36,.45)",  wSolid:"#E8A33A", wFg:"#8A5A10", wLabel:"AVERTISSEMENT" };
    return { wBg:"rgba(83,82,82,.06)", wBorder:"rgba(83,82,82,.28)", wSolid:"#989898", wFg:"#535252", wLabel:"REMARQUE" };
  }

  moduleDone(i){ return !!this.state.completed[i]; }
  moduleScore(i){ return this.state.completed[i] ? this.state.completed[i].score : 0; }
  allDone(){ return this.MODULES.every((m,i)=>this.moduleDone(i)); }

  goHome = ()=> this.setState({ view:"home", graded:false, answers:{} });
  openModule = (i)=> this.setState({ view:"module", activeId:i, openKey:null });
  toggleSection = (key)=> this.setState(s=>({ openKey: s.openKey===key ? null : key }));
  startQuiz = ()=> this.setState({ view:"quiz", answers:{}, graded:false });
  backToModule = ()=> this.setState({ view:"module", graded:false });
  retryQuiz = ()=> this.setState({ answers:{}, graded:false });
  pickAnswer = (qi,oi)=>{ if(this.state.graded) return; this.setState(s=>({ answers:{...s.answers,[qi]:oi} })); };
  setName = (e)=>{ const v=e.target.value; this.setState({name:v}, ()=>this.persist()); };
  scrollToSafety = ()=>{ const el=document.getElementById("rb-safety"); if(el){ const y=el.getBoundingClientRect().top+window.scrollY-80; window.scrollTo({top:y,behavior:"smooth"}); } };
  startFirst = ()=>{ const first=this.MODULES.findIndex((m,i)=>!this.moduleDone(i)); this.openModule(first===-1?0:first); };

  submitQuiz = ()=>{
    const mod = this.MODULES[this.state.activeId];
    if(Object.keys(this.state.answers).length < mod.quiz.length) return;
    let correct=0;
    mod.quiz.forEach((q,i)=>{ if(this.state.answers[i]===q.correct) correct++; });
    const pct = Math.round(correct/mod.quiz.length*100);
    const passed = pct >= 70;
    this.setState(s=>{
      const completed={...s.completed};
      if(passed) completed[s.activeId]={ score: Math.max(pct,(completed[s.activeId]&&completed[s.activeId].score)||0) };
      return { graded:true, lastScore:pct, lastPassed:passed, completed };
    }, ()=>this.persist());
  };
  goToNextModule = ()=>{
    const next=this.state.activeId+1;
    if(next<this.MODULES.length) this.setState({ view:"module", activeId:next, openKey:null, graded:false, answers:{} });
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
        pdfHref:this.pdfAt(firstPage), sectionCount:mod.sections.length,
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
            ref:modNum+"."+(si+1), title:sec.title, page:sec.page, pdfHref:this.pdfAt(sec.page),
            accent: hasDanger ? "#D92624" : "#1D1E1B",
            open, chevron: open?"rotate(180deg)":"rotate(0deg)", toggle:()=>this.toggleSection(key),
            blocks: allBlocks.map(b=>{
              const o={ isP:b.t==="p", isUl:b.t==="ul", isSteps:b.t==="steps", isSpecs:b.t==="specs", isWarn:b.t==="warn", isImg:b.t==="img", text:b.text||"" };
              if(b.t==="ul") o.items=b.items;
              if(b.t==="steps") o.steps=b.items.map((tx,ix)=>({ n:ix+1, text:tx }));
              if(b.t==="specs") o.rows=b.rows.map(r=>({ k:r[0], v:r[1] }));
              if(b.t==="warn") Object.assign(o, this.warnStyle(b.w));
              if(b.t==="img"){ o.src=b.src; o.cap=b.cap||""; o.imgPage=b.page; o.imgHref=this.pdfAt(b.page); }
              return o;
            })
          };
        })
      };

      const letters=["A","B","C","D"];
      base.quizActive=!S.graded;
      base.quizGraded=S.graded;
      base.quizItems=mod.quiz.map((q,qi)=>({
        n:qi+1, text:q.text,
        options:q.options.map((o,oi)=>{
          const chosen=S.answers[qi]===oi;
          return {
            text:o, letter:letters[oi], pick:()=>this.pickAnswer(qi,oi),
            bg: chosen?"rgba(217,38,36,.06)":"#FFFFFF",
            border: chosen?"#D92624":"rgba(29,30,27,.18)",
            dot: chosen?"#D92624":"rgba(29,30,27,.3)",
            dotBg: chosen?"#D92624":"transparent",
            dotFg: chosen?"#FFFFFF":"#535252"
          };
        })
      }));
      const allAnswered=Object.keys(S.answers).length>=mod.quiz.length;
      base.submitLabel= allAnswered?"Valider mes réponses":"Répondez à toutes les questions";
      base.submitBg= allAnswered?"#D92624":"rgba(29,30,27,.12)";
      base.submitFg= allAnswered?"#FFFFFF":"rgba(29,30,27,.42)";
      base.submitCursor= allAnswered?"pointer":"not-allowed";
      base.submitQuiz=this.submitQuiz;

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
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootRodbot);
else bootRodbot();
