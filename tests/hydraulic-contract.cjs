// Accepted source measurements belong in this independent fixture, never read
// from the active GLB's own metadata to generate its expected coordinates.
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const changedSources=['V17 | Boyau diagonal protégé 1','V17 | Boyau diagonal protégé 2','V26 | Boyau vérin gauche 1','V26 | Boyau vérin gauche 2'];
function loadHydraulicContract(revision){
 assert([26,27,28].includes(revision),'only explicitly reviewed twin-cylinder revisions are supported');
 const c=JSON.parse(fs.readFileSync(path.join(__dirname,`fixtures/hydraulic-v${revision}.json`),'utf8'));
 assert.equal(c.schema,1);assert.equal(c.status,'approved',`V${revision} source contacts/dimensions must be independently approved before enabling these tests`);
 assert.match(c.source_sha256,/^[a-f0-9]{64}$/);assert(c.provenance.length>0,'record the reviewed source measurement reports');
 assert.equal(c.coordinate_system,'glTF Y-up, world-rest metres');
 assert.deepEqual(c.changed_terminal_sources,[...changedSources]);
 for(const name of changedSources){assert.equal(c.terminal_centres[name]?.length,2,name+' needs two independently fixed terminal centres');for(const p of c.terminal_centres[name])assert(p.length===3&&p.every(Number.isFinite));}
 assert(c.terminal_max_surface_distance_m>0&&c.terminal_max_surface_distance_m<=.04,'never relax the existing terminal proximity bound');
 return c;
}
module.exports={loadHydraulicContract,changedSources};
