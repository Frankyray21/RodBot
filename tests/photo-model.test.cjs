const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const assets = path.join(__dirname, '../3d/assets');
const assetSource = fs.readFileSync(path.join(__dirname, '../3d/js/model-assets.js'), 'utf8');
const modelFile = assetSource.match(/MODEL_URL = new URL\('\.\.\/assets\/([^']+)'/)[1];
const model = JSON.parse(fs.readFileSync(path.join(assets, modelFile)));
const nodes = Object.fromEntries(model.nodes.map(n => [n.name, n]));
const buffers = model.buffers.map(b => b.uri.startsWith('data:')
  ? Buffer.from(b.uri.split(',')[1], 'base64') : fs.readFileSync(path.join(assets, b.uri)));
const multiply = ([x,y,z,w], [X,Y,Z,W]) => [w*X+x*W+y*Z-z*Y,w*Y-x*Z+y*W+z*X,w*Z+x*Y-y*X+z*W,w*W-x*X-y*Y-z*Z];
const rotate = (q,v) => multiply(multiply(q,[...v,0]),[-q[0],-q[1],-q[2],q[3]]).slice(0,3);
const add = (a,b) => a.map((v,i) => v+b[i]);
const distance = (a,b) => Math.hypot(...a.map((v,i) => v-b[i]));
function samples(index) {
  const a = model.accessors[index], v = model.bufferViews[a.bufferView];
  const width = {SCALAR:1,VEC3:3,VEC4:4}[a.type];
  return Array.from({length:a.count}, (_,i) => Array.from({length:width}, (_,k) =>
    buffers[v.buffer].readFloatLE((v.byteOffset||0)+(a.byteOffset||0)+(i*width+k)*4)));
}
test('photo model external geometry and every buffer view resolve completely', () => {
  model.buffers.forEach((b,i) => assert.equal(buffers[i].length,b.byteLength));
  for (const v of model.bufferViews) assert.ok((v.byteOffset||0)+v.byteLength<=buffers[v.buffer].length);
  assert.equal(model.animations.length,36);
});
test('lift cylinder stays connected at every corrected arm keyframe', () => {
  const animation = model.animations.find(a => a.name==='Elevation_bras');
  const tracks = Object.fromEntries(animation.channels.map(c => [model.nodes[c.target.node].name,
    samples(animation.samplers[c.sampler].output)]));
  const barrel = nodes.HYD_LIFT_ROD.translation[1];
  const p = model.meshes[nodes.MESH_LIFT_ROD_130.mesh].primitives[0];
  const a = model.accessors[p.attributes.POSITION], rod = a.max[1]-a.min[1];
  tracks.CTRL_SHOULDER_Y.forEach((rotation,i) => {
    const end = add(nodes.CTRL_SHOULDER_Y.translation,rotate(rotation,nodes.HYD_LIFT_TIP.translation));
    const cylinder = add(nodes.HYD_LIFT_BASE.translation,
      rotate(tracks.HYD_LIFT_BASE[i],[0,barrel+rod*tracks.HYD_LIFT_ROD[i][1],0]));
    assert.ok(distance(end,cylinder)<.000002,'hydraulic attachment at key '+i);
  });
});
test('initial gripper stays vertical after mast correction', () => {
  const q = multiply(nodes.CTRL_SHOULDER_Y.rotation,nodes.CTRL_WRIST_Y.rotation);
  assert.ok(distance(rotate(q,[0,-1,0]),[0,-1,0])<.000001);
});
test('all seven rod assemblies fit the documented 6 foot length', () => {
  for (let i=1;i<=7;i++) {
    const n = nodes['PROP_ROD_'+String(i).padStart(2,'0')];
    const bounds = n.children.flatMap(c => model.meshes[model.nodes[c].mesh].primitives
      .map(p => model.accessors[p.attributes.POSITION]));
    const length = (Math.max(...bounds.map(a=>a.max[0]))-Math.min(...bounds.map(a=>a.min[0])))*n.scale[0];
    assert.ok(Math.abs(length-1.8288)<.000001);
  }
});
