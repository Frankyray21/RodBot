/* Pont natif de l'APK : expose les greffons Capacitor à app.js.
   Dans l'application Android, window.Capacitor.Plugins reste vide tant que les
   greffons ne sont pas enregistrés côté JavaScript (registerPlugin). Ce fichier
   est regroupé par esbuild dans dist/apk-natif.js et chargé avant app.js,
   uniquement dans l'APK. Le site web ne le charge jamais. */
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';

window.RodbotNatif = { Filesystem, FileOpener, Directory };
