/* CI smoke test against the actual local model-viewer renderer. */
const {chromium}=require('playwright');
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');const cp=require('node:child_process');
const root=path.join(__dirname,'..');const out=path.join(root,'validation');fs.mkdirSync(out,{recursive:true});
const server=cp.spawn('python3',['-m','http.server','8765','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
(async()=>{
 let browser;
 try{
  for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:8765/3d/')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:1600,height:1150},serviceWorkers:'block'});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/3d/replique.html',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('#viewer').loaded,{timeout:90000});
  const pose=async(orbit,target)=>{
   await page.evaluate(async({orbit,target})=>{const m=document.querySelector('#viewer');m.pause();m.cameraOrbit=orbit;m.cameraTarget=target;m.fieldOfView='30deg';await m.updateComplete;m.jumpCameraToGoal();},{orbit,target});
   await page.waitForTimeout(1000);
  };
  await page.addStyleTag({content:'.viewer-topline,.viewer-bottomline,.loading-card{visibility:hidden!important}'});
  await pose('-35deg 70deg 110%','auto auto auto');
  assert((await page.$eval('#viewer',m=>m.getCameraOrbit().radius))>1,'renderer must compute a nonzero model framing');
  await page.locator('#viewer').screenshot({path:path.join(root,'3d/assets/rodbot-v11-hydraulics-poster.jpg'),type:'jpeg',quality:88});
  await pose('-15deg 72deg 2m','-0.45m 2.02m 0.27m');
  await page.locator('#viewer').screenshot({path:path.join(out,'hydraulics-after.png')});
  await page.locator('#viewer').screenshot({path:path.join(root,'3d/assets/rodbot-v11-hydraulics-detail.jpg'),type:'jpeg',quality:92});
  // Numerical checks use an actual wheel event over the WebGL surface.
  await pose('-15deg 72deg 1m','-0.45m 2.02m 0.27m');
  const box=await page.locator('#viewer').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  const camera=()=>page.$eval('#viewer',m=>({r:m.getCameraOrbit().radius,fov:m.getFieldOfView(),target:m.getCameraTarget()}));
  const before=await camera();await page.mouse.wheel(0,-100);await page.waitForTimeout(900);const after=await camera();
  assert(after.r<before.r&&after.r/before.r>.94,'wheel must approach in a small step');assert(Math.abs(after.fov-before.fov)<1e-5,'no FOV pumping');assert.deepEqual(after.target,before.target);
  await pose('-15deg 72deg 1m','-0.45m 2.02m 0.27m');
  await page.keyboard.down('Shift');await page.mouse.wheel(0,-100);await page.keyboard.up('Shift');await page.waitForTimeout(900);const fine=await camera();assert(1-fine.r<(1-after.r)/3,'Shift is finer');
  await pose('-15deg 72deg 1m','-0.45m 2.02m 0.27m');
  for(let i=0;i<4;i++)await page.mouse.wheel(0,-100);await page.waitForTimeout(900);const burst=await camera();assert(burst.r<after.r-.04,'wheel burst accumulates');
  // Render the previous model from precisely the same angle for visual review.
  await page.evaluate(()=>{const m=document.querySelector('#viewer');m.src='./assets/rodbot-v10-mast-details.gltf';});
  await page.waitForFunction(()=>document.querySelector('#viewer').loaded);await pose('-15deg 72deg 2m','-0.45m 2.02m 0.27m');
  await page.locator('#viewer').screenshot({path:path.join(out,'hydraulics-before.png')});
  const guided=await context.newPage();guided.on('pageerror',e=>errors.push(e.message));
  await guided.goto('http://127.0.0.1:8765/3d/?v=1.101.0#explorer',{waitUntil:'networkidle'});
  await guided.waitForFunction(()=>window.v?.loaded&&window.rodbotTraining,{timeout:90000});
  assert.equal(await guided.locator('#rbSiteVer').innerText(),'Version 1.101.0');
  await guided.locator('#btnZoomIn').scrollIntoViewIfNeeded();
  const gBefore=await guided.evaluate(()=>window.v.getView().dist);await guided.locator('#btnZoomIn').click();await guided.waitForTimeout(900);const gAfter=await guided.evaluate(()=>window.v.getView().dist);
  assert(gAfter<gBefore&&gAfter/gBefore>.92,'guided + button shares the fine zoom');
  await guided.locator('#modeSimulation').click();assert(await guided.evaluate(()=>window.rodbotTraining.active));
  await guided.screenshot({path:path.join(out,'guided-v1.101.0.png')});
  assert.deepEqual(errors,[],'no browser JavaScript errors');
  fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({version:'1.101.0',before,after,fine,burst,guided:{before:gBefore,after:gAfter},errors},null,2));
  console.log('Actual browser: free view, wheel, Shift, bursts, guided buttons and simulations passed.');
 }finally{await browser?.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
