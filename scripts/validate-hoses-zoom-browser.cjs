/* Real-browser controls and before/after renders. Independent contexts avoid
 * retaining both large models during software-rendered CI screenshots. */
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const root=path.join(__dirname,'..'),out=path.join(root,'validation');fs.mkdirSync(out,{recursive:true});
const server=cp.spawn('python3',['-m','http.server','8765','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
const results={version:'1.101.0',errors:[],stage:'starting'};
const save=()=>{fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(results,null,2));console.log(results.stage);};
(async()=>{
 let browser,context,page;
 try{
  for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:8765/3d/')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const fresh=async()=>{
   if(context)await context.close();
   context=await browser.newContext({viewport:{width:1600,height:1150},serviceWorkers:'block'});
   page=await context.newPage();page.on('pageerror',e=>results.errors.push(e.message));
  };
  const loadFree=async()=>{
   await page.goto('http://127.0.0.1:8765/3d/replique.html',{waitUntil:'networkidle'});
   await page.waitForFunction(()=>document.querySelector('#viewer').loaded,null,{timeout:60000});
   await page.addStyleTag({content:'.viewer-topline,.viewer-bottomline,.loading-card{visibility:hidden!important}'});
  };
  const pose=async(orbit,target)=>{
   await page.evaluate(async({orbit,target})=>{const m=document.querySelector('#viewer');m.pause();m.cameraOrbit=orbit;m.cameraTarget=target;m.fieldOfView='30deg';await m.updateComplete;m.jumpCameraToGoal();},{orbit,target});
   await page.waitForTimeout(650);
  };
  const capture=async(file,type='png',quality)=>{
   const box=await page.locator('#viewer').boundingBox();assert(box&&box.width>100&&box.height>100);
   const vp=page.viewportSize(),x=Math.max(0,box.x),y=Math.max(0,box.y);
   const clip={x,y,width:Math.min(box.x+box.width,vp.width)-x,height:Math.min(box.y+box.height,vp.height)-y};
   assert(clip.width>100&&clip.height>100);
   await page.screenshot({path:file,type,...(quality?{quality}:{}),clip,timeout:30000});
  };
  await fresh();await loadFree();
  results.stage='overview';save();
  await pose('-35deg 70deg 110%','auto auto auto');
  assert((await page.$eval('#viewer',m=>m.getCameraOrbit().radius))>1);
  await capture(path.join(root,'3d/assets/rodbot-v11-hydraulics-poster.jpg'),'jpeg',88);
  results.stage='detail';save();
  await pose('-15deg 72deg 2m','-0.45m 2.02m 0.27m');
  await capture(path.join(out,'hydraulics-after.png'));
  await capture(path.join(root,'3d/assets/rodbot-v11-hydraulics-detail.jpg'),'jpeg',92);
  results.stage='wheel';save();
  await page.evaluate(()=>{window.testWheels=[];window.addEventListener('wheel',e=>window.testWheels.push({x:e.deltaX,y:e.deltaY,shift:e.shiftKey}),true);});
  await pose('-15deg 72deg 1m','-0.45m 2.02m 0.27m');
  const box=await page.locator('#viewer').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  const camera=()=>page.$eval('#viewer',m=>({r:m.getCameraOrbit().radius,fov:m.getFieldOfView(),target:m.getCameraTarget()}));
  const before=await camera();await page.mouse.wheel(0,-100);await page.waitForTimeout(900);const after=await camera();
  Object.assign(results,{before,after});save();
  assert(after.r<before.r&&after.r/before.r>.94);assert(Math.abs(after.fov-before.fov)<1e-5);assert.deepEqual(after.target,before.target);
  await pose('-15deg 72deg 1m','-0.45m 2.02m 0.27m');
  await page.keyboard.down('Shift');await page.mouse.wheel(0,-100);await page.waitForTimeout(900);await page.keyboard.up('Shift');
  const fine=await camera();results.fine=fine;results.wheels=await page.evaluate(()=>window.testWheels);save();
  assert(fine.r<.9999&&1-fine.r<(1-after.r)/3,'Shift must actually zoom, by a finer step');
  await pose('-15deg 72deg 1m','-0.45m 2.02m 0.27m');
  for(let i=0;i<4;i++)await page.mouse.wheel(0,-100);await page.waitForTimeout(900);const burst=await camera();results.burst=burst;save();assert(burst.r<after.r-.04);
  results.stage='before-render';save();
  await fresh();
  await page.route('**/rodbot-v11-hydraulics.gltf',route=>route.fulfill({contentType:'model/gltf+json',body:fs.readFileSync(path.join(root,'3d/assets/rodbot-v10-mast-details.gltf'))}));
  await loadFree();await pose('-15deg 72deg 2m','-0.45m 2.02m 0.27m');
  await capture(path.join(out,'hydraulics-before.png'));
  results.stage='guided';save();
  await fresh();
  await page.goto('http://127.0.0.1:8765/3d/?v=1.101.0#explorer',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.v?.loaded&&window.rodbotTraining,null,{timeout:60000});
  assert.equal(await page.locator('#rbSiteVer').innerText(),'Version 1.101.0');
  await page.locator('#btnZoomIn').evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
  const gBefore=await page.evaluate(()=>window.v.getView().dist);await page.locator('#btnZoomIn').click();await page.waitForTimeout(900);const gAfter=await page.evaluate(()=>window.v.getView().dist);
  results.guided={before:gBefore,after:gAfter};save();assert(gAfter<gBefore&&gAfter/gBefore>.92);
  await page.locator('#modeSimulation').click();assert(await page.evaluate(()=>window.rodbotTraining.active));
  await page.screenshot({path:path.join(out,'guided-v1.101.0.png'),timeout:30000});
  assert.deepEqual(results.errors,[]);results.stage='passed';save();
 }catch(e){results.failure=e.stack||String(e);save();throw e;}
 finally{await browser?.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
