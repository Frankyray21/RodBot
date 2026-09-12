import { createSimulation } from './simulation-state.js';

export const EXERCISES = [
  { id:'emergency-points', title:'1 · Trouver les quatre arrêts', page:12, prompt:'Tourne autour du RodBot. Touche les quatre repères d’arrêt d’urgence.', targets:['u1','u2','u3','u4'] },
  { id:'radio-points', title:'2 · Repérer les commandes radio', page:21, prompt:'Trouve JS1, la bascule centrale JS2, JS3 et le bouton vert PINCE.', targets:['js1','js2','js3','grip-enable'] },
  { id:'panel', title:'Explorer le coffret IHM', page:14, prompt:'Ouvre le coffret. Repère le récepteur radio, le PPU, les borniers et l’arrière de l’écran.', targets:['panel-door','receiver','ppu','panel-terminals','rear-hmi'] },
  { id:'manual-levers', title:'Observer les leviers manuels', page:15, prompt:'Repère les deux postes. Observe le débattement et le retour au neutre de chaque levier.', targets:['front-levers','side-levers'] },
  { id:'direct', title:'3 · Faire bouger le bras', page:22, prompt:'Prépare l’exercice. En DIRECT, maintiens JS1 vers le haut, puis relâche.', targets:[] },
  { id:'grip', title:'4 · Ouvrir et fermer la pince', page:55, prompt:'Maintiens PINCE et JS2 ensemble. L’ouverture demande au moins une seconde.', targets:[] },
  { id:'stop', title:'5 · Arrêter un mouvement', page:12, prompt:'Lance la démonstration lente. Enfonce ensuite un arrêt d’urgence dans le modèle.', targets:[] },
  { id:'rearm', title:'6 · Déverrouiller puis réarmer', page:49, prompt:'Déverrouiller un arrêt ne redémarre pas la machine. Observe les étapes séparées.', targets:[] },
  { id:'source', title:'7 · Comparer LOCAL et REMOTE', page:14, prompt:'En LOCAL, essaie JS1. Passe ensuite en REMOTE et compare.', targets:[] },
  { id:'free', title:'Essais libres · Mode DIRECT', page:22, prompt:'Explore les commandes disponibles. Le bras s’arrête au relâchement des manettes.', targets:[] }
];
const CONTROL_INFO = {
  'panel-door':{title:'Porte du panneau IHM',text:'Ouvre et referme la porte pour observer l’intérieur du coffret virtuel.',page:14},
  receiver:{title:'Récepteur radio',text:'Il reçoit les commandes envoyées par la télécommande.',page:14},
  ppu:{title:'PPU · Planification de trajectoire',text:'Repère le module à ailettes dans le coffret.',page:14},
  'rear-hmi':{title:'Arrière de l’écran IHM',text:'L’écran et ses raccordements suivent la porte lors de son ouverture.',page:14},
  'panel-terminals':{title:'Borniers du coffret',text:'Repère les rangées de borniers et la disposition des liaisons.',page:14},
  js1:{title:'JS1 · Manette gauche',text:'En DIRECT : levage haut/bas et pivotement gauche/droite.',page:22},
  js2:{title:'JS2 · Bascule centrale',text:'Ouvre ou ferme le grappin avec le bouton vert PINCE.',page:55},
  js3:{title:'JS3 · Manette droite',text:'En DIRECT : poignet haut/bas. Le télescope est expliqué dans le manuel.',page:22},
  'grip-enable':{title:'Bouton vert PINCE',text:'À maintenir avec la bascule centrale. Seul, il ne déplace pas la pince.',page:55},
  horn:{title:'Klaxon et gyrophare',text:'Commande de signalisation. Le son est désactivé dans cet exercice.',page:21},
  'radio-start':{title:'COMMENCER · Bouton latéral',text:'La mise en service de la radio est décrite dans le manuel. Ici, sa liaison est supposée établie.',page:49},
  'mode-direct':{title:'Mode DIRECT',text:'Chaque manette agit sur une articulation. Essaie les gestes disponibles dans cet atelier.',page:22},
  'mode-standby':{title:'Mode VEILLE',text:'La radio ne traite aucune demande de mouvement dans ce mode.',page:54},
  'mode-linear':{title:'Mode LINÉAIRE',text:'Les affectations diffèrent de DIRECT. Ce mode est présenté en repérage, sans animation de trajectoire.',page:57},
  'source-selector':{title:'Sélecteur LOCAL / REMOTE',text:'En LOCAL, la radio ne commande pas les mouvements du RodBot.',page:14},
  rearm:{title:'Réarmement de sécurité',text:'Le déverrouillage et le réarmement sont deux actions différentes.',page:49},
  'front-levers':{title:'Leviers manuels du mât',text:'Observe leur emplacement. Consulte leur affectation dans le manuel.',page:15},
  'side-levers':{title:'Leviers du poste latéral',text:'Observe les leviers et leur position de repos.',page:15}
};

// A separate practice session: it never writes to the course, quizzes or certificate.
export function mountTraining({ container, viewer, controls, emergencies, onActivate, onDeactivate, onManual }) {
  let active = false, selected = null, exercise = EXERCISES[0], seen = new Set(), evidence = new Set();
  let frame = 0, last = 0, demonstration = 0, demoStart = 0, previousFeedback = '', status = null;
  let panelFraction=0, panelGoal=0, panelShown=false, pendingPanelFocus=null;
  let infoReturnFocus=null;
  let panelViewRequest=0;
  const interiorIds=['receiver','ppu','rear-hmi','panel-terminals'];
  const pressed = new Map();
  const pulses = new Map();
  let previousVisualControls = '';
  const all = [...controls, ...emergencies];
  const find = id => all.find(h=>h.id===id);
  container.innerHTML = `
    <div class="sim-heading"><div><span class="sim-eyebrow">ATELIER VIRTUEL</span><h2>Pratiquer sur le RodBot</h2></div><button type="button" class="vbtn" id="simClose" aria-label="Quitter les exercices">×</button></div>
    <label class="sim-label" for="simExercise">Choisis un exercice</label>
    <select id="simExercise">${EXERCISES.map(x=>`<option value="${x.id}">${x.title}</option>`).join('')}</select>
    <p class="sim-prompt" id="simPrompt"></p>
    <div class="sim-progress"><progress id="simProgress" value="0" max="1"></progress><span id="simProgressText" role="status"></span></div>
    <div class="sim-tools"><button type="button" class="vbtn" id="simHint">Me montrer</button><button type="button" class="vbtn" id="simRestart">Recommencer</button><button type="button" class="vbtn" id="simManual">📖 Manuel</button></div>
    <dialog class="sim-info-modal" id="simSelected" aria-labelledby="simSelectedTitle" aria-describedby="simSelectedText"><div class="sim-info-body"><div class="sim-info-heading"><h3 id="simSelectedTitle"></h3><button type="button" class="vbtn" id="simInfoClose" aria-label="Fermer les informations" autofocus>Fermer ×</button></div><p id="simSelectedText"></p><div id="simSelectedActions"></div></div></dialog>
    <div class="sim-panel-access" id="simPanelAccess" hidden><button type="button" class="vbtn" id="simPanelToggle" aria-pressed="false">Ouvrir le coffret</button><p id="simPanelState" role="status">Coffret fermé</p><p class="sim-small">Observation de l’intérieur. Aucune intervention électrique n’est simulée.</p></div>
    <section class="sim-lever-practice" id="simLeverPractice" hidden aria-labelledby="simLeverTitle"><h3 id="simLeverTitle"></h3><p class="sim-small">Maintiens un bouton pour observer le levier, puis relâche. Débattement visuel seulement.</p><div id="simLeverControls"></div></section>
    <div id="simPractice">
      <div class="sim-state"><span id="simSource">REMOTE</span><span id="simMode">VEILLE</span><strong id="simArmed">À réarmer</strong></div>
      <p class="sim-feedback" id="simFeedback" role="status" aria-live="polite"></p>
      <details class="sim-prepare" open><summary>Préparer cet exercice</summary>
        <p>Alimentations raccordées et radio liée sont supposées dans cette scène.</p>
        <label class="sim-check"><input type="checkbox" id="simClear"> Je vérifie que la zone simulée est libre.</label>
        <p class="sim-small">Cette validation n’est pas une détection automatique de personnes.</p>
        <div class="sim-options" role="group" aria-label="Sélecteur du panneau"><button class="vbtn" data-source="LOCAL">LOCAL</button><button class="vbtn" data-source="REMOTE">REMOTE</button><button class="vbtn" id="simRearm">Réarmer</button></div>
        <div class="sim-options" role="group" aria-label="Mode de la radio"><button class="vbtn" data-mode="STANDBY">VEILLE</button><button class="vbtn" data-mode="DIRECT">DIRECT</button></div>
      </details>
      <div class="sim-radio"><h3>Commandes radio · DIRECT</h3><p>Haut et bas désignent la façade de la radio.</p>
        <div class="sim-sticks">
          <div class="sim-stick"><button class="sim-focus" data-focus="js1">JS1 · Gauche ↗</button><div class="sim-dpad" aria-label="Manette gauche">
            <button class="sim-hold up" data-hold="js1_up" aria-label="JS1 vers le haut : lever le bras">↑</button>
            <button class="sim-hold left" data-hold="js1_left" aria-label="JS1 vers la gauche : pivot antihoraire">←</button>
            <span class="sim-stick-center" id="simJS1" aria-hidden="true">●</span>
            <button class="sim-hold right" data-hold="js1_right" aria-label="JS1 vers la droite : pivot horaire">→</button>
            <button class="sim-hold down" data-hold="js1_down" aria-label="JS1 vers le bas : abaisser le bras">↓</button>
          </div><small>Levage et pivotement</small></div>
          <div class="sim-stick"><button class="sim-focus" data-focus="js3">JS3 · Droite ↗</button><div class="sim-dpad sim-dpad-vertical" aria-label="Manette droite">
            <button class="sim-hold up" data-hold="js3_up" aria-label="JS3 vers le haut : poignet vers le bas">↑</button>
            <span class="sim-stick-center" id="simJS3" aria-hidden="true">●</span>
            <button class="sim-hold down" data-hold="js3_down" aria-label="JS3 vers le bas : poignet vers le haut">↓</button>
          </div><small>Poignet haut et bas</small></div>
        </div>
        <div class="sim-grip"><button class="sim-focus" data-focus="js2">JS2 · Bascule centrale ↗</button><p>Raccourcis pédagogiques : ils maintiennent deux commandes physiques ensemble.</p>
          <div class="sim-combo"><button class="sim-hold" data-hold="grip_enable,js2_up">🟢 PINCE + ouvrir</button><button class="sim-hold" data-hold="grip_enable,js2_down">🟢 PINCE + fermer</button></div>
          <div class="sim-open-progress"><progress id="simGripDelay" max="1" value="0"></progress><span>Ouverture : maintien de 1 seconde</span></div>
          <details><summary>Essayer une seule commande</summary><div class="sim-combo"><button class="sim-hold" data-hold="grip_enable">PINCE seul</button><button class="sim-hold" data-hold="js2_up">JS2 seul</button></div></details>
        </div>
        <button class="vbtn sim-horn" data-hold="horn">Klaxon · signal simulé</button>
      </div>
      <div class="sim-demo" id="simDemo" hidden><p>Animation lente du bras, sans charge. Touche un arrêt rouge pour l’immobiliser.</p><button class="vbtn" id="simDemoStart">Lancer la démonstration</button></div>
      <div class="sim-estops"><h3>Arrêts enfoncés</h3><div id="simStopList"></div><p class="sim-small">Déverrouille chaque bouton, puis réarme. Aucune reprise automatique.</p></div>
      <div class="sim-readouts" aria-label="État du modèle"><span>Bras <strong id="simArmValue">0°</strong></span><span>Pince <strong id="simGripValue">0 %</strong></span><span id="simMotionStatus">Au repos</span></div>
    </div>
    <div class="sim-discover-list" id="simFindList"></div>
    <details class="sim-limits"><summary>Ce que cet atelier simule</summary><p>Repérage, commandes DIRECT sélectionnées, double commande du grappin et arrêts de sécurité.</p><p>Amplitudes et vitesses sont illustratives. Le grappin reste vide.</p><p>Le télescope, les trajectoires et la conduite des chenilles ne sont pas simulés ici.</p><p>Cet entraînement ne valide pas l’aptitude à conduire la machine.</p></details>`;
  const $ = id => container.querySelector('#'+id);
  const controlsBySelector = selector => [...container.querySelectorAll(selector)];
  const isFind = () => exercise.targets.length > 0;
  function closeInfo(restoreFocus=true) {
    const dialog=$('simSelected');
    if(!dialog.open)return;
    const target=infoReturnFocus;infoReturnFocus=null;
    dialog.close();
    if(restoreFocus&&target?.isConnected)target.focus({preventScroll:true});
  }
  function showInfo(trigger) {
    releaseAll();viewer.setAutoRotate(false);
    const dialog=$('simSelected');
    if(!dialog.open){infoReturnFocus=trigger||document.activeElement;dialog.showModal();}
    $('simInfoClose').focus({preventScroll:true});
  }
  $('simInfoClose').addEventListener('click',()=>closeInfo());
  $('simSelected').addEventListener('cancel',event=>{event.preventDefault();closeInfo();});
  $('simSelected').addEventListener('click',event=>{if(event.target===$('simSelected'))closeInfo();});
  function updateProgress() {
    let steps, count;
    if (isFind()) { steps=exercise.targets.length;count=exercise.targets.filter(id=>seen.has(id)).length; }
    else {
      const tasks={direct:['moved-arm','released'],grip:['opened','closed'],stop:['demo','stopped'],rearm:['stopped','unlocked','rearmed'],source:['local-refusal','remote-moved'],free:[]};
      const wanted=tasks[exercise.id]||[]; steps=wanted.length; count=wanted.filter(id=>evidence.has(id)).length;
    }
    $('simProgress').max=Math.max(1,steps);$('simProgress').value=count;
    $('simProgressText').textContent=steps ? (count===steps?'Exercice parcouru · tu peux recommencer':`${count} / ${steps} étapes observées`) : 'Essais libres, sans score';
    $('simProgress').hidden=!steps;
    controlsBySelector('[data-target]').forEach(b=>b.classList.toggle('is-found',seen.has(b.dataset.target)));
  }
  function showFeedback(text) { if (previousFeedback!==text) { $('simFeedback').textContent=text;previousFeedback=text; } }
  function stateChanged(next) {
    status=next;
    viewer.setAccessPose?.({source:next.source==='REMOTE'?1:0});
    $('simSource').textContent=next.source;
    $('simMode').textContent=next.mode==='STANDBY'?'VEILLE':next.mode;
    const stopActive=Object.entries(next.estops||{}).some(([id,on])=>on&&(id!=='u2'||next.source==='REMOTE'));
    $('simArmed').textContent=stopActive?'ARRÊT ENFONCÉ':next.armed?'Prêt':'À réarmer';
    container.classList.toggle('is-stopped',stopActive);
    controlsBySelector('[data-source]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.source===next.source)));
    controlsBySelector('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===next.mode)));
    $('simClear').checked=!!next.zoneClear;
    $('simArmValue').textContent=next.pose.arm.toFixed(1)+'°';
    $('simGripValue').textContent=Math.round(next.pose.grip)+' %';
    const held=Array.isArray(next.held)?next.held:Object.keys(next.held||{}).filter(k=>next.held[k]);
    syncButtons(next);
    $('simMotionStatus').textContent=next.closing?'Fermeture commandée':held.length&&next.armed&&!stopActive?'Commande maintenue':'Au repos';
    $('simGripDelay').value=next.gripHoldSeconds ?? next.gripHold ?? 0;
    if (next.feedback) showFeedback(typeof next.feedback==='string'?next.feedback:next.feedback.text||'');
    for(const id of ['u1','u2','u3','u4']) {
      const item=$('simRelease-'+id); if(item) item.hidden=!next.estops[id];
    }
    if (next.pose.arm>1) evidence.add('moved-arm');
    if (next.pose.grip>20) evidence.add('opened');
    if (evidence.has('opened')&&next.pose.grip<3) evidence.add('closed');
    if (evidence.has('local-refusal')&&next.source==='REMOTE'&&next.pose.arm>1) evidence.add('remote-moved');
    if (stopActive) { evidence.add('stopped'); demonstration=0; }
    if(evidence.has('stopped')&&!Object.values(next.estops).some(Boolean))evidence.add('unlocked');
    if(evidence.has('unlocked')&&next.armed)evidence.add('rearmed');
    updateProgress();
  }
  const simulation=createSimulation({onChange:stateChanged,onPose:pose=>viewer.setPose(pose)});
  function syncButtons(state) {
    if (!state) return;
    // Physical controls can move even when LOCAL/VEILLE rejects the hydraulic
    // command. Accepted engine inputs also cover the hands-free demonstration.
    const held=new Set(Object.keys(state.held||{}).filter(key=>state.held[key]));
    for(const button of pressed.keys()) for(const key of (button.dataset.hold||'').split(',')) if(key) held.add(key);
    const input=key=>Number(held.has(key));
    const controls={
      js1x:input('js1_right')-input('js1_left'),js1y:input('js1_up')-input('js1_down'),
      js2:input('js2_up')-input('js2_down'),js3x:0,js3y:input('js3_up')-input('js3_down')
    };
    const signature=JSON.stringify(controls);
    if(signature!==previousVisualControls){previousVisualControls=signature;viewer.setControlPose?.(controls);}
    const values=Object.fromEntries((viewer.availableButtonKeys||[]).map(key=>[key,pulses.has(key)?1:0]));
    for(const id of ['u1','u2','u3','u4']) values[id]=Number(!!state.estops[id]);
    values.grip=input('grip_enable');
    viewer.setButtonPose?.(values);
  }
  function clearPressed() {
    pressed.forEach(button=>button.classList.remove('is-held'));pressed.clear();
    viewer.setControlPose?.(Object.fromEntries((viewer.availableControlKeys||[]).map(key=>[key,0])));
    previousVisualControls='';
  }
  const dispatch=action=>{
    if(['RESET','RELEASE_ALL','ESTOP','RELEASE_ESTOP','REARM','SET_SOURCE','SET_MODE'].includes(action.type)||(action.type==='ZONE_CLEAR'&&!action.value)){
      clearPressed();demonstration=0;
    }
    const result=simulation.dispatch(action);stateChanged(result||simulation.getState());
    const key=action.type==='REARM'?'rearm':action.type==='SET_MODE'?(action.value==='DIRECT'?'mode_direct':'mode_standby'):null;
    if(key&&viewer.setButtonPose) pulses.set(key,performance.now()+220);
    syncButtons(status);
  };

  function releaseAll() {
    demonstration=0;
    panelViewRequest++;
    panelGoal=panelFraction;pendingPanelFocus=null;
    pulses.clear();
    dispatch({type:'RELEASE_ALL'});
    if(evidence.has('moved-arm'))evidence.add('released');
    updateProgress();syncPanel();
  }
  function frameTick(time) {
    frame=0;
    if(!active)return;
    const seconds=last?Math.min(.08,(time-last)/1000):0;last=time;
    if(Math.abs(panelGoal-panelFraction)>.0001) {
      const step=seconds*.85;
      panelFraction+=Math.sign(panelGoal-panelFraction)*Math.min(step,Math.abs(panelGoal-panelFraction));
      viewer.setAccessPose?.({panel:panelFraction});
      syncPanel();
    }
    for(const [key,end] of pulses) if(time>=end)pulses.delete(key);
    if(demonstration&&time-demoStart>12000)releaseAll();
    dispatch({type:'STEP',seconds:demonstration?seconds*.2:seconds});
    frame=requestAnimationFrame(frameTick);
  }
  function focus(id,{popup=false,trigger=null}={}) {
    const h=find(id);if(!h)return;
    if(interiorIds.includes(id)&&panelFraction<1){setPanel(1,{frameDoor:false});pendingPanelFocus={id,popup,trigger};return;}
    viewer.setAutoRotate(false);viewer.flyTo(h.view,900);
    select(id,false,{popup,trigger});
  }
  function select(id, physical=true, {popup=true,trigger=null}={}) {
    if(!active)return false;
    const h=find(id);if(!h)return false;
    const stopDemo=physical&&demonstration&&/^u[1-4]$/.test(id);
    selected=id;
    if(popup&&isFind()&&exercise.targets.includes(id)){seen.add(id);updateProgress();}
    const info=CONTROL_INFO[id]||{title:h.label,text:id==='u2'?'Arrêt radio actif en REMOTE. Il est inactif en LOCAL.':'Arrêt du circuit de sécurité de la machine simulée.',page:12};
    $('simSelectedTitle').textContent=info.title;$('simSelectedText').textContent=info.text;
    const actions=$('simSelectedActions');actions.replaceChildren();
    function action(label,fn,cls='vbtn'){const b=document.createElement('button');b.type='button';b.className=cls;b.textContent=label;b.addEventListener('click',()=>{closeInfo();fn();});actions.append(b);}
    if(id==='panel-door') {
      action('Ouvrir le coffret',()=>setPanel(1));action('Fermer le coffret',()=>setPanel(0));
    } else if(/^u[1-4]$/.test(id)) {
      action('Enfoncer cet arrêt',()=>{releaseAll();dispatch({type:'ESTOP',id});},'vbtn sim-red');
      action('Déverrouiller',()=>dispatch({type:'RELEASE_ESTOP',id}));
    } else if(id==='source-selector') {
      action('LOCAL',()=>dispatch({type:'SET_SOURCE',value:'LOCAL'}));action('REMOTE',()=>dispatch({type:'SET_SOURCE',value:'REMOTE'}));
    } else if(id==='rearm')action('Réarmer',()=>dispatch({type:'REARM'}));
    else if(id==='radio-start')action('Observer l’enfoncement',()=>{releaseAll();pulses.set('start',performance.now()+300);syncButtons(status);});
    else if(id==='mode-linear')action('Observer la touche',()=>{releaseAll();pulses.set('mode_linear',performance.now()+300);syncButtons(status);});
    else if(id==='mode-direct')action('Sélectionner DIRECT',()=>{releaseAll();dispatch({type:'SET_MODE',value:'DIRECT'});});
    else if(id==='mode-standby')action('Sélectionner VEILLE',()=>{releaseAll();dispatch({type:'SET_MODE',value:'STANDBY'});});
    else if(id==='horn')action('Essayer le signal',()=>dispatch({type:'PRESS',command:'horn'}));
    else if(id==='front-levers'||id==='side-levers') {
      action('Essayer les leviers',()=>showManualLevers(id));
    }
    action('Manuel · p. '+info.page,()=>onManual(info.page));
    container.querySelectorAll('[data-focus]').forEach(b=>b.classList.toggle('is-selected',b.dataset.focus===id));
    if(popup)showInfo(trigger);
    if(stopDemo){releaseAll();dispatch({type:'ESTOP',id});}
    return true;
  }
  function showManualLevers(id) {
      releaseAll();
      $('simLeverPractice').hidden=false;
      $('simLeverTitle').textContent=CONTROL_INFO[id].title;
      const actions=$('simLeverControls');actions.replaceChildren();
      const bank=id==='front-levers'?'front':'side';const count=bank==='front'?7:5;
      for(let i=1;i<=count;i++) {
        const key=bank+String(i).padStart(2,'0');
        const row=document.createElement('div');row.className='sim-lever-row';
        const name=document.createElement('span');name.textContent='Levier '+i;row.append(name);
        for(const [label,value] of [['−',-1],['+',1]]) {
          const b=document.createElement('button');b.type='button';b.className='sim-hold';b.textContent=label;b.setAttribute('aria-label',`Levier ${i}, ${value<0?'reculer':'avancer'}`);
          const start=()=>{releaseAll();pressed.set(b,b);b.classList.add('is-held');viewer.setControlPose?.({[key]:value});};
          const end=()=>{pressed.delete(b);b.classList.remove('is-held');viewer.setControlPose?.({[key]:0});};
          b.addEventListener('pointerdown',e=>{e.preventDefault();b.focus({preventScroll:true});b.setPointerCapture(e.pointerId);start();});
          ['pointerup','pointercancel','lostpointercapture','blur'].forEach(event=>b.addEventListener(event,end));
          b.addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();start();}});
          b.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();end();}});
          row.append(b);
        }
        actions.append(row);
      }
  }
  function restart() {
    closeInfo();releaseAll();seen=new Set();evidence=new Set();selected=null;
    $('simLeverPractice').hidden=true;
    panelFraction=0;panelGoal=0;panelShown=false;pendingPanelFocus=null;
    dispatch({type:'RESET'});
    viewer.setAutoRotate(false);viewer.resetPose();syncButtons(simulation.getState());
    const exercisePoints={
      stop:['u1','u2','u3','u4','source-selector','rearm'],
      rearm:['u1','u2','u3','u4','source-selector','rearm'],
      direct:['js1','js3','source-selector','rearm','mode-direct','mode-standby','u2'],
      grip:['js2','grip-enable','source-selector','rearm','u2'],
      source:['source-selector','rearm','js1','u2']
    };
    const ids=isFind()?exercise.targets:exercisePoints[exercise.id];
    const points=(ids?ids.map(find).filter(Boolean):all).filter(h=>!interiorIds.includes(h.id));
    viewer.setHotspots(points);viewer.setHotspotsVisible(true);
    $('simPrompt').textContent=exercise.prompt;
    $('simPractice').hidden=isFind();$('simFindList').hidden=!isFind();
    $('simDemo').hidden=exercise.id!=='stop';
    $('simPanelAccess').hidden=exercise.id!=='panel';
    $('simPanelToggle').disabled=!(viewer.availableAccessKeys||[]).includes('panel');
    $('simHint').hidden=!isFind();
    $('simFindList').replaceChildren();
    for(const id of exercise.targets){const h=find(id);if(!h)continue;const b=document.createElement('button');b.className='sim-location';b.type='button';b.dataset.target=id;b.textContent=h.label;b.addEventListener('click',()=>focus(id,{popup:true,trigger:b}));$('simFindList').append(b);}
    if(exercise.id==='rearm')dispatch({type:'ESTOP',id:'u1'});
    if(exercise.id==='source')dispatch({type:'SET_SOURCE',value:'LOCAL'});
    if(exercise.id==='panel'&&find('panel-door'))framePanel();else viewer.home(700);
    syncPanel();updateProgress();
  }
  function syncPanel() {
    const opening=panelGoal>.5;
    $('simPanelToggle').textContent=opening?'Fermer le coffret':'Ouvrir le coffret';
    $('simPanelToggle').setAttribute('aria-pressed',String(opening));
    $('simPanelState').textContent=Math.abs(panelFraction-panelGoal)>.001?(opening?'Ouverture…':'Fermeture…'):panelFraction>.98?'Coffret ouvert':panelFraction<.01?'Coffret fermé':'Porte en pause';
    const shown=panelFraction>.85;
    if(exercise.id==='panel'&&shown!==panelShown){
      panelShown=shown;
      viewer.setHotspots((shown?exercise.targets:['panel-door']).map(find).filter(Boolean));
    }
    if(panelFraction===1&&pendingPanelFocus){const request=pendingPanelFocus;pendingPanelFocus=null;focus(request.id,request);}
  }
  function framePanel() {
    const request=++panelViewRequest;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(active&&exercise.id==='panel'&&request===panelViewRequest&&find('panel-door'))viewer.flyTo(find('panel-door').view,700);
    }));
  }
  function setPanel(value,{frameDoor=true}={}) {
    if(!(viewer.availableAccessKeys||[]).includes('panel'))return;
    if(exercise.id!=='panel')activate('panel');
    releaseAll();panelGoal=value;syncPanel();
    if(frameDoor)framePanel();
  }
  $('simPanelToggle').addEventListener('click',()=>setPanel(panelGoal>.5?0:1));
  for(const h of emergencies){
    const b=document.createElement('button');b.type='button';b.className='vbtn';b.id='simRelease-'+h.id;b.hidden=true;b.textContent='Déverrouiller : '+h.label.replace("Arrêt d'urgence : ",'');
    b.addEventListener('click',()=>dispatch({type:'RELEASE_ESTOP',id:h.id}));$('simStopList').append(b);
  }
  controlsBySelector('[data-hold]').forEach(button=>{
    button.type='button';
    const commands=button.dataset.hold.split(',');
    const begin=()=>{
      if(!active||pressed.has(button))return;
      if(demonstration)releaseAll();
      demonstration=0;pressed.set(button,button);button.classList.add('is-held');
      if(status?.source==='LOCAL'&&commands.some(c=>c.startsWith('js')))evidence.add('local-refusal');
      commands.forEach(command=>dispatch({type:'PRESS',command}));
    };
    const end=()=>{
      if(!pressed.has(button))return;
      pressed.delete(button);button.classList.remove('is-held');commands.forEach(command=>dispatch({type:'RELEASE',command}));
      if(evidence.has('moved-arm'))evidence.add('released');updateProgress();
    };
    button.addEventListener('pointerdown',e=>{e.preventDefault();button.focus({preventScroll:true});button.setPointerCapture(e.pointerId);begin();});
    ['pointerup','pointercancel','lostpointercapture'].forEach(name=>button.addEventListener(name,end));
    button.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();if(!e.repeat)begin();}});
    button.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();end();}});
    button.addEventListener('blur',end);
    button.addEventListener('contextmenu',e=>e.preventDefault());
  });
  controlsBySelector('[data-focus]').forEach(b=>b.addEventListener('click',()=>focus(b.dataset.focus,{popup:true,trigger:b})));
  controlsBySelector('[data-source]').forEach(b=>b.addEventListener('click',()=>{releaseAll();dispatch({type:'SET_SOURCE',value:b.dataset.source});}));
  controlsBySelector('[data-mode]').forEach(b=>b.addEventListener('click',()=>{releaseAll();dispatch({type:'SET_MODE',value:b.dataset.mode});}));
  $('simClear').addEventListener('change',e=>dispatch({type:'ZONE_CLEAR',value:e.target.checked}));
  $('simRearm').addEventListener('click',()=>dispatch({type:'REARM'}));
  $('simExercise').addEventListener('change',()=>{exercise=EXERCISES.find(x=>x.id===$('simExercise').value)||EXERCISES[0];restart();});
  $('simRestart').addEventListener('click',restart);
  $('simHint').addEventListener('click',()=>{const id=exercise.targets.find(id=>!seen.has(id))||exercise.targets[0];if(id)focus(id,{popup:true,trigger:$('simHint')});});
  $('simManual').addEventListener('click',()=>onManual(exercise.page));
  $('simClose').addEventListener('click',()=>{deactivate();onDeactivate();});
  $('simDemoStart').addEventListener('click',()=>{
    releaseAll();
    dispatch({type:'PRESS',command:'js1_up'});
    const s=simulation.getState();
    if(s.armed&&s.source==='REMOTE'&&s.mode==='DIRECT'&&s.zoneClear&&!Object.values(s.estops).some(Boolean)){
      demonstration=1;demoStart=performance.now();evidence.add('demo');viewer.home(500);
      showFeedback('Démonstration en cours. Touche un arrêt rouge dans le modèle.');
    }
    updateProgress();
  });
  function activate(id) {
    active=true;container.hidden=false;onActivate();
    if(id&&EXERCISES.some(x=>x.id===id)){exercise=EXERCISES.find(x=>x.id===id);$('simExercise').value=id;}
    restart();last=0;if(!frame)frame=requestAnimationFrame(frameTick);
  }
  function deactivate() {
    closeInfo();releaseAll();active=false;container.hidden=true;if(frame)cancelAnimationFrame(frame);frame=0;last=0;
  }
  viewer.on('visibility',visible=>{if(!visible)releaseAll();});
  window.addEventListener('blur',releaseAll);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseAll();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&active)releaseAll();});
  stateChanged(simulation.getState());
  return {activate,deactivate,select,releaseAll,closeInfo,get active(){return active;},getState:()=>simulation.getState()};
}
