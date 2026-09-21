/* The mast has a square section installed on a corner, not a flat top.
 * Run: node scripts/refine-mast-section.cjs
 * Reuses the vendored Draco decoder. Sparse morphs retain all vertex indices,
 * so existing animated surface anchors remain attached to their original faces.
 */
const fs = require('node:fs');
const path = require('node:path');
const createDecoder = require('../3d/vendor/draco/draco_decoder.js');
const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, '3d/assets');
const readJSON = name => JSON.parse(fs.readFileSync(path.join(ASSETS, name), 'utf8'));
const model = readJSON('rodbot-v7-photo.gltf');
const source = fs.readFileSync(path.join(ASSETS, 'rodbot-v6-c9499d45.glb'));
const original = JSON.parse(source.subarray(20, 20 + source.readUInt32LE(12)));
const originalNodes = Object.fromEntries(original.nodes.map(n => [n.name,n]));
const nodes = Object.fromEntries(model.nodes.map(n => [n.name,n]));

// Undo V7's mistaken interpretation as a yaw/elevation correction. Retain its
// calibrated rods and materials. The joints use their original V6 rest poses.
for (const name of ['CTRL_TURRET_Z','CTRL_SHOULDER_Y','CTRL_WRIST_Y','HYD_LIFT_BASE','HYD_LIFT_ROD']) {
  for (const field of ['rotation','scale']) {
    if (originalNodes[name][field]) nodes[name][field] = [...originalNodes[name][field]];
    else delete nodes[name][field];
  }
}
for (const animation of original.animations.filter(a => ['Rotation_tourelle','Elevation_bras','Inclinaison_pince'].includes(a.name))) {
  for (const sampler of animation.samplers) model.accessors[sampler.output] = structuredClone(original.accessors[sampler.output]);
}

// The unrotated tube centreline passes through the shoulder, in its local XY
// plane. Its construction angle is retained; only the cross-section is rolled.
const PITCH = Math.atan2(.24774,.56016), C = Math.cos(PITCH), S = Math.sin(PITCH);
const ROLL = -Math.PI / 4, CR = Math.cos(ROLL), SR = Math.sin(ROLL);
const profile = ([x,y,z]) => [C*x+S*y,-S*x+C*y,z];
const world = ([s,h,z]) => [C*s-S*h,S*s+C*h,z];
const chainShift = world([0,.035,-.100]);
const shift = v => v.map((x,i) => x+chainShift[i]);
function roll(v, hScale=1, zScale=1, normal=false) {
  const [s,h,z] = profile(v);
  const H = normal ? h/hScale : h*hScale, Z = normal ? z/zScale : z*zScale;
  const out = world([s, CR*H-SR*Z, SR*H+CR*Z]);
  return normal ? out.map(x => x/Math.hypot(...out)) : out;
}
function components(positions, indices) {
  const parent = Array.from({length:positions.length/3},(_,i)=>i);
  const find = i => parent[i] === i ? i : parent[i] = find(parent[i]);
  const join = (a,b) => { parent[find(a)] = find(b); };
  const welded = new Map();
  for (let i=0;i<parent.length;i++) {
    const key = Array.from(positions.subarray(i*3,i*3+3),v=>Math.round(v*100000)).join(',');
    if (welded.has(key)) join(i,welded.get(key)); else welded.set(key,i);
  }
  for (let i=0;i<indices.length;i+=3) { join(indices[i],indices[i+1]); join(indices[i],indices[i+2]); }
  const groups = new Map();
  for (let i=0;i<parent.length;i++) { const root=find(i); if (!groups.has(root)) groups.set(root,[]); groups.get(root).push(i); }
  return [...groups.values()].map(ids => {
    const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
    for (const id of ids) profile(Array.from(positions.subarray(id*3,id*3+3))).forEach((v,k)=>{lo[k]=Math.min(lo[k],v);hi[k]=Math.max(hi[k],v);});
    return {ids,lo,hi,centre:lo.map((v,i)=>(v+hi[i])/2)};
  });
}
const output = [], report = [];
let offset=0;
const bufferIndex=model.buffers.length;
function append(bytes) {
  const padding = (4-offset%4)%4;
  if (padding) { output.push(Buffer.alloc(padding)); offset+=padding; }
  const index=model.bufferViews.length;
  model.bufferViews.push({buffer:bufferIndex,byteOffset:offset,byteLength:bytes.length});
  output.push(bytes); offset+=bytes.length; return index;
}
function sparse(count, entries, withBounds) {
  const sorted=[...entries].sort((a,b)=>a[0]-b[0]);
  const indices=new Uint32Array(sorted.map(e=>e[0]));
  const values=new Float32Array(sorted.flatMap(e=>e[1]));
  const accessor={componentType:5126,count,type:'VEC3',sparse:{count:sorted.length,
    indices:{bufferView:append(Buffer.from(indices.buffer)),componentType:5125},
    values:{bufferView:append(Buffer.from(values.buffer))}}};
  if (withBounds) {
    accessor.min=[0,0,0];accessor.max=[0,0,0];
    for(let i=0;i<values.length;i++) { accessor.min[i%3]=Math.min(accessor.min[i%3],values[i]);accessor.max[i%3]=Math.max(accessor.max[i%3],values[i]); }
  }
  const index=model.accessors.length; model.accessors.push(accessor);return index;
}
function action(name, part) {
  const [s,h,z]=part.centre, {lo,hi}=part;
  if (name==='MESH_SHOULDER_Y_111') {
    if (lo[0]<.03 && hi[0]>1.19 && hi[0]<1.21) return {kind:'outer',hs:.185/.177,zs:.185/.147};
    if (lo[0]>1.16 && lo[0]<1.18 && hi[0]>1.95 && hi[2]<.12) return {kind:'inner',hs:.14/.141,zs:.14/.1155};
    if (hi[0]<1.14 && Math.abs(z)>.18) return {kind:'roll'};
    if (z<-.22 && ((s>1.23 && s<1.41)||(s>1.82 && s<2))) return {kind:'chain'};
  }
  if (name==='MESH_SHOULDER_Y_112' && lo[0]>1.15 && hi[0]<1.26) return {kind:'collar',hs:.200/.1945,zs:.200/.163};
  if (['MESH_SHOULDER_Y_109','MESH_SHOULDER_Y_115','MESH_SHOULDER_Y_116'].includes(name)) return {kind:'roll'};
  if (name==='MESH_SHOULDER_Y_107') {
    if (s>1.2 && s<1.85 && Math.abs(h)<.025) return {kind:'roll'};
    if (s>2.13 && h<-.25 && z<0) return {kind:'chain'};
  }
  if (name==='MESH_SHOULDER_Y_108') {
    if ((Math.abs(s-.175)<.06 || Math.abs(s-1.095)<.06) && Math.abs(h)<.16 && Math.abs(z)>.177) return {kind:'roll'};
    if ((Math.abs(s-1.27)<.05 || Math.abs(s-1.8)<.05) && Math.abs(h)<.04) return {kind:'roll'};
    if (s>2.13 && h<-.25 && z<0) return {kind:'chain'};
  }
  if (name==='MESH_SHOULDER_Y_110' && hi[0]-lo[0]>2) return {kind:'chain'};
  return null;
}

(async () => {
  const d=await createDecoder();
  const chosen=['107','108','109','110','111','112','115','116'].map(id=>'MESH_SHOULDER_Y_'+id);
  let bodyCount=0,innerCount=0,collarCount=0;
  for (const name of chosen) {
    const mesh=model.meshes[nodes[name].mesh], primitive=mesh.primitives[0];
    const ext=primitive.extensions.KHR_draco_mesh_compression, view=model.bufferViews[ext.bufferView];
    const data=source.subarray(view.byteOffset,view.byteOffset+view.byteLength);
    const decoder=new d.Decoder(), input=new d.DecoderBuffer(), geometry=new d.Mesh();
    input.Init(new Int8Array(data),data.length);
    const status=decoder.DecodeBufferToMesh(input,geometry);
    if (!status.ok()) throw Error(name+': '+status.error_msg());
    function floats(semantic) {
      const attribute=decoder.GetAttributeByUniqueId(geometry,ext.attributes[semantic]);
      const values=new d.DracoFloat32Array();decoder.GetAttributeFloatForAllPoints(geometry,attribute,values);
      const array=Float32Array.from({length:values.size()},(_,i)=>values.GetValue(i));d.destroy(values);return array;
    }
    const positions=floats('POSITION'),normals=floats('NORMAL'),indices=new Uint32Array(geometry.num_faces()*3), face=new d.DracoInt32Array();
    for (let i=0;i<geometry.num_faces();i++) { decoder.GetFaceFromMesh(geometry,i,face); for(let k=0;k<3;k++)indices[i*3+k]=face.GetValue(k); }
    const pDelta=[],nDelta=[],parts=[];
    for(const part of components(positions,indices)) {
      const operation=action(name,part);if(!operation)continue;
      const {kind,hs=1,zs=1}=operation;
      if(kind==='outer')bodyCount++;if(kind==='inner')innerCount++;if(kind==='collar')collarCount++;
      parts.push({kind,vertices:part.ids.length,profileBefore:{min:part.lo,max:part.hi}});
      for(const id of part.ids) {
        const p=Array.from(positions.subarray(id*3,id*3+3));
        const n=Array.from(normals.subarray(id*3,id*3+3));
        const next=kind==='chain'?shift(p):roll(p,hs,zs);
        pDelta.push([id,next.map((v,k)=>v-p[k])]);
        if(kind!=='chain') nDelta.push([id,roll(n,hs,zs,true).map((v,k)=>v-n[k])]);
      }
    }
    if(pDelta.length) {
      const target={POSITION:sparse(positions.length/3,pDelta,true)};
      if(nDelta.length)target.NORMAL=sparse(normals.length/3,nDelta,false);
      primitive.targets=[target];mesh.weights=[1];mesh.extras={...mesh.extras,targetNames:['Square_mast_corner_up']};
      report.push({node:name,changedVertices:pDelta.length,parts});
    }
    for(const item of [face,geometry,input,decoder])d.destroy(item);
  }
  if(bodyCount!==1||innerCount!==1||collarCount!==1)throw Error('Could not uniquely identify both tubes and collar');
  // Carrier remains upright, alongside the raised edge. The mounting brackets
  // and their five hoses follow the same rigid displacement.
  nodes.MESH_SHOULDER_Y_113.translation=chainShift;
  const bytes=Buffer.concat(output);
  model.buffers.push({uri:'data:application/octet-stream;base64,'+bytes.toString('base64'),byteLength:bytes.length});
  model.asset.generator='RodBot V8, square mast section correction, 2026-09-21';
  model.extras.photo_revision.boom_elevation_offset_deg=0;
  model.extras.photo_revision.turret_heading_offset_deg=0;
  model.extras.photo_revision.alignment='Original V6 joint pose restored; V8 corrects the mast cross-section';
  model.extras.mast_section_revision={reference:'Four owner screenshots, 2026-09-21',roll_deg:-45,
    profile:'Square tubes with an upper longitudinal corner',outer_side_m:.370,inner_side_m:.280,
    dimensions_status:'Section dimensions estimated from the existing reconstruction; not measured on the machine',
    joints_preserved:true,report};
  fs.writeFileSync(path.join(ASSETS,'rodbot-v8-mast.gltf'),JSON.stringify(model)+'\n');
  console.log(JSON.stringify({file:'rodbot-v8-mast.gltf',sparseBytes:bytes.length,meshes:report.map(r=>({name:r.node,vertices:r.changedVertices,parts:r.parts.length})),animations:model.animations.length}));
})().catch(error=>{console.error(error);process.exitCode=1;});
