/* CI smoke test against the actual local model-viewer renderer. */
const {chromium}=require('playwright');
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');const cp=require('node:child_process');
const root=path.join(__dirname,'..');const out=path.join(root,'validation');fs.mkdirSync(out,{recursive:true});
const server=cp.spawn('python3',['-m','http.server','8765','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
const results={version:'1.101.0',errors:[],stage:'starting'};
const save=()=>fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(results,null,2));
(async()=>{
 let browser;
 try{
  for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:8765/3d/')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:1600,height:1150},serviceWorkers:'block'});
  const page=await context.newPage();page.on('pageerror',e=>results.errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/3d/replique.html',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('#viewer').loaded,null,{timeout:90000});
  const pose=async(orbit,target)=>{
   await page.evaluate(async({orbit,target})=>{const m=document.querySelector('#viewer');m.pause();m.cameraOrbit=orbit;m.cameraTarget=target;m.fieldOfView='30deg';await m.updateComplete;m.jumpCameraToGoal();},{orbit,target});
   await page.waitForTimeout(1000);
  };
  // A compositor screenshot avoids locator.screenshot's actionability/stability
  // wait on an actively rendering custom WebGL element. The app CSS is unchanged.
  const capture=async(file,type='png',quality)=>{
   const box=await page.locator('#viewer').boundingBox();assert(box&&box.width>0&&box.height>0);
   const vp=page.viewportSize();const x=Math.max(0,box.x),y=Math.max(0,box.y);
   const clip={x,y,width:Math.min(box.x+box.width,vp.width)-x,height:Math.min(box.y+box.height,vp.height)-y};
   assert(clip.width>100&&clip.height>100,'viewer is visible in the viewport');
   await page.screenshot({path:file,type,...(quality?{quality}:{}),clip,timeout:90000});
  };
  await page.addStyleTag({content:'.viewer-topline,.viewer-bottomline,.loading-card{visibility:hidden!important}'});
  results.stage='overview';save();
  await pose('-35deg 70deg 110%','auto auto auto');
  assert((await page.$eval('#viewer',m=>m.getCameraOrbit().radius))>1,'renderer must compute a nonzero model framing');
  await capture(path.join(root,'3d/assets/rodbot-v11-hydraulics-poster.jpg'),'jpeg',88);
  results.stage='detail';save();
  await pose('-15deg 72deg 2m','-0.45m 2.02m 0.27m');
  await capture(path.join(out,'hydraulics-after.png'));
  await capture(path.join(root,'3d/assets/rodbot-v11-hydraulics-detail.jpg'),'jpeg',92);
  // Numerical checks use actual wheel events over the WebGL surface.
  results.stage='wheel';save();
  await pose('-15deg 72deg 1m','-0.45m 2.02m 0.27m');
  const box=await page.locator('#viewer').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  const camera=()=>page.$eval('#viewer',m=>({r:m.getCameraOrbit().radius,fov:m.getFieldOfView(),target:m.getCameraTarget()}));
  const before=await camera();await page.mouse.wheel(0,-100);await page.waitForTimeout(900);const after=await camera();
  Object.assign(results,{before,after});save();
  assert(after.r<before.r&&after.r/before.r>.94,'wheel must approach in a small step');assert(Math.abs(after.fov-before.fov)<1e-5,'no FOV pumping');assert.deepEqual(after.target,before.target);
  await pose('-15deg 72deg 1m','-0.45m 2.02m 0.27m');
  await page.keyboard.down('Shift');await page.mouse.wheel(0,-100);await page.keyboard.up('Shift');await page.waitForTimeout(900);const fine=await camera();results.fine=fine;save();assert(1-fine.r<(1-after.r)/3,'Shift is finer');
  await pose('-15deg 72deg 1m','-0.45m 2.02m 0.27m');
  for(let i=0;i<4;i++)await page.mouse.wheel(0,-100);await page.waitForTimeout(900);const burst=await camera();results.burst=burst;save();assert(burst.r<after.r-.04,'wheel burst accumulates');
  // Wait for the replacement model's load event, not the previous loaded flag.
  results.stage='before-render';save();
  await page.evaluate(()=>new Promise((resolve,reject)=>{const m=document.querySelector('#viewer');m.addEventListener('load',resolve,{once:true});m.addEventListener('error',()=>reject(Error('Reference model failed')),{once:true});m.src='./assets/rodbot-v10-mast-details.gltf';}));
  await pose('-15deg 72deg 2m','-0.45m 2.02m 0.27m');
  await capture(path.join(out,'hydraulics-before.png'));
  const guided=await context.newPage();guided.on('pageerror',e=>results.errors.push(e.message));
  results.stage='guided';save();
  await guided.goto('http://127.0.0.1:8765/3d/?v=1.101.0#explorer',{waitUntil:'networkidle'});
  await guided.waitForFunction(()=>window.v?.loaded&&window.rodbotTraining,null,{timeout:90000});
  assert.equal(await guided.locator('#rbSiteVer').innerText(),'Version 1.101.0');
  await guided.locator('#btnZoomIn').evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
  const gBefore=await guided.evaluate(()=>window.v.getView().dist);await guided.locator('#btnZoomIn').click();await guided.waitForTimeout(900);const gAfter=await guided.evaluate(()=>window.v.getView().dist);
  results.guided={before:gBefore,after:gAfter};save();
  assert(gAfter<gBefore&&gAfter/gBefore>.92,'guided + button shares the fine zoom');
  await guided.locator('#modeSimulation').click();assert(await guided.evaluate(()=>window.rodbotTraining.active));
  await guided.screenshot({path:path.join(out,'guided-v1.101.0.png'),timeout:90000});
  assert.deepEqual(results.errors,[],'no browser JavaScript errors');
  results.stage='passed';save();
  console.log('Actual browser: free view, wheel, Shift, bursts, guided buttons and simulations passed.');
 }catch(e){results.failure=e.stack||String(e);save();throw e;}
 finally{await browser?.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
