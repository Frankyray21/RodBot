const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const dir=path.join(__dirname,'../3d/assets');
const previous=JSON.parse(fs.readFileSync(path.join(dir,'rodbot-v10-mast-details.gltf')));
const model=JSON.parse(fs.readFileSync(path.join(dir,'rodbot-v11-hydraulics.gltf')));
const buffers=model.buffers.map(b=>b.uri.startsWith('data:')?Buffer.from(b.uri.split(',')[1],'base64'):fs.readFileSync(path.join(dir,b.uri)));
const node=model.nodes.find(n=>n.name==='MAST_V11_Cylinder_hose_pair');
function read(index){const a=model.accessors[index],v=model.bufferViews[a.bufferView],width={SCALAR:1,VEC3:3}[a.type],data=buffers[v.buffer],offset=(v.byteOffset||0)+(a.byteOffset||0);return Array.from({length:a.count*width},(_,i)=>a.componentType===5126?data.readFloatLE(offset+i*4):data.readUInt32LE(offset+i*4));}
test('V11 replaces the erroneous loops without changing prior mesh indices or animation samples',()=>{
 assert.deepEqual(model.animations,previous.animations);assert.deepEqual(model.meshes.slice(0,previous.meshes.length),previous.meshes);assert.deepEqual(model.accessors.slice(0,previous.accessors.length),previous.accessors);
 for(let i=0;i<previous.nodes.length;i++)for(const f of ['translation','rotation','scale'])assert.deepEqual(model.nodes[i][f],previous.nodes[i][f]);
 assert.equal(model.nodes.find(n=>n.name==='MAST_V10_Cylinder_elbows_and_loops').mesh,undefined);
 const idx=model.nodes.indexOf(node);assert(model.nodes.find(n=>n.name==='HYD_LIFT_BASE').children.includes(idx));
});
test('the two ferrules are adjacent and both visible hoses follow open, separate routes',()=>{
 const paths=model.extras.hydraulic_revision.paths;assert.equal(paths.length,2);
 assert(Math.abs(paths[0].fitting[1]-paths[1].fitting[1])<.01);
 for(const p of paths){assert.deepEqual(p.points[0],p.ferrule_exit);for(let i=1;i<p.points.length;i++)assert(p.points[i][1]>=p.points[i-1][1]-1e-8);assert(p.points.at(-1)[1]-p.points[0][1]>.4);
  for(const [x,y,z]of p.points)if(y<.8214)assert(Math.hypot(x,z)>.079+p.radius,'visible hose stays clear of the barrel/gland');}
 for(let i=0;i<paths[0].points.length;i++)assert(Math.hypot(...paths[0].points[i].map((x,j)=>x-paths[1].points[i][j]))>paths[0].radius+paths[1].radius);
});
test('new hydraulic geometry has finite coordinates, unit normals and outward faces',()=>{
 for(const p of model.meshes[node.mesh].primitives){const pos=read(p.attributes.POSITION),nor=read(p.attributes.NORMAL),idx=read(p.indices);assert(pos.every(Number.isFinite)&&nor.every(Number.isFinite));
  for(let i=0;i<nor.length;i+=3)assert(Math.abs(Math.hypot(...nor.slice(i,i+3))-1)<1e-5);
  for(let i=0;i<idx.length;i+=3){const ids=idx.slice(i,i+3);assert(ids.every(j=>j*3<pos.length));const [a,b,c]=ids.map(j=>pos.slice(j*3,j*3+3));const u=b.map((x,j)=>x-a[j]),v=c.map((x,j)=>x-a[j]);const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];const dot=cross.reduce((s,x,j)=>s+x*ids.reduce((n,k)=>n+nor[k*3+j],0),0);assert(dot>-1e-9,'triangle '+i/3);}
 }
});
// The three tests above intentionally retain the photographic construction
// fixtures. Runtime/offline checks follow the published asset, which is a GLB.
const jsRoot=path.join(__dirname,'../3d/js');
function activeAsset(){
 const source=fs.readFileSync(path.join(jsRoot,'model-assets.js'),'utf8');
 const uri=source.match(/MODEL_URL\s*=\s*new URL\(['"]([^'"]+)['"]/)?.[1];
 assert.ok(uri,'MODEL_URL remains relative to its module');
 const file=path.resolve(jsRoot,decodeURIComponent(uri)),raw=fs.readFileSync(file);
 let document,binary;
 if(raw.readUInt32LE(0)===0x46546c67){
  assert.equal(raw.readUInt32LE(4),2);assert.equal(raw.readUInt32LE(8),raw.length);
  for(let offset=12;offset<raw.length;){
   const size=raw.readUInt32LE(offset),kind=raw.readUInt32LE(offset+4),chunk=raw.subarray(offset+8,offset+8+size);
   assert.equal(chunk.length,size,'complete active GLB chunk');
   if(kind===0x4e4f534a)document=JSON.parse(chunk.toString('utf8'));
   if(kind===0x004e4942)binary=chunk;
   offset+=8+size;
  }
 }else document=JSON.parse(raw.toString('utf8'));
 assert.ok(document,'active model document');
 const data=document.buffers.map(b=>!b.uri?binary:b.uri.startsWith('data:')?Buffer.from(b.uri.split(',')[1],'base64'):fs.readFileSync(path.resolve(path.dirname(file),decodeURIComponent(b.uri))));
 return {file,document,data};
}
function accessorBytes(document,data,index){
 const a=document.accessors[index],v=document.bufferViews[a.bufferView];
 assert.ok(v,'ported hydraulic geometry and animation samples have a binary buffer view');
 assert.equal(a.sparse,undefined,'hydraulic port keeps ordinary accessors');
 const size={5121:1,5123:2,5125:4,5126:4}[a.componentType]*{SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];
 assert.ok(size);const bytes=data[v.buffer],start=(v.byteOffset||0)+(a.byteOffset||0),stride=v.byteStride||size;
 return Buffer.concat(Array.from({length:a.count},(_,i)=>{
  const row=bytes.subarray(start+i*stride,start+i*stride+size);assert.equal(row.length,size);return row;
 }));
}
test('active model, its external buffers and precision zoom are included in offline content',()=>{
 const active=activeAsset(),sw=fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8');
 const cached=new Set();
 for(const key of ['CORE','MODELE_3D','PRECACHE']){
  const body=sw.match(new RegExp('const\\s+'+key+'\\s*=\\s*\\[([\\s\\S]*?)\\]'))?.[1]||'';
  for(const match of body.matchAll(/['"]([^'"]+)['"]/g))cached.add(match[1]);
 }
 const cachePath=file=>'./'+path.relative(path.join(__dirname,'..'),file).split(path.sep).join('/');
 assert.ok(cached.has(cachePath(active.file)),'the MODEL_URL asset is cached, not only an archived construction fixture');
 assert.ok(cached.has('./3d/js/precision-zoom.js'));
 assert.ok(fs.existsSync(path.join(jsRoot,'precision-zoom.js')));
 active.document.buffers.forEach((b,i)=>{
  assert.ok(active.data[i]&&active.data[i].length>=b.byteLength,'active buffer '+i);
  if(b.uri&&!b.uri.startsWith('data:'))assert.ok(cached.has(cachePath(path.resolve(path.dirname(active.file),decodeURIComponent(b.uri)))),'external model buffer '+b.uri+' is cached');
 });
 for(const v of active.document.bufferViews)assert.ok((v.byteOffset||0)+v.byteLength<=active.document.buffers[v.buffer].byteLength);
});
test('active GLB preserves its hydraulic pair and independent animation contracts',async()=>{
 const active=activeAsset(),g=active.document;
 const twinRevision=Number(path.basename(active.file).match(/^rodbot-v(26|27|28|29|30|31|32)-/)?.[1]);
 if(twinRevision)return validateTwinCylinderHydraulics(active,require('./hydraulic-contract.cjs').loadHydraulicContract(twinRevision));
 if(/^rodbot-v(?:17|18|19|20|21|22|23|24|25)-/.test(path.basename(active.file)))return validateV17Hydraulics(active);
 if(path.basename(active.file).startsWith('rodbot-v16'))return validateV16Hydraulics(active);
 assert.match(active.file,/\.glb$/i,'the runtime uses the standalone GLB');
 const id=g.nodes.findIndex(n=>n.name==='MESH_LIFT_BASE_V11_HOSE_PAIR');assert.ok(id>=0,'new hydraulic pair is present in the actual runtime binary');
 const pair=g.nodes[id];assert.equal(pair.extras?.source_group,'MAST_V11_Cylinder_hose_pair');
 assert.ok(g.nodes.find(n=>n.name==='HYD_LIFT_BASE')?.children?.includes(id),'pair follows the animated cylinder parent');
 assert.equal(pair.matrix,undefined);assert.deepEqual(pair.translation||[0,0,0],[0,0,0]);assert.deepEqual(pair.rotation||[0,0,0,1],[0,0,0,1]);assert.deepEqual(pair.scale||[1,1,1],[1,1,1]);
 for(const old of ['MESH_LIFT_BASE_169','MESH_LIFT_BASE_170','MESH_LIFT_BASE_171']){
  const retired=g.nodes.find(n=>n.name===old);assert.ok(retired,old+' index remains available');assert.equal(retired.mesh,undefined,old+' no longer draws the superseded loops');
 }
 const actual=g.meshes[pair.mesh].primitives,expected=model.meshes[node.mesh].primitives;
 assert.equal(actual.length,3);assert.equal(actual.length,expected.length);
 for(const p of actual){
  const material=g.materials[p.material].name;
  const reference=expected.find(q=>model.materials[q.material].name===material);assert.ok(reference,material+' is the photographed pair material');
  for(const key of ['POSITION','NORMAL'])assert.deepEqual(accessorBytes(g,active.data,p.attributes[key]),accessorBytes(model,buffers,reference.attributes[key]),material+' '+key+' matches the validated fixture');
  assert.deepEqual(accessorBytes(g,active.data,p.indices),accessorBytes(model,buffers,reference.indices),material+' triangle topology is preserved');
 }
 // Baseline: active audited GLB rodbot-v11-466c9f7f, immediately before the
 // b031a97 hose-only port. Hash includes animation JSON and every binary sample;
 // it does not require retaining another 30MB model as a fixture.
 const hash=require('node:crypto').createHash('sha256').update(JSON.stringify(g.animations));
 for(const a of g.animations)for(const s of a.samplers)for(const i of [s.input,s.output])hash.update(accessorBytes(g,active.data,i));
 assert.equal(hash.digest('hex'),'b033691055a046be07a102a27c13f94217895a09647c118e82abffdaf9957fcd','hose port leaves all animation metadata and binary samples unchanged');
});

// V17 changes the hose routing towards the cylinder foot. Keep the three
// photographic material groups and rig contract, but do not compare positions
// to the old upward loops. Additional V17 plastic spirals are separate meshes.
async function validateV17Hydraulics(active){
 const g=active.document;
 assert.match(active.file,/\.glb$/i,'V17 is a standalone GLB');
 const names=new Map();
 g.nodes.forEach((n,i)=>{if(n.name){assert.ok(!names.has(n.name),'unique node name '+n.name);names.set(n.name,i);}});
 const base=names.get('HYD_LIFT_BASE');assert.notEqual(base,undefined,'cylinder pivot remains available');
 const pairs=g.nodes.map((n,i)=>({n,i})).filter(({n})=>n.extras?.source_group==='MAST_V11_Cylinder_hose_pair');
 const materialNames=model.meshes[node.mesh].primitives.map(p=>model.materials[p.material].name);
 assert.equal(pairs.length,3,'three revised hose groups, independent of the added plastic spirals');
 assert.deepEqual(pairs.map(({n})=>n.extras.material_source_name).sort(),[...materialNames].sort(),'original hydraulic material identities remain');
 const decoder=await require('../3d/vendor/draco/draco_decoder.js')();
 for(const {n,i} of pairs){
  assert.ok(g.nodes[base].children?.includes(i),'revised hydraulic mesh directly follows HYD_LIFT_BASE');
  assert.equal(n.matrix,undefined);
  assert.deepEqual(n.translation||[0,0,0],[0,0,0]);
  assert.deepEqual(n.rotation||[0,0,0,1],[0,0,0,1]);
  assert.deepEqual(n.scale||[1,1,1],[1,1,1]);
  assert.ok(Number.isInteger(n.mesh)&&g.meshes[n.mesh],'source-group marker has real geometry');
  const primitives=g.meshes[n.mesh].primitives;
  assert.equal(primitives.length,1,'one source material per exported group');
  assert.ok(g.materials[primitives[0].material],'revised mesh retains a runtime material');
  // Shared reader verifies the actual compressed positions/normals/triangles,
  // complete payload, finite coordinates, index bounds and nonempty surfaces.
  decodeV16Primitive(decoder,g,active.data,primitives[0]);
 }
 validateV16Controls(g,active.data);
}

// V26/V27 have two cylinders with the same four smooth hoses. Do not force either side into
// the former three-material loop envelope. The reviewed source fixture freezes
// their named groups, rest dimensions and contact points independently of GLB.
async function validateTwinCylinderHydraulics(active,c){
 const g=active.document;
 assert.match(active.file,/\.glb$/i);validateV16Controls(g,active.data);
 const byName=new Map();g.nodes.forEach((n,i)=>{if(n.name){assert(!byName.has(n.name));byName.set(n.name,i);}});
 const parents=new Map();g.nodes.forEach((n,i)=>(n.children||[]).forEach(j=>parents.set(j,i)));
 const d=await require('../3d/vendor/draco/draco_decoder.js')(),decoded=new Map(),worlds=new Map();
 const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
 function mul(a,b){return Array.from({length:16},(_,i)=>[0,1,2,3].reduce((sum,k)=>sum+a[k*4+i%4]*b[Math.floor(i/4)*4+k],0));}
 function world(i){if(worlds.has(i))return worlds.get(i);const n=g.nodes[i],[x,y,z,w]=n.rotation||[0,0,0,1],s=n.scale||[1,1,1],t=n.translation||[0,0,0];
  const local=n.matrix||[(1-2*y*y-2*z*z)*s[0],(2*x*y+2*z*w)*s[0],(2*x*z-2*y*w)*s[0],0,(2*x*y-2*z*w)*s[1],(1-2*x*x-2*z*z)*s[1],(2*y*z+2*x*w)*s[1],0,(2*x*z+2*y*w)*s[2],(2*y*z-2*x*w)*s[2],(1-2*x*x-2*y*y)*s[2],0,...t,1];
  const result=mul(parents.has(i)?world(parents.get(i)):identity,local);worlds.set(i,result);return result;}
 function transform(m,p){return [0,1,2].map(k=>m[k]*p[0]+m[k+4]*p[1]+m[k+8]*p[2]+m[k+12]);}
 function select(selector){
  assert(['HYD_LIFT_BASE','HYD_LIFT_ROD','HYD_LIFT_SLEEVE','CTRL_SHOULDER_Y'].includes(selector.parent),'geometry follows an existing cylinder or shoulder control');
  assert(selector.material_source_name||selector.material_source_names||selector.source_group,'use stable source markers rather than numbered mesh nodes');
  if(selector.material_source_names)assert(Array.isArray(selector.material_source_names)&&selector.material_source_names.length>0&&selector.material_source_names.every(n=>typeof n==='string'),'explicit source material list');
  const nodes=g.nodes.map((n,i)=>({n,i})).filter(({n,i})=>n.mesh!==undefined&&g.nodes[parents.get(i)]?.name===selector.parent&&
   (!selector.material_source_name||n.extras?.material_source_name===selector.material_source_name)&&(!selector.material_source_names||selector.material_source_names.includes(n.extras?.material_source_name))&&(!selector.source_group||n.extras?.source_group===selector.source_group));
  assert(Number.isInteger(selector.expected_meshes)&&selector.expected_meshes>0);assert.equal(nodes.length,selector.expected_meshes,'approved source marker selects the exact mesh groups');
  return nodes.flatMap(({n,i})=>{
   assert.equal(n.skin,undefined,'cylinder bodies, rods and manifolds stay rigid');
   assert.equal(n.matrix,undefined);assert.deepEqual(n.translation||[0,0,0],[0,0,0]);assert.deepEqual(n.rotation||[0,0,0,1],[0,0,0,1]);assert.deepEqual(n.scale||[1,1,1],[1,1,1]);
   return g.meshes[n.mesh].primitives.map((p,pi)=>{const key=i+':'+pi;if(!decoded.has(key)){const raw=decodeV16Primitive(d,g,active.data,p),m=world(i),positions=[];for(let k=0;k<raw.positions.length;k+=3)positions.push(transform(m,raw.positions.slice(k,k+3)));decoded.set(key,{positions,indices:raw.indices});}return decoded.get(key);});
  });
 }
 const finite3=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
 const inRegion=(p,r)=>p.every((v,k)=>v>=r.min[k]&&v<=r.max[k]);
 assert.equal(c.rigid_features.filter(f=>f.kind==='manifold').length,2,'two independently measured manifold bodies');
 assert.equal(c.rigid_features.filter(f=>f.kind==='barrel').length,2,'two black cylinder barrels');
 assert.equal(c.rigid_features.filter(f=>f.kind==='rod').length,2,'two chrome cylinder rods');
 for(const f of c.rigid_features){
  assert(finite3(f.bounds?.min)&&finite3(f.bounds?.max));assert(f.tolerance_m>0&&f.tolerance_m<=.001,'dimension tolerance does not exceed the existing 1mm Draco envelope allowance');
  if(f.region)assert(finite3(f.region.min)&&finite3(f.region.max));
  const points=select(f.selector).flatMap(p=>p.positions).filter(p=>!f.region||inRegion(p,f.region));assert(points.length>=3,f.id+' actual decoded geometry');
  for(let axis=0;axis<3;axis++){let min=Infinity,max=-Infinity;for(const p of points){min=Math.min(min,p[axis]);max=Math.max(max,p[axis]);}assert(Math.abs(min-f.bounds.min[axis])<=f.tolerance_m,f.id+' measured minimum');assert(Math.abs(max-f.bounds.max[axis])<=f.tolerance_m,f.id+' measured maximum');}
 }
 const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),scale=(a,s)=>a.map(v=>v*s),add=(a,b)=>a.map((v,i)=>v+b[i]);
 function segmentDistance2(p,a,b){const ab=sub(b,a),length=dot(ab,ab),t=length?Math.max(0,Math.min(1,dot(sub(p,a),ab)/length)):0,q=sub(p,add(a,scale(ab,t)));return dot(q,q);}
 function triangleDistance2(p,a,b,c){const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d00=dot(ab,ab),d01=dot(ab,ac),d11=dot(ac,ac),den=d00*d11-d01*d01;let best=Math.min(segmentDistance2(p,a,b),segmentDistance2(p,b,c),segmentDistance2(p,c,a));
  if(den>1e-24){const u=(d11*dot(ap,ab)-d01*dot(ap,ac))/den,v=(d00*dot(ap,ac)-d01*dot(ap,ab))/den;if(u>=0&&v>=0&&u+v<=1){const delta=sub(p,add(a,add(scale(ab,u),scale(ac,v))));best=Math.min(best,dot(delta,delta));}}return best;}
 assert(c.surface_contacts.length>=2,'reviewed contact samples for both cylinder assemblies');
 for(const contact of c.surface_contacts){assert(finite3(contact.point));assert(contact.tolerance_m>0&&contact.tolerance_m<=.001);assert.equal(contact.sides.length,2);
  for(const side of contact.sides){let nearest=Infinity;for(const primitive of select(side)){for(let k=0;k<primitive.indices.length;k+=3){const vertices=primitive.indices.slice(k,k+3).map(i=>primitive.positions[i]);nearest=Math.min(nearest,triangleDistance2(contact.point,...vertices));}}assert(Math.sqrt(nearest)<=contact.tolerance_m,contact.id+' independently fixed contact lies on both decoded surfaces');}
 }
 const sources=g.nodes.filter(n=>n.skin!==undefined).map(n=>n.extras?.v20_skin?.source);
 for(const name of ['V17 | Gaine spiralée du boyau 1','V17 | Gaine spiralée du boyau 2'])assert(!sources.includes(name),'retired spiral is absent');
 for(const name of ['V26 | Boyau vérin gauche 1','V26 | Boyau vérin gauche 2'])assert(sources.includes(name),'new smooth cylinder hose is present');
}

// V16 is regrouped by parent/material and Draco reorders vertices. Check the
// decoded geometry and semantic channel targets, never former mesh indices.
async function validateV16Hydraulics(active){
 const g=active.document;
 assert.match(active.file,/\.glb$/i,'V16 is a standalone GLB');
 const names=new Map();
 g.nodes.forEach((n,i)=>{if(n.name){assert.ok(!names.has(n.name),'unique node name '+n.name);names.set(n.name,i);}});
 const base=names.get('HYD_LIFT_BASE');assert.notEqual(base,undefined);
 const pairs=g.nodes.map((n,i)=>({n,i})).filter(({n})=>n.extras?.source_group==='MAST_V11_Cylinder_hose_pair');
 const reference=model.meshes[node.mesh].primitives;
 const materialNames=reference.map(p=>model.materials[p.material].name);
 assert.equal(pairs.length,3,'one V16 mesh for each of the three source materials');
 assert.deepEqual(pairs.map(({n})=>n.extras.material_source_name).sort(),[...materialNames].sort());
 const decoder=await require('../3d/vendor/draco/draco_decoder.js')();
 for(const {n,i} of pairs){
  assert.ok(g.nodes[base].children.includes(i),'hydraulic mesh directly follows HYD_LIFT_BASE');
  assert.equal(n.matrix,undefined);
  assert.deepEqual(n.translation||[0,0,0],[0,0,0]);
  assert.deepEqual(n.rotation||[0,0,0,1],[0,0,0,1]);
  assert.deepEqual(n.scale||[1,1,1],[1,1,1]);
  assert.ok(Number.isInteger(n.mesh)&&g.meshes[n.mesh],'source-group marker has real geometry');
  const primitives=g.meshes[n.mesh].primitives;
  assert.equal(primitives.length,1,'export groups one material per mesh');
  const p=primitives[0],expected=reference.find(q=>model.materials[q.material].name===n.extras.material_source_name);
  assert.ok(expected,'known photographic source material');
  assert.ok(g.materials[p.material],'runtime material remains assigned');
  const geometry=decodeV16Primitive(decoder,g,active.data,p);
  const original=read(expected.attributes.POSITION);
  // The pair is imported in cylinder-local metres without rescaling. A 1 mm
  // envelope tolerance allows the configured 16-bit positional quantization.
  for(let axis=0;axis<3;axis++){
   const expectedAxis=original.filter((_,j)=>j%3===axis),actualAxis=geometry.positions.filter((_,j)=>j%3===axis);
   for(const extent of [Math.min,Math.max])assert.ok(Math.abs(extent(...actualAxis)-extent(...expectedAxis))<.001,n.extras.material_source_name+' retains its cylinder-local envelope');
  }
 }
 validateV16Controls(g,active.data);
}

function decodeV16Primitive(d,g,data,p){
 assert.equal(p.mode??4,4,'triangle primitive');
 const ext=p.extensions?.KHR_draco_mesh_compression;assert.ok(ext,'V16 hydraulic geometry is actually Draco-compressed');
 const view=g.bufferViews[ext.bufferView];assert.ok(view);
 const raw=data[view.buffer].subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength);
 assert.equal(raw.length,view.byteLength,'complete compressed payload');
 const decoder=new d.Decoder(),input=new d.DecoderBuffer(),mesh=new d.Mesh(),values=new d.DracoFloat32Array(),face=new d.DracoInt32Array();
 let status;
 try{
  input.Init(new Int8Array(raw),raw.length);status=decoder.DecodeBufferToMesh(input,mesh);assert.ok(status.ok(),'Draco decode succeeds');
  assert.ok(mesh.num_points()>0&&mesh.num_faces()>0,'non-empty hydraulic mesh');
  const attributes={};
  for(const key of ['POSITION','NORMAL']){
   assert.ok(Number.isInteger(ext.attributes[key]),key+' Draco attribute');
   const attribute=decoder.GetAttributeByUniqueId(mesh,ext.attributes[key]);
   assert.equal(attribute.num_components(),3,key+' has three components');
   assert.ok(decoder.GetAttributeFloatForAllPoints(mesh,attribute,values));
   const result=Array.from({length:values.size()},(_,i)=>values.GetValue(i));
   assert.equal(result.length,mesh.num_points()*3);
   assert.ok(result.every(Number.isFinite),key+' finite after decoding');attributes[key]=result;
  }
  assert.equal(g.accessors[p.attributes.POSITION].count,mesh.num_points(),'accessor describes the decoded mesh');
  assert.equal(g.accessors[p.indices].count,mesh.num_faces()*3);
  const pos=attributes.POSITION,normals=attributes.NORMAL,decodedIndices=[];let nondegenerate=0;
  for(let i=0;i<normals.length;i+=3)assert.ok(Math.abs(Math.hypot(...normals.slice(i,i+3))-1)<.005,'decoded unit normal');
  for(let i=0;i<mesh.num_faces();i++){
   assert.ok(decoder.GetFaceFromMesh(mesh,i,face));
   const ids=[0,1,2].map(j=>face.GetValue(j));assert.ok(ids.every(id=>id>=0&&id<mesh.num_points()),'decoded indices in range');
   decodedIndices.push(...ids);
   const [a,b,c]=ids.map(id=>pos.slice(id*3,id*3+3)),u=b.map((v,j)=>v-a[j]),v=c.map((x,j)=>x-a[j]);
   if(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])>1e-12)nondegenerate++;
  }
  assert.ok(nondegenerate>0,'decoded geometry contains actual surface triangles');
  return {positions:pos,normals,indices:decodedIndices};
 }finally{if(status)d.destroy(status);d.destroy(face);d.destroy(values);d.destroy(mesh);d.destroy(input);d.destroy(decoder);}
}

function validateV16Controls(g,data){
 // Names and paths below are the public rig contract used by the V16 sampled
 // clip injector and viewer. Numeric node/accessor indices may change freely.
 const tracks={
  Presentation_360:['CTRL_EQUIPMENT:rotation'],
  Rotation_tourelle:['CTRL_TURRET_Z:rotation'],
  Elevation_bras:['CTRL_SHOULDER_Y:rotation','HYD_LIFT_BASE:rotation','HYD_LIFT_ROD:scale'],
  Inclinaison_pince:['CTRL_WRIST_Y:rotation'],Rotation_pince:['CTRL_GRIPPER_Z:rotation'],
  Ouverture_pince:['CTRL_JAW_LEFT_X:rotation','CTRL_JAW_RIGHT_X:rotation'],
  Stabilisateurs:['AVD','AVG','ARD','ARG'].map(s=>'CTRL_JACK_'+s+':translation'),
  Ouvrir_panneau:['CTRL_HMI_DOOR:rotation'],Selection_commande:['CTRL_HMI_SOURCE:rotation']
 };
 for(const [bank,count] of [['front',7],['side',5]])for(let i=1;i<=count;i++){
  const number=String(i).padStart(2,'0');tracks['SIM_'+bank+number]=['CTRL_PANEL_'+bank.toUpperCase()+'_'+number+':rotation'];
 }
 for(const [key,target] of Object.entries({js1x:'SIM_JS1_ROLL',js1y:'SIM_JS1_PITCH',js2:'SIM_JS2',js3x:'SIM_JS3_ROLL',js3y:'SIM_JS3_PITCH'}))tracks['SIM_'+key]=[target+':rotation'];
 for(const key of ['u1','u2','u3','u4','grip','rearm','start','mode_linear','mode_direct','mode_standby'])tracks['SIM_press_'+key]=['SIM_PRESS_'+key.toUpperCase()+':translation'];
 const expectedControls=new Set([...Object.values(tracks).flat().map(s=>s.split(':')[0]),'CTRL_BASKET','HYD_LIFT_TIP','HYD_LIFT_SLEEVE','PROP_REMOTE_STATION',...Array.from({length:7},(_,i)=>'PROP_ROD_'+String(i+1).padStart(2,'0'))]);
 assert.equal(expectedControls.size,53,'53 semantic control nodes in the pipeline');
 const controls=g.nodes.filter(n=>/^(CTRL_|HYD_|SIM_|PROP_)/.test(n.name));
 assert.deepEqual(controls.map(n=>n.name).sort(),[...expectedControls].sort(),'all 53 controls survive export');
 for(const n of controls){assert.equal(n.mesh,undefined,n.name+' remains an independent pivot');assert.ok(Array.isArray(n.extras?.pivot_world_rest_m)&&n.extras.pivot_world_rest_m.length===3&&n.extras.pivot_world_rest_m.every(Number.isFinite),n.name+' retains rest-pivot metadata');}
 assert.deepEqual(g.animations.map(a=>a.name).sort(),Object.keys(tracks).sort(),'all 36 named clips survive injection');
 const occupied=new Set();
 for(const animation of g.animations){
  const actual=animation.channels.map(channel=>{
   const target=g.nodes[channel.target.node];assert.ok(target,'animation target exists');
   const key=target.name+':'+channel.target.path;assert.ok(!occupied.has(key),'independent animated property '+key);occupied.add(key);
   const sampler=animation.samplers[channel.sampler];assert.ok(sampler);
   const timesAcc=g.accessors[sampler.input],valuesAcc=g.accessors[sampler.output];
   assert.equal(timesAcc.componentType,5126);assert.equal(timesAcc.type,'SCALAR');
   assert.equal(valuesAcc.componentType,5126);assert.equal(valuesAcc.type,channel.target.path==='rotation'?'VEC4':'VEC3');
   assert.equal(timesAcc.count,valuesAcc.count);assert.ok(timesAcc.count>=2);
   const floats=index=>{const bytes=accessorBytes(g,data,index);return Array.from({length:bytes.length/4},(_,i)=>bytes.readFloatLE(i*4));};
   const times=floats(sampler.input),values=floats(sampler.output),width=valuesAcc.type==='VEC4'?4:3;
   assert.ok(times.every((t,i)=>Number.isFinite(t)&&(i===0||t>times[i-1])),'strict finite sample times');
   assert.ok(values.every(Number.isFinite),'finite animation samples');
   if(animation.name!=='Presentation_360'){
    assert.equal(sampler.interpolation,'LINEAR');assert.equal(times[0],0);
    assert.ok(Math.abs(times.at(-1)-1.05)<1e-6,'injected endpoint hold at 1.05 seconds');
    assert.ok(Math.abs(times.at(-2)-1)<1e-6);
    assert.deepEqual(values.slice(-width),values.slice(-2*width,-width),'hold repeats the full endpoint');
   }
   return key;
  });
  assert.deepEqual(actual.sort(),[...tracks[animation.name]].sort(),animation.name+' keeps its semantic targets');
 }
}
