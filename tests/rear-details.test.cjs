const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'../3d/assets');
const previous=JSON.parse(fs.readFileSync(path.join(root,'rodbot-v8-mast.gltf')));
const model=JSON.parse(fs.readFileSync(path.join(root,'rodbot-v9-rear.gltf')));
const buffers=model.buffers.map(b=>b.uri.startsWith('data:')?Buffer.from(b.uri.split(',')[1],'base64'):fs.readFileSync(path.join(root,b.uri)));
function read(index){const a=model.accessors[index],v=model.bufferViews[a.bufferView],width={SCALAR:1,VEC3:3}[a.type],bytes=buffers[v.buffer],offset=(v.byteOffset||0)+(a.byteOffset||0);return Array.from({length:a.count*width},(_,i)=>a.componentType===5126?bytes.readFloatLE(offset+i*4):bytes.readUInt32LE(offset+i*4));}
test('rear additions retain every original animation and the corrected mast',()=>{
  assert.deepEqual(model.animations,previous.animations);
  for(const [i,n]of previous.nodes.entries())if(/^(CTRL_|HYD_)|MESH_SHOULDER/.test(n.name)){
    for(const field of ['translation','rotation','scale'])assert.deepEqual(model.nodes[i][field],n[field],n.name);
    if(n.mesh!==undefined)assert.deepEqual(model.meshes[n.mesh],previous.meshes[n.mesh]);
  }
  for(const [i,mesh]of previous.meshes.entries())for(const [j,p]of mesh.primitives.entries()){
    const next=model.meshes[i].primitives[j];
    assert.equal(next.indices,p.indices);assert.deepEqual(next.attributes,p.attributes);
    assert.deepEqual(next.extensions,p.extensions,'existing surface anchors keep their original triangles');
  }
});
test('new detail meshes have valid bounds, normals, winding and triangle indices',()=>{
  const added=model.nodes.filter(n=>n.name.startsWith('REAR_V9_'));
  assert.equal(added.length,4);
  const equipment=model.nodes.find(n=>n.name==='CTRL_EQUIPMENT');
  for(const n of added){
    assert.ok(equipment.children.includes(model.nodes.indexOf(n)),'details follow the whole machine');
    for(const p of model.meshes[n.mesh].primitives){
      const positions=read(p.attributes.POSITION),normals=read(p.attributes.NORMAL),indices=read(p.indices);
      assert.ok(positions.every(Number.isFinite)&&normals.every(Number.isFinite));
      for(let i=0;i<positions.length;i+=3){
        assert.ok(positions[i]>-2 && positions[i]<-.6);
        assert.ok(positions[i+1]>.45&&positions[i+1]<1.5);
        assert.ok(Math.abs(positions[i+2])<.8);
        assert.ok(Math.abs(Math.hypot(...normals.slice(i,i+3))-1)<.00001);
      }
      for(let i=0;i<indices.length;i+=3){
        const ids=indices.slice(i,i+3);assert.ok(ids.every(j=>j*3<positions.length));
        const [a,b,c]=ids.map(j=>positions.slice(j*3,j*3+3));
        const ab=b.map((v,k)=>v-a[k]),ac=c.map((v,k)=>v-a[k]);
        const cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
        const normal=[0,1,2].map(k=>ids.reduce((s,j)=>s+normals[j*3+k],0));
        assert.ok(cross.reduce((s,v,k)=>s+v*normal[k],0)>-1e-9,'faces point toward their shading normals: '+n.name+' material '+p.material+' triangle '+i/3);
      }
    }
  }
});
test('opening the service bay modifies whole panels without stretching nearby shelves',()=>{
  const report=model.extras.rear_detail_revision.changes;
  assert.equal(report.length,3);
  for(const c of report)assert.equal(c.vertices,c.node==='MESH_EQUIPMENT_026'?768:384);
  const byName=Object.fromEntries(model.nodes.map(n=>[n.name,n]));
  for(const name of ['MESH_EQUIPMENT_016','MESH_EQUIPMENT_026','MESH_EQUIPMENT_027']){
    const mesh=model.meshes[byName[name].mesh],p=mesh.primitives[0];
    assert.deepEqual(mesh.weights,[1]);assert.equal(model.accessors[p.targets[0].POSITION].sparse.count,name==='MESH_EQUIPMENT_026'?768:384);
  }
});
test('every external model dependency is included in the offline cache',()=>{
  const sw=fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8');
  for(const b of model.buffers)if(!b.uri.startsWith('data:'))assert.ok(sw.includes("'./3d/assets/"+b.uri+"'"));
  for(const [i,b]of model.buffers.entries())assert.equal(buffers[i].length,b.byteLength);
});
