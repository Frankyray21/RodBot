/* RodBot: real Gaussian scan, smooth camera and accessible controls.
   flyTo resolves true at arrival, false when interrupted. No mechanical rig is implied. */
import * as pc from 'https://cdn.jsdelivr.net/npm/playcanvas@2.13.3/build/playcanvas.mjs';
import { clamp, ease, nearestYaw, inertiaStep, framingScale } from './motion.js?v=1.61.0';

const FILES = {
  mobile: new URL('../assets/rodbot_mobile.sog', import.meta.url).href,
  hq: new URL('../assets/rodbot_hq.sog', import.meta.url).href
};
const HOME = { yaw: 305, pitch: 16, dist: 6.5, target: [-.3, -.9, -.8] };
const LIM = { distMin: .9, distMax: 12, pitchMin: -8, pitchMax: 70 };
function pickQuality(pref) {
  const choice = pref || new URLSearchParams(location.search).get('q');
  if (choice === 'mobile' || choice === 'hq') return choice;
  return Math.min(screen.width, screen.height) < 700 ||
    navigator.connection?.saveData || (navigator.deviceMemory && navigator.deviceMemory <= 4) ? 'mobile' : 'hq';
}

export const RodbotViewer = {
  async create(opts = {}) {
    const canvas = typeof opts.canvas === 'string' ? document.querySelector(opts.canvas) : opts.canvas;
    const overlay = typeof opts.overlay === 'string' ? document.querySelector(opts.overlay) : opts.overlay;
    if (!canvas) throw new Error('Canvas 3D absent');
    const events = new Map(), cleanup = [];
    let destroyed = false, visible = true, movingUntil = 0;
    let quality = pickQuality(opts.quality), asset = null, model = null, loading = null;
    let pendingLoad = null, sortEvent = null;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let reduced = media.matches;
    const emit = (name, ...args) => events.get(name)?.forEach(fn => fn(...args));
    const listen = (node, name, fn, options) => {
      node.addEventListener(name, fn, options);
      cleanup.push(() => node.removeEventListener(name, fn, options));
    };
    const app = new pc.Application(canvas, {
      graphicsDeviceOptions: { antialias: false, alpha: false,
        preserveDrawingBuffer: new URLSearchParams(location.search).has('pdb') }
    });
    app.setCanvasFillMode(pc.FILLMODE_NONE);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);
    app.autoRender = false;
    const cam = new pc.Entity('camera');
    cam.addComponent('camera', { clearColor: new pc.Color(.059, .067, .071), fov: 50, nearClip: .05, farClip: 100 });
    app.root.addChild(cam);
    const st = { yaw: HOME.yaw, pitch: HOME.pitch, dist: HOME.dist, target: new pc.Vec3(...HOME.target) };
    const velocity = { yaw: 0, pitch: 0 };
    let flight = null, zoomTarget = st.dist, autoRotate = !!opts.autoRotate && !reduced;
    let width = 1, height = 1, framing = 1.15, needsProjection = true;
    let lastInteraction = performance.now(), rotationSpeed = 0;
    const invalidate = () => { movingUntil = performance.now() + 300; needsProjection = true; };
    function applyCam() {
      const yaw = st.yaw * Math.PI / 180, pitch = st.pitch * Math.PI / 180;
      const dist = st.dist * framing, cp = Math.cos(pitch);
      cam.setPosition(st.target.x + dist * cp * Math.sin(yaw), st.target.y + dist * Math.sin(pitch), st.target.z + dist * cp * Math.cos(yaw));
      cam.lookAt(st.target);
      invalidate();
    }
    function fit() {
      const box = canvas.parentElement?.getBoundingClientRect();
      if (!box?.width || !box.height || destroyed) return;
      width = box.width; height = box.height;
      framing = framingScale(width, height);
      app.graphicsDevice.maxPixelRatio = Math.min(window.devicePixelRatio || 1, quality === 'hq' ? 2 : 1.5);
      app.resizeCanvas(width, height);
      applyCam();
    }
    const resize = new ResizeObserver(fit);
    resize.observe(canvas.parentElement);

    function cancelFlight() {
      if (flight) { const old = flight; flight = null; old.resolve(false); }
    }
    function stopMotion() {
      cancelFlight(); velocity.yaw = velocity.pitch = 0;
      zoomTarget = st.dist; rotationSpeed = 0;
    }
    function setAutoRotate(on) {
      autoRotate = !!on;
      if (autoRotate) lastInteraction = performance.now() - 4000;
      else rotationSpeed = 0;
      emit('autorotate', autoRotate);
    }
    function interact() {
      stopMotion(); setAutoRotate(false);
      lastInteraction = performance.now();
      emit('interaction');
    }
    function flyTo(view, duration = 1100) {
      if (destroyed) return Promise.resolve(false);
      stopMotion();
      const to = {
        yaw: nearestYaw(st.yaw, Number.isFinite(view.yaw) ? view.yaw : st.yaw),
        pitch: clamp(Number.isFinite(view.pitch) ? view.pitch : st.pitch, LIM.pitchMin, LIM.pitchMax),
        dist: clamp(Number.isFinite(view.dist) ? view.dist : st.dist, LIM.distMin, LIM.distMax),
        target: view.target?.length === 3 && view.target.every(Number.isFinite) ? new pc.Vec3(...view.target) : st.target.clone()
      };
      const ms = reduced ? 0 : Math.max(0, Number(duration) || 0);
      if (!ms) {
        st.yaw = to.yaw; st.pitch = to.pitch; st.dist = zoomTarget = to.dist; st.target.copy(to.target);
        applyCam(); return Promise.resolve(true);
      }
      return new Promise(resolve => {
        flight = { elapsed: 0, duration: ms / 1000, resolve, to,
          from: { yaw: st.yaw, pitch: st.pitch, dist: st.dist, target: st.target.clone() } };
        invalidate();
      });
    }
    function zoom(factor) {
      if (!(factor > 0) || !Number.isFinite(factor)) return;
      const desired = clamp(zoomTarget * factor, LIM.distMin, LIM.distMax);
      interact(); zoomTarget = desired;
      if (reduced) { st.dist = desired; applyCam(); }
      invalidate();
    }

    // Drag, right-drag, pinch and keyboard share the same camera state.
    let drag = null, pinch = null;
    const pointers = new Map();
    canvas.tabIndex = 0;
    listen(canvas, 'pointerdown', e => {
      interact(); canvas.focus({ preventScroll: true });
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button });
      if (pointers.size === 1) drag = { x: e.clientX, y: e.clientY, button: e.button, time: e.timeStamp };
      else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { distance: Math.max(8, Math.hypot(a.x-b.x, a.y-b.y)) }; drag = null;
      }
      canvas.setPointerCapture(e.pointerId);
    });
    listen(canvas, 'pointermove', e => {
      const point = pointers.get(e.pointerId);
      if (!point) return;
      point.x = e.clientX; point.y = e.clientY;
      lastInteraction = performance.now();
      if (pinch && pointers.size === 2) {
        const [a,b] = [...pointers.values()];
        const distance = Math.max(8, Math.hypot(a.x-b.x,a.y-b.y));
        st.dist = zoomTarget = clamp(st.dist * pinch.distance / distance, LIM.distMin, LIM.distMax);
        pinch.distance = distance; applyCam(); return;
      }
      if (!drag) return;
      const dx = e.clientX-drag.x, dy = e.clientY-drag.y;
      const seconds = clamp((e.timeStamp-drag.time)/1000, .008, .08);
      drag.x = e.clientX; drag.y = e.clientY; drag.time = e.timeStamp;
      if (drag.button === 1 || drag.button === 2 || e.shiftKey) {
        st.target.add(cam.right.clone().mulScalar(-dx * st.dist * .0014));
        st.target.add(cam.up.clone().mulScalar(dy * st.dist * .0014));
        st.target.x = clamp(st.target.x,-3.1,2.6); st.target.y = clamp(st.target.y,-2.9,2.3); st.target.z = clamp(st.target.z,-5.2,3.7);
        velocity.yaw = velocity.pitch = 0;
      } else {
        st.yaw -= dx*.24; st.pitch = clamp(st.pitch-dy*.24,LIM.pitchMin,LIM.pitchMax);
        velocity.yaw = clamp(-dx*.24/seconds,-200,200); velocity.pitch = clamp(-dy*.24/seconds,-160,160);
      }
      applyCam();
    });
    function release(e) {
      if (!pointers.delete(e.pointerId)) return;
      pinch = null;
      if (pointers.size === 1) {
        const p = [...pointers.values()][0]; drag = { ...p, time: e.timeStamp };
        velocity.yaw = velocity.pitch = 0;
      } else drag = null;
      if (reduced || performance.now()-lastInteraction > 90 || e.type === 'pointercancel') velocity.yaw = velocity.pitch = 0;
    }
    for (const event of ['pointerup','pointercancel','lostpointercapture']) listen(canvas,event,release);
    listen(canvas,'wheel',e=>{ e.preventDefault(); const pixels = e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?height:1); zoom(Math.exp(clamp(pixels,-200,200)*.0015)); },{passive:false});
    listen(canvas,'contextmenu',e=>e.preventDefault());
    listen(canvas,'dblclick',()=>{ interact(); flyTo(HOME,900); });
    listen(canvas,'keydown',e=>{
      if(e.ctrlKey||e.metaKey||e.altKey)return;
      const turns={ArrowLeft:[-8,0],ArrowRight:[8,0],ArrowUp:[0,6],ArrowDown:[0,-6]};
      if(turns[e.key]) { e.preventDefault(); interact(); flyTo({yaw:st.yaw+turns[e.key][0],pitch:st.pitch+turns[e.key][1]},220); }
      else if(['+','=','-','_'].includes(e.key)) { e.preventDefault(); zoom(e.key==='-'||e.key==='_'?1.2:1/1.2); }
      else if(e.key==='Home') { e.preventDefault(); interact(); flyTo(HOME,900); }
    });

    // Points stay tied to scan coordinates. Reuse vectors and update only on camera changes.
    let points=[], showPoints=true;
    const projected=new pc.Vec3();
    function setHotspots(list) {
      points.forEach(p=>p.el?.remove());
      points=(list||[]).map(h=>({data:h,position:new pc.Vec3(...h.pos),el:null}));
      if(!overlay)return;
      for(const p of points) {
        const h=p.data, el=document.createElement('button');
        el.type='button'; el.className='hs'+(h.classe?' '+h.classe:''); el.dataset.id=h.id;
        el.setAttribute('aria-label',h.label);
        const dot=document.createElement('span'), num=document.createElement('span'), label=document.createElement('span');
        dot.className=h.encercle?'hs-ring':'hs-dot'; num.className=h.encercle?'hs-ring-tag':'hs-n';
        num.textContent=h.num??''; dot.append(num); label.className='hs-lb'; label.textContent=h.label;
        el.append(dot,label); el.addEventListener('click',e=>{e.stopPropagation();emit('select',h.id,h)});
        overlay.append(el); p.el=el;
      }
      invalidate();
    }
    function projectHotspots() {
      if(!overlay)return;
      const cameraPosition=cam.getPosition();
      for(const p of points) {
        const el=p.el,h=p.data;if(!el)continue;
        cam.camera.worldToScreen(p.position,projected);
        // CameraComponent.worldToScreen already returns CSS pixels in PlayCanvas 2.13.3.
        const x=projected.x,y=projected.y;
        const out=!showPoints||projected.z<0||x<18||x>width-18||y<18||y>height-18;
        let occluded=false;
        if(h.normal) {
          const dx=p.position.x-cameraPosition.x,dy=p.position.y-cameraPosition.y,dz=p.position.z-cameraPosition.z;
          occluded=(dx*h.normal[0]+dy*h.normal[1]+dz*h.normal[2])/(Math.hypot(dx,dy,dz)||1)>.12;
        }
        el.hidden=out;el.classList.toggle('is-occluded',occluded&&!out);
        if(!out) {
          el.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
          el.style.zIndex=String((occluded?500:1000)-Math.round(cameraPosition.distance(p.position)*10));
        }
      }
      needsProjection=false;
    }

    // A quiet ground reference anchors the scan without changing its geometry.
    const surface=document.createElement('canvas');surface.width=surface.height=256;
    const ctx=surface.getContext('2d');
    const gradient=ctx.createRadialGradient(128,128,8,128,128,128);
    gradient.addColorStop(0,'rgba(40,44,46,.88)');gradient.addColorStop(.6,'rgba(31,34,36,.64)');gradient.addColorStop(1,'rgba(15,17,18,0)');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,256,256);
    const texture=new pc.Texture(app.graphicsDevice,{width:256,height:256,format:pc.PIXELFORMAT_RGBA8,mipmaps:false});texture.setSource(surface);
    const mat=new pc.StandardMaterial();mat.useLighting=false;mat.emissive=new pc.Color(1,1,1);mat.emissiveMap=texture;mat.opacityMap=texture;mat.opacityMapChannel='a';mat.blendType=pc.BLEND_NORMAL;mat.depthWrite=false;mat.update();
    const ground=new pc.Entity('ground-reference');ground.addComponent('render',{type:'plane'});ground.render.material=mat;
    ground.setLocalScale(11,1,11);ground.setPosition(-.3,-2.73,-.8);app.root.addChild(ground);

    async function loadQuality(pref) {
      if(destroyed)return false;
      const next=pickQuality(pref);
      if(loading)return loading;
      if(asset&&next===quality)return true;
      emit('loading',next); emit('progress',0);
      if(destroyed)return false;
      loading=new Promise((resolve,reject)=>{
        const nextAsset=new pc.Asset('rodbot-'+next,'gsplat',{url:opts.src||FILES[next]});
        let settled=false;
        const finish=(result,error)=>{
          if(settled)return;
          settled=true;
          nextAsset.off('progress',onProgress);nextAsset.off('load',onLoad);nextAsset.off('error',onError);
          if(pendingLoad?.asset===nextAsset)pendingLoad=null;
          if(!result){nextAsset.unload();app.assets.remove(nextAsset)}
          if(error)reject(error);else resolve(result);
        };
        const onProgress=(received,total)=>{if(!destroyed)emit('progress',total?received/total:0)};
        const onError=err=>{
          if(destroyed){finish(false);return}
          finish(false,new Error(String(err)));emit('error',err);
        };
        const onLoad=()=>{
          if(destroyed){finish(false);return}
          let entity=null,nextSortEvent=null;
          try {
            entity=new pc.Entity('rodbot');entity.addComponent('gsplat',{asset:nextAsset});entity.setEulerAngles(0,0,180);app.root.addChild(entity);
            // A slow sort can finish after the camera's short render window has closed.
            nextSortEvent=entity.gsplat.instance?.sorter?.on('updated',()=>{
              if(destroyed||model!==entity)return;
              invalidate();
              if(visible&&!document.hidden)app.renderNextFrame=true;
            });
          } catch(err) {
            nextSortEvent?.off();entity?.destroy();onError(err);return;
          }
          sortEvent?.off();sortEvent=nextSortEvent;
          model?.destroy();if(asset){asset.unload();app.assets.remove(asset)}
          model=entity;asset=nextAsset;quality=next;fit();invalidate();
          finish(true);emit('quality',quality);emit('ready');
        };
        pendingLoad={asset:nextAsset,cancel:()=>finish(false)};
        app.assets.add(nextAsset);
        nextAsset.on('progress',onProgress);
        nextAsset.once('load',onLoad);
        nextAsset.once('error',onError);
        try{app.assets.load(nextAsset)}catch(err){onError(err)}
      });
      try{return await loading}finally{loading=null}
    }

    app.on('update',dt=>{
      if(destroyed||!visible||document.hidden)return;
      const seconds=clamp(dt,0,.1);
      if(flight) {
        const f=flight;f.elapsed+=seconds;const t=clamp(f.elapsed/f.duration,0,1),k=ease(t);
        st.yaw=f.from.yaw+(f.to.yaw-f.from.yaw)*k;st.pitch=f.from.pitch+(f.to.pitch-f.from.pitch)*k;
        st.dist=zoomTarget=f.from.dist+(f.to.dist-f.from.dist)*k;st.target.lerp(f.from.target,f.to.target,k);applyCam();
        if(t===1){flight=null;f.resolve(true)}
      } else if(!drag&&!pinch) {
        let changed=false;
        if(!reduced&&(Math.abs(velocity.yaw)>.04||Math.abs(velocity.pitch)>.04)) {
          const y=inertiaStep(velocity.yaw,seconds),p=inertiaStep(velocity.pitch,seconds);
          st.yaw+=y.distance;st.pitch=clamp(st.pitch+p.distance,LIM.pitchMin,LIM.pitchMax);
          velocity.yaw=y.velocity;velocity.pitch=st.pitch===LIM.pitchMin||st.pitch===LIM.pitchMax?0:p.velocity;changed=true;
        }
        if(Math.abs(zoomTarget-st.dist)>.0005) {st.dist=Math.exp(Math.log(st.dist)+(Math.log(zoomTarget)-Math.log(st.dist))*(1-Math.exp(-14*seconds)));changed=true}
        if(autoRotate&&performance.now()-lastInteraction>1200) {rotationSpeed+=(3-rotationSpeed)*(1-Math.exp(-2*seconds));st.yaw+=rotationSpeed*seconds;changed=true}
        if(changed)applyCam();
      }
      if(performance.now()<movingUntil)app.renderNextFrame=true;
    });
    // The engine refreshes camera matrices during prerender, after update.
    app.on('postrender',()=>{if(!destroyed&&needsProjection)projectHotspots()});
    const intersection=new IntersectionObserver(([entry])=>{
      visible=entry.isIntersecting;
      if(visible)invalidate();else {velocity.yaw=velocity.pitch=0;app.renderNextFrame=false}
      emit('visibility',visible&&!document.hidden);
    });intersection.observe(canvas);
    listen(document,'visibilitychange',()=>{if(!document.hidden)invalidate();else app.renderNextFrame=false;emit('visibility',visible&&!document.hidden)});
    listen(media,'change',e=>{reduced=e.matches;if(reduced){stopMotion();setAutoRotate(false)}emit('reducedmotion',reduced)});
    listen(canvas,'webglcontextlost',e=>{e.preventDefault();emit('error','Contexte 3D interrompu')});
    listen(canvas,'webglcontextrestored',()=>{invalidate();emit('ready')});

    const api={
      app,camera:cam,get quality(){return quality},get reducedMotion(){return reduced},
      on(name,fn){if(!events.has(name))events.set(name,new Set());events.get(name).add(fn);return api},
      flyTo,home:(duration=900)=>flyTo(HOME,duration),zoom,setAutoRotate,setHotspots,
      cancelFlight:stopMotion,setQuality:loadQuality,
      setHotspotsVisible(value){showPoints=!!value;invalidate()},
      getView(){return {yaw:st.yaw,pitch:st.pitch,dist:st.dist,target:[st.target.x,st.target.y,st.target.z]}},
      destroy(){
        if(destroyed)return;
        destroyed=true;stopMotion();pendingLoad?.cancel();sortEvent?.off();sortEvent=null;
        intersection.disconnect();resize.disconnect();cleanup.forEach(fn=>fn());points.forEach(p=>p.el?.remove());events.clear();
        // These custom resources are outside the asset registry and need the live device.
        ground.destroy();mat.destroy();texture.destroy();app.destroy();
      }
    };
    fit();applyCam();app.start();
    api.ready=loadQuality(quality);
    return api;
  }
};
export default RodbotViewer;
