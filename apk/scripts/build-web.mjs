#!/usr/bin/env node
/* Assemble le site (racine du dépôt) dans apk/dist/ pour l'enveloppe Android.
   Tout le contenu de formation est copié : images du manuel, PDF, modèle 3D.
   Sont exclus : le code de l'APK lui-même, le Worker Cloudflare, les tests,
   la documentation du dépôt et les fichiers Git. */
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';

const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, '..', '..');
const dist = join(ici, '..', 'dist');

const EXCLUS = new Set(['.git', '.github', 'apk', 'worker', 'tests', 'node_modules', '.nojekyll', 'CLAUDE.md']);
const EXCLURE_EXT = new Set(['.md']);

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

let fichiers = 0, octets = 0;
function copier(src, dst) {
  for (const nom of readdirSync(src)) {
    const chemin = join(src, nom);
    const rel = relative(racine, chemin).split(sep).join('/');
    if (EXCLUS.has(nom) && dirname(chemin) === racine) continue;
    const st = statSync(chemin);
    if (st.isDirectory()) { mkdirSync(join(dst, nom), { recursive: true }); copier(chemin, join(dst, nom)); continue; }
    if (EXCLURE_EXT.has(nom.slice(nom.lastIndexOf('.')).toLowerCase())) continue;
    cpSync(chemin, join(dst, nom));
    fichiers++; octets += st.size;
  }
}
copier(racine, dist);

/* Pont natif : greffons Capacitor (Filesystem, FileOpener) regroupés en un fichier,
   chargé avant app.js. Sans lui, window.Capacitor.Plugins reste vide dans l'APK. */
buildSync({
  entryPoints: [join(ici, '..', 'natif', 'index.js')],
  bundle: true, format: 'iife', platform: 'browser', target: 'chrome90', minify: true,
  outfile: join(dist, 'apk-natif.js'), logLevel: 'warning',
});
const indexApk = readFileSync(join(dist, 'index.html'), 'utf8');
if (!indexApk.includes('<script src="app.js')) throw new Error('index.html : balise app.js introuvable');
writeFileSync(join(dist, 'index.html'), indexApk.replace('<script src="app.js', '<script src="apk-natif.js"></script>\n<script src="app.js'));

/* Le service worker n'a aucun rôle dans l'APK : tout est déjà local.
   On le retire du paquet pour qu'aucune ancienne copie ne s'enregistre. */
rmSync(join(dist, 'sw.js'), { force: true });

const appJs = readFileSync(join(racine, 'app.js'), 'utf8');
const version = (appJs.match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1] || '0.0.0';
writeFileSync(join(dist, 'apk-version.json'), JSON.stringify({ version, date: new Date().toISOString().slice(0, 10) }) + '\n');

/* Version Android : 1.88.0 -> versionName "1.88.0", versionCode 1088000.
   Android n'accepte une mise à jour que si versionCode augmente : mille valeurs
   par composant, l'ordre reste juste même après 1.88.999. */
const [maj, min, cor] = version.split('.').map((n) => Math.min(999, parseInt(n, 10) || 0));
const versionCode = maj * 1000000 + min * 1000 + cor;
writeFileSync(join(ici, '..', 'android', 'app', 'version.properties'),
  '# Écrit par scripts/build-web.mjs à partir de APP_VERSION (app.js). Ne pas modifier à la main.\n' +
  'versionName=' + version + '\nversionCode=' + versionCode + '\n');

console.log(`dist/ : ${fichiers} fichiers, ${(octets / 1048576).toFixed(1)} Mo, version ${version} (versionCode ${versionCode})`);
