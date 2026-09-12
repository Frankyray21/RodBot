/* LP RodBot V5. Camera positions and independent clips match the validated source viewer. */
export const VIEWS = [
  { key: 'overview', orbit: '-35deg 70deg 110%' },
  { key: 'profile', orbit: '0deg 80deg 110%' },
  { key: 'basket', orbit: '140deg 64deg 110%' },
  { key: 'screen', orbit: '210deg 75deg 55%', target: '-1.015m 1.45m -0.61m' },
  { key: 'frontLevers', orbit: '-100deg 75deg 45%', target: '-1.45m 1.37m 0m' },
  { key: 'sideLevers', orbit: '0deg 75deg 45%', target: '-1.02m 1.28m 0.66m' },
  { key: 'remote', orbit: '-30deg 65deg 1.5m', target: '-2.30m 1.442m 1.464m' },
  { key: 'tripod', orbit: '-30deg 70deg 3.8m', target: '-2.30m 0.822m 1.598m' },
  { key: 'roger', orbit: '155deg 76deg 2.6m', target: '0.2692m 1.102m -0.727m' }
];
export const MOTIONS = [
  { id: 'turret', clip: 'Rotation_tourelle', min: -35, max: 35, initial: 0, unit: '°', reverse: false },
  { id: 'arm', clip: 'Elevation_bras', min: 0, max: 15, initial: 0, unit: '°', reverse: true },
  { id: 'wrist', clip: 'Inclinaison_pince', min: -10, max: 10, initial: 3, unit: '°', reverse: false },
  { id: 'tool', clip: 'Rotation_pince', min: -35, max: 35, initial: 0, unit: '°', reverse: false },
  { id: 'grip', clip: 'Ouverture_pince', min: 0, max: 100, initial: 0, unit: '%', reverse: false },
  { id: 'jacks', clip: 'Stabilisateurs', min: 0, max: 100, initial: 100, unit: '%', reverse: false }
];
export function motionTime(motion, value) {
  const fraction = (Math.max(motion.min, Math.min(motion.max, value)) - motion.min) / (motion.max - motion.min);
  return motion.reverse ? 1 - fraction : fraction;
}
const TEXT = {
  fr: {
    title: 'LP RodBot | Réplique 3D', skip: 'Aller au modèle 3D', training: 'Formation', scan: 'Scan de référence',
    eyebrow: 'EXPLORATION DE L’ÉQUIPEMENT', replica: 'Réplique 3D', intro: 'Explore la télécommande, les marquages et les détails de la machine.',
    viewerLabel: 'Modèle 3D interactif', fullscreen: 'Plein écran', exitFullscreen: 'Quitter le plein écran',
    modelAlt: 'LP RodBot avec bras articulé, chenilles et télécommande noire sur un trépied jaune.',
    loading: 'Chargement du modèle 3D', loadingHelp: 'Le premier chargement peut prendre quelques secondes.',
    preparing: 'Préparation de la vue 3D', ready: 'Vue 3D interactive', preview: 'Aperçu de l’équipement', dimensions: 'Dimensions estimées',
    errorTitle: 'Affichage 3D indisponible', errorLoad: 'Vérifie ta connexion, puis réessaie.', errorContext: 'L’affichage a été interrompu. Recharge la page pour le retrouver.',
    errorModule: 'Recharge la page pour réessayer.', retry: 'Réessayer', controlsLabel: 'Commandes de visualisation',
    explore: 'Explore la machine', gesture: 'Glisse pour tourner. Pince ou utilise la molette pour zoomer.',
    views: 'Angles de vue', overview: 'Vue d’ensemble', profile: 'Profil', basket: 'Côté panier', screen: 'Écran opérateur', frontLevers: 'Leviers frontaux', sideLevers: 'Leviers latéraux', remote: 'Télécommande', tripod: 'Trépied', roger: 'Machines Roger', free: 'Vue libre',
    articulate: 'Articuler le modèle', motionHelp: 'Déplace les curseurs pour observer les articulations.', motionsLabel: 'Mouvements du modèle',
    turret: 'Orientation de la tourelle', arm: 'Levée du bras', wrist: 'Inclinaison de la pince', tool: 'Rotation de la pince', grip: 'Ouverture de la pince', jacks: 'Déploiement des jacks',
    initialPose: 'Position initiale', motionNote: 'Amplitudes estimées pour la visualisation. Les mouvements peuvent être combinés.', motionUnavailable: 'Les mouvements sont indisponibles. Recharge la page pour réessayer.',
    presentation: 'Présentation à 360°', play: 'Lancer la présentation', pause: 'Mettre en pause', resetView: 'Recentrer la vue',
    sourceNote: 'Reconstruction issue de la vidéo, des photos et du manuel. Certaines proportions et parties cachées restent estimées.',
    footer: 'Visualisation pour la formation. Les trajectoires de travail restent à valider.', lighting: 'Éclairage :', degrees: 'degrés', percent: 'pour cent', fullscreenUnavailable: 'Le plein écran est indisponible dans ce navigateur.'
  },
  en: {
    title: 'LP RodBot | 3D replica', skip: 'Skip to the 3D model', training: 'Training', scan: 'Reference scan',
    eyebrow: 'EXPLORE THE EQUIPMENT', replica: '3D replica', intro: 'Explore the remote control, markings and machine details.',
    viewerLabel: 'Interactive 3D model', fullscreen: 'Full screen', exitFullscreen: 'Exit full screen',
    modelAlt: 'LP RodBot with an articulated arm, tracks and a black radio remote on a yellow tripod.',
    loading: 'Loading the 3D model', loadingHelp: 'The first load may take a few seconds.',
    preparing: 'Preparing the 3D view', ready: 'Interactive 3D view', preview: 'Equipment preview', dimensions: 'Estimated dimensions',
    errorTitle: '3D view unavailable', errorLoad: 'Check your connection, then try again.', errorContext: 'The display was interrupted. Reload the page to restore it.',
    errorModule: 'Reload the page to try again.', retry: 'Try again', controlsLabel: 'Viewing controls',
    explore: 'Explore the machine', gesture: 'Drag to rotate. Pinch or use the scroll wheel to zoom.',
    views: 'Camera views', overview: 'Overview', profile: 'Side view', basket: 'Rod basket', screen: 'Operator display', frontLevers: 'Front levers', sideLevers: 'Side levers', remote: 'Remote control', tripod: 'Tripod', roger: 'Machines Roger', free: 'Free view',
    articulate: 'Move the model', motionHelp: 'Move the sliders to explore the joints.', motionsLabel: 'Model movements',
    turret: 'Turret orientation', arm: 'Arm elevation', wrist: 'Gripper tilt', tool: 'Gripper rotation', grip: 'Gripper opening', jacks: 'Jack extension',
    initialPose: 'Initial position', motionNote: 'Estimated ranges for visualization. Movements can be combined.', motionUnavailable: 'Movements are unavailable. Reload the page to try again.',
    presentation: '360° presentation', play: 'Start the presentation', pause: 'Pause the presentation', resetView: 'Reset the view',
    sourceNote: 'Reconstructed from the video, photos and manual. Some proportions and hidden parts remain estimated.',
    footer: 'Visualization for training. Working trajectories still require validation.', lighting: 'Lighting:', degrees: 'degrees', percent: 'percent', fullscreenUnavailable: 'Full screen is unavailable in this browser.'
  }
};
let lang = 'fr';
try { lang = localStorage.getItem('rodbot_lang') === 'en' ? 'en' : 'fr'; } catch (_) {}
const queryLang = new URLSearchParams(location.search).get('lang');
if (queryLang === 'fr' || queryLang === 'en') lang = queryLang;
const $ = id => document.getElementById(id);
const model = $('viewer');
const initialPose = Object.fromEntries(MOTIONS.map(motion => [motion.id, motion.initial]));
let pose = { ...initialPose };
let loaded = false;
let playing = false;
let canArticulate = false;
let hasAnimation = false;
let activeView = 0;
let poseGeneration = 0;
let errorKey = '';
let noticeKey = '';
const t = key => TEXT[lang][key] || key;

function refreshState() {
  $('viewerStatus').textContent = t(loaded ? 'ready' : errorKey ? 'preview' : 'preparing');
  $('currentView').textContent = t(activeView === null ? 'free' : VIEWS[activeView].key);
  $('playLabel').textContent = t(playing ? 'pause' : 'play');
  $('play').firstElementChild.textContent = playing ? 'Ⅱ' : '▶';
  $('play').setAttribute('aria-pressed', String(playing));
  $('play').disabled = !loaded || !hasAnimation;
  $('resetView').disabled = !loaded;
  $('motionFields').disabled = !loaded || !canArticulate;
  $('motionNotice').hidden = !loaded || canArticulate;
  $('workspace').classList.toggle('is-ready', loaded);
  document.querySelectorAll('[data-view]').forEach(button => {
    button.disabled = !loaded;
    button.setAttribute('aria-pressed', String(Number(button.dataset.view) === activeView));
  });
  $('errorText').textContent = errorKey ? t(errorKey) : '';
  $('notice').textContent = noticeKey ? t(noticeKey) : '';
  $('notice').hidden = !noticeKey;
  $('fullscreen').setAttribute('aria-label', t(document.fullscreenElement === $('workspace') ? 'exitFullscreen' : 'fullscreen'));
}
function refreshSliders() {
  for (const motion of MOTIONS) {
    const input = $('motion-' + motion.id);
    input.value = String(pose[motion.id]);
    input.setAttribute('aria-valuetext', `${pose[motion.id]} ${t(motion.unit === '°' ? 'degrees' : 'percent')}`);
    $('value-' + motion.id).textContent = pose[motion.id] + motion.unit;
  }
}
function setLanguage(value, updateUrl = true) {
  lang = value === 'en' ? 'en' : 'fr';
  document.documentElement.lang = lang;
  document.title = t('title');
  document.querySelector('meta[name="description"]').content = t('intro');
  model.alt = t('modelAlt');
  document.querySelectorAll('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n); });
  document.querySelectorAll('[data-i18n-aria]').forEach(element => { element.setAttribute('aria-label', t(element.dataset.i18nAria)); });
  document.querySelectorAll('[data-lang]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.lang === lang)));
  try { localStorage.setItem('rodbot_lang', lang); } catch (_) {}
  if (updateUrl) {
    const url = new URL(location.href);
    url.searchParams.set('lang', lang);
    history.replaceState(null, '', url);
  }
  refreshSliders();
  refreshState();
}
// Independent joint clips hold their final pose beyond t=1. This avoids endpoint wrapping.
function applyPose(values) {
  if (!canArticulate) return;
  model.timeScale = 0;
  model.animationCrossfadeDuration = 0;
  for (const motion of MOTIONS) {
    model.appendAnimation(motion.clip, { time: motionTime(motion, values[motion.id]), timeScale: 0, weight: 1, fade: false });
  }
  const generation = ++poseGeneration;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (generation === poseGeneration) model.pause();
  }));
}
function stop() {
  if (!loaded) return;
  poseGeneration++;
  model.pause();
  model.currentTime = 0;
  playing = false;
  applyPose(pose);
}
function setView(index) {
  if (!loaded || !VIEWS[index]) return;
  stop();
  model.cameraOrbit = VIEWS[index].orbit;
  model.cameraTarget = VIEWS[index].target || 'auto auto auto';
  model.fieldOfView = '30deg';
  activeView = index;
  refreshState();
}
function changePose(id, value) {
  const motion = MOTIONS.find(item => item.id === id);
  if (!loaded || !canArticulate || !motion || !Number.isFinite(value)) return;
  pose = { ...pose, [id]: Math.max(motion.min, Math.min(motion.max, value)) };
  playing = false;
  applyPose(pose);
  refreshSliders();
  refreshState();
}
function fail(key) {
  poseGeneration++;
  loaded = false;
  playing = false;
  errorKey = key;
  $('loading').hidden = true;
  $('error').hidden = false;
  refreshState();
}

// Build accessible controls once. Language changes preserve the current pose and focus.
for (let index = 0; index < VIEWS.length; index++) {
  if (index === 6 || index === 8) continue;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button view-button';
  button.dataset.view = String(index);
  button.dataset.i18n = VIEWS[index].key;
  button.disabled = true;
  button.setAttribute('aria-pressed', String(index === 0));
  $('viewButtons').appendChild(button);
}
for (const motion of MOTIONS) {
  const row = document.createElement('div');
  row.className = 'motion-row';
  const line = document.createElement('div');
  const label = document.createElement('label');
  label.htmlFor = 'motion-' + motion.id;
  label.dataset.i18n = motion.id;
  const output = document.createElement('output');
  output.id = 'value-' + motion.id;
  output.htmlFor = 'motion-' + motion.id;
  line.append(label, output);
  const input = document.createElement('input');
  input.type = 'range';
  input.id = 'motion-' + motion.id;
  input.min = String(motion.min);
  input.max = String(motion.max);
  input.step = '1';
  input.addEventListener('input', () => changePose(motion.id, Number(input.value)));
  row.append(line, input);
  $('motionSliders').appendChild(row);
}
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => setView(Number(button.dataset.view))));
document.querySelectorAll('[data-lang]').forEach(button => button.addEventListener('click', () => setLanguage(button.dataset.lang)));
$('resetView').addEventListener('click', () => setView(0));
$('retry').addEventListener('click', () => location.reload());
$('resetPose').addEventListener('click', () => {
  if (!loaded || !canArticulate) return;
  poseGeneration++;
  model.pause();
  model.currentTime = 0;
  pose = { ...initialPose };
  playing = false;
  applyPose(pose);
  refreshSliders();
  refreshState();
});
$('play').addEventListener('click', () => {
  if (!loaded || !hasAnimation) return;
  poseGeneration++;
  if (playing) model.pause();
  else {
    model.cameraOrbit = VIEWS[0].orbit;
    model.cameraTarget = 'auto auto auto';
    activeView = 0;
    model.timeScale = 1;
    model.play();
  }
  refreshState();
});
$('fullscreen').hidden = !document.fullscreenEnabled;
$('fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await $('workspace').requestFullscreen();
    noticeKey = '';
  } catch (_) { noticeKey = 'fullscreenUnavailable'; }
  refreshState();
});
document.addEventListener('fullscreenchange', refreshState);
model.addEventListener('load', () => {
  loaded = true;
  errorKey = '';
  $('loading').hidden = true;
  $('error').hidden = true;
  $('loadProgress').value = 100;
  $('loadPercent').textContent = '100 %';
  hasAnimation = model.availableAnimations.includes('Presentation_360');
  canArticulate = MOTIONS.every(motion => model.availableAnimations.includes(motion.clip));
  applyPose(pose);
  refreshState();
});
model.addEventListener('progress', event => {
  const value = Math.max(0, Math.min(100, Math.round((event.detail?.totalProgress || 0) * 100)));
  $('loadProgress').value = value;
  $('loadPercent').textContent = value + ' %';
});
model.addEventListener('error', event => fail(event.detail?.type === 'webglcontextlost' ? 'errorContext' : 'errorLoad'));
model.addEventListener('play', () => { playing = true; refreshState(); });
model.addEventListener('pause', () => { playing = false; refreshState(); });
model.addEventListener('finished', () => { playing = false; refreshState(); });
model.addEventListener('camera-change', event => {
  if (event.detail?.source === 'user-interaction') { activeView = null; refreshState(); }
});
model.addEventListener('model-visibility', event => {
  // The mobile controls may be below the canvas. Reapply after offscreen changes.
  if (event.detail?.visible && model.loaded && model.timeScale === 0) applyPose(pose);
});
setLanguage(lang, false);

try {
  const { ModelViewerElement } = await import('../vendor/model-viewer-4.3.1.min.js');
  // Configure the local decoder before assigning src, so no GLB request races it.
  ModelViewerElement.dracoDecoderLocation = new URL('../vendor/draco/', import.meta.url).href;
  model.environmentImage = new URL('../assets/warehouse-v5.hdr', import.meta.url).href;
  model.src = new URL('../assets/rodbot-v5.glb', import.meta.url).href;
} catch (error) {
  console.error('RodBot viewer unavailable:', error);
  fail('errorModule');
}

// Match the training app's update behavior when this page is opened directly.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  let controlled = Boolean(navigator.serviceWorker.controller);
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!controlled || reloaded) return;
    reloaded = true;
    location.reload();
  });
  navigator.serviceWorker.register('../sw.js').then(registration => registration.update()).catch(() => {});
}
