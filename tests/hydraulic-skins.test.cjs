const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

// Exercise the shipped Draco vertex order and the uncompressed skin weights.
// This needs only Node and the decoder already distributed with the viewer.
const js=path.join(__dirname,'../3d/js');
const uri=fs.readFileSync(path.join(js,'model-assets.js'),'utf8').match(/MODEL_URL\s*=\s*new URL\(['"]([^'"]+)['"]/)?.[1];
assert(uri);
const bytes=fs.readFileSync(path.resolve(js,uri));
const jsonLength=bytes.readUInt32LE(12);
const g=JSON.parse(bytes.subarray(20,20+jsonLength));
const bin=bytes.subarray(28+jsonLength);
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
// Accepted V20 terminal centres, in glTF metres. The concealed ends are visual
// estimates, not documented physical hydraulic ports. Keep these independent
// of exported metadata so a wrong vertex-weight order cannot validate itself.
const terminals={
 'diagonal1':[[-.675964,1.710279,.282000],[-1.090000,1.608000,.125000]],
 'diagonal2':[[-.651502,1.673216,.282000],[-1.090000,1.608000,.157000]],
 'capot1':[[-1.017700,1.908453,.048000],[-1.040000,1.604000,.033000]],
 'capot2':[[-1.017700,1.908453,-.013000],[-1.040000,1.604000,-.028000]],
 // Accepted V22 plate outlets and concealed foot entries, fixed independently
 // of exported metadata. These are visual attachment coordinates, not ports
 // verified from a hydraulic schematic.
 'V22 | Retour inférieur du faisceau 1':[[-1.292818,1.680574,-.255],[-1.045,1.455,.048]],
 'V22 | Retour inférieur du faisceau 2':[[-1.252,1.777,-.302],[-1.045,1.455,.024]],
 'V22 | Retour inférieur du faisceau 3':[[-1.292818,1.680574,-.349],[-1.045,1.455,0]],
 'V22 | Retour inférieur du faisceau 4':[[-1.279247,1.680166,-.396],[-1.045,1.455,-.024]],
 'V22 | Retour inférieur du faisceau 5':[[-1.292818,1.680574,-.443],[-1.045,1.455,-.048]],
 'V22 | Retour ligne à connecteur droit':[[-1.252,1.747,-.190],[-1.045,1.455,.076]]
};
function multiply(a,b){return Array.from({length:16},(_,i)=>{const row=i%4,col=Math.floor(i/4);return [0,1,2,3].reduce((s,k)=>s+a[k*4+row]*b[col*4+k],0);});}
function transform(m,p){return [0,1,2].map(r=>m[r]*p[0]+m[r+4]*p[1]+m[r+8]*p[2]+m[r+12]);}
function local(n){
 if(n.matrix)return n.matrix;
 const [x,y,z,w]=n.rotation||[0,0,0,1],s=n.scale||[1,1,1],t=n.translation||[0,0,0];
 return [(1-2*y*y-2*z*z)*s[0],(2*x*y+2*z*w)*s[0],(2*x*z-2*y*w)*s[0],0,
  (2*x*y-2*z*w)*s[1],(1-2*x*x-2*z*z)*s[1],(2*y*z+2*x*w)*s[1],0,
  (2*x*z+2*y*w)*s[2],(2*y*z-2*x*w)*s[2],(1-2*x*x-2*y*y)*s[2],0,...t,1];
}
const parents=new Map();g.nodes.forEach((n,i)=>(n.children||[]).forEach(child=>parents.set(child,i)));
function worlds(overrides=new Map()){
 const cache=new Map();return function world(i){if(cache.has(i))return cache.get(i);const m=local({...g.nodes[i],...overrides.get(i)}),result=multiply(parents.has(i)?world(parents.get(i)):identity,m);cache.set(i,result);return result;};
}
function read(index){
 const a=g.accessors[index],v=g.bufferViews[a.bufferView],width={SCALAR:1,VEC3:3,VEC4:4,MAT4:16}[a.type],size={5121:1,5123:2,5126:4}[a.componentType];
 assert(width&&size&&v&&!a.sparse);const start=(v.byteOffset||0)+(a.byteOffset||0),stride=v.byteStride||width*size;
 assert(start+(a.count-1)*stride+width*size<=bin.length);
 return Array.from({length:a.count*width},(_,i)=>{const at=start+Math.floor(i/width)*stride+(i%width)*size;return size===1?bin.readUInt8(at):size===2?bin.readUInt16LE(at):bin.readFloatLE(at);});
}
function pose(endpoint){
 const changes=new Map();for(const name of ['Elevation_bras','Rotation_tourelle']){
  const clip=g.animations.find(a=>a.name===name);assert(clip);
  for(const channel of clip.channels){const sampler=clip.samplers[channel.sampler],a=g.accessors[sampler.output],width=a.type==='VEC4'?4:3,values=read(sampler.output),index=endpoint?(a.count-1)*width:0;
   if(!changes.has(channel.target.node))changes.set(channel.target.node,{});
   changes.get(channel.target.node)[channel.target.path]=values.slice(index,index+width);
  }
 }return worlds(changes);
}
function decodePositions(d,p){
 const ext=p.extensions?.KHR_draco_mesh_compression;assert(ext);
 const view=g.bufferViews[ext.bufferView],raw=bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength);
 const decoder=new d.Decoder(),input=new d.DecoderBuffer(),mesh=new d.Mesh(),values=new d.DracoFloat32Array();let status;
 try{input.Init(new Int8Array(raw),raw.length);status=decoder.DecodeBufferToMesh(input,mesh);assert(status.ok());
  const attr=decoder.GetAttributeByUniqueId(mesh,ext.attributes.POSITION);assert.equal(attr.num_components(),3);
  assert(decoder.GetAttributeFloatForAllPoints(mesh,attr,values));assert.equal(mesh.num_points(),g.accessors[p.attributes.POSITION].count);
  return Array.from({length:values.size()},(_,i)=>values.GetValue(i));
 }finally{for(const o of [status,values,mesh,input,decoder])if(o)d.destroy(o);}
}
test('flexible hoses keep their rest geometry, terminal bindings and animated attachments',async()=>{
 assert.equal(g.skins.length,2);
 const expected=[...['V17 | Boyau diagonal protégé ','V17 | Gaine spiralée du boyau ','V14 | Flexible visible entrée capot '].flatMap(s=>[s+'1',s+'2']),'V20 | Bride claire sur boucles','V20 | Maintien noir bas des boucles'];
 expected.push(...Object.keys(terminals).filter(name=>name.startsWith('V22 |')));
 const models=g.nodes.map((n,i)=>({n,i})).filter(({n})=>n.skin!==undefined);
 assert.deepEqual(models.map(({n})=>n.extras?.v20_skin?.source).sort(),expected.sort());
 const rest=worlds(),animated=[pose(false),pose(true)],d=await require('../3d/vendor/draco/draco_decoder.js')();
 let moved=0;
 for(const {n,i} of models){
  assert.equal(g.nodes[parents.get(i)].name,'CTRL_EQUIPMENT');
  const meta=n.extras.v20_skin,skin=g.skins[n.skin],jointNames=skin.joints.map(j=>g.nodes[j].name);
  assert.deepEqual(jointNames,[meta.source.startsWith('V17 |')?'HYD_LIFT_BASE':'CTRL_SHOULDER_Y','CTRL_TURRET_Z']);
  const ib=read(skin.inverseBindMatrices),bind=[ib.slice(0,16),ib.slice(16,32)];
  for(let k=0;k<2;k++)assert(Math.max(...multiply(rest(skin.joints[k]),bind[k]).map((v,j)=>Math.abs(v-rest(i)[j])))<2e-6,'inverse bind preserves actual mesh rest transform');
  assert.equal(g.meshes[n.mesh].primitives.length,1);
  const p=g.meshes[n.mesh].primitives[0],pos=decodePositions(d,p),weights=read(p.attributes.WEIGHTS_0),joints=read(p.attributes.JOINTS_0),count=pos.length/3;
  assert.equal(weights.length,count*4);assert.equal(joints.length,count*4);assert(pos.every(Number.isFinite));
  const start=[],end=[],middle=[];
  for(let v=0;v<count;v++){
   const w=weights.slice(v*4,v*4+4),j=joints.slice(v*4,v*4+4);assert(w.every(x=>Number.isFinite(x)&&x>=0&&x<=1));assert(Math.abs(w.reduce((a,b)=>a+b,0)-1)<1e-6);
   assert.deepEqual(j,[0,1,0,0]);assert.equal(w[2],0);assert.equal(w[3],0);
   (w[1]===0?start:w[1]===1?end:middle).push(v);
  }
  if(meta.uniform_end_weight!==undefined){assert(weights.filter((_,j)=>j%4===1).every(w=>Math.abs(w-meta.uniform_end_weight)<1e-6),'bundle restraints use uniform weights');continue;}
  assert(start.length>10&&end.length>10&&middle.length>10,'two rigid ends with a flexible middle');
  // A nearest-surface vertex at each authored centreline end must belong to
  // that endpoint, even if Draco changes the vertex order during a rebuild.
  for(const [k,indices] of [[0,start],[1,end]]){
   const target=terminals[meta.source.startsWith('V22 |')?meta.source:(meta.source.startsWith('V17 |')?'diagonal':'capot')+meta.source.at(-1)][k];
   let nearest=0,distance=Infinity;for(let v=0;v<count;v++){const delta=Math.hypot(...target.map((x,a)=>x-pos[v*3+a]));if(delta<distance){distance=delta;nearest=v;}}
   assert(indices.includes(nearest),'geometric terminal is rigidly bound to its corresponding articulation');assert(distance<(meta.source.includes('Gaine')?.12:.04));
   const point=pos.slice(nearest*3,nearest*3+3),localPoint=transform(bind[k],point),positions=animated.map(world=>transform(world(skin.joints[k]),localPoint));
   assert(positions.flat().every(Number.isFinite));if(Math.hypot(...positions[0].map((x,a)=>x-positions[1][a]))>.001)moved++;
  }
 }
 assert(moved>=6,'the preserved clips actually move the skinned hydraulic attachments');
});
