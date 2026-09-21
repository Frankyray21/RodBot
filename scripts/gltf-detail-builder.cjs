/* Geometry helpers for photo detail passes. Primitives are merged by material,
 * welded by position and normal, and attached to their actual moving rig node.
 */
module.exports=function detailBuilder(m,prefix) {
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
  m.materials.push({name:prefix+' | '+name,pbrMetallicRoughness:{baseColorFactor:[...color,1],metallicFactor:metal,roughnessFactor:rough},...extra});return i;
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
function group(name,parent) {current=new Map();groups.set(name,{materials:current,parent});}
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

function finish(uri) {
 const added=[];
 for(const [name,{materials,parent}] of groups){
  const primitives=[];
  for(const [mat,g] of materials){
   const unique=new Map(),p=[],n=[],indices=[];
   for(let i=0;i<g.p.length;i+=3){
    const position=g.p.slice(i,i+3),normal=g.n.slice(i,i+3),key=[...position,...normal].map(v=>Math.round(v*1e7)).join(',');
    if(!unique.has(key)){unique.set(key,p.length/3);p.push(...position);n.push(...normal);}
    indices.push(unique.get(key));
   }
   primitives.push({attributes:{POSITION:accessor(new Float32Array(p),'VEC3',5126,34962,true),NORMAL:accessor(new Float32Array(n),'VEC3',5126,34962)},indices:accessor(new Uint32Array(indices),'SCALAR',5125,34963),material:mat});
  }
  const mesh=m.meshes.length;m.meshes.push({name,primitives});
  const node=m.nodes.length;m.nodes.push({name,mesh,extras:{reference:'Owner close-ups, 2026-09-21',dimensions:'Visual estimates; not measured'}});
  const rig=m.nodes.find(n=>n.name===parent);if(!rig)throw Error('Missing parent '+parent);
  (rig.children??=[]).push(node);added.push({name,node,parent,primitives:primitives.length});
 }
 const data=Buffer.concat(chunks);m.buffers.push({uri,byteLength:data.length});return {data,added};
}
return {MAT,group,box,cylinder,sphere,tube,hose,union,screw,triangle,quad,bezier,add,sub,mul,unit,cross,basis,material,finish};
};
