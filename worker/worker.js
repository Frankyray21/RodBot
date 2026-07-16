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
   • GET  /?q=<texte>  → recherche d'employés (autocomplétion).
                         Renvoie { ok:true, results:[{ id, name }, ...] }
   • GET  /?roster=1   → annuaire complet (autocomplétion hors-ligne).
   • GET  /            → page d'état { ok:true, service:"attestations-rodbot" }
   • POST /            → enregistre une attestation. Corps JSON :
       { "name":"Prénom Nom", "employeeId":"rec...(opt)",
         "score":"92 %", "modules":"01 : 100 %\n02 : 80 %\n...",
         "date":"AAAA-MM-JJ", "langue":"Français"|"English",
         "version":"1.9.0" }
   ───────────────────────────────────────────────────────────────────────── */

const AIRTABLE_BASE  = "appmq82YjvEUglYZU";   // base « Formations »
const AIRTABLE_TABLE = "tbla1k6GBJMr2afmH";   // table « Attestations RodBot (web) »

/* Liste des employés, pour relier l'attestation au bon dossier. */
const EMP_TABLE      = "tbllKuNePDWZMr1cz";   // « Liste employé (registre formation) »
const EMP_NAME_FIELD = "Name";                // champ principal = nom complet

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

    const name = clean(body.name, 120);
    if (!name) {
      return json({ ok: false, error: "Nom manquant." }, 400, cors);
    }

    const score   = clean(body.score, 40);       // ex. « 92 % »
    const modules = clean(body.modules, 1200);   // détail par module
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
    if (score)   fields["Score global"] = score;
    if (modules) fields["Détail modules"] = modules;
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
  const term = deburr(clean(name, 120).toLowerCase()).replace(/["\\]/g, " ").trim();
  if (term.length < 2) return "";
  const field = stripAccentsFormula(`LOWER({${EMP_NAME_FIELD}})`);
  const formula = `TRIM(${field})="${term}"`;
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${EMP_TABLE}`
            + `?filterByFormula=${encodeURIComponent(formula)}`
            + `&maxRecords=2&fields%5B%5D=${encodeURIComponent(EMP_NAME_FIELD)}`;
  try {
    const at = await fetch(url, { headers: { "Authorization": `Bearer ${env.AIRTABLE_TOKEN}` } });
    if (!at.ok) return "";
    const data = await at.json();
    const recs = data.records || [];
    return recs.length === 1 ? recs[0].id : "";
  } catch (e) {
    return "";
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
