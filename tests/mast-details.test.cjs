const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'../3d/assets');
const previous=JSON.parse(fs.readFileSync(path.join(root,'rodbot-v9-rear.gltf')));
const model=JSON.parse(fs.readFileSync(path.join(root,'rodbot-v10-mast-details.gltf')));
const buffers=model.buffers.map(b=>b.uri.startsWith('data:')?Buffer.from(b.uri.split(',')[1],'base64'):fs.readFileSync(path.join(root,b.uri)));
function read(index){const a=model.accessors[index],v=model.bufferViews[a.bufferView],width={SCALAR:1,VEC3:3}[a.type],bytes=buffers[v.buffer],offset=(v.byteOffset||0)+(a.byteOffset||0);return Array.from({length:a.count*width},(_,i)=>a.componentType===5126?bytes.readFloatLE(offset+i*4):bytes.readUInt32LE(offset+i*4));}
test('mast details preserve the corrected square section, rear geometry and original animation samples',()=>{
 assert.deepEqual(model.meshes.slice(0,previous.meshes.length),previous.meshes);
 assert.deepEqual(model.accessors.slice(0,previous.accessors.length),previous.accessors);
 assert.deepEqual(model.animations,previous.animations);
 for(const [i,n]of previous.nodes.entries())for(const field of ['translation','rotation','scale','mesh'])assert.deepEqual(model.nodes[i][field],n[field],n.name+' '+field);
 for(const [i,b]of previous.buffers.entries())assert.deepEqual(model.buffers[i],b);
});
test('each detail follows its actual mechanical parent, including the moving cylinder',()=>{
 const parentOf=new Map();model.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>parentOf.set(c,i)));
 const expected={MAST_V10_Adjusters_and_welds:'CTRL_SHOULDER_Y',MAST_V10_Lift_clevis_and_hose_guides:'CTRL_SHOULDER_Y',MAST_V10_Crush_warning:'CTRL_SHOULDER_Y',MAST_V10_Cylinder_elbows_and_loops:'HYD_LIFT_BASE',MAST_V10_Pivot_sensor_and_base_fixings:'CTRL_TURRET_Z'};
 for(const [name,parent]of Object.entries(expected)){
  const i=model.nodes.findIndex(n=>n.name===name);assert.ok(i>=0);
  assert.equal(model.nodes[parentOf.get(i)].name,parent);
  let cursor=i,visited=new Set();while(parentOf.has(cursor)){assert.ok(!visited.has(cursor));visited.add(cursor);cursor=parentOf.get(cursor);}
  assert.equal(model.nodes[cursor].name,'CTRL_EQUIPMENT');
 }
});
test('new mast meshes have finite geometry, unit normals and outward facing triangles',()=>{
 for(const n of model.nodes.filter(n=>n.name.startsWith('MAST_V10_')))for(const p of model.meshes[n.mesh].primitives){
  const positions=read(p.attributes.POSITION),normals=read(p.attributes.NORMAL),indices=read(p.indices);
  assert.ok(positions.every(Number.isFinite)&&normals.every(Number.isFinite));
  for(let i=0;i<positions.length;i+=3)assert.ok(Math.abs(Math.hypot(...normals.slice(i,i+3))-1)<.00001);
  for(let i=0;i<indices.length;i+=3){
   const ids=indices.slice(i,i+3);assert.ok(ids.every(j=>j*3<positions.length));
   const [a,b,c]=ids.map(j=>positions.slice(j*3,j*3+3)),ab=b.map((v,k)=>v-a[k]),ac=c.map((v,k)=>v-a[k]);
   const cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
   const normal=[0,1,2].map(k=>ids.reduce((s,j)=>s+normals[j*3+k],0));
   assert.ok(cross.reduce((s,v,k)=>s+v*normal[k],0)>-1e-9,n.name+' material '+p.material+' triangle '+i/3);
  }
 }
});
test('archived V10 mast geometry retains complete local buffer dependencies',()=>{
 // These files document the historical revision. Active offline coverage is
 // checked from model-assets.js by sw.test.cjs, without precaching archives.
 for(const [i,b]of model.buffers.entries()){
  assert.equal(buffers[i].length,b.byteLength);
 }
 for(const v of model.bufferViews)assert.ok((v.byteOffset||0)+v.byteLength<=buffers[v.buffer].length);
});
