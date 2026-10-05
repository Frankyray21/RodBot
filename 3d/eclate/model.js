/* RodBot LP : construction du modèle neuf (vue éclatée et atelier 3D).
 * Charge les ensembles de asm/, rattache les éléments marqués attachTo (boyaux) à leur
 * ensemble, retire les ensembles de 1er niveau vides, puis fusionne par matériau (kit.finalize).
 */
import * as THREE from 'three';
import { finalize } from './kit.js';
import { ASSEMBLIES } from './asm/index.js';

const isNode = (o) => o && o.userData && (o.userData.type === 'asm' || o.userData.type === 'part');

export async function buildModel({ only = null, onProgress = () => {} } = {}) {
  const root = new THREE.Group(); root.name = 'rodbot';
  const missing = [];
  const LIST = only || ASSEMBLIES;
  for (let i = 0; i < LIST.length; i++) {
    onProgress(i / (LIST.length + 1), i + 1, LIST.length);
    await new Promise(r => setTimeout(r, 0));
    try {
      const mod = await import(`./asm/${LIST[i]}.js`);
      [].concat(mod.build()).forEach(o => root.add(o));
    } catch (e) { console.error('Ensemble', LIST[i], e); missing.push(LIST[i]); }
  }
  onProgress(LIST.length / (LIST.length + 1), LIST.length, LIST.length);
  await new Promise(r => setTimeout(r, 0));
  // boyaux et autres éléments rattachés à un ensemble existant (userData.attachTo) : ils le suivent à l'éclatement
  root.updateMatrixWorld(true);
  const byId = new Map(); root.traverse(o => { if (isNode(o) && o.userData.id) byId.set(o.userData.id, o); });
  const hasAttachedAncestor = (o) => { for (let p = o.parent; p; p = p.parent) if (isNode(p) && p.userData.attachTo) return true; return false; };
  const toAttach = []; root.traverse(o => { if (isNode(o) && o.userData.attachTo && byId.has(o.userData.attachTo) && !hasAttachedAncestor(o)) toAttach.push(o); });
  toAttach.forEach(o => byId.get(o.userData.attachTo).attach(o));
  // retirer les ensembles de 1er niveau devenus vides
  root.children.slice().forEach(c => { let has = false; c.traverse(o => { if (o.isMesh) has = true; }); if (!has) root.remove(c); });
  const stats = finalize(root);
  root.updateMatrixWorld(true);
  return { root, stats, missing };
}
