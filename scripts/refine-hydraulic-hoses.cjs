/* V11: visible cylinder hose pair from the owner's 21 September close-up.
 * Run: node scripts/refine-hydraulic-hoses.cjs
 * This replaces the V10 decorative closed loops, not the mast/rig.
 * Concealed hydraulic destinations are deliberately not invented.
 */
const fs = require('node:fs');
const path = require('node:path');
const build = require('./gltf-detail-builder.cjs');
const dir = path.join(__dirname, '../3d/assets');
const m = JSON.parse(fs.readFileSync(path.join(dir, 'rodbot-v10-mast-details.gltf')));
const old = m.nodes.find(n => n.name === 'MAST_V10_Cylinder_elbows_and_loops');
if (!old || !Number.isInteger(old.mesh)) throw Error('V10 cylinder detail assembly missing');
// Leave every existing node index in place: interactive anchors and clips use them.
delete old.mesh;
old.extras.superseded_by = 'MAST_V11_Cylinder_hose_pair';
const b = build(m, 'Hydraulics V11');
const { MAT, group, box, cylinder, tube, bezier, screw, quad } = b;
group('MAST_V11_Cylinder_hose_pair', 'HYD_LIFT_BASE');
// Local +Y follows the black barrel; local -X is its photographed outer side.
// A close pair on the dark mounting face, not two ports staggered up the barrel.
const plate = [[.06,.027],[.355,.027],[.32,.168],[.06,.155]];
const face = x => plate.map(([y,z]) => [x,y,z]);
const a = face(-.064), c = face(-.078);
quad(MAT.dark, ...a); quad(MAT.dark, ...[...c].reverse());
for (let i=0;i<4;i++) { const j=(i+1)%4; quad(MAT.dark,a[i],c[i],c[j],a[j]); }
// Backing ribs visually join the photographed mounting face to the barrel.
box(MAT.dark, [-.044,.095,.061], [.055,.030,.055]);
box(MAT.dark, [-.044,.285,.061], [.055,.030,.055]);
for (const y of [.077,.31]) screw([-.079,y,.047],[-1,0,0],.006);
const paths = [];
for (let i=0;i<2;i++) {
  const y=.163+i*.006, z=.074+i*.044;
  const port=[-.076,y,z];
  cylinder(MAT.dark,port,[-.083,y,z],.020,20);
  cylinder(MAT.steel,[-.080,y,z],[-.109,y,z],.0175,6);
  // Solid 90 degree elbow: a horizontal threaded leg, then a leg along +Y.
  const bend=bezier([[-.105,y,z],[-.129,y,z],[-.132,y+.014,z],[-.132,y+.034,z]],18);
  tube(MAT.steel,bend,.012,16);
  cylinder(MAT.steel,[-.132,y+.029,z],[-.132,y+.052,z],.0185,6);
  cylinder(MAT.steel,[-.132,y+.052,z],[-.132,y+.062,z],.0155,20);
  cylinder(MAT.steel,[-.132,y+.062,z],[-.132,y+.118,z],.0185,24);
  for(let k=0;k<3;k++) cylinder(MAT.steel,[-.132,y+.073+k*.014,z],[-.132,y+.075+k*.014,z],.0188,24);
  cylinder(MAT.steel,[-.132,y+.118,z],[-.132,y+.122,z],.0185,24,.013);
  // Visible flexible section: adjacent, close to the barrel, a broad open bend
  // into the space behind the mast. No hairpin return down to its own fitting.
  const start=[-.132,y+.121,z];
  const mid=[-.132,.65,.034];
  // Continue behind the existing mast-side bundle; no open end in the air.
  const p=bezier([[-.132,y+.121,.074],[-.132,.39,.074],[-.143,.52,.061],mid],34);
  const elbowStart=p.length-1;
  p.push(...bezier([mid,[-.132,.88,-.066],[-.130,1.005,-.150],[.060,1.010,-.146]],40).slice(1));
  // Rotate the pair's separation around the broad bend without pinching it.
  for(let k=0;k<p.length;k++){
    const t=Math.max(0,(k-elbowStart)/(p.length-1-elbowStart));
    const angle=t*Math.PI/2;
    p[k][0]-=i*.044*Math.sin(angle);p[k][2]+=i*.044*Math.cos(angle);
  }
  tube(MAT.rubber,p,.0115,16);
  paths.push({fitting:port, ferrule_exit:start, points:p, radius:.0115});
}
// Preserve the gland seal and screws previously included in the V10 detail node.
cylinder(MAT.rubber,[0,.809,0],[0,.825,0],.048,32);
for(let i=0;i<6;i++){const a=i*Math.PI/3;screw([Math.cos(a)*.061,.821,Math.sin(a)*.061],[0,1,0],.0035);}
const result=b.finish('rodbot-v11-hydraulics.bin');
m.asset.generator='RodBot V11, revised visible cylinder hose routing, 2026-09-21';
m.extras.hydraulic_revision={reference:'Owner close-up, 2026-09-21',added:result.added,
  visible_hose_count:2, paths, previous_detail_node:'MAST_V10_Cylinder_elbows_and_loops',
  limits:'Photographic estimates. Hidden connections and dynamic hose deformation are not certified. Rear bundle retained separately.'};
fs.writeFileSync(path.join(dir,'rodbot-v11-hydraulics.bin'),result.data);
fs.writeFileSync(path.join(dir,'rodbot-v11-hydraulics.gltf'),JSON.stringify(m));
console.log('V11 hydraulic detail buffer:',result.data.length,'bytes');
