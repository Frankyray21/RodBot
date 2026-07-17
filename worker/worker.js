/* ─────────────────────────────────────────────────────────────────────────
   Worker Cloudflare · Attestations RodBot (web)
   ---------------------------------------------------------------------------
   Reçoit les attestations de la formation RodBot LP complétées sur le site
   (8 modules validés à 70 % minimum) et les enregistre automatiquement dans
   Airtable. Relie chaque attestation au bon employé, exactement comme les
   Workers « attestations-tms » et « attestations-procedures ».

   • Base Airtable   : « Formations »                        → appmq82YjvEUglYZU
   • Table attest.   : « Attestations RodBot (web) »         → tbla1k6GBJMr2afmH
   • Liste employés  : « Liste employé (registre formation) »→ tbllKuNePDWZMr1cz

   SECRET REQUIS (Cloudflare → Settings → Variables and Secrets) :
   • AIRTABLE_TOKEN  = jeton d'accès personnel Airtable, avec
                       data.records:read + data.records:write et l'accès à la
                       base « Formations ».
                       (Le jeton des Workers attestations-tms / procédures
                       convient tel quel.)

   ENDPOINTS :
   • GET  /?q=<texte>       → recherche d'employés (autocomplétion).
                              Renvoie { ok:true, results:[{ id, name }, ...] }
   • GET  /?roster=1        → annuaire complet (autocomplétion hors-ligne).
   • GET  /?progress=<nom>  → progression sauvegardée de ce nom (correspondance
                              EXACTE, casse/accents ignorés), pour restaurer sur
                              un nouvel appareil / appareil partagé. Renvoie
                              { ok:true, progress:{...}|null }.
   • GET  /?hist=<nom>      → historique des attestations de ce nom (page « Mon
                              suivi » du site). Correspondance EXACTE. Renvoie
                              { ok:true, results:[{ module, date, score }, ...],
                              progress:{...}|null } — volontairement minimal :
                              PAS de champs de temps (réservés aux gestionnaires).
   • GET  /                 → page d'état { ok:true, service:"attestations-rodbot" }
   • POST / (type:"progress") → sauvegarde la progression (meilleurs scores de
       quiz par module) dans le dossier employé, champ « Progression RodBot
       (web) ». Corps JSON :
       { "type":"progress", "name":"Prénom Nom",
         "data":{ "v":1, "pq":{ "0":{ "s":90, "done":true }, ... } } }
       Renvoie { ok:true, linked:bool } — linked=false si le nom ne correspond
       à aucun employé (rien n'est stocké, le site garde sa copie locale).
   • POST / (type:"feedback") → retour sur une question de quiz (site bêta).
       Nom FACULTATIF. Corps JSON :
       { "type":"feedback", "vote":"up"|"down", "question":"M02 Q3",
         "module":"02 · Travailler en sécurité", "questionText":"...",
         "comment":"...(opt)", "name":"...(opt)", "langue":"Français"|"English",
         "version":"1.9.x", "date":"AAAA-MM-JJ" }
       Renvoie { ok:true, id:"rec..." }.
   • POST /            → enregistre une attestation. Corps JSON :
       { "name":"Prénom Nom", "employeeId":"rec...(opt)",
         "module":"01 · Connaître le RodBot" | "Formation complète (8/8)",
         "score":"92 %", "modules":"01 : 100 %\n02 : 80 %\n...",
         "date":"AAAA-MM-JJ", "langue":"Français"|"English",
         "version":"1.9.2",
         "moduleTime":"5 min 20 s", "quizTime":"2 min 10 s" (opt, texte),
         "moduleSeconds":320, "quizSeconds":130 (opt, nombres) }
     Une attestation est envoyée APRÈS CHAQUE QUIZ (réussi ou non, une par
     module), puis une attestation « Formation complète (8/8) » à la toute fin.
     Les temps sont mesurés côté site (temps actif, écran visible) : suivi
     gestionnaire, jamais affiché au travailleur.
   ───────────────────────────────────────────────────────────────────────── */

const AIRTABLE_BASE  = "appmq82YjvEUglYZU";   // base « Formations »
const AIRTABLE_TABLE = "tbla1k6GBJMr2afmH";   // table « Attestations RodBot (web) »
/* Retours des travailleurs sur la qualité des questions de quiz (site en bêta) :
   pouce en haut / en bas + commentaire facultatif. */
const FEEDBACK_TABLE = "tblPs9xH5266kJej8";   // « Retours quiz RodBot (web) »

/* Liste des employés, pour relier l'attestation au bon dossier. */
const EMP_TABLE      = "tbllKuNePDWZMr1cz";   // « Liste employé (registre formation) »
const EMP_NAME_FIELD = "Name";                // champ principal = nom complet
/* Progression du site (meilleurs scores de quiz par module), sauvegardée sur
   le dossier de l'employé pour être restaurée sur un nouvel appareil / un
   appareil partagé. Même mécanique que le site Procédures de forage. */
const PROG_FIELD     = "Progression RodBot (web)";

/* Origines autorisées à appeler le Worker depuis un navigateur (CORS). */
const ALLOWED_ORIGINS = [
  "https://frankyray21.github.io",
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method === "GET") {
      const url = new URL(request.url);
      if (url.searchParams.has("q")) {
        return searchEmployees(url.searchParams.get("q") || "", env, cors);
      }
      if (url.searchParams.has("roster")) {
        return listRoster(env, cors);
      }
      if (url.searchParams.has("progress")) {
        return getProgress(url.searchParams.get("progress") || "", env, cors);
      }
      if (url.searchParams.has("hist")) {
        return listAttestations(url.searchParams.get("hist") || "", env, cors);
      }
      return json({ ok: true, service: "attestations-rodbot" }, 200, cors);
    }

    if (request.method !== "POST") {
      return json({ ok: false, error: "Méthode non autorisée." }, 405, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch (_) {
      return json({ ok: false, error: "Corps JSON invalide." }, 400, cors);
    }

    // Retour sur une question de quiz (le nom est FACULTATIF : traité d'abord).
    if (body.type === "feedback") {
      return saveFeedback(body, env, cors);
    }

    const name = clean(body.name, 120);
    if (!name) {
      return json({ ok: false, error: "Nom manquant." }, 400, cors);
    }

    // Sauvegarde de progression (pas une attestation).
    if (body.type === "progress") {
      return saveProgress(name, body.data, env, cors);
    }

    const score   = clean(body.score, 40);       // ex. « 92 % »
    const moduleLabel = clean(body.module, 120); // ex. « 02 · Travailler en sécurité »
    const modules = clean(body.modules, 1200);   // détail par module
    const moduleTime = clean(body.moduleTime, 40);   // ex. « 5 min 20 s »
    const quizTime   = clean(body.quizTime, 40);     // ex. « 2 min 10 s »
    const moduleSeconds = validSeconds(body.moduleSeconds);
    const quizSeconds   = validSeconds(body.quizSeconds);
    const date    = isoDate(body.date);
    const langue  = clean(body.langue, 20);      // « Français » / « English »
    const version = clean(body.version, 20);
    let empId = validRecId(body.employeeId);

    if (!env.AIRTABLE_TOKEN) {
      return json(
        { ok: false, error: "AIRTABLE_TOKEN non configuré sur le Worker." },
        500, cors
      );
    }

    // Repli : correspondance EXACTE du nom (casse/accents ignorés) si aucun
    // employé n'a été choisi explicitement dans les suggestions.
    if (!empId) empId = await findEmployeeByName(name, env);

    const fields = {
      "Nom": name,
      "Formation": "Formation RodBot LP",
      "Date": date,
      "Source": "site formation RodBot",
      "Statut": empId ? "Reçu" : "À relier",
    };
    if (moduleLabel) fields["Module"] = moduleLabel;
    if (score)   fields["Score global"] = score;
    if (modules) fields["Détail modules"] = modules;
    if (moduleTime)     fields["Temps sur le module"] = moduleTime;
    if (quizTime)       fields["Temps sur le quiz"] = quizTime;
    if (moduleSeconds != null) fields["Secondes module"] = moduleSeconds;
    if (quizSeconds != null)   fields["Secondes quiz"] = quizSeconds;
    if (langue)  fields["Langue"] = langue;
    if (version) fields["Version app"] = version;
    if (empId)   fields["Employé"] = [empId];

    let at = await postRecord(fields, env);
    if (!at) {
      return json({ ok: false, error: "Airtable injoignable." }, 502, cors);
    }
    if (!at.ok) {
      const detail = await at.text();
      return json(
        { ok: false, error: "Airtable a refusé l'enregistrement.", detail },
        502, cors
      );
    }

    const rec = await at.json();
    return json({ ok: true, id: rec.id, linked: !!empId }, 200, cors);
  },
};

/* POST d'un enregistrement dans la table « Attestations RodBot (web) ». */
async function postRecord(fields, env) {
  try {
    return await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.AIRTABLE_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fields, typecast: true }),
      }
    );
  } catch (e) {
    return null;
  }
}

/* ── recherche d'employés (autocomplétion, insensible casse + accents) ───── */
async function searchEmployees(q, env, cors) {
  const term = deburr(clean(q, 50).toLowerCase());
  if (term.length < 2) return json({ ok: true, results: [] }, 200, cors);
  if (!env.AIRTABLE_TOKEN) {
    return json({ ok: false, error: "AIRTABLE_TOKEN non configuré." }, 500, cors);
  }
  const field = stripAccentsFormula(`LOWER({${EMP_NAME_FIELD}})`);
  const safe = term.replace(/["\\]/g, " ");
  const formula = `FIND("${safe}", ${field})`;
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${EMP_TABLE}`
            + `?filterByFormula=${encodeURIComponent(formula)}`
            + `&maxRecords=8&fields%5B%5D=${encodeURIComponent(EMP_NAME_FIELD)}`;
  try {
    const at = await fetch(url, { headers: { "Authorization": `Bearer ${env.AIRTABLE_TOKEN}` } });
    if (!at.ok) return json({ ok: false, error: "Airtable a refusé la recherche." }, 502, cors);
    const data = await at.json();
    const results = (data.records || []).map((r) => ({
      id: r.id,
      name: String(r.fields[EMP_NAME_FIELD] || "").trim(),
    })).filter((r) => r.name);
    return json({ ok: true, results }, 200, cors);
  } catch (e) {
    return json({ ok: false, error: "Airtable injoignable." }, 502, cors);
  }
}

/* ── annuaire complet (autocomplétion hors-ligne, mêmes règles que TMS) ──── */
async function listRoster(env, cors) {
  if (!env.AIRTABLE_TOKEN) {
    return json({ ok: false, error: "AIRTABLE_TOKEN non configuré." }, 500, cors);
  }
  const results = [];
  let offset = "";
  try {
    for (let page = 0; page < 10; page++) {
      const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${EMP_TABLE}`
                + `?pageSize=100&fields%5B%5D=${encodeURIComponent(EMP_NAME_FIELD)}`
                + (offset ? `&offset=${encodeURIComponent(offset)}` : "");
      const at = await fetch(url, { headers: { "Authorization": `Bearer ${env.AIRTABLE_TOKEN}` } });
      if (!at.ok) break;
      const data = await at.json();
      for (const r of (data.records || [])) {
        const name = String(r.fields[EMP_NAME_FIELD] || "").trim();
        if (name) results.push({ id: r.id, name });
      }
      offset = data.offset || "";
      if (!offset) break;
    }
    return json({ ok: true, results }, 200, cors);
  } catch (e) {
    return json({ ok: false, error: "Airtable injoignable." }, 502, cors);
  }
}

/* ── correspondance exacte d'un nom (repli de liaison) ───────────────────── */
async function findEmployeeByName(name, env) {
  const emp = await findEmployee(name, env, false);
  return (emp && emp.id) || "";
}

/* Comme ci-dessus, mais renvoie { id, progress } — progress (objet ou null)
   n'est lu que si withProgress est vrai. null si aucun employé unique. */
async function findEmployee(name, env, withProgress) {
  const term = deburr(clean(name, 120).toLowerCase()).replace(/["\\]/g, " ").trim();
  if (term.length < 2) return null;
  const field = stripAccentsFormula(`LOWER({${EMP_NAME_FIELD}})`);
  const formula = `TRIM(${field})="${term}"`;
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${EMP_TABLE}`
            + `?filterByFormula=${encodeURIComponent(formula)}`
            + `&maxRecords=2&fields%5B%5D=${encodeURIComponent(EMP_NAME_FIELD)}`
            + (withProgress ? `&fields%5B%5D=${encodeURIComponent(PROG_FIELD)}` : "");
  try {
    const at = await fetch(url, { headers: { "Authorization": `Bearer ${env.AIRTABLE_TOKEN}` } });
    if (!at.ok) return null;
    const data = await at.json();
    const recs = data.records || [];
    if (recs.length !== 1) return null;
    let progress = null;
    if (withProgress) {
      try { progress = sanitizeProgress(JSON.parse(recs[0].fields[PROG_FIELD] || "")); } catch (e) {}
    }
    return { id: recs[0].id, progress };
  } catch (e) {
    return null;
  }
}

/* ── historique des attestations d'un nom (page « Mon suivi » du site) ──────
   Correspondance EXACTE du nom (casse/accents ignorés). Ne renvoie JAMAIS les
   champs de temps (« Temps sur le module », etc.) : réservés aux gestionnaires. */
async function listAttestations(name, env, cors) {
  const term = deburr(clean(name, 120).toLowerCase()).replace(/["\\]/g, " ").trim();
  if (term.length < 2) return json({ ok: true, results: [] }, 200, cors);
  if (!env.AIRTABLE_TOKEN) {
    return json({ ok: false, error: "AIRTABLE_TOKEN non configuré." }, 500, cors);
  }
  const field = stripAccentsFormula(`LOWER({Nom})`);
  const formula = `TRIM(${field})="${term}"`;
  const wanted = ["Module", "Date", "Score global"];
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}`
            + `?filterByFormula=${encodeURIComponent(formula)}`
            + `&maxRecords=100`
            + `&sort%5B0%5D%5Bfield%5D=Date&sort%5B0%5D%5Bdirection%5D=desc`
            + wanted.map((f) => `&fields%5B%5D=${encodeURIComponent(f)}`).join("");
  let at, emp;
  try {
    [at, emp] = await Promise.all([
      fetch(url, { headers: { "Authorization": `Bearer ${env.AIRTABLE_TOKEN}` } }),
      findEmployee(name, env, true),
    ]);
  } catch (e) {
    return json({ ok: false, results: [] }, 502, cors);
  }
  if (!at.ok) return json({ ok: false, results: [] }, 200, cors);
  const data = await at.json();
  const results = (data.records || []).map((r) => {
    const f = r.fields || {};
    return {
      module: String(f["Module"] || ""),
      date:   String(f["Date"] || ""),
      score:  String(f["Score global"] || ""),
    };
  }).filter((r) => r.module);
  return json({ ok: true, results, progress: (emp && emp.progress) || null }, 200, cors);
}

/* ── progression (meilleurs scores de quiz par module), pour retrouver son
   avancement sur un nouvel appareil ou un appareil partagé ────────────────── */
async function getProgress(name, env, cors) {
  if (!env.AIRTABLE_TOKEN) {
    return json({ ok: false, error: "AIRTABLE_TOKEN non configuré." }, 500, cors);
  }
  const emp = await findEmployee(name, env, true);
  return json({ ok: true, progress: (emp && emp.progress) || null }, 200, cors);
}

/* Sauvegarde de la progression, écrite sur le dossier de l'employé quand le
   nom correspond EXACTEMENT à un employé — sinon on répond quand même ok:true
   (linked:false) : rien n'est stocké, le site garde sa copie locale. */
async function saveProgress(name, data, env, cors) {
  if (!env.AIRTABLE_TOKEN) {
    return json({ ok: false, error: "AIRTABLE_TOKEN non configuré." }, 500, cors);
  }
  const prog = sanitizeProgress(data);
  if (!prog) return json({ ok: false, error: "Progression invalide." }, 400, cors);
  const emp = await findEmployee(name, env, false);
  if (!emp || !emp.id) return json({ ok: true, linked: false }, 200, cors);
  try {
    const at = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/${EMP_TABLE}/${emp.id}`,
      {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${env.AIRTABLE_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fields: { [PROG_FIELD]: JSON.stringify(prog) } }),
      }
    );
    if (!at.ok) return json({ ok: false, error: "Airtable a refusé la sauvegarde." }, 502, cors);
    return json({ ok: true, linked: true }, 200, cors);
  } catch (e) {
    return json({ ok: false, error: "Airtable injoignable." }, 502, cors);
  }
}

/* Ne garde que la forme attendue : { v:1, pq:{ "0":{ s, done }, ... } } — borné
   (8 modules max, clés "0".."7", score entier 0…100). Renvoie null si le
   corps n'a pas cette forme. */
function sanitizeProgress(data) {
  if (!data || typeof data !== "object" || !data.pq || typeof data.pq !== "object") return null;
  const pq = {};
  for (const key of Object.keys(data.pq)) {
    if (!/^[0-7]$/.test(key)) continue;
    const v = data.pq[key];
    if (!v || typeof v !== "object") continue;
    const s = Math.round(Number(v.s));
    if (!isFinite(s) || s < 0 || s > 100) continue;
    pq[key] = { s, done: !!v.done };
  }
  return { v: 1, pq };
}

/* ── retour sur une question de quiz (site en bêta) ─────────────────────────
   Un pouce en haut / en bas + commentaire facultatif, enregistré dans la table
   « Retours quiz RodBot (web) ». Le nom est facultatif (retour anonyme permis).
   Si les colonnes optionnelles manquent, on réessaie sans elles. */
async function saveFeedback(body, env, cors) {
  if (!env.AIRTABLE_TOKEN) {
    return json({ ok: false, error: "AIRTABLE_TOKEN non configuré." }, 500, cors);
  }
  const vote = clean(body.vote, 10).toLowerCase();
  if (vote !== "up" && vote !== "down") {
    return json({ ok: false, error: "Vote invalide." }, 400, cors);
  }
  const fields = {
    "Question": clean(body.question, 20) || "?",
    "Avis": vote === "up" ? "👍 Utile" : "👎 A revoir",
    "Statut": "Nouveau",
    "Date": isoDate(body.date),
  };
  const comment = clean(body.comment, 2000);
  const moduleLabel = clean(body.module, 120);
  const enonce = clean(body.questionText, 1000);
  const name = clean(body.name, 120);
  const langue = clean(body.langue, 20);
  const version = clean(body.version, 20);
  if (comment)     fields["Commentaire"] = comment;
  if (moduleLabel) fields["Module"] = moduleLabel;
  if (enonce)      fields["Enonce"] = enonce;
  if (name)        fields["Nom"] = name;
  if (langue)      fields["Langue"] = langue;
  if (version)     fields["Version app"] = version;

  try {
    const at = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/${FEEDBACK_TABLE}`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.AIRTABLE_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fields, typecast: true }),
      }
    );
    if (!at.ok) {
      const detail = await at.text();
      return json({ ok: false, error: "Airtable a refusé le retour.", detail }, 502, cors);
    }
    const rec = await at.json();
    return json({ ok: true, id: rec.id }, 200, cors);
  } catch (e) {
    return json({ ok: false, error: "Airtable injoignable." }, 502, cors);
  }
}

/* ── utilitaires (identiques aux autres Workers) ─────────────────────────── */
function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.indexOf(origin) >= 0 ? origin : (origin || "*");
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(obj, status, extra) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extra },
  });
}

function clean(v, max) {
  if (v == null) return "";
  return String(v).trim().slice(0, max);
}

function isoDate(v) {
  const d = v ? new Date(v) : new Date();
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function validRecId(v) {
  return (typeof v === "string" && /^rec[A-Za-z0-9]{14}$/.test(v)) ? v : "";
}

function validSeconds(v) {
  const n = Number(v);
  return (Number.isFinite(n) && n >= 0 && n < 100000000) ? Math.round(n) : null;
}

function deburr(s) {
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function stripAccentsFormula(expr) {
  const map = [
    ["à", "a"], ["â", "a"], ["ä", "a"], ["á", "a"], ["ã", "a"],
    ["é", "e"], ["è", "e"], ["ê", "e"], ["ë", "e"],
    ["î", "i"], ["ï", "i"], ["í", "i"],
    ["ô", "o"], ["ö", "o"], ["ó", "o"], ["õ", "o"],
    ["ù", "u"], ["û", "u"], ["ü", "u"], ["ú", "u"],
    ["ç", "c"], ["ñ", "n"],
  ];
  let f = expr;
  for (const [a, b] of map) f = `SUBSTITUTE(${f},"${a}","${b}")`;
  return f;
}
