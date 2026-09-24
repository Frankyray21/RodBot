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
test('active GLB preserves the exact new hose pair under the cylinder and all prior animation samples',()=>{
 const active=activeAsset(),g=active.document;
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
