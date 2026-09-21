/* Add only details supported by the owner's eight mast close-ups.
 * Run: node scripts/refine-mast-details.cjs
 * All new assemblies follow the appropriate joint or hydraulic barrel.
 */
const fs=require('node:fs');
const path=require('node:path');
const build=require('./gltf-detail-builder.cjs');
const dir=path.join(__dirname,'../3d/assets');
const m=JSON.parse(fs.readFileSync(path.join(dir,'rodbot-v9-rear.gltf')));
const b=build(m,'Mast V10');
const {MAT,group,box,cylinder,sphere,tube,hose,union,screw,triangle,quad,bezier,add,sub,mul,unit,material}=b;
MAT.gold=material('zinc yellow fasteners',[.52,.43,.22],.82,.3);
MAT.sensor=material('gray sensor housing',[.27,.31,.30],.4,.34);
MAT.green=material('sensor indicator',[.16,.48,.025],.12,.3);
MAT.weld=material('painted weld bead',[.30,.018,.023],.16,.31);
MAT.label=material('white safety label',[.90,.91,.87],0,.55);
MAT.warning=material('yellow warning triangle',[.95,.64,.018],0,.49);
const pitch=Math.atan2(.24774,.56016),C=Math.cos(pitch),S=Math.sin(pitch);
const P=(s,h,z)=>[C*s-S*h,S*s+C*h,z];
// V8's square-section roll is retained. This mapping places fittings and welds
// on those inclined faces without rotating the hydraulic mounting itself.
const R=(s,h,z)=>P(s,(h+z)/Math.SQRT2,(z-h)/Math.SQRT2);
function weld(points,r=.0022){
 tube(MAT.weld,points,r,8);
 let distance=0;
 for(let i=1;i<points.length;i++){
  const a=points[i-1],delta=sub(points[i],a),length=Math.hypot(...delta);
  for(let d=distance;d<length;d+=r*2.2)sphere(MAT.weld,add(a,mul(delta,d/length)),r*1.07,8,4);
  distance=(distance-length)%(r*2.2);if(distance<0)distance+=r*2.2;
 }
}
function face(mat,points){for(let i=1;i<points.length-1;i++)triangle(mat,points[0],points[i],points[i+1]);}
function extrude(mat,poly,low,high,map){
 if(poly.reduce((s,p,i)=>{const q=poly[(i+1)%poly.length];return s+p[0]*q[1]-q[0]*p[1];},0)<0)poly=[...poly].reverse();
 const a=poly.map(v=>map(...v,low)),z=poly.map(v=>map(...v,high));
 face(mat,[...a].reverse());face(mat,z);
 for(let i=0;i<poly.length;i++){const j=(i+1)%poly.length;quad(mat,a[i],a[j],z[j],z[i]);}
}
function drilledPlate(poly,center,r,low,high){
 const angles=Array.from({length:48},(_,i)=>i*Math.PI*2/48);
 for(const p of poly)angles.push((Math.atan2(p[1]-center[1],p[0]-center[0])+Math.PI*2)%(Math.PI*2));
 angles.sort((a,b)=>a-b);
 const unique=angles.filter((a,i)=>!i||a-angles[i-1]>1e-7),outer=[],inner=[];
 for(const a of unique){
  const d=[Math.cos(a),Math.sin(a)];let tMin=Infinity;
  for(let i=0;i<poly.length;i++){
   const q=poly[i],next=poly[(i+1)%poly.length],e=sub(next,q),v=sub(q,center),den=d[0]*e[1]-d[1]*e[0];
   if(Math.abs(den)<1e-10)continue;
   const t=(v[0]*e[1]-v[1]*e[0])/den,u=(v[0]*d[1]-v[1]*d[0])/den;
   if(t>0&&u>=-1e-8&&u<=1+1e-8)tMin=Math.min(tMin,t);
  }
  if(!Number.isFinite(tMin))throw Error('Clevis polygon is not star shaped');
  outer.push(add(center,mul(d,tMin)));inner.push(add(center,mul(d,r)));
 }
 for(let i=0;i<unique.length;i++){
  const j=(i+1)%unique.length,A=P(...outer[i],low),B=P(...outer[j],low),I=P(...inner[i],low),J=P(...inner[j],low),a=P(...outer[i],high),c=P(...outer[j],high),h=P(...inner[i],high),k=P(...inner[j],high);
  quad(MAT.red,a,c,k,h);quad(MAT.red,B,A,I,J);quad(MAT.red,A,B,c,a);quad(MAT.red,h,k,J,I);
 }
}

group('MAST_V10_Adjusters_and_welds','CTRL_SHOULDER_Y');
for(const s of [.175,1.095])for(const h of [-.092,.092])for(const side of [-1,1]){
 const normal=unit(sub(R(s,h,side*.3),R(s,h,0))),at=z=>R(s,h,side*z);
 // Retain existing bolt seats; add the exposed thread, washer and locknut.
 cylinder(MAT.steel,at(.215),at(.247),.0095,16);
 cylinder(MAT.steel,at(.219),at(.223),.0195,20);
 cylinder(MAT.steel,at(.225),at(.240),.016,6);
 for(let k=0;k<5;k++)cylinder(MAT.dark,at(.241+k*.0012),at(.2416+k*.0012),.0097,16);
 for(const hEdge of [-.031,.031])weld([R(s-.031,h+hEdge,side*.195),R(s+.031,h+hEdge,side*.195)],.0017);
}
// Guide collar seam and the end of the outer square tube.
for(const side of [-1,1]){
 weld([R(1.182,-.19,side*.191),R(1.182,.19,side*.191)],.0017);
 weld([R(1.182,side*.191,-.19),R(1.182,side*.191,.19)],.0017);
}

group('MAST_V10_Lift_clevis_and_hose_guides','CTRL_SHOULDER_Y');
const tip=m.nodes.find(n=>n.name==='HYD_LIFT_TIP').translation;
const tipS=C*tip[0]+S*tip[1],tipH=-S*tip[0]+C*tip[1];
const outline=[[tipS-.125,-.035],[tipS-.11,tipH-.050],[tipS,tipH-.077],[tipS+.10,tipH-.04],[tipS+.135,-.035]];
for(const z of [.086,.214]){
 drilledPlate(outline,[tipS,tipH],.023,z-.009,z+.009);
 weld([P(tipS-.125,-.035,z),P(tipS+.135,-.035,z)],.0028);
 cylinder(MAT.steel,P(tipS,tipH,z-.013),P(tipS,tipH,z+.015),.022,24);
 screw(P(tipS,tipH,z+.015),[0,0,1],.014);
}
// Paired triangular ribs support the pin plates against the tube.
for(const z of [.115,.185])extrude(MAT.red,[[tipS-.13,-.03],[tipS+.10,-.03],[tipS,tipH+.04]],z-.005,z+.005,P);
// Support under the existing three-way hose guide, which previously floated.
extrude(MAT.red,[[.40,-.06],[.54,-.06],[.51,-.135],[.44,-.135]],.19,.207,P);
weld([P(.40,-.058,.20),P(.54,-.058,.20)],.002);
for(const s of [.64,.93]){
 const c=R(s,-.187,.09);
 cylinder(MAT.steel,add(c,[0,0,.003]),add(c,[0,0,.012]),.0065,6);
}
// A compact metal clamp holds the photographed parallel hose bundle beneath
// the mast. Both ends remain within this same moving shoulder assembly.
for(let i=0;i<4;i++){
 const z=.17+i*.029;
 hose([P(.48,-.105,z),P(.62,-.25,z),P(.93,-.24,z),P(1.11,-.095,.09+i*.022)],.010);
}
for(const s of [.66,.88]){
 const h=-.218;
 extrude(MAT.dark,[[s-.014,h-.017],[s+.014,h-.017],[s+.014,h+.025],[s-.014,h+.025]],.13,.248,P);
 screw(P(s,h+.026,.14),P(0,1,0),.0055);
 screw(P(s,h+.026,.235),P(0,1,0),.0055);
}

group('MAST_V10_Crush_warning','CTRL_SHOULDER_Y');
const decal=(x,y,offset=0)=>R(.89+x,-.190-offset,.012+y);
function labelShape(points){
 if(points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1];},0)<0)points=[...points].reverse();
 face(MAT.dark,points.map(p=>decal(...p,.0014)));
}
const rect=(mat,w,h,offset)=>quad(mat,decal(-w/2,-h/2,offset),decal(w/2,-h/2,offset),decal(w/2,h/2,offset),decal(-w/2,h/2,offset));
rect(MAT.dark,.115,.112,0);rect(MAT.label,.109,.106,.0004);
triangle(MAT.dark,decal(-.047,-.041,.0007),decal(.047,-.041,.0007),decal(0,.045,.0007));
triangle(MAT.warning,decal(-.040,-.037,.001),decal(.040,-.037,.001),decal(0,.037,.001));
// Graphic primitives reproduce the visible hand/crushing-bar symbol. This is
// a visual replica of the label, not a replacement safety-sign specification.
labelShape([[.007,.012],[.024,.025],[.018,-.001],[.006,-.011],[-.004,-.003]]);
labelShape([[-.021,-.006],[.012,-.006],[.020,-.015],[.004,-.021],[-.010,-.017]]);
for(let i=0;i<4;i++){
 const x=-.020+i*.008;
 labelShape([[x,-.010],[x+.005,-.012],[x-.001,-.028],[x-.006,-.026]]);
}
labelShape([[-.032,-.032],[.026,-.032],[.026,-.035],[-.032,-.035]]);

group('MAST_V10_Cylinder_elbows_and_loops','HYD_LIFT_BASE');
// The barrel's local -X points toward the photographed side (+Z in the scene).
for(let i=0;i<2;i++){
 const y=.155+i*.090,z=-.014+i*.041;
 cylinder(MAT.dark,[-.061,y,z],[-.075,y,z],.024,20);
 cylinder(MAT.steel,[-.070,y,z],[-.106,y,z],.016,6);
 const elbow=bezier([[-.102,y,z],[-.128,y,z],[-.128,y+.020,z],[-.128,y+.040,z]],16);
 tube(MAT.steel,elbow,.012,16);
 union([-.128,y+.055,z],[0,1,0],.019);
 cylinder(MAT.steel,[-.128,y+.075,z],[-.128,y+.133,z],.017,20);
 for(let k=0;k<4;k++)cylinder(MAT.steel,[-.128,y+.081+k*.012,z],[-.128,y+.083+k*.012,z],.0176,20);
 // Two loops run parallel to the cylinder, just as in the close-ups.
 const turnY=.61+i*.035,radius=.057+i*.012,loop=[];
 for(let k=0;k<=20;k++)loop.push([-.128,y+.133+(turnY-y-.133)*k/20,z]);
 for(let k=1;k<=32;k++){const a=-Math.PI/2+k*Math.PI/32;loop.push([-.128,turnY+radius*Math.cos(a),z+radius+radius*Math.sin(a)]);}
 const end=loop[loop.length-1];
 loop.push(...bezier([end,[-.128,.32,z+radius*2],[-.12,.10,.10],[-.05,.025,.040]],32).slice(1));
 tube(MAT.rubber,loop,.012,14);
}
// Gland seal and small fittings at the end of the black barrel.
cylinder(MAT.rubber,[0,.809,0],[0,.825,0],.048,32);
for(let i=0;i<6;i++){
 const a=i*Math.PI/3;
 screw([Math.cos(a)*.061,.821,Math.sin(a)*.061],[0,1,0],.0035);
}

group('MAST_V10_Pivot_sensor_and_base_fixings','CTRL_TURRET_Z');
const sensor=[-.123,.331,.352];
cylinder(MAT.steel,[-.123,.331,.326],[-.123,.331,.342],.026,20);
cylinder(MAT.sensor,[-.123,.318,.337],[-.123,.318,.374],.041,28);
box(MAT.sensor,[-.123,.347,.355],[.082,.061,.037]);
box(MAT.dark,[-.123,.348,.375],[.053,.020,.0015]);
box(MAT.gray,[-.123,.347,.376],[.044,.012,.001]);
for(const x of [-.149,-.097])screw([x,.357,.376],[0,0,1],.003);
cylinder(MAT.steel,[-.123,.379,.354],[-.123,.401,.354],.012,18);
cylinder(MAT.gray,[-.123,.401,.354],[-.123,.434,.354],.012,16,.009);
for(let k=0;k<4;k++)cylinder(MAT.gray,[-.123,.404+k*.006,.354],[-.123,.407+k*.006,.354],.0123,16);
box(MAT.green,[-.123,.388,.367],[.007,.006,.001]);
hose([[-.123,.434,.354],[-.14,.51,.35],[-.23,.49,.22],[-.245,.28,.21]],.006);
for(let i=0;i<12;i++){
 const angle=i*Math.PI/6,x=.265*Math.cos(angle),z=.265*Math.sin(angle);
 cylinder(MAT.steel,[x,.003,z],[x,.006,z],.017,20);
 cylinder(MAT.gold,[x,.006,z],[x,.022,z],.015,6);
}
for(const z of [-.217,.217])weld([[-.19,.026,z],[.18,.026,z]],.0021);
// Existing grease nipple remains intact; add the small washer at its foot.
cylinder(MAT.gold,[-.157,.002,.215],[-.157,.004,.215],.009,16);

const result=b.finish('rodbot-v10-mast-details.bin');
m.asset.generator='RodBot V10, mast details from eight owner close-ups, 2026-09-21';
m.extras.mast_detail_revision={reference:'Eight owner mast photographs, 2026-09-21',added:result.added,
 details:['pin clevis and gussets','painted welds','adjuster threads and locknuts','hydraulic elbows and crimp ferrules','parallel cylinder hose loops','hose bundle clamps','pivot sensor connector','base flange fasteners','hand-crush warning graphic'],
 dimensions_status:'Visual estimates; concealed routes and exact dimensions are not verified',
 rig:'Existing square section, all rest transforms and 36 animation tracks unchanged'};
fs.writeFileSync(path.join(dir,'rodbot-v10-mast-details.bin'),result.data);
fs.writeFileSync(path.join(dir,'rodbot-v10-mast-details.gltf'),JSON.stringify(m)+'\n');
console.log(JSON.stringify({bytes:result.data.length,added:result.added,animations:m.animations.length}));
