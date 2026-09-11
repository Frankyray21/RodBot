/* ===========================================================================
   pdf.js  |  Attestation de formation RodBot LP, en PDF.

   Aucune bibliotheque, aucun CDN, aucun reseau. L'equipement sert sous terre :
   l'operateur doit pouvoir sortir son attestation la ou il n'y a pas un seul
   barreau de signal. Le fichier est donc ecrit octet par octet ici.

   Choix techniques
   - Polices Helvetica et Helvetica-Bold : les 14 polices de base d'un lecteur
     PDF. Rien a incorporer, fichier de 20 ko au lieu de 400 ko.
   - Texte encode en WinAnsi (cp1252), les accents francais passent tels quels.
     Tout est echappe en octal, donc le fichier reste de l'ASCII pur et les
     decalages de la table xref se comptent en caracteres.
   - La signature est tracee en vecteur a partir des traits du doigt, pas
     collee en image. Nette a l'impression et quelques centaines d'octets.

   Entree unique : RodbotPdf.attestation(donnees) -> Uint8Array.
   =========================================================================== */
(function (global) {
  'use strict';

  var PAGE_W = 595.28, PAGE_H = 841.89;   // A4 portrait, en points
  var MG = 46;                            // marge gauche et droite
  var MG_BAS = 54;                        // marge basse avant saut de page
  var COL_R = PAGE_W - MG;                // bord droit du contenu

  var NOIR = [0.11, 0.11, 0.10];
  var GRIS = [0.47, 0.47, 0.46];
  var PALE = [0.60, 0.60, 0.59];
  var ROUGE = [0.85, 0.15, 0.14];
  var VERT = [0.18, 0.49, 0.28];
  var TRAIT = [0.82, 0.82, 0.80];
  var FOND = [0.98, 0.976, 0.961];

  /* ---------- Encodage WinAnsi ---------- */

  /* Les 27 caracteres du bloc 0x80-0x9F de cp1252 qui ne sont pas en Latin-1. */
  var CP1252 = {
    0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85,
    0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A,
    0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92,
    0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
    0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C,
    0x017E: 0x9E, 0x0178: 0x9F
  };

  function octet(code) {
    if (code >= 32 && code < 127) return code;          // ASCII imprimable
    if (code >= 0xA0 && code <= 0xFF) return code;      // Latin-1 : accents
    if (CP1252[code]) return CP1252[code];
    return 63;                                          // '?' plutot qu'un trou
  }

  /* Chaine PDF litterale : tout ce qui n'est pas ASCII sur devient \ooo. */
  function esc(s) {
    var out = '', i, b;
    s = String(s == null ? '' : s);
    for (i = 0; i < s.length; i++) {
      b = octet(s.charCodeAt(i));
      if (b === 40 || b === 41 || b === 92) out += '\\' + String.fromCharCode(b);
      else if (b < 32 || b > 126) out += '\\' + ('00' + b.toString(8)).slice(-3);
      else out += String.fromCharCode(b);
    }
    return out;
  }

  /* ---------- Largeur des caracteres ----------
     Metriques Adobe des polices de base, en milliemes de la taille. On garde
     l'ASCII exact ; les lettres accentuees ont la largeur de leur lettre nue,
     ce qui est vrai dans Helvetica. */
  var W_REG = {};
  var W_BOLD = {};
  (function () {
    var ordre = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';
    var reg = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,
               556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,
               1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,
               667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,
               333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,
               556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
    var bold = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,
                556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,
                975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,
                667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,
                333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,
                611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
    for (var i = 0; i < ordre.length; i++) {
      W_REG[ordre.charAt(i)] = reg[i];
      W_BOLD[ordre.charAt(i)] = bold[i];
    }
  })();

  /* Lettre accentuee -> lettre nue, plus les signes que le site utilise. */
  var NU = {
    'à':'a','â':'a','ä':'a','á':'a','ã':'a','å':'a',
    'ç':'c','è':'e','é':'e','ê':'e','ë':'e',
    'ì':'i','í':'i','î':'i','ï':'i','ñ':'n',
    'ò':'o','ó':'o','ô':'o','õ':'o','ö':'o',
    'ù':'u','ú':'u','û':'u','ü':'u','ý':'y','ÿ':'y',
    'À':'A','Á':'A','Â':'A','Ã':'A','Ä':'A','Å':'A',
    'Ç':'C','È':'E','É':'E','Ê':'E','Ë':'E',
    'Ì':'I','Í':'I','Î':'I','Ï':'I','Ñ':'N',
    'Ò':'O','Ó':'O','Ô':'O','Õ':'O','Ö':'O',
    'Ù':'U','Ú':'U','Û':'U','Ü':'U','Ý':'Y'
  };
  var SPEC = {
    '·': 278, '°': 400, '«': 556, '»': 556, '’': 222,
    '‘': 222, '“': 333, '”': 333, '…': 1000, '–': 556,
    '—': 1000, '•': 350, 'æ': 889, 'œ': 944, 'ß': 611,
    ' ': 278, '©': 737, '®': 737, '€': 556, '±': 584
  };

  function larg(str, taille, gras, track) {
    var t = gras ? W_BOLD : W_REG, total = 0, i, c;
    str = String(str == null ? '' : str);
    for (i = 0; i < str.length; i++) {
      c = str.charAt(i);
      if (t[c] != null) { total += t[c]; continue; }
      if (NU[c] && t[NU[c]] != null) { total += t[NU[c]]; continue; }
      if (SPEC[c] != null) { total += SPEC[c]; continue; }
      total += gras ? 611 : 556;
    }
    return total * taille / 1000 + (track ? track * str.length : 0);
  }

  /* Coupe un texte en lignes qui tiennent dans une largeur donnee. */
  function couper(str, maxi, taille, gras) {
    var mots = String(str == null ? '' : str).split(/\s+/);
    var lignes = [], ligne = '', i, essai;
    for (i = 0; i < mots.length; i++) {
      if (!mots[i]) continue;
      essai = ligne ? ligne + ' ' + mots[i] : mots[i];
      if (larg(essai, taille, gras) <= maxi || !ligne) ligne = essai;
      else { lignes.push(ligne); ligne = mots[i]; }
    }
    if (ligne) lignes.push(ligne);
    return lignes.length ? lignes : [''];
  }

  function n(v) {
    var s = (Math.round(v * 100) / 100).toString();
    return s.indexOf('e') >= 0 ? '0' : s;   // jamais de notation scientifique
  }
  function coul(c) { return n(c[0]) + ' ' + n(c[1]) + ' ' + n(c[2]); }

  /* ---------- Le document ---------- */

  function Doc() {
    this.pages = [];
    this.flux = null;
    this.y = 0;             // position courante, comptee DEPUIS LE HAUT
    this.nouvellePage();
  }
  Doc.prototype.nouvellePage = function () {
    this.flux = [];
    this.pages.push(this.flux);
    this.y = MG;
  };
  /* Reserve une hauteur : passe a la page suivante si elle ne rentre plus. */
  Doc.prototype.place = function (h) {
    if (this.y + h > PAGE_H - MG_BAS) { this.nouvellePage(); return true; }
    return false;
  };
  Doc.prototype.bloc = function (x, y, w, h, c) {
    this.flux.push(coul(c) + ' rg ' + n(x) + ' ' + n(PAGE_H - y - h) + ' ' + n(w) + ' ' + n(h) + ' re f');
  };
  Doc.prototype.filet = function (x1, y, x2, ep, c) {
    this.flux.push(coul(c) + ' RG ' + n(ep) + ' w ' + n(x1) + ' ' + n(PAGE_H - y) +
                   ' m ' + n(x2) + ' ' + n(PAGE_H - y) + ' l S');
  };
  /* Filet vertical : sert a separer les cases du bandeau de chiffres. */
  Doc.prototype.filetV = function (x, y, h, ep, c) {
    this.flux.push(coul(c) + ' RG ' + n(ep) + ' w ' + n(x) + ' ' + n(PAGE_H - y) +
                   ' m ' + n(x) + ' ' + n(PAGE_H - y - h) + ' l S');
  };
  /* y = ligne de base du texte, comptee depuis le haut. */
  Doc.prototype.texte = function (str, x, y, o) {
    o = o || {};
    var taille = o.size || 10, gras = !!o.bold, c = o.color || NOIR;
    var tr = o.track || 0;
    var px = x;
    if (o.align === 'right') px = x - larg(str, taille, gras, tr);
    else if (o.align === 'center') px = x - larg(str, taille, gras, tr) / 2;
    // Tc appartient a l'etat du texte et survit a ET : on le repose toujours,
    // sinon l'interlettrage d'un titre deteint sur tout le reste de la page.
    this.flux.push('BT /' + (gras ? 'F2' : 'F1') + ' ' + n(taille) + ' Tf ' + coul(c) +
                   ' rg ' + n(tr) + ' Tc 1 0 0 1 ' + n(px) + ' ' + n(PAGE_H - y) +
                   ' Tm (' + esc(str) + ') Tj ET');
  };
  /* Paragraphe coupe automatiquement. Rend la hauteur occupee. */
  Doc.prototype.para = function (str, x, y, maxi, o) {
    o = o || {};
    var taille = o.size || 10, inter = o.leading || (taille * 1.45);
    var lignes = couper(str, maxi, taille, !!o.bold), i, px = x;
    for (i = 0; i < lignes.length; i++) {
      this.texte(lignes[i], px, y + taille * 0.78 + i * inter, o);
    }
    return lignes.length * inter;
  };

  /* ---------- Signature vectorielle ----------
     traits : [[{x,y}, ...], ...] dans un repere source de src_w x src_h.
     On l'inscrit dans le cadre demande sans le deformer. */
  Doc.prototype.signature = function (traits, x, y, w, h, srcW, srcH) {
    if (!traits || !traits.length) return;
    var k = Math.min(w / srcW, h / srcH);
    var dx = x + (w - srcW * k) / 2, dy = y + (h - srcH * k) / 2;
    var f = this.flux, i, j, s, p;
    f.push(coul(NOIR) + ' RG ' + n(Math.max(0.9, 3 * k)) + ' w 1 J 1 j');
    for (i = 0; i < traits.length; i++) {
      s = traits[i];
      if (!s || !s.length) continue;
      p = s[0];
      f.push(n(dx + p.x * k) + ' ' + n(PAGE_H - (dy + p.y * k)) + ' m');
      if (s.length === 1) f.push(n(dx + (p.x + 0.6) * k) + ' ' + n(PAGE_H - (dy + (p.y + 0.6) * k)) + ' l');
      for (j = 1; j < s.length; j++) {
        f.push(n(dx + s[j].x * k) + ' ' + n(PAGE_H - (dy + s[j].y * k)) + ' l');
      }
      f.push('S');
    }
  };

  /* ---------- Assemblage du fichier ---------- */
  Doc.prototype.rendu = function (titre, auteur) {
    var objets = [], i;
    var nbPages = this.pages.length;
    var idPages = 2;                       // 1 = catalogue, 2 = arbre des pages
    var idFont1 = 3, idFont2 = 4, idInfo = 5;
    var idPage1 = 6;                       // puis une page et un flux par page

    function ajoute(id, corps) { objets[id] = corps; }

    var kids = [];
    for (i = 0; i < nbPages; i++) kids.push((idPage1 + i * 2) + ' 0 R');

    ajoute(1, '<< /Type /Catalog /Pages ' + idPages + ' 0 R >>');
    ajoute(idPages, '<< /Type /Pages /Count ' + nbPages + ' /Kids [' + kids.join(' ') + '] >>');
    ajoute(idFont1, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    ajoute(idFont2, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    ajoute(idInfo, '<< /Title (' + esc(titre) + ') /Author (' + esc(auteur) + ') /Creator (RodBot LP) /Producer (RodBot LP) >>');

    for (i = 0; i < nbPages; i++) {
      var idP = idPage1 + i * 2, idC = idP + 1;
      ajoute(idP, '<< /Type /Page /Parent ' + idPages + ' 0 R /MediaBox [0 0 ' + n(PAGE_W) + ' ' + n(PAGE_H) +
                  '] /Resources << /Font << /F1 ' + idFont1 + ' 0 R /F2 ' + idFont2 +
                  ' 0 R >> >> /Contents ' + idC + ' 0 R >>');
      var flux = this.pages[i].join('\n');
      ajoute(idC, '<< /Length ' + flux.length + ' >>\nstream\n' + flux + '\nendstream');
    }

    var maxId = idPage1 + nbPages * 2 - 1;
    var out = '%PDF-1.4\n%\\342\\343\\317\\323\n';
    var pos = [];
    for (i = 1; i <= maxId; i++) {
      pos[i] = out.length;
      out += i + ' 0 obj\n' + (objets[i] || '<< >>') + '\nendobj\n';
    }
    var xref = out.length;
    out += 'xref\n0 ' + (maxId + 1) + '\n0000000000 65535 f \n';
    for (i = 1; i <= maxId; i++) out += ('0000000000' + pos[i]).slice(-10) + ' 00000 n \n';
    out += 'trailer\n<< /Size ' + (maxId + 1) + ' /Root 1 0 R /Info ' + idInfo + ' 0 R >>\n' +
           'startxref\n' + xref + '\n%%EOF\n';

    var bytes = new Uint8Array(out.length);
    for (i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xFF;
    return bytes;
  };

  /* =========================================================================
     Mise en page de l'attestation.
     ========================================================================= */
  function attestation(d) {
    d = d || {};
    var L = d.labels || {};
    var doc = new Doc();
    var largeur = COL_R - MG;

    /* --- Bandeau rouge et identite du document --- */
    doc.bloc(0, 0, PAGE_W, 9, ROUGE);
    doc.y = 40;
    doc.texte(L.marque || 'BORTERRA RODBOT LP', MG, doc.y, { size: 8.5, bold: true, color: ROUGE, track: 1.6 });
    doc.texte(L.ref || 'OM 10667 . R0 . BM260024', COL_R, doc.y, { size: 8.5, bold: true, color: PALE, align: 'right' });
    doc.y += 24;
    doc.texte(L.titre || 'ATTESTATION DE FORMATION', MG, doc.y, { size: 21, bold: true, color: NOIR });
    doc.y += 12;
    doc.filet(MG, doc.y, COL_R, 1.6, NOIR);
    doc.y += 26;

    /* --- Qui, et ce qu'il a fait --- */
    doc.texte(L.atteste || 'Ce document atteste que', MG, doc.y, { size: 9.5, color: GRIS });
    doc.y += 24;
    doc.texte(d.name || '', MG, doc.y, { size: 20, bold: true, color: NOIR });
    doc.y += 8;
    if (d.employeeId) {
      doc.texte((L.matricule || 'Matricule') + ' : ' + d.employeeId, MG, doc.y + 9, { size: 9, color: GRIS });
      doc.y += 14;
    }
    doc.y += 12;
    doc.y += doc.para(d.phrase || '', MG, doc.y, largeur, { size: 10.5, leading: 15 });
    doc.y += 16;

    /* --- Les quatre chiffres cles, en bandeau --- */
    var cases = d.cles || [];
    var lc = largeur / (cases.length || 1), hc = 46;
    doc.bloc(MG, doc.y, largeur, hc, FOND);
    for (var i = 0; i < cases.length; i++) {
      var cx = MG + i * lc;
      if (i) doc.filetV(cx, doc.y + 10, hc - 20, 0.8, TRAIT);
      doc.texte(cases[i].k, cx + 12, doc.y + 17, { size: 7.5, bold: true, color: PALE, track: 1 });
      doc.texte(cases[i].v, cx + 12, doc.y + 34, { size: 13, bold: true, color: cases[i].rouge ? ROUGE : NOIR });
    }
    doc.y += hc + 26;

    /* --- Detail module par module --- */
    doc.texte(L.detail || 'DETAIL PAR MODULE', MG, doc.y, { size: 8.5, bold: true, color: ROUGE, track: 1.4 });
    doc.y += 12;

    var cScore = MG + 284, cLues = MG + 366, cLect = MG + 440, cQuiz = COL_R - 6;
    function entete() {
      doc.filet(MG, doc.y, COL_R, 0.8, NOIR);
      doc.y += 13;
      doc.texte(L.colModule || 'Module', MG, doc.y, { size: 7.5, bold: true, color: GRIS, track: .8 });
      doc.texte(L.colScore || 'Score', cScore, doc.y, { size: 7.5, bold: true, color: GRIS, align: 'right', track: .8 });
      doc.texte(L.colLues || 'Lecons lues', cLues, doc.y, { size: 7.5, bold: true, color: GRIS, align: 'right', track: .8 });
      doc.texte(L.colLecture || 'Lecture', cLect, doc.y, { size: 7.5, bold: true, color: GRIS, align: 'right', track: .8 });
      doc.texte(L.colQuiz || 'Quiz', cQuiz, doc.y, { size: 7.5, bold: true, color: GRIS, align: 'right', track: .8 });
      doc.y += 6;
      doc.filet(MG, doc.y, COL_R, 0.8, TRAIT);
    }
    entete();

    var mods = d.modules || [];
    for (var m = 0; m < mods.length; m++) {
      var r = mods[m];
      if (doc.place(30)) { doc.y = MG; entete(); }
      var h = 22;
      if (m % 2 === 1) doc.bloc(MG, doc.y, largeur, h, FOND);
      var base = doc.y + 14.5;
      var titre = r.num + '  ' + r.title;
      var maxi = 232;
      while (larg(titre, 9, false) > maxi && titre.length > 6) titre = titre.slice(0, -2) + '…';
      doc.texte(titre, MG + 6, base, { size: 9 });
      doc.texte(r.score, cScore, base, { size: 9, bold: true, color: r.passed ? VERT : ROUGE, align: 'right' });
      doc.texte(r.lues, cLues, base, { size: 9, color: r.allRead ? NOIR : ROUGE, align: 'right' });
      doc.texte(r.lecture, cLect, base, { size: 9, color: GRIS, align: 'right' });
      doc.texte(r.quiz, cQuiz, base, { size: 9, color: GRIS, align: 'right' });
      doc.y += h;
    }

    /* Ligne de total */
    doc.filet(MG, doc.y, COL_R, 0.8, NOIR);
    var tot = d.totaux || {};
    doc.y += 1;
    doc.bloc(MG, doc.y, largeur, 24, [0.93, 0.925, 0.91]);
    var by = doc.y + 16;
    doc.texte(L.total || 'TOTAL', MG + 6, by, { size: 8.5, bold: true, color: NOIR, track: .8 });
    doc.texte(tot.score || '', cScore, by, { size: 9.5, bold: true, color: ROUGE, align: 'right' });
    doc.texte(tot.lues || '', cLues, by, { size: 9.5, bold: true, align: 'right' });
    doc.texte(tot.lecture || '', cLect, by, { size: 9.5, bold: true, align: 'right' });
    doc.texte(tot.quiz || '', cQuiz, by, { size: 9.5, bold: true, align: 'right' });
    doc.y += 24 + 22;

    /* --- Signature et date --- */
    doc.place(120);
    var colL = largeur * 0.56;
    doc.texte(L.signature || 'SIGNATURE DE L\'OPERATEUR', MG, doc.y, { size: 7.5, bold: true, color: PALE, track: 1 });
    doc.texte(L.dateLabel || 'DATE DE DELIVRANCE', MG + colL, doc.y, { size: 7.5, bold: true, color: PALE, track: 1 });
    doc.y += 8;
    doc.signature(d.strokes, MG, doc.y, colL - 30, 58, d.sigW || 600, d.sigH || 200);
    doc.texte(d.date || '', MG + colL, doc.y + 24, { size: 12, bold: true });
    doc.texte(d.heure || '', MG + colL, doc.y + 40, { size: 9, color: GRIS });
    doc.y += 58;
    doc.filet(MG, doc.y, MG + colL - 30, 0.8, NOIR);
    doc.filet(MG + colL, doc.y, COL_R, 0.8, NOIR);
    doc.y += 12;
    doc.texte(d.name || '', MG, doc.y, { size: 8.5, color: GRIS });
    doc.texte(L.registre || '', MG + colL, doc.y, { size: 8.5, color: GRIS });

    /* --- Remarques : ce qu'il faut savoir pour lire ce document --- */
    var notes = d.notes || [];
    if (notes.length) {
      doc.y += 30;
      doc.place(40 + notes.length * 16);
      doc.filet(MG, doc.y, COL_R, 0.8, TRAIT);
      doc.y += 16;
      doc.texte(L.remarques || 'REMARQUES', MG, doc.y, { size: 7.5, bold: true, color: PALE, track: 1 });
      doc.y += 14;
      for (var q = 0; q < notes.length; q++) {
        doc.texte('\u2022', MG, doc.y + 7, { size: 9, color: ROUGE });
        doc.y += doc.para(notes[q], MG + 12, doc.y, largeur - 12, { size: 8.5, leading: 12, color: GRIS }) + 5;
      }
    }

    /* --- Pied de page sur chaque page --- */
    var nb = doc.pages.length;
    for (var p = 0; p < nb; p++) {
      doc.flux = doc.pages[p];
      doc.filet(MG, PAGE_H - 40, COL_R, 0.8, TRAIT);
      doc.texte(d.pied || '', MG, PAGE_H - 28, { size: 7.5, color: PALE });
      doc.texte((L.page || 'Page') + ' ' + (p + 1) + '/' + nb, COL_R, PAGE_H - 28, { size: 7.5, color: PALE, align: 'right' });
    }

    return doc.rendu(L.titre || 'Attestation de formation', d.name || '');
  }

  global.RodbotPdf = { attestation: attestation, _larg: larg, _esc: esc };
})(typeof window !== 'undefined' ? window : this);
