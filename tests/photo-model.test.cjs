const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const createDecoder = require('../3d/vendor/draco/draco_decoder.js');

// Follow the published URL; historical V8/V9/V10 tests keep their own fixtures.
const jsRoot = path.join(__dirname, '../3d/js');
const assetSource = fs.readFileSync(path.join(jsRoot, 'model-assets.js'), 'utf8');
const modelUri = assetSource.match(/MODEL_URL\s*=\s*new URL\(['"]([^'"]+)['"]/)[1];
const modelPath = path.resolve(jsRoot, modelUri);
const source = fs.readFileSync(modelPath);
let model, binary;
if (source.readUInt32LE(0) === 0x46546c67) {
  assert.equal(source.readUInt32LE(4), 2, 'GLB version');
  assert.equal(source.readUInt32LE(8), source.length, 'complete GLB');
  for (let offset = 12; offset < source.length;) {
    const length = source.readUInt32LE(offset), type = source.readUInt32LE(offset + 4);
    const chunk = source.subarray(offset + 8, offset + 8 + length);
    assert.equal(chunk.length, length, 'complete GLB chunk');
    if (type === 0x4e4f534a) model = JSON.parse(chunk.toString('utf8').trim());
    if (type === 0x004e4942) binary = chunk;
    offset += 8 + length;
  }
} else model = JSON.parse(source.toString('utf8'));
assert.ok(model, 'active asset contains a glTF document');
const buffers = model.buffers.map(b => !b.uri ? binary : b.uri.startsWith('data:')
  ? Buffer.from(b.uri.split(',')[1], 'base64')
  : fs.readFileSync(path.resolve(path.dirname(modelPath), decodeURIComponent(b.uri))));
const nodeIds = Object.fromEntries(model.nodes.map((n, i) => [n.name, i]));
const parents = new Map();
model.nodes.forEach((n, i) => (n.children || []).forEach(child => parents.set(child, i)));
const multiply = ([x,y,z,w], [X,Y,Z,W]) => [w*X+x*W+y*Z-z*Y,w*Y-x*Z+y*W+z*X,w*Z+x*Y-y*X+z*W,w*W-x*X-y*Y-z*Z];
const rotate = (q,v) => multiply(multiply(q,[...v,0]),[-q[0],-q[1],-q[2],q[3]]).slice(0,3);
const add = (a,b) => a.map((v,i) => v+b[i]);
const distance = (a,b) => Math.hypot(...a.map((v,i) => v-b[i]));
const dot = (a,b) => a.reduce((sum,v,i) => sum+v*b[i],0);
const widthOf = {SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
const readers = {5120:['readInt8',1],5121:['readUInt8',1],5122:['readInt16LE',2],5123:['readUInt16LE',2],5125:['readUInt32LE',4],5126:['readFloatLE',4]};
function accessor(index) {
  const a = model.accessors[index], width = widthOf[a.type], [read, size] = readers[a.componentType];
  const result = Array.from({length:a.count}, () => Array(width).fill(0));
  if (a.bufferView !== undefined) {
    const v = model.bufferViews[a.bufferView], bytes = buffers[v.buffer];
    for (let i=0;i<a.count;i++) for (let k=0;k<width;k++) result[i][k] = bytes[read](
      (v.byteOffset||0)+(a.byteOffset||0)+i*(v.byteStride||width*size)+k*size);
  }
  if (a.sparse) {
    const s = a.sparse, iv = model.bufferViews[s.indices.bufferView], vv = model.bufferViews[s.values.bufferView];
    const [ir,is] = readers[s.indices.componentType];
    for (let i=0;i<s.count;i++) {
      const id = buffers[iv.buffer][ir]((iv.byteOffset||0)+(s.indices.byteOffset||0)+i*is);
      for (let k=0;k<width;k++) result[id][k] = buffers[vv.buffer][read]((vv.byteOffset||0)+(s.values.byteOffset||0)+(i*width+k)*size);
    }
  }
  return result;
}
let decoderPromise;
const decoded = new Map();
async function positions(primitive) {
  if (decoded.has(primitive)) return decoded.get(primitive);
  const ext = primitive.extensions?.KHR_draco_mesh_compression;
  let points;
  if (ext) {
    const d = await (decoderPromise ||= createDecoder());
    const decoder = new d.Decoder(), input = new d.DecoderBuffer(), geometry = new d.Mesh(), values = new d.DracoFloat32Array(), face = new d.DracoInt32Array();
    try {
      const v = model.bufferViews[ext.bufferView], bytes = buffers[v.buffer].subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);
      input.Init(new Int8Array(bytes),bytes.length);
      assert.ok(decoder.DecodeBufferToMesh(input,geometry).ok(), 'Draco geometry decodes');
      const attribute = decoder.GetAttributeByUniqueId(geometry,ext.attributes.POSITION);
      assert.ok(decoder.GetAttributeFloatForAllPoints(geometry,attribute,values));
      points = Array.from({length:values.size()/3}, (_,i) => [0,1,2].map(k => values.GetValue(i*3+k)));
      points.indices=[];
      for(let i=0;i<geometry.num_faces();i++) {
        decoder.GetFaceFromMesh(geometry,i,face);
        points.indices.push(face.GetValue(0),face.GetValue(1),face.GetValue(2));
      }
    } finally { for (const object of [face,values,geometry,input,decoder]) d.destroy(object); }
  } else {
    points = accessor(primitive.attributes.POSITION);
    points.indices=primitive.indices===undefined?points.map((_,i)=>i):accessor(primitive.indices).flat();
  }
  decoded.set(primitive,points);
  return points;
}
function transform(point,node,overrides={}) {
  if (node.matrix) {
    const m=node.matrix;
    return [0,1,2].map(k=>m[k]*point[0]+m[k+4]*point[1]+m[k+8]*point[2]+m[k+12]);
  }
  const scale=overrides.scale||node.scale||[1,1,1];
  return add(rotate(overrides.rotation||node.rotation||[0,0,0,1], point.map((v,i)=>v*scale[i])),overrides.translation||node.translation||[0,0,0]);
}
function worldPoint(index,point,pose=new Map()) {
  for (let cursor=index;cursor!==undefined;cursor=parents.get(cursor)) point=transform(point,model.nodes[cursor],pose.get(cursor));
  return point;
}
async function geometryUnder(index) {
  const result=[];
  result.indices=[];
  async function visit(id,chain) {
    const node=model.nodes[id];
    if (node.mesh!==undefined) {
      const mesh=model.meshes[node.mesh],weights=node.weights||mesh.weights||[];
      for (const p of mesh.primitives) {
        const base=await positions(p),targets=(p.targets||[]).map(t=>t.POSITION===undefined?null:accessor(t.POSITION));
        const offset=result.length;
        result.indices.push(...base.indices.map(i=>offset+i));
        for(let i=0;i<base.length;i++) {
          let point=base[i].slice();
          targets.forEach((target,j)=>{if(target&&weights[j]) point=point.map((v,k)=>v+weights[j]*target[i][k]);});
          // Geometry is returned in the named assembly's local frame.
          for(let j=chain.length-1;j>=0;j--) point=transform(point,model.nodes[chain[j]]);
          result.push(point);
        }
      }
    }
    for(const child of node.children||[]) await visit(child,[...chain,child]);
  }
  await visit(index,[]);
  assert.ok(result.length,'mesh descendants of '+model.nodes[index].name);
  return result;
}
function interpolated(track,time) {
  const {times,values,path:property,interpolation}=track;
  if(time<=times[0]) return values[0];
  if(time>=times.at(-1)) return values.at(-1);
  let i=0; while(times[i+1]<time) i++;
  if(interpolation==='STEP') return values[i];
  const f=(time-times[i])/(times[i+1]-times[i]),a=values[i],b=values[i+1].slice();
  if(property!=='rotation') return a.map((v,k)=>v+(b[k]-v)*f);
  let cosine=dot(a,b); if(cosine<0){cosine=-cosine;for(let k=0;k<4;k++) b[k]=-b[k];}
  const angle=Math.acos(Math.min(1,cosine));
  const q=angle<1e-6?a.map((v,k)=>v+(b[k]-v)*f):a.map((v,k)=>(v*Math.sin((1-f)*angle)+b[k]*Math.sin(f*angle))/Math.sin(angle));
  const norm=Math.hypot(...q); return q.map(v=>v/norm);
}

test('active photo model and every buffer view resolve completely', () => {
  assert.match(modelPath,/\.(?:gltf|glb)$/i);
  model.buffers.forEach((b,i) => {
    assert.ok(buffers[i], 'buffer '+i);
    assert.ok(buffers[i].length>=b.byteLength);
    assert.ok(buffers[i].length-b.byteLength<(!b.uri?4:1),'only GLB alignment may add padding');
  });
  for (const v of model.bufferViews) assert.ok((v.byteOffset||0)+v.byteLength<=model.buffers[v.buffer].byteLength);
});
test('shared model, poster, lighting and decoder URLs resolve from the 3D module', () => {
  for(const key of ['MODEL_URL','POSTER_URL','ENVIRONMENT_URL','DRACO_URL']) {
    const uri=assetSource.match(new RegExp(key+"\\s*=\\s*new URL\\(['\"]([^'\"]+)['\"]"))?.[1];
    assert.ok(uri,key+' remains relative to import.meta.url');
    assert.ok(uri.startsWith('../'),key+' works under a GitHub Pages subpath');
    assert.ok(fs.existsSync(path.resolve(jsRoot,uri)),key+' exists');
  }
});
test('dense Draco geometry keeps enough index bits after UV and normal splitting', () => {
  for (const mesh of model.meshes) for (const primitive of mesh.primitives) {
    if (!primitive.extensions?.KHR_draco_mesh_compression) continue;
    const vertices = model.accessors[primitive.attributes.POSITION].count;
    const indices = model.accessors[primitive.indices];
    assert.ok([5121, 5123, 5125].includes(indices.componentType), mesh.name + ' unsigned indices');
    const capacity = {5121: 256, 5123: 65536, 5125: 4294967296}[indices.componentType];
    assert.ok(vertices <= capacity, mesh.name + ' can address all ' + vertices + ' decoded vertices');
  }
});
test('active model preserves all 36 named animation contracts and their targets', () => {
  const expected=['Presentation_360','Rotation_tourelle','Elevation_bras','Inclinaison_pince','Rotation_pince','Ouverture_pince','Stabilisateurs','Ouvrir_panneau','Selection_commande',
    ...Array.from({length:7},(_,i)=>'SIM_front'+String(i+1).padStart(2,'0')),
    ...Array.from({length:5},(_,i)=>'SIM_side'+String(i+1).padStart(2,'0')),
    ...['js1x','js1y','js2','js3x','js3y'].map(s=>'SIM_'+s),
    ...['u1','u2','u3','u4','grip','rearm','start','mode_linear','mode_direct','mode_standby'].map(s=>'SIM_press_'+s)];
  assert.deepEqual(model.animations.map(a=>a.name).sort(),expected.sort());
  for(const animation of model.animations) for(const channel of animation.channels) {
    assert.ok(model.nodes[channel.target.node],animation.name+' target');
    assert.ok(['rotation','translation','scale','weights'].includes(channel.target.path));
    const sampler=animation.samplers[channel.sampler],times=accessor(sampler.input).flat();
    assert.ok(times.every((t,i)=>Number.isFinite(t)&&(i===0||t>times[i-1])),animation.name+' times');
    assert.ok(accessor(sampler.output).flat().every(Number.isFinite),animation.name+' samples');
    if(animation.name!=='Presentation_360') assert.ok(times.at(-1)>1,animation.name+' retains the endpoint hold');
  }
});
test('lift cylinder stays connected at every actual arm keyframe without mesh-number assumptions', async () => {
  const animation=model.animations.find(a=>a.name==='Elevation_bras');
  const tracks=animation.channels.map(c=>{
    const s=animation.samplers[c.sampler];
    assert.ok(!s.interpolation||['LINEAR','STEP'].includes(s.interpolation));
    return {node:c.target.node,path:c.target.path,times:accessor(s.input).flat(),values:accessor(s.output),interpolation:s.interpolation||'LINEAR'};
  });
  for(const name of ['CTRL_SHOULDER_Y','HYD_LIFT_BASE','HYD_LIFT_ROD','HYD_LIFT_TIP']) assert.ok(nodeIds[name]!==undefined,name);
  const rodPoints=await geometryUnder(nodeIds.HYD_LIFT_ROD);
  // glTF uses local +Y along this cylinder. Measure its mesh descendants,
  // including static transforms between the named pivot and the chrome rod.
  const tipY=Math.max(...rodPoints.map(p=>p[1]));
  assert.ok(tipY>0,'positive chrome length');
  const times=[...new Set(tracks.flatMap(t=>t.times))].sort((a,b)=>a-b);
  assert.ok(times.length>2,'mechanical movement has more than endpoint samples');
  for(const time of times) {
    const pose=new Map();
    for(const track of tracks) pose.set(track.node,{...pose.get(track.node),[track.path]:interpolated(track,time)});
    const end=worldPoint(nodeIds.HYD_LIFT_TIP,[0,0,0],pose);
    const chromeEnd=worldPoint(nodeIds.HYD_LIFT_ROD,[0,tipY,0],pose);
    assert.ok(distance(end,chromeEnd)<.0002,'hydraulic attachment at '+time+' s: '+distance(end,chromeEnd)+' m');
  }
});
test('initial gripper stays vertical after mast correction', () => {
  const shoulder=model.nodes[nodeIds.CTRL_SHOULDER_Y],wrist=model.nodes[nodeIds.CTRL_WRIST_Y];
  const q=multiply(shoulder.rotation||[0,0,0,1],wrist.rotation||[0,0,0,1]);
  assert.ok(distance(rotate(q,[0,-1,0]),[0,-1,0])<.000001);
});
test('all seven rods have a 6 foot assembly length and a 5 inch central barrel', async () => {
  for(let i=1;i<=7;i++) {
    const name='PROP_ROD_'+String(i).padStart(2,'0'),id=nodeIds[name];
    assert.ok(id!==undefined,name);
    const origin=worldPoint(id,[0,0,0]);
    const axes=[[1,0,0],[0,1,0],[0,0,1]].map(axis=>{
      const end=worldPoint(id,axis),vector=end.map((v,k)=>v-origin[k]),length=Math.hypot(...vector);
      return vector.map(v=>v/length);
    });
    const geometry=await geometryUnder(id);
    const points=geometry.map(p=>{
      const world=worldPoint(id,p).map((v,k)=>v-origin[k]);return axes.map(axis=>dot(world,axis));
    });
    const min=Math.min(...points.map(p=>p[0])),max=Math.max(...points.map(p=>p[0])),length=max-min;
    assert.ok(Math.abs(length-1.8288)<.0002,name+' measured length '+length);
    // End couplings are wider than the barrel and must not define its diameter.
    // Long cylinders need not have vertices at their centre. Intersect actual
    // triangle edges with the mid-plane, rather than select endpoint vertices.
    const barrel=[],plane=(min+max)/2;
    for(let f=0;f<geometry.indices.length;f+=3) {
      const triangle=geometry.indices.slice(f,f+3).map(index=>points[index]);
      for(let j=0;j<3;j++) {
        const a=triangle[j],b=triangle[(j+1)%3];
        if((a[0]-plane)*(b[0]-plane)>0||Math.abs(a[0]-b[0])<1e-12) continue;
        const fraction=(plane-a[0])/(b[0]-a[0]);
        barrel.push(a.map((v,k)=>v+(b[k]-v)*fraction));
      }
    }
    assert.ok(barrel.length>20,name+' central barrel section');
    for(const axis of [1,2]) {
      const diameter=Math.max(...barrel.map(p=>p[axis]))-Math.min(...barrel.map(p=>p[axis]));
      assert.ok(Math.abs(diameter-.127)<.0002,name+' measured barrel diameter '+diameter);
    }
  }
});
