/* One-time, guarded migration from v1.100.0. Run from the repository root.
 * Geometry stays reproducible via refine-hydraulic-hoses.cjs.
 */
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root,f),'utf8');
const write = (f,s) => fs.writeFileSync(path.join(root,f),s);
function replace(s, from, to) {
  if (!s.includes(from)) throw Error('Migration anchor missing: '+from.slice(0,120));
  return s.replace(from,to);
}
function patch(f,fn){write(f,fn(read(f)));}
if (!read('app.js').includes("APP_VERSION = '1.100.0'")) throw Error('Expected app v1.100.0; reconcile before applying');
patch('3d/js/viewer-v5.js',s=>{
 s=replace(s,"import { MODEL_URL, ENVIRONMENT_URL, POSTER_URL } from './model-assets.js';", "import { MODEL_URL, ENVIRONMENT_URL, POSTER_URL } from './model-assets.js?v=1.101.0';\nimport { attachPrecisionZoom } from './precision-zoom.js?v=1.101.0';");
 s=replace(s,'let homeTarget = [0, 1.25, 0], loadingReject = null;', 'let homeTarget = [0, 1.25, 0], loadingReject = null, precision = null;');
 s=replace(s,'function flyTo(view = {}, duration = 1100) {','function flyTo(view = {}, duration = 1100) {\n      precision?.cancel();');
 s=replace(s,`      if (!loaded || !Number.isFinite(factor) || factor <= 0) return;
      const current = getView(); interact();
      void flyTo({ ...current, dist: current.dist * factor }, 220);`, `      if (!loaded || !Number.isFinite(factor) || factor <= 0) return;
      precision?.zoomBy(factor);`);
 s=replace(s,"    listen(model, 'wheel', interact, { passive: true });\n",'');
 s=replace(s,`      else if (['+', '=', '-', '_'].includes(event.key)) {
        event.preventDefault(); event.stopPropagation(); zoom(event.key === '-' || event.key === '_' ? 1.2 : 1 / 1.2);
      } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) interact();`, `      else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) interact();`);
 s=replace(s,'const before = getView(); width = box.width; height = box.height;', 'precision?.cancel();\n      const before = getView(); width = box.width; height = box.height;');
 s=replace(s,'model.timeScale = 0; model.interpolationDecay = 50;', `model.timeScale = 0; model.interpolationDecay = 50;
      precision = attachPrecisionZoom(model, { isReady: () => loaded && !destroyed && visible, onInteraction: interact });
      cleanup.push(() => precision.destroy());`);
 return s;
});
patch('3d/js/replique.js',s=>{
 s=replace(s,"from './model-assets.js';","from './model-assets.js?v=1.101.0';\nimport { attachPrecisionZoom } from './precision-zoom.js?v=1.101.0';");
 s=replace(s,"const model = $('viewer');","const model = $('viewer');\nlet precision = null;");
 s=replace(s,'function setView(index) {','function setView(index) {\n  precision?.cancel();');
 s=replace(s,'ModelViewerElement.dracoDecoderLocation = DRACO_URL;',`ModelViewerElement.dracoDecoderLocation = DRACO_URL;
  model.minCameraOrbit = 'auto 5deg 0.35m';
  model.maxCameraOrbit = 'auto 90deg 45m';
  precision = attachPrecisionZoom(model, {
    isReady: () => loaded,
    onInteraction() { if (playing) stop(); activeView = null; refreshState(); }
  });`);
 s=replace(s,"gesture: 'Glisse pour tourner. Pince ou utilise la molette pour zoomer.'", "gesture: 'Clique sur un détail pour le centrer. Maj + molette pour affiner le zoom.'");
 s=replace(s,"gesture: 'Drag to rotate. Pinch or use the scroll wheel to zoom.'", "gesture: 'Click a detail to centre it. Shift + scroll for finer zoom.'");
 return s;
});
patch('3d/js/hero-v6.js',s=>s.replace("from './model-assets.js';","from './model-assets.js?v=1.101.0';"));
patch('scene3d.js',s=>s.replaceAll('rodbot-v10-mast-details.gltf','rodbot-v11-hydraulics.gltf').replaceAll('rodbot-v10-mast-poster.jpg','rodbot-v11-hydraulics-poster.jpg'));
patch('3d/js/model-assets.js',s=>replace(s,'rodbot-v10-mast-details.gltf','rodbot-v11-hydraulics.gltf'));
patch('3d/index.html',s=>{
 s=replace(s,'v.zoom(1 / 1.22)','v.zoom(1 / 1.08)');s=replace(s,'v.zoom(1.22)','v.zoom(1.08)');
 return replace(s,'Glisse pour tourner. Pince pour zoomer. Au clavier : flèches, +, − et Origine.', 'Glisse pour tourner. Clique sur un détail pour le centrer. Maj + molette pour affiner le zoom.');
});
patch('sw.js',s=>{
 s=replace(s,"'./3d/js/model-assets.js',", "'./3d/js/model-assets.js', './3d/js/precision-zoom.js',");
 return replace(s,"'./3d/assets/rodbot-v10-mast-details.gltf'", "'./3d/assets/rodbot-v11-hydraulics.gltf', './3d/assets/rodbot-v11-hydraulics.bin'");
});
// Keep the displayed release, direct page imports and installed/offline shell aligned.
for (const f of ['app.js','index.html','sw.js','3d/index.html','3d/replique.html','3d/fidelite.html']) {
 patch(f,s=>s.replaceAll('1.100.0','1.101.0').replaceAll('?v=1.95.0','?v=1.101.0'));
}
// A new poster filename prevents the stable asset cache serving the old hoses.
for(const f of ['3d/index.html','3d/replique.html','3d/fidelite.html','3d/js/model-assets.js','sw.js']) {
 patch(f,s=>s.replaceAll('rodbot-v10-mast-poster.jpg','rodbot-v11-hydraulics-poster.jpg'));
}
// Replaced by the actual V11 browser render before publication.
fs.copyFileSync(path.join(root,'3d/assets/rodbot-v10-mast-poster.jpg'),path.join(root,'3d/assets/rodbot-v11-hydraulics-poster.jpg'));
patch('tests/viewer-v5.test.cjs',s=>{
 s=replace(s,"const source = readFileSync(path, 'utf8')", "const source = readFileSync(path, 'utf8')\n  .replace(/\\?v=\\d+\\.\\d+\\.\\d+/g, '')\n  .replace(/^import .*from '\\.\\/precision-zoom\\.js';\\n/m, '')");
 s=replace(s,"vm.runInContext(motion + '\\n' + source", "vm.runInContext(readFileSync(join(__dirname, '..', '3d', 'js', 'precision-zoom.js'), 'utf8').replaceAll('export ', '') + '\\n' + motion + '\\n' + source");
 return s;
});
patch('tests/component-popup.test.cjs',s=>s.replaceAll('1\\.100\\.0','1\\.101\\.0'));
cp.execFileSync(process.execPath,[path.join(__dirname,'refine-hydraulic-hoses.cjs')],{cwd:root,stdio:'inherit'});
console.log('Migration v1.101.0 applied. Run all tests and browser validation before publishing.');
