const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const createDecoder=require('../3d/vendor/draco/draco_decoder.js');
const root=path.join(__dirname,'../3d/assets');
const model=JSON.parse(fs.readFileSync(path.join(root,'rodbot-v8-mast.gltf')));
const source=fs.readFileSync(path.join(root,'rodbot-v6-c9499d45.glb'));
const original=JSON.parse(source.subarray(20,20+source.readUInt32LE(12)));
const nodes=Object.fromEntries(model.nodes.map(n=>[n.name,n]));
const buffers=model.buffers.map(b=>b.uri.startsWith('data:')?Buffer.from(b.uri.split(',')[1],'base64'):fs.readFileSync(path.join(root,b.uri)));
function applyTarget(values,index) {
  const result=values.slice(),a=model.accessors[index],s=a.sparse;
  const iv=model.bufferViews[s.indices.bufferView],vv=model.bufferViews[s.values.bufferView];
  for(let i=0;i<s.count;i++) {
    const id=buffers[iv.buffer].readUInt32LE((iv.byteOffset||0)+(s.indices.byteOffset||0)+i*4);
    for(let k=0;k<3;k++) result[id*3+k]+=buffers[vv.buffer].readFloatLE((vv.byteOffset||0)+(s.values.byteOffset||0)+(i*3+k)*4);
  }
  return result;
}
test('the mast has a square section with a corner above its centreline',async()=>{
  const d=await createDecoder(), decoder=new d.Decoder(),input=new d.DecoderBuffer(),geometry=new d.Mesh();
  const primitive=model.meshes[nodes.MESH_SHOULDER_Y_111.mesh].primitives[0];
  const ext=primitive.extensions.KHR_draco_mesh_compression,view=model.bufferViews[ext.bufferView];
  const data=buffers[view.buffer].subarray(view.byteOffset,view.byteOffset+view.byteLength);
  input.Init(new Int8Array(data),data.length);assert.ok(decoder.DecodeBufferToMesh(input,geometry).ok());
  const values=new d.DracoFloat32Array();
  decoder.GetAttributeFloatForAllPoints(geometry,decoder.GetAttributeByUniqueId(geometry,ext.attributes.POSITION),values);
  const base=Float32Array.from({length:values.size()},(_,i)=>values.GetValue(i));
  const next=applyTarget(base,primitive.targets[0].POSITION);
  const pitch=Math.atan2(.24774,.56016),c=Math.cos(pitch),s=Math.sin(pitch),points=[];
  for(let i=0;i<base.length;i+=3) {
    const along=c*base[i]+s*base[i+1],h=-s*base[i]+c*base[i+1],z=base[i+2];
    if(along>.02&&along<1.21&&Math.abs(h)<.178&&Math.abs(z)<.149&&(Math.abs(h)>.155||Math.abs(z)>.135))points.push([-s*next[i]+c*next[i+1],next[i+2]]);
  }
  assert.equal(points.length,384,'outer tube selected independently from its original bounds');
  const maxH=Math.max(...points.map(p=>p[0]));
  assert.ok(maxH>.25&&maxH<.265,'upper diagonal reaches above a flat face');
  assert.ok(points.filter(p=>p[0]>maxH-.002).every(p=>Math.abs(p[1])<.015),'uppermost edge lies on the centre plane');
  const unrolled=points.map(([h,z])=>[(h-z)/Math.SQRT2,(h+z)/Math.SQRT2]);
  for(let k=0;k<2;k++) {
    const width=Math.max(...unrolled.map(p=>p[k]))-Math.min(...unrolled.map(p=>p[k]));
    assert.ok(Math.abs(width-.370)<.001,'both sides have the same length');
  }
  for(const x of [values,geometry,input,decoder])d.destroy(x);
});
test('joint positions and rotations match the original mechanical rig',()=>{
  for(const n of original.nodes.filter(n=>/^(CTRL_|HYD_)/.test(n.name))) {
    for(const field of ['translation','rotation','scale'])assert.deepEqual(nodes[n.name][field],n[field],n.name+' '+field);
  }
  assert.deepEqual(model.animations,original.animations,'all 36 animation channels retain their original targets');
});
test('morph corrections retain triangle indices, UVs and interactive surface references',()=>{
  for(const [i,mesh] of model.meshes.entries())for(const [j,p]of mesh.primitives.entries()) {
    assert.equal(p.indices,original.meshes[i].primitives[j].indices);
    assert.deepEqual(p.attributes,original.meshes[i].primitives[j].attributes);
    if(p.targets)assert.deepEqual(mesh.weights,[1],'correction active in every pose');
  }
});
