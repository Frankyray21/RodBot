const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../3d/js/precision-zoom.js'),'utf8').replaceAll('export ','');
function harness(radius=1,reduced=false){
 const doc=new EventTarget();doc.hidden=false;
 const model=new EventTarget();model.loaded=true;model.zoomSensitivity=1;model.ownerDocument=doc;
 model.orbit={theta:-.4,phi:1.2,radius};model.cameraTarget='unchanged';model.fieldOfView='30deg';
 model.getCameraOrbit=()=>({...model.orbit});model.getBoundingClientRect=()=>({height:800});
 model.jumpCameraToGoal=()=>{const v=model.cameraOrbit.split(' ').map(parseFloat);model.orbit={theta:v[0],phi:v[1],radius:v[2]};};
 let time=0,next=0,interactions=0;const frames=new Map();
 const c=vm.createContext({document:doc,model,Math,Number,Map,performance:{now:()=>time},matchMedia:()=>({matches:reduced}),requestAnimationFrame:fn=>{frames.set(++next,fn);return next;},cancelAnimationFrame:id=>frames.delete(id),interact:()=>interactions++});
 vm.runInContext(source+';globalThis.controller=attachPrecisionZoom(model,{onInteraction:interact});globalThis.rate=zoomRate;globalThis.units=wheelUnits;',c);
 const send=(type,props={})=>{const e=new Event(type,{cancelable:true});Object.assign(e,props);model.dispatchEvent(e);return e;};
 const settle=()=>{for(let i=0;i<150&&frames.size;i++){time+=16;const f=[...frames.values()];frames.clear();f.forEach(fn=>fn(time));}};
 return {model,doc,c,send,settle,frames,get interactions(){return interactions;}};
}
test('wheel is radius-relative, fine nearby, and leaves target, yaw and field of view unchanged',()=>{
 for(const r of [.5,1,3,6]){const h=harness(r);const e=h.send('wheel',{deltaY:-100,deltaMode:0});h.settle();assert(e.defaultPrevented);const ratio=h.model.orbit.radius/r;assert(ratio>.95&&ratio<.99);if(r<=1)assert(1-ratio<.014,'a detail zoom step must stay below 1.4%');assert.equal(h.model.fieldOfView,'30deg');assert.equal(h.model.cameraTarget,'unchanged');assert.equal(h.model.orbit.theta,-.4);assert.equal(h.model.zoomSensitivity,0);}
 const close=harness(.5),far=harness(6);close.send('wheel',{deltaY:-100});far.send('wheel',{deltaY:-100});close.settle();far.settle();assert(1-close.model.orbit.radius/.5<1-far.model.orbit.radius/6);
});
test('Shift-wheel is finer; trackpad, line and page delta modes stay bounded',()=>{
 const a=harness(),b=harness();a.send('wheel',{deltaY:-100});b.send('wheel',{deltaY:-100,shiftKey:true});a.settle();b.settle();assert(1-b.model.orbit.radius<(1-a.model.orbit.radius)/3);
 assert.equal(a.c.units({deltaY:1,deltaMode:0}),.01);assert.equal(a.c.units({deltaY:3,deltaMode:1}),.54);assert.equal(a.c.units({deltaY:1,deltaMode:2}),1.2);assert.equal(a.c.units({deltaY:1e9}),1.2);assert.equal(a.c.units({deltaY:NaN}),0);
});
test('wheel bursts accumulate instead of restarting from an unfinished frame',()=>{
 const single=harness(),burst=harness();single.send('wheel',{deltaY:-100});for(let i=0;i<4;i++)burst.send('wheel',{deltaY:-100});single.settle();burst.settle();assert(1-burst.model.orbit.radius>3.8*(1-single.model.orbit.radius));assert.equal(burst.interactions,4);
});
test('buttons and keyboard share the fine step; malformed zoom input is ignored',()=>{
 const a=harness(),b=harness();a.c.controller.zoomBy(1/1.08);b.send('keydown',{key:'+'});a.settle();b.settle();assert(Math.abs(a.model.orbit.radius-b.model.orbit.radius)<1e-7);const before=a.model.orbit.radius;for(const f of [0,-1,NaN,Infinity])a.c.controller.zoomBy(f);a.settle();assert.equal(a.model.orbit.radius,before);
});
test('minimum distance, maximum distance, reduced motion and browser zoom are respected',()=>{
 const a=harness(.36,true);for(let i=0;i<30;i++)a.c.controller.step(-1);assert.equal(a.model.orbit.radius,.35);assert.equal(a.frames.size,0);
 const b=harness(44,true);for(let i=0;i<30;i++)b.c.controller.step(1);assert.equal(b.model.orbit.radius,45);
 const c=harness();const e=c.send('wheel',{deltaY:-100,ctrlKey:true});c.settle();assert(!e.defaultPrevented);assert.equal(c.model.orbit.radius,1);
});
test('two-finger pinch is progressive and releasing a pointer stops pinch tracking',()=>{
 const h=harness();h.send('pointerdown',{pointerType:'touch',pointerId:1,clientX:0,clientY:0});h.send('pointerdown',{pointerType:'touch',pointerId:2,clientX:100,clientY:0});h.send('pointermove',{pointerId:2,clientX:130,clientY:0});h.settle();assert(h.model.orbit.radius<1&&h.model.orbit.radius>.85);const r=h.model.orbit.radius;h.send('pointercancel',{pointerId:2});h.send('pointermove',{pointerId:2,clientX:160,clientY:0});h.settle();assert.equal(h.model.orbit.radius,r);
});
test('hidden or destroyed viewers stop work and restore the native property on cleanup',()=>{
 const h=harness();h.c.controller.step(-1);h.doc.hidden=true;h.doc.dispatchEvent(new Event('visibilitychange'));h.settle();assert.equal(h.model.orbit.radius,1);h.doc.hidden=false;h.c.controller.destroy();h.send('wheel',{deltaY:-100});h.settle();assert.equal(h.model.orbit.radius,1);assert.equal(h.model.zoomSensitivity,1);assert.equal(h.frames.size,0);
});
