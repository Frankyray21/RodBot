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
test('all V11 buffers, model and zoom module are included in the offline shell/content',()=>{
 const sw=fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8');assert(sw.includes('./3d/assets/rodbot-v11-hydraulics.gltf'));assert(sw.includes('./3d/js/precision-zoom.js'));
 model.buffers.forEach((b,i)=>{assert.equal(buffers[i].length,b.byteLength);if(!b.uri.startsWith('data:'))assert(sw.includes('./3d/assets/'+b.uri));});
 for(const v of model.bufferViews)assert((v.byteOffset||0)+v.byteLength<=buffers[v.buffer].length);
});
