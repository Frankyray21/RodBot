/* Photo-based rear detail pass. Run after refine-mast-section.cjs.
 * No external packages: geometry is appended, original Draco meshes and all
 * rig/animation indices are retained. Dimensions are visual estimates.
 */
const fs = require('node:fs');
const path = require('node:path');
const createDecoder = require('../3d/vendor/draco/draco_decoder.js');
const dir = path.join(__dirname, '../3d/assets');
const m = JSON.parse(fs.readFileSync(path.join(dir, 'rodbot-v8-mast.gltf')));
const source = fs.readFileSync(path.join(dir, 'rodbot-v6-c9499d45.glb'));
const nodes = Object.fromEntries(m.nodes.map(n => [n.name, n]));
const chunks = []; let length = 0;
const bufferIndex = m.buffers.length;
function view(bytes, target) {
  const pad = (4 - length % 4) % 4;
  if (pad) { chunks.push(Buffer.alloc(pad)); length += pad; }
  const i = m.bufferViews.length;
  m.bufferViews.push({buffer:bufferIndex, byteOffset:length, byteLength:bytes.length, ...(target ? {target} : {})});
  chunks.push(bytes); length += bytes.length; return i;
}
function accessor(array, type, componentType, target, bounds=false) {
  const width = {SCALAR:1, VEC2:2, VEC3:3}[type];
  const a = {bufferView:view(Buffer.from(array.buffer),target), componentType, count:array.length/width, type};
  if (bounds) {
    a.min=Array(width).fill(Infinity); a.max=Array(width).fill(-Infinity);
    array.forEach((v,i)=>{a.min[i%width]=Math.min(a.min[i%width],v);a.max[i%width]=Math.max(a.max[i%width],v);});
  }
  const i=m.accessors.length;m.accessors.push(a);return i;
}
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const mul=(a,s)=>a.map(v=>v*s);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>mul(a,1/Math.hypot(...a));
const lerp=(a,b,t)=>add(mul(a,1-t),mul(b,t));
function basis(axis) {
  const u=unit(cross(axis,Math.abs(axis[1])<.9?[0,1,0]:[1,0,0]));
  return [u,cross(axis,u)];
}
function material(name,color,metal,rough,extra={}) {
  const i=m.materials.length;
  m.materials.push({name:'Rear V9 | '+name,pbrMetallicRoughness:{baseColorFactor:[...color,1],metallicFactor:metal,roughnessFactor:rough},...extra});return i;
}
const MAT={
  red:material('red frame',[.31,.018,.025],.12,.34),
  rubber:material('rubber hoses',[.009,.012,.014],0,.68),
  wrap:material('spiral sleeve',[.018,.021,.024],0,.42),
  steel:material('zinc plated unions',[.48,.51,.51],.86,.28),
  dark:material('valve iron',[.045,.053,.057],.64,.38),
  yellow:material('yellow electrical cables',[.78,.51,.012],0,.48),
  gray:material('gray electrical cable',[.32,.35,.34],0,.62),
  blue:material('blue connector',[.035,.11,.23],0,.52),
  reflector:material('faceted LED reflector',[.70,.74,.76],.87,.2),
  lens:material('clear lens ribs',[.72,.80,.83],.18,.16),
  chip:material('LED chips',[.88,.81,.4],.05,.3),
  redLens:material('round red lamps',[.42,.006,.012],.2,.2),
  white:material('cable identification bands',[.67,.70,.64],0,.64)
};
const groups=new Map(); let current;
function group(name) {current=new Map();groups.set(name,current);}
function geom(mat) {if(!current.has(mat))current.set(mat,{p:[],n:[],i:[]});return current.get(mat);}
function triangle(mat,a,b,c,na,nb,nc) {
  const g=geom(mat),i=g.p.length/3;
  if(!na)na=nb=nc=unit(cross(sub(b,a),sub(c,a)));
  g.p.push(...a,...b,...c);g.n.push(...na,...nb,...nc);g.i.push(i,i+1,i+2);
}
function quad(mat,a,b,c,d,normal) {triangle(mat,a,b,c,normal,normal,normal);triangle(mat,a,c,d,normal,normal,normal);}
function box(mat,c,size) {
  const h=mul(size,.5),v=[];
  for(let i=0;i<8;i++)v.push(add(c,h.map((x,k)=>(i&(1<<k))?x:-x)));
  for(const f of [[0,4,6,2],[1,3,7,5],[0,1,5,4],[2,6,7,3],[0,2,3,1],[4,5,7,6]])quad(mat,...f.map(i=>v[i]));
}
function cylinder(mat,a,b,r,segments=16,r2=r,cap=true) {
  const axis=unit(sub(b,a)),[u,v]=basis(axis),normals=[],p=[],q=[];
  for(let j=0;j<segments;j++){
    const angle=j*2*Math.PI/segments,radial=add(mul(u,Math.cos(angle)),mul(v,Math.sin(angle)));
    normals.push(unit(add(radial,mul(axis,(r-r2)/Math.hypot(...sub(b,a))))));
    p.push(add(a,mul(radial,r)));q.push(add(b,mul(radial,r2)));
  }
  for(let j=0;j<segments;j++){
    const k=(j+1)%segments;
    if(segments===6){quad(mat,p[j],p[k],q[k],q[j]);}
    else {triangle(mat,p[j],p[k],q[k],normals[j],normals[k],normals[k]);triangle(mat,p[j],q[k],q[j],normals[j],normals[k],normals[j]);}
    if(cap){triangle(mat,a,p[k],p[j],mul(axis,-1),mul(axis,-1),mul(axis,-1));triangle(mat,b,q[j],q[k],axis,axis,axis);}
  }
}
function sphere(mat,c,r,segments=16,rings=8,scale=[1,1,1]) {
  const pt=(i,j)=>{const t=Math.PI*(i+.001)/(rings+.002),a=j*2*Math.PI/segments;
    const n=[Math.sin(t)*Math.cos(a),Math.cos(t),Math.sin(t)*Math.sin(a)];
    return [add(c,n.map((v,k)=>v*r*scale[k])),unit(n.map((v,k)=>v/scale[k]))];};
  for(let i=0;i<rings;i++)for(let j=0;j<segments;j++){
    const [a,na]=pt(i,j),[b,nb]=pt(i+1,j),[c,nc]=pt(i+1,j+1),[d,nd]=pt(i,j+1);
    triangle(mat,a,c,b,na,nc,nb);triangle(mat,a,d,c,na,nd,nc);
  }
}
function bezier(points,steps=28) {
  return Array.from({length:steps+1},(_,i)=>{
    const t=i/steps,s=1-t;return points[0].map((_,k)=>s*s*s*points[0][k]+3*s*s*t*points[1][k]+3*s*t*t*points[2][k]+t*t*t*points[3][k]);
  });
}
function tube(mat,points,r,sides=10) {
  const rings=[],ns=[];
  // Parallel transport keeps seams and the spiral wrapping stable at bends.
  let u;
  for(let i=0;i<points.length;i++){
    const axis=unit(sub(points[Math.min(i+1,points.length-1)],points[Math.max(i-1,0)]));
    u=u?unit(sub(u,mul(axis,u.reduce((s,x,k)=>s+x*axis[k],0)))):basis(axis)[0];
    const v=cross(axis,u),normals=Array.from({length:sides},(_,j)=>add(mul(u,Math.cos(j*2*Math.PI/sides)),mul(v,Math.sin(j*2*Math.PI/sides))));
    ns.push(normals);rings.push(normals.map(n=>add(points[i],mul(n,r))));
  }
  for(let i=0;i<points.length-1;i++)for(let j=0;j<sides;j++){
    const k=(j+1)%sides;
    triangle(mat,rings[i][j],rings[i][k],rings[i+1][k],ns[i][j],ns[i][k],ns[i+1][k]);
    triangle(mat,rings[i][j],rings[i+1][k],rings[i+1][j],ns[i][j],ns[i+1][k],ns[i+1][j]);
  }
}
function hose(points,r=.013,wrapped=false) {
  // Keep the bend radius larger than the hose diameter. Tight decorative
  // Béziers otherwise fold the inner wall through itself near the fittings.
  let controls=points.map(v=>v.slice()),p;
  for(let attempt=0;attempt<20;attempt++){
    p=bezier(controls,48);let minRadius=Infinity;
    for(let i=1;i<p.length-1;i++){
      const a=sub(p[i],p[i-1]),b=sub(p[i+1],p[i]),c=sub(p[i+1],p[i-1]);
      const area2=Math.hypot(...cross(a,b));
      if(area2>1e-12)minRadius=Math.min(minRadius,Math.hypot(...a)*Math.hypot(...b)*Math.hypot(...c)/(2*area2));
    }
    if(minRadius>2*r)break;
    controls[1]=lerp(controls[1],lerp(points[0],points[3],1/3),.25);
    controls[2]=lerp(controls[2],lerp(points[0],points[3],2/3),.25);
    if(attempt===19)throw Error('Hose bend cannot be resolved');
  }
  tube(MAT.rubber,p,r,12);
  if(wrapped){
    const helix=[];let transported;
    for(let i=0;i<180;i++){
      const t=i/179*(p.length-1),j=Math.min(p.length-2,Math.floor(t)),center=lerp(p[j],p[j+1],t-j);
      const axis=unit(sub(p[j+1],p[j])),angle=i*.50;
      transported=transported?unit(sub(transported,mul(axis,transported.reduce((s,x,k)=>s+x*axis[k],0)))):basis(axis)[0];
      const u=transported,v=cross(axis,u);
      helix.push(add(center,add(mul(u,Math.cos(angle)*(r+.0008)),mul(v,Math.sin(angle)*(r+.0008)))));
    }
    tube(MAT.wrap,helix,.0025,6);
    for(let j=3;j<p.length-2;j+=7){const axis=unit(sub(p[j+1],p[j-1]));cylinder(MAT.yellow,add(p[j],mul(axis,-.002)),add(p[j],mul(axis,.002)),r+.0015,12);}
  }
  return p;
}
function union(c,axis,r=.018) {
  const at=t=>add(c,mul(axis,t));
  cylinder(MAT.steel,at(-.026),at(.026),r*.68,16);
  cylinder(MAT.steel,at(-.024),at(-.007),r,6);
  cylinder(MAT.steel,at(.005),at(.022),r*.97,6);
  cylinder(MAT.dark,at(-.005),at(.003),r*.75,16);
}
function screw(c,axis,r=.006) {
  cylinder(MAT.steel,add(c,mul(axis,-.002)),add(c,mul(axis,.001)),r*1.22,16);
  cylinder(MAT.steel,add(c,mul(axis,.001)),add(c,mul(axis,.006)),r,6);
}

async function openBay() {
  const d=await createDecoder(),changes=[];
  for(const name of ['MESH_EQUIPMENT_016','MESH_EQUIPMENT_026','MESH_EQUIPMENT_027']){
    const mesh=m.meshes[nodes[name].mesh],p=mesh.primitives[0],ext=p.extensions.KHR_draco_mesh_compression,bv=m.bufferViews[ext.bufferView];
    const decoder=new d.Decoder(),input=new d.DecoderBuffer(),geometry=new d.Mesh();
    input.Init(new Int8Array(source.subarray(bv.byteOffset,bv.byteOffset+bv.byteLength)),bv.byteLength);
    if(!decoder.DecodeBufferToMesh(input,geometry).ok())throw Error('Cannot decode '+name);
    function values(semantic){const a=decoder.GetAttributeByUniqueId(geometry,ext.attributes[semantic]),v=new d.DracoFloat32Array();decoder.GetAttributeFloatForAllPoints(geometry,a,v);const out=Float32Array.from({length:v.size()},(_,i)=>v.GetValue(i));d.destroy(v);return out;}
    const pos=values('POSITION'),norm=values('NORMAL'),ids=[],delta=[],dn=[];
    // Select a complete welded component, never vertices belonging to nearby
    // shelves. This preserves the surrounding frame and its original shape.
    const parent=Array.from({length:pos.length/3},(_,i)=>i),seen=new Map();
    const find=i=>parent[i]===i?i:parent[i]=find(parent[i]);
    const join=(a,b)=>{parent[find(a)]=find(b);};
    for(let i=0;i<parent.length;i++){const key=Array.from(pos.subarray(i*3,i*3+3),v=>Math.round(v*1e5)).join(',');if(seen.has(key))join(i,seen.get(key));else seen.set(key,i);}
    const face=new d.DracoInt32Array();
    for(let i=0;i<geometry.num_faces();i++){decoder.GetFaceFromMesh(geometry,i,face);join(face.GetValue(0),face.GetValue(1));join(face.GetValue(0),face.GetValue(2));}
    d.destroy(face);
    const parts=new Map();
    for(let i=0;i<parent.length;i++){const key=find(i);if(!parts.has(key))parts.set(key,{ids:[],lo:[Infinity,Infinity,Infinity],hi:[-Infinity,-Infinity,-Infinity]});const part=parts.get(key);part.ids.push(i);for(let k=0;k<3;k++){part.lo[k]=Math.min(part.lo[k],pos[i*3+k]);part.hi[k]=Math.max(part.hi[k],pos[i*3+k]);}}
    const bounds={MESH_EQUIPMENT_016:[[-1.398,1.053,-.345],[-1.374,1.265,.345]],MESH_EQUIPMENT_026:[[-1.41,.797,-.55],[-.65,1.097,.55]],MESH_EQUIPMENT_027:[[-1.37,.972,-.385],[-.89,1.462,.385]]}[name];
    const matches=[...parts.values()].filter(p=>p.lo.every((v,k)=>Math.abs(v-bounds[0][k])<.0002)&&p.hi.every((v,k)=>Math.abs(v-bounds[1][k])<.0002));
    if(matches.length!==1)throw Error('Cannot uniquely identify service bay part '+name);
    const selected=new Set(matches[0].ids);
    const shelf=new Set();
    if(name==='MESH_EQUIPMENT_026'){
      const shelves=[...parts.values()].filter(p=>p.lo.every((v,k)=>Math.abs(v-[-1.3635,.8835,.5455][k])<.0002)&&p.hi.every((v,k)=>Math.abs(v-[-.7745,.8965,.7585][k])<.0002));
      if(shelves.length!==1)throw Error('Cannot identify cabinet mounting shelf');
      for(const i of shelves[0].ids){selected.add(i);shelf.add(i);}
    }
    for(let i=0;i<pos.length/3;i++){
      if(!selected.has(i))continue;
      const [x,y,z]=pos.subarray(i*3,i*3+3);let next=null,scale=[1,1,1];
      // Replace the deep solid rear block by its far wall. The open cavity
      // now exposes the valve connections beneath the turret platform.
      if(name==='MESH_EQUIPMENT_027'){scale=[.0625,1,1];next=[-.89+(x+.89)*scale[0],y,z];}
      if(name==='MESH_EQUIPMENT_016')next=[x+.47,y,z];
      // The lower plinth becomes the tray floor, leaving space under cabinets.
      if(name==='MESH_EQUIPMENT_026'){scale=[1,.14,1];next=[x,.797+(y-.797)*.14,z];}
      if(shelf.has(i)){scale=[1,1,.1185/.213];next=[x,y,.7585+(z-.7585)*scale[2]];}
      if(next){ids.push(i);delta.push(...next.map((v,k)=>v-pos[i*3+k]));const normal=unit(Array.from(norm.subarray(i*3,i*3+3),(v,k)=>v/scale[k]));dn.push(...normal.map((v,k)=>v-norm[i*3+k]));}
    }
    if(!ids.length)throw Error('No cavity vertices in '+name);
    function sparse(values,bounds){const a={componentType:5126,count:pos.length/3,type:'VEC3',sparse:{count:ids.length,indices:{bufferView:view(Buffer.from(new Uint32Array(ids).buffer)),componentType:5125},values:{bufferView:view(Buffer.from(new Float32Array(values).buffer))}}};
      if(bounds){a.min=[0,0,0];a.max=[0,0,0];values.forEach((v,k)=>{a.min[k%3]=Math.min(a.min[k%3],Math.fround(v));a.max[k%3]=Math.max(a.max[k%3],Math.fround(v));});}
      const index=m.accessors.length;m.accessors.push(a);return index;}
    p.targets=[{POSITION:sparse(delta,true),NORMAL:sparse(dn,false)}];mesh.weights=[1];mesh.extras={...mesh.extras,targetNames:['Open_rear_service_bay']};
    changes.push({node:name,vertices:ids.length});for(const o of [geometry,input,decoder])d.destroy(o);
  }
  return changes;
}

(async()=>{
 const changes=await openBay();
 group('REAR_V9_Open_frame');
 for(const z of [-.36,.36]){
   box(MAT.red,[-1.30,1.237,z],[.045,.33,.024]);
   box(MAT.red,[-1.10,.85,z],[.45,.022,.044]);
   for(const y of [1.12,1.355])screw([-1.328,y,z],[-1,0,0],.008);
 }
 box(MAT.red,[-1.305,1.295,0],[.065,.009,.52]);
 for(const z of [-.37,.37])for(const y of [.87,1.085])screw([-1.478,y,z],[-1,0,0],.009);
 for(const z of [-.57,.57]){
   box(MAT.red,[-1.08,.847,z],[.53,.018,.024]);
   box(MAT.red,[-.80,.907,z],[.028,.126,.025]);
   screw([-.815,.939,z],[0,0,Math.sign(z)],.009);
 }

 group('REAR_V9_Valve_bank_and_manifold');
 for(let j=0;j<7;j++){
   const z=(j-3)*.084;
   box(MAT.dark,[-1.37,1.155,z],[.094,.079,.066]);
   cylinder(MAT.steel,[-1.402,1.122,z],[-1.328,1.122,z],.012,14);
   union([-1.37,1.225,z],[0,1,0],.014);
   const endZ=(j-3)*.048;
   hose([[-1.37,1.251,z],[-1.365,1.278,z],[-1.29,1.25,endZ],[-1.305,1.267,endZ]],.009);
   // Rubber bellows at the lever pivot. Original moving levers are retained.
   for(let k=0;k<4;k++)cylinder(MAT.rubber,[-1.466-k*.004,1.149+k*.0013,z],[-1.470-k*.004,1.150+k*.0013,z],.011-k*.001,12);
   const n=nodes['MESH_PANEL_FRONT_'+String(j+1).padStart(2,'0')+'_'+String(84+j*2).padStart(3,'0')];
   const scale=[.86,1.20,1.25],center=[-.132,.045,0];
   n.scale=scale;n.translation=center.map((v,i)=>v*(1-scale[i]));
 }
 for(let j=0;j<4;j++){
   const z=(j-1.5)*.085;
   cylinder(MAT.steel,[-1.305,1.27,z],[-1.305,1.394,z],.014,16);
   for(const y of [1.257,1.307,1.359])union([-1.305,y,z],[0,1,0],.024);
   hose([[-1.305,1.387,z],[-1.29,1.404,z],[-1.05,1.41,z],[-1.00,1.39,z]],.013);
   hose([[-1.305,1.230,z],[-1.29,1.213,z],[-1.32,1.215,z],[-1.34,1.222,z]],.011);
 }
 hose([[-1.05,1.399,-.28],[-1.26,1.407,-.29],[-1.31,1.404,.1],[-1.08,1.38,.28]],.024,true);

 group('REAR_V9_Cabinet_connectors_and_wiring');
 // Right cabinet underside is y=.970. Individual plugs and cables occupy the
 // photographed open space; they attach to the fixed cabinet, not its door.
 const ports=[[-1.205,.535,'rubber',.022],[-1.12,.54,'yellow',.012],[-1.055,.56,'gray',.012],[-.99,.56,'blue',.011],[-.925,.56,'yellow',.013]];
 ports.forEach(([x,z,color,r],i)=>{
   cylinder(MAT.steel,[x,.966,z],[x,.946,z],r*1.3,6);
   cylinder(MAT.steel,[x,.946,z],[x,.921,z],r*1.14,20);
   cylinder(MAT[color],[x,.921,z],[x,.881,z],r,16,r*.82);
   for(let k=0;k<5;k++)cylinder(MAT[color],[x,.915-k*.005,z],[x,.912-k*.005,z],r*1.06,16);
   if(i===0){
     // Knurled metal collar on the large black cable gland.
     for(let k=0;k<28;k++){const a=k*2*Math.PI/28,c=[x+Math.cos(a)*r*1.15,.934,z+Math.sin(a)*r*1.15];cylinder(MAT.steel,add(c,[0,-.01,0]),add(c,[0,.01,0]),.001,5);}
     const power=hose([[x,.881,z],[x-.01,.817,z],[-1.30,.766,.60],[-1.43,.781,.55]],.020,true);
     for(const j of [16,28]){const axis=unit(sub(power[j+1],power[j-1])),c=power[j];cylinder(MAT.white,add(c,mul(axis,-.003)),add(c,mul(axis,.003)),.024,16);}
   } else {
     const end=[-.88+i*.009,.816,.47-i*.019];
     tube(MAT[color==='blue'?'gray':color],bezier([[x,.881,z],[x-.04,.773-i*.006,z+.05],[-1.24,.783,.48],end]),.0065,10);
   }
 });
 for(let i=0;i<3;i++){
   const y=.866+i*.030;
   box(MAT.dark,[-.80,y,.51],[.033,.026,.034]);
   union([-.833,y,.51],[-1,0,0],.011);
   cylinder(MAT.yellow,[-.86,y,.51],[-.91,y,.51],.012,14);
   tube(MAT.yellow,bezier([[-.91,y,.51],[-1.02,y-.01,.51],[-1.1,.79,.47],[-1.01,.788,.40-i*.025]]),.006,10);
 }
 hose([[-.80,.866,.51],[-1.42,.78,.65],[-1.01,.755,.68],[-.76,.82,.54]],.018,true);
 // A smaller loom exits the opposite electrical cabinet.
 for(let i=0;i<3;i++){
   const x=-1.16+i*.105;
   union([x,.883,-.55],[0,1,0],.013);
   tube(i===1?MAT.yellow:MAT.rubber,bezier([[x,.857,-.55],[x-.03,.78,-.6],[-1.27,.79,-.6],[-1.38,.82,-.45]]),i===1?.005:.009,10);
 }

 group('REAR_V9_Lights_and_panel_hardware');
 for(const sign of [-1,1]){
   const z=sign*.528;
   for(const dz of [-.104,.104])screw([-1.696,.785,z+dz],[-1,0,0],.006);
   // Six reflector cups per existing light housing, with visible lens ridges.
   for(let j=0;j<6;j++){
     const zz=z+(j-2.5)*.034;
     cylinder(MAT.dark,[-1.698,.785,zz],[-1.7,.785,zz],.0155,20);
     cylinder(MAT.reflector,[-1.701,.785,zz],[-1.708,.785,zz],.005,20,.0145,false);
     sphere(MAT.lens,[-1.709,.785,zz],.014,16,8,[.21,1,1]);
     box(MAT.chip,[-1.713,.794,zz],[.0015,.004,.004]);
     for(let k=-2;k<=2;k++)cylinder(MAT.lens,[-1.713,.774,zz+k*.0035],[-1.713,.796,zz+k*.0035],.00065,5);
   }
   cylinder(MAT.rubber,[-1.67,.611,sign*.486],[-1.682,.611,sign*.486],.032,24);
   cylinder(MAT.dark,[-1.682,.611,sign*.486],[-1.686,.611,sign*.486],.0275,24);
   sphere(MAT.redLens,[-1.689,.611,sign*.486],.024,24,12,[.22,1,1]);
   screw([-1.679,.745,sign*.674],[-1,0,0],.006);
 }
 // Exposed plate fixings and hose-crimp grooves at the four supply ports.
 for(const z of [-.225,.322])screw([-1.782,.817,z],[-1,0,0],.006);
 for(const [z,r] of [[-.17,.030],[-.015,.029],[.16,.016],[.275,.014]]){
   for(let k=0;k<5;k++)cylinder(MAT.steel,[-1.847-k*.007,.777,z],[-1.850-k*.007,.777,z],r,18);
 }

 const added=[];
 for(const [name,materials] of groups){
   const primitives=[];
   for(const [mat,g] of materials){
     const unique=new Map(),p=[],n=[],indices=[];
     for(let i=0;i<g.p.length;i+=3){
       const position=g.p.slice(i,i+3),normal=g.n.slice(i,i+3);
       const key=[...position,...normal].map(v=>Math.round(v*1e7)).join(',');
       if(!unique.has(key)){unique.set(key,p.length/3);p.push(...position);n.push(...normal);}
       indices.push(unique.get(key));
     }
     const pa=accessor(new Float32Array(p),'VEC3',5126,34962,true);
     const na=accessor(new Float32Array(n),'VEC3',5126,34962);
     const ix=accessor(new Uint32Array(indices),'SCALAR',5125,34963);
     primitives.push({attributes:{POSITION:pa,NORMAL:na},indices:ix,material:mat});
   }
   const mesh=m.meshes.length;m.meshes.push({name,primitives});
   const node=m.nodes.length;m.nodes.push({name,mesh,extras:{reference:'Owner rear close-ups, 2026-09-21',dimensions:'Estimated from photographs'}});
   nodes.CTRL_EQUIPMENT.children.push(node);added.push({name,node,primitives:primitives.length});
 }
 const bytes=Buffer.concat(chunks);
 m.buffers.push({uri:'rodbot-v9-rear.bin',byteLength:bytes.length});
 m.asset.generator='RodBot V9, rear mechanical and electrical details, 2026-09-21';
 m.extras.rear_detail_revision={reference:'Six owner rear close-ups, 2026-09-21',changes,added,
   notes:'Visible fittings and cable routes reconstructed visually. Hidden hydraulic connections and all dimensions remain estimates. Original controls, animations and square mast retained.'};
 fs.writeFileSync(path.join(dir,'rodbot-v9-rear.bin'),bytes);
 fs.writeFileSync(path.join(dir,'rodbot-v9-rear.gltf'),JSON.stringify(m)+'\n');
 console.log(JSON.stringify({bytes:bytes.length,groups:added,changes,animations:m.animations.length}));
})().catch(e=>{console.error(e);process.exitCode=1;});
