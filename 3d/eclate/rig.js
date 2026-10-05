/* RodBot LP : articulations du modèle neuf (atelier 3D).
 * Les ensembles décrivent leurs articulations dans leurs métadonnées (userData) :
 *   joint / joints : { id, type: 'rot' | 'slide', pivot, axis, scale, drive, parent }
 *     pivot et axis dans le repère local du nœud qui les porte.
 *     rot : angle = valeur x scale (degrés). slide : déplacement = valeur x scale (mètres).
 *     drive : canal qui pilote l'articulation (par défaut son id). Plusieurs articulations
 *     peuvent partager un canal (les deux mâchoires, les quatre stabilisateurs).
 *     parent : articulation porteuse (par défaut celle dont le nœud fait partie).
 *   rig : 'id' : le nœud suit l'articulation id (sinon il suit celle de son parent).
 *   cyl : { end, A, B, rod } : vérin. Le fût pivote autour de A pour viser B, qui suit
 *     l'articulation end ; le segment rod (kit.seg) coulisse pour garder la longueur.
 * Au repos, toutes les articulations ont la rotation identité : leurs axes sont exprimés
 * dans le repère du monde, ce qui reste vrai dans le repère de leur articulation parente.
 * La vue éclatée n'utilise pas ce module : le rig réorganise l'arbre des nœuds.
 */
import * as THREE from 'three';

const DEG = Math.PI / 180;
const isNode = (o) => o.userData && (o.userData.type === 'asm' || o.userData.type === 'part' || o.userData.type === 'seg');
const v3 = (a, d = [0, 0, 0]) => new THREE.Vector3(...(a || d));

export function buildRig(root) {
  root.updateMatrixWorld(true);
  const defs = new Map();      // id -> articulation
  const attach = [];           // [nœud, id] aux frontières d'articulation
  const cyls = [];
  const findSeg = (o, name) => { let hit = null; o.traverse(c => { if (!hit && c !== o && c.userData && c.userData.type === 'seg' && c.userData.seg === name) hit = c; }); return hit; };

  const walk = (o, cur) => {
    let mine = cur;
    const u = o.userData || {};
    if (isNode(o)) {
      const list = u.joints || (u.joint ? [u.joint] : []);
      let parent = u.rig || cur;
      for (const j of list) {
        const pivotW = o.localToWorld(v3(j.pivot));
        const axisW = v3(j.axis, [0, 1, 0]).transformDirection(o.matrixWorld);
        const prev = defs.get(j.id);
        const d = prev || { id: j.id, type: j.type || 'rot', pivotW, axisW, scale: j.scale ?? 1, drive: j.drive || j.id, parent: j.parent || parent || null, value: 0 };
        if (!prev) defs.set(j.id, d);
        parent = j.id;
      }
      if (u.rig) mine = u.rig; else if (list.length) mine = list[list.length - 1].id;
      if (u.cyl) {
        const id = 'cyl:' + (u.id || o.uuid);
        const A = o.localToWorld(v3(u.cyl.A)), B = o.localToWorld(v3(u.cyl.B));
        defs.set(id, { id, type: 'aim', pivotW: A, B0: B, end: u.cyl.end, parent: mine, rodName: u.cyl.rod || 'rod', node: o, value: 0 });
        mine = id;
      }
      if (mine !== cur) attach.push([o, mine]);
    }
    for (const c of o.children.slice()) walk(c, mine);
  };
  walk(root, null);

  // groupes d'articulation, parents d'abord
  const groups = new Map();
  const make = (id) => {
    if (groups.has(id)) return groups.get(id);
    const d = defs.get(id); if (!d) throw new Error('Articulation inconnue : ' + id);
    const parent = d.parent ? make(d.parent) : root;
    const g = new THREE.Group(); g.name = 'joint:' + id;
    parent.updateMatrixWorld(true);
    parent.add(g); g.position.copy(parent.worldToLocal(d.pivotW.clone()));
    g.updateMatrixWorld(true);
    d.group = g; d.rest = g.position.clone(); groups.set(id, g);
    return g;
  };
  for (const id of defs.keys()) make(id);
  for (const [o, id] of attach) groups.get(id).attach(o);
  root.updateMatrixWorld(true);

  // vérins : tige et point visé, au repos
  for (const d of defs.values()) {
    if (d.type !== 'aim') continue;
    const end = d.end ? groups.get(d.end) : root;
    if (!end) throw new Error('Articulation de bout de vérin inconnue : ' + d.end);
    d.endGroup = end; d.Bend = end.worldToLocal(d.B0.clone());
    d.dir0 = d.B0.clone().sub(d.pivotW); d.len0 = d.dir0.length(); d.dir0.normalize();
    d.rod = findSeg(d.node, d.rodName);
    if (d.rod) {
      d.rodRest = d.rod.position.clone();
      const inv = new THREE.Matrix4().copy(d.rod.parent.matrixWorld).invert();
      d.rodDir = d.dir0.clone().transformDirection(inv);
    }
    cyls.push(d);
  }

  const byDrive = new Map();
  for (const d of defs.values()) if (d.type !== 'aim') { if (!byDrive.has(d.drive)) byDrive.set(d.drive, []); byDrive.get(d.drive).push(d); }
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), q = new THREE.Quaternion();

  function set(drive, value) {
    const list = byDrive.get(drive); if (!list) return false;
    for (const d of list) d.value = value;
    return true;
  }
  function update() {
    for (const d of defs.values()) {
      if (d.type === 'rot') d.group.quaternion.setFromAxisAngle(d.axisW, d.value * d.scale * DEG);
      else if (d.type === 'slide') d.group.position.copy(d.rest).addScaledVector(d.axisW, d.value * d.scale);
    }
    root.updateMatrixWorld(true);
    for (const d of cyls) {
      const g = d.group, par = g.parent;
      tmpB.copy(d.Bend); d.endGroup.localToWorld(tmpB); par.worldToLocal(tmpB);   // B dans le repère du parent
      tmpA.copy(tmpB).sub(g.position); const len = tmpA.length(); tmpA.normalize();
      g.quaternion.copy(q.setFromUnitVectors(d.dir0, tmpA));
      if (d.rod) d.rod.position.copy(d.rodRest).addScaledVector(d.rodDir, len - d.len0);
    }
    root.updateMatrixWorld(true);
  }
  return {
    set, update,
    drives: () => [...byDrive.keys()],
    has: (drive) => byDrive.has(drive),
    get: (drive) => byDrive.get(drive)?.[0]?.value ?? 0,
    joints: () => [...defs.values()].map(d => ({ id: d.id, type: d.type, drive: d.drive, parent: d.parent })),
  };
}
